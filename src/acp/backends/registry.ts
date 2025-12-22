/**
 * ACP Agent 后端注册表
 * 只支持 Claude Code
 */

import type { AcpBackendConfig, AcpBackendId } from "./types";

/**
 * Claude Code 配置
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
		acpArgs: [],
	},
};

/**
 * 获取 Claude Code 配置
 */
export function getBackendConfig(
	id: AcpBackendId,
): AcpBackendConfig | undefined {
	return ACP_BACKENDS[id];
}

/**
 * 获取 Claude Code 的 ACP 启动参数
 */
export function getBackendAcpArgs(_id: AcpBackendId): string[] {
	return [];
}

/**
 * 获取 Claude Code 的启动命令
 */
export function getBackendStartCommand(_id: AcpBackendId): string {
	return "npx @zed-industries/claude-code-acp";
}
