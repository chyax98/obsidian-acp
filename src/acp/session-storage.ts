/**
 * 会话持久化存储管理器
 *
 * 负责会话历史的本地存储和恢复：
 * - 保存/加载会话数据
 * - 会话列表管理
 * - 自动清理旧会话
 * - 限制存储数量
 */

import type { Plugin } from 'obsidian';
import type { Message } from './core/session-manager';
import type { AcpBackendId } from './backends/types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 存储的会话数据
 */
export interface StoredSession {
	/** 会话 ID */
	id: string;

	/** Agent 后端 ID */
	backendId: AcpBackendId;

	/** 工作目录 */
	workingDir: string;

	/** 消息历史 */
	messages: Message[];

	/** 创建时间 (时间戳) */
	createdAt: number;

	/** 最后更新时间 (时间戳) */
	updatedAt: number;
}

/**
 * 会话摘要信息
 */
export interface SessionSummary {
	/** 会话 ID */
	id: string;

	/** Agent 后端 ID */
	backendId: AcpBackendId;

	/** 工作目录 */
	workingDir: string;

	/** 消息数量 */
	messageCount: number;

	/** 创建时间 */
	createdAt: number;

	/** 最后更新时间 */
	updatedAt: number;

	/** 第一条用户消息预览 (可选) */
	preview?: string;
}

/**
 * 存储数据结构
 */
interface StorageData {
	/** 会话列表 */
	sessions: StoredSession[];

	/** 版本号 (用于未来迁移) */
	version: number;
}

// ============================================================================
// 常量
// ============================================================================

/** 存储数据版本号 */
const STORAGE_VERSION = 1;

/** 默认最大保留会话数 */
const DEFAULT_MAX_SESSIONS = 50;

/** 会话预览最大长度 */
const PREVIEW_MAX_LENGTH = 100;

// ============================================================================
// SessionStorage 类
// ============================================================================

/**
 * 会话存储管理器
 *
 * 使用 Obsidian Plugin Data API 进行持久化存储。
 */
export class SessionStorage {
	private plugin: Plugin;
	private maxSessions: number;
	private data: StorageData | null = null;

	// ========================================================================
	// 构造函数
	// ========================================================================

	constructor(plugin: Plugin, maxSessions: number = DEFAULT_MAX_SESSIONS) {
		this.plugin = plugin;
		this.maxSessions = maxSessions;
	}

	// ========================================================================
	// 初始化
	// ========================================================================

	/**
	 * 加载存储数据
	 */
	public async load(): Promise<void> {
		const loadedData = (await this.plugin.loadData()) as StorageData | null;

		if (!loadedData) {
			// 首次使用，初始化空数据
			this.data = {
				sessions: [],
				version: STORAGE_VERSION,
			};
		} else {
			// TODO: 未来版本迁移逻辑
			this.data = loadedData;
		}
	}

	/**
	 * 保存存储数据到磁盘
	 */
	private async persist(): Promise<void> {
		if (!this.data) {
			throw new Error('SessionStorage 未初始化，请先调用 load()');
		}

		await this.plugin.saveData(this.data);
	}

	// ========================================================================
	// 会话操作
	// ========================================================================

	/**
	 * 保存会话
	 *
	 * 如果会话已存在则更新，否则新建。
	 */
	public async saveSession(session: StoredSession): Promise<void> {
		if (!this.data) {
			throw new Error('SessionStorage 未初始化，请先调用 load()');
		}

		// 查找已存在的会话索引
		const existingIndex = this.data.sessions.findIndex((s) => s.id === session.id);

		if (existingIndex !== -1) {
			// 更新已存在的会话
			this.data.sessions[existingIndex] = {
				...session,
				updatedAt: Date.now(),
			};
		} else {
			// 新增会话
			const newSession = {
				...session,
				createdAt: session.createdAt || Date.now(),
				updatedAt: Date.now(),
			};

			this.data.sessions.push(newSession);

			// 检查是否超过最大数量
			if (this.data.sessions.length > this.maxSessions) {
				await this.clearOldSessions(this.maxSessions);
			}
		}

		await this.persist();
	}

	/**
	 * 加载会话
	 *
	 * @returns 会话数据，如果不存在则返回 null
	 */
	public loadSession(id: string): StoredSession | null {
		if (!this.data) {
			throw new Error('SessionStorage 未初始化，请先调用 load()');
		}

		const session = this.data.sessions.find((s) => s.id === id);

		if (session) {
			return { ...session };
		} else {
			return null;
		}
	}

	/**
	 * 获取会话列表
	 *
	 * 按更新时间倒序排列 (最近的在前)。
	 *
	 * @returns 会话摘要列表
	 */
	public listSessions(): SessionSummary[] {
		if (!this.data) {
			throw new Error('SessionStorage 未初始化，请先调用 load()');
		}

		// 按更新时间倒序排序
		const sorted = [...this.data.sessions].sort((a, b) => b.updatedAt - a.updatedAt);

		// 转换为摘要
		const summaries: SessionSummary[] = sorted.map((session) => {
			const summary: SessionSummary = {
				id: session.id,
				backendId: session.backendId,
				workingDir: session.workingDir,
				messageCount: session.messages.length,
				createdAt: session.createdAt,
				updatedAt: session.updatedAt,
			};

			// 获取第一条用户消息作为预览
			const firstUserMessage = session.messages.find((msg) => msg.role === 'user');
			if (firstUserMessage) {
				const preview = firstUserMessage.content.trim();
				summary.preview =
					preview.length > PREVIEW_MAX_LENGTH
						? preview.substring(0, PREVIEW_MAX_LENGTH) + '...'
						: preview;
			}

			return summary;
		});

		return summaries;
	}

	/**
	 * 删除会话
	 */
	public async deleteSession(id: string): Promise<void> {
		if (!this.data) {
			throw new Error('SessionStorage 未初始化，请先调用 load()');
		}

		const beforeCount = this.data.sessions.length;
		this.data.sessions = this.data.sessions.filter((s) => s.id !== id);
		const afterCount = this.data.sessions.length;

		if (beforeCount !== afterCount) {
			await this.persist();
		}
	}

	/**
	 * 清理旧会话
	 *
	 * 只保留最近的 N 个会话，删除更旧的。
	 *
	 * @param keepCount 保留的会话数量
	 */
	public async clearOldSessions(keepCount: number): Promise<void> {
		if (!this.data) {
			throw new Error('SessionStorage 未初始化，请先调用 load()');
		}

		if (this.data.sessions.length <= keepCount) {
			return;
		}

		// 按更新时间倒序排序
		const sorted = [...this.data.sessions].sort((a, b) => b.updatedAt - a.updatedAt);

		// 保留前 N 个
		const toKeep = sorted.slice(0, keepCount);
		this.data.sessions = toKeep;

		await this.persist();
	}

	/**
	 * 清空所有会话
	 */
	public async clearAll(): Promise<void> {
		if (!this.data) {
			throw new Error('SessionStorage 未初始化，请先调用 load()');
		}

		this.data.sessions = [];

		await this.persist();
	}

	// ========================================================================
	// 工具方法
	// ========================================================================

	/**
	 * 获取当前存储的会话数量
	 */
	public get sessionCount(): number {
		return this.data?.sessions.length || 0;
	}

	/**
	 * 获取最大保留会话数
	 */
	public get maxSessionCount(): number {
		return this.maxSessions;
	}

	/**
	 * 设置最大保留会话数
	 */
	public setMaxSessions(count: number): void {
		if (count < 1) {
			throw new Error('最大会话数必须至少为 1');
		}
		this.maxSessions = count;
	}
}
