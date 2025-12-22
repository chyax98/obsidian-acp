/**
 * Diff 渲染器
 *
 * 渲染代码差异，支持：
 * - 行号显示
 * - 新增/删除高亮
 * - 文件路径点击跳转
 * - 复制按钮
 */

import type { App } from "obsidian";
import { setIcon, Notice } from "obsidian";

/**
 * Diff 内容接口
 */
export interface DiffContent {
	oldText?: string | null;
	newText?: string;
	path?: string;
}

/**
 * Diff 渲染器
 */
export class DiffRenderer {
	/**
	 * 渲染增强版 Diff（带行号和文件路径点击）
	 */
	public static render(
		container: HTMLElement,
		diffContent: DiffContent,
		app?: App,
		onOpenFile?: (path: string) => void,
	): void {
		const wrapperEl = container.createDiv({ cls: "acp-diff-enhanced" });

		// 文件路径头部
		if (diffContent.path) {
			this.renderPathHeader(wrapperEl, diffContent, app, onOpenFile);
		}

		// Diff 内容
		this.renderDiffLines(wrapperEl, diffContent);
	}

	/**
	 * 渲染文件路径头部
	 */
	private static renderPathHeader(
		wrapperEl: HTMLElement,
		diffContent: DiffContent,
		app?: App,
		onOpenFile?: (path: string) => void,
	): void {
		const filePath = diffContent.path;
		if (!filePath) return;
		const pathHeaderEl = wrapperEl.createDiv({ cls: "acp-diff-path" });

		// 文件路径
		const pathEl = pathHeaderEl.createEl("span", {
			cls: "acp-diff-path-text",
			text: filePath,
		});

		// 点击跳转
		if (app || onOpenFile) {
			pathEl.addClass("acp-diff-path-clickable");
			pathEl.addEventListener("click", () => {
				if (onOpenFile) {
					onOpenFile(filePath);
				} else if (app) {
					const file = app.vault.getAbstractFileByPath(filePath);
					if (file) {
						void app.workspace.openLinkText(filePath, "", false);
					} else {
						new Notice(`文件不存在: ${filePath}`);
					}
				}
			});
		}

		// 复制按钮
		const copyBtn = pathHeaderEl.createDiv({
			cls: "acp-copy-button acp-copy-button-small",
		});
		setIcon(copyBtn, "copy");
		copyBtn.setAttribute("aria-label", "复制 diff");

		copyBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			const diffText = this.buildDiffString(diffContent);
			void navigator.clipboard.writeText(diffText).then(() => {
				new Notice("已复制 diff");
				copyBtn.empty();
				setIcon(copyBtn, "check");
				setTimeout(() => {
					copyBtn.empty();
					setIcon(copyBtn, "copy");
				}, 1500);
			});
		});
	}

	/**
	 * 渲染 Diff 行
	 */
	private static renderDiffLines(
		wrapperEl: HTMLElement,
		diffContent: DiffContent,
	): void {
		const preEl = wrapperEl.createEl("pre", { cls: "acp-diff" });

		let lineNumber = 1;

		// 渲染删除的行
		if (diffContent.oldText) {
			const oldLines = diffContent.oldText.split("\n");
			for (const line of oldLines) {
				const lineEl = preEl.createEl("div", {
					cls: "acp-diff-line acp-diff-removed",
				});
				const lineNumEl = lineEl.createEl("span", {
					cls: "acp-diff-line-number",
				});
				lineNumEl.textContent = lineNumber.toString().padStart(4, " ");
				const contentEl = lineEl.createEl("span", {
					cls: "acp-diff-line-content",
				});
				contentEl.textContent = `-${line}`;
				lineNumber++;
			}
		}

		// 重置行号
		lineNumber = 1;

		// 渲染新增的行
		if (diffContent.newText) {
			const newLines = diffContent.newText.split("\n");
			for (const line of newLines) {
				const lineEl = preEl.createEl("div", {
					cls: "acp-diff-line acp-diff-added",
				});
				const lineNumEl = lineEl.createEl("span", {
					cls: "acp-diff-line-number",
				});
				lineNumEl.textContent = lineNumber.toString().padStart(4, " ");
				const contentEl = lineEl.createEl("span", {
					cls: "acp-diff-line-content",
				});
				contentEl.textContent = `+${line}`;
				lineNumber++;
			}
		}
	}

	/**
	 * 构建 diff 字符串（用于复制）
	 */
	public static buildDiffString(diffContent: DiffContent): string {
		const lines: string[] = [];

		if (diffContent.path) {
			lines.push(`--- ${diffContent.path}`);
			lines.push(`+++ ${diffContent.path}`);
		}

		if (diffContent.oldText) {
			const oldLines = diffContent.oldText.split("\n");
			for (const line of oldLines) {
				lines.push(`-${line}`);
			}
		}

		if (diffContent.newText) {
			const newLines = diffContent.newText.split("\n");
			for (const line of newLines) {
				lines.push(`+${line}`);
			}
		}

		return lines.join("\n");
	}

	/**
	 * 渲染紧凑版 Diff（用于工具调用卡片内）
	 */
	public static renderCompact(
		container: HTMLElement,
		oldStr: string | undefined,
		newStr: string | undefined,
	): void {
		const diffEl = container.createDiv({ cls: "acp-input-edit-diff" });
		const preEl = diffEl.createEl("pre", {
			cls: "acp-diff acp-diff-compact",
		});

		// 删除的内容
		if (oldStr) {
			const oldLines = oldStr.split("\n");
			for (let i = 0; i < oldLines.length; i++) {
				const lineEl = preEl.createEl("div", {
					cls: "acp-diff-line acp-diff-removed",
				});
				const lineNumEl = lineEl.createEl("span", {
					cls: "acp-diff-line-number",
				});
				lineNumEl.textContent = (i + 1).toString().padStart(3, " ");
				const contentEl = lineEl.createEl("span", {
					cls: "acp-diff-line-content",
				});
				contentEl.textContent = `-${oldLines[i]}`;
			}
		}

		// 新增的内容
		if (newStr) {
			const newLines = newStr.split("\n");
			for (let i = 0; i < newLines.length; i++) {
				const lineEl = preEl.createEl("div", {
					cls: "acp-diff-line acp-diff-added",
				});
				const lineNumEl = lineEl.createEl("span", {
					cls: "acp-diff-line-number",
				});
				lineNumEl.textContent = (i + 1).toString().padStart(3, " ");
				const contentEl = lineEl.createEl("span", {
					cls: "acp-diff-line-content",
				});
				contentEl.textContent = `+${newLines[i]}`;
			}
		}
	}
}
