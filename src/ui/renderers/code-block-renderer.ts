/**
 * 代码块渲染器
 *
 * 渲染代码块，支持：
 * - 语言标签
 * - 文件名显示
 * - 复制按钮
 */

import { setIcon, Notice } from "obsidian";

/**
 * 代码块渲染器
 */
export class CodeBlockRenderer {
	/**
	 * 渲染代码块（带语言标签和复制按钮）
	 *
	 * @param container - 容器元素
	 * @param code - 代码内容
	 * @param language - 语言标识（如 'typescript', 'javascript'）
	 * @param filename - 可选文件名
	 */
	public static render(
		container: HTMLElement,
		code: string,
		language: string = "text",
		filename?: string,
	): void {
		const codeWrapper = container.createDiv({
			cls: "acp-code-block-wrapper",
		});

		// 头部：语言标签 + 文件名 + 复制按钮
		const headerEl = codeWrapper.createDiv({
			cls: "acp-code-block-header",
		});

		// 左侧信息
		const infoEl = headerEl.createDiv({ cls: "acp-code-block-info" });
		infoEl.createDiv({
			cls: "acp-code-block-language",
			text: language.toUpperCase(),
		});
		if (filename) {
			infoEl.createDiv({
				cls: "acp-code-block-filename",
				text: filename,
			});
		}

		// 复制按钮
		const copyBtn = headerEl.createDiv({
			cls: "acp-copy-button acp-copy-button-code",
		});
		setIcon(copyBtn, "copy");
		copyBtn.setAttribute("aria-label", "复制代码");

		copyBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void navigator.clipboard.writeText(code).then(() => {
				new Notice("已复制代码");
				copyBtn.empty();
				setIcon(copyBtn, "check");
				setTimeout(() => {
					copyBtn.empty();
					setIcon(copyBtn, "copy");
				}, 2000);
			});
		});

		// 代码内容
		const preEl = codeWrapper.createEl("pre", {
			cls: "acp-code-block-content",
		});
		preEl.createEl("code", {
			cls: `language-${language}`,
			text: code,
		});
	}

	/**
	 * 渲染带复制按钮的文本内容
	 */
	public static renderTextWithCopy(
		container: HTMLElement,
		text: string,
	): void {
		const wrapperEl = container.createDiv({ cls: "acp-content-with-copy" });

		// 清理行号格式（如 "00001| " 或 "   1→"）
		const cleanedText = this.cleanLineNumbers(text);

		// 文本内容
		const textEl = wrapperEl.createDiv({ cls: "acp-content-text" });
		textEl.textContent = cleanedText;

		// 复制按钮
		const copyBtn = wrapperEl.createDiv({ cls: "acp-copy-button" });
		setIcon(copyBtn, "copy");
		copyBtn.setAttribute("aria-label", "复制");

		copyBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void navigator.clipboard.writeText(text).then(() => {
				new Notice("已复制到剪贴板");
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
	 * 清理文本中的行号格式
	 *
	 * 支持的格式：
	 * - "00001| content" (OpenCode 格式)
	 * - "   1→content" (cat -n 格式)
	 * - "  1: content" (其他格式)
	 */
	private static cleanLineNumbers(text: string): string {
		if (!text) return text;

		// 检测是否有行号前缀
		const lines = text.split("\n");
		if (lines.length === 0) return text;

		// 检测常见的行号格式
		const lineNumberPatterns = [
			/^\d{5}\|\s?/, // 00001| (OpenCode)
			/^\s*\d+→/, // "   1→" (cat -n 风格)
			/^\s*\d+:\s?/, // "  1: " (grep 风格)
			/^\s*\d+\t/, // "  1\t" (cat -n 标准格式)
		];

		// 检测第一行是否匹配行号格式
		let matchedPattern: RegExp | null = null;
		for (const pattern of lineNumberPatterns) {
			if (pattern.test(lines[0])) {
				matchedPattern = pattern;
				break;
			}
		}

		// 如果检测到行号格式，清理所有行
		if (matchedPattern) {
			// 将匹配模式收窄为 const，避免在闭包中触发非空断言
			const pattern = matchedPattern;
			return lines.map((line) => line.replace(pattern, "")).join("\n");
		}

		// 处理 <file> 标签包裹的内容
		const fileTagMatch = text.match(/^<file>\s*\n?([\s\S]*?)\s*<\/file>$/);
		if (fileTagMatch) {
			return this.cleanLineNumbers(fileTagMatch[1]);
		}

		return text;
	}
}
