/**
 * Claude Agent SDK Mock
 *
 * 用于测试的 SDK 模拟实现
 */

export interface SDKMessage {
	type: 'stream_event' | 'assistant' | 'result' | 'system' | 'user';
	[key: string]: unknown;
}

export interface Options {
	model?: string;
	cwd: string;
	env?: Record<string, string>;
	includePartialMessages?: boolean;
	canUseTool?: (toolName: string, toolInput: unknown, meta: unknown) => Promise<PermissionResult>;
	stderr?: (message: string) => void;
}

export interface PermissionResult {
	behavior: 'allow' | 'deny';
	updatedInput?: unknown;
}

export interface Query {
	[Symbol.asyncIterator](): AsyncIterator<SDKMessage>;
	interrupt?: () => Promise<void>;
}

/**
 * Mock query 函数
 */
export function query(config: { prompt: string; options: Options }): Query {
	const messages: SDKMessage[] = [
		{
			type: 'stream_event',
			event: {
				type: 'content_block_start',
				content_block: {
					type: 'text',
				},
			},
		},
		{
			type: 'stream_event',
			event: {
				type: 'content_block_delta',
				delta: {
					type: 'text_delta',
					text: 'Mock response from Claude SDK',
				},
			},
		},
		{
			type: 'result',
			is_error: false,
			result: 'Mock response',
			total_cost_usd: 0.001,
		},
	];

	let interrupted = false;

	return {
		async *[Symbol.asyncIterator]() {
			for (const message of messages) {
				if (interrupted) {
					break;
				}
				yield message;
			}
		},
		async interrupt() {
			interrupted = true;
		},
	};
}

export type { SDKMessage as SDKResultMessage };
