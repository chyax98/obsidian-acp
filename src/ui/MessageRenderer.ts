/**
 * 消息渲染器
 *
 * 负责渲染聊天消息，支持：
 * - Markdown 渲染（使用 Obsidian MarkdownRenderer）
 * - 代码块语法高亮
 * - 工具调用卡片（基础版）
 * - 计划显示
 */

import { MarkdownRenderer, Component, setIcon, App } from 'obsidian';
import type { Message, ToolCall, PlanEntry } from '../acp/core/session-manager';

// ============================================================================
// MessageRenderer 类
// ============================================================================

/**
 * 消息渲染器
 *
 * 提供静态方法用于渲染各种类型的消息内容。
 */
export class MessageRenderer {
	// ========================================================================
	// 主要渲染方法
	// ========================================================================

	/**
	 * 渲染消息
	 *
	 * @param container - 容器元素
	 * @param message - 消息对象
	 * @param component - Obsidian Component（用于生命周期管理）
	 * @param app - Obsidian App 实例
	 * @param sourcePath - Markdown 源路径（可选）
	 */
	static async renderMessage(
		container: HTMLElement,
		message: Message,
		component: Component,
		app: App,
		sourcePath: string = ''
	): Promise<void> {
		// 清空容器
		container.empty();

		// 创建消息结构
		const messageEl = container.createDiv({
			cls: `acp-message acp-message-${message.role}`,
			attr: { 'data-message-id': message.id },
		});

		// 消息头部（显示角色）
		const headerEl = messageEl.createDiv({ cls: 'acp-message-header' });
		headerEl.textContent = message.role === 'user' ? '你' : 'Agent';

		// 消息内容容器
		const contentEl = messageEl.createDiv({ cls: 'acp-message-content' });

		// 判断是否为 Markdown 内容
		if (message.content && message.content.trim()) {
			try {
				// 使用 Obsidian MarkdownRenderer 渲染
				await MarkdownRenderer.render(
					app,
					message.content,
					contentEl,
					sourcePath,
					component
				);
			} catch (error) {
				console.error('[MessageRenderer] Markdown 渲染失败:', error);
				// 降级：直接显示文本
				contentEl.textContent = message.content;
			}
		}

		// 如果正在流式输出，添加光标效果
		if (message.isStreaming) {
			contentEl.addClass('acp-message-streaming');
		}
	}

	/**
	 * 更新消息内容
	 *
	 * @param container - 容器元素
	 * @param message - 消息对象
	 * @param component - Obsidian Component
	 * @param app - Obsidian App 实例
	 * @param sourcePath - Markdown 源路径（可选）
	 */
	static async updateMessage(
		container: HTMLElement,
		message: Message,
		component: Component,
		app: App,
		sourcePath: string = ''
	): Promise<void> {
		const messageEl = container.querySelector(`[data-message-id="${message.id}"]`);
		if (!messageEl) {
			console.warn('[MessageRenderer] 找不到消息元素:', message.id);
			return;
		}

		const contentEl = messageEl.querySelector('.acp-message-content') as HTMLElement;
		if (!contentEl) {
			console.warn('[MessageRenderer] 找不到消息内容元素:', message.id);
			return;
		}

		// 清空并重新渲染
		contentEl.empty();

		if (message.content && message.content.trim()) {
			try {
				await MarkdownRenderer.render(
					app,
					message.content,
					contentEl,
					sourcePath,
					component
				);
			} catch (error) {
				console.error('[MessageRenderer] Markdown 更新失败:', error);
				contentEl.textContent = message.content;
			}
		}

		// 更新流式状态
		if (message.isStreaming) {
			contentEl.addClass('acp-message-streaming');
		} else {
			contentEl.removeClass('acp-message-streaming');
		}
	}

	// ========================================================================
	// 工具调用渲染
	// ========================================================================

	/**
	 * 渲染工具调用卡片（基础版）
	 *
	 * 注意：完整的工具调用渲染将在 T12 实现。
	 * 这里仅提供基础卡片显示。
	 *
	 * @param container - 容器元素
	 * @param toolCall - 工具调用对象
	 * @returns 工具调用元素
	 */
	static renderToolCall(container: HTMLElement, toolCall: ToolCall): HTMLElement {
		// 查找是否已存在
		let toolCallEl = container.querySelector(
			`[data-tool-call-id="${toolCall.toolCallId}"]`
		) as HTMLElement;

		if (toolCallEl) {
			// 更新现有卡片
			this.updateToolCallCard(toolCallEl, toolCall);
			return toolCallEl;
		}

		// 创建新卡片
		toolCallEl = container.createDiv({
			cls: 'acp-tool-call',
			attr: { 'data-tool-call-id': toolCall.toolCallId },
		});

		// 卡片头部
		const headerEl = toolCallEl.createDiv({ cls: 'acp-tool-call-header' });

		// 状态图标
		const iconEl = headerEl.createDiv({ cls: 'acp-tool-call-icon' });
		this.setToolCallIcon(iconEl, toolCall.status);

		// 标题
		const titleEl = headerEl.createDiv({ cls: 'acp-tool-call-title' });
		titleEl.textContent = toolCall.title || '工具调用';

		// 类型标签
		const kindEl = headerEl.createDiv({ cls: 'acp-tool-call-kind' });
		kindEl.textContent = this.formatToolKind(toolCall.kind);

		// 内容区域（默认折叠）
		const contentEl = toolCallEl.createDiv({
			cls: 'acp-tool-call-content',
			attr: { 'data-expanded': 'false' },
		});

		// 渲染内容
		this.renderToolCallContent(contentEl, toolCall);

		// 点击头部切换折叠/展开
		headerEl.addEventListener('click', () => {
			const expanded = contentEl.getAttribute('data-expanded') === 'true';
			contentEl.setAttribute('data-expanded', expanded ? 'false' : 'true');
			contentEl.toggleClass('acp-tool-call-content-expanded', !expanded);
		});

		return toolCallEl;
	}

	/**
	 * 更新工具调用卡片
	 */
	private static updateToolCallCard(toolCallEl: HTMLElement, toolCall: ToolCall): void {
		// 更新图标
		const iconEl = toolCallEl.querySelector('.acp-tool-call-icon');
		if (iconEl) {
			this.setToolCallIcon(iconEl as HTMLElement, toolCall.status);
		}

		// 更新标题
		const titleEl = toolCallEl.querySelector('.acp-tool-call-title');
		if (titleEl) {
			titleEl.textContent = toolCall.title || '工具调用';
		}

		// 更新内容
		const contentEl = toolCallEl.querySelector('.acp-tool-call-content');
		if (contentEl) {
			contentEl.empty();
			this.renderToolCallContent(contentEl as HTMLElement, toolCall);
		}
	}

	/**
	 * 设置工具调用图标
	 */
	private static setToolCallIcon(iconEl: HTMLElement, status: ToolCall['status']): void {
		iconEl.empty();
		iconEl.className = `acp-tool-call-icon acp-tool-call-status-${status}`;

		let iconName: string;
		switch (status) {
			case 'pending':
				iconName = 'clock';
				break;
			case 'in_progress':
				iconName = 'loader-2';
				break;
			case 'completed':
				iconName = 'check-circle';
				break;
			case 'error':
				iconName = 'x-circle';
				break;
			case 'cancelled':
				iconName = 'x';
				break;
			default:
				iconName = 'help-circle';
		}

		setIcon(iconEl, iconName);
	}

	/**
	 * 格式化工具类型
	 */
	private static formatToolKind(kind: string): string {
		const kindMap: Record<string, string> = {
			bash: 'Bash',
			read: '读取',
			write: '写入',
			edit: '编辑',
			grep: '搜索',
			other: '其他',
		};
		return kindMap[kind] || kind;
	}

	/**
	 * 渲染工具调用内容
	 */
	private static renderToolCallContent(contentEl: HTMLElement, toolCall: ToolCall): void {
		if (!toolCall.content || toolCall.content.length === 0) {
			contentEl.createDiv({
				cls: 'acp-tool-call-empty',
				text: '（无内容）',
			});
			return;
		}

		// 渲染每个内容块
		for (const content of toolCall.content) {
			const blockEl = contentEl.createDiv({ cls: 'acp-tool-call-content-block' });

			switch (content.type) {
				case 'content':
					blockEl.addClass('acp-tool-call-content-text');
					// content 类型有嵌套的 content 属性
					const textContent = content.content;
					if (textContent && textContent.type === 'text') {
						blockEl.textContent = textContent.text || '';
					}
					break;

				case 'diff':
					blockEl.addClass('acp-tool-call-content-diff');
					// 构建 diff 字符串
					const diffText = this.buildDiffString(content);
					this.renderDiff(blockEl, diffText);
					break;

				case 'terminal':
					blockEl.addClass('acp-tool-call-content-terminal');
					const terminalEl = blockEl.createEl('pre');
					terminalEl.createEl('code', { text: content.terminalId });
					break;

				default:
					blockEl.textContent = JSON.stringify(content, null, 2);
			}
		}
	}

	/**
	 * 构建 diff 字符串
	 */
	private static buildDiffString(diffContent: { oldText?: string | null; newText?: string; path?: string }): string {
		const lines: string[] = [];

		if (diffContent.path) {
			lines.push(`--- ${diffContent.path}`);
			lines.push(`+++ ${diffContent.path}`);
		}

		if (diffContent.oldText) {
			const oldLines = diffContent.oldText.split('\n');
			for (const line of oldLines) {
				lines.push(`-${line}`);
			}
		}

		if (diffContent.newText) {
			const newLines = diffContent.newText.split('\n');
			for (const line of newLines) {
				lines.push(`+${line}`);
			}
		}

		return lines.join('\n');
	}

	/**
	 * 渲染 diff 内容
	 */
	private static renderDiff(container: HTMLElement, diff: string): void {
		const lines = diff.split('\n');
		const preEl = container.createEl('pre', { cls: 'acp-diff' });

		for (const line of lines) {
			const lineEl = preEl.createEl('div', { cls: 'acp-diff-line' });

			if (line.startsWith('+')) {
				lineEl.addClass('acp-diff-added');
			} else if (line.startsWith('-')) {
				lineEl.addClass('acp-diff-removed');
			} else if (line.startsWith('@@')) {
				lineEl.addClass('acp-diff-hunk');
			}

			lineEl.textContent = line;
		}
	}

	// ========================================================================
	// 计划渲染
	// ========================================================================

	/**
	 * 渲染计划
	 *
	 * @param container - 容器元素
	 * @param plan - 计划条目列表
	 * @returns 计划元素
	 */
	static renderPlan(container: HTMLElement, plan: PlanEntry[]): HTMLElement {
		// 查找是否已存在
		let planEl = container.querySelector('.acp-plan') as HTMLElement;

		if (planEl) {
			// 清空并重新渲染
			planEl.empty();
		} else {
			// 创建新元素
			planEl = container.createDiv({ cls: 'acp-plan' });
		}

		// 标题
		const headerEl = planEl.createDiv({ cls: 'acp-plan-header' });
		const iconEl = headerEl.createDiv({ cls: 'acp-plan-icon' });
		setIcon(iconEl, 'list-tree');
		headerEl.createDiv({ cls: 'acp-plan-title', text: '执行计划' });

		// 条目列表
		const listEl = planEl.createDiv({ cls: 'acp-plan-list' });

		for (const entry of plan) {
			const entryEl = listEl.createDiv({
				cls: `acp-plan-entry acp-plan-entry-${entry.status}`,
			});

			// 状态图标
			const statusIconEl = entryEl.createDiv({ cls: 'acp-plan-entry-icon' });
			this.setPlanEntryIcon(statusIconEl, entry.status);

			// 内容
			const contentEl = entryEl.createDiv({ cls: 'acp-plan-entry-content' });
			contentEl.textContent = entry.content;

			// 优先级标签（可选）
			if (entry.priority && entry.priority !== 'normal') {
				const priorityEl = entryEl.createDiv({
					cls: `acp-plan-entry-priority acp-plan-priority-${entry.priority}`,
				});
				priorityEl.textContent = this.formatPriority(entry.priority);
			}
		}

		return planEl;
	}

	/**
	 * 设置计划条目图标
	 */
	private static setPlanEntryIcon(iconEl: HTMLElement, status: string): void {
		iconEl.empty();

		let iconName: string;
		switch (status) {
			case 'pending':
				iconName = 'circle';
				break;
			case 'in_progress':
				iconName = 'loader-2';
				break;
			case 'completed':
				iconName = 'check-circle-2';
				break;
			case 'cancelled':
				iconName = 'x-circle';
				break;
			default:
				iconName = 'circle';
		}

		setIcon(iconEl, iconName);
	}

	/**
	 * 格式化优先级
	 */
	private static formatPriority(priority: string): string {
		const priorityMap: Record<string, string> = {
			high: '高',
			normal: '普通',
			low: '低',
		};
		return priorityMap[priority] || priority;
	}
}
