/**
 * 消息渲染器
 *
 * 负责渲染聊天消息，支持：
 * - Markdown 渲染（使用 Obsidian MarkdownRenderer）
 * - 代码块语法高亮
 * - 工具调用卡片（增强版，T12）
 * - 计划显示
 *
 * T12 增强：
 * - 显示工具执行时间和持续时长
 * - 显示输入参数和输出结果
 * - 带行号的 Diff 渲染
 * - 复制按钮和文件路径点击
 */

import type { Component, App } from 'obsidian';
import { MarkdownRenderer, setIcon, Notice, Modal, MarkdownView } from 'obsidian';
import type { Message, ToolCall, PlanEntry, Turn } from '../acp/core/session-manager';

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
		sourcePath: string = '',
	): Promise<void> {
		// 不清空容器！直接添加新消息

		// 创建消息结构（包装容器）
		const messageEl = container.createDiv({
			cls: `acp-message acp-message-${message.role}`,
			attr: { 'data-message-id': message.id },
		});

		// Phase 4: 时间戳
		if (message.timestamp) {
			const timestampEl = messageEl.createDiv({ cls: 'acp-message-timestamp' });
			timestampEl.textContent = this.formatTimestamp(message.timestamp);
			timestampEl.setAttribute('title', new Date(message.timestamp).toLocaleString());
		}

		// 消息内容容器（不显示发送者,通过位置区分）
		const contentEl = messageEl.createDiv({ cls: 'acp-message-content' });

		// 判断是否为 Markdown 内容
		if (message.content && message.content.trim()) {
			// 检查是否包含图片占位符（从 handleAgentMessageChunk 生成的）
			const imagePattern = /!\[图像\]\((data:[^)]+|https?:[^)]+|file:[^)]+)\)/g;
			const hasImages = imagePattern.test(message.content);

			if (hasImages) {
				// 如果有图片，需要特殊处理
				await this.renderContentWithImages(contentEl, message.content, app, sourcePath, component);
			} else {
				try {
					// 使用 Obsidian MarkdownRenderer 渲染
					await MarkdownRenderer.render(
						app,
						message.content,
						contentEl,
						sourcePath,
						component,
					);
				} catch (error) {
					console.error('[MessageRenderer] Markdown 渲染失败:', error);
					// 降级：直接显示文本
					contentEl.textContent = message.content;
				}
			}
		}

		// 如果正在流式输出，添加光标效果
		if (message.isStreaming) {
			contentEl.addClass('acp-message-streaming');
		}

		// 添加消息操作栏（复制按钮）
		this.addMessageActions(messageEl, message);
	}

	/**
	 * 渲染包含图片的内容
	 *
	 * @param container - 容器元素
	 * @param content - 消息内容
	 * @param app - Obsidian App 实例
	 * @param sourcePath - Markdown 源路径
	 * @param component - Obsidian Component
	 */
	private static async renderContentWithImages(
		container: HTMLElement,
		content: string,
		app: App,
		sourcePath: string,
		component: Component,
	): Promise<void> {
		// 分割内容为文本和图片部分
		const imagePattern = /!\[图像\]\((data:[^)]+|https?:[^)]+|file:[^)]+)\)/g;
		let lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = imagePattern.exec(content)) !== null) {
			// 渲染之前的文本
			const textBefore = content.substring(lastIndex, match.index);
			if (textBefore.trim()) {
				try {
					await MarkdownRenderer.render(app, textBefore, container, sourcePath, component);
				} catch (error) {
					console.error('[MessageRenderer] Markdown 渲染失败:', error);
					container.createDiv({ text: textBefore });
				}
			}

			// 渲染图片
			const imageUri = match[1];
			this.renderImage(container, imageUri, app);

			lastIndex = match.index + match[0].length;
		}

		// 渲染剩余文本
		const textAfter = content.substring(lastIndex);
		if (textAfter.trim()) {
			try {
				await MarkdownRenderer.render(app, textAfter, container, sourcePath, component);
			} catch (error) {
				console.error('[MessageRenderer] Markdown 渲染失败:', error);
				container.createDiv({ text: textAfter });
			}
		}
	}

	/**
	 * 渲染图片（支持 data URI, HTTP/HTTPS URI, file:// URI）
	 *
	 * @param container - 容器元素
	 * @param uri - 图片 URI
	 * @param app - Obsidian App 实例
	 */
	private static renderImage(container: HTMLElement, uri: string, app: App): void {
		const imageWrapper = container.createDiv({ cls: 'acp-content-image-wrapper' });

		const imgEl = imageWrapper.createEl('img', { cls: 'acp-content-image' });
		imgEl.alt = '图像';

		// 处理不同类型的 URI
		if (uri.startsWith('data:')) {
			// Base64 data URI - 直接使用
			imgEl.src = uri;
		} else if (uri.startsWith('http://') || uri.startsWith('https://')) {
			// HTTP/HTTPS URI - 直接使用
			imgEl.src = uri;
		} else if (uri.startsWith('file://')) {
			// file:// URI - 需要转换为相对路径或使用 Obsidian API
			const filePath = uri.replace('file://', '');

			// 尝试通过 Obsidian Vault 读取
			const file = app.vault.getAbstractFileByPath(filePath);
			if (file && 'path' in file) {
				// 使用 Obsidian 的资源路径
				imgEl.src = app.vault.adapter.getResourcePath(file.path);
			} else {
				// 降级：直接使用 file URI（可能在某些环境下工作）
				imgEl.src = uri;
			}
		} else {
			// 其他情况 - 尝试作为相对路径处理
			imgEl.src = uri;
		}

		// 添加加载状态
		imgEl.addClass('acp-image-loading');

		imgEl.addEventListener('load', () => {
			imgEl.removeClass('acp-image-loading');
			imgEl.addClass('acp-image-loaded');
		});

		imgEl.addEventListener('error', () => {
			imgEl.removeClass('acp-image-loading');
			imgEl.addClass('acp-image-error');

			// 显示错误占位符
			imageWrapper.empty();
			const errorEl = imageWrapper.createDiv({ cls: 'acp-image-error-placeholder' });
			const iconEl = errorEl.createDiv({ cls: 'acp-image-error-icon' });
			setIcon(iconEl, 'image-off');
			errorEl.createDiv({ cls: 'acp-image-error-text', text: '图片加载失败' });
		});

		// 点击图片预览（使用简单的放大效果）
		imgEl.addEventListener('click', () => {
			this.showImagePreview(imgEl.src, app);
		});
	}

	/**
	 * 显示图片预览
	 *
	 * @param src - 图片源
	 * @param app - Obsidian App 实例
	 */
	private static showImagePreview(src: string, app: App): void {
		// 创建简单的模态框显示大图
		const modal = new ImagePreviewModal(app, src);
		modal.open();
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
		sourcePath: string = '',
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
					component,
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

	/**
	 * 添加消息操作按钮（复制等）
	 */
	private static addMessageActions(messageEl: HTMLElement, message: Message): void {
		// 创建操作栏容器
		const actionsEl = messageEl.createDiv({ cls: 'acp-message-actions' });

		// 复制按钮
		const copyBtn = actionsEl.createDiv({
			cls: 'acp-message-copy-btn',
			attr: { 'aria-label': '复制消息' },
		});
		setIcon(copyBtn, 'copy');

		copyBtn.addEventListener('click', async (e) => {
			e.stopPropagation();
			const text = message.content || '';
			if (text) {
				await navigator.clipboard.writeText(text);
				new Notice('已复制消息');

				// 临时切换图标
				copyBtn.empty();
				setIcon(copyBtn, 'check');
				setTimeout(() => {
					copyBtn.empty();
					setIcon(copyBtn, 'copy');
				}, 1500);
			}
		});
	}

	// ========================================================================
	// 工具调用渲染
	// ========================================================================

	/**
	 * 渲染工具调用卡片（增强版，T12）
	 *
	 * @param container - 容器元素
	 * @param toolCall - 工具调用对象
	 * @param app - Obsidian App 实例（用于文件跳转）
	 * @returns 工具调用元素
	 */
	static renderToolCall(container: HTMLElement, toolCall: ToolCall, app?: App): HTMLElement {
		// 查找是否已存在
		let toolCallEl = container.querySelector(
			`[data-tool-call-id="${toolCall.toolCallId}"]`,
		) as HTMLElement;

		if (toolCallEl) {
			// 更新现有卡片
			this.updateToolCallCard(toolCallEl, toolCall);
			return toolCallEl;
		}

		// 创建新卡片
		toolCallEl = container.createDiv({
			cls: `acp-tool-call acp-tool-call-status-${toolCall.status}`,
			attr: { 'data-tool-call-id': toolCall.toolCallId },
		});

		// 卡片头部
		const headerEl = toolCallEl.createDiv({ cls: 'acp-tool-call-header' });

		// 状态图标
		const iconEl = headerEl.createDiv({ cls: 'acp-tool-call-icon' });
		this.setToolCallIcon(iconEl, toolCall.status);

		// 标题容器（包含标题和时间）
		const titleContainerEl = headerEl.createDiv({ cls: 'acp-tool-call-title-container' });

		// 标题
		const titleEl = titleContainerEl.createDiv({ cls: 'acp-tool-call-title' });
		titleEl.textContent = toolCall.title || '工具调用';

		// 时间信息（T12 增强）
		const timeEl = titleContainerEl.createDiv({ cls: 'acp-tool-call-time' });
		timeEl.textContent = this.formatToolCallTime(toolCall);

		// 类型标签
		const kindEl = headerEl.createDiv({ cls: 'acp-tool-call-kind' });
		kindEl.textContent = this.formatToolKind(toolCall.kind);

		// 内容区域（默认折叠）
		const contentEl = toolCallEl.createDiv({
			cls: 'acp-tool-call-content',
			attr: { 'data-expanded': 'false' },
		});

		// 渲染内容（T12 增强：传递 app）
		this.renderToolCallContent(contentEl, toolCall, app);

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
		// 更新状态类
		toolCallEl.className = `acp-tool-call acp-tool-call-status-${toolCall.status}`;

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

		// 更新时间
		const timeEl = toolCallEl.querySelector('.acp-tool-call-time');
		if (timeEl) {
			timeEl.textContent = this.formatToolCallTime(toolCall);
		}

		// 更新内容
		const contentEl = toolCallEl.querySelector('.acp-tool-call-content');
		if (contentEl) {
			contentEl.empty();
			this.renderToolCallContent(contentEl as HTMLElement, toolCall, undefined);
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
			case 'failed':
				iconName = 'x-circle';
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
			execute: '执行',
			read: '读取',
			write: '写入',
			edit: '编辑',
			patch: '编辑',
			grep: '搜索',
			glob: '搜索',
			mcp: 'MCP',
			web_search: '搜索',
			other: '其他',
		};
		return kindMap[kind] || kind;
	}

	/**
	 * 格式化工具调用时间（T12 增强）
	 */
	private static formatToolCallTime(toolCall: ToolCall): string {
		if (toolCall.endTime) {
			const duration = toolCall.endTime - toolCall.startTime;
			return this.formatDuration(duration);
		}

		if (toolCall.status === 'in_progress') {
			return '执行中...';
		}

		return '等待中';
	}

	/**
	 * 格式化持续时间
	 */
	private static formatDuration(ms: number): string {
		if (ms < 1000) {
			return `${ms}ms`;
		}
		if (ms < 60000) {
			return `${(ms / 1000).toFixed(1)}s`;
		}
		const minutes = Math.floor(ms / 60000);
		const seconds = ((ms % 60000) / 1000).toFixed(0);
		return `${minutes}m ${seconds}s`;
	}

	/**
	 * 渲染工具调用内容（T12 增强）
	 */
	private static renderToolCallContent(contentEl: HTMLElement, toolCall: ToolCall, app?: App): void {
		// 渲染 locations（如果存在）
		if (toolCall.locations && toolCall.locations.length > 0 && app) {
			this.renderToolCallLocations(contentEl, toolCall.locations, app);
		}

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
				case 'content': {
					blockEl.addClass('acp-tool-call-content-text');
					// content 类型有嵌套的 content 属性
					const textContent = content.content;
					if (textContent && textContent.type === 'text') {
						// T12 增强：添加复制按钮
						this.renderTextContentWithCopy(blockEl, textContent.text || '');
					}
					break;
				}

				case 'diff':
					blockEl.addClass('acp-tool-call-content-diff');
					// T12 增强：带行号和文件路径点击的 diff
					this.renderDiffEnhanced(blockEl, content, app);
					break;

				case 'terminal':
					blockEl.addClass('acp-tool-call-content-terminal');
					// T12 增强：添加复制按钮
					this.renderTerminalOutput(blockEl, content.terminalId);
					break;

				default:
					blockEl.textContent = JSON.stringify(content, null, 2);
			}
		}
	}

	/**
	 * 渲染工具调用位置列表
	 *
	 * @param container - 容器元素
	 * @param locations - 位置列表
	 * @param app - Obsidian App 实例
	 */
	private static renderToolCallLocations(
		container: HTMLElement,
		locations: Array<{ path: string; line?: number; column?: number }>,
		app: App,
	): void {
		const locationsContainer = container.createDiv({ cls: 'acp-tool-call-locations' });

		// 标题
		const headerEl = locationsContainer.createDiv({ cls: 'acp-tool-call-locations-header' });
		const iconEl = headerEl.createDiv({ cls: 'acp-tool-call-locations-icon' });
		setIcon(iconEl, 'file-text');
		headerEl.createDiv({ cls: 'acp-tool-call-locations-title', text: '相关文件' });

		// 位置列表
		const listEl = locationsContainer.createDiv({ cls: 'acp-tool-call-locations-list' });

		for (const location of locations) {
			const locationEl = listEl.createDiv({ cls: 'acp-tool-call-location-item' });

			// 文件路径
			const pathEl = locationEl.createDiv({ cls: 'acp-location-path' });
			pathEl.textContent = location.path;

			// 行列信息
			if (location.line !== undefined) {
				const positionEl = locationEl.createDiv({ cls: 'acp-location-position' });
				positionEl.textContent = `:${location.line}${location.column !== undefined ? `:${location.column}` : ''}`;
			}

			// 点击跳转
			locationEl.addEventListener('click', async () => {
				try {
					await this.openFileAtLocation(app, location.path, location.line, location.column);
				} catch (error) {
					console.error('[MessageRenderer] 打开文件失败:', error);
					new Notice(`无法打开文件: ${location.path}`);
				}
			});
		}
	}

	/**
	 * 在指定位置打开文件
	 *
	 * @param app - Obsidian App 实例
	 * @param path - 文件路径
	 * @param line - 行号（可选，从 0 开始）
	 * @param column - 列号（可选，从 0 开始）
	 */
	private static async openFileAtLocation(
		app: App,
		path: string,
		line?: number,
		column?: number,
	): Promise<void> {
		// 尝试在 Obsidian 中打开文件
		const file = app.vault.getAbstractFileByPath(path);

		if (file && 'path' in file) {
			// 使用 Obsidian API 打开文件
			const leaf = app.workspace.getLeaf(false);
			await leaf.openFile(file as any);

			// 如果指定了行号，跳转到该行
			if (line !== undefined) {
				// 等待视图加载
				await new Promise((resolve) => setTimeout(resolve, 100));

				const view = app.workspace.getActiveViewOfType(MarkdownView);
				if (view && view.editor) {
					const editor = view.editor;

					// ACP 协议的行号可能是 1-based 或 0-based，需要检查
					// 通常 line 和 column 是 1-based
					const adjustedLine = Math.max(0, (line || 1) - 1);
					const adjustedColumn = column !== undefined ? Math.max(0, column - 1) : 0;

					// 设置光标位置
					editor.setCursor({ line: adjustedLine, ch: adjustedColumn });

					// 滚动到该行
					editor.scrollIntoView({
						from: { line: adjustedLine, ch: 0 },
						to: { line: adjustedLine, ch: 0 },
					}, true);
				}
			}
		} else {
			// 文件不在 Vault 中
			new Notice(`文件不存在: ${path}`);
		}
	}

	/**
	 * 构建 diff 字符串（保留用于向后兼容）
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
	 * 渲染 diff 内容（保留用于向后兼容）
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
	// T12 增强方法
	// ========================================================================

	/**
	 * 渲染带复制按钮的文本内容（T12）
	 */
	private static renderTextContentWithCopy(container: HTMLElement, text: string): void {
		const wrapperEl = container.createDiv({ cls: 'acp-content-with-copy' });

		// 文本内容
		const textEl = wrapperEl.createDiv({ cls: 'acp-content-text' });
		textEl.textContent = text;

		// 复制按钮
		const copyBtn = wrapperEl.createDiv({ cls: 'acp-copy-button' });
		setIcon(copyBtn, 'copy');
		copyBtn.setAttribute('aria-label', '复制');

		copyBtn.addEventListener('click', async (e) => {
			e.stopPropagation();
			await navigator.clipboard.writeText(text);
			new Notice('已复制到剪贴板');

			// 临时切换图标
			copyBtn.empty();
			setIcon(copyBtn, 'check');
			setTimeout(() => {
				copyBtn.empty();
				setIcon(copyBtn, 'copy');
			}, 1500);
		});
	}

	/**
	 * 渲染增强版 diff（带行号和文件路径点击，T12）
	 */
	private static renderDiffEnhanced(
		container: HTMLElement,
		diffContent: { oldText?: string | null; newText?: string; path?: string },
		app?: App,
	): void {
		const wrapperEl = container.createDiv({ cls: 'acp-diff-enhanced' });

		// 文件路径头部
		if (diffContent.path) {
			const pathHeaderEl = wrapperEl.createDiv({ cls: 'acp-diff-path' });

			// 文件路径
			const pathEl = pathHeaderEl.createEl('span', {
				cls: 'acp-diff-path-text',
				text: diffContent.path,
			});

			// 如果提供了 app，添加点击跳转
			if (app) {
				pathEl.addClass('acp-diff-path-clickable');
				pathEl.addEventListener('click', () => {
					this.openFile(app, diffContent.path!);
				});
			}

			// 复制按钮
			const copyBtn = pathHeaderEl.createDiv({ cls: 'acp-copy-button acp-copy-button-small' });
			setIcon(copyBtn, 'copy');
			copyBtn.setAttribute('aria-label', '复制 diff');

			copyBtn.addEventListener('click', async (e) => {
				e.stopPropagation();
				const diffText = this.buildDiffString(diffContent);
				await navigator.clipboard.writeText(diffText);
				new Notice('已复制 diff');

				copyBtn.empty();
				setIcon(copyBtn, 'check');
				setTimeout(() => {
					copyBtn.empty();
					setIcon(copyBtn, 'copy');
				}, 1500);
			});
		}

		// Diff 内容
		const preEl = wrapperEl.createEl('pre', { cls: 'acp-diff' });

		let lineNumber = 1;

		// 渲染删除的行
		if (diffContent.oldText) {
			const oldLines = diffContent.oldText.split('\n');
			for (const line of oldLines) {
				const lineEl = preEl.createEl('div', { cls: 'acp-diff-line acp-diff-removed' });

				// 行号
				const lineNumEl = lineEl.createEl('span', { cls: 'acp-diff-line-number' });
				lineNumEl.textContent = lineNumber.toString().padStart(4, ' ');

				// 内容
				const contentEl = lineEl.createEl('span', { cls: 'acp-diff-line-content' });
				contentEl.textContent = `-${line}`;

				lineNumber++;
			}
		}

		// 重置行号（新增内容从 1 开始）
		lineNumber = 1;

		// 渲染新增的行
		if (diffContent.newText) {
			const newLines = diffContent.newText.split('\n');
			for (const line of newLines) {
				const lineEl = preEl.createEl('div', { cls: 'acp-diff-line acp-diff-added' });

				// 行号
				const lineNumEl = lineEl.createEl('span', { cls: 'acp-diff-line-number' });
				lineNumEl.textContent = lineNumber.toString().padStart(4, ' ');

				// 内容
				const contentEl = lineEl.createEl('span', { cls: 'acp-diff-line-content' });
				contentEl.textContent = `+${line}`;

				lineNumber++;
			}
		}
	}

	/**
	 * 渲染终端输出（带复制按钮，T12）
	 */
	private static renderTerminalOutput(container: HTMLElement, terminalId: string): void {
		const wrapperEl = container.createDiv({ cls: 'acp-terminal-wrapper' });

		// 终端内容
		const preEl = wrapperEl.createEl('pre');
		const codeEl = preEl.createEl('code', { text: terminalId });

		// 复制按钮
		const copyBtn = wrapperEl.createDiv({ cls: 'acp-copy-button acp-copy-button-terminal' });
		setIcon(copyBtn, 'copy');
		copyBtn.setAttribute('aria-label', '复制终端输出');

		copyBtn.addEventListener('click', async (e) => {
			e.stopPropagation();
			await navigator.clipboard.writeText(terminalId);
			new Notice('已复制终端输出');

			copyBtn.empty();
			setIcon(copyBtn, 'check');
			setTimeout(() => {
				copyBtn.empty();
				setIcon(copyBtn, 'copy');
			}, 1500);
		});
	}

	/**
	 * 打开文件（在 Obsidian 中，T12）
	 */
	private static openFile(app: App, path: string): void {
		// 尝试在 Obsidian 中打开文件
		const file = app.vault.getAbstractFileByPath(path);
		if (file) {
			app.workspace.openLinkText(path, '', false);
		} else {
			new Notice(`文件不存在: ${path}`);
		}
	}

	// ========================================================================
	// 工具调用分组渲染（T12）
	// ========================================================================

	/**
	 * 渲染工具调用组（按回合分组，T12）
	 *
	 * @param container - 容器元素
	 * @param toolCalls - 工具调用列表
	 * @param groupTitle - 分组标题
	 * @param app - Obsidian App 实例
	 * @returns 分组元素
	 */
	static renderToolCallGroup(
		container: HTMLElement,
		toolCalls: ToolCall[],
		groupTitle?: string,
		app?: App,
	): HTMLElement {
		const groupEl = container.createDiv({ cls: 'acp-tool-call-group' });

		// 分组头部
		const headerEl = groupEl.createDiv({ cls: 'acp-tool-call-group-header' });

		// 展开/折叠图标
		const toggleIcon = headerEl.createDiv({ cls: 'acp-tool-call-group-toggle' });
		setIcon(toggleIcon, 'chevron-down');

		// 标题
		const titleEl = headerEl.createDiv({ cls: 'acp-tool-call-group-title' });
		titleEl.textContent = groupTitle || `工具调用组 (${toolCalls.length})`;

		// 统计信息（T12 增强）
		const statsEl = headerEl.createDiv({ cls: 'acp-tool-call-group-stats' });
		const stats = this.calculateToolCallStats(toolCalls);
		statsEl.innerHTML = `
			<span class="acp-tool-call-stat acp-tool-call-stat-total">${stats.total}</span>
			<span class="acp-tool-call-stat acp-tool-call-stat-completed">${stats.completed}</span>
			<span class="acp-tool-call-stat acp-tool-call-stat-error">${stats.error}</span>
		`;

		// 工具调用列表容器
		const listEl = groupEl.createDiv({ cls: 'acp-tool-call-group-list' });
		listEl.setAttribute('data-expanded', 'true'); // 默认展开

		// 渲染每个工具调用
		for (const toolCall of toolCalls) {
			this.renderToolCall(listEl, toolCall, app);
		}

		// 点击头部切换展开/折叠
		headerEl.addEventListener('click', () => {
			const expanded = listEl.getAttribute('data-expanded') === 'true';
			listEl.setAttribute('data-expanded', expanded ? 'false' : 'true');
			listEl.toggleClass('acp-tool-call-group-list-collapsed', expanded);

			// 切换图标
			toggleIcon.empty();
			setIcon(toggleIcon, expanded ? 'chevron-right' : 'chevron-down');
		});

		return groupEl;
	}

	/**
	 * 计算工具调用统计信息（T12）
	 */
	private static calculateToolCallStats(toolCalls: ToolCall[]): {
		total: number;
		completed: number;
		error: number;
		inProgress: number;
	} {
		const stats = {
			total: toolCalls.length,
			completed: 0,
			error: 0,
			inProgress: 0,
		};

		for (const toolCall of toolCalls) {
			if (toolCall.status === 'completed') {
				stats.completed++;
			} else if (toolCall.status === 'failed') {
				stats.error++;
			} else if (toolCall.status === 'in_progress') {
				stats.inProgress++;
			}
		}

		return stats;
	}

	// ========================================================================
	// 计划渲染
	// ========================================================================

	/**
	 * 渲染思考块
	 *
	 * @param container - 容器元素（应该是 turn 容器）
	 * @param thoughts - 思考内容列表
	 * @returns 思考块元素
	 */
	static renderThoughts(container: HTMLElement, thoughts: string[]): HTMLElement {
		// 在当前容器内查找是否已存在（限定在 turn 内）
		let thoughtsEl = container.querySelector('.acp-thoughts') as HTMLElement;

		if (thoughtsEl) {
			// 清空并重新渲染
			thoughtsEl.empty();
		} else {
			// 创建新元素
			thoughtsEl = container.createDiv({ cls: 'acp-thoughts' });
		}

		// 头部（可点击折叠/展开）
		const headerEl = thoughtsEl.createDiv({ cls: 'acp-thoughts-header' });

		// 展开/折叠图标
		const toggleIcon = headerEl.createDiv({ cls: 'acp-thoughts-toggle' });
		setIcon(toggleIcon, 'chevron-right'); // 默认折叠

		// 标题
		const titleEl = headerEl.createDiv({ cls: 'acp-thoughts-title' });
		titleEl.textContent = '思考过程';

		// 内容区域（默认折叠）
		const contentEl = thoughtsEl.createDiv({
			cls: 'acp-thoughts-content',
			attr: { 'data-expanded': 'false' },
		});

		// 渲染每条思考
		for (const thought of thoughts) {
			const thoughtEl = contentEl.createDiv({ cls: 'acp-thought-item' });
			thoughtEl.textContent = thought;
		}

		// 点击头部切换展开/折叠
		headerEl.addEventListener('click', () => {
			const expanded = contentEl.getAttribute('data-expanded') === 'true';
			contentEl.setAttribute('data-expanded', expanded ? 'false' : 'true');
			contentEl.toggleClass('acp-thoughts-content-expanded', !expanded);

			// 切换图标
			toggleIcon.empty();
			setIcon(toggleIcon, expanded ? 'chevron-right' : 'chevron-down');
		});

		return thoughtsEl;
	}

	/**
	 * 渲染计划
	 *
	 * @param container - 容器元素（应该是 turn 容器）
	 * @param plan - 计划条目列表
	 * @returns 计划元素
	 */
	static renderPlan(container: HTMLElement, plan: PlanEntry[]): HTMLElement {
		// 在当前容器内查找是否已存在（限定在 turn 内）
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

	// ========================================================================
	// Phase 4: 辅助方法
	// ========================================================================

	/**
	 * 格式化时间戳（Phase 4）
	 */
	private static formatTimestamp(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;

		// 小于 1 分钟
		if (diff < 60000) {
			return '刚刚';
		}

		// 小于 1 小时
		if (diff < 3600000) {
			const minutes = Math.floor(diff / 60000);
			return `${minutes}分钟前`;
		}

		// 小于 1 天
		if (diff < 86400000) {
			const hours = Math.floor(diff / 3600000);
			return `${hours}小时前`;
		}

		// 显示时间
		const date = new Date(timestamp);
		const today = new Date();

		// 今天：显示时间
		if (date.toDateString() === today.toDateString()) {
			return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
		}

		// 昨天
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);
		if (date.toDateString() === yesterday.toDateString()) {
			return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
		}

		// 其他：显示日期和时间
		return date.toLocaleString('zh-CN', {
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		});
	}
}

// ============================================================================
// ImagePreviewModal 类
// ============================================================================

/**
 * 图片预览模态框
 */
class ImagePreviewModal extends Modal {
	private imageSrc: string;

	constructor(app: App, imageSrc: string) {
		super(app);
		this.imageSrc = imageSrc;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('acp-image-preview-modal');

		// 创建图片元素
		const imgEl = contentEl.createEl('img', {
			cls: 'acp-image-preview',
			attr: {
				src: this.imageSrc,
				alt: '图片预览',
			},
		});

		// 点击图片关闭模态框
		imgEl.addEventListener('click', () => {
			this.close();
		});

		// 点击背景关闭模态框
		contentEl.addEventListener('click', (e) => {
			if (e.target === contentEl) {
				this.close();
			}
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
