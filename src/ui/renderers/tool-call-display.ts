/**
 * 工具调用显示信息辅助类
 *
 * 负责生成工具调用的显示标题和参数预览
 */

import type { ToolCall } from "../../acp/core/session-manager";
import { getFileName } from "./utils";

/**
 * 工具调用显示信息辅助类
 */
export class ToolCallDisplayHelper {
	/**
	 * 获取工具调用显示信息
	 */
	public static getDisplayInfo(toolCall: ToolCall): { title: string } {
		const kind = toolCall.kind?.toLowerCase() || "";
		const rawInput = toolCall.rawInput || {};
		const title = toolCall.title || "";

		// 检查命令
		const command = rawInput.command as string;
		if (command) {
			return this.formatCommandTitle(command);
		}

		// 按类型处理
		return this.formatByKind(kind, rawInput, title);
	}

	/**
	 * 按工具类型格式化标题
	 */
	private static formatByKind(
		kind: string,
		rawInput: Record<string, unknown>,
		title: string,
	): { title: string } {
		switch (kind) {
			case "bash":
			case "execute":
			case "shell":
			case "terminal":
				return this.formatExecuteTitle(title, kind);
			case "read":
				return this.formatFileTitle("读取", rawInput, title);
			case "write":
				return this.formatFileTitle("写入", rawInput, title);
			case "edit":
			case "patch":
				return this.formatEditTitle(rawInput, title);
			case "grep":
			case "search":
			case "find":
				return this.formatSearchTitle(rawInput);
			case "glob":
			case "list":
			case "ls":
				return this.formatListTitle(rawInput);
			case "mcp":
				return this.formatMcpTitle(rawInput);
			case "web_search":
			case "websearch":
				return this.formatWebSearchTitle(rawInput);
			default:
				return this.formatDefaultTitle(title, kind);
		}
	}

	private static formatCommandTitle(command: string): { title: string } {
		const firstWord = command.split(/\s+/)[0];
		return { title: `执行 ${firstWord}: ${command}` };
	}

	private static formatExecuteTitle(
		title: string,
		kind: string,
	): { title: string } {
		if (title && title.toLowerCase() !== kind) {
			return { title: `执行: ${title}` };
		}
		return { title: "执行终端命令" };
	}

	private static formatFileTitle(
		action: string,
		rawInput: Record<string, unknown>,
		title: string,
	): { title: string } {
		const path = (rawInput.path || rawInput.file_path || title) as string;
		if (path) {
			return { title: `${action} ${getFileName(path)}` };
		}
		return { title: `${action}文件` };
	}

	private static formatEditTitle(
		rawInput: Record<string, unknown>,
		title: string,
	): { title: string } {
		const path = (rawInput.path || rawInput.file_path || title) as string;
		if (path) {
			const line = rawInput.line || rawInput.start_line;
			const lineInfo = line ? `:${line}` : "";
			return { title: `编辑 ${getFileName(path)}${lineInfo}` };
		}
		return { title: "编辑文件" };
	}

	private static formatSearchTitle(rawInput: Record<string, unknown>): {
		title: string;
	} {
		const pattern = (rawInput.pattern ||
			rawInput.query ||
			rawInput.search) as string;
		if (pattern) {
			const shortPattern =
				pattern.length > 30 ? pattern.slice(0, 27) + "..." : pattern;
			return { title: `搜索 "${shortPattern}"` };
		}
		return { title: "搜索" };
	}

	private static formatListTitle(rawInput: Record<string, unknown>): {
		title: string;
	} {
		const pattern = (rawInput.pattern || rawInput.path) as string;
		if (pattern) {
			return { title: `列出 ${pattern}` };
		}
		return { title: "列出文件" };
	}

	private static formatMcpTitle(rawInput: Record<string, unknown>): {
		title: string;
	} {
		const serverName = (rawInput.server || rawInput.serverName) as string;
		const methodName = (rawInput.method || rawInput.tool) as string;
		if (serverName && methodName) {
			return { title: `MCP ${serverName}/${methodName}` };
		}
		if (methodName) {
			return { title: `MCP ${methodName}` };
		}
		return { title: "MCP 调用" };
	}

	private static formatWebSearchTitle(rawInput: Record<string, unknown>): {
		title: string;
	} {
		const query = (rawInput.query || rawInput.search) as string;
		if (query) {
			const shortQuery =
				query.length > 30 ? query.slice(0, 27) + "..." : query;
			return { title: `搜索 "${shortQuery}"` };
		}
		return { title: "网页搜索" };
	}

	private static formatDefaultTitle(
		title: string,
		kind: string,
	): { title: string } {
		if (title) {
			return {
				title: title.length > 50 ? title.slice(0, 47) + "..." : title,
			};
		}
		return { title: this.formatToolKind(kind) || "工具调用" };
	}

	private static formatToolKind(kind: string): string {
		const kindMap: Record<string, string> = {
			read: "读取",
			edit: "编辑",
			delete: "删除",
			move: "移动",
			search: "搜索",
			execute: "执行",
			think: "思考",
			fetch: "获取",
			switch_mode: "切换模式",
			other: "其他",
			bash: "Bash",
			write: "写入",
			patch: "编辑",
			grep: "搜索",
			glob: "搜索",
			mcp: "MCP",
			web_search: "搜索",
		};
		return kindMap[kind] || kind;
	}

	/**
	 * 格式化参数预览
	 */
	public static formatParamsPreview(
		rawInput: Record<string, unknown> | undefined,
		kind: string | undefined,
	): string {
		if (!rawInput || Object.keys(rawInput).length === 0) {
			return "";
		}

		const k = kind?.toLowerCase() || "";

		// 命令
		if (rawInput.command) {
			const cmd = String(rawInput.command);
			return cmd.length > 100 ? cmd.slice(0, 97) + "..." : cmd;
		}

		// 文件操作
		if (["read", "write", "edit", "patch"].includes(k)) {
			const filePath =
				rawInput.path || rawInput.file_path || rawInput.filename;
			if (filePath) {
				return String(filePath);
			}
		}

		// 搜索类
		if (["search", "grep", "find", "glob"].includes(k)) {
			const pattern =
				rawInput.pattern || rawInput.query || rawInput.search;
			if (pattern) {
				const p = String(pattern);
				return p.length > 60 ? p.slice(0, 57) + "..." : p;
			}
		}

		// 其他关键参数
		const importantKeys = [
			"path",
			"file_path",
			"url",
			"query",
			"pattern",
			"name",
			"content",
		];
		for (const key of importantKeys) {
			if (rawInput[key] !== undefined) {
				const val = String(rawInput[key]);
				return val.length > 80 ? val.slice(0, 77) + "..." : val;
			}
		}

		// 参数摘要
		const keys = Object.keys(rawInput).filter((k) => !k.startsWith("_"));
		if (keys.length > 0) {
			const preview = keys
				.slice(0, 3)
				.map((k) => {
					const v = rawInput[k];
					const val = typeof v === "string" ? v : JSON.stringify(v);
					const shortVal =
						val && val.length > 20 ? val.slice(0, 17) + "..." : val;
					return `${k}: ${shortVal}`;
				})
				.join(", ");
			return keys.length > 3 ? preview + "..." : preview;
		}

		return "";
	}
}
