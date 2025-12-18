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
class AcpCliDetector {
	private detectedAgents: DetectedAgent[] = [];
	private isDetected = false;
	private lastDetectionTime = 0;

	/**
	 * 执行 CLI 检测
	 *
	 * @param force 是否强制重新检测
	 * @returns 检测结果
	 */
	async detect(force = false): Promise<DetectionResult> {
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
		const detectionPromises = cliList.map((cli) => this.detectSingleCli(cli, whichCommand));

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
	 */
	private async detectSingleCli(cli: DetectableAcpCli, whichCommand: string): Promise<DetectedAgent | null> {
		try {
			// 扩展 PATH 包含常见安装路径
			const expandedPath = [
				process.env.PATH || '',
				'/usr/local/bin',
				'/opt/homebrew/bin',
				`${process.env.HOME}/.local/bin`,
				`${process.env.HOME}/bin`,
			].filter(Boolean).join(':');

			// 执行 which/where 命令
			const result = execSync(`${whichCommand} ${cli.cmd}`, {
				encoding: 'utf-8',
				stdio: 'pipe',
				timeout: 1000, // 1 秒超时
				env: { ...process.env, PATH: expandedPath },
			});

			// 解析路径 (取第一行，去除换行)
			const cliPath = result.trim().split('\n')[0].trim();

			if (!cliPath) {
				return null;
			}

			// 尝试获取版本信息
			const version = await this.getCliVersion(cli.cmd, expandedPath);

			return {
				backendId: cli.backendId,
				name: cli.name,
				cliPath,
				acpArgs: cli.args,
				version,
			};
		} catch {
			// CLI 未安装，静默返回 null
			return null;
		}
	}

	/**
	 * 尝试获取 CLI 版本
	 */
	private async getCliVersion(cmd: string, expandedPath?: string): Promise<string | undefined> {
		try {
			// 尝试 --version 参数
			const result = execSync(`${cmd} --version`, {
				encoding: 'utf-8',
				stdio: 'pipe',
				timeout: 2000,
				env: expandedPath ? { ...process.env, PATH: expandedPath } : process.env,
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
 */
export async function detectInstalledClis(force = false): Promise<DetectionResult> {
	return cliDetector.detect(force);
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
