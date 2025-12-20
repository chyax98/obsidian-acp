/**
 * 配置文件检测器
 *
 * 负责从配置文件中检测 Agent CLI 路径
 * - 支持 Vault 配置 (.obsidian/plugins/obsidian-acp/.acp.json)
 * - 支持全局配置 (~/.acprc)
 * - JSON 格式验证
 * - 路径扩展支持
 *
 * TDD Phase 3: 实现配置文件检测
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PathValidator } from './path-validator';
import type { DetectionResult } from './env-detector';

/**
 * 配置加载结果
 */
export interface ConfigLoadResult {
	/**
	 * 是否加载成功
	 */
	loaded: boolean;

	/**
	 * 配置文件路径
	 */
	configPath?: string;

	/**
	 * Agent 路径映射
	 */
	agents: Record<string, string>;

	/**
	 * 错误信息
	 */
	error?: string;
}

/**
 * 配置文件格式
 */
interface ConfigFile {
	agents: Record<string, string>;
}

/**
 * Agent 别名映射表
 * 支持向后兼容，旧的配置键自动映射到新的后端 ID
 */
const AGENT_ALIAS_MAP: Record<string, string> = {
	'codex': 'codex-acp', // 向后兼容：codex → codex-acp
};

/**
 * 配置文件检测器
 */
export class ConfigDetector {
	private pathValidator: PathValidator;

	constructor() {
		this.pathValidator = new PathValidator();
	}

	/**
	 * 加载 Vault 配置文件
	 *
	 * 配置文件路径: {vaultPath}/.obsidian/plugins/obsidian-acp/.acp.json
	 *
	 * @param vaultPath - Vault 根目录路径
	 * @returns 配置加载结果
	 */
	public async loadVaultConfig(vaultPath: string): Promise<ConfigLoadResult> {
		const configPath = path.join(
			vaultPath,
			'.obsidian',
			'plugins',
			'obsidian-acp',
			'.acp.json',
		);

		return this.loadConfigFile(configPath);
	}

	/**
	 * 加载全局配置文件
	 *
	 * 默认路径: ~/.acprc
	 *
	 * @param configPath - 配置文件路径 (可选，默认 ~/.acprc)
	 * @returns 配置加载结果
	 */
	public async loadGlobalConfig(configPath?: string): Promise<ConfigLoadResult> {
		const finalPath = configPath || this.getDefaultGlobalConfigPath();

		return this.loadConfigFile(finalPath);
	}

	/**
	 * 获取默认全局配置文件路径
	 *
	 * 跨平台兼容：
	 * - Windows: %USERPROFILE%/.acprc
	 * - Unix: $HOME/.acprc
	 * - 降级: /tmp/.acprc
	 *
	 * @returns 默认全局配置文件路径
	 */
	private getDefaultGlobalConfigPath(): string {
		const home = process.env.USERPROFILE || process.env.HOME || '/tmp';
		return path.join(home, '.acprc');
	}

	/**
	 * 检测 Agent 路径
	 *
	 * 优先级: Vault 配置 > 全局配置
	 *
	 * @param agentId - Agent ID
	 * @param vaultPath - Vault 路径 (可选)
	 * @param globalConfigPath - 全局配置路径 (可选)
	 * @returns 检测结果
	 */
	public async detectAgentPath(
		agentId: string,
		vaultPath?: string,
		globalConfigPath?: string,
	): Promise<DetectionResult> {
		// 应用别名转换
		const normalizedAgentId = this.resolveAlias(agentId);

		let agentPath: string | undefined;
		let source: DetectionResult['source'] = 'none';

		// 1. 尝试 Vault 配置
		if (vaultPath) {
			const vaultConfig = await this.loadVaultConfig(vaultPath);
			if (vaultConfig.loaded) {
				// 尝试原始 ID 和别名
				agentPath = vaultConfig.agents[agentId] || vaultConfig.agents[normalizedAgentId];
				if (agentPath) {
					source = 'vault-config';
				}
			}
		}

		// 2. 如果没找到，尝试全局配置（总是尝试，即使 globalConfigPath 为 undefined 也会使用默认 ~/.acprc）
		if (!agentPath) {
			const globalConfig = await this.loadGlobalConfig(globalConfigPath);
			if (globalConfig.loaded) {
				// 尝试原始 ID 和别名
				agentPath = globalConfig.agents[agentId] || globalConfig.agents[normalizedAgentId];
				if (agentPath) {
					source = 'global-config';
				}
			}
		}

		// 3. 如果还没找到，返回未找到
		if (!agentPath) {
			return {
				found: false,
				agentId,
				source: 'none',
			};
		}

		// 4. 扩展路径
		const expandedPath = this.pathValidator.expandPath(agentPath);

		// 5. 验证路径
		const validation = await this.pathValidator.validatePath(expandedPath);

		// 6. 验证失败
		if (!validation.isValid) {
			return {
				found: false,
				agentId,
				path: expandedPath,
				source,
				error: validation.error,
			};
		}

		// 7. 检测是否为 npx 命令
		const npxInfo = this.pathValidator.getNpxCommand(expandedPath);

		// 8. 成功检测
		return {
			found: true,
			agentId,
			path: validation.path,
			source,
			isNpxCommand: npxInfo.isNpx,
			version: validation.version,
		};
	}

	/**
	 * 列出所有配置的 Agent
	 *
	 * @param vaultPath - Vault 路径 (可选)
	 * @param globalConfigPath - 全局配置路径 (可选)
	 * @returns 检测结果列表
	 */
	public async listConfiguredAgents(
		vaultPath?: string,
		globalConfigPath?: string,
	): Promise<DetectionResult[]> {
		const results: DetectionResult[] = [];
		const processedAgents = new Set<string>();

		// 1. 加载 Vault 配置
		if (vaultPath) {
			const vaultConfig = await this.loadVaultConfig(vaultPath);
			if (vaultConfig.loaded) {
				for (const agentId of Object.keys(vaultConfig.agents)) {
					const result = await this.detectAgentPath(agentId, vaultPath);
					if (result.found) {
						results.push(result);
						processedAgents.add(agentId);
					}
				}
			}
		}

		// 2. 加载全局配置 (跳过已处理的 Agent)（总是尝试，即使 globalConfigPath 为 undefined 也会使用默认 ~/.acprc）
		const globalConfig = await this.loadGlobalConfig(globalConfigPath);
		if (globalConfig.loaded) {
			for (const agentId of Object.keys(globalConfig.agents)) {
				if (!processedAgents.has(agentId)) {
					const result = await this.detectAgentPath(agentId, undefined, globalConfigPath);
					if (result.found) {
						results.push(result);
						processedAgents.add(agentId);
					}
				}
			}
		}

		return results;
	}

	/**
	 * 保存 Vault 配置
	 *
	 * @param vaultPath - Vault 路径
	 * @param agents - Agent 路径映射
	 */
	public async saveVaultConfig(
		vaultPath: string,
		agents: Record<string, string>,
	): Promise<void> {
		const configDir = path.join(
			vaultPath,
			'.obsidian',
			'plugins',
			'obsidian-acp',
		);
		const configPath = path.join(configDir, '.acp.json');

		// 创建目录
		await fs.mkdir(configDir, { recursive: true });

		// 构建配置对象
		const config: ConfigFile = { agents };

		// 写入文件
		await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
	}

	/**
	 * 解析 Agent 别名
	 *
	 * 如果 agentId 在别名映射表中，返回规范的 ID，否则返回原值
	 *
	 * @param agentId - Agent ID
	 * @returns 规范化的 Agent ID
	 */
	private resolveAlias(agentId: string): string {
		return AGENT_ALIAS_MAP[agentId] || agentId;
	}

	/**
	 * 加载配置文件
	 *
	 * @param configPath - 配置文件路径
	 * @returns 配置加载结果
	 */
	private async loadConfigFile(configPath: string): Promise<ConfigLoadResult> {
		try {
			// 读取文件
			const content = await fs.readFile(configPath, 'utf-8');

			// 解析 JSON
			let config: ConfigFile;
			try {
				config = JSON.parse(content);
			} catch (err) {
				return {
					loaded: false,
					agents: {},
					error: `JSON 解析失败: ${err instanceof Error ? err.message : String(err)}`,
				};
			}

			// 验证格式
			if (!config.agents || typeof config.agents !== 'object') {
				return {
					loaded: false,
					agents: {},
					error: '配置文件格式无效: 缺少 agents 字段',
				};
			}

			// 扩展所有路径
			const expandedAgents: Record<string, string> = {};
			for (const [agentId, agentPath] of Object.entries(config.agents)) {
				expandedAgents[agentId] = this.pathValidator.expandPath(agentPath);
			}

			return {
				loaded: true,
				configPath,
				agents: expandedAgents,
			};
		} catch (err) {
			// 文件不存在或读取失败
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
				return {
					loaded: false,
					agents: {},
				};
			}

			return {
				loaded: false,
				agents: {},
				error: `读取配置文件失败: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	}
}
