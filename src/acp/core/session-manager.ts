/**
 * 会话生命周期管理器
 *
 * 高层抽象，管理 ACP 会话的完整生命周期：
 * - 会话状态机 (idle/processing/cancelled)
 * - 消息历史管理
 * - 回合生命周期
 * - UI 事件回调
 */

import type { AcpConnection, FileOperation } from "./connection";
import type {
	SessionNotificationParams,
	RequestPermissionParams,
	PermissionOutcome,
	PromptResponse,
	PromptContent,
	SessionUpdateData,
	ToolCallUpdateData,
	ToolCallStatusUpdateData,
	AvailableCommand,
	CurrentModeUpdateData,
	AvailableCommandsUpdateData,
	AvailableModel,
	SessionModelState,
	AvailableMode,
	SessionModeState,
} from "../types";
import { StreamingMessageBuffer } from "./message-buffer";
import { SessionExporter } from "./session-export";
import { getBackendStreamingMode } from "../backends/registry";
import type { AcpBackendId } from "../backends/types";

// 类型重导出
export type {
	SessionState,
	StopReason,
	MessageRole,
	ToolCallStatus,
	Message,
	ToolCall,
	PlanEntry,
	Turn,
	SessionExportData,
} from "./types";

import type {
	SessionState,
	StopReason,
	MessageRole,
	ToolCallStatus,
	Message,
	ToolCall,
	PlanEntry,
	Turn,
	SessionExportData,
} from "./types";

// ============================================================================
// SessionManager 配置
// ============================================================================

/**
 * SessionManager 配置
 */
export interface SessionManagerConfig {
	/** AcpConnection 实例 */
	connection: AcpConnection;
	/** 工作目录 */
	workingDir?: string;
	/** Agent ID（用于确定流式模式） */
	agentId?: string;
	/** 权限请求回调（可选，用于避免竞态条件） */
	onPermissionRequest?: (
		params: RequestPermissionParams,
	) => Promise<PermissionOutcome>;
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
	private agentId: AcpBackendId;
	private streamingMode: "incremental" | "cumulative";

	// 状态
	private _state: SessionState = "idle";
	private _sessionId: string | null = null;

	// 模型和模式状态
	private _modelState: SessionModelState | null = null;
	private _modeState: SessionModeState | null = null;

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
	public onStateChange: (
		state: SessionState,
		previousState: SessionState,
	) => void = () => {};

	/** 回合结束回调 */
	public onTurnEnd: (turn: Turn) => void = () => {};

	/** 权限请求回调 */
	public onPermissionRequest: (
		params: RequestPermissionParams,
	) => Promise<PermissionOutcome> = () =>
		Promise.resolve({ type: "cancelled" });

	/** 文件操作回调 */
	public onFileOperation: (operation: FileOperation) => void = () => {};

	/** 错误回调 */
	public onError: (error: Error) => void = () => {};

	/** 当前模式更新回调 */
	public onCurrentModeUpdate: (mode: string, description?: string) => void =
		() => {};

	/** 可用命令更新回调 */
	public onAvailableCommandsUpdate: (commands: AvailableCommand[]) => void =
		() => {};

	/** 模型状态更新回调 */
	public onModelStateChange: (state: SessionModelState) => void = () => {};

	/** 模式状态更新回调 */
	public onModeStateChange: (state: SessionModeState) => void = () => {};

	// ========================================================================
	// 构造函数
	// ========================================================================

	constructor(config: SessionManagerConfig) {
		this.connection = config.connection;
		this.workingDir = config.workingDir || process.cwd();
		this.agentId = (config.agentId || "custom") as AcpBackendId;

		// 根据 Agent 配置确定流式模式
		this.streamingMode = getBackendStreamingMode(this.agentId);

		// 如果传入了权限回调，立即设置，避免竞态条件
		if (config.onPermissionRequest) {
			this.onPermissionRequest = config.onPermissionRequest;
		}

		// 初始化消息缓冲器
		this.messageBuffer = new StreamingMessageBuffer({
			updateInterval: 300,
			batchSize: 20,
		});

		// 绑定连接回调
		this.setupConnectionCallbacks();
	}

	/**
	 * 设置连接回调
	 */
	private setupConnectionCallbacks(): void {
		this.connection.onSessionUpdate = (data) =>
			this.handleSessionUpdate(data);
		this.connection.onPermissionRequest = (params) =>
			this.onPermissionRequest(params);
		this.connection.onFileOperation = (op) => this.onFileOperation(op);
		this.connection.onEndTurn = () => this.handleEndTurn();
		this.connection.onError = (err) => this.onError(err);
		this.connection.onDisconnect = () => this.handleDisconnect();
	}

	// ========================================================================
	// 状态管理
	// ========================================================================

	public get state(): SessionState {
		return this._state;
	}

	private setState(newState: SessionState): void {
		if (newState !== this._state) {
			const previousState = this._state;
			this._state = newState;
			this.onStateChange(newState, previousState);
		}
	}

	public get sessionId(): string | null {
		return this._sessionId;
	}

	public get hasActiveSession(): boolean {
		return this._sessionId !== null;
	}

	public get isProcessing(): boolean {
		return this._state === "processing";
	}

	// ========================================================================
	// 模型/模式状态访问
	// ========================================================================

	/** 获取当前模型状态 */
	public get modelState(): SessionModelState | null {
		return this._modelState;
	}

	/** 获取可用模型列表 */
	public get availableModels(): AvailableModel[] {
		return this._modelState?.availableModels || [];
	}

	/** 获取当前模型 ID */
	public get currentModelId(): string | null {
		return this._modelState?.currentModelId || null;
	}

	/** 获取当前模式状态 */
	public get modeState(): SessionModeState | null {
		return this._modeState;
	}

	/** 获取可用模式列表 */
	public get availableModes(): AvailableMode[] {
		return this._modeState?.availableModes || [];
	}

	/** 获取当前模式 ID */
	public get currentModeId(): string | null {
		return this._modeState?.currentModeId || null;
	}

	// ========================================================================
	// 历史访问
	// ========================================================================

	public get messages(): Message[] {
		return [...this._messages];
	}

	public get turns(): Turn[] {
		return [...this._turns];
	}

	public get activeTurn(): Turn | null {
		return this.currentTurn;
	}

	// ========================================================================
	// 会话操作
	// ========================================================================

	public async start(workingDir?: string): Promise<void> {
		if (this._sessionId) {
			throw new Error("会话已存在，请先结束当前会话");
		}

		const cwd = workingDir || this.workingDir;
		const response = await this.connection.newSession(cwd);
		this._sessionId = response.sessionId;
		this.workingDir = cwd;

		// 保存模型和模式状态
		if (response.models) {
			this._modelState = response.models;
			this.onModelStateChange(response.models);
		}
		if (response.modes) {
			this._modeState = response.modes;
			this.onModeStateChange(response.modes);
		}
	}

	public async sendPrompt(
		displayText: string,
		fullText?: string,
		images?: Array<{ data: string; mimeType: string }>,
	): Promise<StopReason> {
		if (!this._sessionId) {
			throw new Error("没有活动会话，请先调用 start()");
		}

		if (this._state === "processing") {
			throw new Error("会话正在处理中");
		}

		const textToSend = fullText ?? displayText;
		const userMessage = this.createMessage("user", displayText);
		this._messages.push(userMessage);
		this.onMessage(userMessage, true);

		this.currentTurn = {
			id: `turn_${this.nextTurnId++}`,
			userMessage,
			toolCalls: [],
			thoughts: [],
			startTime: Date.now(),
		};

		this.setState("processing");

		try {
			const promptContent = this.buildPromptContent(textToSend, images);
			const response = await this.connection.sendPrompt(promptContent);
			const stopReason = this.parseStopReason(response);
			this.completeTurn(stopReason);
			return stopReason;
		} catch (error) {
			this.completeTurn("error");
			throw error;
		}
	}

	private buildPromptContent(
		text: string,
		images?: Array<{ data: string; mimeType: string }>,
	): PromptContent[] {
		const content: PromptContent[] = [{ type: "text", text }];

		if (images && images.length > 0) {
			for (const image of images) {
				content.push({
					type: "image",
					data: image.data,
					mimeType: image.mimeType,
				});
			}
		}

		return content;
	}

	public async cancel(): Promise<void> {
		if (this._state !== "processing") {
			return;
		}

		this.setState("cancelled");

		try {
			await this.connection.cancelSession();
		} catch (error) {
			console.error("[SessionManager] 取消失败:", error);
		}

		this.completeTurn("cancelled");
	}

	/**
	 * 切换模式
	 * 注意：模型切换不支持，ACP 协议没有定义模型切换方法
	 * @see https://agentclientprotocol.com/protocol/session-modes
	 */
	public async setMode(modeId: string): Promise<void> {
		if (!this._sessionId) {
			throw new Error("没有活动会话");
		}

		await this.connection.setMode(modeId);

		// 更新本地状态
		if (this._modeState) {
			this._modeState = {
				...this._modeState,
				currentModeId: modeId,
			};
			this.onModeStateChange(this._modeState);
		}
	}

	public end(): void {
		if (this.currentTurn) {
			this.completeTurn("cancelled");
		}

		this.messageBuffer.clear();
		this._sessionId = null;
		this.setState("idle");
	}

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

	private createMessage(role: MessageRole, content: string): Message {
		return {
			id: `msg_${this.nextMessageId++}`,
			role,
			content,
			timestamp: Date.now(),
		};
	}

	private parseStopReason(response: PromptResponse): StopReason {
		const validReasons: StopReason[] = [
			"end_turn",
			"cancelled",
			"max_tokens",
			"max_turn_requests",
			"refusal",
		];
		if (
			response.stopReason &&
			validReasons.includes(response.stopReason as StopReason)
		) {
			return response.stopReason as StopReason;
		}
		return "end_turn";
	}

	private completeTurn(stopReason: StopReason): void {
		if (!this.currentTurn) return;

		if (this.currentTurn.assistantMessage) {
			this.messageBuffer.complete(this.currentTurn.assistantMessage.id);
			this.currentTurn.assistantMessage.isStreaming = false;
			// 通知 UI 更新，移除流式状态样式
			this.onMessage(this.currentTurn.assistantMessage, false);
		}

		this.currentTurn.stopReason = stopReason;
		this.currentTurn.endTime = Date.now();

		this._turns.push(this.currentTurn);
		this.onTurnEnd(this.currentTurn);

		this.currentTurn = null;
		this.setState("idle");
	}

	// ========================================================================
	// 会话更新处理
	// ========================================================================

	private handleSessionUpdate(data: SessionNotificationParams): void {
		const update = data.update;

		switch (update.sessionUpdate) {
			case "agent_message_chunk":
				this.handleAgentMessageChunk(update);
				break;
			case "agent_thought_chunk":
				this.handleAgentThoughtChunk(update);
				break;
			case "tool_call":
				this.handleToolCall(update);
				break;
			case "tool_call_update":
				this.handleToolCallUpdate(update);
				break;
			case "plan":
				this.handlePlan(
					update as { sessionUpdate: "plan"; entries: PlanEntry[] },
				);
				break;
			case "current_mode_update":
				this.handleCurrentModeUpdate(update);
				break;
			case "available_commands_update":
				this.handleAvailableCommandsUpdate(update);
				break;
			default:
				// 未识别的更新类型
				break;
		}
	}

	private handleAgentMessageChunk(update: SessionUpdateData): void {
		if (!this.currentTurn) return;

		const text = this.extractMessageText(update);

		if (!this.currentTurn.assistantMessage) {
			const message = this.createMessage("assistant", "");
			message.isStreaming = true;
			this.currentTurn.assistantMessage = message;
			this._messages.push(message);
			this.onMessage(message, true);
		}

		// 使用 auto 模式：智能检测累积/增量/重叠情况
		this.messageBuffer.append(
			this.currentTurn.assistantMessage.id,
			text,
			(content: string) => {
				if (this.currentTurn?.assistantMessage) {
					this.currentTurn.assistantMessage.content = content;
					this.onMessage(this.currentTurn.assistantMessage, false);
				}
			},
			"auto",
		);
	}

	private extractMessageText(update: SessionUpdateData): string {
		const content = (
			update as {
				content?: {
					type?: string;
					text?: string;
					uri?: string;
					name?: string;
					title?: string;
					description?: string;
				};
			}
		).content;
		if (!content) return "";

		if (content.type === "text") {
			return content.text || "";
		}
		if (content.type === "resource_link") {
			const linkName = content.title || content.name || "Resource";
			const linkUri = content.uri || "";
			let text = `[${linkName}](${linkUri})`;
			if (content.description) {
				text += `\n> ${content.description}`;
			}
			return text;
		}
		if (content.type === "image") {
			return content.uri ? `![图像](${content.uri})` : "(图像)";
		}

		return "";
	}

	private handleAgentThoughtChunk(update: SessionUpdateData): void {
		if (!this.currentTurn) return;

		// 调试：打印原始数据
		console.log("[ACP] agent_thought_chunk 原始数据:", JSON.stringify(update));

		// 尝试多种可能的字段
		const updateAny = update as unknown as Record<string, unknown>;
		const content = updateAny.content as { text?: string } | undefined;
		const thought = updateAny.thought as string | undefined;
		const text = content?.text || thought || "";

		if (text) {
			// 智能合并思考内容
			const currentThought = this.currentTurn.thoughts[0] || "";
			this.currentTurn.thoughts = [this.smartMergeThought(currentThought, text)];
			this.onThought(this.currentTurn.thoughts[0]);
		}
	}

	/**
	 * 智能合并思考内容
	 */
	private smartMergeThought(current: string, chunk: string): string {
		if (!current) return chunk;
		if (!chunk) return current;

		// 累积模式检测
		if (chunk.startsWith(current)) return chunk;
		if (current.startsWith(chunk)) return current;

		// 检测部分重叠
		const maxOverlap = Math.min(current.length, chunk.length);
		for (let overlap = maxOverlap; overlap > 0; overlap--) {
			if (current.slice(-overlap) === chunk.slice(0, overlap)) {
				return current + chunk.slice(overlap);
			}
		}

		// 无重叠，追加
		return current + chunk;
	}

	private handleToolCall(update: ToolCallUpdateData): void {
		if (!this.currentTurn) return;

		// 调试：打印原始工具调用数据（包含所有字段）
		console.log("[ACP] tool_call 原始数据:", JSON.stringify(update, null, 2));

		// 提取入参：尝试多个可能的字段名
		const rawInput = this.extractRawInput(update);
		console.log("[ACP] tool_call 提取的 rawInput:", JSON.stringify(rawInput));

		// 检查是否已存在相同 ID 的工具调用（ACP 会发送多次更新）
		const existingToolCall = this.currentTurn.toolCalls.find(
			(tc) => tc.toolCallId === update.toolCallId,
		);

		if (existingToolCall) {
			// 更新已存在的工具调用
			if (update.title) existingToolCall.title = update.title;
			if (update.kind) existingToolCall.kind = update.kind;
			if (update.status)
				existingToolCall.status = update.status as ToolCallStatus;
			if (update.locations) existingToolCall.locations = update.locations;
			// 合并 rawInput（新数据覆盖旧数据）
			if (rawInput && Object.keys(rawInput).length > 0) {
				existingToolCall.rawInput = {
					...(existingToolCall.rawInput || {}),
					...rawInput,
				};
			}
			if (update.content) existingToolCall.content = update.content;
			this.onToolCall(existingToolCall);
		} else {
			// 创建新的工具调用时，打断当前消息流
			this.interruptCurrentMessage();

			const toolCall: ToolCall = {
				toolCallId: update.toolCallId,
				title: update.title || "工具调用",
				kind: update.kind || "other",
				status: (update.status as ToolCallStatus) || "pending",
				locations: update.locations,
				rawInput: rawInput,
				startTime: Date.now(),
			};

			this.currentTurn.toolCalls.push(toolCall);
			this.onToolCall(toolCall);
		}
	}

	/**
	 * 从工具调用更新中提取入参
	 *
	 * 不同的 ACP Agent 可能使用不同的字段名：
	 * - rawInput (Claude Code)
	 * - input
	 * - params
	 * - arguments
	 * - toolInput
	 */
	private extractRawInput(
		update: ToolCallUpdateData,
	): Record<string, unknown> | undefined {
		const updateAny = update as unknown as Record<string, unknown>;

		// 按优先级尝试不同字段名
		const candidates = [
			update.rawInput,
			updateAny.input,
			updateAny.params,
			updateAny.arguments,
			updateAny.toolInput,
			updateAny.tool_input,
		];

		for (const candidate of candidates) {
			if (
				candidate &&
				typeof candidate === "object" &&
				Object.keys(candidate as object).length > 0
			) {
				return candidate as Record<string, unknown>;
			}
		}

		return undefined;
	}

	private interruptCurrentMessage(): void {
		if (!this.currentTurn?.assistantMessage) return;

		this.messageBuffer.complete(this.currentTurn.assistantMessage.id);
		this.currentTurn.assistantMessage.isStreaming = false;
		this.onMessage(this.currentTurn.assistantMessage, false);
		this.currentTurn.assistantMessage = undefined;
	}

	private handleToolCallUpdate(update: ToolCallStatusUpdateData): void {
		if (!this.currentTurn) return;

		const toolCall = this.currentTurn.toolCalls.find(
			(tc) => tc.toolCallId === update.toolCallId,
		);
		if (!toolCall) return;

		if (update.status) {
			toolCall.status = update.status as ToolCallStatus;
		}

		if (update.content) {
			toolCall.content = update.content;
		}

		if (toolCall.status === "completed" || toolCall.status === "failed") {
			toolCall.endTime = Date.now();
		}

		this.onToolCall(toolCall);
	}

	private handlePlan(update: {
		sessionUpdate: "plan";
		entries: PlanEntry[];
	}): void {
		if (!this.currentTurn) return;

		this.currentTurn.plan = update.entries;
		this.onPlan(update.entries);
	}

	private handleEndTurn(): void {
		if (this._state === "processing") {
			this.completeTurn("end_turn");
		}
	}

	private handleDisconnect(): void {
		// 通知用户连接已断开
		this.onError(new Error("Agent 连接已断开，请重新发送消息"));

		if (this.currentTurn) {
			this.completeTurn("error");
		}
		this._sessionId = null;
		this.setState("idle");
	}

	private handleCurrentModeUpdate(update: CurrentModeUpdateData): void {
		this.onCurrentModeUpdate(update.mode, update.description);
	}

	private handleAvailableCommandsUpdate(
		update: AvailableCommandsUpdateData,
	): void {
		this.onAvailableCommandsUpdate(update.availableCommands);
	}

	// ========================================================================
	// 导出功能
	// ========================================================================

	public toJSON(): SessionExportData {
		return SessionExporter.toJSON(
			this._sessionId,
			this._messages,
			this._turns,
			this.workingDir,
		);
	}

	public toMarkdown(): string {
		return SessionExporter.toMarkdown(this._turns, this.workingDir);
	}

	public static fromJSON(data: SessionExportData): {
		messages: Message[];
		turns: Turn[];
	} {
		return SessionExporter.fromJSON(data);
	}
}
