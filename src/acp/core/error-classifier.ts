/**
 * ACP 错误分类器
 *
 * 根据错误消息和后端类型动态分类错误
 */

import type { AcpBackendId } from '../backends';
import type { AcpError } from '../types/errors';
import { AcpErrorType, createAcpError } from '../types/errors';

/**
 * 动态错误分类 - 根据错误消息和后端类型启发式匹配错误类型
 */
export function classifyError(errorMsg: string, backend: AcpBackendId | null): AcpError {
	const msgLower = errorMsg.toLowerCase();
	console.log(`[ACP] 错误分类: 原始消息="${errorMsg}", 后端=${backend}`);

	// 超时错误
	if (msgLower.includes('timeout') || msgLower.includes('超时') || msgLower.includes('timed out')) {
		console.log('[ACP] 分类结果: TIMEOUT (可重试)');
		return createAcpError(AcpErrorType.TIMEOUT, errorMsg, { retryable: true });
	}

	// 网络错误
	if (isNetworkError(msgLower)) {
		console.log('[ACP] 分类结果: NETWORK_ERROR (可重试)');
		return createAcpError(AcpErrorType.NETWORK_ERROR, errorMsg, { retryable: true });
	}

	// 认证失败
	if (isAuthError(msgLower)) {
		console.log('[ACP] 分类结果: AUTHENTICATION_FAILED (不可重试)');
		return createAcpError(AcpErrorType.AUTHENTICATION_FAILED, errorMsg, { retryable: false });
	}

	// 会话相关错误
	const sessionError = checkSessionError(msgLower, errorMsg);
	if (sessionError) return sessionError;

	// 权限错误
	if (msgLower.includes('permission denied') || msgLower.includes('权限拒绝') || msgLower.includes('eacces')) {
		console.log('[ACP] 分类结果: PERMISSION_DENIED (不可重试)');
		return createAcpError(AcpErrorType.PERMISSION_DENIED, errorMsg, { retryable: false });
	}

	// 进程启动错误
	if (msgLower.includes('spawn') || msgLower.includes('enoent') || msgLower.includes('启动失败')) {
		console.log('[ACP] 分类结果: SPAWN_FAILED (不可重试)');
		return createAcpError(AcpErrorType.SPAWN_FAILED, errorMsg, { retryable: false });
	}

	// 连接错误
	if (isConnectionError(msgLower)) {
		console.log('[ACP] 分类结果: CONNECTION_CLOSED (可重试)');
		return createAcpError(AcpErrorType.CONNECTION_CLOSED, errorMsg, { retryable: true });
	}

	// Claude 后端特定错误处理
	if (backend === 'claude') {
		if (msgLower.includes('rate limit') || msgLower.includes('速率限制')) {
			console.log('[ACP] 分类结果: Claude TIMEOUT (速率限制, 可重试)');
			return createAcpError(AcpErrorType.TIMEOUT, `Claude API 速率限制: ${errorMsg}`, { retryable: true });
		}
	}

	// 协议错误
	if (msgLower.includes('protocol') || msgLower.includes('协议') || msgLower.includes('invalid response')) {
		console.log('[ACP] 分类结果: PROTOCOL_ERROR (不可重试)');
		return createAcpError(AcpErrorType.PROTOCOL_ERROR, errorMsg, { retryable: false });
	}

	// 默认: 未知错误 (不可重试)
	console.log('[ACP] 分类结果: UNKNOWN (不可重试)');
	return createAcpError(AcpErrorType.UNKNOWN, errorMsg, { retryable: false });
}

/**
 * 检查是否为网络错误
 */
function isNetworkError(msgLower: string): boolean {
	return (
		msgLower.includes('network') ||
		msgLower.includes('网络') ||
		msgLower.includes('connection refused') ||
		msgLower.includes('econnrefused') ||
		msgLower.includes('enotfound') ||
		msgLower.includes('enetunreach')
	);
}

/**
 * 检查是否为认证错误
 */
function isAuthError(msgLower: string): boolean {
	return (
		msgLower.includes('auth') ||
		msgLower.includes('认证') ||
		msgLower.includes('unauthorized') ||
		msgLower.includes('401') ||
		msgLower.includes('forbidden') ||
		msgLower.includes('403')
	);
}

/**
 * 检查会话相关错误
 */
function checkSessionError(msgLower: string, errorMsg: string): AcpError | null {
	if (msgLower.includes('session expired') || msgLower.includes('会话过期')) {
		console.log('[ACP] 分类结果: SESSION_EXPIRED (不可重试)');
		return createAcpError(AcpErrorType.SESSION_EXPIRED, errorMsg, { retryable: false });
	}

	if (
		msgLower.includes('session not found') ||
		msgLower.includes('会话未找到') ||
		msgLower.includes('session does not exist')
	) {
		console.log('[ACP] 分类结果: SESSION_NOT_FOUND (不可重试)');
		return createAcpError(AcpErrorType.SESSION_NOT_FOUND, errorMsg, { retryable: false });
	}

	return null;
}

/**
 * 检查是否为连接错误
 */
function isConnectionError(msgLower: string): boolean {
	return (
		msgLower.includes('connection closed') ||
		msgLower.includes('连接已关闭') ||
		msgLower.includes('disconnected')
	);
}
