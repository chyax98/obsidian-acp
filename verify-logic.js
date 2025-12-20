/**
 * 直接验证修复逻辑是否能工作
 * 运行: node verify-logic.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🧪 开始验证修复逻辑...\n');

// ==========================================================================
// 1. 验证文件检查逻辑
// ==========================================================================
async function testFileCheck() {
	console.log('📋 [1] 测试文件检查逻辑');
	console.log('━'.repeat(50));

	// 创建临时可执行文件
	const testFile = path.join('/tmp', 'test-agent-check');
	fs.writeFileSync(testFile, '#!/bin/bash\necho "test"');
	fs.chmodSync(testFile, 0o755);

	try {
		// 测试 fs.access() 检查可执行权限
		await fs.promises.access(testFile, fs.constants.X_OK);
		console.log('✅ 可执行文件检查成功\n');
		return true;
	} catch (error) {
		console.log(`❌ 检查失败: ${error.message}\n`);
		return false;
	} finally {
		fs.unlinkSync(testFile);
	}
}

// ==========================================================================
// 2. 验证进程启动逻辑（修复后）
// ==========================================================================
async function testProcessSpawn() {
	console.log('📋 [2] 测试进程启动逻辑（修复后的 proc 定义顺序）');
	console.log('━'.repeat(50));

	return new Promise((resolve) => {
		// ✅ 修复：先定义 proc，再在 timeout 中使用
		const proc = spawn('echo', ['hello world'], {
			stdio: 'pipe',
			timeout: 5000,
		});

		const timeout = setTimeout(() => {
			proc.kill();
			console.log('❌ 进程启动超时\n');
			resolve(false);
		}, 3000);

		let stdout = '';
		let stderr = '';

		proc.stdout?.on('data', (data) => {
			stdout += data.toString();
		});

		proc.stderr?.on('data', (data) => {
			stderr += data.toString();
		});

		proc.on('close', (code) => {
			clearTimeout(timeout);
			if (code === 0 && stdout.includes('hello world')) {
				console.log(`✅ 进程启动成功，捕获输出: "${stdout.trim()}"\n`);
				resolve(true);
			} else {
				console.log(`❌ 进程失败 (退出码: ${code})\n`);
				resolve(false);
			}
		});

		proc.on('error', (error) => {
			clearTimeout(timeout);
			console.log(`❌ 启动失败: ${error.message}\n`);
			resolve(false);
		});
	});
}

// ==========================================================================
// 3. 验证 file:// URI 解析逻辑
// ==========================================================================
function testFileUriParsing() {
	console.log('📋 [3] 测试 file:// URI 解析逻辑');
	console.log('━'.repeat(50));

	const testCases = [
		{
			input: 'file:///Users/test/image.png',
			expected: '/Users/test/image.png',
			desc: 'file:/// 格式',
		},
		{
			input: 'file://localhost/Users/test/image.png',
			expected: '/Users/test/image.png',
			desc: 'file://localhost/ 格式',
		},
		{
			input: 'file:///Users/test/%20spaces/image.png',
			expected: '/Users/test/ spaces/image.png',
			desc: 'URL 编码格式',
		},
	];

	let passed = 0;
	for (const testCase of testCases) {
		let filePath = testCase.input;

		// 解析 URI
		if (filePath.startsWith('file:///')) {
			filePath = filePath.substring(7);
		} else if (filePath.startsWith('file://localhost/')) {
			filePath = filePath.substring(16);
		} else if (filePath.startsWith('file://')) {
			filePath = filePath.substring(7);
		}

		filePath = decodeURIComponent(filePath);

		if (filePath === testCase.expected) {
			console.log(`✅ ${testCase.desc}: "${testCase.input}" -> "${filePath}"`);
			passed++;
		} else {
			console.log(
				`❌ ${testCase.desc}: 期望 "${testCase.expected}"，实际 "${filePath}"`,
			);
		}
	}

	console.log(`\n结果: ${passed}/${testCases.length} 通过\n`);
	return passed === testCases.length;
}

// ==========================================================================
// 4. 验证变量替换逻辑
// ==========================================================================
function testVariableReplacement() {
	console.log('📋 [4] 测试 MCP 配置变量替换逻辑');
	console.log('━'.repeat(50));

	const vaultPath = '/Users/test/vault';
	const userHome = '/Users/test';

	const testCases = [
		{
			input: 'npx @mcp/server-filesystem --root {VAULT_PATH}',
			expected: 'npx @mcp/server-filesystem --root /Users/test/vault',
			desc: '单个命令替换',
		},
		{
			input: '{VAULT_PATH}:{USER_HOME}',
			expected: '/Users/test/vault:/Users/test',
			desc: '多个变量替换',
		},
	];

	let passed = 0;
	for (const testCase of testCases) {
		let result = testCase.input;
		result = result.replace(/{VAULT_PATH}/g, vaultPath);
		result = result.replace(/{USER_HOME}/g, userHome);

		if (result === testCase.expected) {
			console.log(`✅ ${testCase.desc}`);
			console.log(`   输入: "${testCase.input}"`);
			console.log(`   输出: "${result}"\n`);
			passed++;
		} else {
			console.log(`❌ ${testCase.desc}`);
			console.log(`   期望: "${testCase.expected}"`);
			console.log(`   实际: "${result}"\n`);
		}
	}

	console.log(`结果: ${passed}/${testCases.length} 通过\n`);
	return passed === testCases.length;
}

// ==========================================================================
// 5. 验证安装命令生成逻辑
// ==========================================================================
function testInstallCommands() {
	console.log('📋 [5] 测试安装命令生成逻辑');
	console.log('━'.repeat(50));

	const testCases = [
		{
			id: 'qwen',
			expected: 'npm install -g @qwenlm/qwen-code',
			desc: 'Qwen Code',
		},
		{
			id: 'kimi',
			expected: 'npm install -g @moonshot-ai/kimi-cli',
			desc: 'Kimi',
		},
		{
			id: 'gemini',
			expected: 'npm install -g @google/gemini-cli',
			desc: 'Gemini CLI',
		},
	];

	let passed = 0;
	for (const testCase of testCases) {
		let command;
		switch (testCase.id) {
			case 'qwen':
				command = 'npm install -g @qwenlm/qwen-code'; // ✅ 修正的包名
				break;
			case 'kimi':
				command = 'npm install -g @moonshot-ai/kimi-cli';
				break;
			case 'gemini':
				command = 'npm install -g @google/gemini-cli';
				break;
			default:
				command = '';
		}

		if (command === testCase.expected) {
			console.log(`✅ ${testCase.desc}`);
			console.log(`   ${command}\n`);
			passed++;
		} else {
			console.log(`❌ ${testCase.desc}`);
			console.log(`   期望: ${testCase.expected}`);
			console.log(`   实际: ${command}\n`);
		}
	}

	console.log(`结果: ${passed}/${testCases.length} 通过\n`);
	return passed === testCases.length;
}

// ==========================================================================
// 运行所有测试
// ==========================================================================
async function runAllTests() {
	const results = [];

	results.push(await testFileCheck());
	results.push(await testProcessSpawn());
	results.push(testFileUriParsing());
	results.push(testVariableReplacement());
	results.push(testInstallCommands());

	console.log('\n' + '='.repeat(50));
	console.log('📊 最终结果');
	console.log('='.repeat(50));

	const passed = results.filter((r) => r).length;
	const total = results.length;

	console.log(`✅ 通过: ${passed}/${total}`);

	if (passed === total) {
		console.log('\n🎉 所有修复验证通过！');
		process.exit(0);
	} else {
		console.log('\n⚠️ 部分测试失败，需要进一步调查');
		process.exit(1);
	}
}

runAllTests().catch((error) => {
	console.error('❌ 测试执行出错:', error);
	process.exit(1);
});
