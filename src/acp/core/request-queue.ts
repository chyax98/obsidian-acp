/**
 * 请求队列管理器
 *
 * 独立管理 JSON-RPC 请求的生命周期，包括：
 * - 请求创建与 ID 分配
 * - Promise 封装与超时管理
 * - 请求完成（resolve/reject）
 * - 超时暂停/恢复（用于权限请求等场景）
 */

import type { RequestId } from '../types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 待处理请求内部状态
 */
interface PendingRequest<T = unknown> {
	/** 成功回调 */
	resolve: (value: T) => void;
	/** 失败回调 */
	reject: (error: Error) => void;
	/** 超时定时器 */
	timeoutId?: ReturnType<typeof setTimeout>;
	/** 请求方法名 */
	method: string;
	/** 是否已暂停超时 */
	isPaused: boolean;
	/** 请求开始时间 */
	startTime: number;
	/** 超时时长 (ms) */
	timeoutDuration: number;
}

/**
 * 请求创建结果
 */
export interface RequestHandle<T> {
	/** 请求 ID */
	id: RequestId;
	/** 等待响应的 Promise */
	promise: Promise<T>;
}

/**
 * 队列统计信息
 */
export interface QueueStats {
	/** 待处理请求总数 */
	total: number;
	/** 已暂停的请求数 */
	paused: number;
	/** 按方法分组的请求数 */
	byMethod: Record<string, number>;
}

// ============================================================================
// RequestQueue 类
// ============================================================================

/**
 * 请求队列管理器
 *
 * 提供独立的请求生命周期管理，可被 AcpConnection 或其他组件使用。
 */
export class RequestQueue {
	/** 待处理请求映射 */
	private requests = new Map<RequestId, PendingRequest>();

	/** 下一个请求 ID */
	private nextId = 1;

	// ========================================================================
	// 请求创建
	// ========================================================================

	/**
	 * 创建新请求
	 *
	 * @param method - 请求方法名
	 * @param timeoutMs - 超时时间 (毫秒)
	 * @returns 请求句柄 (ID 和 Promise)
	 */
	create<T>(method: string, timeoutMs: number): RequestHandle<T> {
		const id = this.nextId++;
		const startTime = Date.now();

		const promise = new Promise<T>((resolve, reject) => {
			// 创建超时定时器
			const timeoutId = setTimeout(() => {
				const request = this.requests.get(id);
				if (request && !request.isPaused) {
					this.requests.delete(id);
					reject(new Error(`请求 ${method} 超时 (${timeoutMs / 1000}s)`));
				}
			}, timeoutMs);

			// 存储请求状态
			const pending: PendingRequest<T> = {
				resolve: resolve as (value: unknown) => void,
				reject,
				timeoutId,
				method,
				isPaused: false,
				startTime,
				timeoutDuration: timeoutMs,
			};

			this.requests.set(id, pending as PendingRequest<unknown>);
		});

		return { id, promise };
	}

	// ========================================================================
	// 请求完成
	// ========================================================================

	/**
	 * 成功完成请求
	 *
	 * @param id - 请求 ID
	 * @param value - 响应值
	 * @returns 是否找到并完成了请求
	 */
	resolve(id: RequestId, value: unknown): boolean {
		const request = this.requests.get(id);
		if (!request) return false;

		this.requests.delete(id);

		if (request.timeoutId) {
			clearTimeout(request.timeoutId);
		}

		request.resolve(value);
		return true;
	}

	/**
	 * 失败完成请求
	 *
	 * @param id - 请求 ID
	 * @param error - 错误信息
	 * @returns 是否找到并完成了请求
	 */
	reject(id: RequestId, error: Error): boolean {
		const request = this.requests.get(id);
		if (!request) return false;

		this.requests.delete(id);

		if (request.timeoutId) {
			clearTimeout(request.timeoutId);
		}

		request.reject(error);
		return true;
	}

	/**
	 * 拒绝指定 ID 的请求（使用错误消息）
	 */
	rejectWithMessage(id: RequestId, message: string): boolean {
		return this.reject(id, new Error(message));
	}

	// ========================================================================
	// 超时控制
	// ========================================================================

	/**
	 * 暂停指定请求的超时
	 *
	 * 用于等待用户操作（如权限确认）时暂停超时计时。
	 *
	 * @param id - 请求 ID
	 * @returns 是否成功暂停
	 */
	pauseTimeout(id: RequestId): boolean {
		const request = this.requests.get(id);
		if (!request || request.isPaused) return false;

		if (request.timeoutId) {
			clearTimeout(request.timeoutId);
			request.timeoutId = undefined;
		}

		request.isPaused = true;
		return true;
	}

	/**
	 * 恢复指定请求的超时
	 *
	 * 从暂停点继续计时（剩余时间 = 原始超时 - 已消耗时间）
	 *
	 * @param id - 请求 ID
	 * @returns 是否成功恢复
	 */
	resumeTimeout(id: RequestId): boolean {
		const request = this.requests.get(id);
		if (!request || !request.isPaused) return false;

		const elapsed = Date.now() - request.startTime;
		const remaining = Math.max(0, request.timeoutDuration - elapsed);

		if (remaining > 0) {
			request.timeoutId = setTimeout(() => {
				const req = this.requests.get(id);
				if (req && !req.isPaused) {
					this.requests.delete(id);
					req.reject(new Error(`请求 ${req.method} 超时`));
				}
			}, remaining);
			request.isPaused = false;
			return true;
		} else {
			// 剩余时间已耗尽，直接超时
			this.requests.delete(id);
			request.reject(new Error(`请求 ${request.method} 超时`));
			return false;
		}
	}

	/**
	 * 暂停指定方法的所有请求超时
	 *
	 * @param method - 方法名
	 * @returns 暂停的请求数
	 */
	pauseByMethod(method: string): number {
		let count = 0;
		for (const [id, request] of this.requests) {
			if (request.method === method && !request.isPaused) {
				this.pauseTimeout(id);
				count++;
			}
		}
		return count;
	}

	/**
	 * 恢复指定方法的所有请求超时
	 *
	 * @param method - 方法名
	 * @returns 恢复的请求数
	 */
	resumeByMethod(method: string): number {
		let count = 0;
		for (const [id, request] of this.requests) {
			if (request.method === method && request.isPaused) {
				this.resumeTimeout(id);
				count++;
			}
		}
		return count;
	}

	// ========================================================================
	// 队列管理
	// ========================================================================

	/**
	 * 队列中的请求数量
	 */
	get size(): number {
		return this.requests.size;
	}

	/**
	 * 检查请求是否存在
	 */
	has(id: RequestId): boolean {
		return this.requests.has(id);
	}

	/**
	 * 获取请求的方法名
	 */
	getMethod(id: RequestId): string | undefined {
		return this.requests.get(id)?.method;
	}

	/**
	 * 清空队列（拒绝所有待处理请求）
	 *
	 * @param reason - 拒绝原因
	 * @returns 清空的请求数
	 */
	clear(reason = '连接已断开'): number {
		const count = this.requests.size;

		for (const [id, request] of this.requests) {
			if (request.timeoutId) {
				clearTimeout(request.timeoutId);
			}
			request.reject(new Error(reason));
		}

		this.requests.clear();
		return count;
	}

	/**
	 * 获取队列统计信息
	 */
	getStats(): QueueStats {
		const byMethod: Record<string, number> = {};
		let paused = 0;

		for (const request of this.requests.values()) {
			byMethod[request.method] = (byMethod[request.method] || 0) + 1;
			if (request.isPaused) paused++;
		}

		return {
			total: this.requests.size,
			paused,
			byMethod,
		};
	}

	/**
	 * 获取所有待处理请求的 ID 列表
	 */
	getPendingIds(): RequestId[] {
		return Array.from(this.requests.keys());
	}

	/**
	 * 按方法名获取请求 ID 列表
	 */
	getIdsByMethod(method: string): RequestId[] {
		const ids: RequestId[] = [];
		for (const [id, request] of this.requests) {
			if (request.method === method) {
				ids.push(id);
			}
		}
		return ids;
	}
}
