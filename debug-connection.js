#!/usr/bin/env node
/**
 * 调试 ACP 连接问题
 *
 * 用法：node debug-connection.js <backend-id> [cli-path]
 * 例如：node debug-connection.js kimi /Users/Apple/.local/bin/kimi
 */

const { spawn } = require('child_process');
const path = require('path');

// 后端配置
const BACKENDS = {
  kimi: {
    cmd: 'kimi',
    args: ['--acp'],
  },
  claude: {
    cmd: 'claude-code-acp',
    args: [],
  },
  codex: {
    cmd: 'codex',
    args: ['--experimental-acp'],
  },
};

const backendId = process.argv[2] || 'kimi';
const customPath = process.argv[3];

const backend = BACKENDS[backendId];
if (!backend) {
  console.error(`❌ 未知的 backend: ${backendId}`);
  console.log(`可用的 backend: ${Object.keys(BACKENDS).join(', ')}`);
  process.exit(1);
}

const cliPath = customPath || backend.cmd;

console.log('\n🔍 ACP 连接调试');
console.log(`Backend: ${backendId}`);
console.log(`命令: ${cliPath} ${backend.args.join(' ')}\n`);

// 启动子进程
const child = spawn(cliPath, backend.args, {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env,
  cwd: process.cwd(),
});

let stdoutBuffer = '';
let stderrBuffer = '';

child.stdout.on('data', (data) => {
  const text = data.toString();
  stdoutBuffer += text;
  console.log('📤 STDOUT:', text.trim());

  // 尝试解析 JSON-RPC
  const lines = stdoutBuffer.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (line) {
      try {
        const msg = JSON.parse(line);
        console.log('📨 JSON-RPC 消息:', JSON.stringify(msg, null, 2));
      } catch (e) {
        console.log('⚠️  非 JSON 输出:', line);
      }
    }
  }
  stdoutBuffer = lines[lines.length - 1];
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  stderrBuffer += text;
  console.error('📥 STDERR:', text.trim());
});

child.on('error', (error) => {
  console.error('\n❌ 进程错误:', error);
  console.error('\n可能原因:');
  console.error('  1. CLI 未安装或路径错误');
  console.error('  2. 权限不足');
  console.error('  3. 缺少依赖');
  process.exit(1);
});

child.on('exit', (code, signal) => {
  console.log(`\n✅ 进程退出: code=${code}, signal=${signal}`);

  if (code !== 0 && code !== null) {
    console.error('\n❌ 非正常退出');
    if (stderrBuffer) {
      console.error('\n完整 STDERR:');
      console.error(stderrBuffer);
    }
  }

  process.exit(code || 0);
});

// 5 秒后发送初始化请求
setTimeout(() => {
  console.log('\n📤 发送 initialize 请求...');

  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      clientInfo: {
        name: 'debug-client',
        version: '1.0.0',
      },
      capabilities: {},
    },
  };

  child.stdin.write(JSON.stringify(initRequest) + '\n');
}, 1000);

// 10 秒超时
setTimeout(() => {
  console.error('\n⏱️  超时: 10 秒内未收到响应');
  console.error('\n可能原因:');
  console.error('  1. CLI 不支持 ACP 协议');
  console.error('  2. 需要额外的参数或配置');
  console.error('  3. 需要认证');
  child.kill();
  process.exit(1);
}, 10000);

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n\n👋 中断，清理资源...');
  child.kill();
  process.exit(0);
});
