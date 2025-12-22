/**
 * MCP 服务器配置处理
 *
 * 处理 MCP 服务器配置的转换和变量替换
 */

import type { SessionNewMcpServerConfig } from '../types';
import type { McpServerConfig } from './connection-types';

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
	 * 从 settings 读取已启用的 MCP 服务器，转换为 ACP 协议格式
	 */
	public getServersConfig(mcpServers: McpServerConfig[]): SessionNewMcpServerConfig[] {
		// 过滤启用的服务器
		const enabledServers = mcpServers.filter((server) => server.enabled);

		if (enabledServers.length === 0) {
			console.log('[ACP] 没有启用的 MCP 服务器');
			return [];
		}

		console.log(`[ACP] 准备 ${enabledServers.length} 个 MCP 服务器配置`);

		return enabledServers.map((server) => this.buildServerConfig(server));
	}

	/**
	 * 构建单个服务器配置
	 */
	private buildServerConfig(server: McpServerConfig): SessionNewMcpServerConfig {
		let config: SessionNewMcpServerConfig;

		if (server.type === 'stdio') {
			config = this.buildStdioConfig(server);
		} else if (server.type === 'http') {
			config = this.buildHttpConfig(server);
		} else {
			config = this.buildSseConfig(server);
		}

		console.log(`[ACP] MCP 服务器配置: ${server.name}`, JSON.stringify(config, null, 2));
		return config;
	}

	/**
	 * 构建 stdio 类型配置
	 */
	private buildStdioConfig(server: McpServerConfig): SessionNewMcpServerConfig {
		return {
			name: server.name,
			type: 'stdio',
			command: server.command ? this.replaceVariables(server.command) : '',
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
	private buildHttpConfig(server: McpServerConfig): SessionNewMcpServerConfig {
		return {
			name: server.name,
			type: 'http',
			url: server.url ? this.replaceVariables(server.url) : '',
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
					: undefined,
		};
	}

	/**
	 * 构建 sse 类型配置
	 */
	private buildSseConfig(server: McpServerConfig): SessionNewMcpServerConfig {
		return {
			name: server.name,
			type: 'sse',
			url: server.url ? this.replaceVariables(server.url) : '',
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
					: undefined,
		};
	}

	/**
	 * 替换字符串中的变量
	 */
	private replaceVariables(value: string): string {
		if (!value) return value;

		// 获取 Vault 路径
		const vaultPath = this.app?.vault?.adapter?.basePath || this.workingDir;

		// 获取用户主目录
		const userHome = process.env.HOME || process.env.USERPROFILE || '';

		return value.replace(/{VAULT_PATH}/g, vaultPath).replace(/{USER_HOME}/g, userHome);
	}
}
