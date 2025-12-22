/**
 * 文件引用建议器
 *
 * 当用户在输入框输入 @ 时触发文件/文件夹搜索建议
 */

import {
	type App,
	TFile,
	TFolder,
	type TAbstractFile,
	FuzzySuggestModal,
} from "obsidian";

/**
 * 文件选择弹窗
 * 用于 @ 引用文件时的搜索和选择
 */
export class FileSuggestModal extends FuzzySuggestModal<TAbstractFile> {
	private onChoose: (item: TAbstractFile) => void;

	constructor(app: App, onChoose: (item: TAbstractFile) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder("搜索文件或文件夹...");
		this.setInstructions([
			{ command: "↑↓", purpose: "导航" },
			{ command: "↵", purpose: "选择" },
			{ command: "esc", purpose: "取消" },
		]);
	}

	public getItems(): TAbstractFile[] {
		const allFiles = this.app.vault.getFiles();
		const allFolders = this.app.vault
			.getAllLoadedFiles()
			.filter(
				(f): f is TFolder => f instanceof TFolder && f.path !== "/",
			);
		return [...allFolders, ...allFiles];
	}

	public getItemText(item: TAbstractFile): string {
		return item.path;
	}

	public onChooseItem(
		item: TAbstractFile,
		_evt: MouseEvent | KeyboardEvent,
	): void {
		this.onChoose(item);
	}

	public renderSuggestion(
		item: { item: TAbstractFile; match: { score: number } },
		el: HTMLElement,
	): void {
		const file = item.item;
		const isFolder = file instanceof TFolder;
		const isMarkdown = file instanceof TFile && file.extension === "md";
		const icon = isFolder ? "📁" : isMarkdown ? "📄" : "📎";

		el.createDiv({
			cls: "acp-file-suggest-item",
			text: `${icon} ${file.name}`,
		});

		if (file.parent && file.parent.path !== "/") {
			el.createDiv({
				cls: "acp-file-suggest-path",
				text: file.parent.path,
			});
		}
	}
}

/**
 * 文件输入建议器
 * 监听 textarea 的 @ 输入，弹出文件选择
 */
export class FileInputSuggest {
	private app: App;
	private inputEl: HTMLTextAreaElement;

	constructor(app: App, inputEl: HTMLTextAreaElement) {
		this.app = app;
		this.inputEl = inputEl;

		// 监听 @ 键
		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "@") {
				// 延迟一下让 @ 先输入
				setTimeout(() => {
					this.showFileSuggest();
				}, 10);
			}
		});
	}

	/**
	 * 显示文件选择弹窗
	 */
	private showFileSuggest(): void {
		const modal = new FileSuggestModal(this.app, (item) => {
			this.insertReference(item);
		});
		modal.open();
	}

	/**
	 * 插入文件引用
	 */
	private insertReference(item: TAbstractFile): void {
		const value = this.inputEl.value;
		const cursorPos = this.inputEl.selectionStart;

		// 找到 @ 的位置（从光标往前找）
		const beforeCursor = value.slice(0, cursorPos);
		const atIndex = beforeCursor.lastIndexOf("@");

		if (atIndex !== -1) {
			// 替换 @ 后面的内容为 @path 格式
			const before = value.slice(0, atIndex);
			const after = value.slice(cursorPos);
			const reference = `@${item.path}`;

			this.inputEl.value = before + reference + after;

			// 移动光标到路径后面
			const newCursorPos = before.length + reference.length;
			this.inputEl.setSelectionRange(newCursorPos, newCursorPos);
		}

		this.inputEl.focus();
	}
}
