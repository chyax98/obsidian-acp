#!/usr/bin/env node
/**
 * Claude SDK 快速测试
 *
 * 使用方法：
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *   node test-sdk-quick.js
 */

const { query } = require('@anthropic-ai/claude-agent-sdk');

async function quickTest() {
	console.log('🚀 Claude SDK 快速测试\n');

	// 检查 API Key
	if (!process.env.ANTHROPIC_API_KEY) {
		console.error('❌ 未设置 ANTHROPIC_API_KEY');
		console.log('提示: export ANTHROPIC_API_KEY=sk-ant-...');
		process.exit(1);
	}

	try {
		console.log('→ 创建查询...');
		const q = query({
			prompt: '你好！请用一句话介绍自己',
			options: {
				model: 'claude-sonnet-4-5-20250929',
				cwd: process.cwd(),
				includePartialMessages: true,
				stderr: (msg) => console.log('  [stderr]', msg),
			},
		});

		console.log('✓ 查询已创建\n');
		console.log('→ 等待响应...\n');

		let textContent = '';
		let messageCount = 0;

		for await (const message of q) {
			messageCount++;

			if (message.type === 'stream_event') {
				const event = message.event;
				if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
					textContent += event.delta.text;
					process.stdout.write(event.delta.text);
				}
			}

			if (message.type === 'result') {
				console.log('\n\n✓ 完成');
				console.log(`  消息数: ${messageCount}`);
				console.log(`  文本长度: ${textContent.length} 字符`);
				console.log(`  费用: $${message.total_cost_usd || 0}`);
				console.log(`  错误: ${message.is_error ? '是' : '否'}`);

				if (message.is_error) {
					console.error('❌ 测试失败:', message.errors);
					process.exit(1);
				}
				break;
			}
		}

		console.log('\n✅ 测试通过！SDK 工作正常');
		process.exit(0);

	} catch (error) {
		console.error('\n❌ 测试失败:', error.message);
		console.error(error.stack);
		process.exit(1);
	}
}

quickTest();
