/**
 * 终端输出渲染器
 *
 * 渲染终端/命令行输出，支持：
 * - 命令显示
 * - 复制按钮
 */

import { setIcon, Notice } from "obsidian";

/**
 * 终端渲染器
 */
export class TerminalRenderer {
	/**
	 * 渲染终端输出
	 *
	 * @param container - 容器元素
	 * @param command - 执行的命令（如果有）
	 * @param terminalId - 终端会话 ID（可选显示）
	 */
	public static render(
		container: HTMLElement,
		command?: string,
		terminalId?: string,
	): void {
		const wrapperEl = container.createDiv({ cls: "acp-terminal-wrapper" });

		// 终端内容
		const preEl = wrapperEl.createEl("pre");
		const codeEl = preEl.createEl("code");

		// 优先显示命令
		if (command) {
			const promptSpan = codeEl.createSpan({
				cls: "acp-terminal-prompt",
				text: "$ ",
			});
			promptSpan.style.color = "var(--text-accent)";
			codeEl.appendText(command);
		} else if (terminalId) {
			codeEl.setText(`[Terminal: ${terminalId}]`);
		} else {
			codeEl.setText("（无命令信息）");
		}

		// 复制按钮
		const copyContent = command || terminalId || "";
		if (copyContent) {
			const copyBtn = wrapperEl.createDiv({
				cls: "acp-copy-button acp-copy-button-terminal",
			});
			setIcon(copyBtn, "copy");
			copyBtn.setAttribute("aria-label", "复制命令");

			copyBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				void navigator.clipboard.writeText(copyContent).then(() => {
					new Notice("已复制命令");
					copyBtn.empty();
					setIcon(copyBtn, "check");
					setTimeout(() => {
						copyBtn.empty();
						setIcon(copyBtn, "copy");
					}, 1500);
				});
			});
		}
	}
}
