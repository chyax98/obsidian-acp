/**
 * 思考块渲染器
 *
 * 渲染 Agent 的思考过程，支持：
 * - 可折叠展示
 * - 流式更新
 * - 脉冲动画
 */

import { setIcon } from "obsidian";

/**
 * 思考块渲染器
 */
export class ThoughtRenderer {
	/**
	 * 渲染思考块
	 *
	 * @param container - 容器元素（应该是 turn 容器）
	 * @param thoughts - 思考内容列表
	 * @param isStreaming - 是否正在流式输出
	 * @returns 思考块元素
	 */
	public static render(
		container: HTMLElement,
		thoughts: string[],
		isStreaming = false,
	): HTMLElement | null {
		// 过滤空内容
		const validThoughts = thoughts.filter((t) => t && t.trim());

		// 如果没有有效思考内容，不渲染
		if (validThoughts.length === 0) {
			return null;
		}

		// 查找已存在的思考块
		const thoughtsEl = container.querySelector(
			".acp-thoughts",
		) as HTMLElement;

		if (thoughtsEl) {
			// 增量更新
			this.updateExisting(thoughtsEl, validThoughts, isStreaming);
			return thoughtsEl;
		}

		// 创建新元素
		return this.createNew(container, validThoughts, isStreaming);
	}

	/**
	 * 更新已存在的思考块
	 */
	private static updateExisting(
		thoughtsEl: HTMLElement,
		thoughts: string[],
		isStreaming: boolean,
	): void {
		requestAnimationFrame(() => {
			// 更新计数
			const countEl = thoughtsEl.querySelector(".acp-thoughts-count");
			if (countEl) {
				countEl.textContent = `(${thoughts.length})`;
			}

			// 更新标题
			const titleEl = thoughtsEl.querySelector(".acp-thoughts-title");
			if (titleEl) {
				titleEl.textContent = isStreaming ? "正在思考..." : "思考过程";
			}

			// 更新图标动画
			const iconEl = thoughtsEl.querySelector(".acp-thoughts-icon");
			if (iconEl) {
				if (isStreaming) {
					iconEl.addClass("acp-thoughts-streaming");
				} else {
					iconEl.removeClass("acp-thoughts-streaming");
				}
			}

			// 增量添加新的思考项
			const contentEl = thoughtsEl.querySelector(".acp-thoughts-content");
			if (contentEl) {
				const existingCount =
					contentEl.querySelectorAll(".acp-thought-item").length;
				for (let i = existingCount; i < thoughts.length; i++) {
					const thoughtEl = (contentEl as HTMLElement).createDiv({
						cls: "acp-thought-item",
					});
					thoughtEl.textContent = thoughts[i];
				}
			}
		});
	}

	/**
	 * 创建新的思考块
	 *
	 * 插入位置逻辑：
	 * - 如果有正在流式输出的消息，插入到该消息之前
	 * - 否则追加到容器末尾
	 */
	private static createNew(
		container: HTMLElement,
		thoughts: string[],
		isStreaming: boolean,
	): HTMLElement {
		// 先创建元素（会追加到末尾）
		const thoughtsEl = container.createDiv({ cls: "acp-thoughts" });

		// 查找正在流式输出的消息，调整位置
		const streamingMessage = container.querySelector(
			".acp-message-assistant .acp-message-streaming",
		);

		if (streamingMessage) {
			// 找到消息的父元素（.acp-message-assistant）
			const messageEl = streamingMessage.closest(".acp-message-assistant");
			if (messageEl && messageEl.parentElement === container) {
				// 移动思考块到消息之前
				container.insertBefore(thoughtsEl, messageEl);
			}
		}

		// 头部
		const headerEl = thoughtsEl.createDiv({ cls: "acp-thoughts-header" });
		const leftEl = headerEl.createDiv({ cls: "acp-thoughts-left" });

		// 展开/折叠图标
		const toggleIcon = leftEl.createDiv({ cls: "acp-thoughts-toggle" });
		setIcon(toggleIcon, "chevron-right");

		// 思考图标
		const thinkIcon = leftEl.createDiv({
			cls: isStreaming
				? "acp-thoughts-icon acp-thoughts-streaming"
				: "acp-thoughts-icon",
		});
		setIcon(thinkIcon, "brain");

		// 标题
		leftEl.createDiv({
			cls: "acp-thoughts-title",
			text: isStreaming ? "正在思考..." : "思考过程",
		});

		// 数量
		leftEl.createDiv({
			cls: "acp-thoughts-count",
			text: `(${thoughts.length})`,
		});

		// 内容区域（默认折叠）
		const contentEl = thoughtsEl.createDiv({
			cls: "acp-thoughts-content",
			attr: { "data-expanded": "false" },
		});

		// 渲染每条思考
		for (const thought of thoughts) {
			const thoughtEl = contentEl.createDiv({ cls: "acp-thought-item" });
			thoughtEl.textContent = thought;
		}

		// 点击头部切换
		headerEl.addEventListener("click", () => {
			const expanded = contentEl.getAttribute("data-expanded") === "true";
			const newExpanded = !expanded;
			contentEl.setAttribute(
				"data-expanded",
				newExpanded ? "true" : "false",
			);

			if (newExpanded) {
				contentEl.addClass("acp-thoughts-content-expanded");
			} else {
				contentEl.removeClass("acp-thoughts-content-expanded");
			}

			toggleIcon.empty();
			setIcon(toggleIcon, newExpanded ? "chevron-down" : "chevron-right");
		});

		return thoughtsEl;
	}
}
