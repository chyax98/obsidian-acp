#!/usr/bin/env node
/**
 * Claude SDK 连接测试脚本
 *
 * 使用方法：
 * 1. 设置环境变量：export ANTHROPIC_API_KEY=sk-ant-...
 * 2. 运行：node test-claude-sdk.js
 */

const { query } = require('@anthropic-ai/claude-agent-sdk');

// ============================================================================
// 测试配置
// ============================================================================

const TEST_CONFIG = {
	model: 'claude-sonnet-4-5-20250929',
	cwd: process.cwd(),
	prompt: '你好，请简单介绍一下你自己（1-2 句话即可）',
};

// ============================================================================
// 测试工具函数
// ============================================================================

class TestLogger {
	constructor() {
		this.logs = [];
		this.startTime = Date.now();
	}

	log(level, message, data = null) {
		const timestamp = Date.now() - this.startTime;
		const entry = { timestamp, level, message, data };
		this.logs.push(entry);

		const prefix = {
			info: '✓',
			warn: '⚠',
			error: '✗',
			debug: '→',
		}[level] || '•';

		console.log(`[${timestamp}ms] ${prefix} ${message}`);
		if (data) {
			console.log('   ', JSON.stringify(data, null, 2));
		}
	}

	info(msg, data) { this.log('info', msg, data); }
	warn(msg, data) { this.log('warn', msg, data); }
	error(msg, data) { this.log('error', msg, data); }
	debug(msg, data) { this.log('debug', msg, data); }

	summary() {
		const duration = Date.now() - this.startTime;
		const errors = this.logs.filter(l => l.level === 'error').length;
		const warnings = this.logs.filter(l => l.level === 'warn').length;

		console.log('\n' + '='.repeat(60));
		console.log('测试总结:');
		console.log('  总耗时:', duration, 'ms');
		console.log('  错误数:', errors);
		console.log('  警告数:', warnings);
		console.log('  日志条目:', this.logs.length);
		console.log('='.repeat(60));

		return { duration, errors, warnings, totalLogs: this.logs.length };
	}
}

// ============================================================================
// 测试用例
// ============================================================================

/**
 * 测试 1: 基础连接和响应
 */
async function test1_BasicConnection(logger) {
	logger.info('测试 1: 基础连接和响应');

	try {
		// 检查 API Key
		if (!process.env.ANTHROPIC_API_KEY) {
			logger.warn('未设置 ANTHROPIC_API_KEY，跳过实际 API 调用测试');
			logger.info('提示: export ANTHROPIC_API_KEY=sk-ant-...');
			return { skipped: true };
		}

		// 创建 query
		const q = query({
			prompt: TEST_CONFIG.prompt,
			options: {
				model: TEST_CONFIG.model,
				cwd: TEST_CONFIG.cwd,
				includePartialMessages: true,
				stderr: (msg) => logger.debug('SDK stderr: ' + msg),
			},
		});

		logger.info('Query 已创建，开始接收消息...');

		// 收集结果
		let messageCount = 0;
		let textContent = '';
		let hasStreamEvent = false;
		let finalResult = null;

		// 异步迭代消息
		for await (const message of q) {
			messageCount++;
			logger.debug(`消息 #${messageCount}: ${message.type}`);

			switch (message.type) {
				case 'stream_event':
					hasStreamEvent = true;
					const event = message.event;
					if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
						textContent += event.delta.text;
						process.stdout.write(event.delta.text); // 实时显示
					}
					break;

				case 'assistant':
					logger.debug('收到 assistant 消息', { content: message.message?.content });
					break;

				case 'result':
					finalResult = message;
					logger.info('收到最终结果', {
						isError: message.is_error,
						cost: message.total_cost_usd,
					});
					break;

				default:
					logger.debug('未处理的消息类型: ' + message.type);
			}

			// 如果是 result 消息，结束循环
			if (message.type === 'result') {
				break;
			}
		}

		console.log('\n'); // 换行

		// 验证结果
		const checks = {
			'收到消息': messageCount > 0,
			'有流式事件': hasStreamEvent,
			'有文本内容': textContent.length > 0,
			'有最终结果': finalResult !== null,
			'无错误': !finalResult?.is_error,
		};

		logger.info('检查结果:', checks);

		const passed = Object.values(checks).every(v => v);
		if (passed) {
			logger.info('✅ 测试 1 通过');
		} else {
			logger.error('❌ 测试 1 失败', checks);
		}

		return { passed, checks, messageCount, textLength: textContent.length };

	} catch (error) {
		logger.error('测试 1 异常', { error: error.message, stack: error.stack });
		return { passed: false, error: error.message };
	}
}

/**
 * 测试 2: 工具调用和权限
 */
async function test2_ToolUseAndPermission(logger) {
	logger.info('测试 2: 工具调用和权限');

	try {
		if (!process.env.ANTHROPIC_API_KEY) {
			logger.warn('未设置 ANTHROPIC_API_KEY，跳过测试 2');
			return { skipped: true };
		}

		const toolCalls = [];
		const permissions = [];

		const q = query({
			prompt: '请列出当前目录的文件（只需要文件名列表）',
			options: {
				model: TEST_CONFIG.model,
				cwd: TEST_CONFIG.cwd,
				includePartialMessages: true,

				// 权限回调
				canUseTool: async (toolName, toolInput, { toolUseID }) => {
					logger.info(`权限请求: ${toolName}`, { toolUseID, input: toolInput });
					permissions.push({ toolName, toolUseID });

					// 自动批准 read 类工具，拒绝 write 类工具
					if (toolName.includes('read') || toolName.includes('list') || toolName.includes('glob')) {
						logger.info(`✓ 自动批准工具: ${toolName}`);
						return { behavior: 'allow', updatedInput: toolInput };
					} else {
						logger.warn(`✗ 拒绝工具: ${toolName}`);
						return { behavior: 'deny' };
					}
				},

				stderr: (msg) => logger.debug('SDK stderr: ' + msg),
			},
		});

		logger.info('开始监听工具调用...');

		for await (const message of q) {
			if (message.type === 'stream_event') {
				const event = message.event;
				if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
					toolCalls.push({
						name: event.content_block.name,
						id: event.content_block.id,
					});
					logger.info(`工具调用: ${event.content_block.name}`, { id: event.content_block.id });
				} else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
					process.stdout.write(event.delta.text);
				}
			}

			if (message.type === 'result') {
				logger.info('测试 2 完成', {
					toolCalls: toolCalls.length,
					permissions: permissions.length,
				});
				break;
			}
		}

		console.log('\n');

		const checks = {
			'有工具调用': toolCalls.length > 0,
			'触发权限检查': permissions.length > 0,
		};

		const passed = Object.values(checks).every(v => v);
		logger.info(passed ? '✅ 测试 2 通过' : '❌ 测试 2 失败', checks);

		return { passed, checks, toolCalls, permissions };

	} catch (error) {
		logger.error('测试 2 异常', { error: error.message });
		return { passed: false, error: error.message };
	}
}

/**
 * 测试 3: 错误处理
 */
async function test3_ErrorHandling(logger) {
	logger.info('测试 3: 错误处理（无效 API Key）');

	try {
		// 临时使用无效的 API Key
		const invalidKey = 'sk-ant-invalid-key-for-testing';

		const q = query({
			prompt: '测试',
			options: {
				model: TEST_CONFIG.model,
				cwd: TEST_CONFIG.cwd,
				env: {
					...process.env,
					ANTHROPIC_API_KEY: invalidKey,
				},
				stderr: (msg) => logger.debug('SDK stderr: ' + msg),
			},
		});

		let hasError = false;
		let errorMessage = '';

		for await (const message of q) {
			logger.debug('收到消息: ' + message.type);

			if (message.type === 'result') {
				if (message.is_error || message.errors) {
					hasError = true;
					errorMessage = message.errors?.join(', ') || '未知错误';
					logger.info('✓ 成功捕获到错误:', errorMessage);
				}
				break;
			}
		}

		const passed = hasError;
		logger.info(passed ? '✅ 测试 3 通过（正确处理错误）' : '❌ 测试 3 失败（未检测到错误）');

		return { passed, hasError, errorMessage };

	} catch (error) {
		// 异常也算测试通过（说明错误被正确抛出）
		logger.info('✓ 捕获到异常（符合预期）:', error.message);
		return { passed: true, caughtException: true, error: error.message };
	}
}

/**
 * 测试 4: 取消查询
 */
async function test4_CancelQuery(logger) {
	logger.info('测试 4: 取消查询');

	try {
		if (!process.env.ANTHROPIC_API_KEY) {
			logger.warn('未设置 ANTHROPIC_API_KEY，跳过测试 4');
			return { skipped: true };
		}

		const q = query({
			prompt: '请详细讲解一下量子计算的原理，至少 500 字',
			options: {
				model: TEST_CONFIG.model,
				cwd: TEST_CONFIG.cwd,
				includePartialMessages: true,
				stderr: (msg) => logger.debug('SDK stderr: ' + msg),
			},
		});

		logger.info('开始查询，2 秒后取消...');

		// 2 秒后取消
		const cancelTimer = setTimeout(() => {
			logger.info('执行取消操作...');
			if (typeof q.interrupt === 'function') {
				q.interrupt();
			} else {
				logger.warn('Query 没有 interrupt 方法');
			}
		}, 2000);

		let messageCount = 0;
		let cancelled = false;

		try {
			for await (const message of q) {
				messageCount++;
				if (message.type === 'stream_event') {
					process.stdout.write('.');
				}
			}
		} catch (error) {
			if (error.message.includes('cancel') || error.message.includes('interrupt')) {
				cancelled = true;
				logger.info('✓ 查询被取消');
			} else {
				throw error;
			}
		} finally {
			clearTimeout(cancelTimer);
		}

		console.log('\n');

		const passed = cancelled || messageCount < 10; // 如果收到的消息很少，说明可能被中断了
		logger.info(passed ? '✅ 测试 4 通过' : '❌ 测试 4 失败', {
			cancelled,
			messageCount,
		});

		return { passed, cancelled, messageCount };

	} catch (error) {
		logger.error('测试 4 异常', { error: error.message });
		return { passed: false, error: error.message };
	}
}

// ============================================================================
// 主测试流程
// ============================================================================

async function runAllTests() {
	console.log('='.repeat(60));
	console.log('Claude Agent SDK 测试套件');
	console.log('='.repeat(60));
	console.log();

	const logger = new TestLogger();
	const results = {};

	// 运行所有测试
	results.test1 = await test1_BasicConnection(logger);
	console.log('\n' + '-'.repeat(60) + '\n');

	results.test2 = await test2_ToolUseAndPermission(logger);
	console.log('\n' + '-'.repeat(60) + '\n');

	results.test3 = await test3_ErrorHandling(logger);
	console.log('\n' + '-'.repeat(60) + '\n');

	results.test4 = await test4_CancelQuery(logger);
	console.log('\n' + '-'.repeat(60) + '\n');

	// 总结
	const summary = logger.summary();

	console.log('\n测试结果详情:');
	console.log('  测试 1 (基础连接):', results.test1.passed ? '✅ 通过' : '❌ 失败', results.test1.skipped ? '(跳过)' : '');
	console.log('  测试 2 (工具调用):', results.test2.passed ? '✅ 通过' : '❌ 失败', results.test2.skipped ? '(跳过)' : '');
	console.log('  测试 3 (错误处理):', results.test3.passed ? '✅ 通过' : '❌ 失败');
	console.log('  测试 4 (取消查询):', results.test4.passed ? '✅ 通过' : '❌ 失败', results.test4.skipped ? '(跳过)' : '');

	const totalPassed = Object.values(results).filter(r => r.passed).length;
	const totalTests = Object.keys(results).length;

	console.log('\n总计:', `${totalPassed}/${totalTests} 通过`);

	// 返回退出码
	return totalPassed === totalTests ? 0 : 1;
}

// 运行测试
if (require.main === module) {
	runAllTests()
		.then(exitCode => {
			process.exit(exitCode);
		})
		.catch(error => {
			console.error('测试运行失败:', error);
			process.exit(1);
		});
}

module.exports = { runAllTests };
