/**
 * ACP ChatView - 聊天视图
 *
 * 提供与 AI Agent 交互的侧边栏界面
 */

import type { WorkspaceLeaf } from "obsidian";
import { ItemView, Notice, Component, setIcon } from "obsidian";
import type AcpPlugin from "../../main";
import type { SessionManager } from "../../acp/core/session-manager";
import type { AcpConnection } from "../../acp/core/connection";
import type {
	Message,
	ToolCall,
	PlanEntry,
	SessionState,
} from "../../acp/core/session-manager";
import type { SessionModeState } from "../../acp/types";
import type {
	RequestPermissionParams,
	PermissionOutcome,
} from "../../acp/types/permissions";
import type { AvailableCommand } from "../../acp/types/updates";
import {
	MessageRenderer,
	ToolCallRenderer,
	PlanRenderer,
	ThoughtRenderer,
} from "../renderers";
import { warn, error as logError } from "../../acp/utils/logger";
import type { SessionMeta } from "../../acp/core/session-storage";
import { SessionHistoryModal } from "../SessionHistoryModal";
import { FileInputSuggest } from "../FileInputSuggest";
import type { AcpBackendId } from "../../acp/backends/types";
import {
	getBackendConfig,
	getAllBackends,
} from "../../acp/backends/registry";

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
	exportChatSessionMarkdown,
	requestPermissionWithModal,
} from "./helpers";

/** ChatView 的唯一标识符 */
export const ACP_CHAT_VIEW_TYPE = "acp-chat-view";

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
	private agentSelectorEl!: HTMLSelectElement;
	private backToCurrentButton: HTMLButtonElement | null = null;
	private emptyStateEl: HTMLElement | null = null;
	private modeSelectorEl: HTMLSelectElement | null = null;

	// 状态
	private currentTurnContainer: HTMLElement | null = null;
	private isFirstMessage: boolean = true;
	private fileInputSuggest: FileInputSuggest | null = null;

	// 实例级 Agent 选择
	private instanceAgentId: AcpBackendId = "claude";
	private isAgentLocked: boolean = false;

	constructor(leaf: WorkspaceLeaf, plugin: AcpPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	public getViewType(): string {
		return ACP_CHAT_VIEW_TYPE;
	}

	public getDisplayText(): string {
		return "ACP Chat";
	}

	public getIcon(): string {
		return "bot";
	}

	public async onOpen(): Promise<void> {
		this.markdownComponent.load();

		// 初始化实例级 Agent ID（从全局设置读取默认值）
		this.instanceAgentId =
			this.plugin.settings.currentAgentId || "claude";

		const container = this.contentEl;
		container.empty();
		container.addClass("acp-chat-container");

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

	// ===== 初始化 =====
	private async initializeManagers(): Promise<void> {
		// 滚动管理
		this.scrollHelper = new ScrollHelper(this.messagesEl);

		// 输入历史
		this.inputHistory = new InputHistoryManager();

		// 错误显示
		this.errorDisplay = new ErrorDisplayHelper(this.messagesEl);

		// 上下文生成器
		this.contextGenerator = new ObsidianContextGenerator(this.app, () =>
			this.getWorkingDirectory(),
		);

		// 命令菜单
		this.commandMenu = new CommandMenuHelper(this.inputContainerEl, {
			onExecute: (cmd) => this.handleCommandClick(cmd),
			isConnected: () => this.connectionManager?.isConnected ?? false,
			ensureConnected: () =>
				this.connectionManager?.ensureConnected() ??
				Promise.resolve(false),
			getInputValue: () => this.inputEl.value,
		});

		// 连接管理
		this.connectionManager = new ConnectionManager(
			this.app,
			{
				getCurrentAgentId: () => this.instanceAgentId,
				getWorkingDirectory: () => this.getWorkingDirectory(),
				getManualCliPath: (agentId) =>
					this.plugin.settings.manualAgentPaths?.[agentId],
				getPermissionSettings: () => this.plugin.settings.permission,
				saveSettings: () => this.plugin.saveSettings(),
				getMcpServers: () => this.plugin.settings.mcpServers,
				getEnvSettings: () => ({
					apiKey: this.plugin.settings.apiKey,
					apiUrl: this.plugin.settings.apiUrl,
					httpProxy: this.plugin.settings.httpProxy,
				}),
				getPromptTimeout: () => this.plugin.settings.promptTimeout,
				onPermissionRequest: (params) =>
					this.handlePermissionRequest(params),
			},
			{
				onStatusChange: (status, name) =>
					this.updateConnectionStatus(status, name),
				onConnected: (conn, sm) =>
					this.onConnectionEstablished(conn, sm),
				onError: (err) =>
					this.errorDisplay?.showError(err, "connection"),
			},
		);

		// 历史管理
		this.historyManager = new HistoryManager(this.app, {
			clearMessages: () => this.clearMessages(),
			renderMessage: (msg, isNew) => this.handleMessage(msg, isNew),
			enterHistoryMode: () => this.enterHistoryViewMode(),
			exitHistoryMode: () => this.onExitHistoryMode(),
			getMessagesHtml: () => this.messagesEl.innerHTML,
			restoreMessagesHtml: (html) => {
				this.messagesEl.innerHTML = html;
			},
			showEmptyState: () => this.showEmptyState(),
		});

		await this.historyManager.initialize();

		// 拖拽处理
		new DragDropHandler(this.app, this.inputContainerEl, {
			getInputValue: () => this.inputEl.value,
			setInputValue: (v) => {
				this.inputEl.value = v;
			},
			focusInput: () => this.inputEl.focus(),
		});
	}

	private onConnectionEstablished(
		_conn: AcpConnection,
		sm: SessionManager,
	): void {
		// 仅设置回调，会话启动由 ConnectionManager.ensureConnected 负责
		this.setupSessionCallbacks(sm);
	}

	private onExitHistoryMode(): void {
		this.inputEl.disabled = false;
		this.inputEl.placeholder = "输入消息，/ 查看命令";
		this.inputContainerEl.removeClass("acp-history-readonly");
		if (this.backToCurrentButton) {
			this.backToCurrentButton.style.display = "none";
		}
		this.sendButtonEl.style.display = "";
		// 退出历史模式后更新选择器状态
		this.updateAgentSelectorState();
	}

	// ===== UI 创建 =====

	private createHeader(container: HTMLElement): void {
		this.headerEl = container.createDiv({ cls: "acp-chat-header-compact" });

		const leftSection = this.headerEl.createDiv({ cls: "acp-header-left" });
		this.statusIndicatorEl = leftSection.createDiv({
			cls: "acp-status-dot acp-status-disconnected",
			attr: { "aria-label": "未连接" },
		});

		// Agent 选择器
		this.agentSelectorEl = leftSection.createEl("select", {
			cls: "acp-agent-select-compact",
			attr: { "aria-label": "选择 Agent" },
		});

		// 添加内置 Agent 选项
		for (const backend of getAllBackends()) {
			this.agentSelectorEl.createEl("option", {
				value: backend.id,
				text: backend.name,
			});
		}

		// 设置当前值
		this.agentSelectorEl.value = this.instanceAgentId;

		// 监听变化
		this.agentSelectorEl.addEventListener("change", async () => {
			try {
				await this.handleAgentChange();
			} catch (error) {
				logError("[ChatView] 切换 Agent 失败:", error);
				new Notice("切换 Agent 失败");
				// 恢复选择器到原值
				this.agentSelectorEl.value = this.instanceAgentId;
			}
		});

		this.connectButtonEl = leftSection.createEl("button", {
			cls: "acp-connect-btn",
			text: "连接",
		});
		this.connectButtonEl.addEventListener(
			"click",
			() => void this.handleManualConnect(),
		);

		const rightSection = this.headerEl.createDiv({
			cls: "acp-header-right",
		});

		this.historyButtonEl = rightSection.createEl("button", {
			cls: "acp-history-btn clickable-icon",
			attr: { "aria-label": "会话历史" },
		});
		setIcon(this.historyButtonEl, "history");
		this.historyButtonEl.addEventListener(
			"click",
			() => void this.showSessionHistory(),
		);

		this.exportButtonEl = rightSection.createEl("button", {
			cls: "acp-export-btn clickable-icon",
			attr: { "aria-label": "导出对话" },
		});
		setIcon(this.exportButtonEl, "download");
		this.exportButtonEl.addEventListener(
			"click",
			() => void this.handleExport(),
		);

		this.newChatButtonEl = rightSection.createEl("button", {
			cls: "acp-new-chat-btn clickable-icon",
			attr: { "aria-label": "新对话" },
		});
		setIcon(this.newChatButtonEl, "plus");
		this.newChatButtonEl.addEventListener(
			"click",
			() => void this.handleNewChat(),
		);
	}

	private createMessagesArea(container: HTMLElement): void {
		const messagesContainer = container.createDiv({
			cls: "acp-messages-container",
		});
		this.messagesEl = messagesContainer.createDiv({
			cls: "acp-chat-messages",
		});
		this.showEmptyState();

		const scrollBtn = messagesContainer.createDiv({
			cls: "acp-scroll-to-bottom",
			attr: { "aria-label": "跳到最新" },
		});
		scrollBtn.style.display = "none";
		setIcon(scrollBtn, "arrow-down");
		scrollBtn.addEventListener("click", () =>
			this.scrollHelper?.forceScrollToBottom(),
		);
		this.messagesEl.addEventListener("scroll", () =>
			this.scrollHelper?.updateScrollButton(),
		);
	}

	private createInputArea(container: HTMLElement): void {
		this.inputContainerEl = container.createDiv({ cls: "acp-chat-input" });

		this.inputEl = this.inputContainerEl.createEl("textarea", {
			cls: "acp-input-textarea",
			attr: { placeholder: "输入消息，/ 查看命令", rows: "3" },
		});

		this.setupInputKeyboard();
		this.setupInputWatcher();

		const buttonContainer = this.inputContainerEl.createDiv({
			cls: "acp-input-buttons",
		});

		// 模式选择器（注意：模型切换不支持，ACP 协议没有定义模型切换方法）
		this.modeSelectorEl = buttonContainer.createEl("select", {
			cls: "acp-mode-selector",
			attr: { "aria-label": "选择模式" },
		});
		this.modeSelectorEl.style.display = "none";
		this.modeSelectorEl.addEventListener("change", () =>
			void this.handleModeChange(),
		);

		this.sendButtonEl = buttonContainer.createEl("button", {
			cls: "acp-send-button mod-cta",
			text: "发送",
		});
		this.sendButtonEl.addEventListener(
			"click",
			() => void this.handleSend(),
		);

		this.cancelButtonEl = buttonContainer.createEl("button", {
			cls: "acp-cancel-button",
			text: "取消",
		});
		this.cancelButtonEl.style.display = "none";
		this.cancelButtonEl.addEventListener(
			"click",
			() => void this.handleCancel(),
		);

		this.backToCurrentButton = buttonContainer.createEl("button", {
			cls: "acp-back-button mod-cta",
			text: "返回当前对话",
		});
		this.backToCurrentButton.style.display = "none";
		this.backToCurrentButton.addEventListener("click", () =>
			this.historyManager?.exitHistoryView(),
		);

		this.updateUIState("idle");
		this.fileInputSuggest = new FileInputSuggest(this.app, this.inputEl);
	}

	private setupInputKeyboard(): void {
		this.inputEl.addEventListener("keydown", (e) => {
			if (this.commandMenu?.isVisible()) {
				if (e.key === "ArrowUp") {
					e.preventDefault();
					this.commandMenu.navigate("up");
					return;
				}
				if (e.key === "ArrowDown") {
					e.preventDefault();
					this.commandMenu.navigate("down");
					return;
				}
				if (e.key === "Enter" && !e.shiftKey) {
					e.preventDefault();
					this.commandMenu.select();
					return;
				}
				if (e.key === "Escape") {
					e.preventDefault();
					this.commandMenu.hide();
					return;
				}
			}

			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				void this.handleSend();
			}

			if (e.key === "ArrowUp") {
				e.preventDefault();
				const text = this.inputHistory?.navigate("up");
				if (text !== null) {
					this.inputEl.value = text;
					this.inputEl.setSelectionRange(text.length, text.length);
				}
			} else if (e.key === "ArrowDown") {
				e.preventDefault();
				const text = this.inputHistory?.navigate("down");
				if (text !== null) {
					this.inputEl.value = text;
					this.inputEl.setSelectionRange(text.length, text.length);
				}
			}
		});
	}

	private setupInputWatcher(): void {
		this.inputEl.addEventListener("input", () => {
			const value = this.inputEl.value;
			if (value.startsWith("/") || value.startsWith("、")) {
				this.commandMenu?.show(value.slice(1));
			} else {
				this.commandMenu?.hide();
			}
		});
	}

	// ===== 连接与会话 =====

	private getWorkingDirectory(): string {
		try {
			const adapter = this.plugin.app.vault.adapter;
			if (
				"getBasePath" in adapter &&
				typeof adapter.getBasePath === "function"
			) {
				const basePath = adapter.getBasePath() as unknown;
				if (typeof basePath === "string") return basePath;
			}
		} catch (error) {
			warn("[ChatView] Vault API 失败:", error);
		}

		if (this.plugin.settings.customWorkingDir)
			return this.plugin.settings.customWorkingDir;
		const cwd = process.cwd();
		if (cwd && cwd !== "/") return cwd;
		throw new Error("无法获取工作目录");
	}

	private async handleManualConnect(): Promise<void> {
		this.setInputSending(true);
		this.sendButtonEl.textContent = "连接中...";
		const success = await this.connectionManager?.ensureConnected();
		this.setInputSending(false);

		if (success) {
			this.hideEmptyState();
			this.updateUIState("idle");
			const agentName = this.getAgentDisplayName(this.instanceAgentId);
			new Notice(`已连接到 ${agentName}`);
		}
	}

	private async handleNewChat(): Promise<void> {
		// 防止重复点击
		if (this.newChatButtonEl.disabled) return;

		// 设置加载状态
		this.newChatButtonEl.disabled = true;
		this.inputEl.disabled = true;
		this.sendButtonEl.disabled = true;
		setIcon(this.newChatButtonEl, "loader-2");
		this.newChatButtonEl.addClass("acp-loading");

		try {
			this.clearMessages();
			this.currentTurnContainer = null;
			this.isFirstMessage = true;
			this.showEmptyState();

			const success = await this.connectionManager?.resetSession();
			if (success) {
				this.hideEmptyState();
				this.addSystemMessage("✨ 新对话已开始");
				new Notice("新对话已开始");
			} else {
				new Notice("输入消息开始新对话");
			}
		} finally {
			// 恢复按钮状态
			this.newChatButtonEl.disabled = false;
			this.inputEl.disabled = false;
			this.sendButtonEl.disabled = false;
			setIcon(this.newChatButtonEl, "plus");
			this.newChatButtonEl.removeClass("acp-loading");
			// 新对话后解锁 Agent 选择器
			this.updateAgentSelectorState();
		}
	}

	private async handleExport(): Promise<void> {
		const sm = this.connectionManager?.getSessionManager();
		if (!sm || sm.turns.length === 0) {
			new Notice(sm ? "对话为空，无法导出" : "没有可导出的对话");
			return;
		}

		try {
			const finalPath = await exportChatSessionMarkdown(this.app, sm);
			new Notice(`对话已导出到: ${finalPath}`);
		} catch (error) {
			logError("[ChatView] 导出失败:", error);
			new Notice("导出失败: " + (error as Error).message);
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
			const agentName = this.getAgentDisplayName(this.instanceAgentId);
			await this.historyManager?.saveSession(
				data,
				agentName,
				this.instanceAgentId,
			);
		} catch (error) {
			logError("[ChatView] 自动保存会话失败:", error);
		}
	}

	// ===== 会话回调 =====

	private setupSessionCallbacks(sm: SessionManager): void {
		sm.onMessage = (msg, isNew) => this.handleMessage(msg, isNew);
		sm.onToolCall = (tc) => this.handleToolCall(tc);
		sm.onPlan = (plan) => this.handlePlan(plan);
		sm.onThought = (thought) => this.handleThought(thought);
		sm.onStateChange = (state) => this.handleStateChange(state);
		sm.onTurnEnd = () => this.handleTurnEnd();
		sm.onError = (err) => this.handleError(err);
		sm.onCurrentModeUpdate = () => {
			/* 保存状态如需 */
		};
		sm.onAvailableCommandsUpdate = (cmds) =>
			this.commandMenu?.setCommands(cmds);
		sm.onModeStateChange = (state) => this.updateModeSelector(state);
	}

	private getTurnContainer(): HTMLElement {
		if (!this.currentTurnContainer) {
			this.currentTurnContainer = this.messagesEl.createDiv({
				cls: "acp-turn-container",
				attr: { "data-turn-id": `turn-${Date.now()}` },
			});
		}
		return this.currentTurnContainer;
	}

	private handleMessage(message: Message, isNew: boolean): void {
		const container = this.getTurnContainer();
		if (isNew) {
			void MessageRenderer.render(
				container,
				message,
				this.markdownComponent,
				this.app,
			);
		} else {
			MessageRenderer.update(
				container,
				message,
				this.markdownComponent,
				this.app,
			);
		}
		this.scrollHelper?.smartScroll();
	}

	private handleToolCall(toolCall: ToolCall): void {
		ToolCallRenderer.render(this.getTurnContainer(), toolCall, this.app);
		this.scrollHelper?.smartScroll();
	}

	private handlePlan(plan: PlanEntry[]): void {
		PlanRenderer.render(this.getTurnContainer(), plan);
		this.scrollHelper?.smartScroll();
	}

	private handleThought(_thought: string): void {
		const sm = this.connectionManager?.getSessionManager();
		const turn = sm?.activeTurn;
		if (turn) {
			ThoughtRenderer.render(this.getTurnContainer(), turn.thoughts);
			this.scrollHelper?.smartScroll();
		}
	}

	private handleStateChange(state: SessionState): void {
		this.updateUIState(state);
		if (state === "cancelled") this.addSystemMessage("⚠️ 已取消");
	}

	private handleTurnEnd(): void {
		this.currentTurnContainer = null;
		this.scrollHelper?.smartScroll();
		void this.autoSaveSession();
		// 对话开始后锁定 Agent 选择器
		this.updateAgentSelectorState();
	}

	private handleError(error: Error): void {
		logError("[ChatView] 错误:", error);
		this.addSystemMessage(`❌ 错误: ${error.message}`);
		new Notice(`错误: ${error.message}`);
	}

	private async handlePermissionRequest(
		params: RequestPermissionParams,
	): Promise<PermissionOutcome> {
		return await requestPermissionWithModal(
			this.app,
			params,
			(text) => this.addSystemMessage(text),
		);
	}

	// ===== 用户操作 =====

	private async handleSend(): Promise<void> {
		let text = this.inputEl.value.trim();
		if (!text) return;

		if (text.startsWith("、")) text = "/" + text.slice(1);

		this.setInputSending(true);
		this.sendButtonEl.textContent = "连接中...";
		const connected = await this.connectionManager?.ensureConnected();
		if (!connected) {
			this.setInputSending(false);
			return;
		}

		// 连接成功后更新 UI
		this.hideEmptyState();
		this.updateUIState("idle");

		this.inputHistory?.add(text);
		this.inputEl.value = "";

		let fullText: string | undefined;
		if (this.isFirstMessage) {
			const context = this.contextGenerator?.generate();
			if (context) fullText = `${context}\n\n---\n\n${text}`;
			this.isFirstMessage = false;
		}

		try {
			const sm = this.connectionManager?.getSessionManager();
			if (!sm) throw new Error("会话管理器未初始化");
			await sm.sendPrompt(text, fullText);
		} catch (error) {
			logError("[ChatView] 发送失败:", error);
			this.errorDisplay?.showError(error as Error, "send");
			this.setInputSending(false);
		}
	}

	private async handleCancel(): Promise<void> {
		try {
			await this.connectionManager?.getSessionManager()?.cancel();
		} catch (error) {
			logError("[ChatView] 取消失败:", error);
		}
	}

	private handleCommandClick(command: AvailableCommand): void {
		// 始终只填充输入框，不自动发送，让用户可以添加额外内容后手动发送
		if (command.input?.hint) {
			this.inputEl.value = `/${command.name} ${command.input.hint}`;
			this.inputEl.focus();
			const hintStart = `/${command.name} `.length;
			this.inputEl.setSelectionRange(
				hintStart,
				this.inputEl.value.length,
			);
		} else {
			this.inputEl.value = `/${command.name} `;
			this.inputEl.focus();
			// 光标放在末尾，用户可以继续输入
			this.inputEl.setSelectionRange(
				this.inputEl.value.length,
				this.inputEl.value.length,
			);
		}
		// 隐藏命令菜单
		this.commandMenu?.hide();
	}

	// ===== 模式选择（注意：模型切换不支持，ACP 协议没有定义模型切换方法）=====

	private updateModeSelector(state: SessionModeState): void {
		if (!this.modeSelectorEl) return;

		this.modeSelectorEl.empty();
		for (const mode of state.availableModes) {
			const option = this.modeSelectorEl.createEl("option", {
				value: mode.id,
				text: mode.name,
			});
			if (mode.id === state.currentModeId) {
				option.selected = true;
			}
		}

		this.modeSelectorEl.style.display =
			state.availableModes.length > 1 ? "" : "none";
	}

	private async handleModeChange(): Promise<void> {
		if (!this.modeSelectorEl) return;

		const modeId = this.modeSelectorEl.value;
		const sm = this.connectionManager?.getSessionManager();
		if (!sm) return;

		try {
			await sm.setMode(modeId);
			const modeName =
				sm.availableModes.find((m) => m.id === modeId)?.name || modeId;
			new Notice(`已切换模式: ${modeName}`);
		} catch (error) {
			logError("[ChatView] 切换模式失败:", error);
			new Notice("切换模式失败: " + (error as Error).message);
		}
	}

	// ===== UI 状态 =====

	private addSystemMessage(text: string): void {
		const el = this.messagesEl.createDiv({
			cls: "acp-message acp-message-system",
		});
		el.createDiv({ cls: "acp-message-content" }).textContent = text;
		this.scrollHelper?.smartScroll();
	}

	private updateUIState(sessionState?: SessionState): void {
		const state = sessionState ?? "idle";
		const isConnected = this.connectionManager?.isConnected ?? false;

		const shouldEnable = isConnected && state === "idle";
		this.inputEl.disabled = !shouldEnable;

		const isProcessing = state === "processing";
		this.sendButtonEl.style.display = isProcessing
			? "none"
			: "inline-block";
		this.cancelButtonEl.style.display = isProcessing
			? "inline-block"
			: "none";

		if (state === "idle") {
			this.setInputSending(false);
			// 清除所有残留的流式状态（光标闪烁）
			this.messagesEl
				?.querySelectorAll(".acp-message-streaming")
				.forEach((el) => el.removeClass("acp-message-streaming"));
		}
	}

	private updateConnectionStatus(
		status: "disconnected" | "connecting" | "connected" | "error",
		agentName?: string,
	): void {
		this.statusIndicatorEl.className = `acp-status-dot acp-status-${status}`;

		const tooltips: Record<string, string> = {
			disconnected: "未连接",
			connecting: `连接中: ${agentName || "Agent"}...`,
			connected: `已连接: ${agentName || "Agent"}`,
			error: "连接错误",
		};
		this.statusIndicatorEl.setAttribute("aria-label", tooltips[status]);

		if (status === "connected") {
			this.connectButtonEl.style.display = "none";
			this.errorDisplay?.clearErrors();
		} else if (status === "connecting") {
			this.connectButtonEl.textContent = "连接中...";
			this.connectButtonEl.disabled = true;
			this.connectButtonEl.style.display = "";
		} else {
			this.connectButtonEl.textContent = "连接";
			this.connectButtonEl.disabled = false;
			this.connectButtonEl.style.display = "";
		}
	}

	private setInputSending(sending: boolean): void {
		this.inputEl.disabled = sending;
		this.sendButtonEl.disabled = sending;
		this.sendButtonEl.textContent = sending ? "发送中..." : "发送";
	}

	/**
	 * 处理 Agent 切换
	 */
	private async handleAgentChange(): Promise<void> {
		if (!this.agentSelectorEl || this.isAgentLocked) return;

		const newAgentId = this.agentSelectorEl.value as AcpBackendId;

		// 验证 agentId 有效性
		const isValidAgent = getAllBackends().some((b) => b.id === newAgentId);
		if (!isValidAgent) {
			warn("[ChatView] 无效的 Agent ID:", newAgentId);
			this.agentSelectorEl.value = this.instanceAgentId;
			return;
		}

		if (newAgentId === this.instanceAgentId) return;

		// 1. 保存当前会话（如果有）
		await this.autoSaveSession();

		// 2. 断开现有连接
		this.connectionManager?.disconnect();

		// 3. 清空消息
		this.clearMessages();
		this.showEmptyState();

		// 4. 更新实例 Agent
		this.instanceAgentId = newAgentId;

		// 5. 重置锁定状态（新会话）
		this.isAgentLocked = false;
		this.updateAgentSelectorState();

		// 6. 通知用户
		const agentName = this.getAgentDisplayName(newAgentId);
		new Notice(`已切换到 ${agentName}`);
	}

	/**
	 * 更新 Agent 选择器状态（锁定/解锁）
	 */
	private updateAgentSelectorState(): void {
		if (!this.agentSelectorEl) return;

		const sm = this.connectionManager?.getSessionManager();
		const hasConversation = (sm?.turns.length ?? 0) > 0;

		this.isAgentLocked = hasConversation;
		this.agentSelectorEl.disabled = this.isAgentLocked;
		this.agentSelectorEl.title = this.isAgentLocked
			? "对话进行中，无法切换 Agent（请新建对话）"
			: "选择 Agent";
	}

	/**
	 * 获取 Agent 显示名称
	 */
	private getAgentDisplayName(id: AcpBackendId): string {
		return getBackendConfig(id).name || id;
	}

	private showEmptyState(): void {
		if (this.emptyStateEl) return;
		this.emptyStateEl = this.messagesEl.createDiv({
			cls: "acp-empty-state",
		});
		const iconEl = this.emptyStateEl.createDiv({
			cls: "acp-empty-state-icon",
		});
		setIcon(iconEl, "bot");
		this.emptyStateEl.createDiv({
			cls: "acp-empty-state-text",
			text: "输入消息开始对话",
		});
	}

	private hideEmptyState(): void {
		if (this.emptyStateEl) {
			this.emptyStateEl.remove();
			this.emptyStateEl = null;
		}
	}

	private enterHistoryViewMode(): void {
		this.inputEl.disabled = true;
		this.inputEl.placeholder = "历史会话（只读）";
		this.inputContainerEl.addClass("acp-history-readonly");
		this.sendButtonEl.style.display = "none";
		if (this.backToCurrentButton)
			this.backToCurrentButton.style.display = "";
	}

	// ===== 会话历史 =====

	public async getSessionHistory(): Promise<SessionMeta[]> {
		return (await this.historyManager?.listSessions()) ?? [];
	}

	public async loadHistorySession(sessionId: string): Promise<boolean> {
		const loaded = (await this.historyManager?.loadSession(sessionId)) ?? false;
		if (loaded) {
			// 加载成功后，检查是否需要恢复 Agent
			const storedSession =
				await this.historyManager?.getStoredSession(sessionId);
			if (storedSession?.meta.agentId) {
				const sessionAgentId = storedSession.meta.agentId;
				// 如果历史会话的 Agent 与当前不同，切换到历史 Agent
				if (sessionAgentId !== this.instanceAgentId) {
					this.instanceAgentId = sessionAgentId;
					if (this.agentSelectorEl) {
						this.agentSelectorEl.value = this.instanceAgentId;
					}
				}
			}
			// 历史模式锁定选择器
			this.updateAgentSelectorState();
		}
		return loaded;
	}

	public async deleteHistorySession(sessionId: string): Promise<boolean> {
		return (await this.historyManager?.deleteSession(sessionId)) ?? false;
	}

	private async showSessionHistory(): Promise<void> {
		try {
			const sessions = (await this.historyManager?.listSessions()) ?? [];
			new SessionHistoryModal(this.app, sessions, {
				onSelect: (id) => this.loadHistorySession(id),
				onDelete: (id) => this.deleteHistorySession(id),
				onRefresh: () =>
					this.historyManager?.listSessions() ?? Promise.resolve([]),
			}).open();
		} catch (error) {
			logError("[ChatView] 打开会话历史失败:", error);
			new Notice("无法打开会话历史");
		}
	}

	// ===== 公共方法 =====

	public appendText(text: string): void {
		this.inputEl.value += text;
		this.inputEl.focus();
		this.inputEl.scrollTop = this.inputEl.scrollHeight;
	}
}
