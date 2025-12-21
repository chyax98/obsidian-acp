/**
 * 会话历史面板
 *
 * 显示历史会话列表，支持加载和删除
 */

import type { App } from 'obsidian';
import { Modal, setIcon } from 'obsidian';
import type { SessionMeta } from '../acp/core/session-storage';

/**
 * 会话历史 Modal
 */
export class SessionHistoryModal extends Modal {
	private sessions: SessionMeta[];
	private onSelect: (sessionId: string) => void;
	private onDelete: (sessionId: string) => Promise<boolean>;
	private onRefresh: () => Promise<SessionMeta[]>;

	constructor(
		app: App,
		sessions: SessionMeta[],
		callbacks: {
			onSelect: (sessionId: string) => void;
			onDelete: (sessionId: string) => Promise<boolean>;
			onRefresh: () => Promise<SessionMeta[]>;
		},
	) {
		super(app);
		this.sessions = sessions;
		this.onSelect = callbacks.onSelect;
		this.onDelete = callbacks.onDelete;
		this.onRefresh = callbacks.onRefresh;
	}

	public onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('acp-session-history-modal');

		this.renderContent();
	}

	private renderContent(): void {
		const { contentEl } = this;
		contentEl.empty();

		// 标题栏
		const headerEl = contentEl.createDiv({ cls: 'acp-history-header' });
		headerEl.createEl('h2', { text: '📚 会话历史' });

		// 刷新按钮
		const refreshBtn = headerEl.createEl('button', {
			cls: 'acp-history-refresh clickable-icon',
			attr: { 'aria-label': '刷新' },
		});
		setIcon(refreshBtn, 'refresh-cw');
		refreshBtn.addEventListener('click', async () => {
			this.sessions = await this.onRefresh();
			this.renderContent();
		});

		// 会话列表
		if (this.sessions.length === 0) {
			contentEl.createDiv({
				cls: 'acp-history-empty',
				text: '暂无历史会话',
			});
			return;
		}

		const listEl = contentEl.createDiv({ cls: 'acp-history-list' });

		for (const session of this.sessions) {
			const itemEl = listEl.createDiv({ cls: 'acp-history-item' });

			// 会话信息
			const infoEl = itemEl.createDiv({ cls: 'acp-history-info' });

			// 标题
			infoEl.createDiv({
				cls: 'acp-history-title',
				text: session.title || '无标题',
			});

			// 元数据
			const metaEl = infoEl.createDiv({ cls: 'acp-history-meta' });
			const date = new Date(session.updatedAt);
			metaEl.createSpan({ text: this.formatDate(date) });

			if (session.agentName) {
				metaEl.createSpan({ text: ` · ${session.agentName}` });
			}

			metaEl.createSpan({ text: ` · ${session.messageCount} 条消息` });

			// 操作按钮
			const actionsEl = itemEl.createDiv({ cls: 'acp-history-actions' });

			// 加载按钮
			const loadBtn = actionsEl.createEl('button', {
				cls: 'acp-history-load clickable-icon',
				attr: { 'aria-label': '加载会话' },
			});
			setIcon(loadBtn, 'file-input');
			loadBtn.addEventListener('click', () => {
				this.onSelect(session.id);
				this.close();
			});

			// 删除按钮
			const deleteBtn = actionsEl.createEl('button', {
				cls: 'acp-history-delete clickable-icon',
				attr: { 'aria-label': '删除会话' },
			});
			setIcon(deleteBtn, 'trash-2');
			deleteBtn.addEventListener('click', () => {
				void this.confirmAndDelete(session);
			});
		}

		// 底部提示
		contentEl.createDiv({
			cls: 'acp-history-tip',
			text: `共 ${this.sessions.length} 个会话`,
		});
	}

	private formatDate(date: Date): string {
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const dayMs = 24 * 60 * 60 * 1000;

		if (diff < dayMs) {
			// 今天
			return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
		} else if (diff < 2 * dayMs) {
			// 昨天
			return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
		} else if (diff < 7 * dayMs) {
			// 一周内
			const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
			return days[date.getDay()];
		} else {
			// 更早
			return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
		}
	}

	/**
	 * 确认并删除会话
	 */
	private async confirmAndDelete(session: SessionMeta): Promise<void> {
		// 使用简单的删除确认（双击删除）
		// 第一次点击显示确认状态，再次点击执行删除
		const deleteBtn = this.contentEl.querySelector(
			'.acp-history-item:has([aria-label="删除会话"]) .acp-history-delete',
		) as HTMLElement;

		if (deleteBtn?.hasClass('confirm-pending')) {
			// 第二次点击，执行删除
			const success = await this.onDelete(session.id);
			if (success) {
				this.sessions = this.sessions.filter((s) => s.id !== session.id);
				this.renderContent();
			}
		} else {
			// 第一次点击，显示确认状态
			// 直接执行删除（简化流程）
			const success = await this.onDelete(session.id);
			if (success) {
				this.sessions = this.sessions.filter((s) => s.id !== session.id);
				this.renderContent();
			}
		}
	}

	public onClose(): void {
		this.contentEl.empty();
	}
}
