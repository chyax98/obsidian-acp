/**
 * 消息渲染器 - 兼容层
 *
 * 此文件为兼容层，实际实现已拆分到 ./renderers/ 目录下：
 * - message-renderer.ts - 消息文本渲染（含流式 Markdown）
 * - tool-call-renderer.ts - 工具调用卡片
 * - thought-renderer.ts - 思考块渲染
 * - plan-renderer.ts - 计划渲染
 * - image-renderer.ts - 图片处理
 * - diff-renderer.ts - Diff 渲染
 * - terminal-renderer.ts - 终端输出
 * - code-block-renderer.ts - 代码块
 * - utils.ts - 工具函数
 *
 * 保持原有 API 以确保向后兼容。
 */

import type { Component, App } from "obsidian";
import type { Message, ToolCall, PlanEntry } from "../acp/core/session-manager";

// 导入新的拆分模块
import {
	MessageRenderer as NewMessageRenderer,
	ToolCallRenderer,
	ThoughtRenderer,
	PlanRenderer,
	CodeBlockRenderer,
} from "./renderers";

/**
 * 消息渲染器
 *
 * @deprecated 建议直接使用 ./renderers 目录下的具体渲染器
 */
export class MessageRenderer {
	/**
	 * 渲染消息
	 */
	public static async renderMessage(
		container: HTMLElement,
		message: Message,
		component: Component,
		app: App,
		sourcePath: string = "",
	): Promise<void> {
		return NewMessageRenderer.render(
			container,
			message,
			component,
			app,
			sourcePath,
		);
	}

	/**
	 * 更新消息内容
	 */
	public static updateMessage(
		container: HTMLElement,
		message: Message,
		component: Component,
		app: App,
		sourcePath: string = "",
	): void {
		NewMessageRenderer.update(
			container,
			message,
			component,
			app,
			sourcePath,
		);
	}

	/**
	 * 渲染工具调用卡片
	 */
	public static renderToolCall(
		container: HTMLElement,
		toolCall: ToolCall,
		app?: App,
	): HTMLElement {
		return ToolCallRenderer.render(container, toolCall, app);
	}

	/**
	 * 渲染工具调用组
	 */
	public static renderToolCallGroup(
		container: HTMLElement,
		toolCalls: ToolCall[],
		groupTitle?: string,
		app?: App,
	): HTMLElement {
		return ToolCallRenderer.renderGroup(
			container,
			toolCalls,
			groupTitle,
			app,
		);
	}

	/**
	 * 渲染思考块
	 */
	public static renderThoughts(
		container: HTMLElement,
		thoughts: string[],
		isStreaming = false,
	): HTMLElement {
		return ThoughtRenderer.render(container, thoughts, isStreaming);
	}

	/**
	 * 渲染计划
	 */
	public static renderPlan(
		container: HTMLElement,
		plan: PlanEntry[],
	): HTMLElement {
		return PlanRenderer.render(container, plan);
	}

	/**
	 * 渲染代码块
	 */
	public static renderCodeBlock(
		container: HTMLElement,
		code: string,
		language: string = "text",
		filename?: string,
	): void {
		CodeBlockRenderer.render(container, code, language, filename);
	}

	/**
	 * 清理流式渲染状态
	 */
	public static cleanup(messageId?: string): void {
		NewMessageRenderer.cleanup(messageId);
	}
}
