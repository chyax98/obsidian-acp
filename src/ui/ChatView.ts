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
import type { AvailableCommand } from '../acp/types/updates';
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
	private availableCommands: AvailableCommand[] = [];

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
	private newChatButtonEl!: HTMLButtonElement;
	private statusIndicatorEl!: HTMLElement;

	// 空状态引导
	private emptyStateEl: HTMLElement | null = null;

	// Turn 容器管理
	private currentTurnContainer: HTMLElement | null = null;

	// 智能滚动
	private scrollToBottomButton: HTMLElement | null = null;
	private scrollDebounceTimer: NodeJS.Timeout | null = null;
	private pendingScroll: boolean = false;

	// 首条消息标记（用于注入 Obsidian 上下文）
	private isFirstMessage: boolean = true;

	// Phase 4: 输入历史
	private inputHistory: string[] = [];
	private inputHistoryIndex: number = -1;

	// 斜杠命令菜单
	private commandMenuEl: HTMLElement | null = null;
	private commandMenuSelectedIndex: number = -1;

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
	public getViewType(): string {
		return ACP_CHAT_VIEW_TYPE;
	}

	/**
	 * 显示文本
	 */
	public getDisplayText(): string {
		return 'ACP Chat';
	}

	/**
	 * 图标
	 */
	public getIcon(): string {
		return 'bot';
	}

	/**
	 * 打开视图
	 */
	public async onOpen(): Promise<void> {
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
	// eslint-disable-next-line @typescript-eslint/require-await
	public async onClose(): Promise<void> {
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
	 * 创建头部区域（紧凑版）
	 */
	private createHeader(container: HTMLElement): void {
		this.headerEl = container.createDiv({ cls: 'acp-chat-header-compact' });

		// 左侧：状态指示器 + Agent 选择器
		const leftSection = this.headerEl.createDiv({ cls: 'acp-header-left' });

		// 连接状态指示器（小圆点）
		this.statusIndicatorEl = leftSection.createDiv({
			cls: 'acp-status-dot acp-status-disconnected',
			attr: { 'aria-label': '未连接' },
		});

		// Agent 下拉框
		this.agentSelectEl = leftSection.createEl('select', { cls: 'acp-agent-select-compact' });
		this.agentSelectEl.createEl('option', {
			text: '选择 Agent...',
			value: '',
		});

		// 右侧：按钮组
		const rightSection = this.headerEl.createDiv({ cls: 'acp-header-right' });

		// 新对话按钮
		this.newChatButtonEl = rightSection.createEl('button', {
			cls: 'acp-new-chat-btn clickable-icon',
			attr: { 'aria-label': '新对话' },
		});
		setIcon(this.newChatButtonEl, 'plus');
		this.newChatButtonEl.addEventListener('click', () => {
			void this.handleNewChat();
		});

		// 连接按钮
		this.connectButtonEl = rightSection.createEl('button', {
			cls: 'acp-connect-btn',
			text: '连接',
		});
		this.connectButtonEl.addEventListener('click', () => {
			void this.handleConnect();
		});
	}

	/**
	 * 创建消息区域
	 */
	private createMessagesArea(container: HTMLElement): void {
		const messagesContainer = container.createDiv({ cls: 'acp-messages-container' });

		this.messagesEl = messagesContainer.createDiv({ cls: 'acp-chat-messages' });

		// 简洁的空状态引导（Zed/Cursor 风格）
		this.showEmptyState();

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
				placeholder: '输入消息，/ 查看命令',
				rows: '3',
			},
		});

		// Phase 4: 增强键盘交互
		this.inputEl.addEventListener('keydown', (e) => {
			// 如果命令菜单显示中
			if (this.commandMenuEl) {
				if (e.key === 'ArrowUp') {
					e.preventDefault();
					this.navigateCommandMenu('up');
					return;
				} else if (e.key === 'ArrowDown') {
					e.preventDefault();
					this.navigateCommandMenu('down');
					return;
				} else if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					void this.selectCommand();
					return;
				} else if (e.key === 'Escape') {
					e.preventDefault();
					this.hideCommandMenu();
					return;
				}
			}

			// Enter 发送（Shift+Enter 换行）
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				void this.handleSend();
			}

			// 上下键导航历史消息（仅在菜单未显示时）
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				this.navigateInputHistory('up');
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				this.navigateInputHistory('down');
			}
		});

		// 监听输入变化，检测斜杠命令
		this.inputEl.addEventListener('input', () => {
			const value = this.inputEl.value;
			
			// 检测是否输入斜杠
			if (value.startsWith('/')) {
				const filter = value.slice(1); // 去掉斜杠
				this.showCommandMenu(filter);
			} else {
				this.hideCommandMenu();
			}
		});

		// 按钮容器
		const buttonContainer = this.inputContainerEl.createDiv({ cls: 'acp-input-buttons' });

		// 发送按钮
		this.sendButtonEl = buttonContainer.createEl('button', {
			cls: 'acp-send-button mod-cta',
			text: '发送',
		});
		this.sendButtonEl.addEventListener('click', () => {
			void this.handleSend();
		});

		// 取消按钮（初始隐藏）
		this.cancelButtonEl = buttonContainer.createEl('button', {
			cls: 'acp-cancel-button',
			text: '取消',
		});
		this.cancelButtonEl.style.display = 'none';
		this.cancelButtonEl.addEventListener('click', () => {
			void this.handleCancel();
		});

		// 初始状态：未连接，禁用输入
		this.updateUIState('idle');
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
			this.availableAgents = this.plugin.detector.getAll();

			// 更新下拉框
			this.agentSelectEl.empty();

			if (this.availableAgents.length === 0) {
				this.agentSelectEl.createEl('option', {
					text: '未找到可用 Agent',
					value: '',
				});
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
				const basePath = adapter.getBasePath() as unknown;
				if (typeof basePath === 'string') {
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
			this.agentSelectEl.disabled = true;

			// 使用 ACP 模式连接
			await this.connectWithAcp();

			this.connectButtonEl.textContent = '断开';
			this.connectButtonEl.disabled = false;

			// 隐藏空状态引导
			this.hideEmptyState();

			// 使用统一的状态更新
			this.updateUIState('idle');

			this.addSystemMessage(`已连接到 ${this.selectedAgent.name}`);
			new Notice(`已连接到 ${this.selectedAgent.name}`);
		} catch (error) {
			console.error('[ChatView] 连接失败:', error);
			this.updateConnectionStatus('error');
			this.connectButtonEl.disabled = false;
			this.agentSelectEl.disabled = false;
			this.inputEl.disabled = true;

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
		this.agentSelectEl.disabled = false;

		// 使用统一的状态更新
		this.updateUIState('idle');
	}

	/**
	 * 处理新对话
	 */
	private async handleNewChat(): Promise<void> {
		// 如果没有连接，直接清空消息
		if (!this.connection?.isConnected || !this.sessionManager) {
			this.clearMessages();
			new Notice('已清空对话');
			return;
		}

		try {
			// 结束当前会话
			this.sessionManager.end();

			// 清空消息区域
			this.clearMessages();

			// 重置 turn 容器
			this.currentTurnContainer = null;

			// 创建新会话
			await this.sessionManager.start();

			this.addSystemMessage('✨ 新对话已开始');
			new Notice('新对话已开始');
		} catch (error) {
			console.error('[ChatView] 新对话失败:', error);
			new Notice('创建新对话失败');
		}
	}

	/**
	 * 清空消息区域
	 */
	private clearMessages(): void {
		this.messagesEl.empty();
		this.currentTurnContainer = null;
		this.inputHistory = [];
		this.inputHistoryIndex = -1;
		this.isFirstMessage = true; // 重置首条消息标记
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
		this.sessionManager.onAvailableCommandsUpdate = (commands: AvailableCommand[]) => {
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
			void this.addMessage(message, container);
		} else {
			this.updateMessage(message, container);
		}
	}

	/**
	 * 处理工具调用
	 */
	private handleToolCall(toolCall: ToolCall): void {
		const container = this.getTurnContainer();

		// 直接添加到 turn 容器，保持消息和工具调用的顺序
		MessageRenderer.renderToolCall(container, toolCall, this.app);
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
	private handleThought(_thought: string): void {
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
		this.updateUIState(state);
		
		// 状态特定的消息
		if (state === 'cancelled') {
			this.addSystemMessage('⚠️ 已取消');
		}
	}
	
	/**
	 * 统一的 UI 状态更新
	 * 
	 * 这是所有状态变化的唯一入口，确保 UI 始终与状态同步
	 */
	private updateUIState(sessionState?: SessionState): void {
		// 获取当前状态（如果没有传入，默认为 idle）
		const state = sessionState ?? 'idle';
		const isConnected = this.connection !== null && this.sessionManager !== null;
		
		// 更新连接状态显示
		if (isConnected) {
			this.updateConnectionStatus('connected', this.selectedAgent?.name);
		} else {
			this.updateConnectionStatus('disconnected');
		}
		
		// 计算输入框是否应该启用
		// 规则：已连接 && 会话空闲
		const shouldEnableInput = isConnected && state === 'idle';
		
		// 更新输入框状态
		this.inputEl.disabled = !shouldEnableInput;
		
		// 更新按钮状态
		const isProcessing = state === 'processing';
		this.sendButtonEl.style.display = isProcessing ? 'none' : 'inline-block';
		this.cancelButtonEl.style.display = isProcessing ? 'inline-block' : 'none';
		
		// 如果恢复到 idle 状态，重置发送状态
		if (state === 'idle') {
			this.setInputSending(false);
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
		let text = this.inputEl.value.trim();
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

		// 首条消息注入 Obsidian 上下文
		if (this.isFirstMessage) {
			const context = this.getObsidianContext();
			if (context) {
				text = `${context}\n\n---\n\n${text}`;
			}
			this.isFirstMessage = false;
		}

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
	 * 获取 Obsidian 上下文信息
	 */
	private getObsidianContext(): string {
		const parts: string[] = [];

		// Vault 名称
		const vaultName = this.app.vault.getName();
		parts.push('[Obsidian Context]');
		parts.push(`- Vault: ${vaultName}`);

		// 工作目录
		try {
			const workingDir = this.getWorkingDirectory();
			parts.push(`- Working Directory: ${workingDir}`);
		} catch {
			// 忽略
		}

		// 当前打开的文件
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			parts.push(`- Active File: ${activeFile.path}`);
		}

		// Obsidian 特有语法提示
		parts.push('- Note: This vault uses Obsidian\'s [[wikilinks]] syntax for internal links.');

		return parts.join('\n');
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
	private updateMessage(message: Message, container?: HTMLElement): void {
		const target = container || this.messagesEl;
		// 使用 MessageRenderer 更新
		MessageRenderer.updateMessage(target, message, this.markdownComponent, this.app);
		this.smartScroll();
	}

	// ========================================================================
	// UI 辅助方法
	// ========================================================================

	/**
	 * 更新连接状态（简化版，配合紧凑型头部）
	 */
	private updateConnectionStatus(state: 'disconnected' | 'connecting' | 'connected' | 'error', agentName?: string): void {
		// 更新状态指示器（小圆点）的样式
		this.statusIndicatorEl.className = `acp-status-dot acp-status-${state}`;
		
		// 更新 tooltip
		let tooltip = '';
		switch (state) {
			case 'disconnected':
				tooltip = '未连接';
				break;
			case 'connecting':
				tooltip = `连接中: ${agentName || 'Agent'}...`;
				break;
			case 'connected':
				tooltip = `已连接: ${agentName || 'Agent'}`;
				break;
			case 'error':
				tooltip = '连接错误';
				break;
		}
		this.statusIndicatorEl.setAttribute('aria-label', tooltip);
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
	 *
	 * 优化：使用防抖，避免频繁滚动导致的抖动
	 */
	private smartScroll(): void {
		// 标记需要滚动
		this.pendingScroll = true;

		// 防抖：50ms 内的多次调用只执行最后一次
		if (this.scrollDebounceTimer) {
			clearTimeout(this.scrollDebounceTimer);
		}

		this.scrollDebounceTimer = setTimeout(() => {
			if (this.pendingScroll && this.isNearBottom()) {
				// 使用 requestAnimationFrame 在下一帧执行滚动
				requestAnimationFrame(() => {
					this.forceScrollToBottom();
				});
			}
			this.updateScrollButton();
			this.pendingScroll = false;
		}, 50);
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
	 * 处理当前模式更新（简化版 - 仅保存状态）
	 */
	private handleCurrentModeUpdate(mode: string, _description?: string): void {
		this.currentMode = mode;
	}

	/**
	 * 显示空状态引导（简洁版）
	 */
	private showEmptyState(): void {
		if (this.emptyStateEl) return;

		this.emptyStateEl = this.messagesEl.createDiv({ cls: 'acp-empty-state' });

		// 图标
		const iconEl = this.emptyStateEl.createDiv({ cls: 'acp-empty-state-icon' });
		setIcon(iconEl, 'bot');

		// 提示文本
		this.emptyStateEl.createDiv({
			cls: 'acp-empty-state-text',
			text: '选择 Agent 开始对话',
		});
	}

	/**
	 * 隐藏空状态引导
	 */
	private hideEmptyState(): void {
		if (this.emptyStateEl) {
			this.emptyStateEl.remove();
			this.emptyStateEl = null;
		}
	}

	/**
	 * 处理可用命令更新
	 */
	private handleAvailableCommandsUpdate(commands: AvailableCommand[]): void {
		this.availableCommands = commands;
		// 不再自动显示命令栏，改为通过斜杠唤起
	}

	/**
	 * 显示斜杠命令菜单
	 */
	private showCommandMenu(filter = ''): void {
		// 移除旧菜单
		this.hideCommandMenu();

		if (this.availableCommands.length === 0) {
			return;
		}

		// 过滤命令
		const filteredCommands = filter
			? this.availableCommands.filter(cmd =>
				cmd.name.toLowerCase().includes(filter.toLowerCase()) ||
				cmd.description?.toLowerCase().includes(filter.toLowerCase()),
			)
			: this.availableCommands;

		if (filteredCommands.length === 0) {
			return;
		}

		// 创建命令菜单（作为 inputContainerEl 的直接子元素）
		// CSS 中使用 position: absolute; bottom: 100%; 确保在输入框上方
		this.commandMenuEl = this.inputContainerEl.createDiv({
			cls: 'acp-command-menu',
		});

		filteredCommands.forEach((cmd, index) => {
			const item = this.commandMenuEl!.createDiv({
				cls: 'acp-command-menu-item',
			});

			if (index === 0) {
				item.addClass('acp-command-menu-item-selected');
				this.commandMenuSelectedIndex = 0;
			}

			// 命令图标
			const iconEl = item.createDiv({ cls: 'acp-command-menu-icon' });
			setIcon(iconEl, 'terminal');

			// 命令信息
			const infoEl = item.createDiv({ cls: 'acp-command-menu-info' });
			infoEl.createDiv({
				cls: 'acp-command-menu-name',
				text: `/${cmd.name}`,
			});
			
			if (cmd.description) {
				infoEl.createDiv({
					cls: 'acp-command-menu-desc',
					text: cmd.description,
				});
			}

			// 点击事件
			item.addEventListener('click', () => {
				void this.selectCommand(cmd);
			});

			// 鼠标悬停
			item.addEventListener('mouseenter', () => {
				this.commandMenuEl?.querySelectorAll('.acp-command-menu-item').forEach((el, i) => {
					el.classList.toggle('acp-command-menu-item-selected', i === index);
				});
				this.commandMenuSelectedIndex = index;
			});
		});
	}

	/**
	 * 隐藏命令菜单
	 */
	private hideCommandMenu(): void {
		if (this.commandMenuEl) {
			this.commandMenuEl.remove();
			this.commandMenuEl = null;
			this.commandMenuSelectedIndex = -1;
		}
	}

	/**
	 * 导航命令菜单（上下键）
	 */
	private navigateCommandMenu(direction: 'up' | 'down'): void {
		if (!this.commandMenuEl) return;

		const items = this.commandMenuEl.querySelectorAll('.acp-command-menu-item');
		if (items.length === 0) return;

		// 移除当前选中
		items[this.commandMenuSelectedIndex]?.classList.remove('acp-command-menu-item-selected');

		// 计算新索引
		if (direction === 'up') {
			this.commandMenuSelectedIndex = Math.max(0, this.commandMenuSelectedIndex - 1);
		} else {
			this.commandMenuSelectedIndex = Math.min(items.length - 1, this.commandMenuSelectedIndex + 1);
		}

		// 添加新选中
		const selectedItem = items[this.commandMenuSelectedIndex];
		selectedItem?.classList.add('acp-command-menu-item-selected');
		selectedItem?.scrollIntoView({ block: 'nearest' });
	}

	/**
	 * 选择命令（回车确认）
	 */
	private async selectCommand(command?: AvailableCommand): Promise<void> {
		// 如果没有传入命令，使用当前选中的
		if (!command && this.commandMenuEl) {
			const items = Array.from(this.commandMenuEl.querySelectorAll('.acp-command-menu-item'));
			const selectedItem = items[this.commandMenuSelectedIndex];
			if (selectedItem) {
				const commandName = selectedItem.querySelector('.acp-command-menu-name')?.textContent?.slice(1); // 去掉 /
				command = this.availableCommands.find(cmd => cmd.name === commandName);
			}
		}

		if (!command) return;

		// 隐藏菜单
		this.hideCommandMenu();

		// 执行命令
		await this.handleCommandClick(command);
	}

	/**
	 * 处理命令按钮点击
	 */
	private async handleCommandClick(command: AvailableCommand): Promise<void> {
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
