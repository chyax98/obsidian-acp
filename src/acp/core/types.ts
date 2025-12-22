/**
 * ACP 会话核心类型定义
 *
 * 定义会话管理相关的所有类型
 */

import type { ToolCallContent } from "../types";

// ============================================================================
// 状态类型
// ============================================================================

/**
 * 会话状态
 */
export type SessionState = "idle" | "processing" | "cancelled";

/**
 * 停止原因
 */
export type StopReason =
	| "end_turn"
	| "cancelled"
	| "max_tokens"
	| "max_turn_requests"
	| "refusal"
	| "error";

/**
 * 消息角色
 */
export type MessageRole = "user" | "assistant";

/**
 * 工具调用状态
 *
 * 符合 ACP 协议规范:
 * - pending: 等待执行
 * - in_progress: 执行中
 * - completed: 执行成功
 * - failed: 执行失败（协议标准，包含错误和取消场景）
 */
export type ToolCallStatus = "pending" | "in_progress" | "completed" | "failed";

// ============================================================================
// 数据类型
// ============================================================================

/**
 * 消息类型
 */
export interface Message {
	/** 消息 ID */
	id: string;
	/** 角色 */
	role: MessageRole;
	/** 内容 */
	content: string;
	/** 时间戳 */
	timestamp: number;
	/** 是否正在流式输出 */
	isStreaming?: boolean;
}

/**
 * 工具调用信息
 */
export interface ToolCall {
	/** 工具调用 ID */
	toolCallId: string;
	/** 标题 */
	title: string;
	/** 类型 */
	kind: string;
	/** 状态 */
	status: ToolCallStatus;
	/** 内容 */
	content?: ToolCallContent[];
	/** 相关位置 */
	locations?: Array<{ path: string; line?: number; column?: number }>;
	/** 原始输入参数（用于显示命令等） */
	rawInput?: Record<string, unknown>;
	/** 开始时间 */
	startTime: number;
	/** 结束时间 */
	endTime?: number;
}

/**
 * 计划条目
 */
export interface PlanEntry {
	content: string;
	priority: string;
	status: string;
}

/**
 * 回合信息
 */
export interface Turn {
	/** 回合 ID */
	id: string;
	/** 用户消息 */
	userMessage: Message;
	/** Agent 消息 (可能正在流式输出) */
	assistantMessage?: Message;
	/** 工具调用列表 */
	toolCalls: ToolCall[];
	/** 思考内容列表 */
	thoughts: string[];
	/** 计划 */
	plan?: PlanEntry[];
	/** 停止原因 */
	stopReason?: StopReason;
	/** 开始时间 */
	startTime: number;
	/** 结束时间 */
	endTime?: number;
}

// ============================================================================
// 导出数据类型
// ============================================================================

/**
 * 会话导出数据格式
 */
export interface SessionExportData {
	/** 数据格式版本 */
	version: number;
	/** 导出时间戳 */
	exportedAt: number;
	/** 会话 ID */
	sessionId: string | null;
	/** 消息列表 */
	messages: Message[];
	/** 回合列表 */
	turns: Turn[];
	/** 元数据 */
	metadata: {
		workingDir: string;
		totalMessages: number;
		totalTurns: number;
	};
}
