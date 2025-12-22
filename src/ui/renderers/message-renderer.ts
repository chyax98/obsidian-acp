/**
 * 消息渲染器
 *
 * 负责渲染聊天消息，支持：
 * - 流式 Markdown 渲染（节流优化）
 * - 图片内容渲染
 * - 复制按钮
 */

import type { Component, App } from "obsidian";
import { MarkdownRenderer, setIcon, Notice } from "obsidian";
import type { Message } from "../../acp/core/session-manager";
import { ImageRenderer } from "./image-renderer";
import { formatTimestamp } from "./utils";

/**
 * 流式渲染节流配置
 */
interface StreamingConfig {
	/** Markdown 渲染节流间隔（毫秒） */
	throttleInterval: number;
}

const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
	throttleInterval: 300, // 300ms 节流
};

/**
 * 流式渲染状态跟踪
 */
const streamingState = new Map<
	string,
	{
		lastRenderTime: number;
		lastContent: string;
		pendingRender: number | null;
	}
>();

/**
 * 消息渲染器
 */
export class MessageRenderer {
	private static config: StreamingConfig = DEFAULT_STREAMING_CONFIG;

	/**
	 * 配置流式渲染
	 */
	public static configure(config: Partial<StreamingConfig>): void {
		this.config = { ...DEFAULT_STREAMING_CONFIG, ...config };
	}

	/**
	 * 渲染消息
	 */
	public static async render(
		container: HTMLElement,
		message: Message,
		component: Component,
		app: App,
		sourcePath: string = "",
	): Promise<void> {
		// 创建消息结构
		const messageEl = container.createDiv({
			cls: `acp-message acp-message-${message.role}`,
			attr: { "data-message-id": message.id },
		});

		// 时间戳
		if (message.timestamp) {
			const timestampEl = messageEl.createDiv({
				cls: "acp-message-timestamp",
			});
			timestampEl.textContent = formatTimestamp(message.timestamp);
			timestampEl.setAttribute(
				"title",
				new Date(message.timestamp).toLocaleString(),
			);
		}

		// 消息内容容器
		const contentEl = messageEl.createDiv({ cls: "acp-message-content" });

		// 渲染内容
		if (message.content && message.content.trim()) {
			await this.renderContent(
				contentEl,
				message.content,
				app,
				sourcePath,
				component,
			);
		}

		// 流式状态
		if (message.isStreaming) {
			contentEl.addClass("acp-message-streaming");
		}

		// 添加操作栏
		this.addMessageActions(messageEl, message);
	}

	/**
	 * 更新消息内容
	 *
	 * 流式渲染策略：
	 * - 使用节流的 Markdown 渲染，实现所见即所得
	 * - 每 300ms 渲染一次 Markdown
	 * - 流式结束时做最终渲染
	 */
	public static update(
		container: HTMLElement,
		message: Message,
		component: Component,
		app: App,
		sourcePath: string = "",
	): void {
		const messageEl = container.querySelector(
			`[data-message-id="${message.id}"]`,
		);
		if (!messageEl) {
			console.warn("[MessageRenderer] 找不到消息元素:", message.id);
			return;
		}

		const contentEl = messageEl.querySelector(
			".acp-message-content",
		) as HTMLElement;
		if (!contentEl) {
			console.warn("[MessageRenderer] 找不到消息内容元素:", message.id);
			return;
		}

		const newContent = message.content || "";

		if (message.isStreaming) {
			// 流式渲染：节流 Markdown 渲染
			this.updateStreaming(
				message.id,
				contentEl,
				newContent,
				component,
				app,
				sourcePath,
			);
		} else {
			// 流式结束：最终渲染
			this.finalizeStreaming(
				message.id,
				contentEl,
				newContent,
				component,
				app,
				sourcePath,
			);
		}
	}

	/**
	 * 流式更新（节流 Markdown 渲染）
	 */
	private static updateStreaming(
		messageId: string,
		contentEl: HTMLElement,
		content: string,
		component: Component,
		app: App,
		sourcePath: string,
	): void {
		let state = streamingState.get(messageId);

		if (!state) {
			state = {
				lastRenderTime: 0,
				lastContent: "",
				pendingRender: null,
			};
			streamingState.set(messageId, state);
		}

		// 内容没变，跳过
		if (content === state.lastContent) {
			return;
		}

		state.lastContent = content;

		const now = Date.now();
		const timeSinceLastRender = now - state.lastRenderTime;

		// 清除待处理的渲染
		if (state.pendingRender !== null) {
			window.clearTimeout(state.pendingRender);
			state.pendingRender = null;
		}

		if (timeSinceLastRender >= this.config.throttleInterval) {
			// 立即渲染
			this.doMarkdownRender(
				contentEl,
				content,
				component,
				app,
				sourcePath,
				true,
			);
			state.lastRenderTime = now;
		} else {
			// 延迟渲染
			const delay = this.config.throttleInterval - timeSinceLastRender;
			state.pendingRender = window.setTimeout(() => {
				const currentState = streamingState.get(messageId);
				if (currentState) {
					this.doMarkdownRender(
						contentEl,
						currentState.lastContent,
						component,
						app,
						sourcePath,
						true,
					);
					currentState.lastRenderTime = Date.now();
					currentState.pendingRender = null;
				}
			}, delay);
		}
	}

	/**
	 * 完成流式渲染
	 */
	private static finalizeStreaming(
		messageId: string,
		contentEl: HTMLElement,
		content: string,
		component: Component,
		app: App,
		sourcePath: string,
	): void {
		// 清理状态
		const state = streamingState.get(messageId);
		if (state && state.pendingRender !== null) {
			window.clearTimeout(state.pendingRender);
		}
		streamingState.delete(messageId);

		// 移除流式样式
		contentEl.removeClass("acp-message-streaming");

		// 最终渲染
		this.doMarkdownRender(
			contentEl,
			content,
			component,
			app,
			sourcePath,
			false,
		);
	}

	/**
	 * 执行 Markdown 渲染
	 */
	private static doMarkdownRender(
		contentEl: HTMLElement,
		content: string,
		component: Component,
		app: App,
		sourcePath: string,
		isStreaming: boolean,
	): void {
		requestAnimationFrame(() => {
			contentEl.empty();

			if (!content.trim()) {
				return;
			}

			// 检查是否包含图片
			const imagePattern =
				/!\[图像\]\((data:[^)]+|https?:[^)]+|file:[^)]+)\)/g;
			const hasImages = imagePattern.test(content);

			if (hasImages) {
				// 有图片，特殊处理
				void this.renderContentWithImages(
					contentEl,
					content,
					app,
					sourcePath,
					component,
				);
			} else {
				// 纯文本/Markdown
				void MarkdownRenderer.render(
					app,
					content,
					contentEl,
					sourcePath,
					component,
				).catch((error) => {
					console.error(
						"[MessageRenderer] Markdown 渲染失败:",
						error,
					);
					contentEl.textContent = content;
				});
			}

			// 流式状态样式
			if (isStreaming) {
				contentEl.addClass("acp-message-streaming");
			}
		});
	}

	/**
	 * 渲染内容（首次渲染）
	 */
	private static async renderContent(
		contentEl: HTMLElement,
		content: string,
		app: App,
		sourcePath: string,
		component: Component,
	): Promise<void> {
		// 检查是否包含图片
		const imagePattern =
			/!\[图像\]\((data:[^)]+|https?:[^)]+|file:[^)]+)\)/g;
		const hasImages = imagePattern.test(content);

		if (hasImages) {
			await this.renderContentWithImages(
				contentEl,
				content,
				app,
				sourcePath,
				component,
			);
		} else {
			try {
				await MarkdownRenderer.render(
					app,
					content,
					contentEl,
					sourcePath,
					component,
				);
			} catch (error) {
				console.error("[MessageRenderer] Markdown 渲染失败:", error);
				contentEl.textContent = content;
			}
		}
	}

	/**
	 * 渲染包含图片的内容
	 */
	private static async renderContentWithImages(
		container: HTMLElement,
		content: string,
		app: App,
		sourcePath: string,
		component: Component,
	): Promise<void> {
		const imagePattern =
			/!\[图像\]\((data:[^)]+|https?:[^)]+|file:[^)]+)\)/g;
		let lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = imagePattern.exec(content)) !== null) {
			// 渲染之前的文本
			const textBefore = content.substring(lastIndex, match.index);
			if (textBefore.trim()) {
				try {
					await MarkdownRenderer.render(
						app,
						textBefore,
						container,
						sourcePath,
						component,
					);
				} catch (error) {
					console.error(
						"[MessageRenderer] Markdown 渲染失败:",
						error,
					);
					container.createDiv({ text: textBefore });
				}
			}

			// 渲染图片
			const imageUri = match[1];
			ImageRenderer.render(container, imageUri, app);

			lastIndex = match.index + match[0].length;
		}

		// 渲染剩余文本
		const textAfter = content.substring(lastIndex);
		if (textAfter.trim()) {
			try {
				await MarkdownRenderer.render(
					app,
					textAfter,
					container,
					sourcePath,
					component,
				);
			} catch (error) {
				console.error("[MessageRenderer] Markdown 渲染失败:", error);
				container.createDiv({ text: textAfter });
			}
		}
	}

	/**
	 * 添加消息操作按钮
	 */
	private static addMessageActions(
		messageEl: HTMLElement,
		message: Message,
	): void {
		const actionsEl = messageEl.createDiv({ cls: "acp-message-actions" });

		// 复制按钮
		const copyBtn = actionsEl.createDiv({
			cls: "acp-message-copy-btn",
			attr: { "aria-label": "复制消息" },
		});
		setIcon(copyBtn, "copy");

		copyBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			const text = message.content || "";
			if (text) {
				void navigator.clipboard.writeText(text).then(() => {
					new Notice("已复制消息");

					copyBtn.empty();
					setIcon(copyBtn, "check");
					setTimeout(() => {
						copyBtn.empty();
						setIcon(copyBtn, "copy");
					}, 1500);
				});
			}
		});
	}

	/**
	 * 清理流式状态（组件卸载时调用）
	 */
	public static cleanup(messageId?: string): void {
		if (messageId) {
			const state = streamingState.get(messageId);
			if (state && state.pendingRender !== null) {
				window.clearTimeout(state.pendingRender);
			}
			streamingState.delete(messageId);
		} else {
			// 清理所有
			for (const [, state] of streamingState) {
				if (state.pendingRender !== null) {
					window.clearTimeout(state.pendingRender);
				}
			}
			streamingState.clear();
		}
	}
}
