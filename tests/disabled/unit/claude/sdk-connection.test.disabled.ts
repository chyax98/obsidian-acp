/**
 * Claude SDK 连接单元测试
 */

import { ClaudeSdkConnection } from '../../../src/claude/sdk-connection';
import type { ClaudeSdkOptions, ClaudeCallbacks } from '../../../src/claude';

describe('ClaudeSdkConnection', () => {
	let connection: ClaudeSdkConnection;

	beforeEach(() => {
		connection = new ClaudeSdkConnection();
	});

	afterEach(() => {
		if (connection.connected) {
			connection.disconnect();
		}
	});

	describe('connect()', () => {
		it('应该成功连接', async () => {
			const options: ClaudeSdkOptions = {
				cwd: process.cwd(),
				model: 'claude-sonnet-4-5-20250929',
			};

			await connection.connect(options);

			expect(connection.connected).toBe(true);
		});

		it('缺少 cwd 时应该抛出错误', async () => {
			const options = {
				model: 'claude-sonnet-4-5-20250929',
			} as ClaudeSdkOptions;

			await expect(connection.connect(options)).rejects.toThrow('缺少工作目录');
		});
	});

	describe('disconnect()', () => {
		it('应该正确断开连接', async () => {
			const options: ClaudeSdkOptions = {
				cwd: process.cwd(),
			};

			await connection.connect(options);
			expect(connection.connected).toBe(true);

			connection.disconnect();
			expect(connection.connected).toBe(false);
		});
	});

	describe('sendPrompt()', () => {
		it('未连接时应该抛出错误', async () => {
			const options: ClaudeSdkOptions = {
				cwd: process.cwd(),
			};

			const callbacks: ClaudeCallbacks = {};

			await expect(
				connection.sendPrompt('test', options, callbacks)
			).rejects.toThrow('连接未建立');
		});

		// 注意：实际的 API 调用测试需要有效的 API Key
		// 这里只测试错误情况
	});

	describe('cancel()', () => {
		it('应该能安全地调用 cancel', async () => {
			// 即使没有正在进行的查询，也不应该抛出错误
			await expect(connection.cancel()).resolves.not.toThrow();
		});
	});
});
