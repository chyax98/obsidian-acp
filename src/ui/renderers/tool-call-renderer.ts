/**
 * 工具调用渲染器
 *
 * 渲染工具调用卡片，支持：
 * - 状态指示器
 * - 可折叠详情
 * - 输入参数显示
 * - 输出结果显示
 * - Subagent 嵌套显示
 */

import type { App } from "obsidian";
import { setIcon } from "obsidian";
import type { ToolCall } from "../../acp/core/session-manager";
import { ToolCallDisplayHelper } from "./tool-call-display";
import { ToolCallContentRenderer } from "./tool-call-content";
import { formatDuration } from "./utils";

/**
 * 工具调用渲染器
 */
export class ToolCallRenderer {
	/**
	 * 渲染工具调用卡片
	 */
	public static render(
		container: HTMLElement,
		toolCall: ToolCall,
		app?: App,
	): HTMLElement {
		// 查找是否已存在
		const toolCallEl = container.querySelector(
			`[data-tool-call-id="${toolCall.toolCallId}"]`,
		) as HTMLElement;

		if (toolCallEl) {
			this.updateCard(toolCallEl, toolCall, app);
			return toolCallEl;
		}

		return this.createCard(container, toolCall, app);
	}

	/**
	 * 渲染带嵌套结构的工具调用列表
	 * 支持 subagent 嵌套显示
	 */
	public static renderWithNesting(
		container: HTMLElement,
		toolCalls: ToolCall[],
		app?: App,
	): void {
		// 构建父子关系映射
		const childrenMap = new Map<string, ToolCall[]>();
		const rootCalls: ToolCall[] = [];

		for (const tc of toolCalls) {
			if (tc.parentToolUseId) {
				const children = childrenMap.get(tc.parentToolUseId) || [];
				children.push(tc);
				childrenMap.set(tc.parentToolUseId, children);
			} else {
				rootCalls.push(tc);
			}
		}

		// 只渲染根节点，子节点在内容区域嵌套渲染
		for (const rootCall of rootCalls) {
			const el = this.render(container, rootCall, app);
			// 渲染子工具调用
			const children = childrenMap.get(rootCall.toolCallId);
			if (children && children.length > 0) {
				this.renderChildren(el, children, childrenMap, app);
			}
		}
	}

	/**
	 * 渲染子工具调用（嵌套）
	 */
	private static renderChildren(
		parentEl: HTMLElement,
		children: ToolCall[],
		childrenMap: Map<string, ToolCall[]>,
		app?: App,
	): void {
		// 查找或创建嵌套容器
		let nestedContainer = parentEl.querySelector(
			".acp-tool-call-nested",
		) as HTMLElement;

		if (!nestedContainer) {
			const contentEl = parentEl.querySelector(".acp-tool-call-content");
			if (contentEl) {
				nestedContainer = (contentEl as HTMLElement).createDiv({
					cls: "acp-tool-call-nested",
				});
			} else {
				return;
			}
		}

		for (const child of children) {
			const childEl = this.render(nestedContainer, child, app);
			childEl.addClass("acp-tool-call-child");

			// 递归渲染孙子节点
			const grandChildren = childrenMap.get(child.toolCallId);
			if (grandChildren && grandChildren.length > 0) {
				this.renderChildren(childEl, grandChildren, childrenMap, app);
			}
		}
	}

	/**
	 * 创建新的工具调用卡片
	 */
	private static createCard(
		container: HTMLElement,
		toolCall: ToolCall,
		app?: App,
	): HTMLElement {
		const toolCallEl = container.createDiv({
			cls: `acp-tool-call acp-tool-call-${toolCall.status}`,
			attr: {
				"data-tool-call-id": toolCall.toolCallId,
				"data-status": toolCall.status,
			},
		});

		// 卡片头部
		const headerEl = toolCallEl.createDiv({ cls: "acp-tool-call-header" });

		// 左侧：状态图标 + 标题
		const leftEl = headerEl.createDiv({ cls: "acp-tool-call-left" });

		// 状态图标
		const iconEl = leftEl.createDiv({
			cls: `acp-tool-call-icon acp-status-${toolCall.status}`,
		});
		this.setStatusIcon(iconEl, toolCall.status);

		// 获取显示信息
		const displayInfo = ToolCallDisplayHelper.getDisplayInfo(toolCall);

		// 主标题
		const titleEl = leftEl.createDiv({ cls: "acp-tool-call-title" });
		titleEl.textContent = displayInfo.title;

		// 显示关键参数
		const paramsPreview = ToolCallDisplayHelper.formatParamsPreview(
			toolCall.rawInput,
			toolCall.kind,
		);
		if (paramsPreview) {
			const paramsEl = leftEl.createDiv({ cls: "acp-tool-call-params" });
			paramsEl.textContent = paramsPreview;
		}

		// 右侧：时间 + 展开图标
		const rightEl = headerEl.createDiv({ cls: "acp-tool-call-right" });

		// 时间信息
		const timeEl = rightEl.createDiv({ cls: "acp-tool-call-time" });
		timeEl.textContent = this.formatTime(toolCall);

		// 展开/折叠指示器
		const chevronEl = rightEl.createDiv({ cls: "acp-tool-call-chevron" });

		// 默认折叠工具调用，头部已显示关键信息，用户可点击展开
		const shouldExpandByDefault = false;
		setIcon(
			chevronEl,
			shouldExpandByDefault ? "chevron-down" : "chevron-right",
		);

		// 内容区域
		const contentEl = toolCallEl.createDiv({
			cls: `acp-tool-call-content${shouldExpandByDefault ? " acp-tool-call-content-expanded" : ""}`,
			attr: { "data-expanded": shouldExpandByDefault ? "true" : "false" },
		});

		// 渲染内容
		ToolCallContentRenderer.render(contentEl, toolCall, app);

		// 点击头部切换
		headerEl.addEventListener("click", () => {
			const expanded = contentEl.getAttribute("data-expanded") === "true";
			const newExpanded = !expanded;
			contentEl.setAttribute(
				"data-expanded",
				newExpanded ? "true" : "false",
			);

			if (newExpanded) {
				contentEl.addClass("acp-tool-call-content-expanded");
			} else {
				contentEl.removeClass("acp-tool-call-content-expanded");
			}

			chevronEl.empty();
			setIcon(chevronEl, newExpanded ? "chevron-down" : "chevron-right");
		});

		return toolCallEl;
	}

	/**
	 * 更新工具调用卡片（增量更新）
	 */
	private static updateCard(
		toolCallEl: HTMLElement,
		toolCall: ToolCall,
		app?: App,
	): void {
		requestAnimationFrame(() => {
			const currentStatus = toolCallEl.getAttribute("data-status");
			if (currentStatus !== toolCall.status) {
				toolCallEl.className = `acp-tool-call acp-tool-call-${toolCall.status}`;
				toolCallEl.setAttribute("data-status", toolCall.status);

				const iconEl = toolCallEl.querySelector(".acp-tool-call-icon");
				if (iconEl) {
					iconEl.className = `acp-tool-call-icon acp-status-${toolCall.status}`;
					this.setStatusIcon(iconEl as HTMLElement, toolCall.status);
				}

				// 状态变为 completed 或 failed 时，清理渲染状态
				if (
					toolCall.status === "completed" ||
					toolCall.status === "failed"
				) {
					ToolCallContentRenderer.cleanup(toolCall.toolCallId);
				}
			}

			// 更新时间
			const timeEl = toolCallEl.querySelector(".acp-tool-call-time");
			if (timeEl) {
				const newTime = this.formatTime(toolCall);
				if (timeEl.textContent !== newTime) {
					timeEl.textContent = newTime;
				}
			}

			// 增量更新内容（只渲染新增的内容块）
			if (toolCall.content && toolCall.content.length > 0) {
				const contentEl = toolCallEl.querySelector(
					".acp-tool-call-content",
				);
				if (contentEl) {
					ToolCallContentRenderer.renderIncremental(
						contentEl as HTMLElement,
						toolCall,
						app,
					);
				}
			}
		});
	}

	/**
	 * 设置状态图标
	 */
	private static setStatusIcon(
		iconEl: HTMLElement,
		status: ToolCall["status"],
	): void {
		iconEl.empty();
		iconEl.className = `acp-tool-call-icon acp-tool-call-status-${status}`;

		const iconMap: Record<string, string> = {
			pending: "clock",
			in_progress: "loader-2",
			completed: "check-circle",
			failed: "x-circle",
			blocked: "shield-off",
		};

		setIcon(iconEl, iconMap[status] || "help-circle");
	}

	/**
	 * 检测是否为 blocked 状态
	 * 根据工具调用结果内容判断
	 */
	public static isBlockedResult(content: string, isError?: boolean): boolean {
		const lower = content.toLowerCase();
		if (lower.includes("blocked by blocklist")) return true;
		if (lower.includes("outside the vault")) return true;
		if (lower.includes("access denied")) return true;
		if (lower.includes("user denied")) return true;
		if (lower.includes("permission denied")) return true;
		if (lower.includes("not allowed")) return true;
		if (isError && lower.includes("deny")) return true;
		return false;
	}

	/**
	 * 格式化工具调用时间
	 */
	private static formatTime(toolCall: ToolCall): string {
		if (toolCall.endTime) {
			return formatDuration(toolCall.endTime - toolCall.startTime);
		}
		if (toolCall.status === "in_progress") {
			return "执行中...";
		}
		return "等待中";
	}

	/**
	 * 渲染工具调用组
	 */
	public static renderGroup(
		container: HTMLElement,
		toolCalls: ToolCall[],
		groupTitle?: string,
		app?: App,
	): HTMLElement {
		const groupEl = container.createDiv({ cls: "acp-tool-call-group" });

		// 分组头部
		const headerEl = groupEl.createDiv({
			cls: "acp-tool-call-group-header",
		});

		// 展开/折叠图标
		const toggleIcon = headerEl.createDiv({
			cls: "acp-tool-call-group-toggle",
		});
		setIcon(toggleIcon, "chevron-down");

		// 标题
		const titleEl = headerEl.createDiv({
			cls: "acp-tool-call-group-title",
		});
		titleEl.textContent = groupTitle || `工具调用组 (${toolCalls.length})`;

		// 统计信息
		const statsEl = headerEl.createDiv({
			cls: "acp-tool-call-group-stats",
		});
		const stats = this.calculateStats(toolCalls);
		statsEl.innerHTML = `
			<span class="acp-tool-call-stat acp-tool-call-stat-total">${stats.total}</span>
			<span class="acp-tool-call-stat acp-tool-call-stat-completed">${stats.completed}</span>
			<span class="acp-tool-call-stat acp-tool-call-stat-error">${stats.error}</span>
		`;

		// 列表容器
		const listEl = groupEl.createDiv({ cls: "acp-tool-call-group-list" });
		listEl.setAttribute("data-expanded", "true");

		// 渲染每个工具调用
		for (const toolCall of toolCalls) {
			this.render(listEl, toolCall, app);
		}

		// 点击头部切换
		headerEl.addEventListener("click", () => {
			const expanded = listEl.getAttribute("data-expanded") === "true";
			listEl.setAttribute("data-expanded", expanded ? "false" : "true");
			listEl.toggleClass("acp-tool-call-group-list-collapsed", expanded);

			toggleIcon.empty();
			setIcon(toggleIcon, expanded ? "chevron-right" : "chevron-down");
		});

		return groupEl;
	}

	/**
	 * 计算工具调用统计
	 */
	private static calculateStats(toolCalls: ToolCall[]): {
		total: number;
		completed: number;
		error: number;
	} {
		return {
			total: toolCalls.length,
			completed: toolCalls.filter((tc) => tc.status === "completed")
				.length,
			error: toolCalls.filter((tc) => tc.status === "failed").length,
		};
	}
}
