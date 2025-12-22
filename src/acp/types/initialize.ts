/**
 * ACP 初始化与能力协商类型定义
 *
 * 定义客户端与 Agent 之间的初始化握手和能力协商。
 *
 * @see https://agentclientprotocol.com/protocol/initialization
 */

/**
 * 协议扩展元数据
 *
 * 保留字段，用于客户端和 Agent 附加额外元数据。
 * 实现不应对此字段的值做任何假设。
 */
export type MetaData = Record<string, unknown> | null;

// ============================================================================
// 客户端能力 (Client Capabilities)
// ============================================================================

/**
 * 文件系统能力
 */
export interface FsCapabilities {
	/** 是否支持读取文本文件 */
	readTextFile?: boolean;
	/** 是否支持写入文本文件 */
	writeTextFile?: boolean;
}

/**
 * 客户端能力声明
 *
 * 在初始化时向 Agent 声明客户端支持的功能。
 */
export interface ClientCapabilities {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 文件系统能力 */
	fs?: FsCapabilities;
	/** 是否支持终端 */
	terminal?: boolean;
}

// ============================================================================
// Agent 能力 (Agent Capabilities)
// ============================================================================

/**
 * 提示能力
 *
 * Agent 支持的输入内容类型。
 */
export interface PromptCapabilities {
	/** 是否支持音频输入 */
	audio?: boolean;
	/** 是否支持嵌入上下文 */
	embeddedContext?: boolean;
	/** 是否支持图像输入 */
	image?: boolean;
}

/**
 * MCP 能力
 *
 * Agent 支持的 MCP (Model Context Protocol) 能力。
 */
export interface McpCapabilities {
	/** 是否支持 HTTP 传输 */
	http?: boolean;
	/** 是否支持 SSE 传输 */
	sse?: boolean;
}

/**
 * 会话能力
 */
export interface SessionCapabilities {
	/** 扩展元数据 */
	_meta?: MetaData;
}

/**
 * Agent 能力声明
 *
 * Agent 在初始化响应中声明的支持功能。
 */
export interface AgentCapabilities {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 是否支持加载会话 */
	loadSession?: boolean;
	/** MCP 能力 */
	mcpCapabilities?: McpCapabilities;
	/** 提示能力 */
	promptCapabilities?: PromptCapabilities;
	/** 会话能力 */
	sessionCapabilities?: SessionCapabilities;
}

// ============================================================================
// 初始化请求/响应 (Initialize)
// ============================================================================

/**
 * 客户端信息
 */
export interface ClientInfo {
	/** 客户端名称 */
	name: string;
	/** 客户端版本 */
	version: string;
}

/**
 * Agent 信息
 */
export interface AgentInfo {
	/** Agent 名称 */
	name: string;
	/** Agent 版本 */
	version: string;
}

/**
 * 认证方法
 */
export interface AuthMethod {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 认证方法 ID */
	id: string;
	/** 显示名称 */
	name: string;
	/** 描述 */
	description?: string;
}

/**
 * 初始化请求参数
 *
 * 客户端启动时发送给 Agent 的首个请求。
 */
export interface InitializeParams {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 客户端信息 */
	clientInfo: ClientInfo;
	/** 客户端能力 */
	capabilities: ClientCapabilities;
	/** 协议版本 */
	protocolVersion?: string;
}

/**
 * 初始化响应
 *
 * Agent 对初始化请求的响应，包含其能力和认证要求。
 */
export interface InitializeResponse {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** Agent 信息 */
	agentInfo: AgentInfo;
	/** Agent 能力 */
	capabilities: AgentCapabilities;
	/** 协议版本 */
	protocolVersion: string;
	/** 可用的认证方法 */
	authMethods?: AuthMethod[];
	/** 使用说明 */
	instructions?: string;
}

// ============================================================================
// 认证 (Authentication)
// ============================================================================

/**
 * 认证请求参数
 */
export interface AuthenticateParams {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 选择的认证方法 ID */
	methodId: string;
}

/**
 * 认证响应
 */
export interface AuthenticateResponse {
	/** 扩展元数据 */
	_meta?: MetaData;
}

// ============================================================================
// ACP 方法常量
// ============================================================================

/**
 * ACP 协议方法名称
 */
export const AcpMethod = {
	/** 初始化 */
	INITIALIZE: "initialize",
	/** 认证 */
	AUTHENTICATE: "authenticate",
	/** 新建会话 */
	SESSION_NEW: "session/new",
	/** 加载会话 */
	SESSION_LOAD: "session/load",
	/** 发送提示 */
	SESSION_PROMPT: "session/prompt",
	/** 取消会话 */
	SESSION_CANCEL: "session/cancel",
	/** 会话更新通知 */
	SESSION_UPDATE: "session/update",
	/** 设置会话模式 */
	SESSION_SET_MODE: "session/setMode",
	/** 读取文本文件 */
	FS_READ_TEXT_FILE: "fs/readTextFile",
	/** 写入文本文件 */
	FS_WRITE_TEXT_FILE: "fs/writeTextFile",
	/** 请求权限 */
	REQUEST_PERMISSION: "requestPermission",
	/** 创建终端 */
	TERMINAL_CREATE: "terminal/create",
	/** 获取终端输出 */
	TERMINAL_OUTPUT: "terminal/output",
	/** 释放终端 */
	TERMINAL_RELEASE: "terminal/release",
	/** 等待终端退出 */
	TERMINAL_WAIT_FOR_EXIT: "terminal/waitForExit",
	/** 终止终端命令 */
	TERMINAL_KILL: "terminal/kill",
} as const;

export type AcpMethodType = (typeof AcpMethod)[keyof typeof AcpMethod];

// ============================================================================
// MCP 服务器配置 (用于 session/new)
// ============================================================================

/**
 * 环境变量配置
 */
export interface EnvVariable {
	/** 环境变量名 */
	name: string;
	/** 环境变量值 */
	value: string;
}

/**
 * MCP 服务器配置（用于 session/new）
 *
 * 基于 ACP 协议规范：
 * - stdio 类型：command, args, env 都是 required
 * - http/sse 类型：url, env 是 required
 *
 * @see https://agentclientprotocol.com/protocol/schema
 */
export type SessionNewMcpServerConfig =
	| SessionNewMcpServerStdio
	| SessionNewMcpServerHttp
	| SessionNewMcpServerSse;

/**
 * stdio 类型 MCP 服务器配置
 */
export interface SessionNewMcpServerStdio {
	/** 服务器名称 */
	name: string;
	/** 传输类型 */
	type: "stdio";
	/** 命令（必填） */
	command: string;
	/** 参数（必填，至少是空数组） */
	args: string[];
	/** 环境变量（必填，至少是空数组） */
	env: EnvVariable[];
}

/**
 * http 类型 MCP 服务器配置
 */
export interface SessionNewMcpServerHttp {
	/** 服务器名称 */
	name: string;
	/** 传输类型 */
	type: "http";
	/** URL（必填） */
	url: string;
	/** 环境变量（必填，至少是空数组） */
	env: EnvVariable[];
	/** 请求头（可选） */
	headers?: Array<{ name: string; value: string }>;
}

/**
 * sse 类型 MCP 服务器配置
 */
export interface SessionNewMcpServerSse {
	/** 服务器名称 */
	name: string;
	/** 传输类型 */
	type: "sse";
	/** URL（必填） */
	url: string;
	/** 环境变量（必填，至少是空数组） */
	env: EnvVariable[];
	/** 请求头（可选） */
	headers?: Array<{ name: string; value: string }>;
}

/**
 * session/new 请求参数
 */
export interface SessionNewParams {
	/** 扩展元数据 */
	_meta?: MetaData;
	/** 工作目录 */
	cwd?: string;
	/** MCP 服务器配置列表 */
	mcpServers?: SessionNewMcpServerConfig[];
}
