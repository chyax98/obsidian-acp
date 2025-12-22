/**
 * 流式消息缓冲器
 *
 * 优化流式消息的 UI 更新频率：
 * - 原本：1000 个 chunk = 1000 次 UI 更新
 * - 优化后：1000 个 chunk ≈ 50 次 UI 更新（减少 95%）
 *
 * 策略：时间间隔（300ms）OR 批量大小（20 chunks）
 *
 * 参考：AionUI StreamingMessageBuffer 实现
 */

// ============================================================================
// 接口定义
// ============================================================================

/**
 * 缓冲消息配置
 */
export interface BufferConfig {
	/** 更新间隔（毫秒） */
	updateInterval?: number;
	/** 批量大小 */
	batchSize?: number;
}

/**
 * 缓冲的消息
 */
interface BufferedMessage {
	/** 消息 ID */
	messageId: string;
	/** 累积内容 */
	content: string;
	/** chunk 计数 */
	chunkCount: number;
	/** 上次更新时间 */
	lastUpdate: number;
	/** 更新定时器 */
	updateTimer?: NodeJS.Timeout;
	/** 更新回调 */
	onUpdate: (content: string, isFinal: boolean) => void;
}

// ============================================================================
// StreamingMessageBuffer 类
// ============================================================================

/**
 * 流式消息缓冲器
 */
export class StreamingMessageBuffer {
	private buffers: Map<string, BufferedMessage> = new Map();
	private readonly updateInterval: number;
	private readonly batchSize: number;

	constructor(config: BufferConfig = {}) {
		this.updateInterval = config.updateInterval ?? 300; // 默认 300ms
		this.batchSize = config.batchSize ?? 20; // 默认 20 chunks
	}

	/**
	 * 追加消息 chunk
	 *
	 * @param messageId - 消息 ID
	 * @param chunk - 文本 chunk
	 * @param onUpdate - 更新回调
	 * @param mode - 'accumulate'（追加）或 'replace'（替换）
	 */
	public append(
		messageId: string,
		chunk: string,
		onUpdate: (content: string, isFinal: boolean) => void,
		mode: "accumulate" | "replace" = "accumulate",
	): void {
		let buffer = this.buffers.get(messageId);

		// 创建新 buffer
		if (!buffer) {
			buffer = {
				messageId,
				content: "",
				chunkCount: 0,
				lastUpdate: Date.now(),
				onUpdate,
			};
			this.buffers.set(messageId, buffer);
		}

		// 更新内容
		if (mode === "accumulate") {
			buffer.content += chunk;
		} else {
			buffer.content = chunk;
		}
		buffer.chunkCount++;

		// 判断是否需要立即更新 UI
		const timeSinceLastUpdate = Date.now() - buffer.lastUpdate;
		const shouldUpdate =
			buffer.chunkCount % this.batchSize === 0 || // 达到批量大小
			timeSinceLastUpdate >= this.updateInterval; // 超过时间间隔

		if (shouldUpdate) {
			// 立即更新
			this.flush(messageId, false);
		} else {
			// 延迟更新
			if (buffer.updateTimer) {
				clearTimeout(buffer.updateTimer);
			}
			buffer.updateTimer = setTimeout(() => {
				this.flush(messageId, false);
			}, this.updateInterval);
		}
	}

	/**
	 * 完成消息（触发最终更新）
	 *
	 * @param messageId - 消息 ID
	 */
	public complete(messageId: string): void {
		this.flush(messageId, true);
		this.buffers.delete(messageId);
	}

	/**
	 * 刷新缓冲（更新 UI）
	 *
	 * @param messageId - 消息 ID
	 * @param isFinal - 是否是最终更新
	 */
	private flush(messageId: string, isFinal: boolean): void {
		const buffer = this.buffers.get(messageId);
		if (!buffer) return;

		// 清除定时器
		if (buffer.updateTimer) {
			clearTimeout(buffer.updateTimer);
			buffer.updateTimer = undefined;
		}

		// 调用更新回调
		buffer.onUpdate(buffer.content, isFinal);

		// 更新时间戳
		buffer.lastUpdate = Date.now();
	}

	/**
	 * 取消消息
	 *
	 * @param messageId - 消息 ID
	 */
	public cancel(messageId: string): void {
		const buffer = this.buffers.get(messageId);
		if (buffer?.updateTimer) {
			clearTimeout(buffer.updateTimer);
		}
		this.buffers.delete(messageId);
	}

	/**
	 * 清空所有缓冲
	 */
	public clear(): void {
		for (const buffer of this.buffers.values()) {
			if (buffer.updateTimer) {
				clearTimeout(buffer.updateTimer);
			}
		}
		this.buffers.clear();
	}

	/**
	 * 获取统计信息
	 */
	public getStats(): { totalBuffers: number; totalChunks: number } {
		let totalChunks = 0;
		for (const buffer of this.buffers.values()) {
			totalChunks += buffer.chunkCount;
		}
		return {
			totalBuffers: this.buffers.size,
			totalChunks,
		};
	}
}
