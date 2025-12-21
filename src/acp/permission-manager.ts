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
	optionId?: string;  // 'allow' | 'allow_always' | 'reject' (ACP 标准格式)
}

/**
 * 权限请求队列项
 */
interface QueuedRequest {
	request: PermissionRequest;
	resolve: (response: PermissionResponse) => void;
}

/**
 * 权限管理器
 *
 * @remarks
 * 拦截 ACP 协议的 session/request_permission 请求
 * 根据设置决定自动批准或弹窗询问
 * 使用队列机制确保一次只处理一个权限弹窗，避免并发问题
 */
export class PermissionManager {
	/** 权限请求队列 */
	private requestQueue: QueuedRequest[] = [];
	/** 是否正在处理请求 */
	private isProcessing = false;

	constructor(
		private app: App,
		private settings: PermissionSettings,
		private saveSettings: () => Promise<void>,
	) {}

	/**
	 * 处理权限请求
	 *
	 * 使用队列机制确保一次只显示一个权限弹窗
	 */
	public async handlePermissionRequest(
		request: PermissionRequest,
	): Promise<PermissionResponse> {
		const { toolName } = request;

		console.log('[PermissionManager] 权限请求:', toolName);

		// 模式 1: 完全信任 - 自动批准所有请求（不需要排队）
		if (this.settings.mode === 'trustAll') {
			console.log('[PermissionManager] trustAll 模式，自动批准');
			return {
				outcome: 'selected',
				optionId: 'allow',  // ACP 标准格式
			};
		}

		// 检查是否已记录"始终允许"（不需要排队）
		if (this.settings.alwaysAllowedTools[toolName]) {
			console.log('[PermissionManager] 工具已在始终允许列表');
			return {
				outcome: 'selected',
				optionId: 'allow',  // ACP 标准格式
			};
		}

		// 需要显示弹窗的请求加入队列
		return new Promise((resolve) => {
			this.requestQueue.push({ request, resolve });
			console.log('[PermissionManager] 请求加入队列，当前队列长度:', this.requestQueue.length);
			this.processNextRequest();
		});
	}

	/**
	 * 处理队列中的下一个请求
	 */
	private processNextRequest(): void {
		// 如果正在处理或队列为空，直接返回
		if (this.isProcessing || this.requestQueue.length === 0) {
			return;
		}

		this.isProcessing = true;
		const queued = this.requestQueue.shift()!;

		console.log('[PermissionManager] 开始处理队列请求:', queued.request.toolName);

		// 显示对话框并等待响应
		void this.showPermissionDialog(queued.request).then((response) => {
			console.log('[PermissionManager] 对话框响应:', response);
			queued.resolve(response);
			this.isProcessing = false;

			// 处理下一个请求
			this.processNextRequest();
		});
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
					if (response.optionId === 'allow_always') {
						this.settings.alwaysAllowedTools[request.toolName] = true;
						void this.saveSettings().then(() => {
							new Notice(`已记住：始终允许 ${request.toolName}`);
						});

						// 转换为 allow 返回给 Agent（ACP 标准格式）
						resolve({
							outcome: 'selected',
							optionId: 'allow',
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
