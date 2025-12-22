/**
 * ACP 权限请求类型定义
 *
 * 定义 Agent 请求用户授权的权限相关类型。
 *
 * @see https://agentclientprotocol.com/protocol/tool-calls#requesting-permission
 */

import type { MetaData } from "./initialize";
import type {
	ToolCallContent,
	ToolCallKind,
	ToolCallLocation,
	ToolCallStatus,
} from "./updates";

// ============================================================================
// 权限选项
// ============================================================================

/**
 * 权限选项类型
 */
export type PermissionOptionKind =
	/** 允许一次 */
	| "allow_once"
	/** 始终允许 */
	| "allow_always"
	/** 拒绝一次 */
	| "reject_once"
	/** 始终拒绝 */
	| "reject_always";

/**
 * 权限选项
 */
export interface PermissionOption {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 选项 ID */
	optionId: string;
	/** 显示名称 */
	name: string;
	/** 选项类型 */
	kind: PermissionOptionKind;
}

// ============================================================================
// 权限请求
// ============================================================================

/**
 * 工具调用信息（用于权限请求）
 */
export interface PermissionToolCall {
	/** 工具调用 ID */
	toolCallId: string;
	/** 状态 */
	status?: ToolCallStatus;
	/** 显示标题 */
	title?: string;
	/** 工具类型 */
	kind?: ToolCallKind;
	/** 原始输入参数 */
	rawInput?: {
		command?: string;
		description?: string;
		[key: string]: unknown;
	};
	/** 内容 */
	content?: ToolCallContent[];
	/** 位置 */
	locations?: ToolCallLocation[];
}

/**
 * 权限请求参数
 *
 * Agent 请求用户授权时发送的参数。
 */
export interface RequestPermissionParams {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 会话 ID */
	sessionId: string;
	/** 可选的权限选项 */
	options: PermissionOption[];
	/** 相关的工具调用信息 */
	toolCall: PermissionToolCall;
}

// ============================================================================
// 权限响应
// ============================================================================

/**
 * 权限响应结果类型
 */
export type PermissionOutcome =
	/** 用户选择了某个选项 */
	| { type: "selected"; optionId: string }
	/** 用户取消了请求 */
	| { type: "cancelled" };

/**
 * 权限响应
 *
 * 客户端对权限请求的响应。
 */
export interface RequestPermissionResponse {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 响应结果 */
	outcome: PermissionOutcome;
}

// ============================================================================
// 辅助类型
// ============================================================================

/**
 * 简化的权限请求数据（用于 UI 显示）
 */
export interface PermissionRequestData {
	/** 会话 ID */
	sessionId: string;
	/** 权限选项 */
	options: PermissionOption[];
	/** 工具调用信息 */
	toolCall: PermissionToolCall;
	/** 请求 ID（用于响应匹配） */
	requestId: number | string;
}

/**
 * 创建允许一次的权限选项
 */
export function createAllowOnceOption(
	id: string,
	name = "允许",
): PermissionOption {
	return { optionId: id, name, kind: "allow_once" };
}

/**
 * 创建始终允许的权限选项
 */
export function createAllowAlwaysOption(
	id: string,
	name = "始终允许",
): PermissionOption {
	return { optionId: id, name, kind: "allow_always" };
}

/**
 * 创建拒绝一次的权限选项
 */
export function createRejectOnceOption(
	id: string,
	name = "拒绝",
): PermissionOption {
	return { optionId: id, name, kind: "reject_once" };
}

/**
 * 创建始终拒绝的权限选项
 */
export function createRejectAlwaysOption(
	id: string,
	name = "始终拒绝",
): PermissionOption {
	return { optionId: id, name, kind: "reject_always" };
}
