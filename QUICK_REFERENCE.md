# Claude Agent SDK 快速参考卡

## SDK 核心 API

### query() 函数

```typescript
const q = query({
  prompt: Pushable<SDKUserMessage>,  // 必需：输入流
  options: Options,                   // 必需：配置选项
});

// 返回异步迭代器，产生这些消息类型：
// - SystemMessage
// - ResultMessage
// - StreamEventMessage
// - UserMessage
// - AssistantMessage
// - ToolProgressMessage
// - AuthStatusMessage
```

### Pushable 类

```typescript
const input = new Pushable<SDKUserMessage>();

input.push({
  type: "user",
  message: { role: "user", content: [...] },
  session_id: sessionId,
  parent_tool_use_id: null,
});

// 迭代
for await (const item of input) { /* ... */ }

// 或
const { value, done } = await input[Symbol.asyncIterator]().next();
```

### Options 类型

```typescript
interface Options {
  // 必需
  cwd: string;                        // 工作目录

  // 权限
  permissionMode?: PermissionMode;    // default|acceptEdits|bypassPermissions|dontAsk|plan
  canUseTool?: CanUseTool;            // 权限检查回调

  // 系统提示
  systemPrompt?: {
    type: "preset" | "string";
    preset?: "claude_code";
    append?: string;
  } | string;

  // 工具
  mcpServers?: Record<string, McpServerConfig>;
  allowedTools?: string[];
  disallowedTools?: string[];

  // 行为
  includePartialMessages?: boolean;   // 包含流式消息
  allowDangerouslySkipPermissions?: boolean;

  // 其他
  settingSources?: ("user" | "project" | "local")[];
  stderr?: (err: string) => void;
  hooks?: {
    PreToolUse?: HookConfig[];
    PostToolUse?: HookConfig[];
  };
  extraArgs?: Record<string, string>;
  executable?: string;
  pathToClaudeCodeExecutable?: string;
}
```

### CanUseTool 回调类型

```typescript
type CanUseTool = (
  toolName: string,
  toolInput: any,
  options: {
    signal: AbortSignal;
    suggestions?: Permission[];
    toolUseID: string;
  }
) => Promise<CanUseToolResponse>;

type CanUseToolResponse = {
  behavior: "allow" | "deny";
  message?: string;
  interrupt?: boolean;
  updatedInput?: any;
  updatedPermissions?: Permission[];
};
```

### PermissionMode 类型

| 模式 | 行为 | 用途 |
|------|------|------|
| `default` | 询问用户每个操作 | 完全控制 |
| `acceptEdits` | 自动接受编辑 (Edit/Write) | 快速编辑 |
| `bypassPermissions` | 跳过所有权限检查 | 快速原型 |
| `dontAsk` | 预先批准或拒绝 | 自动化 |
| `plan` | 不执行任何工具 | 仅规划 |

---

## 消息类型

### SystemMessage

```typescript
{
  type: "system";
  subtype: "init" | "compact_boundary" | "hook_response" | "status";
  // 其他字段取决于 subtype
}
```

### ResultMessage

```typescript
{
  type: "result";
  subtype: "success" | "error_during_execution" | "error_max_turns" |
           "error_max_budget_usd" | "error_max_structured_output_retries";
  is_error?: boolean;
  result?: string;
  errors?: string[];
}
```

### StreamEventMessage

```typescript
{
  type: "stream_event";
  event: {
    type: "message_start" | "message_delta" | "message_stop" |
          "content_block_start" | "content_block_delta" | "content_block_stop";
    // 其他字段
  };
}
```

### ContentBlock 类型

```typescript
// content_block_start event
{
  type: "text" | "thinking" | "tool_use" | "image" | ...;
  text?: string;           // 对于 text
  thinking?: string;       // 对于 thinking
  id?: string;            // 对于 tool_use
  name?: string;          // 对于 tool_use (工具名)
  input?: any;            // 对于 tool_use (工具参数)
}

// content_block_delta event
{
  type: "text_delta" | "thinking_delta" | "input_json_delta";
  text?: string;
  thinking?: string;
  partial_json?: string;
}
```

---

## Query 交互

### 迭代消息

```typescript
// 方法1: for-await-of
for await (const message of query) {
  // 处理消息
}

// 方法2: next()
while (true) {
  const { value: message, done } = await query.next();
  if (done) break;
  // 处理消息
}
```

### 控制会话

```typescript
// 改变模型
await query.setModel("claude-opus-4-1-20250805");

// 改变权限模式
await query.setPermissionMode("acceptEdits");

// 中断当前请求
await query.interrupt();

// 获取支持的模型
const models = await query.supportedModels();
// => [{ value: "model-id", displayName: "Model Name", description: "..." }]

// 获取支持的命令
const commands = await query.supportedCommands();
// => [{ name: "/cmd", description: "...", argumentHint: "..." }]
```

---

## ACP Agent 接口

```typescript
interface Agent {
  // 初始化
  initialize(request: InitializeRequest): Promise<InitializeResponse>;

  // 会话管理
  newSession(params: NewSessionRequest): Promise<NewSessionResponse>;
  unstable_resumeSession(params: ResumeSessionRequest): Promise<ResumeSessionResponse>;
  unstable_forkSession(params: ForkSessionRequest): Promise<ForkSessionResponse>;

  // 对话
  prompt(params: PromptRequest): Promise<PromptResponse>;
  cancel(params: CancelNotification): Promise<void>;

  // 文件操作
  readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse>;
  writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse>;

  // 会话配置
  setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse>;
  unstable_setSessionModel(params: SetSessionModelRequest): Promise<SetSessionModelResponse | void>;

  // 认证
  authenticate(params: AuthenticateRequest): Promise<void>;
}
```

---

## 常见代码模式

### 初始化代理

```typescript
class MyAgent implements Agent {
  constructor(client: AgentSideConnection) {
    this.client = client;
    this.sessions = {};
  }

  async initialize(req: InitializeRequest): Promise<InitializeResponse> {
    return {
      protocolVersion: 1,
      agentCapabilities: { promptCapabilities: { image: true } },
      agentInfo: { name: "my-agent", version: "1.0.0" },
      authMethods: [{ id: "none", name: "None" }],
    };
  }
}

// 运行代理
function runAgent() {
  const input = nodeToWebWritable(process.stdout);
  const output = nodeToWebReadable(process.stdin);
  const stream = ndJsonStream(input, output);
  new AgentSideConnection((client) => new MyAgent(client), stream);
}

// 启动
runAgent();
process.stdin.resume();
```

### 创建会话

```typescript
async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
  const sessionId = randomUUID();
  const input = new Pushable<SDKUserMessage>();

  const q = query({
    prompt: input,
    options: {
      cwd: params.cwd,
      permissionMode: "default",
      canUseTool: this.canUseTool(sessionId),
    },
  });

  this.sessions[sessionId] = { query: q, input };

  const models = await q.supportedModels();
  await q.setModel(models[0].value);

  return {
    sessionId,
    models: {
      currentModelId: models[0].value,
      availableModels: models.map((m) => ({
        modelId: m.value,
        name: m.displayName,
        description: m.description,
      })),
    },
    modes: { currentModeId: "default", availableModes: [...] },
  };
}
```

### 处理提示

```typescript
async prompt(params: PromptRequest): Promise<PromptResponse> {
  const session = this.sessions[params.sessionId];

  // 转换 ACP 格式为 SDK 格式
  session.input.push(promptToClaude(params));

  // 迭代响应
  while (true) {
    const { value: message, done } = await session.query.next();
    if (done) break;

    switch (message.type) {
      case "stream_event":
        // 实时处理流式事件
        for (const notif of streamEventToAcpNotifications(...)) {
          await this.client.sessionUpdate(notif);
        }
        break;

      case "result":
        if (message.subtype === "success") {
          return { stopReason: "end_turn" };
        }
        break;
    }
  }

  throw new Error("Session did not end properly");
}
```

### 权限检查

```typescript
canUseTool(sessionId: string): CanUseTool {
  return async (toolName, toolInput, { signal, toolUseID }) => {
    // 自动允许某些工具
    if (["Bash", "Edit"].includes(toolName)) {
      return { behavior: "allow", updatedInput: toolInput };
    }

    // 请求用户确认
    const response = await this.client.requestPermission({
      options: [
        { kind: "allow_once", name: "Allow", optionId: "allow" },
        { kind: "reject_once", name: "Reject", optionId: "reject" },
      ],
      sessionId,
      toolCall: {
        toolCallId: toolUseID,
        rawInput: toolInput,
        title: `Call ${toolName}`,
      },
    });

    if (response.outcome?.outcome === "selected") {
      return { behavior: "allow", updatedInput: toolInput };
    } else {
      return { behavior: "deny", message: "User rejected", interrupt: true };
    }
  };
}
```

---

## 工具和 MCP

### MCP 服务器配置

```typescript
type McpServerConfig =
  | {
      type: "sdk";
      name: string;
      instance: McpServer;
    }
  | {
      type: "stdio";
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }
  | {
      type: "http";
      url: string;
      headers?: Record<string, string>;
    }
  | {
      type: "sse";
      url: string;
      headers?: Record<string, string>;
    };
```

### 创建 MCP 服务器

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer(
  { name: "my-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.registerTool(
  "ReadFile",
  {
    title: "Read a file",
    description: "Reads a file from the filesystem",
    inputSchema: {
      file_path: z.string().describe("Path to file"),
    },
  },
  async (input) => {
    return { content: await fs.readFile(input.file_path, "utf-8") };
  }
);

export default server;
```

---

## 错误处理

### 常见错误代码

```typescript
// 认证错误
throw RequestError.authRequired();

// 内部错误
throw RequestError.internalError(undefined, "Error message");

// 无效请求
throw RequestError.invalidRequest("Invalid parameter");
```

### 检查消息错误

```typescript
if (message.type === "result") {
  if (message.subtype === "success" && message.is_error) {
    throw RequestError.internalError(undefined, message.result);
  }

  if (message.subtype === "error_max_budget_usd") {
    throw RequestError.internalError(
      undefined,
      `Budget exceeded: ${message.errors.join(", ")}`
    );
  }

  if (message.subtype === "error_during_execution") {
    throw RequestError.internalError(
      undefined,
      message.errors.join(", ")
    );
  }
}
```

---

## 调试技巧

### 启用日志

```typescript
// 所有输出到 stderr（不破坏 ACP）
process.env.DEBUG = "*";

const logger = {
  log: (...args: any[]) => console.error("[LOG]", ...args),
  error: (...args: any[]) => console.error("[ERR]", ...args),
};
```

### 追踪消息类型

```typescript
for await (const message of query) {
  logger.log(`Message type: ${message.type}`, message);

  if (message.type === "stream_event") {
    logger.log(`  Event type: ${message.event.type}`);
  }
}
```

### 检查会话状态

```typescript
console.error("Active sessions:", Object.keys(this.sessions));
console.error("Tool cache size:", Object.keys(this.toolUseCache).length);
```

---

## 性能优化

| 优化 | 效果 | 实现 |
|------|------|------|
| 并行会话 | 同时处理多个用户 | 为每个会话使用独立的 Query 对象 |
| 流式处理 | 降低延迟 | 立即处理 stream_event，不缓冲 |
| 工具缓存 | 快速查找 | 使用哈希表存储工具信息 |
| 会话清理 | 释放内存 | 会话结束时删除会话和工具缓存 |

---

## 版本信息

```json
{
  "@anthropic-ai/claude-agent-sdk": "^0.1.70",
  "@agentclientprotocol/sdk": "^0.12.0",
  "@modelcontextprotocol/sdk": "^1.25.0"
}
```

---

## 链接

- [Claude Code SDK 文档](https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-overview)
- [Agent Client Protocol](https://agentclientprotocol.com/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Zed 实现参考](https://github.com/zed-industries/claude-code-acp)
