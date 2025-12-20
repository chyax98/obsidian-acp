import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import type { PermissionSettings } from '../main';
import { PermissionModal } from '../ui/PermissionModal';

/**
 * 权限请求
 */
export interface PermissionRequest {
	toolCallId: string;
	toolName: string;      // 如 "fs/read", "bash/run"
	title: string;         // 如 "Reading configuration file"
	kind: string;          // 如 "read", "write", "execute"
	rawInput: Record<string, unknown>;
}

/**
 * 权限响应
 */
export interface PermissionResponse {
	outcome: 'selected' | 'cancelled';
	optionId?: string;  // 'allow-once' | 'allow-always' | 'reject-once'
}

/**
 * 权限管理器
 *
 * @remarks
 * 拦截 ACP 协议的 session/request_permission 请求
 * 根据设置决定自动批准或弹窗询问
 */
export class PermissionManager {
	constructor(
		private app: App,
		private settings: PermissionSettings,
		private saveSettings: () => Promise<void>,
	) {}

	/**
	 * 处理权限请求
	 */
	public async handlePermissionRequest(
		request: PermissionRequest,
	): Promise<PermissionResponse> {
		const { toolName } = request;

		// 模式 1: 完全信任 - 自动批准所有请求
		if (this.settings.mode === 'trustAll') {
			return {
				outcome: 'selected',
				optionId: 'allow-once',
			};
		}

		// 模式 2: 每次询问 - 检查是否已记录"始终允许"
		if (this.settings.alwaysAllowedTools[toolName]) {
			return {
				outcome: 'selected',
				optionId: 'allow-once',
			};
		}

		// 弹出权限对话框
		return await this.showPermissionDialog(request);
	}

	/**
	 * 显示权限对话框
	 */
	private async showPermissionDialog(
		request: PermissionRequest,
	): Promise<PermissionResponse> {
		return new Promise((resolve) => {
			const modal = new PermissionModal(
				this.app,
				request,
				(response: PermissionResponse) => {
					// 如果用户选择"始终允许"，记录到设置
					if (response.optionId === 'allow-always') {
						this.settings.alwaysAllowedTools[request.toolName] = true;
						void this.saveSettings().then(() => {
							new Notice(`已记住：始终允许 ${request.toolName}`);
						});

						// 转换为 allow-once 返回给 Agent
						resolve({
							outcome: 'selected',
							optionId: 'allow-once',
						});
					} else {
						resolve(response);
					}
				},
			);
			modal.open();
		});
	}

	/**
	 * 重置"始终允许"记录
	 */
	public async resetAlwaysAllowed(): Promise<void> {
		this.settings.alwaysAllowedTools = {};
		await this.saveSettings();
		new Notice('已清除所有"始终允许"记录');
	}

	/**
	 * 获取已记录的工具数量
	 */
	public getAllowedToolsCount(): number {
		return Object.keys(this.settings.alwaysAllowedTools).length;
	}
}
