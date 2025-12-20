/**
 * 优先级检测器
 *
 * 简化的 Agent CLI 检测器，实现 2 层优先级检测流程：
 * 1. 用户填写 (插件设置) - 最高优先级
 * 2. 自动检测 (默认路径 + PATH) - 用户未配置时使用
 */

import { type DetectionResult } from './env-detector';
import { PathValidator } from './path-validator';
import { getBackendConfig } from './backends';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * 检测选项
 */
export interface DetectionOptions {
	/**
	 * Vault 路径 (保留用于向后兼容，但不再使用)
	 */
	vaultPath?: string;

	/**
	 * 全局配置文件路径 (保留用于向后兼容，但不再使用)
	 */
	globalConfigPath?: string;

	/**
	 * 手动输入的路径 (from plugin settings) - 最高优先级
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
	private pathValidator: PathValidator;

	constructor() {
		this.pathValidator = new PathValidator();
	}

	/**
	 * 使用优先级检测 Agent 路径
	 *
	 * 简化为 2 层优先级：
	 * 1. 用户填写的路径（最高优先级）
	 * 2. 自动检测（默认路径或 PATH 中的命令）
	 *
	 * @param agentId - Agent ID
	 * @param options - 检测选项
	 * @returns 检测结果
	 */
	public async detectWithPriority(
		agentId: string,
		options: DetectionOptions = {},
	): Promise<DetectionResult> {
		// 1️⃣ 优先级 1: 用户填写的路径
		if (options.manualPaths && options.manualPaths[agentId]) {
			const manualPath = options.manualPaths[agentId].trim();
			if (manualPath) {
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
						version: validation.version,
					};
				}
				// 用户填写的路径无效，继续尝试自动检测
			}
		}

		// 2️⃣ 优先级 2: 自动检测
		// 2a. 优先使用后端配置的默认路径
		const backendConfig = getBackendConfig(agentId as any);
		if (backendConfig?.defaultCliPath) {
			const defaultPath = backendConfig.defaultCliPath;
			const npxInfo = this.pathValidator.getNpxCommand(defaultPath);

			// npx 命令直接使用，不需要验证路径
			if (npxInfo.isNpx) {
				return {
					found: true,
					agentId,
					path: defaultPath,
					source: 'auto',
					isNpxCommand: true,
				};
			}

			// 非 npx 命令，验证路径
			const validation = await this.pathValidator.validatePath(defaultPath);
			if (validation.isValid) {
				return {
					found: true,
					agentId,
					path: validation.path,
					source: 'auto',
					isNpxCommand: false,
					version: validation.version,
				};
			}
		}

		// 2b. 从系统 PATH 中检测
		const cliCommand = options.cliCommand || backendConfig?.cliCommand;
		if (cliCommand && cliCommand !== 'npx') {
			const autoResult = await this.autoDetect(agentId, cliCommand);
			if (autoResult.found) {
				return autoResult;
			}
		}

		// 未找到
		return {
			found: false,
			agentId,
			source: 'none',
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
		options: DetectionOptions = {},
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
	 * @param _agentId - Agent ID (保留用于兼容)
	 * @returns 优先级信息列表
	 */
	public getPriorityChain(_agentId: string): PriorityInfo[] {
		return [
			{
				priority: 1,
				source: 'manual',
				description: '用户填写 (插件设置)',
			},
			{
				priority: 2,
				source: 'auto',
				description: '自动检测 (默认路径或系统 PATH)',
			},
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
			const { stdout } = await execFileAsync(whichCommand, [cliCommand]);

			// Windows 的 where 输出可能包含 CRLF，需要去除 \r
			const cliPath = stdout.trim().split(/\r?\n/)[0]; // 取第一个结果，兼容 CRLF

			// 验证路径
			const validation = await this.pathValidator.validatePath(cliPath);

			if (validation.isValid) {
				return {
					found: true,
					agentId,
					path: validation.path,
					source: 'auto',
					isNpxCommand: false,
					version: validation.version,
				};
			}
		} catch (err) {
			// which/where 命令失败，说明不在 PATH 中
		}

		return {
			found: false,
			agentId,
			source: 'none',
		};
	}
}
