#!/usr/bin/env node
/**
 * 独立 ACP 测试脚本
 *
 * 验证 ACP 连接逻辑，不依赖 Obsidian 环境
 */

const { spawn } = require('child_process');

// ============================================================================
// 测试配置
// ============================================================================

const TEST_TIMEOUT = 30000;
const WORKING_DIR = process.cwd();

// ============================================================================
// JSON-RPC 工具
// ============================================================================

let requestId = 0;

function createRequest(method, params) {
	return {
		jsonrpc: '2.0',
		id: ++requestId,
		method,
		...(params !== undefined && { params }),
	};
}

// ============================================================================
// 测试类
// ============================================================================

class AcpTester {
	constructor() {
		this.child = null;
		this.messageBuffer = '';
		this.pendingRequests = new Map();
	}

	async runTest() {
		console.log('\n' + '='.repeat(60));
		console.log('ACP 独立测试');
		console.log('='.repeat(60));
		console.log(`工作目录: ${WORKING_DIR}`);

		try {
			// 1. 启动进程 - 关键：shell 必须是 false！
			await this.startProcess();
			console.log('✓ 进程启动成功');

			// 2. 测试 initialize
			const initResult = await this.testInitialize();
			console.log('✓ initialize 成功, protocolVersion:', initResult.protocolVersion);

			// 3. 测试 session/new
			const sessionResult = await this.testSessionNew();
			console.log('✓ session/new 成功, sessionId:', sessionResult.sessionId);

			// 4. 测试 session/prompt
			await this.testSessionPrompt(sessionResult.sessionId);
			console.log('✓ session/prompt 成功');

			// 5. 等待响应
			console.log('\n等待响应 (5秒)...');
			await new Promise(resolve => setTimeout(resolve, 5000));

			console.log('\n✅ 所有测试通过！');
			return true;
		} catch (error) {
			console.error('\n❌ 测试失败:', error.message);
			return false;
		} finally {
			this.cleanup();
		}
	}

	async startProcess() {
		console.log('\n1. 启动 ACP 进程...');

		// 关键配置：
		// - command: npx
		// - args: ['@zed-industries/claude-code-acp'] (不要添加其他参数)
		// - shell: false (macOS 上必须是 false！)
		const command = 'npx';
		const args = ['@zed-industries/claude-code-acp'];
		const options = {
			cwd: WORKING_DIR,
			stdio: ['pipe', 'pipe', 'pipe'],
			env: process.env,
			shell: false,  // 关键！
		};

		console.log(`   命令: ${command} ${args.join(' ')}`);
		console.log(`   shell: ${options.shell}`);
		console.log(`   工作目录: ${options.cwd}`);

		this.child = spawn(command, args, options);

		// 监听输出
		this.child.stdout.on('data', (data) => this.handleStdout(data));
		this.child.stderr.on('data', (data) => {
			const stderr = data.toString().trim();
			if (stderr) {
				console.log(`   [STDERR] ${stderr}`);
			}
		});

		// 监听错误
		this.child.on('error', (error) => {
			console.error('   [ERROR] 进程错误:', error.message);
		});

		// 监听退出
		this.child.on('exit', (code, signal) => {
			console.log(`   [EXIT] code=${code}, signal=${signal}`);
		});

		// 等待启动
		await new Promise(resolve => setTimeout(resolve, 2000));

		if (!this.child || this.child.killed) {
			throw new Error('进程启动失败或立即退出');
		}
	}

	handleStdout(data) {
		const dataStr = data.toString();
		this.messageBuffer += dataStr;

		const lines = this.messageBuffer.split('\n');
		this.messageBuffer = lines.pop() || '';

		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed) {
				try {
					const message = JSON.parse(trimmed);
					this.handleMessage(message);
				} catch (error) {
					// 忽略非 JSON
				}
			}
		}
	}

	handleMessage(message) {
		// 响应
		if (message.id !== undefined && this.pendingRequests.has(message.id)) {
			const { resolve, reject, method } = this.pendingRequests.get(message.id);
			this.pendingRequests.delete(message.id);

			if (message.error) {
				console.log(`   ✗ ${method} 失败:`, JSON.stringify(message.error));
				reject(new Error(message.error.message || '未知错误'));
			} else {
				console.log(`   ✓ ${method} 响应收到`);
				resolve(message.result);
			}
		}
		// 通知
		else if (message.method) {
			console.log(`   ← 通知: ${message.method}`);
		}
	}

	sendRequest(method, params) {
		return new Promise((resolve, reject) => {
			const request = createRequest(method, params);

			this.pendingRequests.set(request.id, { resolve, reject, method });

			const message = JSON.stringify(request) + '\n';
			console.log(`   → 发送: ${method}`);
			this.child.stdin.write(message);

			setTimeout(() => {
				if (this.pendingRequests.has(request.id)) {
					this.pendingRequests.delete(request.id);
					reject(new Error(`请求超时: ${method}`));
				}
			}, TEST_TIMEOUT);
		});
	}

	async testInitialize() {
		console.log('\n2. 测试 initialize...');
		return await this.sendRequest('initialize', {
			protocolVersion: 1,  // 数字！
			clientInfo: {
				name: 'acp-standalone-test',
				version: '1.0.0',
			},
			capabilities: {
				fs: {
					readTextFile: true,
					writeTextFile: true,
				},
			},
		});
	}

	async testSessionNew() {
		console.log('\n3. 测试 session/new...');
		return await this.sendRequest('session/new', {
			cwd: WORKING_DIR,
			mcpServers: [],
		});
	}

	async testSessionPrompt(sessionId) {
		console.log('\n4. 测试 session/prompt...');
		return await this.sendRequest('session/prompt', {
			sessionId: sessionId,
			prompt: [
				{
					type: 'text',
					text: '你好',
				},
			],
		});
	}

	cleanup() {
		if (this.child && !this.child.killed) {
			this.child.kill();
			console.log('\n进程已终止');
		}
	}
}

// ============================================================================
// 运行测试
// ============================================================================

const tester = new AcpTester();
tester.runTest().then(success => {
	process.exit(success ? 0 : 1);
}).catch(error => {
	console.error('测试运行失败:', error);
	process.exit(1);
});
