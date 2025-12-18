/**
 * 文件操作处理器
 *
 * 处理 ACP Agent 发起的文件读写请求：
 * - 集成 Obsidian Vault API
 * - 支持 Node.js fs 降级
 * - 路径解析和安全检查
 * - 操作历史记录
 */

import type { Vault } from 'obsidian';
import { TFile, normalizePath } from 'obsidian';
import { promises as fs } from 'fs';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 读取文件参数
 */
export interface ReadFileParams {
	/** 文件路径 */
	path: string;
	/** 会话 ID */
	sessionId?: string;
	/** 起始行号 (1-based) */
	line?: number;
	/** 最大行数 */
	limit?: number;
}

/**
 * 读取文件结果
 */
export interface ReadFileResult {
	/** 文件内容 */
	content: string;
}

/**
 * 写入文件参数
 */
export interface WriteFileParams {
	/** 文件路径 */
	path: string;
	/** 文件内容 */
	content: string;
	/** 会话 ID */
	sessionId?: string;
}

/**
 * 文件操作类型
 */
export type FileOperationType = 'read' | 'write';

/**
 * 文件操作记录
 */
export interface FileOperationRecord {
	/** 操作类型 */
	type: FileOperationType;
	/** 文件路径 */
	path: string;
	/** 会话 ID */
	sessionId: string;
	/** 时间戳 */
	timestamp: number;
	/** 是否成功 */
	success: boolean;
	/** 错误信息 */
	error?: string;
	/** 文件大小 (字节) */
	size?: number;
}

/**
 * 文件处理器配置
 */
export interface FileHandlerConfig {
	/** Obsidian Vault 实例 */
	vault?: Vault;
	/** 工作目录 */
	workingDir: string;
	/** 是否允许 Vault 外文件访问 */
	allowOutsideVault?: boolean;
}

// ============================================================================
// FileOperationHandler 类
// ============================================================================

/**
 * 文件操作处理器
 *
 * 处理 ACP 协议的 fs/read_text_file 和 fs/write_text_file 请求。
 */
export class FileOperationHandler {
	private vault: Vault | null;
	private workingDir: string;
	private vaultPath: string | null;
	private allowOutsideVault: boolean;

	// 操作历史
	private _history: FileOperationRecord[] = [];

	constructor(config: FileHandlerConfig) {
		this.vault = config.vault || null;
		this.workingDir = config.workingDir;
		this.allowOutsideVault = config.allowOutsideVault ?? true;

		// 获取 Vault 根路径
		if (this.vault) {
			// Obsidian Vault 的适配器包含根路径
			const adapter = this.vault.adapter as { basePath?: string };
			this.vaultPath = adapter.basePath || null;
		} else {
			this.vaultPath = null;
		}
	}

	// ========================================================================
	// 文件读取
	// ========================================================================

	/**
	 * 读取文件内容
	 */
	async readFile(params: ReadFileParams): Promise<ReadFileResult> {
		const resolvedPath = this.resolvePath(params.path);
		const sessionId = params.sessionId || '';

		try {
			let content: string;

			// 尝试 Vault 读取
			if (this.isVaultPath(resolvedPath) && this.vault) {
				content = await this.readFromVault(resolvedPath);
			} else {
				// 降级到 Node.js fs
				content = await this.readFromFs(resolvedPath);
			}

			// 处理 line/limit 参数
			if (params.line !== undefined || params.limit !== undefined) {
				content = this.extractLines(content, params.line, params.limit);
			}

			// 记录操作
			this.recordOperation({
				type: 'read',
				path: resolvedPath,
				sessionId,
				timestamp: Date.now(),
				success: true,
				size: Buffer.byteLength(content, 'utf-8'),
			});

			return { content };
		} catch (error) {
			// 记录失败
			this.recordOperation({
				type: 'read',
				path: resolvedPath,
				sessionId,
				timestamp: Date.now(),
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});

			throw error;
		}
	}

	/**
	 * 从 Vault 读取文件
	 */
	private async readFromVault(absolutePath: string): Promise<string> {
		if (!this.vault || !this.vaultPath) {
			throw new Error('Vault 不可用');
		}

		// 转换为 Vault 相对路径
		const vaultRelativePath = this.toVaultRelativePath(absolutePath);
		const file = this.vault.getAbstractFileByPath(vaultRelativePath);

		if (!file || !(file instanceof TFile)) {
			throw new Error(`文件不存在: ${vaultRelativePath}`);
		}

		return await this.vault.read(file);
	}

	/**
	 * 从文件系统读取
	 */
	private async readFromFs(absolutePath: string): Promise<string> {
		return await fs.readFile(absolutePath, 'utf-8');
	}

	/**
	 * 提取指定行范围
	 */
	private extractLines(content: string, startLine?: number, limit?: number): string {
		const lines = content.split('\n');
		const start = (startLine ?? 1) - 1; // 转换为 0-based
		const end = limit !== undefined ? start + limit : lines.length;

		return lines.slice(Math.max(0, start), end).join('\n');
	}

	// ========================================================================
	// 文件写入
	// ========================================================================

	/**
	 * 写入文件内容
	 */
	async writeFile(params: WriteFileParams): Promise<void> {
		const resolvedPath = this.resolvePath(params.path);
		const sessionId = params.sessionId || '';

		try {
			// 尝试 Vault 写入
			if (this.isVaultPath(resolvedPath) && this.vault) {
				await this.writeToVault(resolvedPath, params.content);
			} else {
				// 降级到 Node.js fs
				await this.writeToFs(resolvedPath, params.content);
			}

			// 记录操作
			this.recordOperation({
				type: 'write',
				path: resolvedPath,
				sessionId,
				timestamp: Date.now(),
				success: true,
				size: Buffer.byteLength(params.content, 'utf-8'),
			});
		} catch (error) {
			// 记录失败
			this.recordOperation({
				type: 'write',
				path: resolvedPath,
				sessionId,
				timestamp: Date.now(),
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});

			throw error;
		}
	}

	/**
	 * 写入到 Vault
	 */
	private async writeToVault(absolutePath: string, content: string): Promise<void> {
		if (!this.vault || !this.vaultPath) {
			throw new Error('Vault 不可用');
		}

		// 转换为 Vault 相对路径
		const vaultRelativePath = this.toVaultRelativePath(absolutePath);
		const normalizedPath = normalizePath(vaultRelativePath);

		// 检查文件是否存在
		const existingFile = this.vault.getAbstractFileByPath(normalizedPath);

		if (existingFile instanceof TFile) {
			// 更新现有文件
			await this.vault.modify(existingFile, content);
		} else {
			// 确保目录存在
			const dirPath = path.dirname(normalizedPath);
			if (dirPath && dirPath !== '.') {
				await this.ensureVaultDirectory(dirPath);
			}

			// 创建新文件
			await this.vault.create(normalizedPath, content);
		}
	}

	/**
	 * 确保 Vault 目录存在
	 */
	private async ensureVaultDirectory(dirPath: string): Promise<void> {
		if (!this.vault) return;

		const parts = dirPath.split('/').filter(Boolean);
		let currentPath = '';

		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			const folder = this.vault.getAbstractFileByPath(currentPath);

			if (!folder) {
				await this.vault.createFolder(currentPath);
			}
		}
	}

	/**
	 * 写入到文件系统
	 */
	private async writeToFs(absolutePath: string, content: string): Promise<void> {
		// 确保目录存在
		const dirPath = path.dirname(absolutePath);
		await fs.mkdir(dirPath, { recursive: true });

		// 写入文件
		await fs.writeFile(absolutePath, content, 'utf-8');
	}

	// ========================================================================
	// 路径处理
	// ========================================================================

	/**
	 * 解析路径 (相对路径 → 绝对路径)
	 */
	resolvePath(targetPath: string): string {
		if (!targetPath) return this.workingDir;
		if (path.isAbsolute(targetPath)) return targetPath;
		return path.join(this.workingDir, targetPath);
	}

	/**
	 * 检查是否为 Vault 内路径
	 */
	isVaultPath(absolutePath: string): boolean {
		if (!this.vaultPath) return false;

		const normalizedTarget = path.normalize(absolutePath);
		const normalizedVault = path.normalize(this.vaultPath);

		return normalizedTarget.startsWith(normalizedVault);
	}

	/**
	 * 转换为 Vault 相对路径
	 */
	private toVaultRelativePath(absolutePath: string): string {
		if (!this.vaultPath) {
			throw new Error('Vault 路径未设置');
		}

		const normalizedTarget = path.normalize(absolutePath);
		const normalizedVault = path.normalize(this.vaultPath);

		if (!normalizedTarget.startsWith(normalizedVault)) {
			throw new Error(`路径不在 Vault 内: ${absolutePath}`);
		}

		// 移除 Vault 根路径前缀
		let relativePath = normalizedTarget.slice(normalizedVault.length);

		// 移除开头的路径分隔符
		if (relativePath.startsWith(path.sep)) {
			relativePath = relativePath.slice(1);
		}

		// 标准化为 Obsidian 路径格式 (使用 /)
		return relativePath.split(path.sep).join('/');
	}

	/**
	 * 更新工作目录
	 */
	setWorkingDir(workingDir: string): void {
		this.workingDir = workingDir;
	}

	/**
	 * 获取当前工作目录
	 */
	getWorkingDir(): string {
		return this.workingDir;
	}

	// ========================================================================
	// 历史管理
	// ========================================================================

	/**
	 * 记录操作
	 */
	private recordOperation(record: FileOperationRecord): void {
		this._history.push(record);

		// 限制历史记录数量
		if (this._history.length > 1000) {
			this._history = this._history.slice(-500);
		}
	}

	/**
	 * 获取操作历史
	 */
	get history(): FileOperationRecord[] {
		return [...this._history];
	}

	/**
	 * 获取指定会话的操作历史
	 */
	getSessionHistory(sessionId: string): FileOperationRecord[] {
		return this._history.filter((r) => r.sessionId === sessionId);
	}

	/**
	 * 清空操作历史
	 */
	clearHistory(): void {
		this._history = [];
	}

	/**
	 * 获取历史统计
	 */
	getStats(): { reads: number; writes: number; errors: number; totalSize: number } {
		let reads = 0;
		let writes = 0;
		let errors = 0;
		let totalSize = 0;

		for (const record of this._history) {
			if (record.type === 'read') reads++;
			else writes++;
			if (!record.success) errors++;
			if (record.size) totalSize += record.size;
		}

		return { reads, writes, errors, totalSize };
	}
}
