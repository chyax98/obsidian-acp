/**
 * 拖拽处理辅助类
 *
 * 处理文件拖拽到输入框的功能
 */

import type { App } from "obsidian";
import { Notice, TFolder } from "obsidian";

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
			const paths = obsidianFiles.split("\n").filter((p) => p.trim());
			if (paths.length > 0) {
				this.appendFileReferences(paths);
				new Notice(`已添加 ${paths.length} 个文件引用`);
			}
			return;
		}

		// 处理纯文本拖拽
		const text = dataTransfer.getData("text/plain");
		if (text) {
			const processedPath = this.processDroppedText(text);
			this.appendFileReferences([processedPath]);
		}
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
