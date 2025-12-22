/**
 * 错误显示辅助类
 *
 * 提供友好的错误提示和解决方案
 */

import { setIcon, Notice } from "obsidian";

/**
 * 错误上下文类型
 */
export type ErrorContext = "connection" | "send" | "tool";

/**
 * 错误分析结果
 */
interface ErrorAnalysis {
	friendlyMessage: string;
	suggestions: string[];
}

/**
 * 错误显示辅助类
 */
export class ErrorDisplayHelper {
	private messagesEl: HTMLElement;

	constructor(messagesEl: HTMLElement) {
		this.messagesEl = messagesEl;
	}

	/**
	 * 显示友好化错误提示
	 */
	public showError(error: Error, context: ErrorContext): void {
		const analysis = this.analyzeError(error, context);

		// 在消息区域显示错误卡片
		const errorEl = this.messagesEl.createDiv({ cls: "acp-error-card" });

		// 错误图标和标题
		const headerEl = errorEl.createDiv({ cls: "acp-error-header" });
		const iconEl = headerEl.createDiv({ cls: "acp-error-icon" });
		setIcon(iconEl, "alert-circle");
		headerEl.createDiv({
			cls: "acp-error-title",
			text: analysis.friendlyMessage,
		});

		// 详细错误信息
		const detailEl = errorEl.createDiv({ cls: "acp-error-detail" });
		detailEl.createDiv({
			cls: "acp-error-message",
			text: error.message || "未知错误",
		});

		// 解决方案
		if (analysis.suggestions.length > 0) {
			const solutionsEl = errorEl.createDiv({
				cls: "acp-error-solutions",
			});
			solutionsEl.createDiv({
				cls: "acp-error-solutions-title",
				text: "解决方法:",
			});

			const listEl = solutionsEl.createEl("ul");
			for (const suggestion of analysis.suggestions) {
				listEl.createEl("li", { text: suggestion });
			}
		}

		// Obsidian Notice
		new Notice(`❌ ${analysis.friendlyMessage}`);
	}

	/**
	 * 清除所有错误卡片
	 */
	public clearErrors(): void {
		const errorCards = this.messagesEl.querySelectorAll(".acp-error-card");
		errorCards.forEach((card) => card.remove());
	}

	/**
	 * 分析错误并生成友好提示
	 */
	private analyzeError(error: Error, context: ErrorContext): ErrorAnalysis {
		const errorMessage = error.message || "未知错误";

		if (context === "connection") {
			return this.analyzeConnectionError(errorMessage);
		} else if (context === "send") {
			return {
				friendlyMessage: "消息发送失败",
				suggestions: [
					"1. 检查连接状态",
					"2. 重试发送",
					"3. 重新连接 Agent",
				],
			};
		} else if (context === "tool") {
			return {
				friendlyMessage: "工具调用失败",
				suggestions: [
					"1. 检查权限设置",
					"2. 检查文件路径",
					"3. 查看详细错误信息",
				],
			};
		}

		return {
			friendlyMessage: "发生错误",
			suggestions: ["查看控制台日志（Ctrl+Shift+I）获取详情"],
		};
	}

	/**
	 * 分析连接错误
	 */
	private analyzeConnectionError(errorMessage: string): ErrorAnalysis {
		if (
			errorMessage.includes("ENOENT") ||
			errorMessage.includes("not found")
		) {
			return {
				friendlyMessage: "Agent CLI 未安装或路径不正确",
				suggestions: [
					"1. 检查 Agent 是否已安装",
					"2. 运行安装命令（参见设置页面）",
					"3. 重启 Obsidian",
				],
			};
		}

		if (
			errorMessage.includes("EACCES") ||
			errorMessage.includes("permission")
		) {
			return {
				friendlyMessage: "权限不足",
				suggestions: [
					"1. 检查文件/目录权限",
					"2. 使用 sudo 重新安装 CLI",
					"3. 检查安全设置",
				],
			};
		}

		if (
			errorMessage.includes("timeout") ||
			errorMessage.includes("ETIMEDOUT")
		) {
			return {
				friendlyMessage: "连接超时",
				suggestions: [
					"1. 检查网络连接",
					"2. 检查 Agent 服务状态",
					"3. 增加超时时间（设置页面）",
				],
			};
		}

		return {
			friendlyMessage: "连接失败",
			suggestions: [
				"1. 查看详细错误信息",
				"2. 检查 Agent 配置",
				"3. 查看控制台日志（Ctrl+Shift+I）",
			],
		};
	}
}
