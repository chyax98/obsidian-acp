import type { App } from 'obsidian';
import { Modal } from 'obsidian';
import type { PermissionRequest, PermissionResponse } from '../acp/permission-manager';

/**
 * 权限对话框
 *
 * @remarks
 * 用于 2 种模式的权限系统：interactive（每次询问）和 trustAll（完全信任）
 */
export class PermissionModal extends Modal {
	constructor(
		app: App,
		private request: PermissionRequest,
		private onResponse: (response: PermissionResponse) => void,
	) {
		super(app);
	}

	public onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('acp-permission-modal');

		// 标题
		contentEl.createEl('h2', { text: '🔧 权限请求' });

		// 工具信息
		const infoEl = contentEl.createDiv('acp-permission-info');

		infoEl.createEl('div', {
			text: `工具: ${this.request.toolName}`,
			cls: 'acp-permission-tool',
		});

		infoEl.createEl('div', {
			text: `操作: ${this.request.title}`,
			cls: 'acp-permission-title',
		});

		// 参数预览
		if (Object.keys(this.request.rawInput).length > 0) {
			const paramsEl = contentEl.createDiv('acp-permission-params');
			paramsEl.createEl('strong', { text: '参数：' });
			paramsEl.createEl('pre', {
				text: JSON.stringify(this.request.rawInput, null, 2),
				cls: 'acp-permission-params-content',
			});
		}

		// 风险提示
		if (this.isHighRiskTool(this.request.toolName)) {
			const warningEl = contentEl.createDiv('acp-permission-warning');
			warningEl.createEl('span', { text: '⚠️ 高风险操作' });
			warningEl.createEl('p', {
				text: '此操作可能修改/删除文件或执行命令，请仔细检查参数。',
			});
		}

		// 按钮组
		const buttonsEl = contentEl.createDiv('acp-permission-buttons');

		// 拒绝
		const rejectBtn = buttonsEl.createEl('button', { text: '拒绝' });
		rejectBtn.addEventListener('click', () => {
			this.onResponse({ outcome: 'selected', optionId: 'reject-once' });
			this.close();
		});

		// 允许一次
		const allowOnceBtn = buttonsEl.createEl('button', {
			text: '允许一次',
			cls: 'mod-cta',
		});
		allowOnceBtn.addEventListener('click', () => {
			this.onResponse({ outcome: 'selected', optionId: 'allow-once' });
			this.close();
		});

		// 始终允许
		const alwaysBtn = buttonsEl.createEl('button', {
			text: '始终允许此工具',
		});
		alwaysBtn.addEventListener('click', () => {
			this.onResponse({ outcome: 'selected', optionId: 'allow-always' });
			this.close();
		});

		// 键盘快捷键
		this.scope.register([], 'Enter', () => {
			this.onResponse({ outcome: 'selected', optionId: 'allow-once' });
			this.close();
			return false;
		});
	}

	public onClose(): void {
		this.contentEl.empty();
	}

	private isHighRiskTool(toolName: string): boolean {
		const highRiskTools = [
			'fs/write',
			'fs/delete',
			'fs/move',
			'bash/run',
			'bash/background',
		];
		return highRiskTools.includes(toolName);
	}
}
