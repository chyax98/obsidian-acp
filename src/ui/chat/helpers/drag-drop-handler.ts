/**
 * 拖拽处理辅助类
 *
 * 处理文件拖拽到输入框的功能
 */

import type { App } from "obsidian";
import { Notice, TFile, TFolder, normalizePath } from "obsidian";

/**
 * 拖拽处理回调
 */
export interface DragDropCallbacks {
	/** 获取当前输入值 */
	getInputValue: () => string;
	/** 设置输入值 */
	setInputValue: (value: string) => void;
	/** 聚焦输入框 */
	focusInput: () => void;
}

/**
 * 拖拽处理辅助类
 */
export class DragDropHandler {
	private app: App;
	private dropZone: HTMLElement;
	private callbacks: DragDropCallbacks;

	constructor(app: App, dropZone: HTMLElement, callbacks: DragDropCallbacks) {
		this.app = app;
		this.dropZone = dropZone;
		this.callbacks = callbacks;

		this.setupEventListeners();
	}

	/**
	 * 设置事件监听器
	 */
	private setupEventListeners(): void {
		// 拖拽进入
		this.dropZone.addEventListener("dragover", (evt) => {
			evt.preventDefault();
			if (evt.dataTransfer) {
				evt.dataTransfer.dropEffect = "copy";
			}
			this.dropZone.addClass("acp-drag-over");
		});

		// 拖拽离开
		this.dropZone.addEventListener("dragleave", (evt) => {
			const relatedTarget = evt.relatedTarget as Node | null;
			if (!this.dropZone.contains(relatedTarget)) {
				this.dropZone.removeClass("acp-drag-over");
			}
		});

		// 放下
		this.dropZone.addEventListener("drop", (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
			this.dropZone.removeClass("acp-drag-over");

			this.handleDrop(evt);
		});
	}

	/**
	 * 处理放下事件
	 */
	private handleDrop(evt: DragEvent): void {
		const dataTransfer = evt.dataTransfer;
		if (!dataTransfer) return;

		// 优先处理 Obsidian 文件拖拽
		const obsidianFiles = dataTransfer.getData("text/x-obsidian-files");
		if (obsidianFiles) {
			const paths = this.parseObsidianFilesData(obsidianFiles);
			const resolvedPaths = paths
				.map((p) => this.resolveDroppedPath(p))
				.filter((p) => p.trim());
			if (resolvedPaths.length > 0) {
				this.appendFileReferences(resolvedPaths);
				new Notice(`已添加 ${resolvedPaths.length} 个文件引用`);
			}
			return;
		}

		// 处理纯文本拖拽
		const text = dataTransfer.getData("text/plain");
		if (text) {
			const processedPath = this.processDroppedText(text);
			const resolvedPath = this.resolveDroppedPath(processedPath);
			this.appendFileReferences([resolvedPath]);
		}
	}

	/**
	 * 解析 Obsidian 的拖拽数据（text/x-obsidian-files）
	 *
	 * 已知不同版本/场景可能返回：
	 * - 以换行分隔的路径列表
	 * - JSON 数组（例如 ["a.md","b.md"]）
	 */
	private parseObsidianFilesData(data: string): string[] {
		const trimmed = (data || "").trim();
		if (!trimmed) return [];

		// JSON 格式兼容
		if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const parsed: any = JSON.parse(trimmed);
				if (typeof parsed === "string") return [parsed];
				if (Array.isArray(parsed)) {
					return parsed
						.filter((p): p is string => typeof p === "string")
						.map((p) => p.trim())
						.filter(Boolean);
				}
				// 兼容 { paths: [...] } 之类的对象格式
				if (parsed && typeof parsed === "object") {
					const maybePaths = (parsed as { paths?: unknown }).paths;
					if (Array.isArray(maybePaths)) {
						return maybePaths
							.filter((p): p is string => typeof p === "string")
							.map((p) => p.trim())
							.filter(Boolean);
					}
				}
			} catch {
				// 解析失败则回退到按行分割
			}
		}

		return trimmed.split("\n").map((p) => p.trim()).filter(Boolean);
	}

	/**
	 * 处理拖拽的文本
	 */
	private processDroppedText(text: string): string {
		// 解析 obsidian:// URL
		if (text.startsWith("obsidian://open?")) {
			try {
				const url = new URL(text);
				const filePath = url.searchParams.get("file");
				if (filePath) {
					return decodeURIComponent(filePath);
				}
			} catch {
				// URL 解析失败，保持原文本
			}
		} else if (!text.includes("/") && !text.includes("\\")) {
			// 可能是文件夹名，尝试在 Vault 中查找完整路径
			const resolved = this.resolvePathInVault(text);
			if (resolved) {
				return resolved;
			}
		}

		return text;
	}

	/**
	 * 将拖拽得到的 path 解析为 Vault 中的真实路径：
	 * - 文件：确保包含扩展名（如 .md/.png）
	 * - 文件夹：保持不带扩展名
	 */
	private resolveDroppedPath(rawPath: string): string {
		const vault = this.app.vault;

		let text = (rawPath || "").trim();
		if (!text) return text;

		// 允许用户/外部粘贴带 @ 的形式
		if (text.startsWith("@")) text = text.slice(1).trim();

		// 兼容拖拽/粘贴 Obsidian 内链格式：[[path]] 或 ![[path]]
		const linkPath = this.extractPathFromObsidianLink(text);
		if (linkPath) text = linkPath;

		// 标准化分隔符
		const normalized = normalizePath(text);

		// 先尝试按 Vault 原生路径直接解析（folder/file 都能命中）
		const exact = vault.getAbstractFileByPath(normalized);
		if (exact) return exact.path;

		// 可能是单个名字（无目录信息），尝试在 Vault 内解析
		if (!normalized.includes("/") && !normalized.includes("\\")) {
			const resolved = this.resolvePathInVault(normalized);
			if (resolved) return resolved;
		}

		// 常见情况：Markdown 内链会省略 .md
		// 优先尝试 .md（避免全量扫描带来的性能成本）
		const lastSegment = normalized.split("/").pop() || normalized;
		if (!lastSegment.includes(".")) {
			const md = vault.getAbstractFileByPath(`${normalized}.md`);
			if (md instanceof TFile) return md.path;
		}

		// 通用兜底：通过“去扩展名后的路径”在 Vault 文件列表中反查真实文件路径
		const files = vault.getFiles();
		const matches = files.filter((f) => {
			if (!f.extension) return false;
			const withoutExt = f.path.slice(0, -(f.extension.length + 1));
			return withoutExt === normalized;
		});

		if (matches.length === 1) {
			return matches[0].path;
		}
		if (matches.length > 1) {
			new Notice(
				`找到 ${matches.length} 个同名文件，使用: ${matches[0].path}`,
			);
			return matches[0].path;
		}

		return normalized;
	}

	/**
	 * 从 Obsidian 内链文本中提取路径（忽略 alias/heading/block）
	 */
	private extractPathFromObsidianLink(text: string): string | undefined {
		const trimmed = (text || "").trim();
		const match = trimmed.match(/^!?\[\[([^\]]+)\]\]$/);
		if (!match) return undefined;
		const inner = match[1];
		// 去掉 alias：[[path|alias]]
		const noAlias = inner.split("|")[0] || "";
		// 去掉 heading：[[path#heading]]
		const noHeading = noAlias.split("#")[0] || "";
		// 去掉 block：[[path^block]]
		const noBlock = noHeading.split("^")[0] || "";
		return noBlock.trim() || undefined;
	}

	/**
	 * 追加文件引用到输入框
	 */
	private appendFileReferences(paths: string[]): void {
		const references = paths.map((p) => `@${p}`).join("\n");
		const currentValue = this.callbacks.getInputValue();
		const newValue = currentValue
			? `${currentValue}\n${references}`
			: references;

		this.callbacks.setInputValue(newValue);
		this.callbacks.focusInput();
	}

	/**
	 * 在 Vault 中查找文件/文件夹的完整路径
	 */
	private resolvePathInVault(name: string): string | undefined {
		const vault = this.app.vault;

		// 查找匹配的文件夹
		const folders = vault.getAllLoadedFiles().filter((f): f is TFolder => {
			// 动态导入避免循环依赖
			const TFolderClass = (f as TFolder).children !== undefined;
			return TFolderClass && f.name === name;
		});

		if (folders.length === 1) {
			return folders[0].path;
		}

		if (folders.length > 1) {
			new Notice(
				`找到 ${folders.length} 个同名文件夹，使用: ${folders[0].path}`,
			);
			return folders[0].path;
		}

		// 查找匹配的文件
		const files = vault
			.getFiles()
			.filter((f) => f.name === name || f.basename === name);

		if (files.length === 1) {
			return files[0].path;
		}

		if (files.length > 1) {
			new Notice(
				`找到 ${files.length} 个同名文件，使用: ${files[0].path}`,
			);
			return files[0].path;
		}

		return undefined;
	}
}
