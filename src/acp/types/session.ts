/**
 * ACP 会话管理类型定义
 *
 * 定义会话的创建、加载、提示发送等操作。
 *
 * @see https://agentclientprotocol.com/protocol/session-setup
 */

import type { MetaData } from './initialize';

// ============================================================================
// 会话创建 (Session New)
// ============================================================================

/**
 * 新建会话请求参数
 */
export interface NewSessionParams {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 工作目录路径 */
	workingDirectory?: string;
}

/**
 * 新建会话响应
 */
export interface NewSessionResponse {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 分配的会话 ID */
	sessionId: string;
}

// ============================================================================
// 会话加载 (Session Load)
// ============================================================================

/**
 * 加载会话请求参数
 */
export interface LoadSessionParams {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 会话 ID */
	sessionId: string;
}

/**
 * 加载会话响应
 */
export interface LoadSessionResponse {
	/** 扩展元数据 */
	_meta?: MetaData;
}

// ============================================================================
// 提示发送 (Session Prompt)
// ============================================================================

/**
 * 文本内容
 */
export interface TextContent {
	type: 'text';
	text: string;
}

/**
 * 图像内容
 */
export interface ImageContent {
	type: 'image';
	/** Base64 编码的图像数据 */
	data?: string;
	/** 图像 MIME 类型 */
	mimeType?: string;
	/** 图像 URI */
	uri?: string;
}

/**
 * 音频内容
 */
export interface AudioContent {
	type: 'audio';
	/** Base64 编码的音频数据 */
	data: string;
	/** 音频 MIME 类型 */
	mimeType: string;
}

/**
 * 嵌入上下文 (文件内容)
 */
export interface EmbeddedContext {
	type: 'embeddedContext';
	/** 文件路径 */
	path: string;
	/** 文件内容 */
	content: string;
}

/**
 * 提示内容联合类型
 */
export type PromptContent = TextContent | ImageContent | AudioContent | EmbeddedContext;

/**
 * 命令调用
 */
export interface CommandInvocation {
	/** 命令名称 */
	name: string;
	/** 命令输入 */
	input?: string;
}

/**
 * 提示请求参数
 */
export interface PromptParams {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 会话 ID */
	sessionId: string;
	/** 提示内容 */
	content: PromptContent[];
	/** 命令调用（可选） */
	command?: CommandInvocation;
}

/**
 * 停止原因
 */
export type StopReason =
	/** 正常结束 */
	| 'end_turn'
	/** 用户取消 */
	| 'cancelled'
	/** 达到最大输出 */
	| 'max_output_reached'
	/** 工具使用 */
	| 'tool_use';

/**
 * 提示响应
 */
export interface PromptResponse {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 停止原因 */
	stopReason: StopReason;
}

// ============================================================================
// 会话取消 (Session Cancel)
// ============================================================================

/**
 * 取消会话请求参数
 */
export interface CancelSessionParams {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 会话 ID */
	sessionId: string;
}

// ============================================================================
// 会话模式 (Session Mode)
// ============================================================================

/**
 * 设置会话模式请求参数
 */
export interface SetSessionModeParams {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 会话 ID */
	sessionId: string;
	/** 模式名称 */
	mode: string;
}

/**
 * 设置会话模式响应
 */
export interface SetSessionModeResponse {
	/** 扩展元数据 */
	_meta?: MetaData;
}

// ============================================================================
// 文件操作 (File System)
// ============================================================================

/**
 * 读取文本文件请求参数
 */
export interface ReadTextFileParams {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 会话 ID */
	sessionId: string;
	/** 文件路径 */
	path: string;
}

/**
 * 读取文本文件响应
 */
export interface ReadTextFileResponse {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 文件内容 */
	content: string;
}

/**
 * 写入文本文件请求参数
 */
export interface WriteTextFileParams {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 会话 ID */
	sessionId: string;
	/** 文件路径 */
	path: string;
	/** 文件内容 */
	content: string;
}

/**
 * 写入文本文件响应
 */
export interface WriteTextFileResponse {
	/** 扩展元数据 */
	_meta?: MetaData;
}
