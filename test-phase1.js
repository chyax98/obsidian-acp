#!/usr/bin/env node
/**
 * Phase 1 测试：Claude ACP 连接测试
 *
 * 测试：
 * 1. npx @zed-industries/claude-code-acp 能否启动
 * 2. initialize 协议
 * 3. session/new 协议
 */

const { spawn } = require('child_process');

console.log('='.repeat(60));
console.log('Phase 1: Claude ACP 连接测试');
console.log('='.repeat(60));
console.log();

// 测试配置
const TEST_CONFIG = {
	command: 'npx',
	args: ['@zed-industries/claude-code-acp'],
	cwd: process.cwd(),
	timeout: 30000,
};

let child;
let messageBuffer = '';
let requestId = 0;
const pendingRequests = new Map();

// 启动进程
console.log('1. 启动 Claude ACP...');
console.log(`   命令: ${TEST_CONFIG.command} ${TEST_CONFIG.args.join(' ')}`);
console.log();

child = spawn(TEST_CONFIG.command, TEST_CONFIG.args, {
	cwd: TEST_CONFIG.cwd,
	stdio: ['pipe', 'pipe', 'pipe'],
	env: process.env,
});

// 监听标准输出
child.stdout.on('data', (data) => {
	const dataStr = data.toString();
	messageBuffer += dataStr;

	const lines = messageBuffer.split('\n');
	messageBuffer = lines.pop() || '';

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed) {
			try {
				const message = JSON.parse(trimmed);
				handleMessage(message);
			} catch (error) {
				// 忽略非 JSON 行
			}
		}
	}
});

// 监听标准错误
child.stderr.on('data', (data) => {
	console.log('   [STDERR]', data.toString());
});

// 监听进程退出
child.on('exit', (code, signal) => {
	console.log(`\n进程退出: code=${code}, signal=${signal}`);
	process.exit(code || 0);
});

// 监听错误
child.on('error', (error) => {
	console.error('❌ 进程启动失败:', error);
	process.exit(1);
});

// 发送请求
function sendRequest(method, params) {
	return new Promise((resolve, reject) => {
		const id = ++requestId;
		const request = {
			jsonrpc: '2.0',
			id,
			method,
			params,
		};

		pendingRequests.set(id, { resolve, reject, method });

		const message = JSON.stringify(request) + '\n';
		child.stdin.write(message);

		console.log(`→ 发送: ${method}`);

		// 超时
		setTimeout(() => {
			if (pendingRequests.has(id)) {
				pendingRequests.delete(id);
				reject(new Error(`请求超时: ${method}`));
			}
		}, TEST_CONFIG.timeout);
	});
}

// 处理响应
function handleMessage(message) {
	// 响应
	if (message.id !== undefined && pendingRequests.has(message.id)) {
		const { resolve, reject, method } = pendingRequests.get(message.id);
		pendingRequests.delete(message.id);

		if (message.error) {
			console.log(`✗ ${method} 失败:`, message.error);
			reject(new Error(message.error.message));
		} else {
			console.log(`✓ ${method} 成功`);
			console.log('   ', JSON.stringify(message.result, null, 2));
			resolve(message.result);
		}
	}
	// 通知
	else if (message.method) {
		console.log(`← 通知: ${message.method}`);
		if (message.params) {
			console.log('   ', JSON.stringify(message.params, null, 2).substring(0, 200));
		}
	}
}

// 测试流程
async function runTests() {
	try {
		// 等待进程启动
		await new Promise((resolve) => setTimeout(resolve, 2000));

		console.log('2. 测试 initialize...');
		const initResult = await sendRequest('initialize', {
			protocolVersion: 1,
			clientInfo: {
				name: 'obsidian-acp-test',
				version: '0.1.0',
			},
			clientCapabilities: {
				fs: {
					readTextFile: true,
					writeTextFile: true,
				},
			},
		});

		console.log('\n3. 测试 session/new...');
		const sessionResult = await sendRequest('session/new', {
			cwd: TEST_CONFIG.cwd,
			mcpServers: [],
		});

		const sessionId = sessionResult.sessionId;
		console.log(`   会话 ID: ${sessionId}`);

		console.log('\n4. 测试 session/prompt...');
		await sendRequest('session/prompt', {
			sessionId,
			prompt: [
				{
					type: 'text',
					text: '你好，请用一句话介绍你自己',
				},
			],
		});

		// 等待响应
		await new Promise((resolve) => setTimeout(resolve, 5000));

		console.log('\n✅ 所有测试通过！');
		child.kill();
		process.exit(0);
	} catch (error) {
		console.error('\n❌ 测试失败:', error.message);
		child.kill();
		process.exit(1);
	}
}

// 启动测试
runTests();
