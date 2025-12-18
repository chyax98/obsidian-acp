/**
 * ACP ChatView - 聊天视图
 *
 * 提供与 AI Agent 交互的侧边栏界面
 */

import type { WorkspaceLeaf } from 'obsidian';
import { ItemView, Notice, Component } from 'obsidian';
import type AcpPlugin from '../main';
import { SessionManager } from '../acp/core/session-manager';
import { AcpConnection } from '../acp/core/connection';
import type { Message, ToolCall, PlanEntry, SessionState } from '../acp/core/session-manager';
import type { DetectedAgent } from '../acp/detector';
import { PermissionModal, isReadOperation } from './PermissionModal';
import type { RequestPermissionParams, PermissionOutcome } from '../acp/types/permissions';
import { MessageRenderer } from './MessageRenderer';
import { ClaudeSdkConnection, type ClaudeCallbacks } from '../claude/sdk-connection';
import { resolve, isAbsolute } from 'path';
import { existsSync, statSync, realpathSync } from 'fs';

// ============================================================================
// 常量
// ============================================================================

/** ChatView 的唯一标识符 */
export const ACP_CHAT_VIEW_TYPE = 'acp-chat-view';

// ============================================================================
// ChatView 类
// ============================================================================

/**
 * ACP 聊天视图
 *
 * 负责：
 * - 显示聊天界面
 * - Agent 选择和连接
 * - 消息发送和接收
 * - 会话状态管理
 */
export class AcpChatView extends ItemView {
	// 插件引用
	private plugin: AcpPlugin;

	// ACP 核心（用于非 Claude Agent）
	private connection: AcpConnection | null = null;
	private sessionManager: SessionManager | null = null;

	// Claude SDK 连接（用于 Claude Agent）
	private sdkConnection: ClaudeSdkConnection | null = null;
	private isSdkMode = false; // 标志当前是否使用 SDK 模式

	// 当前流式消息（用于 SDK 模式）
	private currentStreamingMessageId: string | null = null;

	// Agent 信息
	private availableAgents: DetectedAgent[] = [];
	private selectedAgent: DetectedAgent | null = null;

	// Obsidian Component（用于 MarkdownRenderer 生命周期管理）
	private markdownComponent: Component = new Component();

	// DOM 元素
	private headerEl!: HTMLElement;
	private messagesEl!: HTMLElement;
	private inputContainerEl!: HTMLElement;
	private inputEl!: HTMLTextAreaElement;
	private sendButtonEl!: HTMLButtonElement;
	private cancelButtonEl!: HTMLButtonElement;
	private agentSelectEl!: HTMLSelectElement;
	private connectButtonEl!: HTMLButtonElement;
	private statusEl!: HTMLElement;

	// ========================================================================
	// 构造函数
	// ========================================================================

	constructor(leaf: WorkspaceLeaf, plugin: AcpPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	// ========================================================================
	// ItemView 实现
	// ========================================================================

	/**
	 * 视图类型
	 */
	getViewType(): string {
		return ACP_CHAT_VIEW_TYPE;
	}

	/**
	 * 显示文本
	 */
	getDisplayText(): string {
		return 'ACP Chat';
	}

	/**
	 * 图标
	 */
	getIcon(): string {
		return 'bot';
	}

	/**
	 * 打开视图
	 */
	async onOpen(): Promise<void> {
		console.log('[ChatView] 打开视图');

		// 加载 Markdown 组件
		this.markdownComponent.load();

		// 创建基础结构
		const container = this.contentEl;
		container.empty();
		container.addClass('acp-chat-container');

		// 创建头部
		this.createHeader(container);

		// 创建消息区域
		this.createMessagesArea(container);

		// 创建输入区域
		this.createInputArea(container);

		// 加载可用 Agent
		await this.loadAvailableAgents();
	}

	/**
	 * 关闭视图
	 */
	async onClose(): Promise<void> {
		console.log('[ChatView] 关闭视图');

		// 断开 ACP 连接
		if (this.sessionManager) {
			this.sessionManager.end();
		}
		if (this.connection) {
			this.connection.disconnect();
		}

		// 断开 SDK 连接
		if (this.sdkConnection) {
			this.sdkConnection.disconnect();
		}

		// 卸载 Markdown 组件
		this.markdownComponent.unload();
	}

	// ========================================================================
	// UI 创建
	// ========================================================================

	/**
	 * 创建头部区域
	 */
	private createHeader(container: HTMLElement): void {
		this.headerEl = container.createDiv({ cls: 'acp-chat-header' });

		// Agent 选择器容器
		const selectorContainer = this.headerEl.createDiv({ cls: 'acp-agent-selector' });

		// Agent 下拉框
		this.agentSelectEl = selectorContainer.createEl('select', { cls: 'acp-agent-select' });
		this.agentSelectEl.createEl('option', {
			text: '选择 Agent...',
			value: '',
		});

		// 连接按钮
		this.connectButtonEl = selectorContainer.createEl('button', {
			cls: 'acp-connect-button',
			text: '连接',
		});
		this.connectButtonEl.addEventListener('click', () => this.handleConnect());

		// 状态指示器
		this.statusEl = this.headerEl.createDiv({ cls: 'acp-status' });
		this.updateStatus('未连接', 'idle');
	}

	/**
	 * 创建消息区域
	 */
	private createMessagesArea(container: HTMLElement): void {
		this.messagesEl = container.createDiv({ cls: 'acp-chat-messages' });

		// 欢迎消息
		this.addSystemMessage('欢迎使用 ACP Agent Client!\n请选择一个 Agent 并连接。');
	}

	/**
	 * 创建输入区域
	 */
	private createInputArea(container: HTMLElement): void {
		this.inputContainerEl = container.createDiv({ cls: 'acp-chat-input' });

		// 输入框
		this.inputEl = this.inputContainerEl.createEl('textarea', {
			cls: 'acp-input-textarea',
			attr: {
				placeholder: '输入消息...',
				rows: '3',
			},
		});

		// 监听回车键
		this.inputEl.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				this.handleSend();
			}
		});

		// 按钮容器
		const buttonContainer = this.inputContainerEl.createDiv({ cls: 'acp-input-buttons' });

		// 发送按钮
		this.sendButtonEl = buttonContainer.createEl('button', {
			cls: 'acp-send-button mod-cta',
			text: '发送',
		});
		this.sendButtonEl.addEventListener('click', () => this.handleSend());

		// 取消按钮（初始隐藏）
		this.cancelButtonEl = buttonContainer.createEl('button', {
			cls: 'acp-cancel-button',
			text: '取消',
		});
		this.cancelButtonEl.style.display = 'none';
		this.cancelButtonEl.addEventListener('click', () => this.handleCancel());

		// 初始状态禁用输入
		this.setInputEnabled(false);
	}

	// ========================================================================
	// Agent 管理
	// ========================================================================

	/**
	 * 加载可用 Agent
	 */
	private async loadAvailableAgents(): Promise<void> {
		try {
			// Claude SDK 模式不需要检测，直接显示可用
			this.availableAgents = [{
				backendId: 'claude',
				name: 'Claude Code',
				cliPath: 'claude-sdk',
				acpArgs: [],
			}];

			// 更新下拉框
			this.agentSelectEl.empty();
			this.agentSelectEl.createEl('option', {
				text: 'Claude Code',
				value: 'claude',
			});

			// 默认选中
			this.agentSelectEl.value = 'claude';

			this.addSystemMessage('✓ Claude Code SDK 已就绪');
		} catch (error) {
			console.error('[ChatView] 加载 Agent 失败:', error);
			new Notice('加载 Agent 失败');
		}
	}

	/**
	 * 获取工作目录（完整健壮版本 - 基于官方 API 和最佳实践）
	 */
	private getWorkingDirectory(): string {
		// 1. 尝试从 Vault adapter 获取（使用官方 FileSystemAdapter.getBasePath()）
		try {
			const adapter = this.plugin.app.vault.adapter;

			// 使用官方 API：getBasePath() 方法
			if ('getBasePath' in adapter && typeof adapter.getBasePath === 'function') {
				const basePath = adapter.getBasePath();
				if (basePath && typeof basePath === 'string' && basePath.length > 0) {
					console.log('[ChatView] 使用 Vault 路径:', basePath);
					return this.validatePath(basePath);
				}
			}
		} catch (error) {
			console.warn('[ChatView] 无法获取 Vault 路径:', error);
		}

		// 2. 尝试使用用户自定义配置
		if (this.plugin.settings.customWorkingDir) {
			const customDir = this.plugin.settings.customWorkingDir;
			console.log('[ChatView] 使用自定义路径:', customDir);
			return this.validatePath(customDir);
		}

		// 3. 使用 process.cwd() 作为 fallback
		try {
			const cwd = process.cwd();
			if (cwd && typeof cwd === 'string' && cwd !== '/') {
				console.log('[ChatView] 使用 process.cwd():', cwd);
				return this.validatePath(cwd);
			}
		} catch (error) {
			console.warn('[ChatView] process.cwd() 失败:', error);
		}

		// 4. 抛出错误，不使用硬编码 fallback
		throw new Error('无法获取有效的工作目录。请在设置中手动配置工作目录。');
	}

	/**
	 * 验证并解析路径（确保绝对路径）
	 */
	private validatePath(inputPath: string): string {
		// 1. 转换为绝对路径
		const absolutePath = isAbsolute(inputPath) ? inputPath : resolve(inputPath);

		// 2. 验证目录存在
		if (!existsSync(absolutePath)) {
			throw new Error(`目录不存在: ${absolutePath}`);
		}

		// 3. 验证是目录（不是文件）
		try {
			const stats = statSync(absolutePath);
			if (!stats.isDirectory()) {
				throw new Error(`路径不是目录: ${absolutePath}`);
			}
		} catch (error) {
			throw new Error(`无法访问目录: ${absolutePath}`);
		}

		// 4. 解析符号链接（与 SDK 内部行为一致）
		try {
			const realPath = realpathSync(absolutePath);
			if (realPath !== absolutePath) {
				console.log(`[ChatView] 符号链接: ${absolutePath} → ${realPath}`);
			}
			return realPath;
		} catch (error) {
			console.warn(`[ChatView] 无法解析符号链接: ${error}`);
			return absolutePath;
		}
	}

	/**
	 * 处理连接按钮点击
	 */
	private async handleConnect(): Promise<void> {
		// 如果已连接，则断开
		if (this.connection?.isConnected || this.sdkConnection?.connected) {
			this.handleDisconnect();
			return;
		}

		// 使用 Claude SDK（固定为 claude）
		const agentId = 'claude';
		if (!agentId) {
			new Notice('请先选择一个 Agent');
			return;
		}

		this.selectedAgent = this.availableAgents.find((a) => a.backendId === agentId) || null;
		if (!this.selectedAgent) {
			new Notice('Agent 无效');
			return;
		}

		try {
			this.updateStatus('连接中...', 'connecting');
			this.connectButtonEl.disabled = true;

			// 判断是否使用 SDK 模式（目前只支持 claude）
			this.isSdkMode = this.selectedAgent.backendId === 'claude';

			if (this.isSdkMode) {
				// Claude SDK 模式
				await this.connectWithSdk();
			} else {
				// ACP 模式（其他 Agent）
				await this.connectWithAcp();
			}

			this.updateStatus('已连接', 'connected');
			this.connectButtonEl.textContent = '断开';
			this.connectButtonEl.disabled = false;
			this.setInputEnabled(true);

			this.addSystemMessage(`✅ 已连接到 ${this.selectedAgent.name}`);
			new Notice(`已连接到 ${this.selectedAgent.name}`);
		} catch (error) {
			console.error('[ChatView] 连接失败:', error);
			this.updateStatus('连接失败', 'error');
			this.connectButtonEl.disabled = false;
			this.addSystemMessage(`❌ 连接失败: ${error}`);
			new Notice('连接失败');
		}
	}

	/**
	 * 使用 ACP 模式连接
	 */
	private async connectWithAcp(): Promise<void> {
		if (!this.selectedAgent) return;

		// 创建连接
		this.connection = new AcpConnection();

		// 连接到 Agent
		const workingDir = this.getWorkingDirectory();
		await this.connection.connect({
			backendId: this.selectedAgent.backendId,
			cliPath: this.selectedAgent.cliPath,
			workingDir: workingDir,
			acpArgs: this.selectedAgent.acpArgs,
		});

		// 创建会话管理器
		this.sessionManager = new SessionManager({
			connection: this.connection,
			workingDir,
		});

		// 绑定会话回调
		this.setupSessionCallbacks();

		// 创建新会话
		await this.sessionManager.start();
	}

	/**
	 * 使用 Claude SDK 模式连接
	 */
	private async connectWithSdk(): Promise<void> {
		if (!this.selectedAgent) return;

		// 创建 SDK 连接
		this.sdkConnection = new ClaudeSdkConnection();

		// 连接（仅验证）
		const workingDir = this.getWorkingDirectory();
		await this.sdkConnection.connect({
			cwd: workingDir,
			model: 'claude-sonnet-4-5-20250929',
		});
	}

	/**
	 * 断开连接
	 */
	private handleDisconnect(): void {
		// 断开 ACP 连接
		if (this.sessionManager) {
			this.sessionManager.end();
			this.sessionManager = null;
		}

		if (this.connection) {
			this.connection.disconnect();
			this.connection = null;
		}

		// 断开 SDK 连接
		if (this.sdkConnection) {
			this.sdkConnection.disconnect();
			this.sdkConnection = null;
		}

		// 重置状态
		this.isSdkMode = false;
		this.currentStreamingMessageId = null;

		this.updateStatus('未连接', 'idle');
		this.connectButtonEl.textContent = '连接';
		this.setInputEnabled(false);

		this.addSystemMessage('已断开连接');
	}

	// ========================================================================
	// 会话管理
	// ========================================================================

	/**
	 * 设置会话回调
	 */
	private setupSessionCallbacks(): void {
		if (!this.sessionManager) return;

		// 消息更新
		this.sessionManager.onMessage = (message: Message, isNew: boolean) => {
			this.handleMessage(message, isNew);
		};

		// 工具调用
		this.sessionManager.onToolCall = (toolCall: ToolCall) => {
			this.handleToolCall(toolCall);
		};

		// 计划更新
		this.sessionManager.onPlan = (plan: PlanEntry[]) => {
			this.handlePlan(plan);
		};

		// 状态变更
		this.sessionManager.onStateChange = (state: SessionState) => {
			this.handleStateChange(state);
		};

		// 回合结束
		this.sessionManager.onTurnEnd = () => {
			this.handleTurnEnd();
		};

		// 权限请求
		this.sessionManager.onPermissionRequest = async (params: RequestPermissionParams) => {
			return await this.handlePermissionRequest(params);
		};

		// 错误
		this.sessionManager.onError = (error: Error) => {
			this.handleError(error);
		};
	}

	/**
	 * 处理消息
	 */
	private handleMessage(message: Message, isNew: boolean): void {
		if (isNew) {
			this.addMessage(message);
		} else {
			this.updateMessage(message);
		}
	}

	/**
	 * 处理工具调用
	 */
	private handleToolCall(toolCall: ToolCall): void {
		// 使用 MessageRenderer 渲染工具调用卡片
		MessageRenderer.renderToolCall(this.messagesEl, toolCall);
		this.scrollToBottom();
	}

	/**
	 * 处理计划更新
	 */
	private handlePlan(plan: PlanEntry[]): void {
		// 使用 MessageRenderer 渲染计划
		MessageRenderer.renderPlan(this.messagesEl, plan);
		this.scrollToBottom();
	}

	/**
	 * 处理状态变更
	 */
	private handleStateChange(state: SessionState): void {
		switch (state) {
			case 'processing':
				this.updateStatus('处理中...', 'processing');
				this.sendButtonEl.style.display = 'none';
				this.cancelButtonEl.style.display = 'inline-block';
				this.inputEl.disabled = true;
				break;

			case 'idle':
				this.updateStatus('已连接', 'connected');
				this.sendButtonEl.style.display = 'inline-block';
				this.cancelButtonEl.style.display = 'none';
				this.inputEl.disabled = false;
				break;

			case 'cancelled':
				this.addSystemMessage('⚠️ 已取消');
				break;
		}
	}

	/**
	 * 处理回合结束
	 */
	private handleTurnEnd(): void {
		// 自动滚动到底部
		this.scrollToBottom();
	}

	/**
	 * 处理错误
	 */
	private handleError(error: Error): void {
		console.error('[ChatView] 错误:', error);
		this.addSystemMessage(`❌ 错误: ${error.message}`);
		new Notice(`错误: ${error.message}`);
	}

	/**
	 * 处理权限请求
	 */
	private async handlePermissionRequest(params: RequestPermissionParams): Promise<PermissionOutcome> {
		console.log('[ChatView] 权限请求:', params);

		// 自动批准读取操作（如果设置启用）
		if (this.plugin.settings.autoApproveRead && isReadOperation(params)) {
			// 查找"允许一次"选项
			const allowOnceOption = params.options.find((opt) => opt.kind === 'allow_once');
			if (allowOnceOption) {
				console.log('[ChatView] 自动批准读取操作');
				this.addSystemMessage(`✓ 自动批准: ${params.toolCall.title || '读取操作'}`);
				return { type: 'selected', optionId: allowOnceOption.optionId };
			}
		}

		// 显示权限弹窗
		try {
			const modal = new PermissionModal(this.app, params);
			const outcome = await modal.show();

			// 记录用户选择
			if (outcome.type === 'selected') {
				const option = params.options.find((opt) => opt.optionId === outcome.optionId);
				if (option) {
					const action = option.kind.startsWith('allow') ? '✓ 已允许' : '✗ 已拒绝';
					this.addSystemMessage(`${action}: ${params.toolCall.title || '操作'}`);
				}
			} else {
				this.addSystemMessage(`⚠ 已取消: ${params.toolCall.title || '操作'}`);
			}

			return outcome;
		} catch (error) {
			console.error('[ChatView] 权限请求处理失败:', error);
			return { type: 'cancelled' };
		}
	}

	// ========================================================================
	// 用户操作
	// ========================================================================

	/**
	 * 处理发送
	 */
	private async handleSend(): Promise<void> {
		const text = this.inputEl.value.trim();
		if (!text) {
			return;
		}

		// 检查连接状态
		if (!this.isSdkMode && !this.sessionManager) {
			new Notice('未连接到 Agent');
			return;
		}

		if (this.isSdkMode && !this.sdkConnection) {
			new Notice('未连接到 Claude SDK');
			return;
		}

		// 清空输入框
		this.inputEl.value = '';

		try {
			if (this.isSdkMode) {
				// SDK 模式：使用 SDK 发送
				await this.sendWithSdk(text);
			} else {
				// ACP 模式：使用 SessionManager 发送
				await this.sessionManager!.sendPrompt(text);
			}
		} catch (error) {
			console.error('[ChatView] 发送失败:', error);
			new Notice('发送失败');
		}
	}

	/**
	 * 处理取消
	 */
	private async handleCancel(): Promise<void> {
		if (this.isSdkMode && this.sdkConnection) {
			// SDK 模式：取消 SDK 查询
			try {
				await this.sdkConnection.cancel();
			} catch (error) {
				console.error('[ChatView] SDK 取消失败:', error);
			}
		} else if (this.sessionManager) {
			// ACP 模式：取消会话
			try {
				await this.sessionManager.cancel();
			} catch (error) {
				console.error('[ChatView] 取消失败:', error);
			}
		}
	}

	// ========================================================================
	// SDK 模式专用方法
	// ========================================================================

	/**
	 * 使用 SDK 发送消息
	 */
	private async sendWithSdk(text: string): Promise<void> {
		if (!this.sdkConnection) return;

		// 添加用户消息
		this.addUserMessage(text);

		// 创建新的助手消息（流式）
		const messageId = `assistant-${Date.now()}`;
		this.currentStreamingMessageId = messageId;
		this.addAssistantMessagePlaceholder(messageId);

		// 更新状态
		this.updateStatus('处理中...', 'processing');
		this.sendButtonEl.style.display = 'none';
		this.cancelButtonEl.style.display = 'inline-block';
		this.inputEl.disabled = true;

		// 获取工作目录
		const workingDir = this.getWorkingDirectory();

		// 构建 SDK 回调
		const callbacks: ClaudeCallbacks = {
			onText: (text: string, isStreaming: boolean) => {
				this.handleSdkText(messageId, text, isStreaming);
			},
			onToolUse: (toolName: string, input: any, toolUseId: string) => {
				this.handleSdkToolUse(toolName, input, toolUseId);
			},
			onToolResult: (toolUseId: string, result: any, isError: boolean) => {
				this.handleSdkToolResult(toolUseId, result, isError);
			},
			onError: (error: Error) => {
				this.handleSdkError(error);
			},
			onComplete: (result: string, cost: number) => {
				this.handleSdkComplete(result, cost);
			},
			onPermissionRequest: async (toolName: string, input: any) => {
				return await this.handleSdkPermissionRequest(toolName, input);
			},
		};

		// 发送提示
		try {
			await this.sdkConnection.sendPrompt(
				text,
				{
					cwd: workingDir,
					model: 'claude-sonnet-4-5-20250929',
					apiKey: this.plugin.settings.apiKey, // 自定义 API Key
					apiUrl: this.plugin.settings.apiUrl, // 自定义 API URL
				},
				callbacks,
			);
		} catch (error) {
			console.error('[ChatView] SDK 发送失败:', error);
			this.handleSdkError(error as Error);
		}
	}

	/**
	 * 处理 SDK 文本消息
	 */
	private handleSdkText(messageId: string, text: string, isStreaming: boolean): void {
		const messageEl = this.messagesEl.querySelector(`[data-message-id="${messageId}"]`);
		if (!messageEl) return;

		const contentEl = messageEl.querySelector('.acp-message-content') as HTMLElement;
		if (!contentEl) return;

		if (isStreaming && text) {
			// 流式更新：追加文本
			contentEl.textContent = (contentEl.textContent || '') + text;
		}

		this.scrollToBottom();
	}

	/**
	 * 处理 SDK 工具调用
	 */
	private handleSdkToolUse(toolName: string, input: any, toolUseId: string): void {
		// 创建类似 ACP 的 ToolCall 结构
		const toolCall: ToolCall = {
			toolCallId: toolUseId,
			title: `工具调用: ${toolName}`,
			kind: toolName,
			status: 'in_progress',
			startTime: Date.now(),
		};

		MessageRenderer.renderToolCall(this.messagesEl, toolCall);
		this.scrollToBottom();
	}

	/**
	 * 处理 SDK 工具结果
	 */
	private handleSdkToolResult(toolUseId: string, result: any, isError: boolean): void {
		// 查找对应的工具调用卡片，更新状态
		const toolCard = this.messagesEl.querySelector(`[data-tool-id="${toolUseId}"]`);
		if (toolCard) {
			toolCard.classList.remove('acp-tool-pending');
			if (isError) {
				toolCard.classList.add('acp-tool-error');
			} else {
				toolCard.classList.add('acp-tool-completed');
			}
		}
		this.scrollToBottom();
	}

	/**
	 * 处理 SDK 错误
	 */
	private handleSdkError(error: Error): void {
		console.error('[ChatView] SDK 错误:', error);
		this.addSystemMessage(`❌ 错误: ${error.message}`);
		new Notice(`错误: ${error.message}`);

		// 恢复 UI 状态
		this.updateStatus('已连接', 'connected');
		this.sendButtonEl.style.display = 'inline-block';
		this.cancelButtonEl.style.display = 'none';
		this.inputEl.disabled = false;
	}

	/**
	 * 处理 SDK 完成
	 */
	private handleSdkComplete(result: string, cost: number): void {
		console.log(`[ChatView] SDK 完成 (费用: $${cost.toFixed(4)})`);

		// 恢复 UI 状态
		this.updateStatus('已连接', 'connected');
		this.sendButtonEl.style.display = 'inline-block';
		this.cancelButtonEl.style.display = 'none';
		this.inputEl.disabled = false;
		this.currentStreamingMessageId = null;

		this.scrollToBottom();
	}

	/**
	 * 处理 SDK 权限请求
	 */
	private async handleSdkPermissionRequest(toolName: string, input: any): Promise<any> {
		// 将 SDK 权限请求转换为 ACP 格式
		const params: RequestPermissionParams = {
			sessionId: 'sdk-session',
			toolCall: {
				toolCallId: `sdk-${Date.now()}`,
				title: `工具调用: ${toolName}`,
				kind: 'execute', // 或根据工具名映射到正确的类型
				rawInput: input,
			},
			options: [
				{
					optionId: 'allow-once',
					name: '允许一次',
					kind: 'allow_once',
				},
				{
					optionId: 'reject',
					name: '拒绝',
					kind: 'reject_once',
				},
			],
		};

		// 使用现有的权限处理逻辑
		const outcome = await this.handlePermissionRequest(params);

		// 转换为 SDK 格式
		if (outcome.type === 'selected' && outcome.optionId === 'allow-once') {
			return {
				behavior: 'allow',
				updatedInput: input,
			};
		} else {
			return {
				behavior: 'deny',
			};
		}
	}

	/**
	 * 添加用户消息（SDK 模式专用）
	 */
	private addUserMessage(text: string): void {
		const messageEl = this.messagesEl.createDiv({ cls: 'acp-message acp-message-user' });
		const contentEl = messageEl.createDiv({ cls: 'acp-message-content' });
		contentEl.textContent = text;
		this.scrollToBottom();
	}

	/**
	 * 添加助手消息占位符（SDK 模式专用）
	 */
	private addAssistantMessagePlaceholder(messageId: string): void {
		const messageEl = this.messagesEl.createDiv({ cls: 'acp-message acp-message-assistant' });
		messageEl.setAttribute('data-message-id', messageId);
		const contentEl = messageEl.createDiv({ cls: 'acp-message-content' });
		contentEl.textContent = ''; // 空内容，等待流式更新
		this.scrollToBottom();
	}

	// ========================================================================
	// 消息渲染
	// ========================================================================

	/**
	 * 添加系统消息
	 */
	private addSystemMessage(text: string): void {
		const messageEl = this.messagesEl.createDiv({ cls: 'acp-message acp-message-system' });
		const contentEl = messageEl.createDiv({ cls: 'acp-message-content' });
		contentEl.textContent = text;

		this.scrollToBottom();
	}

	/**
	 * 添加消息
	 */
	private async addMessage(message: Message): Promise<void> {
		// 使用 MessageRenderer 渲染
		await MessageRenderer.renderMessage(this.messagesEl, message, this.markdownComponent, this.app);
		this.scrollToBottom();
	}

	/**
	 * 更新消息
	 */
	private async updateMessage(message: Message): Promise<void> {
		// 使用 MessageRenderer 更新
		await MessageRenderer.updateMessage(this.messagesEl, message, this.markdownComponent, this.app);
		this.scrollToBottom();
	}

	// ========================================================================
	// UI 辅助方法
	// ========================================================================

	/**
	 * 更新状态指示器
	 */
	private updateStatus(text: string, state: 'idle' | 'connecting' | 'connected' | 'processing' | 'error'): void {
		this.statusEl.textContent = text;
		this.statusEl.className = `acp-status acp-status-${state}`;
	}

	/**
	 * 设置输入区域启用状态
	 */
	private setInputEnabled(enabled: boolean): void {
		this.inputEl.disabled = !enabled;
		this.sendButtonEl.disabled = !enabled;
	}

	/**
	 * 滚动到底部
	 */
	private scrollToBottom(): void {
		this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
	}
}
