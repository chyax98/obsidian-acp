#!/usr/bin/env node
/**
 * 诊断脚本 - 检查环境和依赖
 */

console.log('='.repeat(60));
console.log('环境诊断');
console.log('='.repeat(60));

// 1. Node 版本
console.log('\n1. Node.js 版本:');
console.log('  ', process.version);

// 2. 平台信息
console.log('\n2. 平台:');
console.log('   系统:', process.platform);
console.log('   架构:', process.arch);

// 3. 工作目录
console.log('\n3. 当前目录:');
console.log('  ', process.cwd());

// 4. 检查 SDK 是否存在
console.log('\n4. SDK 安装检查:');
try {
	const sdk = require('@anthropic-ai/claude-agent-sdk');
	console.log('   ✓ SDK 模块已加载');
	console.log('   导出函数:', Object.keys(sdk).join(', '));
} catch (error) {
	console.log('   ✗ SDK 加载失败:', error.message);
}

// 5. 检查 SDK 的依赖
console.log('\n5. SDK 依赖检查:');
try {
	const pkgPath = require.resolve('@anthropic-ai/claude-agent-sdk/package.json');
	const pkg = require(pkgPath);
	console.log('   版本:', pkg.version);
	console.log('   依赖:', Object.keys(pkg.dependencies || {}).length, '个');
	if (pkg.dependencies) {
		Object.keys(pkg.dependencies).slice(0, 5).forEach(dep => {
			console.log('     -', dep, ':', pkg.dependencies[dep]);
		});
	}
} catch (error) {
	console.log('   ✗ 无法读取 package.json:', error.message);
}

// 6. 尝试导入并调用 query
console.log('\n6. SDK 功能测试:');
try {
	const { query } = require('@anthropic-ai/claude-agent-sdk');
	console.log('   ✓ query 函数已导入');
	console.log('   类型:', typeof query);

	// 尝试调用（不需要 API Key，只是看能否创建）
	try {
		const q = query({
			prompt: 'test',
			options: {
				cwd: process.cwd(),
				model: 'claude-sonnet-4-5-20250929',
				env: {
					ANTHROPIC_API_KEY: 'test-key-for-validation',
				},
			},
		});
		console.log('   ✓ query() 可以调用');
		console.log('   返回类型:', typeof q);
		console.log('   是否是异步迭代器:', typeof q[Symbol.asyncIterator] === 'function' ? '是' : '否');

		// 立即中断，不真正执行
		if (typeof q.interrupt === 'function') {
			q.interrupt();
			console.log('   ✓ interrupt() 方法存在');
		}
	} catch (innerError) {
		console.log('   ✗ query() 调用失败:', innerError.message);
		console.log('   错误堆栈:', innerError.stack);
	}
} catch (error) {
	console.log('   ✗ 导入失败:', error.message);
}

// 7. Electron 环境检测
console.log('\n7. Electron 环境:');
if (process.versions.electron) {
	console.log('   ✓ 在 Electron 中运行');
	console.log('   Electron 版本:', process.versions.electron);
	console.log('   Chrome 版本:', process.versions.chrome);
} else {
	console.log('   ✗ 不在 Electron 中（纯 Node.js）');
}

// 8. 子进程支持
console.log('\n8. 子进程支持:');
try {
	const { execSync } = require('child_process');
	const result = execSync('echo test', { encoding: 'utf8' });
	console.log('   ✓ execSync 可用');
	console.log('   测试输出:', result.trim());
} catch (error) {
	console.log('   ✗ execSync 不可用:', error.message);
}

console.log('\n' + '='.repeat(60));
console.log('诊断完成');
console.log('='.repeat(60));
