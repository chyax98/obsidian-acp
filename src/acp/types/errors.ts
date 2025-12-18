/**
 * ACP 错误处理类型定义
 *
 * 定义统一的错误类型系统，用于优雅地处理各种错误情况。
 */

// ============================================================================
// 错误类型枚举
// ============================================================================

/**
 * ACP 错误类型
 */
export enum AcpErrorType {
	/** 连接未就绪 */
	CONNECTION_NOT_READY = 'CONNECTION_NOT_READY',
	/** 连接已关闭 */
	CONNECTION_CLOSED = 'CONNECTION_CLOSED',
	/** 认证失败 */
	AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
	/** 会话过期 */
	SESSION_EXPIRED = 'SESSION_EXPIRED',
	/** 会话不存在 */
	SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
	/** 网络错误 */
	NETWORK_ERROR = 'NETWORK_ERROR',
	/** 超时 */
	TIMEOUT = 'TIMEOUT',
	/** 权限拒绝 */
	PERMISSION_DENIED = 'PERMISSION_DENIED',
	/** 进程启动失败 */
	SPAWN_FAILED = 'SPAWN_FAILED',
	/** CLI 未安装 */
	CLI_NOT_FOUND = 'CLI_NOT_FOUND',
	/** 协议错误 */
	PROTOCOL_ERROR = 'PROTOCOL_ERROR',
	/** 未知错误 */
	UNKNOWN = 'UNKNOWN',
}

// ============================================================================
// 错误接口
// ============================================================================

/**
 * ACP 错误对象
 */
export interface AcpError {
	/** 错误类型 */
	type: AcpErrorType;
	/** 错误代码 */
	code: string;
	/** 错误消息 */
	message: string;
	/** 是否可重试 */
	retryable: boolean;
	/** 附加详情 */
	details?: unknown;
	/** 原始错误 */
	cause?: Error;
}

// ============================================================================
// Result 类型
// ============================================================================

/**
 * 成功结果
 */
export interface AcpSuccess<T> {
	success: true;
	data: T;
}

/**
 * 失败结果
 */
export interface AcpFailure {
	success: false;
	error: AcpError;
}

/**
 * ACP 结果类型 - 类型安全的结果处理
 */
export type AcpResult<T = unknown> = AcpSuccess<T> | AcpFailure;

// ============================================================================
// 错误创建工具
// ============================================================================

/**
 * 创建 ACP 错误
 */
export function createAcpError(
	type: AcpErrorType,
	message: string,
	options?: {
		retryable?: boolean;
		details?: unknown;
		cause?: Error;
	},
): AcpError {
	return {
		type,
		code: type.toString(),
		message,
		retryable: options?.retryable ?? false,
		details: options?.details,
		cause: options?.cause,
	};
}

/**
 * 判断错误是否可重试
 */
export function isRetryableError(error: AcpError): boolean {
	if (error.retryable) return true;

	// 这些错误类型通常可以重试
	const retryableTypes = [AcpErrorType.CONNECTION_NOT_READY, AcpErrorType.NETWORK_ERROR, AcpErrorType.TIMEOUT];

	return retryableTypes.includes(error.type);
}

/**
 * 创建成功结果
 */
export function success<T>(data: T): AcpSuccess<T> {
	return { success: true, data };
}

/**
 * 创建失败结果
 */
export function failure(error: AcpError): AcpFailure {
	return { success: false, error };
}

/**
 * 类型守卫：判断结果是否成功
 */
export function isSuccess<T>(result: AcpResult<T>): result is AcpSuccess<T> {
	return result.success;
}

/**
 * 类型守卫：判断结果是否失败
 */
export function isFailure<T>(result: AcpResult<T>): result is AcpFailure {
	return !result.success;
}

// ============================================================================
// 预定义错误
// ============================================================================

/**
 * 连接未就绪错误
 */
export function connectionNotReadyError(message = '连接尚未就绪'): AcpError {
	return createAcpError(AcpErrorType.CONNECTION_NOT_READY, message, { retryable: true });
}

/**
 * 超时错误
 */
export function timeoutError(operation: string, timeoutMs: number): AcpError {
	return createAcpError(AcpErrorType.TIMEOUT, `${operation} 超时 (${timeoutMs}ms)`, { retryable: true });
}

/**
 * CLI 未找到错误
 */
export function cliNotFoundError(cliName: string): AcpError {
	return createAcpError(AcpErrorType.CLI_NOT_FOUND, `未找到 CLI: ${cliName}，请确认已安装`, { retryable: false });
}

/**
 * 进程启动失败错误
 */
export function spawnFailedError(command: string, reason: string): AcpError {
	return createAcpError(AcpErrorType.SPAWN_FAILED, `启动进程失败: ${command} - ${reason}`, { retryable: false });
}

/**
 * 协议错误
 */
export function protocolError(message: string, details?: unknown): AcpError {
	return createAcpError(AcpErrorType.PROTOCOL_ERROR, message, { retryable: false, details });
}
