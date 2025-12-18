/**
 * 在 Obsidian 开发者工具中运行此脚本
 *
 * 使用方法：
 * 1. 打开 Obsidian
 * 2. 按 Cmd+Opt+I 打开开发者工具
 * 3. 切换到 Console 标签
 * 4. 粘贴并运行此代码
 */

(async function debugClaudeSDK() {
	console.log('%c=== Claude SDK 调试 ===', 'color: blue; font-size: 16px; font-weight: bold');

	// 1. 检查环境
	console.log('\n%c1. 环境检查', 'color: green; font-weight: bold');
	console.log('  Node版本:', process.versions.node);
	console.log('  Electron版本:', process.versions.electron);
	console.log('  Chrome版本:', process.versions.chrome);
	console.log('  平台:', process.platform);
	console.log('  当前目录:', process.cwd());

	// 2. 检查模块
	console.log('\n%c2. 模块检查', 'color: green; font-weight: bold');
	try {
		const sdk = require('@anthropic-ai/claude-agent-sdk');
		console.log('  ✓ SDK已加载');
		console.log('  导出:', Object.keys(sdk));
	} catch (error) {
		console.error('  ✗ SDK加载失败:', error);
		return;
	}

	// 3. 检查插件
	console.log('\n%c3. 插件检查', 'color: green; font-weight: bold');
	const app = window.app;
	if (!app) {
		console.error('  ✗ app 对象不存在');
		return;
	}
	console.log('  ✓ app 对象存在');

	const plugin = app.plugins.plugins['obsidian-acp'];
	if (!plugin) {
		console.error('  ✗ ACP插件未加载');
		console.log('  已加载的插件:', Object.keys(app.plugins.plugins));
		return;
	}
	console.log('  ✓ ACP插件已加载');

	// 4. 检查工作目录
	console.log('\n%c4. 工作目录', 'color: green; font-weight: bold');
	try {
		const basePath = app.vault.adapter.basePath;
		console.log('  Vault路径:', basePath);
		console.log('  process.cwd():', process.cwd());
	} catch (error) {
		console.error('  ✗ 无法获取路径:', error);
	}

	// 5. 测试 SDK query
	console.log('\n%c5. SDK测试', 'color: green; font-weight: bold');
	try {
		const { query } = require('@anthropic-ai/claude-agent-sdk');
		const testQuery = query({
			prompt: 'test',
			options: {
				cwd: app.vault.adapter.basePath || process.cwd(),
				model: 'claude-sonnet-4-5-20250929',
				env: {
					ANTHROPIC_API_KEY: 'sk-test-key',
				},
			},
		});
		console.log('  ✓ query()调用成功');
		console.log('  返回对象:', testQuery);
		console.log('  是异步迭代器:', typeof testQuery[Symbol.asyncIterator] === 'function');

		// 立即中断
		if (typeof testQuery.interrupt === 'function') {
			await testQuery.interrupt();
			console.log('  ✓ interrupt()可用');
		}
	} catch (error) {
		console.error('  ✗ SDK测试失败:', error);
		console.error('  错误栈:', error.stack);
		return;
	}

	// 6. 检查子进程
	console.log('\n%c6. 子进程检查', 'color: green; font-weight: bold');
	try {
		const { execSync } = require('child_process');
		const result = execSync('echo test', { encoding: 'utf8', timeout: 5000 });
		console.log('  ✓ execSync可用');
		console.log('  测试输出:', result.trim());
	} catch (error) {
		console.error('  ✗ execSync失败:', error);
	}

	// 7. 检查API Key
	console.log('\n%c7. API Key检查', 'color: green; font-weight: bold');
	console.log('  插件设置中的Key:', plugin.settings.apiKey ? '已设置' : '未设置');
	console.log('  环境变量Key:', process.env.ANTHROPIC_API_KEY ? '已设置' : '未设置');

	console.log('\n%c=== 调试完成 ===', 'color: blue; font-size: 16px; font-weight: bold');
	console.log('请截图以上输出发给开发者');
})();
