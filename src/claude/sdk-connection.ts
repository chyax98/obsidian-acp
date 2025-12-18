/**
 * Claude Agent SDK 连接包装器（简化版）
 *
 * 基于 Zed 官方实现，简化用于 Obsidian 插件
 * 参考：https://github.com/zed-industries/claude-code-acp
 */

import { query, type Query, type SDKMessage, type Options, type PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import type { ClaudeSdkOptions } from './types';

/**
 * 消息回调
 */
export interface ClaudeCallbacks {
	/** 文本消息 */
	onText?: (text: string, isStreaming: boolean) => void;
	/** 工具调用 */
	onToolUse?: (toolName: string, input: any, toolUseId: string) => void;
	/** 工具结果 */
	onToolResult?: (toolUseId: string, result: any, isError: boolean) => void;
	/** 错误 */
	onError?: (error: Error) => void;
	/** 完成 */
	onComplete?: (result: string, cost: number) => void;
	/** 权限请求 */
	onPermissionRequest?: (toolName: string, input: any) => Promise<PermissionResult>;
}

/**
 * Claude SDK 连接类（简化版）
 *
 * 不实现完整 ACP 协议，仅包装 SDK 供 Obsidian 使用
 */
export class ClaudeSdkConnection {
	private currentQuery: Query | null = null;
	private isConnected = false;

	/**
	 * 启动连接（仅验证 SDK 可用）
	 */
	async connect(options: ClaudeSdkOptions): Promise<void> {
		try {
			console.log('[Claude SDK] 验证 SDK...');

			// 验证必需参数
			if (!options.cwd) {
				throw new Error('缺少工作目录');
			}

			this.isConnected = true;
			console.log('[Claude SDK] 连接就绪');
		} catch (error) {
			console.error('[Claude SDK] 连接失败:', error);
			throw error;
		}
	}

	/**
	 * 发送提示并处理响应
	 *
	 * @param text 用户提示
	 * @param options SDK 选项
	 * @param callbacks 消息回调
	 */
	async sendPrompt(text: string, options: ClaudeSdkOptions, callbacks: ClaudeCallbacks): Promise<void> {
		if (!this.isConnected) {
			throw new Error('连接未建立');
		}

		// 强制验证 cwd
		if (!options.cwd || typeof options.cwd !== 'string') {
			throw new Error(`cwd 参数无效: ${options.cwd} (类型: ${typeof options.cwd})`);
		}

		try {
			// 构建 SDK 选项
			const sdkOptions: Options = {
				model: options.model || 'claude-sonnet-4-5-20250929',
				cwd: options.cwd,
				includePartialMessages: true, // 启用流式响应

				// 继承系统环境（以便使用 Claude Code 认证）
				env: { ...process.env },

				// 关键修复：指定 Claude Code CLI 路径（避免 import.meta.url undefined）
				pathToClaudeCodeExecutable: 'claude',

				// 权限回调
				canUseTool: async (toolName, toolInput, { toolUseID }) => {
					if (callbacks.onPermissionRequest) {
						return await callbacks.onPermissionRequest(toolName, toolInput);
					}
					// 默认允许所有工具
					return {
						behavior: 'allow',
						updatedInput: toolInput,
					};
				},

				// 错误日志
				stderr: (message) => {
					console.error('[Claude SDK stderr]:', message);
				},
			};

			// 如果提供了自定义 API Key，覆盖环境变量
			if (options.apiKey) {
				sdkOptions.env!.ANTHROPIC_API_KEY = options.apiKey;
				console.log('[Claude SDK] 使用自定义 API Key');
			} else {
				console.log('[Claude SDK] 使用系统 Claude Code 认证');
			}

			// 如果提供了自定义 API URL，设置环境变量
			if (options.apiUrl) {
				sdkOptions.env!.ANTHROPIC_BASE_URL = options.apiUrl;
				console.log('[Claude SDK] 使用自定义 API URL:', options.apiUrl);
			}

			// 创建 query
			this.currentQuery = query({
				prompt: text, // 直接传字符串（SDK 会自动包装）
				options: sdkOptions,
			});

			// 异步迭代处理消息
			for await (const message of this.currentQuery) {
				await this.handleMessage(message, callbacks);

				// 如果是最终结果，结束
				if (message.type === 'result') {
					break;
				}
			}
		} catch (error) {
			console.error('[Claude SDK] 发送提示失败:', error);
			callbacks.onError?.(error as Error);
			throw error;
		} finally {
			this.currentQuery = null;
		}
	}

	/**
	 * 处理 SDK 消息
	 */
	private async handleMessage(message: SDKMessage, callbacks: ClaudeCallbacks): Promise<void> {
		switch (message.type) {
			case 'stream_event': {
				// 流式事件（实时更新）
				const event = (message as any).event;

				switch (event.type) {
					case 'content_block_start':
						if (event.content_block.type === 'text') {
							callbacks.onText?.('', true);
						} else if (event.content_block.type === 'tool_use') {
							callbacks.onToolUse?.(
								event.content_block.name,
								event.content_block.input,
								event.content_block.id,
							);
						}
						break;

					case 'content_block_delta':
						if (event.delta.type === 'text_delta') {
							callbacks.onText?.(event.delta.text, true);
						}
						break;

					case 'message_stop':
						// 消息结束，停止流式
						callbacks.onText?.('', false);
						break;
				}
				break;
			}

			case 'assistant': {
				// 完整的助手消息
				const content = this.extractTextContent((message as any).message?.content);
				if (content) {
					callbacks.onText?.(content, false);
				}
				break;
			}

			case 'result': {
				// 最终结果
				const resultMsg = message as any;
				// 检查是否有错误
				if (resultMsg.is_error || resultMsg.errors) {
					const errorMsg = resultMsg.errors?.join(', ') || '未知错误';
					callbacks.onError?.(new Error(errorMsg));
				} else {
					callbacks.onComplete?.(
						resultMsg.result || '',
						resultMsg.total_cost_usd || 0,
					);
				}
				break;
			}

			default:
				console.log('[Claude SDK] 未处理的消息类型:', message.type);
		}
	}

	/**
	 * 提取文本内容
	 */
	private extractTextContent(content: any): string {
		if (typeof content === 'string') {
			return content;
		}
		if (Array.isArray(content)) {
			return content
				.filter((block) => block.type === 'text')
				.map((block) => block.text)
				.join('\n');
		}
		return '';
	}

	/**
	 * 取消当前查询
	 */
	async cancel(): Promise<void> {
		if (this.currentQuery) {
			try {
				await (this.currentQuery as any).interrupt?.();
			} catch (error) {
				console.error('[Claude SDK] 取消失败:', error);
			}
		}
	}

	/**
	 * 断开连接
	 */
	disconnect(): void {
		this.currentQuery = null;
		this.isConnected = false;
		console.log('[Claude SDK] 已断开连接');
	}

	/**
	 * 是否已连接
	 */
	get connected(): boolean {
		return this.isConnected;
	}
}
