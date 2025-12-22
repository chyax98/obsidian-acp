/**
 * 会话历史管理辅助类
 *
 * 处理会话的保存、加载和历史浏览
 */

import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import { SessionStorage, type SessionMeta } from '../../../acp/core/session-storage';
import type { SessionExportData, Message } from '../../../acp/core/session-manager';

/**
 * 历史管理回调
 */
export interface HistoryManagerCallbacks {
	/** 清空消息 */
	clearMessages: () => void;
	/** 渲染消息 */
	renderMessage: (message: Message, isNew: boolean) => void;
	/** 进入历史模式 */
	enterHistoryMode: () => void;
	/** 退出历史模式 */
	exitHistoryMode: () => void;
	/** 获取当前消息 HTML */
	getMessagesHtml: () => string;
	/** 恢复消息 HTML */
	restoreMessagesHtml: (html: string) => void;
	/** 显示空状态 */
	showEmptyState: () => void;
}

/**
 * 会话历史管理器
 */
export class HistoryManager {
	private app: App;
	private storage: SessionStorage;
	private callbacks: HistoryManagerCallbacks;

	private isViewingHistory: boolean = false;
	private savedMessagesHtml: string | null = null;
	private currentSessionId: string | null = null;

	constructor(app: App, callbacks: HistoryManagerCallbacks) {
		this.app = app;
		this.storage = new SessionStorage(app);
		this.callbacks = callbacks;
	}

	/**
	 * 初始化存储
	 */
	public async initialize(): Promise<void> {
		await this.storage.initialize();
	}

	/**
	 * 是否正在查看历史
	 */
	public get isViewing(): boolean {
		return this.isViewingHistory;
	}

	/**
	 * 获取当前会话 ID
	 */
	public getCurrentSessionId(): string | null {
		return this.currentSessionId;
	}

	/**
	 * 保存当前会话
	 */
	public async saveSession(data: SessionExportData, agentName: string): Promise<string | null> {
		try {
			this.currentSessionId = await this.storage.saveSession(data, agentName);
			return this.currentSessionId;
		} catch (error) {
			console.error('[HistoryManager] 保存会话失败:', error);
			return null;
		}
	}

	/**
	 * 获取会话列表
	 */
	public async listSessions(): Promise<SessionMeta[]> {
		return await this.storage.listSessions();
	}

	/**
	 * 加载历史会话
	 */
	public async loadSession(sessionId: string): Promise<boolean> {
		try {
			const storedSession = await this.storage.loadSession(sessionId);
			if (!storedSession) {
				new Notice('会话不存在');
				return false;
			}

			// 保存当前对话
			if (!this.isViewingHistory) {
				const html = this.callbacks.getMessagesHtml();
				if (html) {
					this.savedMessagesHtml = html;
				}
			}

			this.isViewingHistory = true;
			this.callbacks.clearMessages();

			// 渲染历史消息
			for (const turn of storedSession.turns) {
				this.callbacks.renderMessage(turn.userMessage, true);
				if (turn.assistantMessage) {
					this.callbacks.renderMessage(turn.assistantMessage, true);
				}
			}

			this.callbacks.enterHistoryMode();
			new Notice('查看历史会话（只读）');
			return true;
		} catch (error) {
			console.error('[HistoryManager] 加载会话失败:', error);
			new Notice('加载会话失败');
			return false;
		}
	}

	/**
	 * 退出历史查看模式
	 */
	public exitHistoryView(): void {
		this.isViewingHistory = false;
		this.callbacks.exitHistoryMode();
		this.callbacks.clearMessages();

		if (this.savedMessagesHtml) {
			this.callbacks.restoreMessagesHtml(this.savedMessagesHtml);
			this.savedMessagesHtml = null;
		} else {
			this.callbacks.showEmptyState();
		}

		new Notice('已返回当前对话');
	}

	/**
	 * 删除会话
	 */
	public async deleteSession(sessionId: string): Promise<boolean> {
		const success = await this.storage.deleteSession(sessionId);
		if (success) {
			new Notice('会话已删除');
		}
		return success;
	}
}
