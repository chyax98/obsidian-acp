/**
 * 工具调用输入参数渲染器
 *
 * 负责渲染工具调用的输入参数
 */

import type { App } from "obsidian";
import { setIcon, Notice } from "obsidian";
import { DiffRenderer } from "./diff-renderer";
import { getStringParam, getOtherParams } from "./utils";

/**
 * 工具调用输入参数渲染器
 */
export class ToolCallInputRenderer {
	/**
	 * 渲染工具调用的输入参数
	 */
	public static render(
		container: HTMLElement,
		rawInput: Record<string, unknown>,
		kind: string,
		app?: App,
	): void {
		const visibleKeys = Object.keys(rawInput).filter(
			(k) => !k.startsWith("_"),
		);
		if (visibleKeys.length === 0) return;

		const inputSection = container.createDiv({
			cls: "acp-tool-call-section acp-tool-call-input",
		});

		// 按类型处理
		if (["read", "write", "edit", "patch"].includes(kind)) {
			this.renderFileOperationInput(inputSection, rawInput, kind, app);
		} else if (["bash", "execute", "shell", "terminal"].includes(kind)) {
			this.renderCommandInput(inputSection, rawInput);
		} else if (["search", "grep", "find", "glob"].includes(kind)) {
			this.renderSearchInput(inputSection, rawInput);
		} else {
			this.renderAllParams(inputSection, rawInput);
		}
	}

	/**
	 * 渲染文件操作输入
	 */
	private static renderFileOperationInput(
		container: HTMLElement,
		rawInput: Record<string, unknown>,
		kind: string,
		app?: App,
	): void {
		// 文件路径
		const filePath = getStringParam(rawInput, [
			"path",
			"file_path",
			"filename",
		]);
		if (filePath) {
			this.renderFilePath(container, filePath, app);
		}

		// Edit 操作的 old_string 和 new_string
		if (
			(kind === "edit" || kind === "patch") &&
			(rawInput.old_string || rawInput.new_string)
		) {
			this.renderEditContent(container, rawInput);
		}

		// Write 操作的内容预览
		const writeContent = getStringParam(rawInput, ["content"]);
		if (kind === "write" && writeContent) {
			this.renderWriteContent(container, writeContent);
		}

		// 其他参数
		const otherParams = getOtherParams(rawInput, [
			"path",
			"file_path",
			"filename",
			"old_string",
			"new_string",
			"content",
		]);
		if (Object.keys(otherParams).length > 0) {
			this.renderOtherParams(container, otherParams);
		}
	}

	/**
	 * 渲染文件路径
	 */
	private static renderFilePath(
		container: HTMLElement,
		filePath: string,
		app?: App,
	): void {
		const row = container.createDiv({
			cls: "acp-input-row acp-input-file",
		});

		const labelEl = row.createDiv({ cls: "acp-input-label" });
		const iconEl = labelEl.createSpan({ cls: "acp-input-icon" });
		setIcon(iconEl, "file-text");
		labelEl.createSpan({ text: "文件" });

		const valueEl = row.createDiv({
			cls: "acp-input-value acp-input-path",
		});
		valueEl.textContent = filePath;

		if (app) {
			valueEl.addClass("acp-input-path-clickable");
			valueEl.addEventListener("click", () => {
				const file = app.vault.getAbstractFileByPath(filePath);
				if (file) {
					void app.workspace.openLinkText(filePath, "", false);
				} else {
					new Notice(`文件不存在: ${filePath}`);
				}
			});
		}
	}

	/**
	 * 渲染编辑内容
	 */
	private static renderEditContent(
		container: HTMLElement,
		rawInput: Record<string, unknown>,
	): void {
		const oldStr = rawInput.old_string as string | undefined;
		const newStr = rawInput.new_string as string | undefined;

		if (!oldStr && !newStr) return;

		const editSection = container.createDiv({
			cls: "acp-input-edit-section",
		});

		const headerEl = editSection.createDiv({
			cls: "acp-input-edit-header",
		});
		const iconEl = headerEl.createSpan({ cls: "acp-input-icon" });
		setIcon(iconEl, "replace");
		headerEl.createSpan({ text: "替换内容" });

		DiffRenderer.renderCompact(editSection, oldStr, newStr);
	}

	/**
	 * 渲染写入内容
	 */
	private static renderWriteContent(
		container: HTMLElement,
		content: string,
	): void {
		const writeSection = container.createDiv({
			cls: "acp-input-write-section",
		});

		const headerEl = writeSection.createDiv({
			cls: "acp-input-write-header",
		});
		const iconEl = headerEl.createSpan({ cls: "acp-input-icon" });
		setIcon(iconEl, "file-plus");
		headerEl.createSpan({ text: "写入内容" });

		const contentEl = writeSection.createDiv({
			cls: "acp-input-write-content",
		});
		const preEl = contentEl.createEl("pre");
		const codeEl = preEl.createEl("code");

		const lines = content.split("\n");
		const maxLines = 20;
		if (lines.length > maxLines) {
			codeEl.textContent =
				lines.slice(0, maxLines).join("\n") +
				`\n... (${lines.length - maxLines} 行省略)`;
		} else {
			codeEl.textContent = content;
		}
	}

	/**
	 * 渲染命令输入
	 */
	private static renderCommandInput(
		container: HTMLElement,
		rawInput: Record<string, unknown>,
	): void {
		const command = getStringParam(rawInput, ["command"]);
		if (command) {
			const row = container.createDiv({
				cls: "acp-input-row acp-input-command",
			});

			const labelEl = row.createDiv({ cls: "acp-input-label" });
			const iconEl = labelEl.createSpan({ cls: "acp-input-icon" });
			setIcon(iconEl, "terminal");
			labelEl.createSpan({ text: "命令" });

			const valueEl = row.createDiv({ cls: "acp-input-value" });
			const preEl = valueEl.createEl("pre", { cls: "acp-command-pre" });
			const codeEl = preEl.createEl("code");
			codeEl.textContent = command;

			// 复制按钮
			const copyBtn = valueEl.createDiv({
				cls: "acp-copy-button acp-copy-button-inline",
			});
			setIcon(copyBtn, "copy");

			copyBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				void navigator.clipboard.writeText(command).then(() => {
					new Notice("已复制命令");
					copyBtn.empty();
					setIcon(copyBtn, "check");
					setTimeout(() => {
						copyBtn.empty();
						setIcon(copyBtn, "copy");
					}, 1500);
				});
			});
		} else {
			this.renderAllParams(container, rawInput);
		}
	}

	/**
	 * 渲染搜索输入
	 */
	private static renderSearchInput(
		container: HTMLElement,
		rawInput: Record<string, unknown>,
	): void {
		const pattern = rawInput.pattern || rawInput.query || rawInput.search;
		const path = rawInput.path || rawInput.directory;
		const glob = rawInput.glob || rawInput.include;

		if (pattern) {
			this.renderInputRow(
				container,
				"search",
				"模式",
				String(pattern),
				true,
			);
		}

		if (path) {
			this.renderInputRow(
				container,
				"folder",
				"路径",
				String(path),
				false,
			);
		}

		if (glob) {
			this.renderInputRow(
				container,
				"filter",
				"过滤",
				String(glob),
				true,
			);
		}

		const otherParams = getOtherParams(rawInput, [
			"pattern",
			"query",
			"search",
			"path",
			"directory",
			"glob",
			"include",
		]);
		if (Object.keys(otherParams).length > 0) {
			this.renderOtherParams(container, otherParams);
		}
	}

	/**
	 * 渲染输入行
	 */
	private static renderInputRow(
		container: HTMLElement,
		icon: string,
		label: string,
		value: string,
		useCode: boolean,
	): void {
		const row = container.createDiv({ cls: "acp-input-row" });

		const labelEl = row.createDiv({ cls: "acp-input-label" });
		const iconEl = labelEl.createSpan({ cls: "acp-input-icon" });
		setIcon(iconEl, icon);
		labelEl.createSpan({ text: label });

		const valueEl = row.createDiv({
			cls: useCode
				? "acp-input-value acp-input-pattern"
				: "acp-input-value",
		});
		if (useCode) {
			valueEl.createEl("code", { text: value });
		} else {
			valueEl.textContent = value;
		}
	}

	/**
	 * 渲染所有参数
	 */
	private static renderAllParams(
		container: HTMLElement,
		rawInput: Record<string, unknown>,
	): void {
		const keys = Object.keys(rawInput).filter((k) => !k.startsWith("_"));
		if (keys.length === 0) return;

		for (const key of keys) {
			const value = rawInput[key];
			const row = container.createDiv({ cls: "acp-input-row" });

			const labelEl = row.createDiv({ cls: "acp-input-label" });
			labelEl.textContent = key;

			const valueEl = row.createDiv({ cls: "acp-input-value" });
			this.renderParamValue(valueEl, value);
		}
	}

	/**
	 * 渲染其他参数
	 */
	private static renderOtherParams(
		container: HTMLElement,
		params: Record<string, unknown>,
	): void {
		const keys = Object.keys(params);
		if (keys.length === 0) return;

		const otherSection = container.createDiv({ cls: "acp-input-other" });

		for (const key of keys) {
			const value = params[key];
			const row = otherSection.createDiv({
				cls: "acp-input-row acp-input-row-small",
			});

			const labelEl = row.createDiv({ cls: "acp-input-label" });
			labelEl.textContent = key;

			const valueEl = row.createDiv({ cls: "acp-input-value" });
			this.renderParamValue(valueEl, value);
		}
	}

	/**
	 * 渲染参数值
	 */
	private static renderParamValue(
		container: HTMLElement,
		value: unknown,
	): void {
		if (value === null || value === undefined) {
			container.createSpan({ cls: "acp-input-null", text: "null" });
		} else if (typeof value === "string") {
			if (value.length > 200) {
				container.textContent = value.slice(0, 197) + "...";
			} else {
				container.textContent = value;
			}
		} else if (typeof value === "number" || typeof value === "boolean") {
			container.createEl("code", { text: String(value) });
		} else if (Array.isArray(value)) {
			container.createEl("code", { text: JSON.stringify(value) });
		} else if (typeof value === "object") {
			const json = JSON.stringify(value, null, 2);
			if (json.length > 300) {
				container.createEl("code", {
					text: json.slice(0, 297) + "...",
				});
			} else {
				container.createEl("pre").createEl("code", { text: json });
			}
		} else {
			container.textContent = String(value);
		}
	}
}
