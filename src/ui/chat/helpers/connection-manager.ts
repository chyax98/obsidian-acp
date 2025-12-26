/**
 * 连接管理辅助类
 *
 * 处理 ACP 连接的建立、断开和状态管理
 */

import type { App } from "obsidian";
import {
	AcpConnection,
	type ConnectionOptions,
} from "../../../acp/core/connection";
import { SessionManager } from "../../../acp/core/session-manager";
import type {
	RequestPermissionParams,
	PermissionOutcome,
} from "../../../acp/types/permissions";
import type { AcpBackendId, CustomAgentConfig } from "../../../acp/backends";
import { getBackendConfig } from "../../../acp/backends/registry";

/**
 * 环境变量设置
 */
export interface EnvSettings {
	apiKey?: string;
	apiUrl?: string;
	httpProxy?: string;
}

/**
 * 连接配置
 */
export interface ConnectionConfig {
	/** 获取当前选中的 Agent ID */
	getCurrentAgentId: () => AcpBackendId;
	/** 获取自定义 Agent 配置 */
	getCustomAgentConfig: () => CustomAgentConfig | undefined;
	/** 获取工作目录 */
	getWorkingDirectory: () => string;
	/** 获取手动设置的 CLI 路径 */
	getManualCliPath: (agentId: AcpBackendId) => string | undefined;
	/** 获取权限设置 */
	getPermissionSettings: () => ConnectionOptions["permissionSettings"];
	/** 保存设置 */
	saveSettings: () => Promise<void>;
	/** 获取 MCP 服务器配置 */
	getMcpServers: () => ConnectionOptions["mcpServers"];
	/** 获取环境变量设置 */
	getEnvSettings: () => EnvSettings;
	/** 获取请求超时时间（秒） */
	getPromptTimeout: () => number;
	/** 处理权限请求 */
	onPermissionRequest: (
		params: RequestPermissionParams,
	) => Promise<PermissionOutcome>;
}

/**
 * 连接状态回调
 */
export interface ConnectionCallbacks {
	/** 状态变化 */
	onStatusChange: (
		status: "disconnected" | "connecting" | "connected" | "error",
		agentName?: string,
	) => void;
	/** 连接成功 */
	onConnected: (
		connection: AcpConnection,
		sessionManager: SessionManager,
	) => void;
	/** 连接失败 */
	onError: (error: Error) => void;
}

/**
 * 连接管理器
 */
export class ConnectionManager {
	private app: App;
	private config: ConnectionConfig;
	private callbacks: ConnectionCallbacks;

	private connection: AcpConnection | null = null;
	private sessionManager: SessionManager | null = null;
	private isConnecting: boolean = false;
	private sessionStartPromise: Promise<void> | null = null;

	/** 当前已连接的 Agent ID */
	private connectedAgentId: AcpBackendId | null = null;

	constructor(
		app: App,
		config: ConnectionConfig,
		callbacks: ConnectionCallbacks,
	) {
		this.app = app;
		this.config = config;
		this.callbacks = callbacks;
	}

	/**
	 * 获取当前连接的 Agent ID
	 */
	public getConnectedAgentId(): AcpBackendId | null {
		return this.connectedAgentId;
	}

	/**
	 * 获取当前连接
	 */
	public getConnection(): AcpConnection | null {
		return this.connection;
	}

	/**
	 * 获取会话管理器
	 */
	public getSessionManager(): SessionManager | null {
		return this.sessionManager;
	}

	/**
	 * 是否已连接且会话已启动
	 */
	public get isConnected(): boolean {
		return (
			this.connection?.isConnected === true &&
			this.connection?.hasActiveSession === true &&
			this.sessionManager !== null
		);
	}

	/**
	 * 确保已连接且会话已启动
	 */
	public async ensureConnected(): Promise<boolean> {
		// 获取当前选中的 Agent
		const agentId = this.config.getCurrentAgentId();

		// 检查是否需要切换 Agent
		if (this.isConnected && this.connectedAgentId !== agentId) {
			console.log(
				`[ConnectionManager] Agent 已切换: ${this.connectedAgentId} -> ${agentId}，断开旧连接`,
			);
			this.disconnect();
		}

		// 已完全连接（且 Agent 未变化）
		if (this.isConnected) {
			return true;
		}

		// 正在启动会话，等待完成
		if (this.sessionStartPromise) {
			try {
				await this.sessionStartPromise;
				return this.isConnected;
			} catch {
				return false;
			}
		}

		// 正在连接中，返回 false（避免重复连接）
		if (this.isConnecting) {
			return false;
		}

		this.isConnecting = true;

		try {
			const customAgentConfig = this.config.getCustomAgentConfig();

			// 获取 Agent 名称和配置
			let agentName: string;
			let cliPath: string;
			let acpArgs: string[] = [];

			if (agentId === "custom" && customAgentConfig) {
				// 自定义 Agent
				agentName = customAgentConfig.name || "自定义 Agent";
				cliPath = customAgentConfig.cliPath;
				acpArgs = customAgentConfig.acpArgs || [];
			} else {
				// 内置 Agent
				const backendConfig = getBackendConfig(agentId);
				agentName = backendConfig?.name || agentId;
				const manualPath = this.config.getManualCliPath(agentId);
				cliPath =
					manualPath ||
					backendConfig?.defaultCliPath ||
					backendConfig?.cliCommand ||
					"";
				acpArgs = backendConfig?.acpArgs || [];
			}

			if (!cliPath) {
				throw new Error(`未配置 ${agentName} 的 CLI 路径`);
			}

			this.callbacks.onStatusChange("connecting", agentName);

			const workingDir = this.config.getWorkingDirectory();

			// 构建环境变量（只传递用户填写的字段）
			const envSettings = this.config.getEnvSettings();
			const env: Record<string, string> = {};
			if (envSettings.apiKey) {
				env.ANTHROPIC_AUTH_TOKEN = envSettings.apiKey;
			}
			if (envSettings.apiUrl) {
				env.ANTHROPIC_BASE_URL = envSettings.apiUrl;
			}
			if (envSettings.httpProxy) {
				env.HTTP_PROXY = envSettings.httpProxy;
				env.HTTPS_PROXY = envSettings.httpProxy;
			}

			this.connection = new AcpConnection();

			await this.connection.connect({
				backendId: agentId,
				cliPath,
				workingDir,
				acpArgs,
				env: Object.keys(env).length > 0 ? env : undefined,
				app: this.app,
				permissionSettings: this.config.getPermissionSettings(),
				saveSettings: this.config.saveSettings,
				mcpServers: this.config.getMcpServers(),
				promptTimeout: this.config.getPromptTimeout(),
			});

			this.sessionManager = new SessionManager({
				connection: this.connection,
				workingDir,
				agentId,
				onPermissionRequest: this.config.onPermissionRequest,
			});

			// 记录已连接的 Agent ID
			this.connectedAgentId = agentId;

			// 先触发 connected 回调（用于设置 UI 回调）
			this.callbacks.onStatusChange("connected", agentName);
			this.callbacks.onConnected(this.connection, this.sessionManager);

			// 启动会话并等待完成
			this.sessionStartPromise = this.sessionManager.start();
			await this.sessionStartPromise;
			this.sessionStartPromise = null;

			return true;
		} catch (error) {
			console.error("[ConnectionManager] 连接失败:", error);
			this.callbacks.onStatusChange("error");
			this.callbacks.onError(error as Error);

			if (this.connection) {
				this.connection.disconnect();
				this.connection = null;
			}
			this.sessionManager = null;
			this.sessionStartPromise = null;

			return false;
		} finally {
			this.isConnecting = false;
		}
	}

	/**
	 * 断开连接
	 */
	public disconnect(): void {
		if (this.sessionManager) {
			this.sessionManager.end();
			this.sessionManager = null;
		}

		if (this.connection) {
			this.connection.disconnect();
			this.connection = null;
		}

		this.connectedAgentId = null;
		this.callbacks.onStatusChange("disconnected");
	}

	/**
	 * 重建会话（保持连接）
	 */
	public async resetSession(): Promise<boolean> {
		if (!this.sessionManager) {
			return false;
		}

		try {
			this.sessionManager.end();
			await this.sessionManager.start();
			return true;
		} catch (error) {
			console.error("[ConnectionManager] 重建会话失败:", error);
			return false;
		}
	}
}
