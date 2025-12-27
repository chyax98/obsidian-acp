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
		// 防止重复渲染：先清空容器
		contentEl.empty();

		const kind = toolCall.kind?.toLowerCase() || "";
		const hasRawInput =
			toolCall.rawInput && Object.keys(toolCall.rawInput).length > 0;
		const hasContent = toolCall.content && toolCall.content.length > 0;
		const hasLocations =
			toolCall.locations && toolCall.locations.length > 0;

		// 尝试从上下文提取输入参数（用于 rawInput 为空时的兜底）
		const extractedInput = this.extractInputFromContext(toolCall);

		// 始终显示工具基本信息，传递提取的输入以显示路径
		this.renderToolInfo(contentEl, toolCall, extractedInput);

		// 渲染输入参数（仅当有 rawInput 且不是简单的路径时才显示详细输入区）
		if (hasRawInput && toolCall.rawInput) {
			// 检查是否有除了 path 以外的其他参数
			const otherKeys = Object.keys(toolCall.rawInput).filter(
				k => !["path", "file_path", "filePath", "filename"].includes(k)
			);
			if (otherKeys.length > 0) {
				ToolCallInputRenderer.render(
					contentEl,
					toolCall.rawInput,
					kind,
					app,
				);
			}
		} else if (extractedInput && Object.keys(extractedInput).length > 0) {
			// 检查是否有除了 path 以外的其他参数
			const otherKeys = Object.keys(extractedInput).filter(
				k => !["path", "file_path", "filePath", "filename"].includes(k)
			);
			if (otherKeys.length > 0) {
				ToolCallInputRenderer.render(
					contentEl,
					extractedInput,
					kind,
					app,
				);
			}
		}

		// 渲染 locations（如果有额外的位置信息且未在 renderToolInfo 中显示）
		if (hasLocations && app && toolCall.locations && toolCall.locations.length > 1) {
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
		}
	}

	/**
	 * 渲染工具基本信息
	 *
	 * 始终显示，即使没有 rawInput
	 * @param extractedInput - 从上下文提取的输入参数（用于显示路径等信息）
	 */
	private static renderToolInfo(
		container: HTMLElement,
		toolCall: ToolCall,
		extractedInput?: Record<string, unknown> | null,
	): void {
		const infoSection = container.createDiv({
			cls: "acp-tool-call-info",
		});

		// 工具名称/标题
		if (toolCall.title) {
			const titleRow = infoSection.createDiv({ cls: "acp-tool-info-row" });
			titleRow.createSpan({ cls: "acp-tool-info-label", text: "工具" });
			titleRow.createSpan({
				cls: "acp-tool-info-value acp-tool-info-title",
				text: toolCall.title,
			});
		}

		// 工具类型
		const kindRow = infoSection.createDiv({ cls: "acp-tool-info-row" });
		kindRow.createSpan({ cls: "acp-tool-info-label", text: "类型" });
		kindRow.createSpan({
			cls: "acp-tool-info-value",
			text: toolCall.kind || "unknown",
		});

		// 显示文件路径（从 rawInput、locations 或 content 提取）
		const filePath = this.getFilePath(toolCall, extractedInput);
		if (filePath) {
			const pathRow = infoSection.createDiv({ cls: "acp-tool-info-row" });
			pathRow.createSpan({ cls: "acp-tool-info-label", text: "文件" });
			pathRow.createSpan({
				cls: "acp-tool-info-value acp-tool-info-path",
				text: filePath,
			});
		}

		// 显示命令（如果是 bash/execute 类型）
		const command = this.getCommand(toolCall, extractedInput);
		if (command) {
			const cmdRow = infoSection.createDiv({ cls: "acp-tool-info-row" });
			cmdRow.createSpan({ cls: "acp-tool-info-label", text: "命令" });
			const cmdValue = cmdRow.createSpan({
				cls: "acp-tool-info-value acp-tool-info-command",
			});
			cmdValue.createEl("code", { text: command.length > 80 ? command.slice(0, 77) + "..." : command });
		}

		// 状态
		const statusRow = infoSection.createDiv({ cls: "acp-tool-info-row" });
		statusRow.createSpan({ cls: "acp-tool-info-label", text: "状态" });
		const statusText = this.getStatusText(toolCall.status);
		statusRow.createSpan({
			cls: `acp-tool-info-value acp-tool-info-status acp-status-${toolCall.status}`,
			text: statusText,
		});
	}

	/**
	 * 获取文件路径
	 */
	private static getFilePath(
		toolCall: ToolCall,
		extractedInput?: Record<string, unknown> | null,
	): string | null {
		// 1. 从 rawInput 获取
		if (toolCall.rawInput) {
			const path = toolCall.rawInput.path ||
				toolCall.rawInput.file_path ||
				toolCall.rawInput.filePath ||
				toolCall.rawInput.filename;
			if (path && typeof path === "string") return path;
		}

		// 2. 从 locations 获取
		if (toolCall.locations && toolCall.locations.length > 0) {
			return toolCall.locations[0].path;
		}

		// 3. 从提取的输入获取
		if (extractedInput?.path && typeof extractedInput.path === "string") {
			return extractedInput.path;
		}

		return null;
	}

	/**
	 * 获取命令
	 */
	private static getCommand(
		toolCall: ToolCall,
		extractedInput?: Record<string, unknown> | null,
	): string | null {
		const kind = toolCall.kind?.toLowerCase() || "";
		if (!["bash", "execute", "shell", "terminal", "run", "command"].includes(kind)) {
			return null;
		}

		// 从 rawInput 获取
		if (toolCall.rawInput?.command && typeof toolCall.rawInput.command === "string") {
			return toolCall.rawInput.command;
		}

		// 从提取的输入获取
		if (extractedInput?.command && typeof extractedInput.command === "string") {
			return extractedInput.command;
		}

		return null;
	}

	/**
	 * 获取状态文本
	 */
	private static getStatusText(status: string): string {
		const statusMap: Record<string, string> = {
			pending: "等待中",
			in_progress: "执行中",
			completed: "已完成",
			failed: "失败",
		};
		return statusMap[status] || status;
	}

	/**
	 * 从上下文中提取输入参数
	 *
	 * 当 rawInput 为空时，尝试从 title、content、locations 等字段提取信息
	 * 支持 Claude Code、Goose、OpenCode 三种 Agent
	 */
	private static extractInputFromContext(
		toolCall: ToolCall,
	): Record<string, unknown> | null {
		const result: Record<string, unknown> = {};

		// 工具名列表，用于排除从 title 中误提取
		const toolNames = ["read", "write", "edit", "bash", "execute", "search", "grep", "glob", "list", "patch"];

		// 1. 优先从 locations 中提取（最可靠）
		if (toolCall.locations && toolCall.locations.length > 0) {
			result.path = toolCall.locations[0].path;
			if (toolCall.locations[0].line) {
				result.line = toolCall.locations[0].line;
			}
		}

		// 2. 从 title 中提取文件路径
		// 格式可能是: "读取 /path/to/file", "Read /path/to/file", "编辑 xxx:10" 等
		if (!result.path && toolCall.title) {
			const title = toolCall.title;

			// 匹配 "读取 path" 或 "Read path" 格式
			const readMatch = title.match(/^(?:读取|Read)\s+(.+)$/i);
			if (readMatch) {
				const extracted = readMatch[1].trim();
				// 排除工具名作为路径
				if (!toolNames.includes(extracted.toLowerCase()) && extracted.includes("/")) {
					result.path = extracted;
				}
			}

			// 匹配 "编辑 path:line" 格式
			const editMatch = title.match(/^(?:编辑|Edit)\s+(.+?)(?::(\d+))?$/i);
			if (editMatch && !result.path) {
				const extracted = editMatch[1].trim();
				if (!toolNames.includes(extracted.toLowerCase()) && extracted.includes("/")) {
					result.path = extracted;
					if (editMatch[2]) {
						result.line = parseInt(editMatch[2], 10);
					}
				}
			}

			// 匹配 "搜索 pattern" 格式
			const searchMatch = title.match(/^(?:搜索|Search|Grep)\s+"?(.+?)"?$/i);
			if (searchMatch) {
				const extracted = searchMatch[1].trim();
				if (!toolNames.includes(extracted.toLowerCase())) {
					result.pattern = extracted;
				}
			}

			// 匹配 "执行 command" 格式
			const execMatch = title.match(/^(?:执行|Execute|Bash)(?::\s*|\s+)(.+)$/i);
			if (execMatch) {
				result.command = execMatch[1].trim();
			}

			// 直接从 title 提取路径（如果 title 本身就是路径）
			if (!result.path) {
				const pathInTitle = title.match(/(\/[^\s:]+(?:\.[a-zA-Z0-9]+)?)/);
				if (pathInTitle) {
					result.path = pathInTitle[1];
				}
			}
		}

		// 3. 从 content 中提取文件路径
		if (!result.path && toolCall.content && toolCall.content.length > 0) {
			for (const content of toolCall.content) {
				if (content.type === "content" && content.content?.type === "text") {
					const text = content.content.text || "";

					// 匹配 <file>path</file> 标签
					const fileTagMatch = text.match(/<file>([^<]+)<\/file>/);
					if (fileTagMatch) {
						result.path = fileTagMatch[1].trim();
						break;
					}

					// 匹配 "File: /path" 或 "文件: /path" 格式
					const fileLineMatch = text.match(/^(?:File|文件)[:\s]+(.+)$/im);
					if (fileLineMatch) {
						result.path = fileLineMatch[1].trim();
						break;
					}

					// 匹配文件路径格式（以 / 开头，必须有扩展名或多级目录）
					const pathMatch = text.match(/^(\/(?:[^/\s]+\/)+[^/\s]+|\/[^/\s]+\.[a-zA-Z0-9]+)/m);
					if (pathMatch) {
						result.path = pathMatch[1];
						break;
					}

					// 匹配 Windows 路径
					const winPathMatch = text.match(/^([a-zA-Z]:\\[^\s\n]+)/m);
					if (winPathMatch) {
						result.path = winPathMatch[1];
						break;
					}
				}

				// 从 diff 内容中提取路径
				if (content.type === "diff" && content.path) {
					result.path = content.path;
					break;
				}
			}
		}

		return Object.keys(result).length > 0 ? result : null;
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
