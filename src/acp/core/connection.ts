/**
 * ACP 连接核心类
 *
 * 负责与 ACP Agent 子进程的通信管理，包括：
 * - 子进程 spawn 与生命周期管理
 * - JSON-RPC 2.0 请求/响应/通知处理
 * - 协议初始化与认证
 * - 会话管理
 */

import type { ChildProcess, SpawnOptions } from "child_process";
import { spawn } from "child_process";
import { Platform } from "obsidian";

import type { AcpBackendId } from "../backends";
import { getBackendConfig } from "../backends";
import { enhanceEnvForNodeScript } from "../utils/env-utils";
import { debug, warn, error as logError } from "../utils/logger";
import type {
	AcpRequest,
	AcpResponse,
	AcpNotification,
	AcpMessage,
	RequestId,
	InitializeResponse,
	SessionNotificationParams,
	RequestPermissionParams,
	PermissionOutcome,
	PromptResponse,
	PromptContent,
	NewSessionResponse,
	SessionNewParams,
	SetSessionModeResponse,
} from "../types";
import { JSONRPC_VERSION, createRequest, AcpMethod } from "../types";
import { RequestQueue } from "./request-queue";
import { PermissionManager } from "../permission-manager";

// 拆分的模块
import type {
	FileOperation,
	ConnectionOptions,
	ConnectionState,
	McpServerConfig,
} from "./connection-types";
import { classifyError } from "./error-classifier";
import { McpConfigProcessor } from "./mcp-config";
import { FileHandler } from "./file-handler";

// 类型重导出
export type {
	FileOperation,
	ConnectionOptions,
	ConnectionState,
	McpServerConfig,
};

// ============================================================================
// Spawn 配置工具
// ============================================================================

/**
 * 创建子进程 spawn 配置
 */
export function createSpawnConfig(
	cliPath: string,
	workingDir: string,
	acpArgs?: string[],
	customEnv?: Record<string, string>,
): { command: string; args: string[]; options: SpawnOptions } {
	const isWindows = Platform.isWin === true;
	const isMac = Platform.isMacOS === true;

	const env = enhanceEnvForNodeScript(cliPath, {
		...process.env,
		...customEnv,
	});
	const effectiveAcpArgs =
		acpArgs !== undefined ? acpArgs : ["--experimental-acp"];

	let spawnCommand: string;
	let spawnArgs: string[];

	if (cliPath.startsWith("npx ")) {
		const parts = cliPath.split(" ");
		spawnCommand = isWindows ? "npx.cmd" : "npx";
		spawnArgs = [...parts.slice(1), ...effectiveAcpArgs];
	} else {
		spawnCommand = cliPath;
		spawnArgs = effectiveAcpArgs;
	}

	const useShell = isWindows && !isMac;

	debug(
		`[ACP] createSpawnConfig: isWindows=${isWindows}, isMac=${isMac}, useShell=${useShell}`,
	);
	debug(
		`[ACP] createSpawnConfig: command=${spawnCommand}, args=${spawnArgs.join(" ")}`,
	);

	const options: SpawnOptions = {
		cwd: workingDir,
		stdio: ["pipe", "pipe", "pipe"],
		env,
		shell: useShell,
	};

	return { command: spawnCommand, args: spawnArgs, options };
}

// ============================================================================
// AcpConnection 类
// ============================================================================

/**
 * ACP 连接管理器
 *
 * 管理与 ACP Agent 子进程的完整通信生命周期。
 */
export class AcpConnection {
	// 进程状态
	private child: ChildProcess | null = null;
	private state: ConnectionState = "disconnected";
	private isCancelling = false;

	// 请求队列
	private requestQueue = new RequestQueue();

	// 权限管理器
	private permissionManager: PermissionManager | null = null;

	// 会话状态
	private sessionId: string | null = null;
	private isInitialized = false;
	private backend: AcpBackendId | null = null;
	private initializeResponse: InitializeResponse | null = null;
	private workingDir: string = process.cwd();

	// MCP 服务器配置
	private mcpServers: McpServerConfig[] = [];

	// 请求超时时间（秒）
	private promptTimeout: number = 300;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private app: any = null;

	// 消息缓冲
	private messageBuffer = "";

	// 重连机制
	private retryCount: number = 0;
	private readonly maxRetries: number = 3;
	private lastConnectionOptions: ConnectionOptions | null = null;

	// 辅助处理器
	private fileHandler: FileHandler | null = null;

	// ========================================================================
	// 事件回调
	// ========================================================================

	public onSessionUpdate: (data: SessionNotificationParams) => void =
		() => {};
	public onPermissionRequest: (
		data: RequestPermissionParams,
	) => Promise<PermissionOutcome> = () =>
		Promise.resolve({ type: "cancelled" });
	public onFileOperation: (operation: FileOperation) => void = () => {};
	public onEndTurn: () => void = () => {};
	public onError: (error: Error) => void = () => {};
	public onDisconnect: (code: number | null, signal: string | null) => void =
		() => {};

	// ========================================================================
	// 重连机制
	// ========================================================================

	private async reconnect(): Promise<void> {
		if (!this.lastConnectionOptions) {
			throw new Error("无法重连: 缺少连接配置");
		}

		if (this.retryCount >= this.maxRetries) {
			logError(
				`[ACP] 重连失败: 已达到最大重试次数 (${this.maxRetries})`,
			);
			throw new Error(`连接失败: 已重试 ${this.maxRetries} 次`);
		}

		const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
		this.retryCount++;

		debug(
			`[ACP] 重连中... (第 ${this.retryCount}/${this.maxRetries} 次，延迟 ${delay}ms)`,
		);

		await new Promise((resolve) => setTimeout(resolve, delay));
		await this.connect(this.lastConnectionOptions);
	}

	// ========================================================================
	// 连接方法
	// ========================================================================

	/**
	 * 启动 ACP Agent 进程
	 *
	 * 根据后端配置启动相应的 Agent 进程。支持：
	 * - 内置 Agent (claude, goose, opencode, gemini)
	 * - 自定义 Agent (custom)
	 */
	private connectAgent(
		backendId: AcpBackendId,
		workingDir: string,
		cliPath?: string,
		customEnv?: Record<string, string>,
	): void {
		// 获取后端配置
		const backendConfig = getBackendConfig(backendId);

		// 确定启动命令和参数
		let effectiveCliPath: string;
		let effectiveAcpArgs: string[];

		if (cliPath) {
			// 用户自定义 CLI 路径
			effectiveCliPath = cliPath;
			effectiveAcpArgs = backendConfig?.acpArgs || [];
		} else if (backendConfig) {
			// 使用内置配置
			effectiveCliPath =
				backendConfig.defaultCliPath || backendConfig.cliCommand || "";
			effectiveAcpArgs = backendConfig.acpArgs || [];
		} else {
			// 自定义 Agent，需要用户提供 cliPath
			throw new Error(`未知的 Agent: ${backendId}，请提供 CLI 路径`);
		}

		// 合并环境变量
		const mergedEnv = {
			...customEnv,
			...backendConfig?.env,
		};

		// 使用 createSpawnConfig 生成启动配置
		const { command, args, options } = createSpawnConfig(
			effectiveCliPath,
			workingDir,
			effectiveAcpArgs,
			mergedEnv,
		);

		const agentName = backendConfig?.name || backendId;
		debug(`[ACP] 启动 ${agentName} 进程: ${command} ${args.join(" ")}`);
		debug(`[ACP] 工作目录: ${workingDir}`);

		this.child = spawn(command, args, options);

		debug(`[ACP] 进程已启动 (PID: ${this.child.pid})`);
	}

	// ========================================================================
	// 连接管理
	// ========================================================================

	public async connect(options: ConnectionOptions): Promise<void> {
		this.isCancelling = false;
		this.lastConnectionOptions = options;

		if (options.app) {
			this.app = options.app;
		}
		if (options.mcpServers) {
			this.mcpServers = options.mcpServers;
		}
		if (options.promptTimeout) {
			this.promptTimeout = options.promptTimeout;
		}

		if (options.app && options.permissionSettings && options.saveSettings) {
			this.permissionManager = new PermissionManager(
				options.app,
				options.permissionSettings,
				options.saveSettings,
			);
		}

		if (this.child) {
			this.disconnect();
		}

		this.state = "connecting";
		this.backend = options.backendId;

		if (options.workingDir) {
			this.workingDir = options.workingDir;
		}

		// 初始化文件处理器
		this.fileHandler = new FileHandler(this.workingDir, this.app, (op) =>
			this.onFileOperation(op),
		);

		try {
			this.connectAgent(
				options.backendId,
				this.workingDir,
				options.cliPath,
				options.env,
			);
			await this.setupProcessHandlers();
			await this.initialize();

			this.state = "connected";
			this.retryCount = 0;
		} catch (error) {
			this.state = "error";
			this.disconnect();

			if (this.isCancelling) {
				throw new Error("连接已被取消");
			}

			const errorMsg =
				error instanceof Error ? error.message : String(error);
			const classifiedError = classifyError(errorMsg, this.backend);

			logError(
				`[ACP] 连接失败: ${classifiedError.type} - ${classifiedError.message} (可重试: ${classifiedError.retryable})`,
			);

			if (
				classifiedError.retryable &&
				this.retryCount < this.maxRetries
			) {
				await this.reconnect();
				return;
			}

			throw new Error(
				`${classifiedError.type}: ${classifiedError.message}`,
			);
		}
	}

	public disconnect(): void {
		if (this.child) {
			this.child.kill();
			this.child = null;
		}

		this.requestQueue.clear("连接已断开");

		this.sessionId = null;
		this.isInitialized = false;
		this.backend = null;
		this.initializeResponse = null;
		this.messageBuffer = "";
		this.state = "disconnected";
	}

	public cancelConnection(): void {
		debug("[ACP] 用户取消连接");
		this.isCancelling = true;
		this.disconnect();
	}

	private async setupProcessHandlers(): Promise<void> {
		if (!this.child) return;

		let spawnError: Error | null = null;

		this.child.stderr?.on("data", (_data: Buffer) => {
			// Claude Code 的 stderr 包含大量调试信息，正常情况下忽略
		});

		this.child.on("error", (error) => {
			spawnError = error;
			this.onError(error);
		});

		this.child.on("exit", (code, signal) => {
			if (code !== 0) {
				warn(
					`[ACP] 进程异常退出: code=${code}, signal=${signal}`,
				);
			}
			this.onDisconnect(code, signal);
			this.state = "disconnected";
		});

		this.child.stdout?.on("data", (data: Buffer) => {
			this.handleStdoutData(data.toString());
		});

		await new Promise((resolve) => setTimeout(resolve, 500));

		if (spawnError) {
			throw spawnError;
		}

		if (!this.child || this.child.killed) {
			throw new Error("ACP 进程启动失败或立即退出");
		}
	}

	private handleStdoutData(data: string): void {
		this.messageBuffer += data;

		const lines = this.messageBuffer.split("\n");
		this.messageBuffer = lines.pop() || "";

		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed) {
				try {
					const message = JSON.parse(trimmed) as AcpMessage;
					this.handleMessage(message);
				} catch {
					// 忽略非 JSON 消息
				}
			}
		}
	}

	// ========================================================================
	// 消息处理
	// ========================================================================

	private handleMessage(message: AcpMessage): void {
		try {
			if ("method" in message) {
				this.handleIncomingRequest(message).catch((error) => {
					logError("[ACP] 处理请求失败:", error);
				});
				return;
			}

			if ("id" in message) {
				this.handleResponse(message);
			}
		} catch (error) {
			logError("[ACP] 消息处理错误:", error);
		}
	}

	/**
	 * 处理响应消息
	 */
	private handleResponse(response: AcpResponse): void {
		if (!this.requestQueue.has(response.id)) return;

		if (response.error) {
			this.requestQueue.rejectWithMessage(
				response.id,
				response.error.message || "未知 ACP 错误",
			);
			return;
		}

		// 检查是否需要触发 end_turn
		this.checkEndTurn(response.result);
		this.requestQueue.resolve(response.id, response.result);
	}

	/**
	 * 检查是否需要触发回合结束
	 */
	private checkEndTurn(result: unknown): void {
		if (result && typeof result === "object") {
			const r = result as { stopReason?: string };
			if (r.stopReason === "end_turn") {
				this.onEndTurn();
			}
		}
	}

	private async handleIncomingRequest(
		message: AcpRequest | AcpNotification,
	): Promise<void> {
		const { method, params } = message;

		try {
			let result: unknown = null;

			switch (method) {
				case AcpMethod.SESSION_UPDATE:
					this.onSessionUpdate(params as SessionNotificationParams);
					break;

				case "session/request_permission":
				case AcpMethod.REQUEST_PERMISSION:
					result = await this.handlePermissionRequest(
						params as RequestPermissionParams,
					);
					break;

				case AcpMethod.FS_READ_TEXT_FILE:
					result = await this.fileHandler?.handleReadFile(
						params as { path: string; sessionId?: string },
					);
					break;

				case AcpMethod.FS_WRITE_TEXT_FILE:
					result = await this.fileHandler?.handleWriteFile(
						params as {
							path: string;
							content: string;
							sessionId?: string;
						},
					);
					break;

				default:
					debug(`[ACP] 未处理的方法: ${method}`);
			}

			if ("id" in message && message.id !== undefined) {
				this.sendResponse(message.id, result);
			}
		} catch (error) {
			if ("id" in message && message.id !== undefined) {
				this.sendErrorResponse(
					message.id,
					error instanceof Error ? error.message : String(error),
				);
			}
		}
	}

	// ========================================================================
	// 请求发送
	// ========================================================================

	private sendRequest<T = unknown>(
		method: string,
		params?: Record<string, unknown>,
	): Promise<T> {
		let timeoutDuration: number;

		if (method === AcpMethod.SESSION_PROMPT) {
			timeoutDuration = this.promptTimeout * 1000;
		} else if (method === AcpMethod.INITIALIZE) {
			timeoutDuration = 15000;
		} else if (method === AcpMethod.SESSION_NEW) {
			const mcpServerCount =
				(params as { mcpServers?: unknown[] })?.mcpServers?.length || 0;
			const baseDuration = 90000;
			const perServerDuration = 30000;
			timeoutDuration = Math.min(
				baseDuration + mcpServerCount * perServerDuration,
				180000,
			);
			debug(
				`[ACP] session/new 超时设置: ${timeoutDuration / 1000}s (${mcpServerCount} 个 MCP 服务器)`,
			);
		} else {
			timeoutDuration = 20000;
		}

		const { id, promise } = this.requestQueue.create<T>(
			method,
			timeoutDuration,
		);
		const message = createRequest(id, method, params);
		this.sendMessage(message);

		return promise;
	}

	private sendMessage(message: AcpRequest | AcpNotification): void {
		if (!this.child?.stdin) {
			logError("[ACP] 无法发送消息: 子进程不可用");
			return;
		}

		const json = JSON.stringify(message);
		const lineEnding = Platform.isWin ? "\r\n" : "\n";
		this.child.stdin.write(json + lineEnding);
	}

	private sendResponse(id: RequestId, result: unknown): void {
		if (!this.child?.stdin) {
			logError("[ACP] 无法发送响应: 子进程不可用");
			return;
		}

		const response: AcpResponse = {
			jsonrpc: JSONRPC_VERSION,
			id,
			result,
		};

		const json = JSON.stringify(response);
		const lineEnding = Platform.isWin ? "\r\n" : "\n";
		this.child.stdin.write(json + lineEnding);
	}

	private sendErrorResponse(id: RequestId, message: string): void {
		if (!this.child?.stdin) return;

		const response: AcpResponse = {
			jsonrpc: JSONRPC_VERSION,
			id,
			error: { code: -32603, message },
		};

		const json = JSON.stringify(response);
		const lineEnding = Platform.isWin ? "\r\n" : "\n";
		this.child.stdin.write(json + lineEnding);
	}

	// ========================================================================
	// 超时管理
	// ========================================================================

	private pausePromptTimeouts(): void {
		this.requestQueue.pauseByMethod(AcpMethod.SESSION_PROMPT);
	}

	private resumePromptTimeouts(): void {
		this.requestQueue.resumeByMethod(AcpMethod.SESSION_PROMPT);
	}

	// ========================================================================
	// 协议方法
	// ========================================================================

	private async initialize(): Promise<InitializeResponse> {
		const params = {
			protocolVersion: 1,
			clientInfo: {
				name: "obsidian-acp",
				version: "0.1.0",
			},
			capabilities: {
				fs: {
					readTextFile: true,
					writeTextFile: true,
				},
			},
		};

		debug("[ACP] 发送 initialize 请求...");
		const startTime = Date.now();

		try {
			const response = await Promise.race([
				this.sendRequest<InitializeResponse>(
					AcpMethod.INITIALIZE,
					params,
				),
				new Promise<never>((_, reject) =>
					setTimeout(
						() => reject(new Error("初始化超时 (15s)")),
						15000,
					),
				),
			]);

			const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
			debug(`[ACP] initialize 成功 (耗时 ${elapsed}s)`);

			this.isInitialized = true;
			this.initializeResponse = response;
			return response;
		} catch (error) {
			const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
			logError(`[ACP] initialize 失败 (耗时 ${elapsed}s):`, error);
			throw error;
		}
	}

	public async authenticate(methodId?: string): Promise<void> {
		await this.sendRequest(
			AcpMethod.AUTHENTICATE,
			methodId ? { methodId } : undefined,
		);
	}

	public async newSession(workingDir?: string): Promise<NewSessionResponse> {
		const cwd = workingDir || this.workingDir;

		// 更新文件处理器的工作目录
		this.fileHandler?.setWorkingDir(cwd);

		// 获取 Agent 的 MCP 能力
		const mcpCapabilities =
			this.initializeResponse?.capabilities?.mcpCapabilities;
		debug(`[ACP] Agent MCP 能力:`, JSON.stringify(mcpCapabilities));

		// 使用 McpConfigProcessor 获取配置，根据能力过滤
		const mcpProcessor = new McpConfigProcessor(cwd, this.app);
		const mcpServers = mcpProcessor.getServersConfig(
			this.mcpServers,
			mcpCapabilities,
		);

		const params: SessionNewParams = {
			cwd,
			mcpServers,
		};

		debug(
			`[ACP] 发送 session/new 请求 (${mcpServers.length} 个 MCP 服务器)...`,
		);
		debug(`[ACP] session/new 参数:`, JSON.stringify(params, null, 2));
		const startTime = Date.now();

		try {
			const response = await this.sendRequest<NewSessionResponse>(
				AcpMethod.SESSION_NEW,
				params as unknown as Record<string, unknown>,
			);

			const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
			debug(`[ACP] session/new 成功 (耗时 ${elapsed}s)`);
			debug(`[ACP] session/new 响应:`, JSON.stringify(response, null, 2));

			this.sessionId = response.sessionId;
			return response;
		} catch (error) {
			const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
			logError(`[ACP] session/new 失败 (耗时 ${elapsed}s):`, error);
			throw error;
		}
	}

	public async sendPrompt(
		content: string | PromptContent[],
	): Promise<PromptResponse> {
		if (!this.sessionId) {
			throw new Error("没有活动的 ACP 会话");
		}

		const promptContent: PromptContent[] =
			typeof content === "string"
				? [{ type: "text", text: content }]
				: content;

		return await this.sendRequest<PromptResponse>(
			AcpMethod.SESSION_PROMPT,
			{
				sessionId: this.sessionId,
				prompt: promptContent,
			},
		);
	}

	public async cancelSession(): Promise<void> {
		if (!this.sessionId) return;

		await this.sendRequest(AcpMethod.SESSION_CANCEL, {
			sessionId: this.sessionId,
		});
	}

	/**
	 * 切换会话模式
	 * @see https://agentclientprotocol.com/protocol/session-modes
	 */
	public async setMode(modeId: string): Promise<SetSessionModeResponse> {
		if (!this.sessionId) {
			throw new Error("没有活动的 ACP 会话");
		}

		debug(`[ACP] 切换模式: ${modeId}`);

		return await this.sendRequest<SetSessionModeResponse>(
			AcpMethod.SESSION_SET_MODE,
			{
				sessionId: this.sessionId,
				modeId,
			},
		);
	}

	// ========================================================================
	// 权限请求处理
	// ========================================================================

	private async handlePermissionRequest(
		params: RequestPermissionParams,
	): Promise<{ outcome: { outcome: string; optionId: string } }> {
		debug("[ACP] 收到权限请求:", params.toolCall?.title);

		this.pausePromptTimeouts();

		try {
			if (this.permissionManager) {
				const request = {
					toolCallId: params.toolCall?.toolCallId || "",
					toolName: params.toolCall?.kind || "",
					title: params.toolCall?.title || "",
					kind: params.toolCall?.kind || "",
					rawInput: params.toolCall?.rawInput || {},
					options: params.options,
				};

				const response =
					await this.permissionManager.handlePermissionRequest(
						request,
					);
				debug("[ACP] PermissionManager 响应:", response);

				if (response.outcome === "cancelled") {
					return {
						outcome: {
							outcome: "rejected",
							optionId: "reject_once",
						},
					};
				}

				return {
					outcome: {
						outcome: "selected",
						optionId: response.optionId || "allow",
					},
				};
			}

			const userChoice = await this.onPermissionRequest(params);
			debug("[ACP] 用户选择:", userChoice);

			if (userChoice.type === "cancelled") {
				const rejectOptionId =
					params.options?.find((opt) => opt.kind === "reject_once")
						?.optionId || "reject_once";
				return {
					outcome: {
						outcome: "rejected",
						optionId: rejectOptionId,
					},
				};
			}

			const userKind = userChoice.optionId?.includes("always")
				? "allow_always"
				: userChoice.optionId?.includes("reject")
					? "reject_once"
					: "allow_once";
			const agentOptionId =
				params.options?.find((opt) => opt.kind === userKind)
					?.optionId || userChoice.optionId;
			const outcome = agentOptionId?.includes("reject")
				? "rejected"
				: "selected";

			const result = {
				outcome: {
					outcome,
					optionId: agentOptionId,
				},
			};
			debug("[ACP] 发送权限响应:", JSON.stringify(result));
			return result;
		} catch (error) {
			logError("[ACP] 权限请求处理失败:", error);
			return {
				outcome: {
					outcome: "rejected",
					optionId: "reject_once",
				},
			};
		} finally {
			this.resumePromptTimeouts();
		}
	}

	// ========================================================================
	// 状态访问器
	// ========================================================================

	public get isConnected(): boolean {
		return (
			this.child !== null &&
			!this.child.killed &&
			this.state === "connected"
		);
	}

	public get hasActiveSession(): boolean {
		return this.sessionId !== null;
	}

	public get currentBackend(): AcpBackendId | null {
		return this.backend;
	}

	public get currentSessionId(): string | null {
		return this.sessionId;
	}

	public get connectionState(): ConnectionState {
		return this.state;
	}

	public getInitializeResponse(): InitializeResponse | null {
		return this.initializeResponse;
	}
}
