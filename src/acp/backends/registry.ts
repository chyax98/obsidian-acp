/**
 * ACP Agent 后端注册表
 *
 * 支持多个 ACP 兼容 Agent：Claude Code, Goose, OpenCode
 */

import type { AcpBackendConfig, AcpBackendId } from "./types";

/**
 * 内置 Agent 配置
 */
export const ACP_BACKENDS: Record<AcpBackendId, AcpBackendConfig> = {
	claude: {
		id: "claude",
		name: "Claude Code",
		description: "Anthropic Claude Code (Zed 官方 ACP 适配器)",
		cliCommand: "npx",
		defaultCliPath: "npx @zed-industries/claude-code-acp",
		authRequired: false,
		enabled: true,
		supportsStreaming: false,
		streamingMode: "cumulative", // Claude Code 每次发送完整累积内容
		acpArgs: [],
	},
	goose: {
		id: "goose",
		name: "Goose",
		description: "Block (Square) 开源 AI Agent，Rust 原生 ACP 实现",
		cliCommand: "goose",
		defaultCliPath: "goose",
		authRequired: false,
		enabled: true,
		supportsStreaming: false,
		streamingMode: "incremental", // Goose 每次发送增量内容
		acpArgs: ["acp"],
	},
	opencode: {
		id: "opencode",
		name: "OpenCode",
		description: "开源多模型 AI Agent，支持 30+ 提供商",
		cliCommand: "opencode",
		defaultCliPath: "opencode",
		authRequired: false,
		enabled: true,
		supportsStreaming: false,
		streamingMode: "incremental", // OpenCode 每次发送增量内容
		acpArgs: ["acp"],
	},
	gemini: {
		id: "gemini",
		name: "Gemini CLI",
		description: "Google Gemini CLI (ACP 参考实现)",
		cliCommand: "gemini",
		defaultCliPath: "gemini",
		authRequired: false,
		enabled: true,
		supportsStreaming: false,
		streamingMode: "incremental",
		acpArgs: ["--experimental-acp"],
	},
};

/**
 * 获取 Agent 配置
 *
 * @param id Agent ID
 * @returns Agent 配置
 */
export function getBackendConfig(id: AcpBackendId): AcpBackendConfig {
	return ACP_BACKENDS[id];
}

/**
 * 获取 Agent 的 ACP 启动参数
 *
 * @param id Agent ID
 * @returns ACP 启动参数数组
 */
export function getBackendAcpArgs(id: AcpBackendId): string[] {
	return ACP_BACKENDS[id]?.acpArgs || [];
}

/**
 * 获取 Agent 的启动命令
 *
 * @param id Agent ID
 * @returns 启动命令字符串
 */
export function getBackendStartCommand(id: AcpBackendId): string {
	return ACP_BACKENDS[id]?.defaultCliPath || ACP_BACKENDS[id]?.cliCommand || "";
}

/**
 * 获取所有可用的 Agent 列表
 *
 * @returns Agent 配置数组
 */
export function getAllBackends(): AcpBackendConfig[] {
	return Object.values(ACP_BACKENDS);
}

/**
 * 检查是否为内置 Agent
 *
 * @param id Agent ID
 * @returns 是否为内置 Agent
 */
export function isBuiltinBackend(id: AcpBackendId): boolean {
	return id in ACP_BACKENDS;
}

/**
 * 获取 Agent 的流式消息模式
 *
 * @param id Agent ID
 * @returns 'incremental' 或 'cumulative'，默认 'incremental'
 */
export function getBackendStreamingMode(
	id: AcpBackendId,
): "incremental" | "cumulative" {
	return ACP_BACKENDS[id]?.streamingMode || "incremental";
}
