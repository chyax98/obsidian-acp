/**
 * Claude Agent SDK 类型定义
 */

import type { SDKMessage, SDKResultMessage, Options } from '@anthropic-ai/claude-agent-sdk';

/**
 * SDK 连接选项
 */
export interface ClaudeSdkOptions {
	/** 工作目录 */
	cwd: string;
	/** 模型 */
	model?: string;
	/** 自定义 API Key（留空则使用系统 Claude Code 认证） */
	apiKey?: string;
	/** 自定义 API Base URL（留空则使用默认） */
	apiUrl?: string;
}

/**
 * SDK 消息类型（简化版）
 */
export interface ClaudeMessage {
	id: string;
	type: 'user' | 'assistant' | 'system';
	content: string;
	isStreaming?: boolean;
}

/**
 * 工具调用信息
 */
export interface ClaudeToolCall {
	toolCallId: string;
	toolName: string;
	input: Record<string, unknown>;
	status: 'pending' | 'in_progress' | 'completed' | 'error';
	output?: string;
	error?: string;
}

/**
 * 权限请求
 */
export interface ClaudePermissionRequest {
	toolName: string;
	input: Record<string, unknown>;
	message: string;
}

/**
 * 权限响应
 */
export interface ClaudePermissionResponse {
	behavior: 'allow' | 'deny';
	message?: string;
}
