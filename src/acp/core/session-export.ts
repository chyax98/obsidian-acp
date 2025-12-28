/**
 * 会话导出功能
 *
 * 提供会话的 JSON 和 Markdown 导出功能
 */

import type {
	Message,
	Turn,
	ToolCall,
	ToolCallStatus,
	SessionExportData,
} from "./types";
import type { ToolCallContent, ToolCallDiffContent } from "../types";

/**
 * 会话导出器
 */
export class SessionExporter {
	/**
	 * 导出会话为 JSON 格式
	 */
	public static toJSON(
		sessionId: string | null,
		messages: Message[],
		turns: Turn[],
		workingDir: string,
	): SessionExportData {
		return {
			version: 1,
			exportedAt: Date.now(),
			sessionId,
			messages: messages.map((m) => ({ ...m })),
			turns: turns.map((t) => ({
				...t,
				toolCalls: t.toolCalls.map((tc) => ({ ...tc })),
				thoughts: [...t.thoughts],
				plan: t.plan ? [...t.plan] : undefined,
			})),
			metadata: {
				workingDir,
				totalMessages: messages.length,
				totalTurns: turns.length,
			},
		};
	}

	/**
	 * 导出会话为 Markdown 格式
	 */
	public static toMarkdown(turns: Turn[], workingDir: string): string {
		const lines: string[] = [];

		// 标题和元数据
		this.appendHeader(lines, workingDir, turns.length);

		// 按回合输出
		for (const turn of turns) {
			this.appendTurn(lines, turn);
		}

		return lines.join("\n");
	}

	/**
	 * 从 JSON 数据恢复会话
	 */
	public static fromJSON(data: SessionExportData): {
		messages: Message[];
		turns: Turn[];
	} {
		if (data.version !== 1) {
			throw new Error(`不支持的会话数据版本: ${data.version}`);
		}
		return {
			messages: data.messages,
			turns: data.turns,
		};
	}

	// ========================================================================
	// Markdown 导出辅助方法
	// ========================================================================

	private static appendHeader(
		lines: string[],
		workingDir: string,
		messageCount: number,
	): void {
		lines.push("# ACP 会话记录");
		lines.push("");
		lines.push(`> 导出时间: ${new Date().toLocaleString()}`);
		lines.push(`> 工作目录: ${workingDir}`);
		lines.push(`> 消息数: ${messageCount}`);
		lines.push("");
		lines.push("---");
		lines.push("");
	}

	private static appendTurn(lines: string[], turn: Turn): void {
		// 用户消息
		this.appendUserMessage(lines, turn.userMessage);

		// 思考过程
		if (turn.thoughts.length > 0) {
			this.appendThoughts(lines, turn.thoughts);
		}

		// 工具调用
		if (turn.toolCalls.length > 0) {
			this.appendToolCalls(lines, turn.toolCalls);
		}

		// Agent 响应
		if (turn.assistantMessage) {
			this.appendAssistantMessage(lines, turn.assistantMessage);
		}

		lines.push("---");
		lines.push("");
	}

	private static appendUserMessage(lines: string[], message: Message): void {
		lines.push("## 👤 用户");
		lines.push("");
		lines.push(message.content);
		lines.push("");
	}

	private static appendThoughts(lines: string[], thoughts: string[]): void {
		lines.push("### 💭 思考");
		lines.push("");
		for (const thought of thoughts) {
			lines.push(`> ${thought.replace(/\n/g, "\n> ")}`);
		}
		lines.push("");
	}

	private static appendToolCalls(
		lines: string[],
		toolCalls: ToolCall[],
	): void {
		lines.push("### 🔧 工具调用");
		lines.push("");
		for (const toolCall of toolCalls) {
			this.appendSingleToolCall(lines, toolCall);
		}
		lines.push("");
	}

	private static appendSingleToolCall(
		lines: string[],
		toolCall: ToolCall,
	): void {
		const statusIcon = this.getToolStatusIcon(toolCall.status);
		lines.push(`- ${statusIcon} **${toolCall.title}** (${toolCall.kind})`);

		// 工具输出（不截断，按内容块完整导出）
		const outputBlocks = this.extractToolCallOutputBlocks(toolCall);
		for (const block of outputBlocks) {
			this.appendCodeBlock(lines, block, "  ");
		}
	}

	private static extractToolCallOutputBlocks(toolCall: ToolCall): string[] {
		const contents = toolCall.content;
		if (!contents || contents.length === 0) return [];

		const blocks: string[] = [];

		for (const content of contents) {
			const block = this.formatToolCallContentBlock(content, toolCall);
			if (block) blocks.push(block);
		}

		return blocks;
	}

	private static formatToolCallContentBlock(
		content: ToolCallContent,
		toolCall: ToolCall,
	): string | null {
		switch (content.type) {
			case "content": {
				if (content.content?.type !== "text") return null;
				const text = content.content.text || "";
				return text ? text : null;
			}

			case "diff":
				return this.formatDiffContent(content);

			case "terminal": {
				// ACP 协议里 terminal 内容通常只包含 terminalId；尽量补充 command 便于追溯
				const terminalId = content.terminalId;
				const command =
					typeof toolCall.rawInput?.command === "string"
						? toolCall.rawInput.command
						: null;
				if (command && terminalId) return `$ ${command}\n\n[Terminal: ${terminalId}]`;
				if (command) return `$ ${command}`;
				if (terminalId) return `[Terminal: ${terminalId}]`;
				return null;
			}

			default:
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				return JSON.stringify(content as any, null, 2);
		}
	}

	private static formatDiffContent(diff: ToolCallDiffContent): string {
		const lines: string[] = [];

		if (diff.path) {
			lines.push(`--- ${diff.path}`);
			lines.push(`+++ ${diff.path}`);
		}

		if (typeof diff.oldText === "string") {
			for (const line of diff.oldText.split("\n")) {
				lines.push(`-${line}`);
			}
		}

		if (typeof diff.newText === "string") {
			for (const line of diff.newText.split("\n")) {
				lines.push(`+${line}`);
			}
		}

		// diff 内容为空时兜底输出 JSON
		if (lines.length === 0) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return JSON.stringify(diff as any, null, 2);
		}

		return lines.join("\n");
	}

	private static appendCodeBlock(
		lines: string[],
		text: string,
		indent: string,
	): void {
		lines.push(`${indent}\`\`\``);
		lines.push(indent + text.replace(/\n/g, `\n${indent}`));
		lines.push(`${indent}\`\`\``);
	}

	private static appendAssistantMessage(
		lines: string[],
		message: Message,
	): void {
		lines.push("## 🤖 Agent");
		lines.push("");
		lines.push(message.content);
		lines.push("");
	}

	private static getToolStatusIcon(status: ToolCallStatus): string {
		const icons: Record<ToolCallStatus, string> = {
			completed: "✅",
			failed: "❌",
			in_progress: "⏳",
			pending: "⏸️",
		};
		return icons[status] || "⏸️";
	}
}
