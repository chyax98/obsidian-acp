/**
 * 统一检测器
 *
 * 整合新的 5 层优先级检测系统到现有架构
 * - 兼容现有的 AcpCliDetector 接口
 * - 使用新的 PriorityDetector 实现
 * - 提供详细的检测来源信息
 */

import { PriorityDetector, type DetectionOptions } from './priority-detector';
import type { DetectionResult as PriorityResult } from './env-detector';
import type { AcpBackendId } from './backends';
import { getDetectableClis } from './backends';

/**
 * 检测到的 Agent 信息 (兼容旧接口)
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
	/** 检测来源 */
	source?: 'env' | 'vault-config' | 'global-config' | 'manual' | 'auto';
	/** 环境变量名 (如果来源是 env) */
	envVar?: string;
}

/**
 * 检测结果 (兼容旧接口)
 */
export interface DetectionResult {
	/** 检测到的 Agent 列表 */
	agents: DetectedAgent[];
	/** 检测耗时 (ms) */
	duration: number;
	/** 检测时间戳 */
	timestamp: number;
}

/**
 * 统一检测器
 *
 * 使用新的 5 层优先级检测系统
 */
export class UnifiedDetector {
	private priorityDetector: PriorityDetector;
	private detectedAgents: DetectedAgent[] = [];
	private isDetected = false;
	private lastDetectionTime = 0;

	constructor() {
		this.priorityDetector = new PriorityDetector();
	}

	/**
	 * 执行 CLI 检测
	 *
	 * @param force 是否强制重新检测
	 * @param options 检测选项
	 * @returns 检测结果
	 */
	public async detect(
		force = false,
		options: {
			vaultPath?: string;
			globalConfigPath?: string;
			manualPaths?: Record<string, string>;
		} = {}
	): Promise<DetectionResult> {
		// 如果已检测且不强制，返回缓存结果
		if (this.isDetected && !force) {
			return {
				agents: this.detectedAgents,
				duration: 0,
				timestamp: this.lastDetectionTime,
			};
		}

		const startTime = Date.now();

		// 获取所有可检测的 CLI
		const cliList = getDetectableClis();
		const agentIds = cliList.map(cli => cli.backendId);

		// 使用优先级检测器检测所有 Agent
		const detectionResults = await this.priorityDetector.detectAll(agentIds, {
			vaultPath: options.vaultPath,
			globalConfigPath: options.globalConfigPath,
			manualPaths: options.manualPaths
		});

		// 转换为旧格式
		const detected: DetectedAgent[] = [];
		for (const result of detectionResults) {
			const cliConfig = cliList.find(c => c.backendId === result.agentId);
			if (!cliConfig || !result.found || !result.path) continue;

			detected.push({
				backendId: result.agentId as AcpBackendId,
				name: cliConfig.name,
				cliPath: result.path,
				acpArgs: cliConfig.acpArgs,
				version: result.version,
				source: result.source,
				envVar: result.envVar
			});
		}

		// 更新缓存
		this.detectedAgents = detected;
		this.isDetected = true;
		this.lastDetectionTime = Date.now();

		const duration = Date.now() - startTime;

		return {
			agents: detected,
			duration,
			timestamp: this.lastDetectionTime,
		};
	}

	/**
	 * 检测单个 Agent (用于 UI 实时检测)
	 *
	 * @param agentId - Agent ID
	 * @param options - 检测选项
	 * @returns 检测结果
	 */
	public async detectSingle(
		agentId: AcpBackendId,
		options: {
			vaultPath?: string;
			globalConfigPath?: string;
			manualPath?: string;
			cliCommand?: string;
		} = {}
	): Promise<PriorityResult> {
		return this.priorityDetector.detectWithPriority(agentId, {
			vaultPath: options.vaultPath,
			globalConfigPath: options.globalConfigPath,
			manualPaths: options.manualPath ? { [agentId]: options.manualPath } : undefined,
			cliCommand: options.cliCommand
		});
	}

	/**
	 * 获取 Agent 信息 (兼容旧接口)
	 *
	 * @param backendId - Agent ID
	 * @returns Agent 信息
	 */
	public getBackendInfo(backendId: AcpBackendId): DetectedAgent | undefined {
		return this.detectedAgents.find(agent => agent.backendId === backendId);
	}

	/**
	 * 获取所有检测到的 Agent
	 */
	public getAll(): DetectedAgent[] {
		return this.detectedAgents;
	}

	/**
	 * 获取优先级链说明
	 *
	 * @param agentId - Agent ID
	 * @returns 优先级信息列表
	 */
	public getPriorityChain(agentId: AcpBackendId) {
		return this.priorityDetector.getPriorityChain(agentId);
	}

	/**
	 * 清除缓存
	 */
	public clearCache(): void {
		this.detectedAgents = [];
		this.isDetected = false;
		this.lastDetectionTime = 0;
	}
}
