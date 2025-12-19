/**
 * ACP ChatView - 聊天视图
 *
 * 提供与 AI Agent 交互的侧边栏界面
 */

import type { WorkspaceLeaf } from 'obsidian';
import { ItemView, Notice, Component, setIcon } from 'obsidian';
import type AcpPlugin from '../main';
import { SessionManager } from '../acp/core/session-manager';
import { AcpConnection } from '../acp/core/connection';
import type { Message, ToolCall, PlanEntry, SessionState } from '../acp/core/session-manager';
import type { DetectedAgent } from '../acp/detector';
import { PermissionModal } from './PermissionModal';
import type { RequestPermissionParams, PermissionOutcome } from '../acp/types/permissions';
import { MessageRenderer } from './MessageRenderer';

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

	// ACP 核心
	private connection: AcpConnection | null = null;
	private sessionManager: SessionManager | null = null;

	// Agent 信息
	private availableAgents: DetectedAgent[] = [];
	private selectedAgent: DetectedAgent | null = null;

	// 会话状态
	private currentMode: string | null = null;
	private availableCommands: any[] = [];

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
	private modeIndicatorEl!: HTMLElement;

	// Turn 容器管理
	private currentTurnContainer: HTMLElement | null = null;

	// 智能滚动
	private scrollToBottomButton: HTMLElement | null = null;

	// Phase 4: 输入历史
	private inputHistory: string[] = [];
	private inputHistoryIndex: number = -1;

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

		// 连接状态栏（Phase 4 增强）
		this.statusEl = this.headerEl.createDiv({ cls: 'acp-connection-status' });
		this.updateConnectionStatus('disconnected');

		// 模式指示器
		this.modeIndicatorEl = this.headerEl.createDiv({ cls: 'acp-mode-indicator' });
		this.modeIndicatorEl.style.display = 'none'; // 初始隐藏
	}

	/**
	 * 创建消息区域
	 */
	private createMessagesArea(container: HTMLElement): void {
		const messagesContainer = container.createDiv({ cls: 'acp-messages-container' });

		this.messagesEl = messagesContainer.createDiv({ cls: 'acp-chat-messages' });

		// 欢迎消息
		this.addSystemMessage('欢迎使用 ACP Agent Client!\n请选择一个 Agent 并连接。');

		// "跳到最新"按钮
		this.scrollToBottomButton = messagesContainer.createDiv({
			cls: 'acp-scroll-to-bottom',
			attr: { 'aria-label': '跳到最新' },
		});
		this.scrollToBottomButton.style.display = 'none';
		setIcon(this.scrollToBottomButton, 'arrow-down');

		this.scrollToBottomButton.addEventListener('click', () => {
			this.forceScrollToBottom();
		});

		// 滚动监听
		this.messagesEl.addEventListener('scroll', () => {
			this.updateScrollButton();
		});
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

		// Phase 4: 增强键盘交互
		this.inputEl.addEventListener('keydown', (e) => {
			// Enter 发送（Shift+Enter 换行）
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				this.handleSend();
			}

			// 上下键导航历史消息
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				this.navigateInputHistory('up');
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				this.navigateInputHistory('down');
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
			// 使用 detector 检测可用的 Agent
			await this.plugin.detector.detect();
			this.availableAgents = this.plugin.detector.getDetectedAgents();

			// 更新下拉框
			this.agentSelectEl.empty();

			if (this.availableAgents.length === 0) {
				this.agentSelectEl.createEl('option', {
					text: '未找到可用 Agent',
					value: '',
				});
				this.addSystemMessage('⚠️ 未找到可用 Agent，请检查配置');
			} else {
				this.agentSelectEl.createEl('option', {
					text: '选择 Agent...',
					value: '',
				});

				for (const agent of this.availableAgents) {
					this.agentSelectEl.createEl('option', {
						text: agent.name,
						value: agent.backendId,
					});
				}

				this.addSystemMessage(`✓ 找到 ${this.availableAgents.length} 个可用 Agent`);
			}
		} catch (error) {
			console.error('[ChatView] 加载 Agent 失败:', error);
			new Notice('加载 Agent 失败');
		}
	}

	/**
	 * 获取工作目录
	 */
	private getWorkingDirectory(): string {
		// 使用官方 API
		try {
			const adapter = this.plugin.app.vault.adapter;
			if ('getBasePath' in adapter && typeof adapter.getBasePath === 'function') {
				const basePath = adapter.getBasePath();
				if (basePath) {
					return basePath;
				}
			}
		} catch (error) {
			console.warn('[ChatView] Vault API 失败:', error);
		}

		// Fallback
		if (this.plugin.settings.customWorkingDir) {
			return this.plugin.settings.customWorkingDir;
		}

		const cwd = process.cwd();
		if (cwd && cwd !== '/') {
			return cwd;
		}

		throw new Error('无法获取工作目录');
	}

	/**
	 * 处理连接按钮点击
	 */
	private async handleConnect(): Promise<void> {
		// 如果已连接，则断开
		if (this.connection?.isConnected) {
			this.handleDisconnect();
			return;
		}

		// 获取选中的 Agent
		const agentId = this.agentSelectEl.value;
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
			this.updateConnectionStatus('connecting', this.selectedAgent.name);
			this.connectButtonEl.disabled = true;

			// 使用 ACP 模式连接
			await this.connectWithAcp();

			this.updateConnectionStatus('connected', this.selectedAgent.name);
			this.connectButtonEl.textContent = '断开';
			this.connectButtonEl.disabled = false;
			this.setInputEnabled(true);

			this.addSystemMessage(`✅ 已连接到 ${this.selectedAgent.name}`);
			new Notice(`已连接到 ${this.selectedAgent.name}`);
		} catch (error) {
			console.error('[ChatView] 连接失败:', error);
			this.updateConnectionStatus('error');
			this.connectButtonEl.disabled = false;

			// Phase 4: 友好化错误提示
			this.showFriendlyError(error as Error, 'connection');
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

		// 注意：传入检测到的 cliPath，让 connection 使用正确的 wrapper
		await this.connection.connect({
			backendId: this.selectedAgent.backendId,
			cliPath: this.selectedAgent.cliPath, // 使用检测到的 wrapper
			workingDir: workingDir,
			acpArgs: this.selectedAgent.acpArgs,
			app: this.app,
			permissionSettings: this.plugin.settings.permission,
			saveSettings: async () => {
				await this.plugin.saveSettings();
			},
			mcpServers: this.plugin.settings.mcpServers,
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

		this.updateConnectionStatus('disconnected');
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

		// 思考块更新
		this.sessionManager.onThought = (thought: string) => {
			this.handleThought(thought);
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

		// 当前模式更新
		this.sessionManager.onCurrentModeUpdate = (mode: string, description?: string) => {
			this.handleCurrentModeUpdate(mode, description);
		};

		// 可用命令更新
		this.sessionManager.onAvailableCommandsUpdate = (commands: any[]) => {
			this.handleAvailableCommandsUpdate(commands);
		};
	}

	/**
	 * 获取或创建当前 turn 的容器
	 */
	private getTurnContainer(): HTMLElement {
		if (!this.currentTurnContainer) {
			this.currentTurnContainer = this.messagesEl.createDiv({
				cls: 'acp-turn-container',
				attr: { 'data-turn-id': `turn-${Date.now()}` },
			});
		}
		return this.currentTurnContainer;
	}

	/**
	 * 处理消息
	 */
	private handleMessage(message: Message, isNew: boolean): void {
		const container = this.getTurnContainer();

		if (isNew) {
			this.addMessage(message, container);
		} else {
			this.updateMessage(message, container);
		}
	}

	/**
	 * 处理工具调用
	 */
	private handleToolCall(toolCall: ToolCall): void {
		const container = this.getTurnContainer();

		// 获取或创建工具调用组容器
		let toolsContainer = container.querySelector('.acp-turn-tools') as HTMLElement;
		if (!toolsContainer) {
			toolsContainer = container.createDiv({ cls: 'acp-turn-tools' });
		}

		// 使用 MessageRenderer 渲染工具调用卡片
		MessageRenderer.renderToolCall(toolsContainer, toolCall, this.app);
		this.smartScroll();
	}

	/**
	 * 处理计划更新
	 */
	private handlePlan(plan: PlanEntry[]): void {
		const container = this.getTurnContainer();

		// 使用 MessageRenderer 渲染计划（在 turn 容器内）
		MessageRenderer.renderPlan(container, plan);
		this.smartScroll();
	}

	/**
	 * 处理思考块
	 */
	private handleThought(thought: string): void {
		if (!this.sessionManager) return;

		const turn = this.sessionManager.activeTurn;
		if (!turn) return;

		const container = this.getTurnContainer();

		// 使用 MessageRenderer 渲染思考块（在 turn 容器内）
		MessageRenderer.renderThoughts(container, turn.thoughts);
		this.smartScroll();
	}

	/**
	 * 处理状态变更
	 */
	private handleStateChange(state: SessionState): void {
		switch (state) {
			case 'processing':
				this.updateConnectionStatus('connected', this.selectedAgent?.name);
				this.sendButtonEl.style.display = 'none';
				this.cancelButtonEl.style.display = 'inline-block';
				this.inputEl.disabled = true;
				break;

			case 'idle':
				this.updateConnectionStatus('connected', this.selectedAgent?.name);
				this.sendButtonEl.style.display = 'inline-block';
				this.cancelButtonEl.style.display = 'none';
				this.inputEl.disabled = false;
				// Phase 4: 重置发送状态
				this.setInputSending(false);
				break;

			case 'cancelled':
				this.addSystemMessage('⚠️ 已取消');
				// Phase 4: 重置发送状态
				this.setInputSending(false);
				break;
		}
	}

	/**
	 * 处理回合结束
	 */
	private handleTurnEnd(): void {
		// 重置 turn 容器，为下一个回合准备
		this.currentTurnContainer = null;

		// 自动滚动到底部
		this.smartScroll();
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

		// 显示权限弹窗
		return new Promise((resolve) => {
			try {
				const modal = new PermissionModal(
					this.app,
					{
						toolCallId: params.toolCall?.toolCallId || '',
						toolName: params.toolCall?.kind || '',
						title: params.toolCall?.title || '',
						kind: params.toolCall?.kind || '',
						rawInput: params.toolCall?.rawInput || {},
					},
					(response) => {
						// 记录用户选择
						if (response.outcome === 'selected') {
							const actionText = response.optionId?.includes('reject')
								? '✗ 已拒绝'
								: '✓ 已允许';
							this.addSystemMessage(`${actionText}: ${params.toolCall.title || '操作'}`);
						} else {
							this.addSystemMessage(`⚠ 已取消: ${params.toolCall.title || '操作'}`);
						}

						// 转换为 ACP 协议格式
						if (response.outcome === 'cancelled') {
							resolve({ type: 'cancelled' });
						} else {
							resolve({ type: 'selected', optionId: response.optionId || 'reject-once' });
						}
					},
				);
				modal.open();
			} catch (error) {
				console.error('[ChatView] 权限请求处理失败:', error);
				resolve({ type: 'cancelled' });
			}
		});
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
		if (!this.sessionManager) {
			new Notice('未连接到 Agent');
			return;
		}

		// Phase 4: 保存到历史
		this.addToInputHistory(text);

		// 清空输入框
		this.inputEl.value = '';

		// Phase 4: 显示发送状态
		this.setInputSending(true);

		try {
			// 使用 SessionManager 发送
			await this.sessionManager.sendPrompt(text);
		} catch (error) {
			console.error('[ChatView] 发送失败:', error);
			this.showFriendlyError(error as Error, 'send');
			this.setInputSending(false);
		}
	}

	/**
	 * 设置输入框发送状态（Phase 4）
	 */
	private setInputSending(sending: boolean): void {
		if (sending) {
			this.inputEl.disabled = true;
			this.sendButtonEl.disabled = true;
			this.sendButtonEl.textContent = '发送中...';
		} else {
			this.inputEl.disabled = false;
			this.sendButtonEl.disabled = false;
			this.sendButtonEl.textContent = '发送';
		}
	}

	/**
	 * 处理取消
	 */
	private async handleCancel(): Promise<void> {
		if (this.sessionManager) {
			try {
				await this.sessionManager.cancel();
			} catch (error) {
				console.error('[ChatView] 取消失败:', error);
			}
		}
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

		this.smartScroll();
	}

	/**
	 * 添加消息
	 */
	private async addMessage(message: Message, container?: HTMLElement): Promise<void> {
		const target = container || this.messagesEl;
		// 使用 MessageRenderer 渲染
		await MessageRenderer.renderMessage(target, message, this.markdownComponent, this.app);
		this.smartScroll();
	}

	/**
	 * 更新消息
	 */
	private async updateMessage(message: Message, container?: HTMLElement): Promise<void> {
		const target = container || this.messagesEl;
		// 使用 MessageRenderer 更新
		await MessageRenderer.updateMessage(target, message, this.markdownComponent, this.app);
		this.smartScroll();
	}

	// ========================================================================
	// UI 辅助方法
	// ========================================================================

	/**
	 * 更新连接状态栏（Phase 4 增强）
	 */
	private updateConnectionStatus(state: 'disconnected' | 'connecting' | 'connected' | 'error', agentName?: string): void {
		this.statusEl.empty();
		this.statusEl.className = `acp-connection-status acp-connection-status-${state}`;

		// 状态图标
		const iconEl = this.statusEl.createDiv({ cls: 'acp-connection-status-icon' });

		let iconName: string;
		let text: string;

		switch (state) {
			case 'disconnected':
				iconName = 'circle';
				text = '未连接 Agent';
				break;
			case 'connecting':
				iconName = 'loader-2';
				text = `正在连接 ${agentName || 'Agent'}...`;
				iconEl.addClass('acp-spinner');
				break;
			case 'connected':
				iconName = 'check-circle';
				text = `已连接: ${agentName || 'Agent'}`;
				break;
			case 'error':
				iconName = 'x-circle';
				text = '连接失败';
				break;
		}

		setIcon(iconEl, iconName);

		// 状态文本
		this.statusEl.createDiv({
			cls: 'acp-connection-status-text',
			text: text,
		});
	}


	/**
	 * 设置输入区域启用状态
	 */
	private setInputEnabled(enabled: boolean): void {
		this.inputEl.disabled = !enabled;
		this.sendButtonEl.disabled = !enabled;
	}

	/**
	 * 判断是否接近底部
	 */
	private isNearBottom(threshold: number = 100): boolean {
		const { scrollTop, scrollHeight, clientHeight } = this.messagesEl;
		return scrollTop + clientHeight >= scrollHeight - threshold;
	}

	/**
	 * 智能滚动（仅在用户接近底部时自动滚动）
	 */
	private smartScroll(): void {
		if (this.isNearBottom()) {
			this.forceScrollToBottom();
		}
		this.updateScrollButton();
	}

	/**
	 * 强制滚动到底部
	 */
	private forceScrollToBottom(): void {
		this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
		this.updateScrollButton();
	}

	/**
	 * 更新"跳到最新"按钮的显示状态
	 */
	private updateScrollButton(): void {
		if (!this.scrollToBottomButton) return;

		if (this.isNearBottom(50)) {
			this.scrollToBottomButton.style.display = 'none';
		} else {
			this.scrollToBottomButton.style.display = 'flex';
		}
	}

	/**
	 * 处理当前模式更新
	 */
	private handleCurrentModeUpdate(mode: string, description?: string): void {
		console.log('[ChatView] 模式更新:', mode, description);
		this.currentMode = mode;

		// 更新模式指示器
		this.modeIndicatorEl.style.display = 'block';
		this.modeIndicatorEl.textContent = description ? `${mode}: ${description}` : mode;

		// 根据模式设置不同颜色
		this.modeIndicatorEl.className = 'acp-mode-indicator';
		if (mode === 'ask') {
			this.modeIndicatorEl.classList.add('acp-mode-ask');
		} else if (mode === 'code') {
			this.modeIndicatorEl.classList.add('acp-mode-code');
		} else if (mode === 'plan') {
			this.modeIndicatorEl.classList.add('acp-mode-plan');
		} else {
			this.modeIndicatorEl.classList.add('acp-mode-default');
		}
	}

	/**
	 * 处理可用命令更新
	 */
	private handleAvailableCommandsUpdate(commands: any[]): void {
		console.log('[ChatView] 可用命令更新:', commands.length, '个命令');
		this.availableCommands = commands;

		// 在输入框上方显示可用命令按钮
		if (commands.length > 0) {
			this.renderAvailableCommands(commands);
		} else {
			// 移除旧的命令栏
			const oldCommandsBar = this.inputContainerEl.querySelector('.acp-available-commands-bar');
			if (oldCommandsBar) oldCommandsBar.remove();
		}
	}

	/**
	 * 渲染可用命令按钮栏
	 */
	private renderAvailableCommands(commands: any[]): void {
		// 移除旧的命令栏
		const oldCommandsBar = this.inputContainerEl.querySelector('.acp-available-commands-bar');
		if (oldCommandsBar) oldCommandsBar.remove();

		// 创建新的命令栏（在输入框之前）
		const commandsBar = this.inputContainerEl.createDiv({ cls: 'acp-available-commands-bar' });

		// 标题
		const titleEl = commandsBar.createDiv({ cls: 'acp-commands-bar-title' });
		const iconEl = titleEl.createDiv({ cls: 'acp-commands-bar-icon' });
		setIcon(iconEl, 'zap');
		titleEl.createDiv({ cls: 'acp-commands-bar-text', text: '快捷命令' });

		// 命令按钮容器
		const buttonsContainer = commandsBar.createDiv({ cls: 'acp-commands-bar-buttons' });

		for (const cmd of commands) {
			const cmdButton = buttonsContainer.createEl('button', {
				cls: 'acp-command-button',
			});

			// 命令图标
			const cmdIconEl = cmdButton.createDiv({ cls: 'acp-command-button-icon' });
			setIcon(cmdIconEl, 'terminal');

			// 命令名称
			cmdButton.createDiv({
				cls: 'acp-command-button-text',
				text: `/${cmd.name}`,
			});

			// 点击事件
			cmdButton.addEventListener('click', () => {
				this.handleCommandClick(cmd);
			});

			// 悬停提示
			cmdButton.setAttribute('aria-label', cmd.description || cmd.name);
		}

		// 将命令栏移动到输入框之前
		this.inputContainerEl.insertBefore(commandsBar, this.inputEl);
	}

	/**
	 * 处理命令按钮点击
	 */
	private async handleCommandClick(command: any): Promise<void> {
		// 如果命令有输入提示，弹出输入框
		if (command.input && command.input.hint) {
			// 预填充输入框
			this.inputEl.value = `/${command.name} ${command.input.hint}`;
			this.inputEl.focus();

			// 选中 hint 部分，方便用户替换
			const hintStart = `/${command.name} `.length;
			this.inputEl.setSelectionRange(hintStart, this.inputEl.value.length);
		} else {
			// 直接发送命令
			this.inputEl.value = `/${command.name}`;
			await this.handleSend();
		}
	}

	// ========================================================================
	// Phase 4: UI/UX 增强方法
	// ========================================================================

	/**
	 * 导航输入历史（Phase 4）
	 */
	private navigateInputHistory(direction: 'up' | 'down'): void {
		if (this.inputHistory.length === 0) {
			return;
		}

		if (direction === 'up') {
			// 上键：向旧消息移动
			if (this.inputHistoryIndex < this.inputHistory.length - 1) {
				this.inputHistoryIndex++;
			}
		} else {
			// 下键：向新消息移动
			if (this.inputHistoryIndex > -1) {
				this.inputHistoryIndex--;
			}
		}

		// 更新输入框
		if (this.inputHistoryIndex === -1) {
			this.inputEl.value = '';
		} else {
			this.inputEl.value = this.inputHistory[this.inputHistoryIndex];
		}

		// 光标移到末尾
		this.inputEl.setSelectionRange(this.inputEl.value.length, this.inputEl.value.length);
	}

	/**
	 * 添加到输入历史（Phase 4）
	 */
	private addToInputHistory(text: string): void {
		// 避免重复
		if (this.inputHistory[0] === text) {
			return;
		}

		// 添加到开头
		this.inputHistory.unshift(text);

		// 限制历史数量（最多 50 条）
		if (this.inputHistory.length > 50) {
			this.inputHistory.pop();
		}

		// 重置索引
		this.inputHistoryIndex = -1;
	}

	/**
	 * 显示友好化错误提示（Phase 4）
	 */
	private showFriendlyError(error: Error, context: 'connection' | 'send' | 'tool'): void {
		const errorMessage = error.message || '未知错误';
		let friendlyMessage = '';
		let suggestions: string[] = [];

		// 根据上下文和错误类型提供友好提示
		if (context === 'connection') {
			if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
				friendlyMessage = 'Agent CLI 未安装或路径不正确';
				suggestions = [
					'1. 检查 Agent 是否已安装',
					'2. 运行安装命令（参见设置页面）',
					'3. 重启 Obsidian',
				];
			} else if (errorMessage.includes('EACCES') || errorMessage.includes('permission')) {
				friendlyMessage = '权限不足';
				suggestions = [
					'1. 检查文件/目录权限',
					'2. 使用 sudo 重新安装 CLI',
					'3. 检查安全设置',
				];
			} else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
				friendlyMessage = '连接超时';
				suggestions = [
					'1. 检查网络连接',
					'2. 检查 Agent 服务状态',
					'3. 增加超时时间（设置页面）',
				];
			} else {
				friendlyMessage = '连接失败';
				suggestions = [
					'1. 查看详细错误信息',
					'2. 检查 Agent 配置',
					'3. 查看控制台日志（Ctrl+Shift+I）',
				];
			}
		} else if (context === 'send') {
			friendlyMessage = '消息发送失败';
			suggestions = [
				'1. 检查连接状态',
				'2. 重试发送',
				'3. 重新连接 Agent',
			];
		} else if (context === 'tool') {
			friendlyMessage = '工具调用失败';
			suggestions = [
				'1. 检查权限设置',
				'2. 检查文件路径',
				'3. 查看详细错误信息',
			];
		}

		// 在 ChatView 中显示错误卡片
		const errorEl = this.messagesEl.createDiv({ cls: 'acp-error-card' });

		// 错误图标和标题
		const headerEl = errorEl.createDiv({ cls: 'acp-error-header' });
		const iconEl = headerEl.createDiv({ cls: 'acp-error-icon' });
		setIcon(iconEl, 'alert-circle');
		headerEl.createDiv({ cls: 'acp-error-title', text: friendlyMessage });

		// 详细错误信息
		const detailEl = errorEl.createDiv({ cls: 'acp-error-detail' });
		detailEl.createDiv({ cls: 'acp-error-message', text: errorMessage });

		// 解决方案
		if (suggestions.length > 0) {
			const solutionsEl = errorEl.createDiv({ cls: 'acp-error-solutions' });
			solutionsEl.createDiv({ cls: 'acp-error-solutions-title', text: '解决方法:' });

			const listEl = solutionsEl.createEl('ul');
			for (const suggestion of suggestions) {
				listEl.createEl('li', { text: suggestion });
			}
		}

		// Obsidian Notice
		new Notice(`❌ ${friendlyMessage}`);

		// 自动滚动
		this.smartScroll();
	}
}
