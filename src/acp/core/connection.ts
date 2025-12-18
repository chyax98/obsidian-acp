/**
 * ACP 连接核心类
 *
 * 负责与 ACP Agent 子进程的通信管理，包括：
 * - 子进程 spawn 与生命周期管理
 * - JSON-RPC 2.0 请求/响应/通知处理
 * - 协议初始化与认证
 * - 会话管理
 */

import type { ChildProcess, SpawnOptions } from 'child_process';
import { spawn } from 'child_process';
import { Platform } from 'obsidian';
import { promises as fs } from 'fs';
import * as path from 'path';

import type { AcpBackendId } from '../backends';
import { getBackendConfig, getBackendAcpArgs } from '../backends';
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
	NewSessionResponse,
} from '../types';
import { JSONRPC_VERSION, createRequest, AcpMethod } from '../types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 待处理请求
 */
interface PendingRequest<T = unknown> {
	resolve: (value: T) => void;
	reject: (error: Error) => void;
	timeoutId?: ReturnType<typeof setTimeout>;
	method: string;
	isPaused: boolean;
	startTime: number;
	timeoutDuration: number;
}

/**
 * 文件操作信息
 */
export interface FileOperation {
	method: string;
	path: string;
	content?: string;
	sessionId: string;
}

/**
 * 连接选项
 */
export interface ConnectionOptions {
	/** 后端 ID */
	backendId: AcpBackendId;
	/** CLI 路径 (custom 后端必需) */
	cliPath?: string;
	/** 工作目录 */
	workingDir?: string;
	/** ACP 启动参数 */
	acpArgs?: string[];
	/** 自定义环境变量 */
	env?: Record<string, string>;
}

/**
 * 连接状态
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

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
	customEnv?: Record<string, string>
): { command: string; args: string[]; options: SpawnOptions } {
	const isWindows = Platform.isWin;
	const env = { ...process.env, ...customEnv };

	// 默认 ACP 参数
	const effectiveAcpArgs = acpArgs && acpArgs.length > 0 ? acpArgs : ['--experimental-acp'];

	let spawnCommand: string;
	let spawnArgs: string[];

	if (cliPath.startsWith('npx ')) {
		// npx 包: "npx @package/name"
		const parts = cliPath.split(' ');
		spawnCommand = isWindows ? 'npx.cmd' : 'npx';
		spawnArgs = [...parts.slice(1), ...effectiveAcpArgs];
	} else {
		// 普通命令
		spawnCommand = cliPath;
		spawnArgs = effectiveAcpArgs;
	}

	const options: SpawnOptions = {
		cwd: workingDir,
		stdio: ['pipe', 'pipe', 'pipe'],
		env,
		shell: isWindows,
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
	private state: ConnectionState = 'disconnected';

	// 请求管理
	private pendingRequests = new Map<RequestId, PendingRequest>();
	private nextRequestId = 1;

	// 会话状态
	private sessionId: string | null = null;
	private isInitialized = false;
	private backend: AcpBackendId | null = null;
	private initializeResponse: InitializeResponse | null = null;
	private workingDir: string = process.cwd();

	// 消息缓冲
	private messageBuffer = '';

	// ========================================================================
	// 事件回调
	// ========================================================================

	/** 会话更新回调 */
	public onSessionUpdate: (data: SessionNotificationParams) => void = () => {};

	/** 权限请求回调 */
	public onPermissionRequest: (data: RequestPermissionParams) => Promise<PermissionOutcome> = () =>
		Promise.resolve({ type: 'cancelled' });

	/** 文件操作回调 */
	public onFileOperation: (operation: FileOperation) => void = () => {};

	/** 回合结束回调 */
	public onEndTurn: () => void = () => {};

	/** 错误回调 */
	public onError: (error: Error) => void = () => {};

	/** 断开连接回调 */
	public onDisconnect: (code: number | null, signal: string | null) => void = () => {};

	// ========================================================================
	// 连接管理
	// ========================================================================

	/**
	 * 连接到 ACP Agent
	 */
	async connect(options: ConnectionOptions): Promise<void> {
		// 断开现有连接
		if (this.child) {
			this.disconnect();
		}

		this.state = 'connecting';
		this.backend = options.backendId;

		if (options.workingDir) {
			this.workingDir = options.workingDir;
		}

		try {
			// 获取后端配置
			const config = getBackendConfig(options.backendId);

			// 确定 CLI 路径
			let cliPath: string;
			if (options.backendId === 'custom') {
				if (!options.cliPath) {
					throw new Error('自定义 Agent 需要指定 CLI 路径');
				}
				cliPath = options.cliPath;
			} else if (options.backendId === 'claude') {
				// Claude 使用特殊的 npx 包
				cliPath = 'npx @zed-industries/claude-code-acp';
			} else {
				cliPath = options.cliPath || config?.defaultCliPath || config?.cliCommand || '';
				if (!cliPath) {
					throw new Error(`后端 ${options.backendId} 需要指定 CLI 路径`);
				}
			}

			// 获取 ACP 参数
			const acpArgs = options.acpArgs || getBackendAcpArgs(options.backendId);

			// 创建 spawn 配置
			const spawnConfig = createSpawnConfig(cliPath, this.workingDir, acpArgs, options.env);

			console.log(`[ACP] 启动 ${options.backendId}: ${spawnConfig.command} ${spawnConfig.args.join(' ')}`);

			// 启动子进程
			this.child = spawn(spawnConfig.command, spawnConfig.args, spawnConfig.options);

			// 设置进程处理器
			await this.setupProcessHandlers();

			// 初始化协议
			await this.initialize();

			this.state = 'connected';
			console.log(`[ACP] 连接成功: ${options.backendId}`);
		} catch (error) {
			this.state = 'error';
			this.disconnect();
			throw error;
		}
	}

	/**
	 * 断开连接
	 */
	disconnect(): void {
		if (this.child) {
			this.child.kill();
			this.child = null;
		}

		// 拒绝所有待处理请求
		for (const [id, request] of this.pendingRequests) {
			if (request.timeoutId) {
				clearTimeout(request.timeoutId);
			}
			request.reject(new Error('连接已断开'));
		}

		// 重置状态
		this.pendingRequests.clear();
		this.sessionId = null;
		this.isInitialized = false;
		this.backend = null;
		this.initializeResponse = null;
		this.messageBuffer = '';
		this.state = 'disconnected';
	}

	/**
	 * 设置子进程事件处理器
	 */
	private async setupProcessHandlers(): Promise<void> {
		if (!this.child) return;

		let spawnError: Error | null = null;

		// stderr 日志
		this.child.stderr?.on('data', (data: Buffer) => {
			console.error(`[ACP STDERR]:`, data.toString());
		});

		// 进程错误
		this.child.on('error', (error) => {
			spawnError = error;
			this.onError(error);
		});

		// 进程退出
		this.child.on('exit', (code, signal) => {
			console.log(`[ACP] 进程退出: code=${code}, signal=${signal}`);
			this.onDisconnect(code, signal);
			this.state = 'disconnected';
		});

		// stdout 消息处理
		this.child.stdout?.on('data', (data: Buffer) => {
			this.handleStdoutData(data.toString());
		});

		// 等待进程启动
		await new Promise((resolve) => setTimeout(resolve, 500));

		// 检查启动错误
		if (spawnError) {
			throw spawnError;
		}

		// 检查进程是否仍在运行
		if (!this.child || this.child.killed) {
			throw new Error('ACP 进程启动失败或立即退出');
		}
	}

	/**
	 * 处理 stdout 数据
	 */
	private handleStdoutData(data: string): void {
		this.messageBuffer += data;

		// 按行分割处理
		const lines = this.messageBuffer.split('\n');
		this.messageBuffer = lines.pop() || '';

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

	/**
	 * 处理接收到的消息
	 */
	private handleMessage(message: AcpMessage): void {
		try {
			// 检查是否为请求或通知 (有 method 字段)
			if ('method' in message) {
				this.handleIncomingRequest(message as AcpRequest | AcpNotification).catch((error) => {
					console.error('[ACP] 处理请求失败:', error);
				});
				return;
			}

			// 检查是否为响应 (有 id 字段且在待处理列表中)
			if ('id' in message) {
				const response = message as AcpResponse;
				const pending = this.pendingRequests.get(response.id);

				if (pending) {
					this.pendingRequests.delete(response.id);

					if (pending.timeoutId) {
						clearTimeout(pending.timeoutId);
					}

					if (response.error) {
						pending.reject(new Error(response.error.message || '未知 ACP 错误'));
					} else {
						// 检查 end_turn
						if (response.result && typeof response.result === 'object') {
							const result = response.result as { stopReason?: string };
							if (result.stopReason === 'end_turn') {
								this.onEndTurn();
							}
						}
						pending.resolve(response.result);
					}
				}
			}
		} catch (error) {
			console.error('[ACP] 消息处理错误:', error);
		}
	}

	/**
	 * 处理来自 Agent 的请求或通知
	 */
	private async handleIncomingRequest(message: AcpRequest | AcpNotification): Promise<void> {
		const { method, params } = message;

		try {
			let result: unknown = null;

			switch (method) {
				case AcpMethod.SESSION_UPDATE:
					this.onSessionUpdate(params as SessionNotificationParams);
					break;

				case 'session/request_permission':
				case AcpMethod.REQUEST_PERMISSION:
					result = await this.handlePermissionRequest(params as RequestPermissionParams);
					break;

				case AcpMethod.FS_READ_TEXT_FILE:
					result = await this.handleReadFile(params as { path: string; sessionId?: string });
					break;

				case AcpMethod.FS_WRITE_TEXT_FILE:
					result = await this.handleWriteFile(params as { path: string; content: string; sessionId?: string });
					break;

				default:
					console.log(`[ACP] 未处理的方法: ${method}`);
			}

			// 如果是请求 (有 id)，发送响应
			if ('id' in message && message.id !== undefined) {
				this.sendResponse(message.id, result);
			}
		} catch (error) {
			// 发送错误响应
			if ('id' in message && message.id !== undefined) {
				this.sendErrorResponse(message.id, error instanceof Error ? error.message : String(error));
			}
		}
	}

	// ========================================================================
	// 请求发送
	// ========================================================================

	/**
	 * 发送请求并等待响应
	 */
	private sendRequest<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
		const id = this.nextRequestId++;
		const message = createRequest(id, method, params);

		return new Promise((resolve, reject) => {
			// 超时时间: session/prompt 2 分钟，其他 1 分钟
			const timeoutDuration = method === AcpMethod.SESSION_PROMPT ? 120000 : 60000;
			const startTime = Date.now();

			const timeoutId = setTimeout(() => {
				const request = this.pendingRequests.get(id);
				if (request && !request.isPaused) {
					this.pendingRequests.delete(id);
					reject(new Error(`请求 ${method} 超时 (${timeoutDuration / 1000}s)`));
				}
			}, timeoutDuration);

			const pending: PendingRequest<T> = {
				resolve: resolve as (value: unknown) => void,
				reject,
				timeoutId,
				method,
				isPaused: false,
				startTime,
				timeoutDuration,
			};

			this.pendingRequests.set(id, pending);
			this.sendMessage(message);
		});
	}

	/**
	 * 发送消息到子进程
	 */
	private sendMessage(message: AcpRequest | AcpNotification): void {
		if (!this.child?.stdin) {
			console.error('[ACP] 无法发送消息: 子进程不可用');
			return;
		}

		const json = JSON.stringify(message);
		const lineEnding = Platform.isWin ? '\r\n' : '\n';
		this.child.stdin.write(json + lineEnding);
	}

	/**
	 * 发送响应
	 */
	private sendResponse(id: RequestId, result: unknown): void {
		if (!this.child?.stdin) return;

		const response: AcpResponse = {
			jsonrpc: JSONRPC_VERSION,
			id,
			result,
		};

		const json = JSON.stringify(response);
		const lineEnding = Platform.isWin ? '\r\n' : '\n';
		this.child.stdin.write(json + lineEnding);
	}

	/**
	 * 发送错误响应
	 */
	private sendErrorResponse(id: RequestId, message: string): void {
		if (!this.child?.stdin) return;

		const response: AcpResponse = {
			jsonrpc: JSONRPC_VERSION,
			id,
			error: { code: -32603, message },
		};

		const json = JSON.stringify(response);
		const lineEnding = Platform.isWin ? '\r\n' : '\n';
		this.child.stdin.write(json + lineEnding);
	}

	// ========================================================================
	// 超时管理
	// ========================================================================

	/**
	 * 暂停指定请求的超时
	 */
	private pauseRequestTimeout(requestId: RequestId): void {
		const request = this.pendingRequests.get(requestId);
		if (request && !request.isPaused && request.timeoutId) {
			clearTimeout(request.timeoutId);
			request.isPaused = true;
			request.timeoutId = undefined;
		}
	}

	/**
	 * 恢复指定请求的超时
	 */
	private resumeRequestTimeout(requestId: RequestId): void {
		const request = this.pendingRequests.get(requestId);
		if (request && request.isPaused) {
			const elapsed = Date.now() - request.startTime;
			const remaining = Math.max(0, request.timeoutDuration - elapsed);

			if (remaining > 0) {
				request.timeoutId = setTimeout(() => {
					if (this.pendingRequests.has(requestId) && !request.isPaused) {
						this.pendingRequests.delete(requestId);
						request.reject(new Error(`请求 ${request.method} 超时`));
					}
				}, remaining);
				request.isPaused = false;
			} else {
				this.pendingRequests.delete(requestId);
				request.reject(new Error(`请求 ${request.method} 超时`));
			}
		}
	}

	/**
	 * 暂停所有 session/prompt 请求的超时
	 */
	private pausePromptTimeouts(): void {
		for (const [id, request] of this.pendingRequests) {
			if (request.method === AcpMethod.SESSION_PROMPT) {
				this.pauseRequestTimeout(id);
			}
		}
	}

	/**
	 * 恢复所有 session/prompt 请求的超时
	 */
	private resumePromptTimeouts(): void {
		for (const [id, request] of this.pendingRequests) {
			if (request.method === AcpMethod.SESSION_PROMPT && request.isPaused) {
				this.resumeRequestTimeout(id);
			}
		}
	}

	// ========================================================================
	// 协议方法
	// ========================================================================

	/**
	 * 初始化协议
	 */
	private async initialize(): Promise<InitializeResponse> {
		const params = {
			protocolVersion: '1',
			clientInfo: {
				name: 'obsidian-acp',
				version: '0.1.0',
			},
			capabilities: {
				fs: {
					readTextFile: true,
					writeTextFile: true,
				},
			},
		};

		const response = await Promise.race([
			this.sendRequest<InitializeResponse>(AcpMethod.INITIALIZE, params),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('初始化超时 (60s)')), 60000)
			),
		]);

		this.isInitialized = true;
		this.initializeResponse = response;
		return response;
	}

	/**
	 * 认证
	 */
	async authenticate(methodId?: string): Promise<void> {
		await this.sendRequest(AcpMethod.AUTHENTICATE, methodId ? { methodId } : undefined);
	}

	/**
	 * 创建新会话
	 */
	async newSession(workingDir?: string): Promise<NewSessionResponse> {
		const cwd = workingDir || this.workingDir;

		const response = await this.sendRequest<NewSessionResponse>(AcpMethod.SESSION_NEW, {
			workingDirectory: cwd,
		});

		this.sessionId = response.sessionId;
		return response;
	}

	/**
	 * 发送提示
	 */
	async sendPrompt(text: string): Promise<PromptResponse> {
		if (!this.sessionId) {
			throw new Error('没有活动的 ACP 会话');
		}

		return await this.sendRequest<PromptResponse>(AcpMethod.SESSION_PROMPT, {
			sessionId: this.sessionId,
			content: [{ type: 'text', text }],
		});
	}

	/**
	 * 取消当前会话
	 */
	async cancelSession(): Promise<void> {
		if (!this.sessionId) return;

		await this.sendRequest(AcpMethod.SESSION_CANCEL, {
			sessionId: this.sessionId,
		});
	}

	// ========================================================================
	// 文件操作处理
	// ========================================================================

	/**
	 * 解析工作区路径
	 */
	private resolvePath(targetPath: string): string {
		if (!targetPath) return this.workingDir;
		if (path.isAbsolute(targetPath)) return targetPath;
		return path.join(this.workingDir, targetPath);
	}

	/**
	 * 处理文件读取请求
	 */
	private async handleReadFile(params: { path: string; sessionId?: string }): Promise<{ content: string }> {
		const resolvedPath = this.resolvePath(params.path);

		this.onFileOperation({
			method: AcpMethod.FS_READ_TEXT_FILE,
			path: resolvedPath,
			sessionId: params.sessionId || '',
		});

		const content = await fs.readFile(resolvedPath, 'utf-8');
		return { content };
	}

	/**
	 * 处理文件写入请求
	 */
	private async handleWriteFile(params: { path: string; content: string; sessionId?: string }): Promise<null> {
		const resolvedPath = this.resolvePath(params.path);

		this.onFileOperation({
			method: AcpMethod.FS_WRITE_TEXT_FILE,
			path: resolvedPath,
			content: params.content,
			sessionId: params.sessionId || '',
		});

		// 确保目录存在
		await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
		await fs.writeFile(resolvedPath, params.content, 'utf-8');

		return null;
	}

	/**
	 * 处理权限请求
	 */
	private async handlePermissionRequest(
		params: RequestPermissionParams
	): Promise<{ outcome: { type: string; optionId?: string } }> {
		// 暂停 prompt 超时
		this.pausePromptTimeouts();

		try {
			const outcome = await this.onPermissionRequest(params);

			if (outcome.type === 'selected') {
				return {
					outcome: {
						type: 'selected',
						optionId: outcome.optionId,
					},
				};
			} else {
				return {
					outcome: {
						type: 'cancelled',
					},
				};
			}
		} catch (error) {
			console.error('[ACP] 权限请求处理失败:', error);
			return {
				outcome: {
					type: 'cancelled',
				},
			};
		} finally {
			// 恢复 prompt 超时
			this.resumePromptTimeouts();
		}
	}

	// ========================================================================
	// 状态访问器
	// ========================================================================

	/** 是否已连接 */
	get isConnected(): boolean {
		return this.child !== null && !this.child.killed && this.state === 'connected';
	}

	/** 是否有活动会话 */
	get hasActiveSession(): boolean {
		return this.sessionId !== null;
	}

	/** 当前后端 */
	get currentBackend(): AcpBackendId | null {
		return this.backend;
	}

	/** 当前会话 ID */
	get currentSessionId(): string | null {
		return this.sessionId;
	}

	/** 连接状态 */
	get connectionState(): ConnectionState {
		return this.state;
	}

	/** 获取初始化响应 */
	getInitializeResponse(): InitializeResponse | null {
		return this.initializeResponse;
	}
}
