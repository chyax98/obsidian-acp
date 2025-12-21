/**
 * 会话生命周期管理器
 *
 * 高层抽象，管理 ACP 会话的完整生命周期：
 * - 会话状态机 (idle/processing/cancelled)
 * - 消息历史管理
 * - 回合生命周期
 * - UI 事件回调
 */

import type { AcpConnection, FileOperation } from './connection';
import type {
	SessionNotificationParams,
	RequestPermissionParams,
	PermissionOutcome,
	PromptResponse,
	PromptContent,
	SessionUpdateData,
	ToolCallUpdateData,
	ToolCallStatusUpdateData,
	ToolCallContent,
	AvailableCommand,
	CurrentModeUpdateData,
	AvailableCommandsUpdateData,
} from '../types';
import { StreamingMessageBuffer } from './message-buffer';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 会话状态
 */
export type SessionState = 'idle' | 'processing' | 'cancelled';

/**
 * 停止原因
 */
export type StopReason = 'end_turn' | 'cancelled' | 'max_tokens' | 'max_turn_requests' | 'refusal' | 'error';

/**
 * 消息角色
 */
export type MessageRole = 'user' | 'assistant';

/**
 * 消息类型
 */
export interface Message {
	/** 消息 ID */
	id: string;
	/** 角色 */
	role: MessageRole;
	/** 内容 */
	content: string;
	/** 时间戳 */
	timestamp: number;
	/** 是否正在流式输出 */
	isStreaming?: boolean;
}

/**
 * 工具调用状态
 *
 * 符合 ACP 协议规范:
 * - pending: 等待执行
 * - in_progress: 执行中
 * - completed: 执行成功
 * - failed: 执行失败（协议标准，包含错误和取消场景）
 */
export type ToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * 工具调用信息
 */
export interface ToolCall {
	/** 工具调用 ID */
	toolCallId: string;
	/** 标题 */
	title: string;
	/** 类型 */
	kind: string;
	/** 状态 */
	status: ToolCallStatus;
	/** 内容 */
	content?: ToolCallContent[];
	/** 相关位置 */
	locations?: Array<{ path: string; line?: number; column?: number }>;
	/** 原始输入参数（用于显示命令等） */
	rawInput?: Record<string, unknown>;
	/** 开始时间 */
	startTime: number;
	/** 结束时间 */
	endTime?: number;
}

/**
 * 计划条目
 */
export interface PlanEntry {
	content: string;
	priority: string;
	status: string;
}

/**
 * 回合信息
 */
export interface Turn {
	/** 回合 ID */
	id: string;
	/** 用户消息 */
	userMessage: Message;
	/** Agent 消息 (可能正在流式输出) */
	assistantMessage?: Message;
	/** 工具调用列表 */
	toolCalls: ToolCall[];
	/** 思考内容列表 */
	thoughts: string[];
	/** 计划 */
	plan?: PlanEntry[];
	/** 停止原因 */
	stopReason?: StopReason;
	/** 开始时间 */
	startTime: number;
	/** 结束时间 */
	endTime?: number;
}

/**
 * SessionManager 配置
 */
export interface SessionManagerConfig {
	/** AcpConnection 实例 */
	connection: AcpConnection;
	/** 工作目录 */
	workingDir?: string;
	/** 权限请求回调（可选，用于避免竞态条件） */
	onPermissionRequest?: (params: RequestPermissionParams) => Promise<PermissionOutcome>;
}

// ============================================================================
// SessionManager 类
// ============================================================================

/**
 * 会话生命周期管理器
 *
 * 提供高层会话管理 API，封装 AcpConnection 的底层细节。
 */
export class SessionManager {
	// 连接
	private connection: AcpConnection;
	private workingDir: string;

	// 状态
	private _state: SessionState = 'idle';
	private _sessionId: string | null = null;

	// 历史
	private _messages: Message[] = [];
	private _turns: Turn[] = [];
	private currentTurn: Turn | null = null;

	// ID 生成
	private nextMessageId = 1;
	private nextTurnId = 1;

	// 消息缓冲器
	private messageBuffer: StreamingMessageBuffer;

	// ========================================================================
	// 事件回调
	// ========================================================================

	/** 消息更新回调 */
	public onMessage: (message: Message, isNew: boolean) => void = () => {};

	/** 工具调用更新回调 */
	public onToolCall: (toolCall: ToolCall) => void = () => {};

	/** 计划更新回调 */
	public onPlan: (plan: PlanEntry[]) => void = () => {};

	/** 思考块更新回调 */
	public onThought: (thought: string) => void = () => {};

	/** 状态变更回调 */
	public onStateChange: (state: SessionState, previousState: SessionState) => void = () => {};

	/** 回合结束回调 */
	public onTurnEnd: (turn: Turn) => void = () => {};

	/** 权限请求回调 */
	public onPermissionRequest: (params: RequestPermissionParams) => Promise<PermissionOutcome> = () =>
		Promise.resolve({ type: 'cancelled' });

	/** 文件操作回调 */
	public onFileOperation: (operation: FileOperation) => void = () => {};

	/** 错误回调 */
	public onError: (error: Error) => void = () => {};

	/** 当前模式更新回调 */
	public onCurrentModeUpdate: (mode: string, description?: string) => void = () => {};

	/** 可用命令更新回调 */
	public onAvailableCommandsUpdate: (commands: AvailableCommand[]) => void = () => {};

	// ========================================================================
	// 构造函数
	// ========================================================================

	constructor(config: SessionManagerConfig) {
		this.connection = config.connection;
		this.workingDir = config.workingDir || process.cwd();

		// 如果传入了权限回调，立即设置，避免竞态条件
		if (config.onPermissionRequest) {
			this.onPermissionRequest = config.onPermissionRequest;
		}

		// 初始化消息缓冲器
		this.messageBuffer = new StreamingMessageBuffer({
			updateInterval: 300, // 300ms
			batchSize: 20, // 20 chunks
		});

		// 绑定连接回调
		this.setupConnectionCallbacks();
	}

	/**
	 * 设置连接回调
	 */
	private setupConnectionCallbacks(): void {
		// 会话更新
		this.connection.onSessionUpdate = (data: SessionNotificationParams) => {
			this.handleSessionUpdate(data);
		};

		// 权限请求
		this.connection.onPermissionRequest = async (params: RequestPermissionParams) => {
			return this.onPermissionRequest(params);
		};

		// 文件操作
		this.connection.onFileOperation = (operation: FileOperation) => {
			this.onFileOperation(operation);
		};

		// 回合结束
		this.connection.onEndTurn = () => {
			this.handleEndTurn();
		};

		// 错误
		this.connection.onError = (error: Error) => {
			this.onError(error);
		};

		// 断开连接
		this.connection.onDisconnect = () => {
			this.handleDisconnect();
		};
	}

	// ========================================================================
	// 状态管理
	// ========================================================================

	/**
	 * 获取当前状态
	 */
	public get state(): SessionState {
		return this._state;
	}

	/**
	 * 设置状态
	 */
	private setState(newState: SessionState): void {
		if (newState !== this._state) {
			const previousState = this._state;
			this._state = newState;
			this.onStateChange(newState, previousState);
		}
	}

	/**
	 * 获取会话 ID
	 */
	public get sessionId(): string | null {
		return this._sessionId;
	}

	/**
	 * 是否有活动会话
	 */
	public get hasActiveSession(): boolean {
		return this._sessionId !== null;
	}

	/**
	 * 是否正在处理
	 */
	public get isProcessing(): boolean {
		return this._state === 'processing';
	}

	// ========================================================================
	// 历史访问
	// ========================================================================

	/**
	 * 获取消息列表
	 */
	public get messages(): Message[] {
		return [...this._messages];
	}

	/**
	 * 获取回合列表
	 */
	public get turns(): Turn[] {
		return [...this._turns];
	}

	/**
	 * 获取当前回合
	 */
	public get activeTurn(): Turn | null {
		return this.currentTurn;
	}

	// ========================================================================
	// 会话操作
	// ========================================================================

	/**
	 * 开始新会话
	 */
	public async start(workingDir?: string): Promise<void> {
		if (this._sessionId) {
			throw new Error('会话已存在，请先结束当前会话');
		}

		const cwd = workingDir || this.workingDir;
		const response = await this.connection.newSession(cwd);
		this._sessionId = response.sessionId;
		this.workingDir = cwd;
	}

	/**
	 * 发送提示并等待响应
	 *
	 * @param displayText - 显示给用户的文本
	 * @param fullText - 发送给 Agent 的完整文本（可选，默认等于 displayText）
	 * @param images - 可选的图片内容数组（base64 编码）
	 */
	public async sendPrompt(
		displayText: string,
		fullText?: string,
		images?: Array<{ data: string; mimeType: string }>,
	): Promise<StopReason> {
		if (!this._sessionId) {
			throw new Error('没有活动会话，请先调用 start()');
		}

		if (this._state === 'processing') {
			throw new Error('会话正在处理中');
		}

		// 实际发送给 Agent 的文本
		const textToSend = fullText ?? displayText;

		// 创建用户消息（显示给用户的文本，不包含隐藏的上下文）
		const userMessage = this.createMessage('user', displayText);
		this._messages.push(userMessage);
		this.onMessage(userMessage, true);

		// 创建回合
		this.currentTurn = {
			id: `turn_${this.nextTurnId++}`,
			userMessage,
			toolCalls: [],
			thoughts: [],
			startTime: Date.now(),
		};

		// 切换到处理状态
		this.setState('processing');

		try {
			// 构建 prompt 内容数组（支持图片）
			const promptContent: PromptContent[] = [{ type: 'text', text: textToSend }];

			// 添加图片内容
			if (images && images.length > 0) {
				for (const image of images) {
					promptContent.push({
						type: 'image',
						data: image.data,
						mimeType: image.mimeType,
					});
				}
			}

			// 发送请求（包含完整上下文和图片）
			const response = await this.connection.sendPrompt(promptContent);

			// 完成回合
			const stopReason = this.parseStopReason(response);
			this.completeTurn(stopReason);

			return stopReason;
		} catch (error) {
			// 错误处理
			this.completeTurn('error');
			throw error;
		}
	}

	/**
	 * 取消当前回合
	 */
	public async cancel(): Promise<void> {
		if (this._state !== 'processing') {
			return; // 不在处理中，无需取消
		}

		this.setState('cancelled');

		try {
			await this.connection.cancelSession();
		} catch (error) {
			console.error('[SessionManager] 取消失败:', error);
		}

		// 完成回合
		this.completeTurn('cancelled');
	}

	/**
	 * 结束会话
	 */
	public end(): void {
		if (this.currentTurn) {
			this.completeTurn('cancelled');
		}

		// 清空消息缓冲器
		this.messageBuffer.clear();

		this._sessionId = null;
		this.setState('idle');
	}

	/**
	 * 清空历史
	 */
	public clearHistory(): void {
		this._messages = [];
		this._turns = [];
		this.currentTurn = null;
		this.nextMessageId = 1;
		this.nextTurnId = 1;
	}

	// ========================================================================
	// 内部方法
	// ========================================================================

	/**
	 * 创建消息
	 */
	private createMessage(role: MessageRole, content: string): Message {
		return {
			id: `msg_${this.nextMessageId++}`,
			role,
			content,
			timestamp: Date.now(),
		};
	}

	/**
	 * 解析停止原因
	 */
	private parseStopReason(response: PromptResponse): StopReason {
		if (response.stopReason) {
			const reason = response.stopReason as StopReason;
			if (['end_turn', 'cancelled', 'max_tokens', 'max_turn_requests', 'refusal'].includes(reason)) {
				return reason;
			}
		}
		return 'end_turn';
	}

	/**
	 * 完成回合
	 */
	private completeTurn(stopReason: StopReason): void {
		if (!this.currentTurn) return;

		// 完成消息缓冲器
		if (this.currentTurn.assistantMessage) {
			this.messageBuffer.complete(this.currentTurn.assistantMessage.id);
		}

		this.currentTurn.stopReason = stopReason;
		this.currentTurn.endTime = Date.now();

		// 结束 assistant 消息的流式输出
		if (this.currentTurn.assistantMessage) {
			this.currentTurn.assistantMessage.isStreaming = false;
		}

		// 保存回合
		this._turns.push(this.currentTurn);

		// 触发回合结束回调
		this.onTurnEnd(this.currentTurn);

		// 重置
		this.currentTurn = null;
		this.setState('idle');
	}

	/**
	 * 处理会话更新
	 */
	private handleSessionUpdate(data: SessionNotificationParams): void {
		const update = data.update;

		switch (update.sessionUpdate) {
			case 'agent_message_chunk':
				this.handleAgentMessageChunk(update);
				break;

			case 'agent_thought_chunk':
				this.handleAgentThoughtChunk(update);
				break;

			case 'tool_call':
				this.handleToolCall(update);
				break;

			case 'tool_call_update':
				this.handleToolCallUpdate(update);
				break;

			case 'plan':
				this.handlePlan(update as { sessionUpdate: 'plan'; entries: PlanEntry[] });
				break;

			case 'current_mode_update':
				this.handleCurrentModeUpdate(update);
				break;

			case 'available_commands_update':
				this.handleAvailableCommandsUpdate(update);
				break;

			case 'user_message_chunk':
				// 通常在 session/load 时收到，暂不处理
				break;

			default:
				// 处理未识别的更新类型
				break;
		}
	}

	/**
	 * 处理 Agent 消息块
	 */
	private handleAgentMessageChunk(update: SessionUpdateData): void {
		if (!this.currentTurn) return;

		const updateWithContent = update as { content?: { type?: string; text?: string; uri?: string; name?: string; title?: string; description?: string; mimeType?: string } };
		const content = updateWithContent.content;

		// 处理不同类型的内容
		let text = '';
		if (content) {
			if (content.type === 'text') {
				// 文本内容
				text = content.text || '';
			} else if (content.type === 'resource_link') {
				// 资源链接内容 - 转换为 Markdown 链接格式
				const linkName = content.title || content.name || 'Resource';
				const linkUri = content.uri || '';
				text = `[${linkName}](${linkUri})`;
				if (content.description) {
					text += `\n> ${content.description}`;
				}
			} else if (content.type === 'image') {
				// 图像内容 - 暂时作为文本处理
				text = content.uri ? `![图像](${content.uri})` : '(图像)';
			}
		}

		if (!this.currentTurn.assistantMessage) {
			// 创建新的 assistant 消息
			const message = this.createMessage('assistant', '');
			message.isStreaming = true;
			this.currentTurn.assistantMessage = message;
			this._messages.push(message);
			this.onMessage(message, true);
		}

		// 使用缓冲器追加内容
		this.messageBuffer.append(
			this.currentTurn.assistantMessage.id,
			text,
			(content: string, _isFinal: boolean) => {
				if (this.currentTurn?.assistantMessage) {
					this.currentTurn.assistantMessage.content = content;
					this.onMessage(this.currentTurn.assistantMessage, false);
				}
			},
			'accumulate',
		);
	}

	/**
	 * 处理 Agent 思考块
	 */
	private handleAgentThoughtChunk(update: SessionUpdateData): void {
		if (!this.currentTurn) return;

		const content = (update as { content?: { text?: string } }).content;
		const text = content?.text || '';

		if (text) {
			// 添加到思考列表
			this.currentTurn.thoughts.push(text);
			// 触发回调
			this.onThought(text);
		}
	}

	/**
	 * 处理工具调用
	 */
	private handleToolCall(update: ToolCallUpdateData): void {
		if (!this.currentTurn) return;

		// 打断当前消息流 - 让后续文本创建新消息元素
		if (this.currentTurn.assistantMessage) {
			// 完成当前消息缓冲
			this.messageBuffer.complete(this.currentTurn.assistantMessage.id);
			// 标记消息结束流式输出
			this.currentTurn.assistantMessage.isStreaming = false;
			this.onMessage(this.currentTurn.assistantMessage, false);
			// 清除引用，下次文本会创建新消息
			this.currentTurn.assistantMessage = undefined;
		}

		const toolCall: ToolCall = {
			toolCallId: update.toolCallId,
			title: update.title || '工具调用',
			kind: update.kind || 'other',
			status: (update.status as ToolCallStatus) || 'pending',
			locations: update.locations,
			rawInput: update.rawInput,
			startTime: Date.now(),
		};

		this.currentTurn.toolCalls.push(toolCall);
		this.onToolCall(toolCall);
	}

	/**
	 * 处理工具调用更新
	 */
	private handleToolCallUpdate(update: ToolCallStatusUpdateData): void {
		if (!this.currentTurn) return;

		const toolCall = this.currentTurn.toolCalls.find((tc) => tc.toolCallId === update.toolCallId);
		if (!toolCall) return;

		// 更新状态
		if (update.status) {
			toolCall.status = update.status as ToolCallStatus;
		}

		// 更新内容
		if (update.content) {
			toolCall.content = update.content;
		}

		// 标记结束时间
		if (toolCall.status === 'completed' || toolCall.status === 'failed') {
			toolCall.endTime = Date.now();
		}

		this.onToolCall(toolCall);
	}

	/**
	 * 处理计划
	 */
	private handlePlan(update: { sessionUpdate: 'plan'; entries: PlanEntry[] }): void {
		if (!this.currentTurn) return;

		this.currentTurn.plan = update.entries;
		this.onPlan(update.entries);
	}

	/**
	 * 处理回合结束
	 */
	private handleEndTurn(): void {
		// 由 sendPrompt 的响应处理，这里仅作备用
		if (this._state === 'processing') {
			this.completeTurn('end_turn');
		}
	}

	/**
	 * 处理断开连接
	 */
	private handleDisconnect(): void {
		if (this.currentTurn) {
			this.completeTurn('error');
		}
		this._sessionId = null;
		this.setState('idle');
	}

	/**
	 * 处理当前模式更新
	 */
	private handleCurrentModeUpdate(update: CurrentModeUpdateData): void {
		this.onCurrentModeUpdate(update.mode, update.description);
	}

	/**
	 * 处理可用命令更新
	 */
	private handleAvailableCommandsUpdate(update: AvailableCommandsUpdateData): void {
		this.onAvailableCommandsUpdate(update.availableCommands);
	}

	// ========================================================================
	// 导出功能
	// ========================================================================

	/**
	 * 导出会话为 JSON 格式
	 *
	 * 用于会话持久化和恢复
	 */
	public toJSON(): SessionExportData {
		return {
			version: 1,
			exportedAt: Date.now(),
			sessionId: this._sessionId,
			messages: this._messages.map((m) => ({ ...m })),
			turns: this._turns.map((t) => ({
				...t,
				toolCalls: t.toolCalls.map((tc) => ({ ...tc })),
				thoughts: [...t.thoughts],
				plan: t.plan ? [...t.plan] : undefined,
			})),
			metadata: {
				workingDir: this.workingDir,
				totalMessages: this._messages.length,
				totalTurns: this._turns.length,
			},
		};
	}

	/**
	 * 导出会话为 Markdown 格式
	 *
	 * 用于保存对话记录到笔记
	 */
	public toMarkdown(): string {
		const lines: string[] = [];

		// 标题
		lines.push('# ACP 会话记录');
		lines.push('');
		lines.push(`> 导出时间: ${new Date().toLocaleString()}`);
		lines.push(`> 工作目录: ${this.workingDir}`);
		lines.push(`> 消息数: ${this._messages.length}`);
		lines.push('');
		lines.push('---');
		lines.push('');

		// 按回合输出
		for (const turn of this._turns) {
			// 用户消息
			lines.push('## 👤 用户');
			lines.push('');
			lines.push(turn.userMessage.content);
			lines.push('');

			// 思考过程
			if (turn.thoughts.length > 0) {
				lines.push('### 💭 思考');
				lines.push('');
				for (const thought of turn.thoughts) {
					lines.push(`> ${thought.replace(/\n/g, '\n> ')}`);
				}
				lines.push('');
			}

			// 工具调用
			if (turn.toolCalls.length > 0) {
				lines.push('### 🔧 工具调用');
				lines.push('');
				for (const toolCall of turn.toolCalls) {
					const statusIcon = this.getToolStatusIcon(toolCall.status);
					lines.push(`- ${statusIcon} **${toolCall.title}** (${toolCall.kind})`);

					// 工具输出
					if (toolCall.content && toolCall.content.length > 0) {
						for (const content of toolCall.content) {
							if (content.type === 'content' && content.content?.type === 'text') {
								const text = content.content.text || '';
								if (text.length > 500) {
									lines.push('  ```');
									lines.push('  ' + text.slice(0, 500) + '...(truncated)');
									lines.push('  ```');
								} else if (text) {
									lines.push('  ```');
									lines.push('  ' + text.replace(/\n/g, '\n  '));
									lines.push('  ```');
								}
							}
						}
					}
				}
				lines.push('');
			}

			// Agent 响应
			if (turn.assistantMessage) {
				lines.push('## 🤖 Agent');
				lines.push('');
				lines.push(turn.assistantMessage.content);
				lines.push('');
			}

			lines.push('---');
			lines.push('');
		}

		return lines.join('\n');
	}

	/**
	 * 获取工具状态图标
	 */
	private getToolStatusIcon(status: ToolCallStatus): string {
		switch (status) {
			case 'completed':
				return '✅';
			case 'failed':
				return '❌';
			case 'in_progress':
				return '⏳';
			default:
				return '⏸️';
		}
	}

	/**
	 * 从 JSON 数据恢复会话
	 *
	 * 注意：这只恢复历史记录，不重建会话连接
	 */
	public static fromJSON(data: SessionExportData): { messages: Message[]; turns: Turn[] } {
		if (data.version !== 1) {
			throw new Error(`不支持的会话数据版本: ${data.version}`);
		}
		return {
			messages: data.messages,
			turns: data.turns,
		};
	}
}

/**
 * 会话导出数据格式
 */
export interface SessionExportData {
	/** 数据格式版本 */
	version: number;
	/** 导出时间戳 */
	exportedAt: number;
	/** 会话 ID */
	sessionId: string | null;
	/** 消息列表 */
	messages: Message[];
	/** 回合列表 */
	turns: Turn[];
	/** 元数据 */
	metadata: {
		workingDir: string;
		totalMessages: number;
		totalTurns: number;
	};
}
