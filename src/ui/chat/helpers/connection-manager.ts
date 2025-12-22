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
	 * 是否已连接
	 */
	public get isConnected(): boolean {
		return (
			this.connection?.isConnected === true &&
			this.sessionManager !== null
		);
	}

	/**
	 * 确保已连接
	 */
	public async ensureConnected(): Promise<boolean> {
		if (this.isConnected) {
			return true;
		}

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

			this.connection = new AcpConnection();

			await this.connection.connect({
				backendId: "claude",
				cliPath,
				workingDir,
				acpArgs: backendConfig.acpArgs || [],
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

			this.callbacks.onStatusChange("connected", "Claude Code");
			this.callbacks.onConnected(this.connection, this.sessionManager);

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
