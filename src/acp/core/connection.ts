/**
 * ACP 连接核心类
 *
 * 负责与 ACP Agent 子进程的通信管理，包括：
 * - 子进程 spawn 与生命周期管理
 * - JSON-RPC 2.0 请求/响应/通知处理
 * - 协议初始化与认证
 * - 会话管理
 */

/* eslint-disable complexity */
/* eslint-disable max-depth */
/* eslint-disable max-lines */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type { ChildProcess, SpawnOptions } from 'child_process';
import { spawn } from 'child_process';
import { Platform } from 'obsidian';
import { promises as fs } from 'fs';
import * as path from 'path';

import type { AcpBackendId } from '../backends';
import { getBackendConfig, getBackendAcpArgs } from '../backends';
import { enhanceEnvForNodeScript } from '../utils/env-utils';
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
	SessionNewMcpServerConfig,
	SessionNewParams,
} from '../types';
import { JSONRPC_VERSION, createRequest, AcpMethod } from '../types';
import { RequestQueue } from './request-queue';
import type { AcpError } from '../types/errors';
import { AcpErrorType, createAcpError } from '../types/errors';
import { PermissionManager } from '../permission-manager';
import type { PermissionSettings } from '../../main';

// ============================================================================
// 类型定义
// ============================================================================

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
	/** Obsidian App 实例 */
	app?: any;
	/** 权限设置 */
	permissionSettings?: PermissionSettings;
	/** 保存设置回调 */
	saveSettings?: () => Promise<void>;
	/** MCP 服务器配置 */
	mcpServers?: Array<{
		id: string;
		name: string;
		type: 'stdio' | 'http' | 'sse';
		command?: string;
		args?: string[];
		url?: string;
		headers?: Array<{ name: string; value: string }>;
		env?: Array<{ name: string; value: string }>;
		enabled: boolean;
	}>;
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
	customEnv?: Record<string, string>,
): { command: string; args: string[]; options: SpawnOptions } {
	// 严格检查平台 - 确保 macOS 上绝对不使用 shell
	const isWindows = Platform.isWin === true;
	const isMac = Platform.isMacOS === true;

	// 使用通用环境增强函数处理 nvm 等版本管理器路径
	const env = enhanceEnvForNodeScript(cliPath, { ...process.env, ...customEnv });

	// ACP 参数：如果传入了空数组，表示不需要参数
	const effectiveAcpArgs = acpArgs !== undefined ? acpArgs : ['--experimental-acp'];

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

	// 关键修复：macOS 上必须禁用 shell，否则 JSON 消息会被当作命令执行
	// shell: true 只在 Windows 上需要，用于解析 .cmd/.bat 文件
	const useShell = isWindows && !isMac;

	console.log(`[ACP] createSpawnConfig: isWindows=${isWindows}, isMac=${isMac}, useShell=${useShell}`);
	console.log(`[ACP] createSpawnConfig: command=${spawnCommand}, args=${spawnArgs.join(' ')}`);

	const options: SpawnOptions = {
		cwd: workingDir,
		stdio: ['pipe', 'pipe', 'pipe'],
		env,
		shell: useShell,
	};

	return { command: spawnCommand, args: spawnArgs, options };
}

function getNpxPackageName(cliPath: string): string | null {
	const parts = cliPath.trim().split(/\s+/);
	if (parts.length === 0) return null;
	if (parts[0] !== 'npx' && parts[0] !== 'npx.cmd') return null;
	for (let i = 1; i < parts.length; i++) {
		const arg = parts[i];
		if (!arg.startsWith('-')) {
			return arg;
		}
	}
	return null;
}

function isLikelyCodexCli(cliPath: string): boolean {
	const trimmed = cliPath.trim();
	if (!trimmed) return false;

	const npxPackage = getNpxPackageName(trimmed)?.toLowerCase();
	if (npxPackage) {
		if (npxPackage === '@zed-industries/codex-acp' || npxPackage === 'codex-acp') {
			return false;
		}
		return npxPackage === 'codex';
	}

	const baseName = path.basename(trimmed).toLowerCase();
	return baseName === 'codex' || baseName === 'codex.exe' || baseName === 'codex.cmd' || baseName === 'codex.bat';
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
	private isCancelling = false; // 连接取消标志

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
	private mcpServers: Array<{
		id: string;
		name: string;
		type: 'stdio' | 'http' | 'sse';
		command?: string;
		args?: string[];
		url?: string;
		headers?: Array<{ name: string; value: string }>;
		env?: Array<{ name: string; value: string }>;
		enabled: boolean;
	}> = [];

	// Obsidian App 实例 (用于获取 Vault 路径)
	private app: any = null;

	// 消息缓冲
	private messageBuffer = '';

	// 重连机制
	private retryCount: number = 0;
	private readonly maxRetries: number = 3;
	private lastConnectionOptions: ConnectionOptions | null = null;

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
	// 错误分类
	// ========================================================================

	/**
	 * 动态错误分类 - 根据错误消息和后端类型启发式匹配错误类型
	 */
	private classifyError(errorMsg: string, backend: AcpBackendId | null): AcpError {
		const msgLower = errorMsg.toLowerCase();
		console.log(`[ACP] 错误分类: 原始消息="${errorMsg}", 后端=${backend}`);

		// 超时错误
		if (msgLower.includes('timeout') || msgLower.includes('超时') || msgLower.includes('timed out')) {
			console.log('[ACP] 分类结果: TIMEOUT (可重试)');
			return createAcpError(AcpErrorType.TIMEOUT, errorMsg, { retryable: true });
		}

		// 网络错误
		if (
			msgLower.includes('network') ||
			msgLower.includes('网络') ||
			msgLower.includes('connection refused') ||
			msgLower.includes('econnrefused') ||
			msgLower.includes('enotfound') ||
			msgLower.includes('enetunreach')
		) {
			console.log('[ACP] 分类结果: NETWORK_ERROR (可重试)');
			return createAcpError(AcpErrorType.NETWORK_ERROR, errorMsg, { retryable: true });
		}

		// 认证失败
		if (
			msgLower.includes('auth') ||
			msgLower.includes('认证') ||
			msgLower.includes('unauthorized') ||
			msgLower.includes('401') ||
			msgLower.includes('forbidden') ||
			msgLower.includes('403')
		) {
			console.log('[ACP] 分类结果: AUTHENTICATION_FAILED (不可重试)');
			return createAcpError(AcpErrorType.AUTHENTICATION_FAILED, errorMsg, { retryable: false });
		}

		// 会话相关错误
		if (msgLower.includes('session expired') || msgLower.includes('会话过期')) {
			console.log('[ACP] 分类结果: SESSION_EXPIRED (不可重试)');
			return createAcpError(AcpErrorType.SESSION_EXPIRED, errorMsg, { retryable: false });
		}

		if (
			msgLower.includes('session not found') ||
			msgLower.includes('会话未找到') ||
			msgLower.includes('session does not exist')
		) {
			console.log('[ACP] 分类结果: SESSION_NOT_FOUND (不可重试)');
			return createAcpError(AcpErrorType.SESSION_NOT_FOUND, errorMsg, { retryable: false });
		}

		// 权限错误
		if (msgLower.includes('permission denied') || msgLower.includes('权限拒绝') || msgLower.includes('eacces')) {
			console.log('[ACP] 分类结果: PERMISSION_DENIED (不可重试)');
			return createAcpError(AcpErrorType.PERMISSION_DENIED, errorMsg, { retryable: false });
		}

		// 进程启动错误
		if (msgLower.includes('spawn') || msgLower.includes('enoent') || msgLower.includes('启动失败')) {
			console.log('[ACP] 分类结果: SPAWN_FAILED (不可重试)');
			return createAcpError(AcpErrorType.SPAWN_FAILED, errorMsg, { retryable: false });
		}

		// 连接错误
		if (
			msgLower.includes('connection closed') ||
			msgLower.includes('连接已关闭') ||
			msgLower.includes('disconnected')
		) {
			console.log('[ACP] 分类结果: CONNECTION_CLOSED (可重试)');
			return createAcpError(AcpErrorType.CONNECTION_CLOSED, errorMsg, { retryable: true });
		}

		// 后端特定错误处理
		if (backend === 'qwen') {
			// Qwen 后端: "Internal error" 通常是认证问题
			if (msgLower.includes('internal error') || msgLower.includes('内部错误')) {
				console.log('[ACP] 分类结果: Qwen AUTHENTICATION_FAILED (不可重试)');
				return createAcpError(AcpErrorType.AUTHENTICATION_FAILED, `Qwen 认证失败: ${errorMsg}`, {
					retryable: false,
				});
			}
		}

		if (backend === 'claude') {
			// Claude 后端的特殊错误模式
			if (msgLower.includes('rate limit') || msgLower.includes('速率限制')) {
				console.log('[ACP] 分类结果: Claude TIMEOUT (速率限制, 可重试)');
				return createAcpError(AcpErrorType.TIMEOUT, `Claude API 速率限制: ${errorMsg}`, { retryable: true });
			}
		}

		// 协议错误
		if (msgLower.includes('protocol') || msgLower.includes('协议') || msgLower.includes('invalid response')) {
			console.log('[ACP] 分类结果: PROTOCOL_ERROR (不可重试)');
			return createAcpError(AcpErrorType.PROTOCOL_ERROR, errorMsg, { retryable: false });
		}

		// 默认: 未知错误 (不可重试)
		console.log('[ACP] 分类结果: UNKNOWN (不可重试)');
		return createAcpError(AcpErrorType.UNKNOWN, errorMsg, { retryable: false });
	}

	// ========================================================================
	// 重连机制
	// ========================================================================

	/**
	 * 重连逻辑 - 指数退避重试
	 */
	private async reconnect(): Promise<void> {
		if (!this.lastConnectionOptions) {
			throw new Error('无法重连: 缺少连接配置');
		}

		if (this.retryCount >= this.maxRetries) {
			console.error(`[ACP] 重连失败: 已达到最大重试次数 (${this.maxRetries})`);
			throw new Error(`连接失败: 已重试 ${this.maxRetries} 次`);
		}

		// 计算指数退避延迟: 1s, 2s, 4s, 最大 10s
		const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
		this.retryCount++;

		console.log(`[ACP] 重连中... (第 ${this.retryCount}/${this.maxRetries} 次，延迟 ${delay}ms)`);

		// 等待延迟
		await new Promise((resolve) => setTimeout(resolve, delay));

		// 尝试重连
		await this.connect(this.lastConnectionOptions);
	}

	// ========================================================================
	// 连接方法 (AionUI 模式)
	// ========================================================================

	/**
	 * 连接 Claude Code - 直接使用 npx @zed-industries/claude-code-acp
	 * 参考 AionUI 的 connectClaude 实现
	 */
	private connectClaude(workingDir: string, cliPath?: string, customEnv?: Record<string, string>): void {
		const isWindows = Platform.isWin === true;

		// 如果提供了 cliPath（从检测或手动配置），解析它
		let spawnCommand: string;
		let spawnArgs: string[];

		if (cliPath) {
			// 解析 "npx @zed-industries/claude-code-acp" 或 "npx acp-claude-code"
			const parts = cliPath.split(' ');
			if (parts[0] === 'npx') {
				spawnCommand = isWindows ? 'npx.cmd' : 'npx';
				spawnArgs = parts.slice(1); // 包名
			} else {
				// 其他格式，直接使用
				spawnCommand = parts[0];
				spawnArgs = parts.slice(1);
			}
		} else {
			// 默认使用 Zed wrapper（向后兼容）
			spawnCommand = isWindows ? 'npx.cmd' : 'npx';
			spawnArgs = ['@zed-industries/claude-code-acp'];
		}

		// 使用通用环境增强函数处理 nvm 等版本管理器路径
		const env = enhanceEnvForNodeScript(cliPath || spawnCommand, { ...process.env, ...customEnv });

		console.log(`[ACP] connectClaude: command=${spawnCommand}, args=${spawnArgs.join(' ')}, cwd=${workingDir}`);

		this.child = spawn(spawnCommand, spawnArgs, {
			cwd: workingDir,
			stdio: ['pipe', 'pipe', 'pipe'],
			env,
			shell: false, // macOS 上必须是 false
		});
	}

	/**
	 * 通用连接方式 - 用于其他后端
	 */
	private connectGeneric(options: ConnectionOptions): void {
		// 获取后端配置
		const config = getBackendConfig(options.backendId);
		let cliPath = options.cliPath || config?.defaultCliPath;

		if (!cliPath) {
			throw new Error(`后端 ${options.backendId} 没有配置 CLI 路径`);
		}

		// 🔧 Codex 特殊处理：强制使用 ACP 适配器
		if (options.backendId === 'codex-acp') {
			if (isLikelyCodexCli(cliPath)) {
				const fallback = config?.defaultCliPath || 'npx @zed-industries/codex-acp';
				console.warn(
					`[ACP] ⚠️ 检测到原生 Codex CLI (${cliPath})，强制回退到 ACP 适配器 (${fallback})\n` +
					`原生 Codex CLI 不支持 ACP 协议，请在设置中清空"手动路径"或使用 ${fallback}`,
				);
				cliPath = fallback;
			}
			// 额外检查：如果 cliPath 完全为空或只是 'codex'，也强制使用适配器
			if (!cliPath || cliPath.trim() === 'codex' || cliPath.trim() === 'codex.exe') {
				console.warn('[ACP] ⚠️ Codex 路径无效，使用默认 ACP 适配器');
				cliPath = config?.defaultCliPath || 'npx @zed-industries/codex-acp';
			}
		}

		// 获取 ACP 参数
		const acpArgs = options.acpArgs !== undefined ? options.acpArgs : getBackendAcpArgs(options.backendId);

		// 创建 spawn 配置
		const { command, args, options: spawnOptions } = createSpawnConfig(
			cliPath,
			this.workingDir,
			acpArgs,
			options.env,
		);

		console.log(`[ACP] connectGeneric: command=${command}, args=${args.join(' ')}, cwd=${this.workingDir}`);

		this.child = spawn(command, args, spawnOptions);
	}

	// ========================================================================
	// 连接管理
	// ========================================================================

	/**
	 * 连接到 ACP Agent
	 */
	public async connect(options: ConnectionOptions): Promise<void> {
		// 重置取消标志
		this.isCancelling = false;

		// 保存连接配置用于重连
		this.lastConnectionOptions = options;

		// 保存 App 实例和 MCP 配置
		if (options.app) {
			this.app = options.app;
		}
		if (options.mcpServers) {
			this.mcpServers = options.mcpServers;
		}

		// 初始化权限管理器
		if (options.app && options.permissionSettings && options.saveSettings) {
			this.permissionManager = new PermissionManager(
				options.app,
				options.permissionSettings,
				options.saveSettings,
			);
		}

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
			// 根据后端类型选择连接方式（参考 AionUI 实现）
			switch (options.backendId) {
				case 'claude':
					// Claude Code 单独处理，使用检测到的或配置的 cliPath
					this.connectClaude(this.workingDir, options.cliPath, options.env);
					break;
				default:
					// 其他后端使用通用连接方式
					this.connectGeneric(options);
					break;
			}

			// 设置进程处理器
			await this.setupProcessHandlers();

			// 初始化协议
			await this.initialize();

			this.state = 'connected';
			// 连接成功后重置重试计数
			this.retryCount = 0;
			// console.log(`[ACP] 连接成功: ${options.backendId}`);
		} catch (error) {
			this.state = 'error';
			this.disconnect();

			// 如果是用户主动取消，直接抛出取消错误，不重试
			if (this.isCancelling) {
				throw new Error('连接已被取消');
			}

			// 错误分类
			const errorMsg = error instanceof Error ? error.message : String(error);
			const classifiedError = this.classifyError(errorMsg, this.backend);

			console.error(
				`[ACP] 连接失败: ${classifiedError.type} - ${classifiedError.message} (可重试: ${classifiedError.retryable})`,
			);

			// 如果错误可重试且未达到最大重试次数,尝试重连
			if (classifiedError.retryable && this.retryCount < this.maxRetries) {
				await this.reconnect();
				return; // 重连成功,直接返回
			}

			// 不可重试或已达到最大重试次数,直接抛出
			throw new Error(`${classifiedError.type}: ${classifiedError.message}`);
		}
	}

	/**
	 * 断开连接
	 */
	public disconnect(): void {
		// console.log('[ACP] 断开连接中...');

		if (this.child) {
			this.child.kill();
			this.child = null;
			// console.log('[ACP] 子进程已终止');
		}

		// 清空请求队列
		this.requestQueue.clear('连接已断开');
		// console.log('[ACP] 请求队列已清空');

		// 重置状态
		this.sessionId = null;
		this.isInitialized = false;
		this.backend = null;
		this.initializeResponse = null;
		this.messageBuffer = '';
		this.state = 'disconnected';
		// console.log('[ACP] 连接已断开，状态已重置');
	}

	/**
	 * 取消连接（用户主动取消）
	 */
	public cancelConnection(): void {
		console.log('[ACP] 用户取消连接');
		this.isCancelling = true;
		this.disconnect();
	}

	/**
	 * 设置子进程事件处理器
	 */
	private async setupProcessHandlers(): Promise<void> {
		if (!this.child) return;

		let spawnError: Error | null = null;

		// stderr 日志（仅在调试模式下输出）
		this.child.stderr?.on('data', (_data: Buffer) => {
			// Claude Code 的 stderr 包含大量调试信息，正常情况下忽略
			// 如需调试，取消下面的注释：
			// console.debug('[ACP STDERR]:', _data.toString());
		});

		// 进程错误
		this.child.on('error', (error) => {
			spawnError = error;
			this.onError(error);
		});

		// 进程退出
		this.child.on('exit', (code, signal) => {
			if (code !== 0) {
				console.warn(`[ACP] 进程异常退出: code=${code}, signal=${signal}`);
			}
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
				this.handleIncomingRequest(message).catch((error) => {
					console.error('[ACP] 处理请求失败:', error);
				});
				return;
			}

			// 检查是否为响应 (有 id 字段且在待处理列表中)
			if ('id' in message) {
				const response = message;

				if (this.requestQueue.has(response.id)) {
					if (response.error) {
						this.requestQueue.rejectWithMessage(
							response.id,
							response.error.message || '未知 ACP 错误',
						);
					} else {
						// 检查 end_turn
						if (response.result && typeof response.result === 'object') {
							const result = response.result as { stopReason?: string };
							if (result.stopReason === 'end_turn') {
								this.onEndTurn();
							}
						}
						this.requestQueue.resolve(response.id, response.result);
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
		const messageId = 'id' in message ? message.id : undefined;
		// console.log(`[ACP] 收到请求: method=${method}, id=${messageId}`);

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
		// 超时时间: session/prompt 2 分钟，initialize 15 秒，其他 20 秒
		const timeoutDuration = method === AcpMethod.SESSION_PROMPT ? 120000
			: method === AcpMethod.INITIALIZE ? 15000
				: 20000;

		// 创建请求
		const { id, promise } = this.requestQueue.create<T>(method, timeoutDuration);
		const message = createRequest(id, method, params);

		// 发送消息
		this.sendMessage(message);

		return promise;
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
		if (!this.child?.stdin) {
			console.error('[ACP] 无法发送响应: 子进程不可用');
			return;
		}

		const response: AcpResponse = {
			jsonrpc: JSONRPC_VERSION,
			id,
			result,
		};

		const json = JSON.stringify(response);
		// console.log('[ACP] 发送响应:', json);
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
	// 超时管理 (委托给 RequestQueue)
	// ========================================================================

	/**
	 * 暂停所有 session/prompt 请求的超时
	 */
	private pausePromptTimeouts(): void {
		this.requestQueue.pauseByMethod(AcpMethod.SESSION_PROMPT);
	}

	/**
	 * 恢复所有 session/prompt 请求的超时
	 */
	private resumePromptTimeouts(): void {
		this.requestQueue.resumeByMethod(AcpMethod.SESSION_PROMPT);
	}

	// ========================================================================
	// 协议方法
	// ========================================================================

	/**
	 * 初始化协议
	 */
	private async initialize(): Promise<InitializeResponse> {
		const params = {
			protocolVersion: 1, // 数字类型
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
				setTimeout(() => reject(new Error('初始化超时 (15s)')), 15000),
			),
		]);

		this.isInitialized = true;
		this.initializeResponse = response;
		return response;
	}

	/**
	 * 认证
	 */
	public async authenticate(methodId?: string): Promise<void> {
		await this.sendRequest(AcpMethod.AUTHENTICATE, methodId ? { methodId } : undefined);
	}

	// ========================================================================
	// MCP 服务器配置
	// ========================================================================

	/**
	 * 替换字符串中的变量
	 */
	private replaceVariables(value: string): string {
		if (!value) return value;

		// 获取 Vault 路径
		const vaultPath = this.app?.vault?.adapter?.basePath || this.workingDir;

		// 获取用户主目录
		const userHome = process.env.HOME || process.env.USERPROFILE || '';

		return value
			.replace(/{VAULT_PATH}/g, vaultPath)
			.replace(/{USER_HOME}/g, userHome);
	}

	/**
	 * 获取 MCP 服务器配置
	 *
	 * 从 settings 读取已启用的 MCP 服务器，转换为 ACP 协议格式
	 */
	private getMcpServersConfig(): SessionNewMcpServerConfig[] {
		// 过滤启用的服务器
		const enabledServers = this.mcpServers.filter(server => server.enabled);

		if (enabledServers.length === 0) {
			console.log('[ACP] 没有启用的 MCP 服务器');
			return [];
		}

		console.log(`[ACP] 准备 ${enabledServers.length} 个 MCP 服务器配置`);

		return enabledServers.map(server => {
			// 根据类型构造不同的配置对象
			let config: SessionNewMcpServerConfig;

			if (server.type === 'stdio') {
				// stdio 类型配置
				config = {
					name: server.name,
					type: 'stdio',
					command: server.command ? this.replaceVariables(server.command) : '',
					// args 和 env 是 required，即使为空也必须是空数组
					args: server.args && server.args.length > 0
						? server.args.map(arg => this.replaceVariables(arg))
						: [],
					env: server.env && server.env.length > 0
						? server.env.map(envVar => ({
							name: envVar.name,
							value: this.replaceVariables(envVar.value),
						}))
						: [],
				};
			} else if (server.type === 'http') {
				// http 类型配置
				config = {
					name: server.name,
					type: 'http',
					url: server.url ? this.replaceVariables(server.url) : '',
					// env 是 required
					env: server.env && server.env.length > 0
						? server.env.map(envVar => ({
							name: envVar.name,
							value: this.replaceVariables(envVar.value),
						}))
						: [],
					// headers 是可选的
					headers: server.headers && server.headers.length > 0
						? server.headers.map(header => ({
							name: header.name,
							value: this.replaceVariables(header.value),
						}))
						: undefined,
				};
			} else {
				// sse 类型配置
				config = {
					name: server.name,
					type: 'sse',
					url: server.url ? this.replaceVariables(server.url) : '',
					// env 是 required
					env: server.env && server.env.length > 0
						? server.env.map(envVar => ({
							name: envVar.name,
							value: this.replaceVariables(envVar.value),
						}))
						: [],
					// headers 是可选的
					headers: server.headers && server.headers.length > 0
						? server.headers.map(header => ({
							name: header.name,
							value: this.replaceVariables(header.value),
						}))
						: undefined,
				};
			}

			console.log(`[ACP] MCP 服务器配置: ${server.name}`, JSON.stringify(config, null, 2));
			return config;
		});
	}

	/**
	 * 创建新会话
	 */
	public async newSession(workingDir?: string): Promise<NewSessionResponse> {
		const cwd = workingDir || this.workingDir;

		// 获取 MCP 服务器配置
		const mcpServers = this.getMcpServersConfig();

		// 构建请求参数
		const params: SessionNewParams = {
			cwd,
			mcpServers,
		};

		// 调试日志
		// console.log('[ACP] session/new 参数:', JSON.stringify(params, null, 2));

		const response = await this.sendRequest<NewSessionResponse>(
			AcpMethod.SESSION_NEW,
			params as unknown as Record<string, unknown>,
		);

		this.sessionId = response.sessionId;
		return response;
	}

	/**
	 * 发送提示
	 */
	public async sendPrompt(text: string): Promise<PromptResponse> {
		if (!this.sessionId) {
			throw new Error('没有活动的 ACP 会话');
		}

		return await this.sendRequest<PromptResponse>(AcpMethod.SESSION_PROMPT, {
			sessionId: this.sessionId,
			prompt: [{ type: 'text', text }], // 修正：使用 prompt 而不是 content
		});
	}

	/**
	 * 取消当前会话
	 */
	public async cancelSession(): Promise<void> {
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
		params: RequestPermissionParams,
	): Promise<{ outcome: { outcome: string; optionId: string } }> {
		console.log('[ACP] 收到权限请求:', params.toolCall?.title);

		// 暂停 prompt 超时
		this.pausePromptTimeouts();

		try {
			// 使用 PermissionManager 处理权限请求
			if (this.permissionManager) {
				const request = {
					toolCallId: params.toolCall?.toolCallId || '',
					toolName: params.toolCall?.kind || '',
					title: params.toolCall?.title || '',
					kind: params.toolCall?.kind || '',
					rawInput: params.toolCall?.rawInput || {},
				};

				const response = await this.permissionManager.handlePermissionRequest(request);

				console.log('[ACP] PermissionManager 响应:', response);

				// 将 PermissionResponse 转换为 ACP 协议格式
				if (response.outcome === 'cancelled') {
					return {
						outcome: {
							outcome: 'rejected',
							optionId: 'reject_once',
						},
					};
				}

				return {
					outcome: {
						outcome: 'selected',
						optionId: response.optionId || 'allow',  // ACP 标准格式
					},
				};
			}

			// 如果没有 PermissionManager，使用旧的回调方式
			const userChoice = await this.onPermissionRequest(params);
			console.log('[ACP] 用户选择:', userChoice);

			// 处理用户取消的情况
			if (userChoice.type === 'cancelled') {
				return {
					outcome: {
						outcome: 'rejected',
						optionId: 'reject_once',
					},
				};
			}

			// 根据 optionId 判断是 selected 还是 rejected（参考 AionUI）
			const optionId = userChoice.optionId;
			const outcome = optionId.includes('reject') ? 'rejected' : 'selected';

			const result = {
				outcome: {
					outcome,
					optionId,
				},
			};
			console.log('[ACP] 发送权限响应:', JSON.stringify(result));
			return result;
		} catch (error) {
			console.error('[ACP] 权限请求处理失败:', error);
			return {
				outcome: {
					outcome: 'rejected',
					optionId: 'reject_once',
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
	public get isConnected(): boolean {
		return this.child !== null && !this.child.killed && this.state === 'connected';
	}

	/** 是否有活动会话 */
	public get hasActiveSession(): boolean {
		return this.sessionId !== null;
	}

	/** 当前后端 */
	public get currentBackend(): AcpBackendId | null {
		return this.backend;
	}

	/** 当前会话 ID */
	public get currentSessionId(): string | null {
		return this.sessionId;
	}

	/** 连接状态 */
	public get connectionState(): ConnectionState {
		return this.state;
	}

	/** 获取初始化响应 */
	public getInitializeResponse(): InitializeResponse | null {
		return this.initializeResponse;
	}
}
