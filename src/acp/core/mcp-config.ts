/**
 * MCP 服务器配置处理
 *
 * 处理 MCP 服务器配置的转换和变量替换，
 * 支持根据 Agent 能力过滤 MCP 服务器。
 */

import type { SessionNewMcpServerConfig, McpCapabilities } from "../types";
import type { McpServerConfig } from "./connection-types";

/**
 * MCP 配置处理器
 */
export class McpConfigProcessor {
	private workingDir: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private app: any;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	constructor(workingDir: string, app?: any) {
		this.workingDir = workingDir;
		this.app = app;
	}

	/**
	 * 获取 MCP 服务器配置
	 *
	 * 从 settings 读取已启用的 MCP 服务器，转换为 ACP 协议格式。
	 * 可选地根据 Agent 的 MCP 能力过滤服务器。
	 *
	 * @param mcpServers 原始 MCP 服务器配置
	 * @param capabilities Agent 的 MCP 能力声明（可选）
	 */
	public getServersConfig(
		mcpServers: McpServerConfig[],
		capabilities?: McpCapabilities,
	): SessionNewMcpServerConfig[] {
		// 过滤启用的服务器
		let enabledServers = mcpServers.filter((server) => server.enabled);

		if (enabledServers.length === 0) {
			console.log("[ACP] 没有启用的 MCP 服务器");
			return [];
		}

		// 根据 Agent 能力过滤服务器
		if (capabilities) {
			const originalCount = enabledServers.length;
			enabledServers = this.filterByCapabilities(
				enabledServers,
				capabilities,
			);
			const filteredCount = originalCount - enabledServers.length;
			if (filteredCount > 0) {
				console.log(
					`[ACP] 已过滤 ${filteredCount} 个不支持的 MCP 服务器`,
				);
			}
		}

		console.log(`[ACP] 准备 ${enabledServers.length} 个 MCP 服务器配置`);

		return enabledServers.map((server) => this.buildServerConfig(server));
	}

	/**
	 * 根据 Agent 能力过滤 MCP 服务器
	 *
	 * - stdio: 所有 Agent 必须支持
	 * - http: 仅当 capabilities.http === true 时支持
	 * - sse: 仅当 capabilities.sse === true 时支持
	 */
	private filterByCapabilities(
		servers: McpServerConfig[],
		capabilities: McpCapabilities,
	): McpServerConfig[] {
		return servers.filter((server) => {
			switch (server.type) {
				case "stdio":
					// 所有 ACP Agent 必须支持 stdio
					return true;
				case "http":
					if (capabilities.http !== true) {
						console.log(
							`[ACP] 过滤 MCP 服务器 "${server.name}": Agent 不支持 HTTP 传输`,
						);
						return false;
					}
					return true;
				case "sse":
					if (capabilities.sse !== true) {
						console.log(
							`[ACP] 过滤 MCP 服务器 "${server.name}": Agent 不支持 SSE 传输`,
						);
						return false;
					}
					return true;
				default:
					console.log(
						`[ACP] 过滤 MCP 服务器 "${server.name}": 未知传输类型`,
					);
					return false;
			}
		});
	}

	/**
	 * 构建单个服务器配置
	 */
	private buildServerConfig(
		server: McpServerConfig,
	): SessionNewMcpServerConfig {
		let config: SessionNewMcpServerConfig;

		if (server.type === "stdio") {
			config = this.buildStdioConfig(server);
		} else if (server.type === "http") {
			config = this.buildHttpConfig(server);
		} else {
			config = this.buildSseConfig(server);
		}

		console.log(
			`[ACP] MCP 服务器配置: ${server.name}`,
			JSON.stringify(config, null, 2),
		);
		return config;
	}

	/**
	 * 构建 stdio 类型配置
	 */
	private buildStdioConfig(
		server: McpServerConfig,
	): SessionNewMcpServerConfig {
		return {
			name: server.name,
			type: "stdio",
			command: server.command
				? this.replaceVariables(server.command)
				: "",
			args:
				server.args && server.args.length > 0
					? server.args.map((arg) => this.replaceVariables(arg))
					: [],
			env:
				server.env && server.env.length > 0
					? server.env.map((envVar) => ({
							name: envVar.name,
							value: this.replaceVariables(envVar.value),
						}))
					: [],
		};
	}

	/**
	 * 构建 http 类型配置
	 */
	private buildHttpConfig(
		server: McpServerConfig,
	): SessionNewMcpServerConfig {
		return {
			name: server.name,
			type: "http",
			url: server.url ? this.replaceVariables(server.url) : "",
			env:
				server.env && server.env.length > 0
					? server.env.map((envVar) => ({
							name: envVar.name,
							value: this.replaceVariables(envVar.value),
						}))
					: [],
			// OpenCode 要求 headers 必填，即使为空也要传空数组
			headers:
				server.headers && server.headers.length > 0
					? server.headers.map((header) => ({
							name: header.name,
							value: this.replaceVariables(header.value),
						}))
					: [],
		};
	}

	/**
	 * 构建 sse 类型配置
	 *
	 * 注意：某些 Agent（如 OpenCode）不支持 sse 类型，会被能力过滤器过滤掉
	 */
	private buildSseConfig(server: McpServerConfig): SessionNewMcpServerConfig {
		return {
			name: server.name,
			type: "sse",
			url: server.url ? this.replaceVariables(server.url) : "",
			env:
				server.env && server.env.length > 0
					? server.env.map((envVar) => ({
							name: envVar.name,
							value: this.replaceVariables(envVar.value),
						}))
					: [],
			headers:
				server.headers && server.headers.length > 0
					? server.headers.map((header) => ({
							name: header.name,
							value: this.replaceVariables(header.value),
						}))
					: [],
		};
	}

	/**
	 * 替换字符串中的变量
	 *
	 * 支持的变量格式：
	 * - {VAULT_PATH} / ${VAULT_PATH} - Obsidian Vault 路径
	 * - {USER_HOME} / ${USER_HOME} / $HOME - 用户主目录
	 * - {PWD} / ${PWD} / $PWD - 当前工作目录
	 */
	private replaceVariables(value: string): string {
		if (!value) return value;

		// 获取 Vault 路径
		const vaultPath = this.app?.vault?.adapter?.basePath || this.workingDir;

		// 获取用户主目录
		const userHome = process.env.HOME || process.env.USERPROFILE || "";

		// 获取当前工作目录
		const pwd = this.workingDir;

		return value
			// Vault 路径（先替换 ${} 格式，再替换 {} 格式）
			.replace(/\$\{VAULT_PATH\}/g, vaultPath)
			.replace(/\{VAULT_PATH\}/g, vaultPath)
			// 用户主目录
			.replace(/\$\{USER_HOME\}/g, userHome)
			.replace(/\{USER_HOME\}/g, userHome)
			.replace(/\$HOME\b/g, userHome)
			// 当前工作目录
			.replace(/\$\{PWD\}/g, pwd)
			.replace(/\{PWD\}/g, pwd)
			.replace(/\$PWD\b/g, pwd);
	}
}
