/**
 * ACP CLI 检测器
 *
 * 自动检测用户系统中已安装的 ACP Agent CLI 工具。
 * 使用 `which` (Unix) 或 `where` (Windows) 命令进行检测。
 */

import { execSync } from 'child_process';
import { Platform } from 'obsidian';
import type { AcpBackendId, BackendRuntimeState, DetectableAcpCli } from './backends';
import { getDetectableClis, getBackendConfig } from './backends';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 检测到的 Agent 信息
 */
export interface DetectedAgent {
	/** 后端 ID */
	backendId: AcpBackendId;
	/** 显示名称 */
	name: string;
	/** CLI 完整路径 */
	cliPath: string;
	/** ACP 启动参数 */
	acpArgs: string[];
	/** 版本信息 (如果可获取) */
	version?: string;
}

/**
 * 检测结果
 */
export interface DetectionResult {
	/** 检测到的 Agent 列表 */
	agents: DetectedAgent[];
	/** 检测耗时 (ms) */
	duration: number;
	/** 检测时间戳 */
	timestamp: number;
}

// ============================================================================
// CLI 检测器类
// ============================================================================

/**
 * ACP CLI 检测器
 *
 * 单例模式，启动时检测一次，全局共享结果。
 */
export class AcpCliDetector {
	private detectedAgents: DetectedAgent[] = [];
	private isDetected = false;
	private lastDetectionTime = 0;

	/**
	 * 执行 CLI 检测
	 *
	 * @param force 是否强制重新检测
	 * @param manualPaths 用户手动配置的 Agent 路径 (backendId -> path)
	 * @returns 检测结果
	 */
	async detect(force = false, manualPaths?: Record<string, string>): Promise<DetectionResult> {
		// 如果已检测且不强制，返回缓存结果
		if (this.isDetected && !force) {
			return {
				agents: this.detectedAgents,
				duration: 0,
				timestamp: this.lastDetectionTime,
			};
		}

		console.log('[ACP Detector] 开始检测已安装的 CLI...');
		const startTime = Date.now();

		// 获取可检测的 CLI 列表
		const cliList = getDetectableClis();

		// 获取平台特定的检测命令
		const whichCommand = this.getWhichCommand();

		// 并行检测所有 CLI
		const detectionPromises = cliList.map((cli) =>
			this.detectSingleCli(cli, whichCommand, manualPaths?.[cli.backendId]),
		);

		const results = await Promise.allSettled(detectionPromises);

		// 收集成功检测的结果
		const detected: DetectedAgent[] = [];
		for (const result of results) {
			if (result.status === 'fulfilled' && result.value) {
				detected.push(result.value);
			}
		}

		// 更新状态
		this.detectedAgents = detected;
		this.isDetected = true;
		this.lastDetectionTime = Date.now();

		const duration = Date.now() - startTime;
		console.log(`[ACP Detector] 检测完成，耗时 ${duration}ms，发现 ${detected.length} 个 Agent`);

		return {
			agents: detected,
			duration,
			timestamp: this.lastDetectionTime,
		};
	}

	/**
	 * 获取平台特定的 which 命令
	 */
	private getWhichCommand(): string {
		// Obsidian Platform API
		if (Platform.isWin) {
			return 'where';
		}
		return 'which';
	}

	/**
	 * 检测单个 CLI
	 *
	 * @param cli CLI 配置
	 * @param whichCommand which/where 命令
	 * @param manualPath 用户手动配置的路径（可选）
	 */
	private async detectSingleCli(
		cli: DetectableAcpCli,
		whichCommand: string,
		manualPath?: string,
	): Promise<DetectedAgent | null> {
		// 1. 如果有手动配置路径，优先使用
		if (manualPath) {
			const validated = await this.validateManualPath(manualPath, cli.cmd);
			if (validated) {
				return {
					backendId: cli.backendId,
					name: cli.name,
					cliPath: validated.path,
					acpArgs: cli.args,
					version: validated.version,
				};
			}
		}

		// 2. 特殊处理：Claude Code 需要特殊检测
		if (cli.backendId === 'claude') {
			return await this.detectClaudeCodeAcp();
		}

		// 3. 通用检测：尝试 which/where 命令
		try {
			const result = execSync(`${whichCommand} ${cli.cmd}`, {
				encoding: 'utf-8',
				stdio: 'pipe',
				timeout: 1000,
			});

			const cliPath = result.trim().split('\n')[0].trim();
			if (cliPath) {
				const version = await this.getCliVersion(cli.cmd);
				return {
					backendId: cli.backendId,
					name: cli.name,
					cliPath,
					acpArgs: cli.args,
					version,
				};
			}
		} catch {
			// 自动检测失败
		}

		return null;
	}

	/**
	 * 检测 Claude Code ACP wrapper（Zed 版本）
	 * 直接尝试运行命令，不依赖 which
	 */
	private async detectClaudeCodeAcp(): Promise<DetectedAgent | null> {
		// 方案1：尝试直接运行（依赖 PATH）
		try {
			const result = execSync('claude-code-acp --version', {
				encoding: 'utf-8',
				stdio: 'pipe',
				timeout: 3000,
			});

			if (result) {
				console.log('[ACP Detector] ✅ 检测到 claude-code-acp');
				const version = result.trim();
				return {
					backendId: 'claude',
					name: 'Claude Code (Zed)',
					cliPath: 'claude-code-acp',
					acpArgs: [],
					version,
				};
			}
		} catch {
			// 方案1失败，尝试方案2
		}

		// 方案2：尝试常见的安装路径
		const commonPaths = [
			`${process.env.HOME}/.nvm/versions/node/*/bin/claude-code-acp`,
			'/usr/local/bin/claude-code-acp',
			'/opt/homebrew/bin/claude-code-acp',
		];

		for (const pathPattern of commonPaths) {
			try {
				// 展开 glob 模式
				const expandedPath = execSync(`ls ${pathPattern} 2>/dev/null | head -1`, {
					encoding: 'utf-8',
					stdio: 'pipe',
					timeout: 1000,
					shell: '/bin/bash',
				}).trim();

				if (expandedPath) {
					// 尝试运行
					const result = execSync(`${expandedPath} --version`, {
						encoding: 'utf-8',
						stdio: 'pipe',
						timeout: 3000,
					});

					if (result) {
						console.log(`[ACP Detector] ✅ 检测到 claude-code-acp: ${expandedPath}`);
						const version = result.trim();
						return {
							backendId: 'claude',
							name: 'Claude Code (Zed)',
							cliPath: expandedPath,
							acpArgs: [],
							version,
						};
					}
				}
			} catch {
				// 这个路径不可用，继续
			}
		}

		console.log('[ACP Detector] claude-code-acp 不可用，请手动配置路径');
		return null;
	}

	/**
	 * 验证手动配置的路径
	 *
	 * @param manualPath 用户配置的路径
	 * @param cmd CLI 命令名
	 * @returns 验证结果（路径和版本）或 null
	 */
	private async validateManualPath(
		manualPath: string,
		cmd: string,
	): Promise<{ path: string; version?: string } | null> {
		try {
			// 1. 检查文件是否存在且可执行
			const result = execSync(`test -x "${manualPath}" && echo "ok"`, {
				encoding: 'utf-8',
				stdio: 'pipe',
				timeout: 1000,
				shell: '/bin/sh',
			});

			if (!result.trim().includes('ok')) {
				return null;
			}

			// 2. 尝试获取版本
			const version = await this.getCliVersion(manualPath);

			console.log(`[ACP Detector] 使用手动配置的路径: ${manualPath}`);
			return { path: manualPath, version };
		} catch {
			console.warn(`[ACP Detector] 手动配置的路径无效: ${manualPath}`);
			return null;
		}
	}

	/**
	 * 尝试获取 CLI 版本
	 */
	private async getCliVersion(cmd: string): Promise<string | undefined> {
		try {
			// 尝试 --version 参数
			const result = execSync(`${cmd} --version`, {
				encoding: 'utf-8',
				stdio: 'pipe',
				timeout: 2000,
			});

			// 提取版本号 (简单匹配 x.x.x 格式)
			const versionMatch = result.match(/\d+\.\d+\.\d+/);
			return versionMatch?.[0];
		} catch {
			// 版本获取失败，忽略
			return undefined;
		}
	}

	/**
	 * 获取检测到的 Agent 列表
	 */
	getDetectedAgents(): DetectedAgent[] {
		return [...this.detectedAgents];
	}

	/**
	 * 检查是否有可用的 Agent
	 */
	hasAgents(): boolean {
		return this.detectedAgents.length > 0;
	}

	/**
	 * 检查特定后端是否可用
	 */
	isBackendAvailable(backendId: AcpBackendId): boolean {
		return this.detectedAgents.some((agent) => agent.backendId === backendId);
	}

	/**
	 * 获取特定后端的检测信息
	 */
	getBackendInfo(backendId: AcpBackendId): DetectedAgent | undefined {
		return this.detectedAgents.find((agent) => agent.backendId === backendId);
	}

	/**
	 * 获取所有后端的运行时状态
	 */
	getBackendStates(): BackendRuntimeState[] {
		const cliList = getDetectableClis();

		return cliList.map((cli) => {
			const detected = this.detectedAgents.find((agent) => agent.backendId === cli.backendId);

			return {
				id: cli.backendId,
				detectionStatus: this.isDetected ? (detected ? 'installed' : 'not_installed') : 'unknown',
				cliPath: detected?.cliPath,
				version: detected?.version,
				lastChecked: this.lastDetectionTime || undefined,
			};
		});
	}

	/**
	 * 重置检测状态
	 */
	reset(): void {
		this.detectedAgents = [];
		this.isDetected = false;
		this.lastDetectionTime = 0;
	}

	/**
	 * 是否已完成检测
	 */
	get detected(): boolean {
		return this.isDetected;
	}
}

// ============================================================================
// 单例导出
// ============================================================================

/**
 * CLI 检测器单例实例
 */
export const cliDetector = new AcpCliDetector();

/**
 * 便捷函数：执行检测
 *
 * @param force 是否强制重新检测
 * @param manualPaths 用户手动配置的 Agent 路径
 */
export async function detectInstalledClis(
	force = false,
	manualPaths?: Record<string, string>,
): Promise<DetectionResult> {
	return cliDetector.detect(force, manualPaths);
}

/**
 * 便捷函数：获取检测到的 Agent
 */
export function getDetectedAgents(): DetectedAgent[] {
	return cliDetector.getDetectedAgents();
}

/**
 * 便捷函数：检查后端是否可用
 */
export function isBackendAvailable(backendId: AcpBackendId): boolean {
	return cliDetector.isBackendAvailable(backendId);
}
