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
import { MarkdownRenderer, setIcon, Notice, Modal, MarkdownView, TFile } from 'obsidian';
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
	public static async renderMessage(
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
			this.setupImageEvents(imgEl, imageWrapper, app);
		} else if (uri.startsWith('http://') || uri.startsWith('https://')) {
			// HTTP/HTTPS URI - 直接使用
			imgEl.src = uri;
			this.setupImageEvents(imgEl, imageWrapper, app);
		} else if (uri.startsWith('file://')) {
			// file:// URI - 需要完整处理
			void this.handleFileUri(uri, imgEl, imageWrapper, app);
		} else {
			// 其他情况 - 尝试作为相对路径处理
			imgEl.src = uri;
			this.setupImageEvents(imgEl, imageWrapper, app);
		}
	}

	/**
	 * 处理 file:// URI
	 */
	private static async handleFileUri(
		uri: string,
		imgEl: HTMLImageElement,
		imageWrapper: HTMLElement,
		app: App,
	): Promise<void> {
		try {
			// 1. 解析 file:// URI（处理 file:/// 和 file://localhost/）
			let filePath = uri;

			// 移除 file:// 或 file:/// 前缀
			if (filePath.startsWith('file:///')) {
				filePath = filePath.substring(7); // 移除 'file://'
			} else if (filePath.startsWith('file://localhost/')) {
				filePath = filePath.substring(16); // 移除 'file://localhost'
			} else if (filePath.startsWith('file://')) {
				filePath = filePath.substring(7); // 移除 'file://'
			}

			// URL 解码（处理特殊字符）
			filePath = decodeURIComponent(filePath);

			// 2. 先尝试通过 Obsidian Vault 读取（Vault 内文件）
			const vaultFile = app.vault.getAbstractFileByPath(filePath);
			if (vaultFile instanceof TFile) {
				imgEl.src = app.vault.getResourcePath(vaultFile);
				this.setupImageEvents(imgEl, imageWrapper, app);
				return;
			}

			// 3. Vault 外文件：使用 Node.js fs 读取并转换为 data URI
			const { promises: fs } = await import('fs');
			const path = await import('path');

			// 检查文件是否存在
			await fs.access(filePath);

			// 读取二进制数据
			const imageData = await fs.readFile(filePath);

			// 根据扩展名判断 MIME 类型
			const ext = path.extname(filePath).toLowerCase();
			const mimeTypes: Record<string, string> = {
				'.png': 'image/png',
				'.jpg': 'image/jpeg',
				'.jpeg': 'image/jpeg',
				'.gif': 'image/gif',
				'.webp': 'image/webp',
				'.svg': 'image/svg+xml',
				'.bmp': 'image/bmp',
			};
			const mimeType = mimeTypes[ext] || 'image/png';

			// 转换为 Base64
			const base64 = imageData.toString('base64');

			// 构建 data URI
			const dataUri = `data:${mimeType};base64,${base64}`;

			// 设置图片源
			imgEl.src = dataUri;
			this.setupImageEvents(imgEl, imageWrapper, app);
		} catch (error) {
			console.error('[MessageRenderer] file:// URI 处理失败:', error);
			// 显示错误
			this.showImageError(imageWrapper);
		}
	}

	/**
	 * 设置图片事件监听器
	 */
	private static setupImageEvents(
		imgEl: HTMLImageElement,
		imageWrapper: HTMLElement,
		app: App,
	): void {
		// 添加加载状态
		imgEl.addClass('acp-image-loading');

		imgEl.addEventListener('load', () => {
			imgEl.removeClass('acp-image-loading');
			imgEl.addClass('acp-image-loaded');
		});

		imgEl.addEventListener('error', () => {
			this.showImageError(imageWrapper);
		});

		// 点击图片预览
		imgEl.addEventListener('click', () => {
			this.showImagePreview(imgEl.src, app);
		});
	}

	/**
	 * 显示图片错误占位符
	 */
	private static showImageError(imageWrapper: HTMLElement): void {
		imageWrapper.empty();
		const errorEl = imageWrapper.createDiv({ cls: 'acp-image-error-placeholder' });
		const iconEl = errorEl.createDiv({ cls: 'acp-image-error-icon' });
		setIcon(iconEl, 'image-off');
		errorEl.createDiv({ cls: 'acp-image-error-text', text: '图片加载失败' });
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
	 * 优化策略：
	 * 1. 流式输出时使用纯文本追加，避免频繁 Markdown 渲染
	 * 2. 仅在流式结束时进行完整 Markdown 渲染
	 * 3. 使用 requestAnimationFrame 批量更新
	 *
	 * @param container - 容器元素
	 * @param message - 消息对象
	 * @param component - Obsidian Component
	 * @param app - Obsidian App 实例
	 * @param sourcePath - Markdown 源路径（可选）
	 */
	public static updateMessage(
		container: HTMLElement,
		message: Message,
		component: Component,
		app: App,
		sourcePath: string = '',
	): void {
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

		// 使用 requestAnimationFrame 批量更新，减少重排
		requestAnimationFrame(() => {
			if (message.isStreaming) {
				// 流式输出时：使用纯文本追加，避免 Markdown 重渲染的性能开销
				// 保留已有内容结构，只更新文本
				const existingText = contentEl.getAttribute('data-raw-content') || '';
				const newContent = message.content || '';

				if (newContent !== existingText) {
					// 存储原始内容供后续使用
					contentEl.setAttribute('data-raw-content', newContent);
					// 流式期间使用纯文本显示，折叠多余的连续换行（3+ 个换行 → 2 个换行）
					const displayContent = newContent.replace(/\n{3,}/g, '\n\n');
					contentEl.textContent = displayContent;
					contentEl.addClass('acp-message-streaming');
				}
			} else {
				// 流式结束：进行完整的 Markdown 渲染
				contentEl.removeClass('acp-message-streaming');
				contentEl.removeAttribute('data-raw-content');

				if (message.content && message.content.trim()) {
					// 清空并渲染（仅在流式结束时执行一次）
					contentEl.empty();
					void MarkdownRenderer.render(
						app,
						message.content,
						contentEl,
						sourcePath,
						component,
					).catch((error) => {
						console.error('[MessageRenderer] Markdown 更新失败:', error);
						contentEl.textContent = message.content;
					});
				}
			}
		});
	}

	/**
	 * HTML 转义（用于流式显示）
	 */
	private static escapeHtml(text: string): string {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
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

		copyBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			const text = message.content || '';
			if (text) {
				void navigator.clipboard.writeText(text).then(() => {
					new Notice('已复制消息');

					// 临时切换图标
					copyBtn.empty();
					setIcon(copyBtn, 'check');
					setTimeout(() => {
						copyBtn.empty();
						setIcon(copyBtn, 'copy');
					}, 1500);
				});
			}
		});
	}

	// ========================================================================
	// 工具调用渲染
	// ========================================================================

	/**
	 * 渲染工具调用卡片 (现代化可折叠卡片)
	 *
	 * 特点:
	 * - 清晰的操作描述标题
	 * - 状态指示器（带动画）
	 * - 可折叠的详情区域（CSS transition）
	 * - 现代化卡片设计
	 *
	 * @param container - 容器元素
	 * @param toolCall - 工具调用对象
	 * @param app - Obsidian App 实例（用于文件跳转）
	 * @returns 工具调用元素
	 */
	public static renderToolCall(container: HTMLElement, toolCall: ToolCall, app?: App): HTMLElement {
		// 查找是否已存在
		let toolCallEl = container.querySelector(
			`[data-tool-call-id="${toolCall.toolCallId}"]`,
		) as HTMLElement;

		if (toolCallEl) {
			// 更新现有卡片
			this.updateToolCallCard(toolCallEl, toolCall, app);
			return toolCallEl;
		}

		// 创建新卡片（添加状态类）
		toolCallEl = container.createDiv({
			cls: `acp-tool-call acp-tool-call-${toolCall.status}`,
			attr: {
				'data-tool-call-id': toolCall.toolCallId,
				'data-status': toolCall.status,
			},
		});

		// 卡片头部
		const headerEl = toolCallEl.createDiv({ cls: 'acp-tool-call-header' });

		// 左侧：状态图标 + 标题
		const leftEl = headerEl.createDiv({ cls: 'acp-tool-call-left' });

		// 状态图标（带动画）
		const iconEl = leftEl.createDiv({ cls: `acp-tool-call-icon acp-status-${toolCall.status}` });
		this.setToolCallIcon(iconEl, toolCall.status);

		// 获取显示内容
		const displayInfo = this.getToolCallDisplayInfo(toolCall);

		// 主标题：清晰描述操作
		const titleEl = leftEl.createDiv({ cls: 'acp-tool-call-title' });
		titleEl.textContent = displayInfo.title;

		// 右侧：时间 + 展开图标
		const rightEl = headerEl.createDiv({ cls: 'acp-tool-call-right' });

		// 时间信息
		const timeEl = rightEl.createDiv({ cls: 'acp-tool-call-time' });
		timeEl.textContent = this.formatToolCallTime(toolCall);

		// 展开/折叠指示器
		const chevronEl = rightEl.createDiv({ cls: 'acp-tool-call-chevron' });
		setIcon(chevronEl, 'chevron-right');

		// 内容区域（默认折叠）
		const contentEl = toolCallEl.createDiv({
			cls: 'acp-tool-call-content',
			attr: { 'data-expanded': 'false' },
		});

		// 渲染内容
		this.renderToolCallContent(contentEl, toolCall, app);

		// 点击头部切换折叠/展开（带 CSS transition）
		headerEl.addEventListener('click', () => {
			const expanded = contentEl.getAttribute('data-expanded') === 'true';
			const newExpanded = !expanded;
			contentEl.setAttribute('data-expanded', newExpanded ? 'true' : 'false');

			// 使用 CSS class 触发过渡动画
			if (newExpanded) {
				contentEl.addClass('acp-tool-call-content-expanded');
			} else {
				contentEl.removeClass('acp-tool-call-content-expanded');
			}

			// 旋转 chevron
			chevronEl.empty();
			setIcon(chevronEl, newExpanded ? 'chevron-down' : 'chevron-right');
		});

		return toolCallEl;
	}

	/**
	 * 更新工具调用卡片
	 *
	 * 优化：使用 requestAnimationFrame 批量更新，减少重排
	 */
	private static updateToolCallCard(toolCallEl: HTMLElement, toolCall: ToolCall, app?: App): void {
		requestAnimationFrame(() => {
			// 只在状态变化时更新状态类
			const currentStatus = toolCallEl.getAttribute('data-status');
			if (currentStatus !== toolCall.status) {
				// 更新主卡片的状态类
				toolCallEl.className = `acp-tool-call acp-tool-call-${toolCall.status}`;
				toolCallEl.setAttribute('data-status', toolCall.status);

				// 更新图标及其状态类
				const iconEl = toolCallEl.querySelector('.acp-tool-call-icon');
				if (iconEl) {
					iconEl.className = `acp-tool-call-icon acp-status-${toolCall.status}`;
					this.setToolCallIcon(iconEl as HTMLElement, toolCall.status);
				}
			}

			// 更新时间（总是更新，因为执行时间在变化）
			const timeEl = toolCallEl.querySelector('.acp-tool-call-time');
			if (timeEl) {
				const newTime = this.formatToolCallTime(toolCall);
				if (timeEl.textContent !== newTime) {
					timeEl.textContent = newTime;
				}
			}

			// 只在有新内容时更新内容区域
			if (toolCall.content && toolCall.content.length > 0) {
				const contentEl = toolCallEl.querySelector('.acp-tool-call-content');
				if (contentEl) {
					const currentContentCount = contentEl.querySelectorAll('.acp-tool-call-content-block').length;
					// 只在内容数量变化时重新渲染
					if (currentContentCount !== toolCall.content.length) {
						(contentEl as HTMLElement).empty();
						this.renderToolCallContent(contentEl as HTMLElement, toolCall, app);
					}
				}
			}
		});
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
	 * 获取工具调用的显示信息
	 *
	 * Claude Code 风格：清晰描述操作内容
	 * - Bash: "执行 npm install"
	 * - Read: "读取 src/index.ts"
	 * - Write: "写入 config.json"
	 * - Edit: "编辑 main.ts:42-58"
	 * - Grep: "搜索 'function'"
	 * - MCP: "调用 context7/search"
	 */
	private static getToolCallDisplayInfo(toolCall: ToolCall): { title: string } {
		const kind = toolCall.kind?.toLowerCase() || '';
		const rawInput = toolCall.rawInput || {};
		const title = toolCall.title || '';

		// 优先检查 rawInput.command（不管 kind 是什么）
		const command = rawInput.command as string;
		if (command) {
			// 提取命令的第一部分（如 npm, git, python 等）
			const firstWord = command.split(/\s+/)[0];
			// 不截断，显示完整命令
			return { title: `执行 ${firstWord}: ${command}` };
		}

		// Bash / Execute / Terminal 类工具（降级处理）
		if (kind === 'bash' || kind === 'execute' || kind === 'shell' || kind === 'terminal') {
			// 当没有具体命令时，显示更有意义的标题
			if (title && title.toLowerCase() !== kind) {
				return { title: `执行: ${title}` };
			}
			return { title: '执行终端命令' };
		}

		// Read 类工具
		if (kind === 'read') {
			const path = (rawInput.path || rawInput.file_path || title) as string;
			if (path) {
				return { title: `读取 ${this.getFileName(path)}` };
			}
			return { title: '读取文件' };
		}

		// Write 类工具
		if (kind === 'write') {
			const path = (rawInput.path || rawInput.file_path || title) as string;
			if (path) {
				return { title: `写入 ${this.getFileName(path)}` };
			}
			return { title: '写入文件' };
		}

		// Edit / Patch 类工具
		if (kind === 'edit' || kind === 'patch') {
			const path = (rawInput.path || rawInput.file_path || title) as string;
			if (path) {
				// 如果有行号信息，显示出来
				const line = rawInput.line || rawInput.start_line;
				const lineInfo = line ? `:${line}` : '';
				return { title: `编辑 ${this.getFileName(path)}${lineInfo}` };
			}
			return { title: '编辑文件' };
		}

		// Grep / Search 类工具
		if (kind === 'grep' || kind === 'search' || kind === 'find') {
			const pattern = (rawInput.pattern || rawInput.query || rawInput.search) as string;
			if (pattern) {
				const shortPattern = pattern.length > 30 ? pattern.slice(0, 27) + '...' : pattern;
				return { title: `搜索 "${shortPattern}"` };
			}
			return { title: '搜索' };
		}

		// Glob 类工具
		if (kind === 'glob' || kind === 'list' || kind === 'ls') {
			const pattern = (rawInput.pattern || rawInput.path) as string;
			if (pattern) {
				return { title: `列出 ${pattern}` };
			}
			return { title: '列出文件' };
		}

		// MCP 工具
		if (kind === 'mcp' || kind.startsWith('mcp_')) {
			const serverName = (rawInput.server || rawInput.serverName) as string;
			const methodName = (rawInput.method || rawInput.tool) as string;
			if (serverName && methodName) {
				return { title: `MCP ${serverName}/${methodName}` };
			}
			if (methodName) {
				return { title: `MCP ${methodName}` };
			}
			return { title: 'MCP 调用' };
		}

		// Web 搜索
		if (kind === 'web_search' || kind === 'websearch') {
			const query = (rawInput.query || rawInput.search) as string;
			if (query) {
				const shortQuery = query.length > 30 ? query.slice(0, 27) + '...' : query;
				return { title: `搜索 "${shortQuery}"` };
			}
			return { title: '网页搜索' };
		}

		// 默认：使用原标题或工具类型
		if (title) {
			return { title: title.length > 50 ? title.slice(0, 47) + '...' : title };
		}

		return { title: this.formatToolKind(kind) || '工具调用' };
	}

	/**
	 * 获取文件名（从完整路径）
	 */
	private static getFileName(path: string): string {
		const parts = path.split(/[/\\]/);
		const fileName = parts[parts.length - 1] || path;
		// 如果路径很长，显示 ...目录/文件名
		if (parts.length > 2 && path.length > 40) {
			return `.../${parts[parts.length - 2]}/${fileName}`;
		}
		return fileName;
	}

	/**
	 * 缩短路径显示
	 */
	private static shortenPath(path: string): string {
		const parts = path.split('/');
		if (parts.length <= 2) return path;
		return '.../' + parts.slice(-2).join('/');
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
			locationEl.addEventListener('click', () => {
				void this.openFileAtLocation(app, location.path, location.line, location.column).catch((error) => {
					console.error('[MessageRenderer] 打开文件失败:', error);
					new Notice(`无法打开文件: ${location.path}`);
				});
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

		if (file instanceof TFile) {
			// 使用 Obsidian API 打开文件
			const leaf = app.workspace.getLeaf(false);
			await leaf.openFile(file);

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
	 * 渲染代码块（带语言标签和复制按钮）
	 *
	 * @param container - 容器元素
	 * @param code - 代码内容
	 * @param language - 语言标识（如 'typescript', 'javascript'）
	 * @param filename - 可选文件名
	 */
	public static renderCodeBlock(
		container: HTMLElement,
		code: string,
		language: string = 'text',
		filename?: string,
	): void {
		const codeWrapper = container.createDiv({ cls: 'acp-code-block-wrapper' });

		// 头部：语言标签 + 文件名 + 复制按钮
		const headerEl = codeWrapper.createDiv({ cls: 'acp-code-block-header' });

		// 左侧信息
		const infoEl = headerEl.createDiv({ cls: 'acp-code-block-info' });
		infoEl.createDiv({ cls: 'acp-code-block-language', text: language.toUpperCase() });
		if (filename) {
			infoEl.createDiv({ cls: 'acp-code-block-filename', text: filename });
		}

		// 复制按钮
		const copyBtn = headerEl.createDiv({ cls: 'acp-copy-button acp-copy-button-code' });
		setIcon(copyBtn, 'copy');
		copyBtn.setAttribute('aria-label', '复制代码');

		copyBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			void navigator.clipboard.writeText(code).then(() => {
				new Notice('已复制代码');

				// 临时切换图标
				copyBtn.empty();
				setIcon(copyBtn, 'check');
				setTimeout(() => {
					copyBtn.empty();
					setIcon(copyBtn, 'copy');
				}, 2000);
			});
		});

		// 代码内容
		const preEl = codeWrapper.createEl('pre', { cls: 'acp-code-block-content' });
		preEl.createEl('code', {
			cls: `language-${language}`,
			text: code,
		});
	}

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

		copyBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			void navigator.clipboard.writeText(text).then(() => {
				new Notice('已复制到剪贴板');

				// 临时切换图标
				copyBtn.empty();
				setIcon(copyBtn, 'check');
				setTimeout(() => {
					copyBtn.empty();
					setIcon(copyBtn, 'copy');
				}, 1500);
			});
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
			const filePath = diffContent.path; // Capture for closure
			const pathHeaderEl = wrapperEl.createDiv({ cls: 'acp-diff-path' });

			// 文件路径
			const pathEl = pathHeaderEl.createEl('span', {
				cls: 'acp-diff-path-text',
				text: filePath,
			});

			// 如果提供了 app，添加点击跳转
			if (app) {
				pathEl.addClass('acp-diff-path-clickable');
				pathEl.addEventListener('click', () => {
					this.openFile(app, filePath);
				});
			}

			// 复制按钮
			const copyBtn = pathHeaderEl.createDiv({ cls: 'acp-copy-button acp-copy-button-small' });
			setIcon(copyBtn, 'copy');
			copyBtn.setAttribute('aria-label', '复制 diff');

			copyBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				const diffText = this.buildDiffString(diffContent);
				void navigator.clipboard.writeText(diffText).then(() => {
					new Notice('已复制 diff');

					copyBtn.empty();
					setIcon(copyBtn, 'check');
					setTimeout(() => {
						copyBtn.empty();
						setIcon(copyBtn, 'copy');
					}, 1500);
				});
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
		preEl.createEl('code', { text: terminalId });

		// 复制按钮
		const copyBtn = wrapperEl.createDiv({ cls: 'acp-copy-button acp-copy-button-terminal' });
		setIcon(copyBtn, 'copy');
		copyBtn.setAttribute('aria-label', '复制终端输出');

		copyBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			void navigator.clipboard.writeText(terminalId).then(() => {
				new Notice('已复制终端输出');

				copyBtn.empty();
				setIcon(copyBtn, 'check');
				setTimeout(() => {
					copyBtn.empty();
					setIcon(copyBtn, 'copy');
				}, 1500);
			});
		});
	}

	/**
	 * 打开文件（在 Obsidian 中，T12）
	 */
	private static openFile(app: App, path: string): void {
		// 尝试在 Obsidian 中打开文件
		const file = app.vault.getAbstractFileByPath(path);
		if (file) {
			void app.workspace.openLinkText(path, '', false);
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
	public static renderToolCallGroup(
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
	 * 渲染思考块 (现代化可折叠思考块)
	 *
	 * 特点：
	 * - 显示思考条数
	 * - 默认折叠，点击展开（CSS transition）
	 * - 支持流式更新（增量添加思考项）
	 * - 流式进行中时显示"正在思考..."，结束后显示"思考过程"
	 *
	 * @param container - 容器元素（应该是 turn 容器）
	 * @param thoughts - 思考内容列表
	 * @param isStreaming - 是否正在流式输出（可选）
	 * @returns 思考块元素
	 */
	public static renderThoughts(container: HTMLElement, thoughts: string[], isStreaming = false): HTMLElement {
		// 在当前容器内查找是否已存在（限定在 turn 内）
		let thoughtsEl = container.querySelector('.acp-thoughts') as HTMLElement;

		if (thoughtsEl) {
			// 增量更新：只更新有变化的部分
			requestAnimationFrame(() => {
				// 更新计数
				const countEl = thoughtsEl.querySelector('.acp-thoughts-count');
				if (countEl) {
					countEl.textContent = `(${thoughts.length})`;
				}

				// 更新标题（流式 vs 完成）
				const titleEl = thoughtsEl.querySelector('.acp-thoughts-title');
				if (titleEl) {
					titleEl.textContent = isStreaming ? '正在思考...' : '思考过程';
				}

				// 更新思考图标（流式时添加脉冲动画）
				const iconEl = thoughtsEl.querySelector('.acp-thoughts-icon');
				if (iconEl) {
					if (isStreaming) {
						iconEl.addClass('acp-thoughts-streaming');
					} else {
						iconEl.removeClass('acp-thoughts-streaming');
					}
				}

				// 增量添加新的思考项
				const contentEl = thoughtsEl.querySelector('.acp-thoughts-content');
				if (contentEl) {
					const existingCount = contentEl.querySelectorAll('.acp-thought-item').length;
					// 只添加新的思考项
					for (let i = existingCount; i < thoughts.length; i++) {
						const thoughtEl = (contentEl as HTMLElement).createDiv({ cls: 'acp-thought-item' });
						thoughtEl.textContent = thoughts[i];
					}
				}
			});
			return thoughtsEl;
		}

		// 创建新元素
		thoughtsEl = container.createDiv({ cls: 'acp-thoughts' });

		// 头部（可点击折叠/展开）
		const headerEl = thoughtsEl.createDiv({ cls: 'acp-thoughts-header' });

		// 左侧：图标 + 标题 + 数量
		const leftEl = headerEl.createDiv({ cls: 'acp-thoughts-left' });

		// 展开/折叠图标
		const toggleIcon = leftEl.createDiv({ cls: 'acp-thoughts-toggle' });
		setIcon(toggleIcon, 'chevron-right'); // 默认折叠

		// 思考图标（流式时添加动画）
		const thinkIcon = leftEl.createDiv({
			cls: isStreaming ? 'acp-thoughts-icon acp-thoughts-streaming' : 'acp-thoughts-icon',
		});
		setIcon(thinkIcon, 'brain');

		// 标题（根据流式状态显示不同文本）
		leftEl.createDiv({
			cls: 'acp-thoughts-title',
			text: isStreaming ? '正在思考...' : '思考过程',
		});

		// 数量
		leftEl.createDiv({ cls: 'acp-thoughts-count', text: `(${thoughts.length})` });

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

		// 点击头部切换展开/折叠（CSS transition）
		headerEl.addEventListener('click', () => {
			const expanded = contentEl.getAttribute('data-expanded') === 'true';
			const newExpanded = !expanded;
			contentEl.setAttribute('data-expanded', newExpanded ? 'true' : 'false');

			// 使用 CSS class 触发过渡动画
			if (newExpanded) {
				contentEl.addClass('acp-thoughts-content-expanded');
			} else {
				contentEl.removeClass('acp-thoughts-content-expanded');
			}

			// 切换图标：折叠时显示 chevron-right，展开时显示 chevron-down
			toggleIcon.empty();
			setIcon(toggleIcon, newExpanded ? 'chevron-down' : 'chevron-right');
		});

		return thoughtsEl;
	}

	/**
	 * 渲染计划 (Claude Code 风格)
	 *
	 * 特点：
	 * - 可折叠的计划列表
	 * - 显示完成进度
	 * - 优化更新性能
	 *
	 * @param container - 容器元素（应该是 turn 容器）
	 * @param plan - 计划条目列表
	 * @returns 计划元素
	 */
	public static renderPlan(container: HTMLElement, plan: PlanEntry[]): HTMLElement {
		// 在当前容器内查找是否已存在（限定在 turn 内）
		let planEl = container.querySelector('.acp-plan') as HTMLElement;

		// 计算进度
		const completedCount = plan.filter(e => e.status === 'completed').length;
		const progressText = `${completedCount}/${plan.length}`;

		if (planEl) {
			// 增量更新
			requestAnimationFrame(() => {
				// 更新进度
				const progressEl = planEl.querySelector('.acp-plan-progress');
				if (progressEl) {
					progressEl.textContent = progressText;
				}

				// 更新列表
				const listEl = planEl.querySelector('.acp-plan-list');
				if (listEl) {
					(listEl as HTMLElement).empty();
					this.renderPlanEntries(listEl as HTMLElement, plan);
				}
			});
			return planEl;
		}

		// 创建新元素
		planEl = container.createDiv({ cls: 'acp-plan' });

		// 头部（可折叠）
		const headerEl = planEl.createDiv({ cls: 'acp-plan-header' });

		// 左侧
		const leftEl = headerEl.createDiv({ cls: 'acp-plan-left' });

		// 展开/折叠图标
		const toggleIcon = leftEl.createDiv({ cls: 'acp-plan-toggle' });
		setIcon(toggleIcon, 'chevron-down'); // 默认展开

		// 计划图标
		const iconEl = leftEl.createDiv({ cls: 'acp-plan-icon' });
		setIcon(iconEl, 'list-tree');

		// 标题
		leftEl.createDiv({ cls: 'acp-plan-title', text: '执行计划' });

		// 右侧：进度
		const rightEl = headerEl.createDiv({ cls: 'acp-plan-right' });
		rightEl.createDiv({ cls: 'acp-plan-progress', text: progressText });

		// 条目列表
		const listEl = planEl.createDiv({
			cls: 'acp-plan-list',
			attr: { 'data-expanded': 'true' },
		});
		this.renderPlanEntries(listEl, plan);

		// 点击头部切换展开/折叠
		headerEl.addEventListener('click', () => {
			const expanded = listEl.getAttribute('data-expanded') === 'true';
			listEl.setAttribute('data-expanded', expanded ? 'false' : 'true');
			listEl.toggleClass('acp-plan-list-collapsed', expanded);

			// 切换图标
			toggleIcon.empty();
			setIcon(toggleIcon, expanded ? 'chevron-right' : 'chevron-down');
		});

		return planEl;
	}

	/**
	 * 渲染计划条目
	 */
	private static renderPlanEntries(listEl: HTMLElement, plan: PlanEntry[]): void {
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

	public onOpen(): void {
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

	public onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
