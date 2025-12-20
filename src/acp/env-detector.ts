/**
 * 环境变量检测器
 *
 * 负责从环境变量中检测 Agent CLI 路径
 * - 检测 ${AGENT_ID}_PATH 格式的环境变量
 * - 支持路径扩展 (波浪线和环境变量)
 * - 验证检测到的路径
 *
 * TDD Phase 2: 实现环境变量检测
 */

import { PathValidator } from './path-validator';

/**
 * 检测结果
 */
export interface DetectionResult {
	/**
	 * 是否找到
	 */
	found: boolean;

	/**
	 * Agent ID
	 */
	agentId?: string;

	/**
	 * 检测到的路径
	 */
	path?: string;

	/**
	 * 来源
	 */
	source: 'env' | 'vault-config' | 'global-config' | 'manual' | 'auto' | 'none';

	/**
	 * 环境变量名
	 */
	envVar?: string;

	/**
	 * 是否为 npx 命令
	 */
	isNpxCommand?: boolean;

	/**
	 * 错误信息
	 */
	error?: string;

	/**
	 * 版本信息
	 */
	version?: string;
}

/**
 * Agent 映射表
 * 定义 Agent ID 到环境变量名的转换规则
 */
const AGENT_ENV_MAP: Record<string, string> = {
	'claude': 'CLAUDE_CODE_PATH',
	'kimi': 'KIMI_PATH',
	'codex': 'CODEX_PATH',
	'gemini': 'GEMINI_PATH',
	'qwen': 'QWEN_PATH',
	'goose': 'GOOSE_PATH',
	'auggie': 'AUGGIE_PATH',
	'opencode': 'OPENCODE_PATH',
};

/**
 * 环境变量检测器
 */
export class EnvDetector {
	private pathValidator: PathValidator;

	constructor() {
		this.pathValidator = new PathValidator();
	}

	/**
	 * 检测 Agent 路径
	 *
	 * @param agentId - Agent ID
	 * @returns 检测结果
	 */
	public async detectAgentPath(agentId: string): Promise<DetectionResult> {
		// 获取环境变量名
		const envVarName = this.getEnvVarName(agentId);

		// 读取环境变量
		const envValue = process.env[envVarName];

		// 环境变量未设置
		if (!envValue) {
			return {
				found: false,
				agentId,
				source: 'none',
			};
		}

		// 扩展路径
		const expandedPath = this.pathValidator.expandPath(envValue);

		// 验证路径
		const validation = await this.pathValidator.validatePath(expandedPath);

		// 验证失败
		if (!validation.isValid) {
			return {
				found: false,
				agentId,
				path: expandedPath,
				source: 'env',
				envVar: envVarName,
				error: validation.error,
			};
		}

		// 检测是否为 npx 命令
		const npxInfo = this.pathValidator.getNpxCommand(expandedPath);

		// 成功检测
		return {
			found: true,
			agentId,
			path: validation.path,
			source: 'env',
			envVar: envVarName,
			isNpxCommand: npxInfo.isNpx,
			version: validation.version,
		};
	}

	/**
	 * 获取环境变量名
	 *
	 * 规则:
	 * - 使用预定义映射表
	 * - 如果不在映射表中，自动生成: ${AGENT_ID}_PATH (大写，连字符转下划线)
	 *
	 * @param agentId - Agent ID
	 * @returns 环境变量名
	 */
	public getEnvVarName(agentId: string): string {
		// 检查映射表
		if (AGENT_ENV_MAP[agentId]) {
			return AGENT_ENV_MAP[agentId];
		}

		// 自动生成：转大写，连字符/下划线统一为下划线，添加 _PATH 后缀
		const normalizedId = agentId
			.toUpperCase()
			.replace(/-/g, '_');

		return `${normalizedId}_PATH`;
	}

	/**
	 * 列出所有从环境变量检测到的 Agent
	 *
	 * @param agentIds - 要检测的 Agent ID 列表
	 * @returns 检测到的 Agent 列表
	 */
	public async listDetectedAgents(agentIds: string[]): Promise<DetectionResult[]> {
		const results: DetectionResult[] = [];

		for (const agentId of agentIds) {
			const result = await this.detectAgentPath(agentId);
			if (result.found) {
				results.push(result);
			}
		}

		return results;
	}
}
