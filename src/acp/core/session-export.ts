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
} from './types';

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

		return lines.join('\n');
	}

	/**
	 * 从 JSON 数据恢复会话
	 */
	public static fromJSON(data: SessionExportData): { messages: Message[]; turns: Turn[] } {
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

	private static appendHeader(lines: string[], workingDir: string, messageCount: number): void {
		lines.push('# ACP 会话记录');
		lines.push('');
		lines.push(`> 导出时间: ${new Date().toLocaleString()}`);
		lines.push(`> 工作目录: ${workingDir}`);
		lines.push(`> 消息数: ${messageCount}`);
		lines.push('');
		lines.push('---');
		lines.push('');
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

		lines.push('---');
		lines.push('');
	}

	private static appendUserMessage(lines: string[], message: Message): void {
		lines.push('## 👤 用户');
		lines.push('');
		lines.push(message.content);
		lines.push('');
	}

	private static appendThoughts(lines: string[], thoughts: string[]): void {
		lines.push('### 💭 思考');
		lines.push('');
		for (const thought of thoughts) {
			lines.push(`> ${thought.replace(/\n/g, '\n> ')}`);
		}
		lines.push('');
	}

	private static appendToolCalls(lines: string[], toolCalls: ToolCall[]): void {
		lines.push('### 🔧 工具调用');
		lines.push('');
		for (const toolCall of toolCalls) {
			this.appendSingleToolCall(lines, toolCall);
		}
		lines.push('');
	}

	private static appendSingleToolCall(lines: string[], toolCall: ToolCall): void {
		const statusIcon = this.getToolStatusIcon(toolCall.status);
		lines.push(`- ${statusIcon} **${toolCall.title}** (${toolCall.kind})`);

		// 工具输出 - 提取为单独处理避免深层嵌套
		const outputText = this.extractToolCallOutput(toolCall);
		if (outputText) {
			this.appendCodeBlock(lines, outputText, '  ');
		}
	}

	private static extractToolCallOutput(toolCall: ToolCall): string | null {
		if (!toolCall.content || toolCall.content.length === 0) {
			return null;
		}

		for (const content of toolCall.content) {
			if (content.type !== 'content') continue;
			if (content.content?.type !== 'text') continue;

			const text = content.content.text || '';
			if (!text) continue;

			return text.length > 500 ? text.slice(0, 500) + '...(truncated)' : text;
		}

		return null;
	}

	private static appendCodeBlock(lines: string[], text: string, indent: string): void {
		lines.push(`${indent}\`\`\``);
		lines.push(indent + text.replace(/\n/g, `\n${indent}`));
		lines.push(`${indent}\`\`\``);
	}

	private static appendAssistantMessage(lines: string[], message: Message): void {
		lines.push('## 🤖 Agent');
		lines.push('');
		lines.push(message.content);
		lines.push('');
	}

	private static getToolStatusIcon(status: ToolCallStatus): string {
		const icons: Record<ToolCallStatus, string> = {
			completed: '✅',
			failed: '❌',
			in_progress: '⏳',
			pending: '⏸️',
		};
		return icons[status] || '⏸️';
	}
}
