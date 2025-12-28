/**
 * Diff 渲染器
 *
 * 渲染代码差异，支持：
 * - LCS 算法计算真正的差异
 * - 统计信息 (+x -y)
 * - Hunk 分组显示
 * - 行号显示
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
 * Diff 行类型
 */
type DiffLineType = "context" | "added" | "removed";

/**
 * Diff 行
 */
interface DiffLine {
	type: DiffLineType;
	content: string;
	oldLineNum?: number;
	newLineNum?: number;
}

/**
 * Hunk 分组
 */
interface DiffHunk {
	oldStart: number;
	oldCount: number;
	newStart: number;
	newCount: number;
	lines: DiffLine[];
}

/**
 * Diff 统计
 */
interface DiffStats {
	additions: number;
	deletions: number;
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

		// 计算 diff
		const oldLines = (diffContent.oldText || "").split("\n");
		const newLines = (diffContent.newText || "").split("\n");
		const hunks = this.computeDiff(oldLines, newLines);
		const stats = this.calculateStats(hunks);

		// 文件路径头部（带统计）
		this.renderPathHeader(wrapperEl, diffContent, stats, app, onOpenFile);

		// Diff 内容（按 hunk 分组）
		this.renderHunks(wrapperEl, hunks);
	}

	/**
	 * 计算 diff（使用 LCS 算法）
	 */
	private static computeDiff(oldLines: string[], newLines: string[]): DiffHunk[] {
		// 计算 LCS 矩阵
		const lcs = this.computeLCS(oldLines, newLines);

		// 生成 diff 行
		const diffLines = this.generateDiffLines(oldLines, newLines, lcs);

		// 分组为 hunks
		return this.groupIntoHunks(diffLines, oldLines.length, newLines.length);
	}

	/**
	 * 计算 LCS 矩阵
	 */
	private static computeLCS(oldLines: string[], newLines: string[]): number[][] {
		const m = oldLines.length;
		const n = newLines.length;
		const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

		for (let i = 1; i <= m; i++) {
			for (let j = 1; j <= n; j++) {
				if (oldLines[i - 1] === newLines[j - 1]) {
					dp[i][j] = dp[i - 1][j - 1] + 1;
				} else {
					dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
				}
			}
		}

		return dp;
	}

	/**
	 * 从 LCS 矩阵生成 diff 行
	 */
	private static generateDiffLines(
		oldLines: string[],
		newLines: string[],
		lcs: number[][],
	): DiffLine[] {
		let i = oldLines.length;
		let j = newLines.length;

		// 回溯 LCS 矩阵
		const temp: DiffLine[] = [];
		while (i > 0 || j > 0) {
			if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
				temp.push({
					type: "context",
					content: oldLines[i - 1],
					oldLineNum: i,
					newLineNum: j,
				});
				i--;
				j--;
			} else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
				temp.push({
					type: "added",
					content: newLines[j - 1],
					newLineNum: j,
				});
				j--;
			} else {
				temp.push({
					type: "removed",
					content: oldLines[i - 1],
					oldLineNum: i,
				});
				i--;
			}
		}

		// 反转得到正确顺序
		return temp.reverse();
	}

	/**
	 * 将 diff 行分组为 hunks
	 */
	private static groupIntoHunks(
		diffLines: DiffLine[],
		_oldTotal: number,
		_newTotal: number,
		contextLines: number = 3,
	): DiffHunk[] {
		const hunks: DiffHunk[] = [];
		let currentHunk: DiffHunk | null = null;
		let contextBuffer: DiffLine[] = [];

		for (let i = 0; i < diffLines.length; i++) {
			const line = diffLines[i];

			if (line.type === "context") {
				if (currentHunk) {
					// 检查是否需要结束当前 hunk
					let hasMoreChanges = false;
					for (let j = i + 1; j < Math.min(i + contextLines + 1, diffLines.length); j++) {
						if (diffLines[j].type !== "context") {
							hasMoreChanges = true;
							break;
						}
					}

					if (hasMoreChanges) {
						// 继续添加上下文
						currentHunk.lines.push(line);
					} else if (contextBuffer.length < contextLines) {
						// 添加尾部上下文
						currentHunk.lines.push(line);
						contextBuffer.push(line);
					} else {
						// 结束当前 hunk
						this.finalizeHunk(currentHunk);
						hunks.push(currentHunk);
						currentHunk = null;
						contextBuffer = [line];
					}
				} else {
					// 缓存上下文
					contextBuffer.push(line);
					if (contextBuffer.length > contextLines) {
						contextBuffer.shift();
					}
				}
			} else {
				// 变更行
				if (!currentHunk) {
					// 开始新 hunk
					currentHunk = {
						oldStart: 0,
						oldCount: 0,
						newStart: 0,
						newCount: 0,
						lines: [...contextBuffer],
					};
					// 设置起始行号
					if (contextBuffer.length > 0) {
						currentHunk.oldStart = contextBuffer[0].oldLineNum || 1;
						currentHunk.newStart = contextBuffer[0].newLineNum || 1;
					} else {
						currentHunk.oldStart = line.oldLineNum || 1;
						currentHunk.newStart = line.newLineNum || 1;
					}
				}
				currentHunk.lines.push(line);
				contextBuffer = [];
			}
		}

		// 处理最后一个 hunk
		if (currentHunk) {
			this.finalizeHunk(currentHunk);
			hunks.push(currentHunk);
		}

		return hunks;
	}

	/**
	 * 完成 hunk 的统计
	 */
	private static finalizeHunk(hunk: DiffHunk): void {
		let oldCount = 0;
		let newCount = 0;
		for (const line of hunk.lines) {
			if (line.type === "context") {
				oldCount++;
				newCount++;
			} else if (line.type === "removed") {
				oldCount++;
			} else if (line.type === "added") {
				newCount++;
			}
		}
		hunk.oldCount = oldCount;
		hunk.newCount = newCount;
	}

	/**
	 * 计算统计信息
	 */
	private static calculateStats(hunks: DiffHunk[]): DiffStats {
		let additions = 0;
		let deletions = 0;
		for (const hunk of hunks) {
			for (const line of hunk.lines) {
				if (line.type === "added") additions++;
				if (line.type === "removed") deletions++;
			}
		}
		return { additions, deletions };
	}

	/**
	 * 渲染文件路径头部
	 */
	private static renderPathHeader(
		wrapperEl: HTMLElement,
		diffContent: DiffContent,
		stats: DiffStats,
		app?: App,
		onOpenFile?: (path: string) => void,
	): void {
		const filePath = diffContent.path;
		const pathHeaderEl = wrapperEl.createDiv({ cls: "acp-diff-path" });

		// 文件路径
		if (filePath) {
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
		}

		// 统计信息
		const statsEl = pathHeaderEl.createDiv({ cls: "acp-diff-stats" });
		if (stats.additions > 0) {
			statsEl.createSpan({
				cls: "acp-diff-stat-add",
				text: `+${stats.additions}`
			});
		}
		if (stats.deletions > 0) {
			statsEl.createSpan({
				cls: "acp-diff-stat-del",
				text: `-${stats.deletions}`
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
	 * 渲染 hunks
	 */
	private static renderHunks(wrapperEl: HTMLElement, hunks: DiffHunk[]): void {
		const preEl = wrapperEl.createEl("pre", { cls: "acp-diff" });

		for (const hunk of hunks) {
			// Hunk 头部
			const hunkHeader = `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`;
			const hunkEl = preEl.createEl("div", {
				cls: "acp-diff-line acp-diff-hunk",
			});
			hunkEl.textContent = hunkHeader;

			// Hunk 内容
			for (const line of hunk.lines) {
				const lineEl = preEl.createEl("div", {
					cls: `acp-diff-line acp-diff-${line.type}`,
				});

				// 行号
				const oldNum = line.oldLineNum?.toString() || "";
				const newNum = line.newLineNum?.toString() || "";
				lineEl.setAttribute("data-old-line", oldNum);
				lineEl.setAttribute("data-new-line", newNum);

				// 内容
				const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
				lineEl.textContent = prefix + line.content;
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

		// 计算 diff
		const oldLines = (oldStr || "").split("\n");
		const newLines = (newStr || "").split("\n");
		const hunks = this.computeDiff(oldLines, newLines);
		const stats = this.calculateStats(hunks);

		// 统计信息
		if (stats.additions > 0 || stats.deletions > 0) {
			const statsEl = diffEl.createDiv({ cls: "acp-diff-stats-compact" });
			if (stats.additions > 0) {
				statsEl.createSpan({ cls: "acp-diff-stat-add", text: `+${stats.additions}` });
			}
			if (stats.deletions > 0) {
				statsEl.createSpan({ cls: "acp-diff-stat-del", text: `-${stats.deletions}` });
			}
		}

		const preEl = diffEl.createEl("pre", {
			cls: "acp-diff acp-diff-compact",
		});

		// 渲染 hunks
		for (const hunk of hunks) {
			for (const line of hunk.lines) {
				const lineEl = preEl.createEl("div", {
					cls: `acp-diff-line acp-diff-${line.type}`,
				});

				const oldNum = line.oldLineNum?.toString() || "";
				const newNum = line.newLineNum?.toString() || "";
				lineEl.setAttribute("data-old-line", oldNum);
				lineEl.setAttribute("data-new-line", newNum);

				const prefix = line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
				lineEl.textContent = prefix + line.content;
			}
		}
	}
}
