/**
 * 会话存储管理器
 *
 * 负责会话数据的持久化：
 * - 保存会话到 .obsidian/plugins/obsidian-acp/sessions/
 * - 加载历史会话列表
 * - 删除旧会话
 */

import type { App } from "obsidian";
import type { SessionExportData } from "./types";
import type { AcpBackendId } from "../backends/types";
import { error as logError } from "../utils/logger";

/**
 * 会话元数据（用于列表显示）
 */
export interface SessionMeta {
	/** 会话 ID */
	id: string;
	/** 会话标题（第一条消息摘要） */
	title: string;
	/** 创建时间 */
	createdAt: number;
	/** 最后更新时间 */
	updatedAt: number;
	/** 消息数量 */
	messageCount: number;
	/** Agent 名称 */
	agentName?: string;
	/** Agent ID */
	agentId?: AcpBackendId;
}

/**
 * 完整的持久化会话数据
 */
export interface StoredSession extends SessionExportData {
	/** 会话元数据 */
	meta: SessionMeta;
}

/**
 * 存储路径配置
 */
const STORAGE_DIR = ".obsidian/plugins/obsidian-acp/sessions";
const INDEX_FILE = "session-index.json";

/**
 * 会话存储管理器
 */
export class SessionStorage {
	private app: App;
	private sessionIndex: SessionMeta[] = [];
	private indexLoaded = false;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * 初始化存储目录
	 */
	public async initialize(): Promise<void> {
		// 确保存储目录存在
		const adapter = this.app.vault.adapter;
		const dirExists = await adapter.exists(STORAGE_DIR);

		if (!dirExists) {
			await adapter.mkdir(STORAGE_DIR);
		}

		// 加载会话索引
		await this.loadIndex();
	}

	/**
	 * 加载会话索引
	 */
	private async loadIndex(): Promise<void> {
		const adapter = this.app.vault.adapter;
		const indexPath = `${STORAGE_DIR}/${INDEX_FILE}`;

		try {
			const exists = await adapter.exists(indexPath);
			if (exists) {
				const content = await adapter.read(indexPath);
				this.sessionIndex = JSON.parse(content) as SessionMeta[];
			} else {
				this.sessionIndex = [];
			}
		} catch (error) {
			logError("[SessionStorage] 加载索引失败:", error);
			this.sessionIndex = [];
		}

		this.indexLoaded = true;
	}

	/**
	 * 保存会话索引
	 */
	private async saveIndex(): Promise<void> {
		const adapter = this.app.vault.adapter;
		const indexPath = `${STORAGE_DIR}/${INDEX_FILE}`;

		try {
			await adapter.write(
				indexPath,
				JSON.stringify(this.sessionIndex, null, 2),
			);
		} catch (error) {
			logError("[SessionStorage] 保存索引失败:", error);
		}
	}

	/**
	 * 保存会话
	 */
	public async saveSession(
		data: SessionExportData,
		agentName?: string,
		agentId?: AcpBackendId,
	): Promise<string> {
		if (!this.indexLoaded) {
			await this.loadIndex();
		}

		const adapter = this.app.vault.adapter;

		// 生成会话 ID
		const sessionId = data.sessionId || `session-${Date.now()}`;

		// 提取标题（第一条用户消息的前 50 字符）
		const firstUserMessage = data.turns[0]?.userMessage.content || "新对话";
		const title = firstUserMessage.slice(0, 50).replace(/\n/g, " ");

		// 创建元数据
		const meta: SessionMeta = {
			id: sessionId,
			title,
			createdAt: data.turns[0]?.startTime || Date.now(),
			updatedAt: Date.now(),
			messageCount: data.messages.length,
			agentName,
			agentId,
		};

		// 创建完整的存储数据
		const storedSession: StoredSession = {
			...data,
			meta,
		};

		// 保存会话文件
		const filePath = `${STORAGE_DIR}/${sessionId}.json`;
		await adapter.write(filePath, JSON.stringify(storedSession, null, 2));

		// 更新索引
		const existingIndex = this.sessionIndex.findIndex(
			(s) => s.id === sessionId,
		);
		if (existingIndex >= 0) {
			this.sessionIndex[existingIndex] = meta;
		} else {
			this.sessionIndex.unshift(meta); // 新会话放在最前面
		}

		// 保存索引
		await this.saveIndex();

		return sessionId;
	}

	/**
	 * 加载会话
	 */
	public async loadSession(sessionId: string): Promise<StoredSession | null> {
		const adapter = this.app.vault.adapter;
		const filePath = `${STORAGE_DIR}/${sessionId}.json`;

		try {
			const exists = await adapter.exists(filePath);
			if (!exists) {
				return null;
			}

			const content = await adapter.read(filePath);
			return JSON.parse(content) as StoredSession;
		} catch (error) {
			logError("[SessionStorage] 加载会话失败:", error);
			return null;
		}
	}

	/**
	 * 删除会话
	 */
	public async deleteSession(sessionId: string): Promise<boolean> {
		if (!this.indexLoaded) {
			await this.loadIndex();
		}

		const adapter = this.app.vault.adapter;
		const filePath = `${STORAGE_DIR}/${sessionId}.json`;

		try {
			const exists = await adapter.exists(filePath);
			if (exists) {
				await adapter.remove(filePath);
			}

			// 从索引中移除
			this.sessionIndex = this.sessionIndex.filter(
				(s) => s.id !== sessionId,
			);
			await this.saveIndex();

			return true;
		} catch (error) {
			logError("[SessionStorage] 删除会话失败:", error);
			return false;
		}
	}

	/**
	 * 获取会话列表
	 */
	public async listSessions(): Promise<SessionMeta[]> {
		if (!this.indexLoaded) {
			await this.loadIndex();
		}

		// 按更新时间倒序排列
		return [...this.sessionIndex].sort((a, b) => b.updatedAt - a.updatedAt);
	}

	/**
	 * 清理旧会话（保留最近 N 个）
	 */
	public async cleanup(keepCount: number = 50): Promise<number> {
		if (!this.indexLoaded) {
			await this.loadIndex();
		}

		if (this.sessionIndex.length <= keepCount) {
			return 0;
		}

		// 按更新时间排序
		const sorted = [...this.sessionIndex].sort(
			(a, b) => b.updatedAt - a.updatedAt,
		);
		const toDelete = sorted.slice(keepCount);

		let deletedCount = 0;
		for (const session of toDelete) {
			const success = await this.deleteSession(session.id);
			if (success) {
				deletedCount++;
			}
		}

		return deletedCount;
	}

	/**
	 * 获取会话数量
	 */
	public async getSessionCount(): Promise<number> {
		if (!this.indexLoaded) {
			await this.loadIndex();
		}
		return this.sessionIndex.length;
	}
}
