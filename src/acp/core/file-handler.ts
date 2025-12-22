/**
 * 文件操作处理器
 *
 * 处理 ACP 协议的文件读写请求
 * 优先使用 Obsidian Vault API，降级到 Node.js fs
 */

import { TFile, normalizePath } from "obsidian";
import { promises as fs } from "fs";
import * as path from "path";

import { AcpMethod } from "../types";
import type { FileOperation } from "./connection-types";

/**
 * 文件操作处理器
 */
export class FileHandler {
	private workingDir: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private app: any;
	private onFileOperation: (operation: FileOperation) => void;

	constructor(
		workingDir: string,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		app: any,
		onFileOperation: (operation: FileOperation) => void,
	) {
		this.workingDir = workingDir;
		this.app = app;
		this.onFileOperation = onFileOperation;
	}

	/**
	 * 更新工作目录
	 */
	public setWorkingDir(dir: string): void {
		this.workingDir = dir;
	}

	/**
	 * 处理文件读取请求
	 * 优先使用 Vault API（如果文件在 Vault 内）
	 */
	public async handleReadFile(params: {
		path: string;
		sessionId?: string;
	}): Promise<{ content: string }> {
		const resolvedPath = this.resolvePath(params.path);

		this.onFileOperation({
			method: AcpMethod.FS_READ_TEXT_FILE,
			path: resolvedPath,
			sessionId: params.sessionId || "",
		});

		// 优先使用 Vault API
		const vaultPath = this.toVaultPath(resolvedPath);
		if (vaultPath && this.app?.vault) {
			const file = this.app.vault.getAbstractFileByPath(vaultPath);
			if (file instanceof TFile) {
				const content = await this.app.vault.read(file);
				return { content };
			}
		}

		// 降级到 Node.js fs
		const content = await fs.readFile(resolvedPath, "utf-8");
		return { content };
	}

	/**
	 * 处理文件写入请求
	 * 优先使用 Vault API（如果文件在 Vault 内）
	 */
	public async handleWriteFile(params: {
		path: string;
		content: string;
		sessionId?: string;
	}): Promise<null> {
		const resolvedPath = this.resolvePath(params.path);

		this.onFileOperation({
			method: AcpMethod.FS_WRITE_TEXT_FILE,
			path: resolvedPath,
			content: params.content,
			sessionId: params.sessionId || "",
		});

		// 优先使用 Vault API
		const vaultPath = this.toVaultPath(resolvedPath);
		if (vaultPath && this.app?.vault) {
			const existingFile =
				this.app.vault.getAbstractFileByPath(vaultPath);
			if (existingFile instanceof TFile) {
				// 文件存在，使用 modify
				await this.app.vault.modify(existingFile, params.content);
				return null;
			} else if (!existingFile) {
				// 文件不存在，确保父目录存在后创建
				await this.ensureParentDir(vaultPath);
				await this.app.vault.create(vaultPath, params.content);
				return null;
			}
		}

		// 降级到 Node.js fs
		await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
		await fs.writeFile(resolvedPath, params.content, "utf-8");

		return null;
	}

	/**
	 * 确保父目录存在
	 */
	private async ensureParentDir(vaultPath: string): Promise<void> {
		const parentPath = path.dirname(vaultPath);
		if (parentPath && parentPath !== ".") {
			const parentFolder =
				this.app.vault.getAbstractFileByPath(parentPath);
			if (!parentFolder) {
				await this.app.vault.createFolder(parentPath);
			}
		}
	}

	/**
	 * 解析工作区路径
	 */
	private resolvePath(targetPath: string): string {
		if (!targetPath) return this.workingDir;
		if (path.isAbsolute(targetPath)) return targetPath;
		return path.join(this.workingDir, targetPath);
	}

	/**
	 * 获取 Vault 基础路径
	 */
	private getVaultBasePath(): string | null {
		if (!this.app?.vault?.adapter) return null;
		const adapter = this.app.vault.adapter;
		// 桌面版有 basePath 属性
		if ("basePath" in adapter && typeof adapter.basePath === "string") {
			return adapter.basePath;
		}
		return null;
	}

	/**
	 * 将绝对路径转换为 Vault 相对路径（如果在 Vault 内）
	 */
	private toVaultPath(absolutePath: string): string | null {
		const vaultBase = this.getVaultBasePath();
		if (!vaultBase) return null;

		// 标准化路径分隔符
		const normalizedAbsolute = absolutePath.replace(/\\/g, "/");
		const normalizedBase = vaultBase.replace(/\\/g, "/");

		if (normalizedAbsolute.startsWith(normalizedBase + "/")) {
			const relativePath = normalizedAbsolute.substring(
				normalizedBase.length + 1,
			);
			return normalizePath(relativePath);
		}
		return null;
	}
}
