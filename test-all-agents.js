#!/usr/bin/env node
/**
 * Phase 6: 完整 Agent 测试套件
 *
 * 测试所有 Agent 的完整流程：
 * 1. Kimi (最稳定，优先测试)
 * 2. Claude (通过 npx @zed-industries/claude-code-acp)
 * 3. Codex (如果可用)
 */

const { spawn } = require('child_process');
const { execSync } = require('child_process');

// ============================================================================
// 测试配置
// ============================================================================

const AGENTS_TO_TEST = [
	{
		name: 'Kimi',
		id: 'kimi',
		command: 'kimi',
		args: ['--acp'],
		enabled: true,
	},
	{
		name: 'Claude Code',
		id: 'claude',
		command: 'npx',
		args: ['@zed-industries/claude-code-acp'],
		enabled: true,
	},
	{
		name: 'Codex',
		id: 'codex',
		command: 'codex',
		args: [],
		enabled: false, // 根据安装情况启用
	},
];

const TEST_TIMEOUT = 30000; // 30秒

// ============================================================================
// Agent 测试类
// ============================================================================

class AgentTester {
	constructor(config) {
		this.config = config;
		this.child = null;
		this.messageBuffer = '';
		this.requestId = 0;
		this.pendingRequests = new Map();
		this.sessionId = null;
		this.testResults = {
			name: config.name,
			id: config.id,
			passed: [],
			failed: [],
			duration: 0,
		};
	}

	async runTests() {
		const startTime = Date.now();
		console.log('\n' + '='.repeat(60));
		console.log(`测试 Agent: ${this.config.name}`);
		console.log('='.repeat(60));

		try {
			// 1. 启动进程
			await this.startProcess();
			this.testResults.passed.push('启动进程');

			// 2. 测试 initialize
			await this.testInitialize();
			this.testResults.passed.push('initialize 协议');

			// 3. 测试 session/new
			await this.testSessionNew();
			this.testResults.passed.push('session/new 创建会话');

			// 4. 测试 session/prompt
			await this.testSessionPrompt();
			this.testResults.passed.push('session/prompt 发送消息');

			// 5. 等待响应
			await new Promise((resolve) => setTimeout(resolve, 3000));

			console.log(`\n✅ ${this.config.name} 所有测试通过！`);
		} catch (error) {
			console.error(`\n❌ ${this.config.name} 测试失败:`, error.message);
			this.testResults.failed.push(error.message);
		} finally {
			this.cleanup();
			this.testResults.duration = Date.now() - startTime;
		}

		return this.testResults;
	}

	async startProcess() {
		console.log(`\n1. 启动进程: ${this.config.command} ${this.config.args.join(' ')}`);

		this.child = spawn(this.config.command, this.config.args, {
			cwd: process.cwd(),
			stdio: ['pipe', 'pipe', 'pipe'],
			env: process.env,
		});

		// 监听输出
		this.child.stdout.on('data', (data) => this.handleStdout(data));
		this.child.stderr.on('data', (data) => {
			console.log(`   [STDERR] ${data.toString().trim()}`);
		});

		// 监听退出
		this.child.on('exit', (code, signal) => {
			console.log(`   进程退出: code=${code}, signal=${signal}`);
		});

		// 等待启动
		await new Promise((resolve) => setTimeout(resolve, 2000));

		if (!this.child || this.child.killed) {
			throw new Error('进程启动失败');
		}

		console.log('   ✓ 进程启动成功');
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
				console.log(`   ✓ ${method} 成功`);
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
			const id = ++this.requestId;
			const request = {
				jsonrpc: '2.0',
				id,
				method,
				params,
			};

			this.pendingRequests.set(id, { resolve, reject, method });

			const message = JSON.stringify(request) + '\n';
			this.child.stdin.write(message);

			setTimeout(() => {
				if (this.pendingRequests.has(id)) {
					this.pendingRequests.delete(id);
					reject(new Error(`请求超时: ${method}`));
				}
			}, TEST_TIMEOUT);
		});
	}

	async testInitialize() {
		console.log('\n2. 测试 initialize...');
		const result = await this.sendRequest('initialize', {
			protocolVersion: 1, // 数字类型
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
		console.log(`   协议版本: ${result.protocolVersion}`);
	}

	async testSessionNew() {
		console.log('\n3. 测试 session/new...');
		const result = await this.sendRequest('session/new', {
			cwd: process.cwd(),
			mcpServers: [],
		});
		this.sessionId = result.sessionId;
		console.log(`   会话 ID: ${this.sessionId}`);
	}

	async testSessionPrompt() {
		console.log('\n4. 测试 session/prompt...');
		await this.sendRequest('session/prompt', {
			sessionId: this.sessionId,
			prompt: [
				{
					type: 'text',
					text: '你好，请用一句话介绍你自己',
				},
			],
		});
		console.log('   ✓ 消息已发送');
	}

	cleanup() {
		if (this.child && !this.child.killed) {
			this.child.kill();
		}
	}
}

// ============================================================================
// 主测试流程
// ============================================================================

async function runAllTests() {
	console.log('\n' + '='.repeat(60));
	console.log('Obsidian ACP - Phase 6: 完整 Agent 测试');
	console.log('='.repeat(60));

	// 检测可用的 Agent
	console.log('\n检测可用 Agent...');
	for (const agent of AGENTS_TO_TEST) {
		if (!agent.enabled) {
			console.log(`  ${agent.name}: 已禁用`);
			continue;
		}

		try {
			const whichCommand = process.platform === 'win32' ? 'where' : 'which';
			const cmd = agent.id === 'claude' ? 'npx' : agent.command;
			execSync(`${whichCommand} ${cmd}`, { stdio: 'pipe' });
			console.log(`  ${agent.name}: ✓ 可用`);
		} catch (error) {
			console.log(`  ${agent.name}: ✗ 未安装`);
			agent.enabled = false;
		}
	}

	// 运行测试
	const results = [];
	for (const agent of AGENTS_TO_TEST) {
		if (!agent.enabled) continue;

		const tester = new AgentTester(agent);
		const result = await tester.runTests();
		results.push(result);

		// 等待下一个测试
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}

	// 总结
	console.log('\n' + '='.repeat(60));
	console.log('测试总结');
	console.log('='.repeat(60));

	for (const result of results) {
		console.log(`\n${result.name}:`);
		console.log(`  通过: ${result.passed.length} 个测试`);
		console.log(`  失败: ${result.failed.length} 个测试`);
		console.log(`  耗时: ${(result.duration / 1000).toFixed(2)}s`);

		if (result.passed.length > 0) {
			console.log('  通过的测试:');
			for (const test of result.passed) {
				console.log(`    ✓ ${test}`);
			}
		}

		if (result.failed.length > 0) {
			console.log('  失败的测试:');
			for (const test of result.failed) {
				console.log(`    ✗ ${test}`);
			}
		}
	}

	// 总计
	const totalPassed = results.reduce((sum, r) => sum + r.passed.length, 0);
	const totalFailed = results.reduce((sum, r) => sum + r.failed.length, 0);
	const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

	console.log('\n总计:');
	console.log(`  通过: ${totalPassed}/${totalPassed + totalFailed}`);
	console.log(`  总耗时: ${(totalDuration / 1000).toFixed(2)}s`);

	// 退出码
	process.exit(totalFailed > 0 ? 1 : 0);
}

// 运行测试
runAllTests().catch((error) => {
	console.error('测试运行失败:', error);
	process.exit(1);
});
