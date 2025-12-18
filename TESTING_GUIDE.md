# Claude Agent SDK 实现测试与验证指南

## 快速测试矩阵

| 功能 | 测试方式 | 期望结果 |
|------|--------|--------|
| 基础对话 | 发送文本提示 | 接收文本回复 |
| 流式消息 | 发送长提示 | 实时接收 text_delta |
| 工具调用 | 要求执行操作 | 接收 tool_use 事件 |
| 权限请求 | 在 bypassPermissions=false 时调用工具 | 收到 requestPermission 回调 |
| 图像处理 | 上传图像 | 接收 image content block |
| 多会话 | 同时创建多个会话 | 独立处理，互不影响 |
| 会话取消 | 发送 cancel 命令 | Query 中断，返回 cancelled |

---

## 单元测试示例

### 测试1: Query 基础功能

```typescript
import { describe, it, expect } from "vitest";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { Pushable } from "./utils.js";

describe("Query", () => {
  it("should iterate over messages", async () => {
    const input = new Pushable<SDKUserMessage>();

    const q = query({
      prompt: input,
      options: {
        cwd: process.cwd(),
        systemPrompt: { type: "preset", preset: "claude_code" },
      },
    });

    // 推送消息
    input.push({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text: "Say hello" }],
      },
      session_id: "test-session",
      parent_tool_use_id: null,
    });

    // 收集消息
    const messages = [];
    for await (const msg of q) {
      messages.push(msg);
      if (msg.type === "result") break;
    }

    // 验证
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some((m) => m.type === "stream_event")).toBe(true);
    expect(messages.some((m) => m.type === "result")).toBe(true);
  });

  it("should handle interruption", async () => {
    const input = new Pushable<SDKUserMessage>();

    const q = query({
      prompt: input,
      options: {
        cwd: process.cwd(),
      },
    });

    input.push({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text: "Think deeply about this problem..." }],
      },
      session_id: "test-session",
      parent_tool_use_id: null,
    });

    // 中断
    setTimeout(() => q.interrupt(), 100);

    const result = await q.next();
    expect(result.done).toBe(true);
  });
});
```

### 测试2: 权限检查

```typescript
describe("Permission Check", () => {
  it("should call canUseTool for tool execution", async () => {
    let toolCallCount = 0;

    const input = new Pushable<SDKUserMessage>();

    const q = query({
      prompt: input,
      options: {
        cwd: process.cwd(),
        canUseTool: async (toolName) => {
          toolCallCount++;
          return { behavior: "allow" };
        },
      },
    });

    input.push({
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "text",
            text: "Please create a file called test.txt with content 'hello'",
          },
        ],
      },
      session_id: "test-session",
      parent_tool_use_id: null,
    });

    for await (const msg of q) {
      if (msg.type === "result") break;
    }

    expect(toolCallCount).toBeGreaterThan(0);
  });

  it("should deny tool execution when permission denied", async () => {
    const input = new Pushable<SDKUserMessage>();

    const q = query({
      prompt: input,
      options: {
        cwd: process.cwd(),
        canUseTool: async (toolName) => {
          if (toolName === "Bash") {
            return {
              behavior: "deny",
              message: "Bash not allowed",
              interrupt: true,
            };
          }
          return { behavior: "allow" };
        },
      },
    });

    input.push({
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "text",
            text: "Please run 'ls' command",
          },
        ],
      },
      session_id: "test-session",
      parent_tool_use_id: null,
    });

    let interrupted = false;
    for await (const msg of q) {
      if (msg.type === "result") {
        // 应该以错误结束
        if (msg.subtype === "error_during_execution") {
          interrupted = true;
        }
        break;
      }
    }

    expect(interrupted).toBe(true);
  });
});
```

### 测试3: 消息类型处理

```typescript
describe("Message Types", () => {
  it("should handle stream events", async () => {
    const input = new Pushable<SDKUserMessage>();

    const q = query({
      prompt: input,
      options: {
        cwd: process.cwd(),
        includePartialMessages: true,
      },
    });

    input.push({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text: "Write a haiku" }],
      },
      session_id: "test-session",
      parent_tool_use_id: null,
    });

    const streamEvents = [];
    for await (const msg of q) {
      if (msg.type === "stream_event") {
        streamEvents.push(msg.event.type);
      }
      if (msg.type === "result") break;
    }

    // 应该有 content_block 事件
    expect(streamEvents).toContain("content_block_start");
    expect(streamEvents).toContain("content_block_delta");
  });

  it("should handle tool calls", async () => {
    const input = new Pushable<SDKUserMessage>();

    const q = query({
      prompt: input,
      options: {
        cwd: process.cwd(),
        canUseTool: async () => ({ behavior: "allow" }),
      },
    });

    input.push({
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "text",
            text: "Please read the file package.json",
          },
        ],
      },
      session_id: "test-session",
      parent_tool_use_id: null,
    });

    let sawToolUse = false;
    for await (const msg of q) {
      if (msg.type === "stream_event") {
        if (msg.event.type === "content_block_start") {
          if (msg.event.content_block.type === "tool_use") {
            sawToolUse = true;
          }
        }
      }
      if (msg.type === "result") break;
    }

    expect(sawToolUse).toBe(true);
  });
});
```

---

## 集成测试

### 设置测试环境

```typescript
// setup.ts
import { beforeAll, afterAll } from "vitest";

beforeAll(() => {
  // 确保 ANTHROPIC_API_KEY 被设置
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }
});

afterAll(() => {
  // 清理
});
```

### 完整流程测试

```typescript
describe("Complete Flow", () => {
  it("should handle a complete conversation", async () => {
    const sessionId = randomUUID();
    const input = new Pushable<SDKUserMessage>();
    const toolUseCache: ToolUseCache = {};
    const messages: any[] = [];

    const q = query({
      prompt: input,
      options: {
        cwd: process.cwd(),
        includePartialMessages: true,
        canUseTool: async () => ({ behavior: "allow" }),
      },
    });

    // 第一轮: 询问文件列表
    input.push({
      type: "user",
      message: {
        role: "user",
        content: [
          {
            type: "text",
            text: "What files are in the current directory?",
          },
        ],
      },
      session_id: sessionId,
      parent_tool_use_id: null,
    });

    let turn1Complete = false;
    for await (const msg of q) {
      messages.push(msg);

      if (msg.type === "stream_event") {
        if (msg.event.type === "content_block_start" && msg.event.content_block.type === "tool_use") {
          toolUseCache[msg.event.content_block.id] = msg.event.content_block;
        }
      }

      if (msg.type === "result") {
        turn1Complete = true;
        break;
      }
    }

    expect(turn1Complete).toBe(true);
    expect(messages.length).toBeGreaterThan(0);
    expect(Object.keys(toolUseCache).length).toBeGreaterThan(0);
  });

  it("should handle multi-turn conversation", async () => {
    const sessionId = randomUUID();
    const input = new Pushable<SDKUserMessage>();

    const q = query({
      prompt: input,
      options: {
        cwd: process.cwd(),
      },
    });

    // 第一条消息
    input.push({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text: "Hello, what can you do?" }],
      },
      session_id: sessionId,
      parent_tool_use_id: null,
    });

    let firstTurnComplete = false;
    for await (const msg of q) {
      if (msg.type === "result" && msg.subtype === "success") {
        firstTurnComplete = true;
        break;
      }
    }

    expect(firstTurnComplete).toBe(true);

    // 第二条消息 (推送到同一个 Query 对象)
    input.push({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text: "Can you help me with coding?" }],
      },
      session_id: sessionId,
      parent_tool_use_id: null,
    });

    let secondTurnComplete = false;
    for await (const msg of q) {
      if (msg.type === "result" && msg.subtype === "success") {
        secondTurnComplete = true;
        break;
      }
    }

    expect(secondTurnComplete).toBe(true);
  });
});
```

---

## 手动测试清单

### 基础功能测试

- [ ] 启动代理
- [ ] 创建新会话
- [ ] 发送简单文本提示
- [ ] 接收文本回复
- [ ] 关闭会话

### 流式功能测试

- [ ] 发送需要思考的提示
- [ ] 观察实时 text_delta 更新
- [ ] 计算首字节时间 (TTFT)
- [ ] 验证最终消息与流式消息一致

### 工具调用测试

- [ ] 请求读取文件
- [ ] 验证 tool_use 事件
- [ ] 验证 tool_result 事件
- [ ] 检查文件内容是否正确

### 权限测试

- [ ] 设置权限模式为 `default`
- [ ] 尝试调用工具
- [ ] 验证 requestPermission 被调用
- [ ] 接受/拒绝权限
- [ ] 验证相应的行为

### 多会话测试

- [ ] 同时创建 3 个会话
- [ ] 在所有会话中发送提示
- [ ] 验证消息路由正确
- [ ] 验证会话相互独立
- [ ] 关闭一个会话，其他会话继续工作

### 错误处理测试

- [ ] 发送无效参数
- [ ] 验证错误消息
- [ ] 尝试访问不存在的会话
- [ ] 验证适当的错误响应

---

## 性能测试

### 吞吐量测试

```typescript
async function throughputTest() {
  const startTime = Date.now();
  const sessionCount = 10;
  const promptsPerSession = 5;

  const promises = [];

  for (let i = 0; i < sessionCount; i++) {
    const input = new Pushable<SDKUserMessage>();
    const q = query({
      prompt: input,
      options: { cwd: process.cwd() },
    });

    const sessionPromises = [];
    for (let j = 0; j < promptsPerSession; j++) {
      input.push({
        type: "user",
        message: {
          role: "user",
          content: [{ type: "text", text: `Prompt ${j}` }],
        },
        session_id: `session-${i}`,
        parent_tool_use_id: null,
      });

      sessionPromises.push(
        (async () => {
          for await (const msg of q) {
            if (msg.type === "result") break;
          }
        })()
      );
    }

    promises.push(Promise.all(sessionPromises));
  }

  await Promise.all(promises);
  const elapsed = Date.now() - startTime;

  console.log(`Completed ${sessionCount * promptsPerSession} prompts in ${elapsed}ms`);
  console.log(`Average: ${elapsed / (sessionCount * promptsPerSession)}ms per prompt`);
}
```

### 内存使用测试

```typescript
async function memoryTest() {
  const initial = process.memoryUsage();

  const sessions = [];
  for (let i = 0; i < 100; i++) {
    const input = new Pushable<SDKUserMessage>();
    const q = query({
      prompt: input,
      options: { cwd: process.cwd() },
    });
    sessions.push({ input, q });
  }

  const afterCreate = process.memoryUsage();

  // 清理
  sessions.length = 0;

  const afterCleanup = process.memoryUsage();

  console.log("Memory Usage:");
  console.log(`Initial: ${Math.round(initial.heapUsed / 1024 / 1024)}MB`);
  console.log(`After creating 100 sessions: ${Math.round(afterCreate.heapUsed / 1024 / 1024)}MB`);
  console.log(`After cleanup: ${Math.round(afterCleanup.heapUsed / 1024 / 1024)}MB`);
}
```

---

## 调试技巧

### 启用详细日志

```bash
DEBUG=* npm run dev
```

### 追踪消息

```typescript
for await (const message of query) {
  console.error(`[${new Date().toISOString()}] Message type: ${message.type}`);

  if (message.type === "stream_event") {
    console.error(`  Event: ${message.event.type}`);
  }

  if (message.type === "result") {
    console.error(`  Result subtype: ${message.subtype}`);
  }
}
```

### 追踪工具调用

```typescript
if (message.type === "stream_event") {
  if (message.event.type === "content_block_start") {
    const cb = message.event.content_block;
    if (cb.type === "tool_use") {
      console.error(`Tool called: ${cb.name}`, JSON.stringify(cb.input, null, 2));
    }
  }
}
```

### 监控权限检查

```typescript
canUseTool(sessionId: string): CanUseTool {
  return async (toolName, toolInput, options) => {
    console.error(`Permission check: ${toolName}`);
    console.error(`  Input:`, JSON.stringify(toolInput, null, 2));
    console.error(`  Signal aborted:`, options.signal.aborted);

    // ... 执行检查 ...

    console.error(`  Decision: ${decision.behavior}`);
    return decision;
  };
}
```

---

## 验证清单

在部署前验证：

- [ ] 所有消息类型都被正确处理
- [ ] 流式事件被实时发送
- [ ] 工具调用被正确追踪
- [ ] 权限检查正常工作
- [ ] 错误被正确捕获和报告
- [ ] 会话正确隔离
- [ ] 资源被正确清理
- [ ] 日志不输出到 stdout
- [ ] 支持所有权限模式
- [ ] 支持多个 MCP 服务器
- [ ] 支持会话恢复/分支
- [ ] 性能满足要求 (< 1s TTFT)
