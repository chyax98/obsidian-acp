/**
 * ACP ChatView - 聊天视图
 *
 * 提供与 AI Agent 交互的侧边栏界面
 */

import type { WorkspaceLeaf } from 'obsidian';
import { ItemView, Notice, Component, setIcon } from 'obsidian';
import type AcpPlugin from '../../main';
import type { SessionManager } from '../../acp/core/session-manager';
import type { AcpConnection } from '../../acp/core/connection';
import type { Message, ToolCall, PlanEntry, SessionState } from '../../acp/core/session-manager';
import { PermissionModal } from '../PermissionModal';
import type { RequestPermissionParams, PermissionOutcome } from '../../acp/types/permissions';
import type { AvailableCommand } from '../../acp/types/updates';
import { MessageRenderer } from '../MessageRenderer';
import type { SessionMeta } from '../../acp/core/session-storage';
import { SessionHistoryModal } from '../SessionHistoryModal';
import { FileInputSuggest } from '../FileInputSuggest';

// 辅助类
import {
	ScrollHelper,
	CommandMenuHelper,
	InputHistoryManager,
	ErrorDisplayHelper,
	DragDropHandler,
	ObsidianContextGenerator,
	ConnectionManager,
	HistoryManager,
} from './helpers';

/** ChatView 的唯一标识符 */
export const ACP_CHAT_VIEW_TYPE = 'acp-chat-view';

/**
 * ACP 聊天视图
 */
export class AcpChatView extends ItemView {
	private plugin: AcpPlugin;
	private markdownComponent: Component = new Component();

	// 辅助管理器
	private connectionManager!: ConnectionManager;
	private historyManager!: HistoryManager;
	private scrollHelper!: ScrollHelper;
	private commandMenu!: CommandMenuHelper;
	private inputHistory!: InputHistoryManager;
	private errorDisplay!: ErrorDisplayHelper;
	private contextGenerator!: ObsidianContextGenerator;

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
	private backToCurrentButton: HTMLButtonElement | null = null;
	private emptyStateEl: HTMLElement | null = null;

	// 状态
	private currentTurnContainer: HTMLElement | null = null;
	private isFirstMessage: boolean = true;
	private fileInputSuggest: FileInputSuggest | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: AcpPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	public getViewType(): string {
		return ACP_CHAT_VIEW_TYPE;
	}

	public getDisplayText(): string {
		return 'ACP Chat';
	}

	public getIcon(): string {
		return 'bot';
	}

	public async onOpen(): Promise<void> {
		this.markdownComponent.load();

		const container = this.contentEl;
		container.empty();
		container.addClass('acp-chat-container');

		this.createHeader(container);
		this.createMessagesArea(container);
		this.createInputArea(container);
		await this.initializeManagers();
	}

	public async onClose(): Promise<void> {
		await this.autoSaveSession();
		this.connectionManager?.disconnect();
		this.scrollHelper?.destroy();
		this.markdownComponent.unload();
	}

	// ========================================================================
	// 初始化
	// ========================================================================

	private async initializeManagers(): Promise<void> {
		// 滚动管理
		this.scrollHelper = new ScrollHelper(this.messagesEl);

		// 输入历史
		this.inputHistory = new InputHistoryManager();

		// 错误显示
		this.errorDisplay = new ErrorDisplayHelper(this.messagesEl);

		// 上下文生成器
		this.contextGenerator = new ObsidianContextGenerator(
			this.app,
			() => this.getWorkingDirectory(),
		);

		// 命令菜单
		this.commandMenu = new CommandMenuHelper(this.inputContainerEl, {
			onExecute: (cmd) => this.handleCommandClick(cmd),
			isConnected: () => this.connectionManager?.isConnected ?? false,
			ensureConnected: () => this.connectionManager?.ensureConnected() ?? Promise.resolve(false),
			getInputValue: () => this.inputEl.value,
		});

		// 连接管理
		this.connectionManager = new ConnectionManager(
			this.app,
			{
				getWorkingDirectory: () => this.getWorkingDirectory(),
				getManualCliPath: () => this.plugin.settings.manualAgentPaths?.claude,
				getPermissionSettings: () => this.plugin.settings.permission,
				saveSettings: () => this.plugin.saveSettings(),
				getMcpServers: () => this.plugin.settings.mcpServers,
				onPermissionRequest: (params) => this.handlePermissionRequest(params),
			},
			{
				onStatusChange: (status, name) => this.updateConnectionStatus(status, name),
				onConnected: (conn, sm) => this.onConnectionEstablished(conn, sm),
				onError: (err) => this.errorDisplay?.showError(err, 'connection'),
			},
		);

		// 历史管理
		this.historyManager = new HistoryManager(this.app, {
			clearMessages: () => this.clearMessages(),
			renderMessage: (msg, isNew) => this.handleMessage(msg, isNew),
			enterHistoryMode: () => this.enterHistoryViewMode(),
			exitHistoryMode: () => this.onExitHistoryMode(),
			getMessagesHtml: () => this.messagesEl.innerHTML,
			restoreMessagesHtml: (html) => { this.messagesEl.innerHTML = html; },
			showEmptyState: () => this.showEmptyState(),
		});

		await this.historyManager.initialize();

		// 拖拽处理
		new DragDropHandler(this.app, this.inputContainerEl, {
			getInputValue: () => this.inputEl.value,
			setInputValue: (v) => { this.inputEl.value = v; },
			focusInput: () => this.inputEl.focus(),
		});
	}

	private onConnectionEstablished(_conn: AcpConnection, sm: SessionManager): void {
		this.setupSessionCallbacks(sm);
		void sm.start().then(() => {
			this.hideEmptyState();
			this.updateUIState('idle');
		});
	}

	private onExitHistoryMode(): void {
		this.inputEl.disabled = false;
		this.inputEl.placeholder = '输入消息，/ 查看命令';
		this.inputContainerEl.removeClass('acp-history-readonly');
		if (this.backToCurrentButton) {
			this.backToCurrentButton.style.display = 'none';
		}
		this.sendButtonEl.style.display = '';
	}

	// ========================================================================
	// UI 创建
	// ========================================================================

	private createHeader(container: HTMLElement): void {
		this.headerEl = container.createDiv({ cls: 'acp-chat-header-compact' });

		const leftSection = this.headerEl.createDiv({ cls: 'acp-header-left' });
		this.statusIndicatorEl = leftSection.createDiv({
			cls: 'acp-status-dot acp-status-disconnected',
			attr: { 'aria-label': '未连接' },
		});
		leftSection.createDiv({ cls: 'acp-header-title', text: 'Claude Code' });

		this.connectButtonEl = leftSection.createEl('button', { cls: 'acp-connect-btn', text: '连接' });
		this.connectButtonEl.addEventListener('click', () => void this.handleManualConnect());

		const rightSection = this.headerEl.createDiv({ cls: 'acp-header-right' });

		this.historyButtonEl = rightSection.createEl('button', {
			cls: 'acp-history-btn clickable-icon',
			attr: { 'aria-label': '会话历史' },
		});
		setIcon(this.historyButtonEl, 'history');
		this.historyButtonEl.addEventListener('click', () => void this.showSessionHistory());

		this.exportButtonEl = rightSection.createEl('button', {
			cls: 'acp-export-btn clickable-icon',
			attr: { 'aria-label': '导出对话' },
		});
		setIcon(this.exportButtonEl, 'download');
		this.exportButtonEl.addEventListener('click', () => void this.handleExport());

		this.newChatButtonEl = rightSection.createEl('button', {
			cls: 'acp-new-chat-btn clickable-icon',
			attr: { 'aria-label': '新对话' },
		});
		setIcon(this.newChatButtonEl, 'plus');
		this.newChatButtonEl.addEventListener('click', () => void this.handleNewChat());
	}

	private createMessagesArea(container: HTMLElement): void {
		const messagesContainer = container.createDiv({ cls: 'acp-messages-container' });
		this.messagesEl = messagesContainer.createDiv({ cls: 'acp-chat-messages' });
		this.showEmptyState();

		const scrollBtn = messagesContainer.createDiv({
			cls: 'acp-scroll-to-bottom',
			attr: { 'aria-label': '跳到最新' },
		});
		scrollBtn.style.display = 'none';
		setIcon(scrollBtn, 'arrow-down');
		scrollBtn.addEventListener('click', () => this.scrollHelper?.forceScrollToBottom());
		this.messagesEl.addEventListener('scroll', () => this.scrollHelper?.updateScrollButton());
	}

	private createInputArea(container: HTMLElement): void {
		this.inputContainerEl = container.createDiv({ cls: 'acp-chat-input' });

		this.inputEl = this.inputContainerEl.createEl('textarea', {
			cls: 'acp-input-textarea',
			attr: { placeholder: '输入消息，/ 查看命令', rows: '3' },
		});

		this.setupInputKeyboard();
		this.setupInputWatcher();

		const buttonContainer = this.inputContainerEl.createDiv({ cls: 'acp-input-buttons' });

		this.sendButtonEl = buttonContainer.createEl('button', { cls: 'acp-send-button mod-cta', text: '发送' });
		this.sendButtonEl.addEventListener('click', () => void this.handleSend());

		this.cancelButtonEl = buttonContainer.createEl('button', { cls: 'acp-cancel-button', text: '取消' });
		this.cancelButtonEl.style.display = 'none';
		this.cancelButtonEl.addEventListener('click', () => void this.handleCancel());

		this.backToCurrentButton = buttonContainer.createEl('button', { cls: 'acp-back-button mod-cta', text: '返回当前对话' });
		this.backToCurrentButton.style.display = 'none';
		this.backToCurrentButton.addEventListener('click', () => this.historyManager?.exitHistoryView());

		this.updateUIState('idle');
		this.fileInputSuggest = new FileInputSuggest(this.app, this.inputEl);
	}

	private setupInputKeyboard(): void {
		this.inputEl.addEventListener('keydown', (e) => {
			if (this.commandMenu?.isVisible()) {
				if (e.key === 'ArrowUp') { e.preventDefault(); this.commandMenu.navigate('up'); return; }
				if (e.key === 'ArrowDown') { e.preventDefault(); this.commandMenu.navigate('down'); return; }
				if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void this.commandMenu.select(); return; }
				if (e.key === 'Escape') { e.preventDefault(); this.commandMenu.hide(); return; }
			}

			if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void this.handleSend(); }

			if (e.key === 'ArrowUp') {
				e.preventDefault();
				const text = this.inputHistory?.navigate('up');
				if (text !== null) { this.inputEl.value = text; this.inputEl.setSelectionRange(text.length, text.length); }
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				const text = this.inputHistory?.navigate('down');
				if (text !== null) { this.inputEl.value = text; this.inputEl.setSelectionRange(text.length, text.length); }
			}
		});
	}

	private setupInputWatcher(): void {
		this.inputEl.addEventListener('input', () => {
			const value = this.inputEl.value;
			if (value.startsWith('/') || value.startsWith('、')) {
				this.commandMenu?.show(value.slice(1));
			} else {
				this.commandMenu?.hide();
			}
		});
	}

	// ========================================================================
	// 连接与会话
	// ========================================================================

	private getWorkingDirectory(): string {
		try {
			const adapter = this.plugin.app.vault.adapter;
			if ('getBasePath' in adapter && typeof adapter.getBasePath === 'function') {
				const basePath = adapter.getBasePath() as unknown;
				if (typeof basePath === 'string') return basePath;
			}
		} catch (error) {
			console.warn('[ChatView] Vault API 失败:', error);
		}

		if (this.plugin.settings.customWorkingDir) return this.plugin.settings.customWorkingDir;
		const cwd = process.cwd();
		if (cwd && cwd !== '/') return cwd;
		throw new Error('无法获取工作目录');
	}

	private async handleManualConnect(): Promise<void> {
		this.setInputSending(true);
		this.sendButtonEl.textContent = '连接中...';
		const success = await this.connectionManager?.ensureConnected();
		this.setInputSending(false);
		if (success) new Notice('已连接到 Claude Code');
	}

	private async handleNewChat(): Promise<void> {
		this.clearMessages();
		this.currentTurnContainer = null;
		this.isFirstMessage = true;
		this.showEmptyState();

		const success = await this.connectionManager?.resetSession();
		if (success) {
			this.hideEmptyState();
			this.addSystemMessage('✨ 新对话已开始');
			new Notice('新对话已开始');
		} else {
			new Notice('输入消息开始新对话');
		}
	}

	private async handleExport(): Promise<void> {
		const sm = this.connectionManager?.getSessionManager();
		if (!sm || sm.turns.length === 0) {
			new Notice(sm ? '对话为空，无法导出' : '没有可导出的对话');
			return;
		}

		try {
			const markdown = sm.toMarkdown();
			const timestamp = new Date().toISOString().slice(0, 10);
			const firstMsg = sm.turns[0]?.userMessage.content.slice(0, 30).replace(/[/\\?%*:|"<>]/g, '-') || 'chat';
			const fileName = `ACP-${timestamp}-${firstMsg}.md`;

			const existing = this.app.vault.getAbstractFileByPath(fileName);
			const finalPath = existing ? `ACP-${Date.now()}-${firstMsg.slice(0, 20)}.md` : fileName;
			await this.app.vault.create(finalPath, markdown);
			new Notice(`对话已导出到: ${finalPath}`);
		} catch (error) {
			console.error('[ChatView] 导出失败:', error);
			new Notice('导出失败: ' + (error as Error).message);
		}
	}

	private clearMessages(): void {
		this.messagesEl.empty();
		this.currentTurnContainer = null;
		this.inputHistory?.clear();
		this.isFirstMessage = true;
	}

	private async autoSaveSession(): Promise<void> {
		const sm = this.connectionManager?.getSessionManager();
		if (!sm || sm.turns.length === 0) return;

		try {
			const data = sm.toJSON();
			await this.historyManager?.saveSession(data, 'Claude Code');
		} catch (error) {
			console.error('[ChatView] 自动保存会话失败:', error);
		}
	}

	// ========================================================================
	// 会话回调
	// ========================================================================

	private setupSessionCallbacks(sm: SessionManager): void {
		sm.onMessage = (msg, isNew) => this.handleMessage(msg, isNew);
		sm.onToolCall = (tc) => this.handleToolCall(tc);
		sm.onPlan = (plan) => this.handlePlan(plan);
		sm.onThought = (thought) => this.handleThought(thought);
		sm.onStateChange = (state) => this.handleStateChange(state);
		sm.onTurnEnd = () => this.handleTurnEnd();
		sm.onError = (err) => this.handleError(err);
		sm.onCurrentModeUpdate = () => { /* 保存状态如需 */ };
		sm.onAvailableCommandsUpdate = (cmds) => this.commandMenu?.setCommands(cmds);
	}

	private getTurnContainer(): HTMLElement {
		if (!this.currentTurnContainer) {
			this.currentTurnContainer = this.messagesEl.createDiv({
				cls: 'acp-turn-container',
				attr: { 'data-turn-id': `turn-${Date.now()}` },
			});
		}
		return this.currentTurnContainer;
	}

	private handleMessage(message: Message, isNew: boolean): void {
		const container = this.getTurnContainer();
		if (isNew) {
			void MessageRenderer.renderMessage(container, message, this.markdownComponent, this.app);
		} else {
			MessageRenderer.updateMessage(container, message, this.markdownComponent, this.app);
		}
		this.scrollHelper?.smartScroll();
	}

	private handleToolCall(toolCall: ToolCall): void {
		MessageRenderer.renderToolCall(this.getTurnContainer(), toolCall, this.app);
		this.scrollHelper?.smartScroll();
	}

	private handlePlan(plan: PlanEntry[]): void {
		MessageRenderer.renderPlan(this.getTurnContainer(), plan);
		this.scrollHelper?.smartScroll();
	}

	private handleThought(_thought: string): void {
		const sm = this.connectionManager?.getSessionManager();
		const turn = sm?.activeTurn;
		if (turn) {
			MessageRenderer.renderThoughts(this.getTurnContainer(), turn.thoughts);
			this.scrollHelper?.smartScroll();
		}
	}

	private handleStateChange(state: SessionState): void {
		this.updateUIState(state);
		if (state === 'cancelled') this.addSystemMessage('⚠️ 已取消');
	}

	private handleTurnEnd(): void {
		this.currentTurnContainer = null;
		this.scrollHelper?.smartScroll();
		void this.autoSaveSession();
	}

	private handleError(error: Error): void {
		console.error('[ChatView] 错误:', error);
		this.addSystemMessage(`❌ 错误: ${error.message}`);
		new Notice(`错误: ${error.message}`);
	}

	private async handlePermissionRequest(params: RequestPermissionParams): Promise<PermissionOutcome> {
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
						if (response.outcome === 'selected') {
							const actionText = response.optionId?.includes('reject') ? '✗ 已拒绝' : '✓ 已允许';
							this.addSystemMessage(`${actionText}: ${params.toolCall.title || '操作'}`);
						} else {
							this.addSystemMessage(`⚠ 已取消: ${params.toolCall.title || '操作'}`);
						}
						resolve(response.outcome === 'cancelled' ? { type: 'cancelled' } : { type: 'selected', optionId: response.optionId || 'reject-once' });
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

	private async handleSend(): Promise<void> {
		let text = this.inputEl.value.trim();
		if (!text) return;

		if (text.startsWith('、')) text = '/' + text.slice(1);

		this.setInputSending(true);
		this.sendButtonEl.textContent = '连接中...';
		const connected = await this.connectionManager?.ensureConnected();
		if (!connected) { this.setInputSending(false); return; }

		this.inputHistory?.add(text);
		this.inputEl.value = '';

		let fullText: string | undefined;
		if (this.isFirstMessage) {
			const context = this.contextGenerator?.generate();
			if (context) fullText = `${context}\n\n---\n\n${text}`;
			this.isFirstMessage = false;
		}

		try {
			const sm = this.connectionManager?.getSessionManager();
			if (!sm) throw new Error('会话管理器未初始化');
			await sm.sendPrompt(text, fullText);
		} catch (error) {
			console.error('[ChatView] 发送失败:', error);
			this.errorDisplay?.showError(error as Error, 'send');
			this.setInputSending(false);
		}
	}

	private async handleCancel(): Promise<void> {
		try {
			await this.connectionManager?.getSessionManager()?.cancel();
		} catch (error) {
			console.error('[ChatView] 取消失败:', error);
		}
	}

	private async handleCommandClick(command: AvailableCommand): Promise<void> {
		if (command.input?.hint) {
			this.inputEl.value = `/${command.name} ${command.input.hint}`;
			this.inputEl.focus();
			const hintStart = `/${command.name} `.length;
			this.inputEl.setSelectionRange(hintStart, this.inputEl.value.length);
		} else {
			this.inputEl.value = `/${command.name}`;
			await this.handleSend();
		}
	}

	// ========================================================================
	// UI 状态
	// ========================================================================

	private addSystemMessage(text: string): void {
		const el = this.messagesEl.createDiv({ cls: 'acp-message acp-message-system' });
		el.createDiv({ cls: 'acp-message-content' }).textContent = text;
		this.scrollHelper?.smartScroll();
	}

	private updateUIState(sessionState?: SessionState): void {
		const state = sessionState ?? 'idle';
		const isConnected = this.connectionManager?.isConnected ?? false;

		const shouldEnable = isConnected && state === 'idle';
		this.inputEl.disabled = !shouldEnable;

		const isProcessing = state === 'processing';
		this.sendButtonEl.style.display = isProcessing ? 'none' : 'inline-block';
		this.cancelButtonEl.style.display = isProcessing ? 'inline-block' : 'none';

		if (state === 'idle') this.setInputSending(false);
	}

	private updateConnectionStatus(status: 'disconnected' | 'connecting' | 'connected' | 'error', agentName?: string): void {
		this.statusIndicatorEl.className = `acp-status-dot acp-status-${status}`;

		const tooltips: Record<string, string> = {
			disconnected: '未连接',
			connecting: `连接中: ${agentName || 'Agent'}...`,
			connected: `已连接: ${agentName || 'Agent'}`,
			error: '连接错误',
		};
		this.statusIndicatorEl.setAttribute('aria-label', tooltips[status]);

		if (status === 'connected') {
			this.connectButtonEl.style.display = 'none';
			this.errorDisplay?.clearErrors();
		} else if (status === 'connecting') {
			this.connectButtonEl.textContent = '连接中...';
			this.connectButtonEl.disabled = true;
			this.connectButtonEl.style.display = '';
		} else {
			this.connectButtonEl.textContent = '连接';
			this.connectButtonEl.disabled = false;
			this.connectButtonEl.style.display = '';
		}
	}

	private setInputSending(sending: boolean): void {
		this.inputEl.disabled = sending;
		this.sendButtonEl.disabled = sending;
		this.sendButtonEl.textContent = sending ? '发送中...' : '发送';
	}

	private showEmptyState(): void {
		if (this.emptyStateEl) return;
		this.emptyStateEl = this.messagesEl.createDiv({ cls: 'acp-empty-state' });
		const iconEl = this.emptyStateEl.createDiv({ cls: 'acp-empty-state-icon' });
		setIcon(iconEl, 'bot');
		this.emptyStateEl.createDiv({ cls: 'acp-empty-state-text', text: '输入消息开始对话' });
	}

	private hideEmptyState(): void {
		if (this.emptyStateEl) { this.emptyStateEl.remove(); this.emptyStateEl = null; }
	}

	private enterHistoryViewMode(): void {
		this.inputEl.disabled = true;
		this.inputEl.placeholder = '历史会话（只读）';
		this.inputContainerEl.addClass('acp-history-readonly');
		this.sendButtonEl.style.display = 'none';
		if (this.backToCurrentButton) this.backToCurrentButton.style.display = '';
	}

	// ========================================================================
	// 会话历史
	// ========================================================================

	public async getSessionHistory(): Promise<SessionMeta[]> {
		return await this.historyManager?.listSessions() ?? [];
	}

	public async loadHistorySession(sessionId: string): Promise<boolean> {
		return await this.historyManager?.loadSession(sessionId) ?? false;
	}

	public async deleteHistorySession(sessionId: string): Promise<boolean> {
		return await this.historyManager?.deleteSession(sessionId) ?? false;
	}

	private async showSessionHistory(): Promise<void> {
		try {
			const sessions = await this.historyManager?.listSessions() ?? [];
			new SessionHistoryModal(this.app, sessions, {
				onSelect: (id) => this.loadHistorySession(id),
				onDelete: (id) => this.deleteHistorySession(id),
				onRefresh: () => this.historyManager?.listSessions() ?? Promise.resolve([]),
			}).open();
		} catch (error) {
			console.error('[ChatView] 打开会话历史失败:', error);
			new Notice('无法打开会话历史');
		}
	}

	// ========================================================================
	// 公共方法
	// ========================================================================

	public appendText(text: string): void {
		this.inputEl.value += text;
		this.inputEl.focus();
		this.inputEl.scrollTop = this.inputEl.scrollHeight;
	}
}
