/**
 * ACP JSON-RPC 2.0 基础类型定义
 *
 * ACP 协议基于 JSON-RPC 2.0，通过 stdio 进行通信。
 * 消息以换行符分隔的 JSON 格式传输。
 *
 * @see https://agentclientprotocol.com/protocol/transports
 */

/** JSON-RPC 版本常量 */
export const JSONRPC_VERSION = "2.0" as const;

/** 请求 ID 类型 */
export type RequestId = number | string;

/**
 * JSON-RPC 请求消息
 *
 * 客户端发送给 Agent 的请求，期待响应。
 */
export interface AcpRequest<T = unknown> {
	/** JSON-RPC 版本，固定为 '2.0' */
	jsonrpc: typeof JSONRPC_VERSION;
	/** 请求唯一标识符，用于匹配响应 */
	id: RequestId;
	/** 方法名称 */
	method: string;
	/** 方法参数 */
	params?: T;
}

/**
 * JSON-RPC 错误对象
 */
export interface JsonRpcError {
	/** 错误代码 */
	code: number;
	/** 错误消息 */
	message: string;
	/** 附加错误数据 */
	data?: unknown;
}

/**
 * JSON-RPC 响应消息
 *
 * Agent 对请求的响应，包含结果或错误。
 */
export interface AcpResponse<T = unknown> {
	/** JSON-RPC 版本，固定为 '2.0' */
	jsonrpc: typeof JSONRPC_VERSION;
	/** 对应请求的 ID */
	id: RequestId;
	/** 成功时的结果 */
	result?: T;
	/** 失败时的错误 */
	error?: JsonRpcError;
}

/**
 * JSON-RPC 通知消息
 *
 * 单向消息，不期待响应。
 * Agent 用于发送会话更新等实时通知。
 */
export interface AcpNotification<T = unknown> {
	/** JSON-RPC 版本，固定为 '2.0' */
	jsonrpc: typeof JSONRPC_VERSION;
	/** 通知方法名称 */
	method: string;
	/** 通知参数 */
	params?: T;
}

/**
 * ACP 消息联合类型
 *
 * 包含所有可能的 JSON-RPC 消息类型。
 */
export type AcpMessage<T = unknown> =
	| AcpRequest<T>
	| AcpResponse<T>
	| AcpNotification<T>;

/**
 * 标准 JSON-RPC 错误代码
 */
export const JsonRpcErrorCode = {
	/** 解析错误 */
	PARSE_ERROR: -32700,
	/** 无效请求 */
	INVALID_REQUEST: -32600,
	/** 方法不存在 */
	METHOD_NOT_FOUND: -32601,
	/** 无效参数 */
	INVALID_PARAMS: -32602,
	/** 内部错误 */
	INTERNAL_ERROR: -32603,
} as const;

/**
 * 类型守卫：判断是否为请求消息
 */
export function isAcpRequest(msg: AcpMessage): msg is AcpRequest {
	return (
		"id" in msg &&
		"method" in msg &&
		!("result" in msg) &&
		!("error" in msg)
	);
}

/**
 * 类型守卫：判断是否为响应消息
 */
export function isAcpResponse(msg: AcpMessage): msg is AcpResponse {
	return "id" in msg && ("result" in msg || "error" in msg);
}

/**
 * 类型守卫：判断是否为通知消息
 */
export function isAcpNotification(msg: AcpMessage): msg is AcpNotification {
	return "method" in msg && !("id" in msg);
}

/**
 * 创建请求消息
 */
export function createRequest<T>(
	id: RequestId,
	method: string,
	params?: T,
): AcpRequest<T> {
	return {
		jsonrpc: JSONRPC_VERSION,
		id,
		method,
		...(params !== undefined && { params }),
	};
}

/**
 * 创建成功响应
 */
export function createResponse<T>(id: RequestId, result: T): AcpResponse<T> {
	return {
		jsonrpc: JSONRPC_VERSION,
		id,
		result,
	};
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
	id: RequestId,
	code: number,
	message: string,
	data?: unknown,
): AcpResponse {
	return {
		jsonrpc: JSONRPC_VERSION,
		id,
		error: { code, message, ...(data !== undefined && { data }) },
	};
}
