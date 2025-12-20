/**
 * 优先级检测器
 *
 * 统一的 Agent CLI 检测器，实现 5 层优先级检测流程：
 * 1. 环境变量 (最高优先级)
 * 2. Vault 配置文件
 * 3. 全局配置文件
 * 4. 手动输入 (插件设置)
 * 5. 自动检测 (PATH) (最低优先级)
 *
 * TDD Phase 4: 实现完整检测流程
 */

import { EnvDetector, type DetectionResult } from './env-detector';
import { ConfigDetector } from './config-detector';
import { PathValidator } from './path-validator';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 检测选项
 */
export interface DetectionOptions {
	/**
	 * Vault 路径 (用于 Vault 配置)
	 */
	vaultPath?: string;

	/**
	 * 全局配置文件路径 (默认 ~/.acprc)
	 */
	globalConfigPath?: string;

	/**
	 * 手动输入的路径 (from plugin settings)
	 */
	manualPaths?: Record<string, string>;

	/**
	 * CLI 命令名 (用于 PATH 自动检测)
	 */
	cliCommand?: string;
}

/**
 * 优先级说明
 */
export interface PriorityInfo {
	/**
	 * 优先级 (1 最高, 5 最低)
	 */
	priority: number;

	/**
	 * 来源类型
	 */
	source: DetectionResult['source'];

	/**
	 * 说明
	 */
	description: string;
}

/**
 * 优先级检测器
 */
export class PriorityDetector {
	private envDetector: EnvDetector;
	private configDetector: ConfigDetector;
	private pathValidator: PathValidator;

	constructor() {
		this.envDetector = new EnvDetector();
		this.configDetector = new ConfigDetector();
		this.pathValidator = new PathValidator();
	}

	/**
	 * 使用优先级检测 Agent 路径
	 *
	 * 按照 5 层优先级顺序检测，返回第一个有效的结果
	 *
	 * @param agentId - Agent ID
	 * @param options - 检测选项
	 * @returns 检测结果
	 */
	public async detectWithPriority(
		agentId: string,
		options: DetectionOptions = {}
	): Promise<DetectionResult> {
		// 1️⃣ 优先级 1: 环境变量
		const envResult = await this.envDetector.detectAgentPath(agentId);
		if (envResult.found) {
			return envResult;
		}

		// 2️⃣ 优先级 2: Vault 配置文件
		if (options.vaultPath) {
			const vaultResult = await this.configDetector.detectAgentPath(
				agentId,
				options.vaultPath
			);
			if (vaultResult.found) {
				return vaultResult;
			}
		}

		// 3️⃣ 优先级 3: 全局配置文件
		if (options.globalConfigPath || true) { // 总是尝试默认路径
			const globalResult = await this.configDetector.detectAgentPath(
				agentId,
				undefined, // 跳过 Vault
				options.globalConfigPath
			);
			if (globalResult.found) {
				return globalResult;
			}
		}

		// 4️⃣ 优先级 4: 手动输入
		if (options.manualPaths && options.manualPaths[agentId]) {
			const manualPath = options.manualPaths[agentId];
			const expandedPath = this.pathValidator.expandPath(manualPath);
			const validation = await this.pathValidator.validatePath(expandedPath);

			if (validation.isValid) {
				const npxInfo = this.pathValidator.getNpxCommand(expandedPath);
				return {
					found: true,
					agentId,
					path: validation.path,
					source: 'manual',
					isNpxCommand: npxInfo.isNpx,
					version: validation.version
				};
			}
		}

		// 5️⃣ 优先级 5: 自动检测 (PATH)
		if (options.cliCommand) {
			const autoResult = await this.autoDetect(agentId, options.cliCommand);
			if (autoResult.found) {
				return autoResult;
			}
		}

		// 未找到
		return {
			found: false,
			agentId,
			source: 'none'
		};
	}

	/**
	 * 检测所有 Agent
	 *
	 * @param agentIds - Agent ID 列表
	 * @param options - 检测选项
	 * @returns 检测到的 Agent 列表
	 */
	public async detectAll(
		agentIds: string[],
		options: DetectionOptions = {}
	): Promise<DetectionResult[]> {
		const results: DetectionResult[] = [];

		for (const agentId of agentIds) {
			const result = await this.detectWithPriority(agentId, options);
			if (result.found) {
				results.push(result);
			}
		}

		return results;
	}

	/**
	 * 获取优先级链说明
	 *
	 * @param agentId - Agent ID
	 * @returns 优先级信息列表
	 */
	public getPriorityChain(agentId: string): PriorityInfo[] {
		const envVarName = this.envDetector.getEnvVarName(agentId);

		return [
			{
				priority: 1,
				source: 'env',
				description: `环境变量 ${envVarName}`
			},
			{
				priority: 2,
				source: 'vault-config',
				description: 'Vault 配置文件 (.obsidian/plugins/obsidian-acp/.acp.json)'
			},
			{
				priority: 3,
				source: 'global-config',
				description: '全局配置文件 (~/.acprc)'
			},
			{
				priority: 4,
				source: 'manual',
				description: '手动输入 (插件设置)'
			},
			{
				priority: 5,
				source: 'auto',
				description: '自动检测 (系统 PATH)'
			}
		];
	}

	/**
	 * 自动检测 (从系统 PATH)
	 *
	 * @param agentId - Agent ID
	 * @param cliCommand - CLI 命令名
	 * @returns 检测结果
	 */
	private async autoDetect(agentId: string, cliCommand: string): Promise<DetectionResult> {
		try {
			// 使用 which (Unix) 或 where (Windows)
			const whichCommand = process.platform === 'win32' ? 'where' : 'which';
			const { stdout } = await execAsync(`${whichCommand} ${cliCommand}`);

			const cliPath = stdout.trim().split('\n')[0]; // 取第一个结果

			// 验证路径
			const validation = await this.pathValidator.validatePath(cliPath);

			if (validation.isValid) {
				return {
					found: true,
					agentId,
					path: validation.path,
					source: 'auto',
					isNpxCommand: false,
					version: validation.version
				};
			}
		} catch (err) {
			// which/where 命令失败，说明不在 PATH 中
		}

		return {
			found: false,
			agentId,
			source: 'none'
		};
	}
}
