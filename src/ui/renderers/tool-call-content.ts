/**
 * 工具调用内容渲染器
 *
 * 负责渲染工具调用的输出结果和位置信息
 */

import type { App } from "obsidian";
import { setIcon, Notice, MarkdownView, TFile } from "obsidian";
import type { ToolCall } from "../../acp/core/session-manager";
import type { ToolCallContent } from "../../acp/types/updates";
import { DiffRenderer } from "./diff-renderer";
import { TerminalRenderer } from "./terminal-renderer";
import { CodeBlockRenderer } from "./code-block-renderer";
import { ToolCallInputRenderer } from "./tool-call-input";

/** 渲染状态跟踪 */
interface RenderState {
	/** 已渲染的内容块数量 */
	renderedCount: number;
	/** 输出区域元素 */
	outputSection: HTMLElement | null;
}

/**
 * 工具调用内容渲染器
 */
export class ToolCallContentRenderer {
	/** 渲染状态跟踪（按 toolCallId） */
	private static renderStates: Map<string, RenderState> = new Map();

	/**
	 * 渲染工具调用内容（完整渲染）
	 */
	public static render(
		contentEl: HTMLElement,
		toolCall: ToolCall,
		app?: App,
	): void {
		const kind = toolCall.kind?.toLowerCase() || "";
		const hasRawInput =
			toolCall.rawInput && Object.keys(toolCall.rawInput).length > 0;
		const hasContent = toolCall.content && toolCall.content.length > 0;
		const hasLocations =
			toolCall.locations && toolCall.locations.length > 0;

		// 渲染输入参数
		if (hasRawInput && toolCall.rawInput) {
			ToolCallInputRenderer.render(
				contentEl,
				toolCall.rawInput,
				kind,
				app,
			);
		}

		// 渲染 locations
		if (hasLocations && app && toolCall.locations) {
			this.renderLocations(contentEl, toolCall.locations, app);
		}

		// 渲染输出结果
		if (hasContent) {
			const outputSection = this.renderOutput(contentEl, toolCall, app);
			// 初始化渲染状态
			this.renderStates.set(toolCall.toolCallId, {
				renderedCount: toolCall.content?.length || 0,
				outputSection,
			});
		} else if (!hasRawInput && !hasLocations) {
			contentEl.createDiv({
				cls: "acp-tool-call-empty",
				text: "（无内容）",
			});
		}
	}

	/**
	 * 增量渲染工具调用内容（只渲染新增的内容块）
	 */
	public static renderIncremental(
		contentEl: HTMLElement,
		toolCall: ToolCall,
		app?: App,
	): void {
		const state = this.renderStates.get(toolCall.toolCallId);
		const contentLength = toolCall.content?.length || 0;

		// 如果没有状态或没有内容，走完整渲染
		if (!state || contentLength === 0) {
			contentEl.empty();
			this.render(contentEl, toolCall, app);
			return;
		}

		// 内容没有变化，跳过
		if (state.renderedCount >= contentLength) {
			return;
		}

		// 获取输出区域
		let outputSection = state.outputSection;
		if (!outputSection) {
			// 还没有输出区域，创建一个
			outputSection = contentEl.createDiv({
				cls: "acp-tool-call-section acp-tool-call-output",
			});

			// 添加输出标题（如果有输入参数）
			const hasRawInput =
				toolCall.rawInput && Object.keys(toolCall.rawInput).length > 0;
			if (hasRawInput) {
				const headerEl = outputSection.createDiv({
					cls: "acp-output-header",
				});
				const iconEl = headerEl.createSpan({ cls: "acp-output-icon" });
				setIcon(iconEl, "arrow-right");
				headerEl.createSpan({ text: "输出" });
			}

			state.outputSection = outputSection;
		}

		// 只渲染新增的内容块
		const newContents = toolCall.content?.slice(state.renderedCount) || [];
		for (const content of newContents) {
			this.renderSingleContentBlock(outputSection, content, toolCall, app);
		}

		// 更新已渲染数量
		state.renderedCount = contentLength;
	}

	/**
	 * 渲染单个内容块
	 */
	private static renderSingleContentBlock(
		outputSection: HTMLElement,
		content: ToolCallContent,
		toolCall: ToolCall,
		app?: App,
	): void {
		const blockEl = outputSection.createDiv({
			cls: "acp-tool-call-content-block",
		});

		switch (content.type) {
			case "content": {
				blockEl.addClass("acp-tool-call-content-text");
				const textContent = content.content;
				if (textContent && textContent.type === "text") {
					CodeBlockRenderer.renderTextWithCopy(
						blockEl,
						textContent.text || "",
					);
				}
				break;
			}

			case "diff":
				blockEl.addClass("acp-tool-call-content-diff");
				DiffRenderer.render(blockEl, content, app);
				break;

			case "terminal": {
				blockEl.addClass("acp-tool-call-content-terminal");
				const command = toolCall.rawInput?.command as string | undefined;
				TerminalRenderer.render(blockEl, command, content.terminalId);
				break;
			}

			default:
				blockEl.textContent = JSON.stringify(content, null, 2);
		}
	}

	/**
	 * 清理渲染状态
	 */
	public static cleanup(toolCallId?: string): void {
		if (toolCallId) {
			this.renderStates.delete(toolCallId);
		} else {
			this.renderStates.clear();
		}
	}

	/**
	 * 渲染位置列表
	 */
	private static renderLocations(
		container: HTMLElement,
		locations: Array<{ path: string; line?: number; column?: number }>,
		app: App,
	): void {
		const locationsContainer = container.createDiv({
			cls: "acp-tool-call-locations",
		});

		// 标题
		const headerEl = locationsContainer.createDiv({
			cls: "acp-tool-call-locations-header",
		});
		const iconEl = headerEl.createDiv({
			cls: "acp-tool-call-locations-icon",
		});
		setIcon(iconEl, "file-text");
		headerEl.createDiv({
			cls: "acp-tool-call-locations-title",
			text: "相关文件",
		});

		// 位置列表
		const listEl = locationsContainer.createDiv({
			cls: "acp-tool-call-locations-list",
		});

		for (const location of locations) {
			const locationEl = listEl.createDiv({
				cls: "acp-tool-call-location-item",
			});

			const pathEl = locationEl.createDiv({ cls: "acp-location-path" });
			pathEl.textContent = location.path;

			if (location.line !== undefined) {
				const positionEl = locationEl.createDiv({
					cls: "acp-location-position",
				});
				positionEl.textContent = `:${location.line}${location.column !== undefined ? `:${location.column}` : ""}`;
			}

			locationEl.addEventListener("click", () => {
				void this.openFileAtLocation(
					app,
					location.path,
					location.line,
					location.column,
				);
			});
		}
	}

	/**
	 * 打开文件到指定位置
	 */
	private static async openFileAtLocation(
		app: App,
		path: string,
		line?: number,
		column?: number,
	): Promise<void> {
		const file = app.vault.getAbstractFileByPath(path);

		if (file instanceof TFile) {
			const leaf = app.workspace.getLeaf(false);
			await leaf.openFile(file);

			if (line !== undefined) {
				await new Promise((resolve) => setTimeout(resolve, 100));

				const view = app.workspace.getActiveViewOfType(MarkdownView);
				if (view && view.editor) {
					const editor = view.editor;
					const adjustedLine = Math.max(0, (line || 1) - 1);
					const adjustedColumn =
						column !== undefined ? Math.max(0, column - 1) : 0;

					editor.setCursor({
						line: adjustedLine,
						ch: adjustedColumn,
					});
					editor.scrollIntoView(
						{
							from: { line: adjustedLine, ch: 0 },
							to: { line: adjustedLine, ch: 0 },
						},
						true,
					);
				}
			}
		} else {
			new Notice(`文件不存在: ${path}`);
		}
	}

	/**
	 * 渲染输出结果
	 * @returns 输出区域元素，用于增量渲染时复用
	 */
	private static renderOutput(
		contentEl: HTMLElement,
		toolCall: ToolCall,
		app?: App,
	): HTMLElement | null {
		if (!toolCall.content || toolCall.content.length === 0) return null;

		const outputSection = contentEl.createDiv({
			cls: "acp-tool-call-section acp-tool-call-output",
		});

		// 输出标题
		if (toolCall.rawInput && Object.keys(toolCall.rawInput).length > 0) {
			const headerEl = outputSection.createDiv({
				cls: "acp-output-header",
			});
			const iconEl = headerEl.createSpan({ cls: "acp-output-icon" });
			setIcon(iconEl, "arrow-right");
			headerEl.createSpan({ text: "输出" });
		}

		// 渲染每个内容块
		for (const content of toolCall.content) {
			this.renderSingleContentBlock(outputSection, content, toolCall, app);
		}

		return outputSection;
	}
}
