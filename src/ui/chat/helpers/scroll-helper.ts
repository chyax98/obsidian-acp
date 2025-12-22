/**
 * 滚动管理辅助类
 *
 * 提供智能滚动和"跳到最新"按钮功能
 */

import { setIcon } from "obsidian";

/**
 * 滚动配置
 */
export interface ScrollConfig {
	/** 判断是否接近底部的阈值（像素） */
	nearBottomThreshold: number;
	/** 防抖延迟（毫秒） */
	debounceDelay: number;
}

const DEFAULT_CONFIG: ScrollConfig = {
	nearBottomThreshold: 100,
	debounceDelay: 50,
};

/**
 * 滚动管理辅助类
 */
export class ScrollHelper {
	private messagesEl: HTMLElement;
	private scrollToBottomButton: HTMLElement | null = null;
	private scrollDebounceTimer: NodeJS.Timeout | null = null;
	private pendingScroll: boolean = false;
	private config: ScrollConfig;

	constructor(messagesEl: HTMLElement, config: Partial<ScrollConfig> = {}) {
		this.messagesEl = messagesEl;
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * 创建"跳到最新"按钮
	 */
	public createScrollButton(container: HTMLElement): HTMLElement {
		this.scrollToBottomButton = container.createDiv({
			cls: "acp-scroll-to-bottom",
			attr: { "aria-label": "跳到最新" },
		});
		this.scrollToBottomButton.style.display = "none";
		setIcon(this.scrollToBottomButton, "arrow-down");

		this.scrollToBottomButton.addEventListener("click", () => {
			this.forceScrollToBottom();
		});

		// 监听消息区域滚动
		this.messagesEl.addEventListener("scroll", () => {
			this.updateScrollButton();
		});

		return this.scrollToBottomButton;
	}

	/**
	 * 判断是否接近底部
	 */
	public isNearBottom(threshold?: number): boolean {
		const t = threshold ?? this.config.nearBottomThreshold;
		const { scrollTop, scrollHeight, clientHeight } = this.messagesEl;
		return scrollTop + clientHeight >= scrollHeight - t;
	}

	/**
	 * 智能滚动（仅在用户接近底部时自动滚动）
	 *
	 * 使用防抖，避免频繁滚动导致的抖动
	 */
	public smartScroll(): void {
		this.pendingScroll = true;

		if (this.scrollDebounceTimer) {
			clearTimeout(this.scrollDebounceTimer);
		}

		this.scrollDebounceTimer = setTimeout(() => {
			if (this.pendingScroll && this.isNearBottom()) {
				requestAnimationFrame(() => {
					this.forceScrollToBottom();
				});
			}
			this.updateScrollButton();
			this.pendingScroll = false;
		}, this.config.debounceDelay);
	}

	/**
	 * 强制滚动到底部
	 */
	public forceScrollToBottom(): void {
		this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
		this.updateScrollButton();
	}

	/**
	 * 更新"跳到最新"按钮的显示状态
	 */
	public updateScrollButton(): void {
		if (!this.scrollToBottomButton) return;

		if (this.isNearBottom(50)) {
			this.scrollToBottomButton.style.display = "none";
		} else {
			this.scrollToBottomButton.style.display = "flex";
		}
	}

	/**
	 * 清理资源
	 */
	public destroy(): void {
		if (this.scrollDebounceTimer) {
			clearTimeout(this.scrollDebounceTimer);
			this.scrollDebounceTimer = null;
		}
	}
}
