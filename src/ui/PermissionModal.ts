/**
 * ACP 权限请求弹窗
 *
 * 当 Agent 请求执行工具时，显示权限请求弹窗，等待用户批准或拒绝。
 */

import type { App } from 'obsidian';
import { Modal, Notice } from 'obsidian';
import type { RequestPermissionParams, PermissionOutcome, PermissionOption } from '../acp/types/permissions';

// ============================================================================
// PermissionModal 类
// ============================================================================

/**
 * 权限请求弹窗
 *
 * 显示 Agent 的权限请求，提供选项让用户选择。
 */
export class PermissionModal extends Modal {
	private params: RequestPermissionParams;
	private resolvePromise: ((outcome: PermissionOutcome) => void) | null = null;

	constructor(app: App, params: RequestPermissionParams) {
		super(app);
		this.params = params;
	}

	/**
	 * 显示弹窗并等待用户选择
	 */
	async show(): Promise<PermissionOutcome> {
		return new Promise<PermissionOutcome>((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	/**
	 * 打开弹窗
	 */
	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('acp-permission-modal');

		// 标题
		const titleEl = contentEl.createDiv({ cls: 'acp-permission-title' });
		titleEl.createEl('h2', { text: '权限请求' });

		// 工具调用信息
		this.renderToolCallInfo(contentEl);

		// 选项按钮
		this.renderOptions(contentEl);

		// 键盘快捷键
		this.setupKeyboardShortcuts();
	}

	/**
	 * 关闭弹窗
	 */
	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();

		// 如果用户直接关闭弹窗（点击 X 或按 Escape），返回取消
		if (this.resolvePromise) {
			this.resolvePromise({ type: 'cancelled' });
			this.resolvePromise = null;
		}
	}

	/**
	 * 渲染工具调用信息
	 */
	private renderToolCallInfo(container: HTMLElement): void {
		const infoContainer = container.createDiv({ cls: 'acp-permission-info' });

		const { toolCall } = this.params;

		// 工具名称
		if (toolCall.title) {
			const titleEl = infoContainer.createDiv({ cls: 'acp-permission-tool-title' });
			titleEl.textContent = toolCall.title;
		}

		// 工具类型
		if (toolCall.kind) {
			const kindEl = infoContainer.createDiv({ cls: 'acp-permission-tool-kind' });
			kindEl.textContent = `类型: ${this.getKindLabel(toolCall.kind)}`;
		}

		// 工具参数
		if (toolCall.rawInput) {
			const paramsEl = infoContainer.createDiv({ cls: 'acp-permission-params' });
			paramsEl.createEl('div', { text: '参数:', cls: 'acp-permission-params-label' });

			const paramsContent = paramsEl.createEl('pre', { cls: 'acp-permission-params-content' });
			paramsContent.textContent = this.formatRawInput(toolCall.rawInput);
		}

		// 位置信息
		if (toolCall.locations && toolCall.locations.length > 0) {
			const locationsEl = infoContainer.createDiv({ cls: 'acp-permission-locations' });
			locationsEl.createEl('div', { text: '相关文件:', cls: 'acp-permission-locations-label' });

			const locationsList = locationsEl.createEl('ul', { cls: 'acp-permission-locations-list' });
			for (const location of toolCall.locations) {
				const item = locationsList.createEl('li');
				item.textContent = location.path;
				if (location.line !== undefined) {
					item.textContent += `:${location.line}`;
				}
			}
		}
	}

	/**
	 * 渲染选项按钮
	 */
	private renderOptions(container: HTMLElement): void {
		const optionsContainer = container.createDiv({ cls: 'acp-permission-options' });

		// 按类型分组
		const allowOptions = this.params.options.filter((opt) => opt.kind.startsWith('allow'));
		const rejectOptions = this.params.options.filter((opt) => opt.kind.startsWith('reject'));

		// 允许选项
		if (allowOptions.length > 0) {
			const allowGroup = optionsContainer.createDiv({ cls: 'acp-permission-options-group' });
			for (const option of allowOptions) {
				this.renderOptionButton(allowGroup, option, true);
			}
		}

		// 拒绝选项
		if (rejectOptions.length > 0) {
			const rejectGroup = optionsContainer.createDiv({ cls: 'acp-permission-options-group' });
			for (const option of rejectOptions) {
				this.renderOptionButton(rejectGroup, option, false);
			}
		}
	}

	/**
	 * 渲染单个选项按钮
	 */
	private renderOptionButton(container: HTMLElement, option: PermissionOption, isAllow: boolean): void {
		const button = container.createEl('button', {
			cls: `acp-permission-button ${isAllow ? 'acp-permission-button-allow' : 'acp-permission-button-reject'}`,
			text: option.name,
		});

		// 添加 CTA 样式到"允许一次"
		if (option.kind === 'allow_once') {
			button.addClass('mod-cta');
		}

		button.addEventListener('click', () => {
			this.selectOption(option.optionId);
		});
	}

	/**
	 * 选择选项
	 */
	private selectOption(optionId: string): void {
		if (this.resolvePromise) {
			this.resolvePromise({ type: 'selected', optionId });
			this.resolvePromise = null;
		}
		this.close();
	}

	/**
	 * 设置键盘快捷键
	 */
	private setupKeyboardShortcuts(): void {
		// Enter: 选择第一个"允许"选项
		const allowOptions = this.params.options.filter((opt) => opt.kind.startsWith('allow'));
		if (allowOptions.length > 0) {
			this.scope.register([], 'Enter', () => {
				this.selectOption(allowOptions[0].optionId);
				return false; // 阻止默认行为
			});
		}

		// Escape: 取消（默认行为会关闭弹窗，onClose 会处理）
	}

	// ========================================================================
	// 辅助方法
	// ========================================================================

	/**
	 * 获取工具类型标签
	 */
	private getKindLabel(kind: string): string {
		const labels: Record<string, string> = {
			read: '读取',
			edit: '编辑',
			execute: '执行',
		};
		return labels[kind] || kind;
	}

	/**
	 * 格式化原始输入参数
	 */
	private formatRawInput(rawInput: Record<string, unknown>): string {
		// 特殊处理常见字段
		const lines: string[] = [];

		// 命令
		if (rawInput.command) {
			lines.push(`命令: ${rawInput.command}`);
		}

		// 描述
		if (rawInput.description) {
			lines.push(`描述: ${rawInput.description}`);
		}

		// 路径
		if (rawInput.path) {
			lines.push(`路径: ${rawInput.path}`);
		}

		// 其他字段
		for (const [key, value] of Object.entries(rawInput)) {
			if (!['command', 'description', 'path'].includes(key)) {
				lines.push(`${key}: ${JSON.stringify(value, null, 2)}`);
			}
		}

		return lines.join('\n') || JSON.stringify(rawInput, null, 2);
	}
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 判断是否为读取操作
 *
 * 用于自动批准设置。
 */
export function isReadOperation(params: RequestPermissionParams): boolean {
	return params.toolCall.kind === 'read';
}
