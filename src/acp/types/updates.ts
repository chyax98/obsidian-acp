/**
 * ACP 会话更新通知类型定义
 *
 * 定义 Agent 发送的实时会话更新通知类型。
 * 这些是通过 `session/update` 通知发送的。
 *
 * @see https://agentclientprotocol.com/protocol/prompt-turn#3-agent-reports-output
 */

import type { MetaData } from './initialize';

// ============================================================================
// 会话更新基础
// ============================================================================

/**
 * 会话更新类型枚举
 */
export const SessionUpdateType = {
	/** Agent 消息块 */
	AGENT_MESSAGE_CHUNK: 'agent_message_chunk',
	/** Agent 思考块 */
	AGENT_THOUGHT_CHUNK: 'agent_thought_chunk',
	/** 工具调用 */
	TOOL_CALL: 'tool_call',
	/** 工具调用状态更新 */
	TOOL_CALL_UPDATE: 'tool_call_update',
	/** 计划更新 */
	PLAN: 'plan',
	/** 可用命令更新 */
	AVAILABLE_COMMANDS_UPDATE: 'available_commands_update',
	/** 用户消息块 */
	USER_MESSAGE_CHUNK: 'user_message_chunk',
	/** 当前模式更新 */
	CURRENT_MODE_UPDATE: 'current_mode_update',
} as const;

export type SessionUpdateTypeLiteral = (typeof SessionUpdateType)[keyof typeof SessionUpdateType];

/**
 * 会话通知参数基础接口
 */
export interface SessionNotificationParams {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 会话 ID */
	sessionId: string;
	/** 更新内容 */
	update: SessionUpdateData;
}

// ============================================================================
// 消息内容类型
// ============================================================================

/**
 * 文本消息内容
 */
export interface TextMessageContent {
	type: 'text';
	text: string;
}

/**
 * 图像消息内容
 */
export interface ImageMessageContent {
	type: 'image';
	data?: string;
	mimeType?: string;
	uri?: string;
}

/**
 * 资源链接内容
 *
 * ACP 协议要求所有 Agent 必须支持 resource_link。
 * 用于在消息中嵌入文件链接、笔记链接等资源引用。
 */
export interface ResourceLinkContent {
	type: 'resource_link';
	/** 资源 URI (file://, http://, obsidian:// 等) */
	uri: string;
	/** 资源名称 */
	name: string;
	/** 资源标题（可选） */
	title?: string;
	/** 资源描述（可选） */
	description?: string;
	/** MIME 类型（可选） */
	mimeType?: string;
}

/**
 * 消息内容联合类型
 */
export type MessageContent = TextMessageContent | ImageMessageContent | ResourceLinkContent;

// ============================================================================
// Agent 消息块更新
// ============================================================================

/**
 * Agent 消息块更新
 *
 * Agent 生成的文本或图像内容片段。
 */
export interface AgentMessageChunkUpdateData {
	sessionUpdate: typeof SessionUpdateType.AGENT_MESSAGE_CHUNK;
	content: MessageContent;
}

// ============================================================================
// Agent 思考块更新
// ============================================================================

/**
 * Agent 思考块更新
 *
 * Agent 的内部思考过程（可选显示）。
 */
export interface AgentThoughtChunkUpdateData {
	sessionUpdate: typeof SessionUpdateType.AGENT_THOUGHT_CHUNK;
	content: TextMessageContent;
}

// ============================================================================
// 工具调用相关
// ============================================================================

/**
 * 工具调用状态
 *
 * 符合 ACP 协议规范:
 * - pending: 等待执行
 * - in_progress: 执行中
 * - completed: 执行成功
 * - failed: 执行失败（协议标准，包含错误和取消场景）
 */
export type ToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * 工具调用类型
 *
 * 完整匹配 ACP 协议的 ToolKind 定义。
 * @see https://agentclientprotocol.com/protocol/tool-calls#creating
 */
export type ToolCallKind =
	| 'read'        // 读取文件/数据
	| 'edit'        // 修改文件/内容
	| 'delete'      // 删除文件/数据
	| 'move'        // 移动/重命名
	| 'search'      // 搜索信息
	| 'execute'     // 执行命令/代码
	| 'think'       // 内部推理
	| 'fetch'       // 获取外部数据
	| 'switch_mode' // 切换模式
	| 'other';      // 其他（默认）

/**
 * 工具调用内容 - 文本
 */
export interface ToolCallTextContent {
	type: 'content';
	content: TextMessageContent;
}

/**
 * 工具调用内容 - Diff
 */
export interface ToolCallDiffContent {
	type: 'diff';
	path?: string;
	oldText?: string | null;
	newText?: string;
}

/**
 * 工具调用内容 - 终端
 */
export interface ToolCallTerminalContent {
	type: 'terminal';
	terminalId: string;
}

/**
 * 工具调用内容联合类型
 */
export type ToolCallContent = ToolCallTextContent | ToolCallDiffContent | ToolCallTerminalContent;

/**
 * 工具调用位置
 */
export interface ToolCallLocation {
	path: string;
	line?: number;
	column?: number;
}

/**
 * 工具调用更新
 *
 * 新的工具调用开始。
 */
export interface ToolCallUpdateData {
	sessionUpdate: typeof SessionUpdateType.TOOL_CALL;
	/** 工具调用唯一 ID */
	toolCallId: string;
	/** 状态 */
	status: ToolCallStatus;
	/** 显示标题 */
	title: string;
	/** 工具类型 */
	kind: ToolCallKind;
	/** 原始输入参数 */
	rawInput?: Record<string, unknown>;
	/** 输出内容 */
	content?: ToolCallContent[];
	/** 相关位置 */
	locations?: ToolCallLocation[];
}

/**
 * 工具调用状态更新
 *
 * 现有工具调用的状态变更。
 */
export interface ToolCallStatusUpdateData {
	sessionUpdate: typeof SessionUpdateType.TOOL_CALL_UPDATE;
	/** 工具调用唯一 ID */
	toolCallId: string;
	/** 新状态 */
	status: ToolCallStatus;
	/** 输出内容 */
	content?: ToolCallContent[];
}

// ============================================================================
// 计划更新
// ============================================================================

/**
 * 计划条目状态
 */
export type PlanEntryStatus = 'pending' | 'in_progress' | 'completed';

/**
 * 计划条目优先级
 */
export type PlanEntryPriority = 'low' | 'medium' | 'high';

/**
 * 计划条目
 */
export interface PlanEntry {
	/** 条目内容 */
	content: string;
	/** 状态 */
	status: PlanEntryStatus;
	/** 优先级 */
	priority?: PlanEntryPriority;
}

/**
 * 计划更新
 */
export interface PlanUpdateData {
	sessionUpdate: typeof SessionUpdateType.PLAN;
	entries: PlanEntry[];
}

// ============================================================================
// 可用命令更新
// ============================================================================

/**
 * 命令输入规范
 */
export interface CommandInput {
	/** 输入提示 */
	hint?: string;
}

/**
 * 可用命令
 */
export interface AvailableCommand {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 命令名称 */
	name: string;
	/** 命令描述 */
	description: string;
	/** 输入规范 */
	input?: CommandInput | null;
}

/**
 * 可用命令更新
 */
export interface AvailableCommandsUpdateData {
	sessionUpdate: typeof SessionUpdateType.AVAILABLE_COMMANDS_UPDATE;
	availableCommands: AvailableCommand[];
}

// ============================================================================
// 用户消息块更新
// ============================================================================

/**
 * 用户消息块更新
 *
 * 回显用户输入的内容。
 */
export interface UserMessageChunkUpdateData {
	sessionUpdate: typeof SessionUpdateType.USER_MESSAGE_CHUNK;
	content: MessageContent;
}

// ============================================================================
// 当前模式更新
// ============================================================================

/**
 * 当前模式更新
 */
export interface CurrentModeUpdateData {
	sessionUpdate: typeof SessionUpdateType.CURRENT_MODE_UPDATE;
	mode: string;
	description?: string;
}

// ============================================================================
// 会话更新联合类型
// ============================================================================

/**
 * 所有会话更新数据的联合类型
 */
export type SessionUpdateData =
	| AgentMessageChunkUpdateData
	| AgentThoughtChunkUpdateData
	| ToolCallUpdateData
	| ToolCallStatusUpdateData
	| PlanUpdateData
	| AvailableCommandsUpdateData
	| UserMessageChunkUpdateData
	| CurrentModeUpdateData;

/**
 * 类型守卫工具函数
 */
export function isAgentMessageChunk(update: SessionUpdateData): update is AgentMessageChunkUpdateData {
	return update.sessionUpdate === SessionUpdateType.AGENT_MESSAGE_CHUNK;
}

export function isAgentThoughtChunk(update: SessionUpdateData): update is AgentThoughtChunkUpdateData {
	return update.sessionUpdate === SessionUpdateType.AGENT_THOUGHT_CHUNK;
}

export function isToolCall(update: SessionUpdateData): update is ToolCallUpdateData {
	return update.sessionUpdate === SessionUpdateType.TOOL_CALL;
}

export function isToolCallUpdate(update: SessionUpdateData): update is ToolCallStatusUpdateData {
	return update.sessionUpdate === SessionUpdateType.TOOL_CALL_UPDATE;
}

export function isPlanUpdate(update: SessionUpdateData): update is PlanUpdateData {
	return update.sessionUpdate === SessionUpdateType.PLAN;
}

export function isAvailableCommandsUpdate(update: SessionUpdateData): update is AvailableCommandsUpdateData {
	return update.sessionUpdate === SessionUpdateType.AVAILABLE_COMMANDS_UPDATE;
}
