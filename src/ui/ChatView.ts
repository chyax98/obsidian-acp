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
import { ACP_BACKENDS } from '../acp/backends/registry';
import { PermissionModal } from './PermissionModal';
import type { RequestPermissionParams, PermissionOutcome } from '../acp/types/permissions';
import type { AvailableCommand } from '../acp/types/updates';
import { MessageRenderer } from './MessageRenderer';
import { SessionStorage, type SessionMeta } from '../acp/core/session-storage';
import { SessionHistoryModal } from './SessionHistoryModal';
import { FileInputSuggest } from './FileInputSuggest';


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

	// 会话持久化
	private sessionStorage: SessionStorage;
	private currentSessionId: string | null = null;

	// 连接状态
	private isConnecting: boolean = false;

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
	private newChatButtonEl!: HTMLButtonElement;
	private exportButtonEl!: HTMLButtonElement;
	private historyButtonEl!: HTMLButtonElement;
	private connectButtonEl!: HTMLButtonElement;
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

	// @ 文件引用建议
	private fileInputSuggest: FileInputSuggest | null = null;

	// ========================================================================
	// 构造函数
	// ========================================================================

	constructor(leaf: WorkspaceLeaf, plugin: AcpPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.sessionStorage = new SessionStorage(this.app);
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

		// 初始化会话存储
		await this.sessionStorage.initialize();

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
	}

	/**
	 * 关闭视图
	 */
	public async onClose(): Promise<void> {
		// 自动保存当前会话
		await this.autoSaveSession();

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
	 * 创建头部区域（简化版）
	 */
	private createHeader(container: HTMLElement): void {
		this.headerEl = container.createDiv({ cls: 'acp-chat-header-compact' });

		// 左侧：状态指示器 + 标题
		const leftSection = this.headerEl.createDiv({ cls: 'acp-header-left' });

		// 连接状态指示器（小圆点）
		this.statusIndicatorEl = leftSection.createDiv({
			cls: 'acp-status-dot acp-status-disconnected',
			attr: { 'aria-label': '未连接' },
		});

		// 标题
		leftSection.createDiv({
			cls: 'acp-header-title',
			text: 'Claude Code',
		});

		// 连接按钮（断开时显示）
		this.connectButtonEl = leftSection.createEl('button', {
			cls: 'acp-connect-btn',
			text: '连接',
		});
		this.connectButtonEl.addEventListener('click', () => {
			void this.handleManualConnect();
		});

		// 右侧：按钮组
		const rightSection = this.headerEl.createDiv({ cls: 'acp-header-right' });

		// 历史按钮
		this.historyButtonEl = rightSection.createEl('button', {
			cls: 'acp-history-btn clickable-icon',
			attr: { 'aria-label': '会话历史' },
		});
		setIcon(this.historyButtonEl, 'history');
		this.historyButtonEl.addEventListener('click', () => {
			void this.showSessionHistory();
		});

		// 导出按钮
		this.exportButtonEl = rightSection.createEl('button', {
			cls: 'acp-export-btn clickable-icon',
			attr: { 'aria-label': '导出对话' },
		});
		setIcon(this.exportButtonEl, 'download');
		this.exportButtonEl.addEventListener('click', () => {
			void this.handleExport();
		});

		// 新对话按钮
		this.newChatButtonEl = rightSection.createEl('button', {
			cls: 'acp-new-chat-btn clickable-icon',
			attr: { 'aria-label': '新对话' },
		});
		setIcon(this.newChatButtonEl, 'plus');
		this.newChatButtonEl.addEventListener('click', () => {
			void this.handleNewChat();
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

			// 检测是否输入斜杠（支持中文输入法的 、）
			if (value.startsWith('/') || value.startsWith('、')) {
				const filter = value.slice(1); // 去掉斜杠/顿号
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

		// 设置拖拽支持
		this.setupDragAndDrop();

		// 设置 @ 文件引用建议
		this.fileInputSuggest = new FileInputSuggest(this.app, this.inputEl);
	}

	/**
	 * 设置拖拽文件支持
	 */
	private setupDragAndDrop(): void {
		const dropZone = this.inputContainerEl;

		// 拖拽进入
		dropZone.addEventListener('dragover', (evt) => {
			evt.preventDefault();
			if (evt.dataTransfer) {
				evt.dataTransfer.dropEffect = 'copy';
			}
			dropZone.addClass('acp-drag-over');
		});

		// 拖拽离开
		dropZone.addEventListener('dragleave', (evt) => {
			// 检查是否真的离开了容器（而非进入子元素）
			const relatedTarget = evt.relatedTarget as Node | null;
			if (!dropZone.contains(relatedTarget)) {
				dropZone.removeClass('acp-drag-over');
			}
		});

		// 放下
		dropZone.addEventListener('drop', (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
			dropZone.removeClass('acp-drag-over');

			const dataTransfer = evt.dataTransfer;
			if (!dataTransfer) return;

			// 优先处理 Obsidian 文件拖拽
			const obsidianFiles = dataTransfer.getData('text/x-obsidian-files');
			if (obsidianFiles) {
				const paths = obsidianFiles.split('\n').filter(p => p.trim());
				if (paths.length > 0) {
					// 追加到输入框（纯路径）
					const references = paths.join('\n');
					this.inputEl.value = this.inputEl.value
						? `${this.inputEl.value}\n${references}`
						: references;
					this.inputEl.focus();
					new Notice(`已添加 ${paths.length} 个文件引用`);
				}
				return;
			}

			// 处理纯文本拖拽（可能是 obsidian:// URL）
			const text = dataTransfer.getData('text/plain');
			if (text) {
				let processedText = text;
				// 解析 obsidian:// URL
				if (text.startsWith('obsidian://open?')) {
					try {
						const url = new URL(text);
						const filePath = url.searchParams.get('file');
						if (filePath) {
							processedText = decodeURIComponent(filePath);
						}
					} catch {
						// URL 解析失败，保持原文本
					}
				}
				this.inputEl.value = this.inputEl.value
					? `${this.inputEl.value}\n${processedText}`
					: processedText;
				this.inputEl.focus();
			}
		});
	}

	// ========================================================================
	// 连接管理
	// ========================================================================

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
	 * 确保已连接（自动连接）
	 *
	 * 如果未连接，自动连接到 Claude Code
	 * 如果连接断开，自动重连
	 */
	private async ensureConnected(): Promise<boolean> {
		// 已连接且会话有效
		if (this.connection?.isConnected && this.sessionManager) {
			return true;
		}

		// 正在连接中，等待
		if (this.isConnecting) {
			return false;
		}

		this.isConnecting = true;

		try {
			// 更新状态
			this.updateConnectionStatus('connecting', 'Claude Code');
			this.setInputSending(true);
			this.sendButtonEl.textContent = '连接中...';

			// 获取配置
			const config = ACP_BACKENDS.claude;
			const manualPath = this.plugin.settings.manualAgentPaths?.claude;
			const cliPath = manualPath || config.defaultCliPath || 'npx @zed-industries/claude-code-acp';
			const workingDir = this.getWorkingDirectory();

			// 创建连接
			this.connection = new AcpConnection();

			await this.connection.connect({
				backendId: 'claude',
				cliPath,
				workingDir,
				acpArgs: config.acpArgs || [],
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
				onPermissionRequest: async (params: RequestPermissionParams) => {
					return await this.handlePermissionRequest(params);
				},
			});

			// 绑定会话回调
			this.setupSessionCallbacks();

			// 创建新会话
			await this.sessionManager.start();

			// 连接成功
			this.updateConnectionStatus('connected', 'Claude Code');
			this.hideEmptyState();
			this.updateUIState('idle');

			return true;
		} catch (error) {
			console.error('[ChatView] 自动连接失败:', error);
			this.updateConnectionStatus('error');
			this.showFriendlyError(error as Error, 'connection');

			// 清理失败的连接
			if (this.connection) {
				this.connection.disconnect();
				this.connection = null;
			}
			this.sessionManager = null;

			return false;
		} finally {
			this.isConnecting = false;
			this.setInputSending(false);
		}
	}

	/**
	 * 手动连接（用户点击连接按钮）
	 */
	private async handleManualConnect(): Promise<void> {
		const success = await this.ensureConnected();
		if (success) {
			new Notice('已连接到 Claude Code');
		}
	}

	/**
	 * 断开连接
	 */
	private handleDisconnect(): void {
		if (this.sessionManager) {
			this.sessionManager.end();
			this.sessionManager = null;
		}

		if (this.connection) {
			this.connection.disconnect();
			this.connection = null;
		}

		this.updateConnectionStatus('disconnected');
		this.updateUIState('idle');
	}

	/**
	 * 处理新对话（保持连接，只重建会话）
	 */
	private async handleNewChat(): Promise<void> {
		// 清空消息区域
		this.clearMessages();

		// 重置 turn 容器
		this.currentTurnContainer = null;

		// 重置首条消息标记
		this.isFirstMessage = true;

		// 显示空状态
		this.showEmptyState();

		// 如果已连接，只重建会话
		if (this.sessionManager) {
			try {
				await this.sessionManager.start();
				this.hideEmptyState();
				this.addSystemMessage('✨ 新对话已开始');
				new Notice('新对话已开始');
			} catch (error) {
				console.error('[ChatView] 新对话失败:', error);
				new Notice('创建新对话失败');
			}
		} else {
			// 未连接时，只清空界面，等待用户发送消息时自动连接
			new Notice('输入消息开始新对话');
		}
	}

	/**
	 * 处理导出对话
	 */
	private async handleExport(): Promise<void> {
		if (!this.sessionManager) {
			new Notice('没有可导出的对话');
			return;
		}

		const turns = this.sessionManager.turns;
		if (turns.length === 0) {
			new Notice('对话为空，无法导出');
			return;
		}

		try {
			// 生成 Markdown 内容
			const markdown = this.sessionManager.toMarkdown();

			// 生成文件名
			const timestamp = new Date().toISOString().slice(0, 10);
			const firstMessage = turns[0]?.userMessage.content.slice(0, 30).replace(/[/\\?%*:|"<>]/g, '-') || 'chat';
			const fileName = `ACP-${timestamp}-${firstMessage}.md`;

			// 保存到 Vault
			const filePath = `${fileName}`;
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);

			if (existingFile) {
				// 文件已存在，追加时间戳
				const uniquePath = `ACP-${Date.now()}-${firstMessage.slice(0, 20)}.md`;
				await this.app.vault.create(uniquePath, markdown);
				new Notice(`对话已导出到: ${uniquePath}`);
			} else {
				await this.app.vault.create(filePath, markdown);
				new Notice(`对话已导出到: ${filePath}`);
			}
		} catch (error) {
			console.error('[ChatView] 导出失败:', error);
			new Notice('导出失败: ' + (error as Error).message);
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

	/**
	 * 自动保存当前会话
	 */
	private async autoSaveSession(): Promise<void> {
		if (!this.sessionManager) {
			return;
		}

		const turns = this.sessionManager.turns;
		if (turns.length === 0) {
			return; // 空会话不保存
		}

		try {
			const data = this.sessionManager.toJSON();
			const agentName = 'Claude Code';
			this.currentSessionId = await this.sessionStorage.saveSession(data, agentName);
		} catch (error) {
			console.error('[ChatView] 自动保存会话失败:', error);
		}
	}

	/**
	 * 获取会话历史列表
	 */
	public async getSessionHistory(): Promise<SessionMeta[]> {
		return await this.sessionStorage.listSessions();
	}

	/**
	 * 加载历史会话
	 */
	public async loadHistorySession(sessionId: string): Promise<boolean> {
		try {
			const storedSession = await this.sessionStorage.loadSession(sessionId);
			if (!storedSession) {
				new Notice('会话不存在');
				return false;
			}

			// 清空当前消息
			this.clearMessages();

			// 渲染历史消息
			for (const turn of storedSession.turns) {
				// 渲染用户消息
				this.handleMessage(turn.userMessage, true);

				// 渲染 Agent 消息
				if (turn.assistantMessage) {
					this.handleMessage(turn.assistantMessage, true);
				}
			}

			this.currentSessionId = sessionId;
			new Notice('会话已加载');
			return true;
		} catch (error) {
			console.error('[ChatView] 加载会话失败:', error);
			new Notice('加载会话失败');
			return false;
		}
	}

	/**
	 * 删除历史会话
	 */
	public async deleteHistorySession(sessionId: string): Promise<boolean> {
		const success = await this.sessionStorage.deleteSession(sessionId);
		if (success) {
			new Notice('会话已删除');
		}
		return success;
	}

	/**
	 * 显示会话历史面板
	 */
	private async showSessionHistory(): Promise<void> {
		try {
			const sessions = await this.sessionStorage.listSessions();

			const modal = new SessionHistoryModal(this.app, sessions, {
				onSelect: async (sessionId: string) => {
					await this.loadHistorySession(sessionId);
				},
				onDelete: async (sessionId: string) => {
					return await this.deleteHistorySession(sessionId);
				},
				onRefresh: async () => {
					return await this.sessionStorage.listSessions();
				},
			});

			modal.open();
		} catch (error) {
			console.error('[ChatView] 打开会话历史失败:', error);
			new Notice('无法打开会话历史');
		}
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

		// 权限请求（已在构造函数中设置，避免竞态条件）

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
			this.updateConnectionStatus('connected', 'Claude Code');
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

		// 自动保存会话
		void this.autoSaveSession();
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
		let displayText = this.inputEl.value.trim();
		if (!displayText) {
			return;
		}

		// 中文输入法兼容：将开头的 、 转换为 /
		if (displayText.startsWith('、')) {
			displayText = '/' + displayText.slice(1);
		}

		// 自动连接（如果未连接或已断开）
		const connected = await this.ensureConnected();
		if (!connected) {
			// ensureConnected 已经显示了错误信息
			return;
		}

		// Phase 4: 保存到历史
		this.addToInputHistory(displayText);

		// 清空输入框
		this.inputEl.value = '';

		// 首条消息注入 Obsidian 上下文（只发送给 Agent，不显示给用户）
		let fullText: string | undefined;
		if (this.isFirstMessage) {
			const context = this.getObsidianContext();
			if (context) {
				fullText = `${context}\n\n---\n\n${displayText}`;
			}
			this.isFirstMessage = false;
		}

		// Phase 4: 显示发送状态
		this.setInputSending(true);

		try {
			// 使用 SessionManager 发送
			// displayText: 显示给用户的文本
			// fullText: 发送给 Agent 的完整文本（包含上下文）
			if (!this.sessionManager) {
				throw new Error('会话管理器未初始化');
			}
			await this.sessionManager.sendPrompt(displayText, fullText);
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

		// 更新连接按钮显示状态
		if (state === 'connected') {
			this.connectButtonEl.style.display = 'none';
		} else if (state === 'connecting') {
			this.connectButtonEl.textContent = '连接中...';
			this.connectButtonEl.disabled = true;
			this.connectButtonEl.style.display = '';
		} else {
			this.connectButtonEl.textContent = '连接';
			this.connectButtonEl.disabled = false;
			this.connectButtonEl.style.display = '';
		}
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
			text: '输入消息开始对话',
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

		// 如果命令列表为空，可能是因为还没连接
		if (this.availableCommands.length === 0) {
			// 检查是否已连接
			if (!this.connection?.isConnected) {
				// 显示"正在连接..."提示
				this.commandMenuEl = this.inputContainerEl.createDiv({
					cls: 'acp-command-menu',
				});
				const loadingItem = this.commandMenuEl.createDiv({
					cls: 'acp-command-menu-item acp-command-menu-loading',
				});
				loadingItem.createDiv({
					cls: 'acp-command-menu-info',
					text: '正在连接 Agent...',
				});

				// 触发连接，连接后命令会通过 handleAvailableCommandsUpdate 更新
				void this.ensureConnected().then(() => {
					// 连接成功后，如果用户还在输入 / 或 、，刷新菜单
					const val = this.inputEl.value;
					if (val.startsWith('/') || val.startsWith('、')) {
						this.showCommandMenu(val.slice(1));
					}
				});
				return;
			}
			// 已连接但没有命令，直接返回
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

	// ========================================================================
	// 公共方法（供外部调用）
	// ========================================================================

	/**
	 * 追加文本到输入框
	 * 供其他命令/功能调用
	 */
	public appendText(text: string): void {
		this.inputEl.value += text;
		this.inputEl.focus();
		// 滚动到输入框底部
		this.inputEl.scrollTop = this.inputEl.scrollHeight;
	}
}
