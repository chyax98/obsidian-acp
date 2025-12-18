#!/usr/bin/env node
/**
 * 完整的 ACP 连接测试（模拟真实流程）
 */

const { spawn } = require('child_process');
const readline = require('readline');

const backendId = process.argv[2] || 'kimi';
const cliPath = process.argv[3] || '/Users/Apple/.local/bin/kimi';
const args = ['--acp']; // kimi 的参数

console.log('\n🔍 完整 ACP 连接测试');
console.log(`Backend: ${backendId}`);
console.log(`命令: ${cliPath} ${args.join(' ')}\n`);

// 启动子进程
console.log('📌 步骤 1: 启动子进程...');
const child = spawn(cliPath, args, {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: process.cwd(),
});

let messageBuffer = '';
let requestId = 1;

// 处理 stdout（协议消息）
child.stdout.on('data', (data) => {
  messageBuffer += data.toString();

  // 按行分割
  const lines = messageBuffer.split('\n');
  messageBuffer = lines.pop() || ''; // 保留最后一个不完整的行

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const msg = JSON.parse(line);
      console.log('\n📨 收到消息:', JSON.stringify(msg, null, 2));

      // 处理响应
      if (msg.result) {
        handleResponse(msg);
      } else if (msg.error) {
        console.error('❌ 错误响应:', msg.error);
      }
    } catch (e) {
      console.warn('⚠️  非 JSON 行:', line);
    }
  }
});

// 处理 stderr
child.stderr.on('data', (data) => {
  console.error('📥 STDERR:', data.toString().trim());
});

// 处理进程错误
child.on('error', (error) => {
  console.error('\n❌ 进程错误:', error);
  process.exit(1);
});

// 处理进程退出
child.on('exit', (code, signal) => {
  console.log(`\n✅ 进程退出: code=${code}, signal=${signal}`);
  process.exit(code || 0);
});

// 发送 JSON-RPC 请求
function sendRequest(method, params) {
  const request = {
    jsonrpc: '2.0',
    id: requestId++,
    method,
    params,
  };

  console.log(`\n📤 发送请求: ${method}`);
  console.log(JSON.stringify(request, null, 2));

  child.stdin.write(JSON.stringify(request) + '\n');
}

// 处理响应并继续流程
function handleResponse(msg) {
  if (msg.id === 1) {
    // initialize 响应
    console.log('✅ 初始化成功！');
    console.log('📌 步骤 3: 创建会话...');
    setTimeout(() => {
      sendRequest('session/new', {
        cwd: process.cwd(), // 修正：使用 cwd 而不是 workingDirectory
        mcpServers: [], // 修正：添加必需的 mcpServers 字段
      });
    }, 500);
  } else if (msg.id === 2) {
    // newSession 响应
    const sessionId = msg.result?.sessionId;
    console.log(`✅ 会话创建成功！Session ID: ${sessionId}`);
    console.log('📌 步骤 4: 发送测试提示...');
    setTimeout(() => {
      sendRequest('session/prompt', {
        sessionId,
        content: [
          {
            type: 'text',
            text: '你好，请介绍一下你自己',
          },
        ],
      });
    }, 500);
  } else if (msg.id === 3) {
    // prompt 响应
    console.log('✅ 提示发送成功！');
    console.log('📌 等待 Agent 响应...');
  }
}

// 延迟 1 秒后开始测试
setTimeout(() => {
  console.log('📌 步骤 2: 发送 initialize 请求...');
  sendRequest('initialize', {
    protocolVersion: '1',
    clientInfo: {
      name: 'obsidian-acp-test',
      version: '0.1.0',
    },
    capabilities: {
      fs: {
        readTextFile: true,
        writeTextFile: true,
      },
    },
  });
}, 1000);

// 30 秒超时
setTimeout(() => {
  console.error('\n⏱️  超时: 30 秒内流程未完成');
  child.kill();
  process.exit(1);
}, 30000);

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n\n👋 中断');
  child.kill();
  process.exit(0);
});
