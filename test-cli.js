#!/usr/bin/env node
/**
 * CLI 测试脚本 - 用于调试 ACP 连接问题
 *
 * 使用方法：node test-cli.js [cli-name]
 * 例如：node test-cli.js claude
 */

const { spawn } = require('child_process');

const cliConfigs = {
  claude: {
    command: 'npx',
    args: ['@zed-industries/claude-code-acp', '--version'],
  },
  kimi: {
    command: '/Users/Apple/.local/bin/kimi',
    args: ['--version'],
  },
  codex: {
    command: 'codex',
    args: ['--version'],
  },
};

const cliName = process.argv[2] || 'claude';
const config = cliConfigs[cliName];

if (!config) {
  console.error(`❌ 未知的 CLI: ${cliName}`);
  console.log(`可用的 CLI: ${Object.keys(cliConfigs).join(', ')}`);
  process.exit(1);
}

console.log(`\n🔍 测试 ${cliName} CLI`);
console.log(`命令: ${config.command} ${config.args.join(' ')}\n`);

const child = spawn(config.command, config.args, {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env,
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => {
  const text = data.toString();
  stdout += text;
  console.log(`📤 STDOUT: ${text.trim()}`);
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  stderr += text;
  console.error(`📥 STDERR: ${text.trim()}`);
});

child.on('error', (error) => {
  console.error(`\n❌ 进程错误:`, error);
  console.error(`\n可能原因:`);
  console.error(`  1. CLI 未安装`);
  console.error(`  2. 路径错误`);
  console.error(`  3. 权限不足`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  console.log(`\n✅ 进程退出: code=${code}, signal=${signal}`);

  if (code === 0) {
    console.log(`\n✅ ${cliName} CLI 可用！`);
    if (stdout) {
      console.log(`版本信息: ${stdout.trim()}`);
    }
  } else {
    console.error(`\n❌ ${cliName} CLI 执行失败`);
    if (stderr) {
      console.error(`错误信息:\n${stderr}`);
    }
  }

  process.exit(code || 0);
});

// 5 秒超时
setTimeout(() => {
  console.error(`\n⏱️  超时: 5 秒内未响应`);
  child.kill();
  process.exit(1);
}, 5000);
