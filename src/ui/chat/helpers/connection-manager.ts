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
import { ACP_BACKENDS } from "../../../acp/backends/registry";

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
	/** 获取工作目录 */
	getWorkingDirectory: () => string;
	/** 获取手动设置的 CLI 路径 */
	getManualCliPath: () => string | undefined;
	/** 获取权限设置 */
	getPermissionSettings: () => ConnectionOptions["permissionSettings"];
	/** 保存设置 */
	saveSettings: () => Promise<void>;
	/** 获取 MCP 服务器配置 */
	getMcpServers: () => ConnectionOptions["mcpServers"];
	/** 获取环境变量设置 */
	getEnvSettings: () => EnvSettings;
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
		// 已完全连接
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
			this.callbacks.onStatusChange("connecting", "Claude Code");

			const backendConfig = ACP_BACKENDS.claude;
			const manualPath = this.config.getManualCliPath();
			const cliPath =
				manualPath ||
				backendConfig.defaultCliPath ||
				"npx @zed-industries/claude-code-acp";
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
				backendId: "claude",
				cliPath,
				workingDir,
				acpArgs: backendConfig.acpArgs || [],
				env: Object.keys(env).length > 0 ? env : undefined,
				app: this.app,
				permissionSettings: this.config.getPermissionSettings(),
				saveSettings: this.config.saveSettings,
				mcpServers: this.config.getMcpServers(),
			});

			this.sessionManager = new SessionManager({
				connection: this.connection,
				workingDir,
				onPermissionRequest: this.config.onPermissionRequest,
			});

			// 先触发 connected 回调（用于设置 UI 回调）
			this.callbacks.onStatusChange("connected", "Claude Code");
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
