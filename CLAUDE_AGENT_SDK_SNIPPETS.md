# Claude Agent SDK 关键代码片段参考

## 1. 基础设置与初始化

### 1.1 导入必要的类型和函数

```typescript
import {
  Agent,
  AgentSideConnection,
  ClientCapabilities,
  ForkSessionRequest,
  ForkSessionResponse,
  InitializeRequest,
  InitializeResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  RequestError,
  ResumeSessionRequest,
  ResumeSessionResponse,
  SessionNotification,
  WriteTextFileRequest,
  WriteTextFileResponse,
  ndJsonStream,
} from "@agentclientprotocol/sdk";

import {
  CanUseTool,
  McpServerConfig,
  Options,
  PermissionMode,
  Query,
  query,
  SDKPartialAssistantMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
```

### 1.2 创建 ACP 代理类

```typescript
export class ClaudeAcpAgent implements Agent {
  sessions: { [key: string]: Session };
  client: AgentSideConnection;
  toolUseCache: ToolUseCache;
  clientCapabilities?: ClientCapabilities;
  logger: Logger;

  constructor(client: AgentSideConnection, logger?: Logger) {
    this.sessions = {};
    this.client = client;
    this.toolUseCache = {};
    this.logger = logger ?? console;
  }

  // 实现 Agent 接口的所有方法...
}
```

### 1.3 启动 ACP 代理

```typescript
export function runAcp() {
  const input = nodeToWebWritable(process.stdout);
  const output = nodeToWebReadable(process.stdin);
  const stream = ndJsonStream(input, output);

  new AgentSideConnection(
    (client) => new ClaudeAcpAgent(client),
    stream
  );
}

// 在 main 中调用
runAcp();
process.stdin.resume();
```

## 2. 调用 query() 函数

### 2.1 创建 Query 对象

```typescript
// 创建可推送的输入流
const input = new Pushable<SDKUserMessage>();

// 准备 Claude Code 选项
const options: Options = {
  systemPrompt: { type: "preset", preset: "claude_code" },
  cwd: params.cwd,
  includePartialMessages: true,
  mcpServers: { ... },
  permissionMode: "default",
  canUseTool: this.canUseTool(sessionId),
  // ... 更多选项 ...
};

// 创建 Query - 这返回一个异步迭代器
const q = query({
  prompt: input,
  options,
});
```

### 2.2 推送消息到 Query

```typescript
// 创建用户消息
const userMessage: SDKUserMessage = {
  type: "user",
  message: {
    role: "user",
    content: [
      { type: "text", text: "请帮我分析这个代码" },
    ],
  },
  session_id: sessionId,
  parent_tool_use_id: null,
};

// 推送到输入流
input.push(userMessage);

// Query 会接收并处理这个消息
```

### 2.3 异步迭代处理响应

```typescript
// 方法1: 使用 for-await-of
for await (const message of q) {
  // 处理每个消息
  console.log(message.type);  // "system", "result", "stream_event", etc
}

// 方法2: 使用 next()
while (true) {
  const { value: message, done } = await q.next();
  if (done) break;

  // 处理消息
  switch (message.type) {
    case "stream_event":
      // 处理流式事件
      break;
    case "result":
      // 处理最终结果
      break;
    // ...
  }
}
```

## 3. 处理流式消息

### 3.1 消息类型识别

```typescript
switch (message.type) {
  case "system": {
    // 系统消息: init, compact_boundary, hook_response, status
    switch (message.subtype) {
      case "init":
        console.log("初始化消息");
        break;
      case "compact_boundary":
        console.log("紧凑边界");
        break;
      case "hook_response":
        console.log("钩子响应");
        break;
      case "status":
        console.log("状态更新");
        break;
    }
    break;
  }

  case "stream_event": {
    // 流式事件 (实时)
    const event = message.event;
    switch (event.type) {
      case "content_block_start":
        console.log("内容块开始", event.content_block.type);
        break;
      case "content_block_delta":
        console.log("内容块增量", event.delta.type);
        break;
      case "message_start":
      case "message_delta":
      case "message_stop":
      case "content_block_stop":
        // 不需要特殊处理的事件
        break;
    }
    break;
  }

  case "result": {
    // 最终结果消息
    switch (message.subtype) {
      case "success":
        console.log("执行成功");
        return { stopReason: "end_turn" };
      case "error_during_execution":
        console.log("执行错误");
        return { stopReason: "end_turn" };
      case "error_max_turns":
      case "error_max_budget_usd":
        throw RequestError.internalError(undefined, message.errors.join(", "));
    }
    break;
  }

  case "user":
  case "assistant": {
    // 完整消息块
    console.log(`${message.type} 消息`);
    console.log(message.message.content);
    break;
  }

  case "tool_progress":
    console.log("工具进度");
    break;

  case "auth_status":
    console.log("认证状态");
    break;
}
```

### 3.2 处理流式事件

```typescript
case "stream_event": {
  const event = message.event;

  if (event.type === "content_block_start") {
    const contentBlock = event.content_block;

    if (contentBlock.type === "text") {
      console.log("开始文本块");
    } else if (contentBlock.type === "thinking") {
      console.log("开始思考块");
    } else if (contentBlock.type === "tool_use") {
      console.log(`开始工具使用: ${contentBlock.name}`);
      // 缓存工具使用以便稍后匹配结果
      this.toolUseCache[contentBlock.id] = contentBlock;
    }
  }

  if (event.type === "content_block_delta") {
    const delta = event.delta;

    if (delta.type === "text_delta") {
      // 实时文本流
      console.log("文本:", delta.text);
    } else if (delta.type === "thinking_delta") {
      // 实时思考流
      console.log("思考:", delta.thinking);
    } else if (delta.type === "input_json_delta") {
      // 工具输入增量
      console.log("工具输入增量:", delta.partial_json);
    }
  }
  break;
}
```

## 4. 处理权限请求

### 4.1 实现 canUseTool 回调

```typescript
canUseTool(sessionId: string): CanUseTool {
  return async (toolName, toolInput, { signal, suggestions, toolUseID }) => {
    const session = this.sessions[sessionId];

    // 检查权限模式
    if (session.permissionMode === "bypassPermissions") {
      return { behavior: "allow", updatedInput: toolInput };
    }

    if (session.permissionMode === "acceptEdits" && EDIT_TOOL_NAMES.includes(toolName)) {
      return { behavior: "allow", updatedInput: toolInput };
    }

    // 请求用户权限
    const response = await this.client.requestPermission({
      options: [
        { kind: "allow_always", name: "Always Allow", optionId: "allow_always" },
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
      if (response.outcome.optionId === "allow_always") {
        return {
          behavior: "allow",
          updatedInput: toolInput,
          updatedPermissions: [
            {
              type: "addRules",
              rules: [{ toolName }],
              behavior: "allow",
              destination: "session",
            },
          ],
        };
      } else if (response.outcome.optionId === "allow") {
        return { behavior: "allow", updatedInput: toolInput };
      }
    }

    return {
      behavior: "deny",
      message: "User rejected tool",
      interrupt: true,
    };
  };
}
```

### 4.2 处理权限响应

```typescript
// 用户选择的权限决定
interface PermissionOutcome {
  outcome: "selected" | "cancelled";
  optionId?: string;  // 用户选择的选项
}

// 根据用户的选择返回不同的 behavior
if (response.outcome?.outcome === "selected") {
  switch (response.outcome.optionId) {
    case "allow_always":
      // 永久允许 - 添加规则
      return {
        behavior: "allow",
        updatedPermissions: [
          {
            type: "addRules",
            rules: [{ toolName }],
            behavior: "allow",
            destination: "session",
          },
        ],
      };
    case "allow":
      // 仅此次允许
      return { behavior: "allow" };
    case "reject":
      // 拒绝
      return { behavior: "deny", message: "User rejected" };
  }
} else if (response.outcome?.outcome === "cancelled") {
  // 用户取消了请求
  return { behavior: "deny", message: "Cancelled", interrupt: true };
}
```

## 5. 管理会话

### 5.1 创建新会话

```typescript
async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
  const sessionId = params._meta?.resume ?? randomUUID();

  // 1. 初始化会话状态
  const input = new Pushable<SDKUserMessage>();
  const settingsManager = new SettingsManager(params.cwd);
  await settingsManager.initialize();

  // 2. 创建选项
  const options: Options = {
    cwd: params.cwd,
    includePartialMessages: true,
    permissionMode: "default",
    canUseTool: this.canUseTool(sessionId),
    // ... 更多选项 ...
  };

  // 3. 创建 Query
  const q = query({ prompt: input, options });

  // 4. 存储会话
  this.sessions[sessionId] = {
    query: q,
    input,
    cancelled: false,
    permissionMode: "default",
    settingsManager,
  };

  // 5. 获取元数据
  const models = await q.supportedModels();
  const commands = await q.supportedCommands();

  return {
    sessionId,
    models: { currentModelId: models[0].value, availableModels: [...] },
    modes: { currentModeId: "default", availableModes: [...] },
  };
}
```

### 5.2 恢复会话

```typescript
async unstable_resumeSession(params: ResumeSessionRequest): Promise<ResumeSessionResponse> {
  return await this.createSession(
    {
      cwd: params.cwd,
      mcpServers: params.mcpServers ?? [],
      _meta: params._meta,
    },
    { resume: params.sessionId }  // 告诉 SDK 恢复现有会话
  );
}
```

### 5.3 处理会话取消

```typescript
async cancel(params: CancelNotification): Promise<void> {
  const session = this.sessions[params.sessionId];

  // 1. 设置取消标志
  session.cancelled = true;

  // 2. 中断 Query
  await session.query.interrupt();
}

// 在处理消息时检查取消
while (true) {
  const { value: message, done } = await query.next();

  if (this.sessions[sessionId].cancelled) {
    return { stopReason: "cancelled" };
  }

  // ... 处理消息 ...
}
```

### 5.4 更改会话模式

```typescript
async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse> {
  const session = this.sessions[params.sessionId];

  // 验证模式
  const validModes = ["default", "acceptEdits", "bypassPermissions", "dontAsk", "plan"];
  if (!validModes.includes(params.modeId)) {
    throw new Error("Invalid mode");
  }

  // 更新本地状态
  session.permissionMode = params.modeId as PermissionMode;

  // 更新 SDK
  await session.query.setPermissionMode(params.modeId);

  return {};
}
```

## 6. 转换消息格式

### 6.1 ACP → Claude SDK

```typescript
function promptToClaude(prompt: PromptRequest): SDKUserMessage {
  const content = [];
  const context = [];

  for (const chunk of prompt.prompt) {
    switch (chunk.type) {
      case "text": {
        let text = chunk.text;
        // 处理 MCP 命令转换
        const mcpMatch = text.match(/^\/mcp:([^:\s]+):(\S+)(\s+.*)?$/);
        if (mcpMatch) {
          const [, server, command, args] = mcpMatch;
          text = `/${server}:${command} (MCP)${args || ""}`;
        }
        content.push({ type: "text", text });
        break;
      }

      case "image": {
        if (chunk.data) {
          content.push({
            type: "image",
            source: {
              type: "base64",
              data: chunk.data,
              media_type: chunk.mimeType,
            },
          });
        } else if (chunk.uri?.startsWith("http")) {
          content.push({
            type: "image",
            source: { type: "url", url: chunk.uri },
          });
        }
        break;
      }

      case "resource": {
        if ("text" in chunk.resource) {
          content.push({ type: "text", text: chunk.resource.uri });
          context.push({
            type: "text",
            text: `\n<context ref="${chunk.resource.uri}">\n${chunk.resource.text}\n</context>`,
          });
        }
        break;
      }
    }
  }

  return {
    type: "user",
    message: { role: "user", content: [...content, ...context] },
    session_id: prompt.sessionId,
    parent_tool_use_id: null,
  };
}
```

### 6.2 Claude SDK → ACP

```typescript
function toAcpNotifications(
  content: ContentBlockParam[],
  role: "assistant" | "user",
  sessionId: string,
  toolUseCache: ToolUseCache,
  client: AgentSideConnection,
  logger: Logger,
): SessionNotification[] {
  const output: SessionNotification[] = [];

  for (const chunk of content) {
    let update: SessionNotification["update"] | null = null;

    // 文本
    if (chunk.type === "text" || chunk.type === "text_delta") {
      update = {
        sessionUpdate: role === "assistant" ? "agent_message_chunk" : "user_message_chunk",
        content: { type: "text", text: chunk.text },
      };
    }

    // 思考块
    if (chunk.type === "thinking" || chunk.type === "thinking_delta") {
      update = {
        sessionUpdate: "agent_thought_chunk",
        content: { type: "text", text: chunk.thinking },
      };
    }

    // 工具调用
    if (chunk.type === "tool_use") {
      toolUseCache[chunk.id] = chunk;
      update = {
        sessionUpdate: "tool_call",
        toolCallId: chunk.id,
        title: `Call ${chunk.name}`,
        rawInput: chunk.input,
        status: "pending",
      };
    }

    // 工具结果
    if (chunk.type === "tool_result") {
      const toolUse = toolUseCache[chunk.tool_use_id];
      if (toolUse) {
        update = {
          sessionUpdate: "tool_call_update",
          toolCallId: chunk.tool_use_id,
          status: chunk.is_error ? "failed" : "completed",
        };
      }
    }

    if (update) {
      output.push({ sessionId, update });
    }
  }

  return output;
}
```

## 7. 使用 MCP 服务器

### 7.1 配置 MCP 服务器

```typescript
const mcpServers: Record<string, McpServerConfig> = {
  // SDK 内嵌服务器
  "acp": {
    type: "sdk",
    name: "acp",
    instance: createMcpServer(agent, sessionId, clientCapabilities),
  },

  // stdio 进程
  "file-server": {
    type: "stdio",
    command: "node",
    args: ["path/to/server.js"],
    env: { "VAR": "value" },
  },

  // HTTP 服务器
  "api-server": {
    type: "http",
    url: "http://localhost:3000",
    headers: { "Authorization": "Bearer token" },
  },

  // SSE 服务器
  "sse-server": {
    type: "sse",
    url: "https://api.example.com/sse",
  },
};

const options: Options = {
  mcpServers,
  // ... 其他选项 ...
};
```

### 7.2 创建 MCP 服务器

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

function createMcpServer(
  agent: Agent,
  sessionId: string,
  clientCapabilities?: ClientCapabilities
): McpServer {
  const server = new McpServer(
    { name: "acp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // 注册工具
  server.registerTool(
    "Read",
    {
      title: "Read file",
      description: "Reads a file from the filesystem",
      inputSchema: {
        file_path: z.string().describe("Path to file"),
        offset: z.number().optional(),
        limit: z.number().optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async (input) => {
      // 实现工具逻辑
      return await agent.readTextFile({
        sessionId,
        path: input.file_path,
        line: input.offset,
        limit: input.limit,
      });
    }
  );

  return server;
}
```

## 8. 常见模式

### 8.1 追踪工具执行

```typescript
type ToolUseCache = {
  [toolUseId: string]: {
    type: "tool_use" | "server_tool_use" | "mcp_tool_use";
    id: string;
    name: string;
    input: any;
  };
};

// 当看到工具使用时
case "tool_use": {
  toolUseCache[chunk.id] = chunk;  // 缓存
  // 发送通知给客户端
  break;
}

// 当看到工具结果时
case "tool_result": {
  const toolUse = toolUseCache[chunk.tool_use_id];
  if (toolUse) {
    // 现在我们知道使用了哪个工具
    console.log(`Tool ${toolUse.name} returned:`, chunk);
  }
  break;
}
```

### 8.2 实时流式更新

```typescript
case "stream_event": {
  // 立即发送流式更新给客户端
  for (const notification of streamEventToAcpNotifications(
    message,
    sessionId,
    toolUseCache,
    client,
    logger,
  )) {
    await client.sessionUpdate(notification);
  }
  break;
}
```

### 8.3 获取可用模型

```typescript
async function getAvailableModels(query: Query) {
  const models = await query.supportedModels();

  // 选择第一个模型作为默认
  const currentModel = models[0];
  await query.setModel(currentModel.value);

  return {
    currentModelId: currentModel.value,
    availableModels: models.map((m) => ({
      modelId: m.value,
      name: m.displayName,
      description: m.description,
    })),
  };
}
```

### 8.4 获取可用命令

```typescript
async function getAvailableCommands(query: Query) {
  const commands = await query.supportedCommands();

  // 过滤不支持的命令
  const UNSUPPORTED = ["login", "logout", "cost"];

  return commands
    .map((cmd) => {
      let name = cmd.name;
      // 标记 MCP 命令
      if (cmd.name.endsWith(" (MCP)")) {
        name = `mcp:${cmd.name.replace(" (MCP)", "")}`;
      }
      return {
        name,
        description: cmd.description || "",
        input: cmd.argumentHint ? { hint: cmd.argumentHint } : null,
      };
    })
    .filter((cmd) => !UNSUPPORTED.includes(cmd.name));
}
```

## 9. 调试和日志

### 9.1 日志最佳实践

```typescript
// ✅ 正确 - 使用 logger
this.logger.error("Something went wrong:", error);
this.logger.log("Debug info:", data);

// ❌ 错误 - 不要使用 console (会破坏 ACP 协议)
console.log("output");

// 在 ACP 代理中重定向 console
console.log = console.error;
console.info = console.error;
console.warn = console.error;
```

### 9.2 错误处理

```typescript
// 认证错误
if (message.result.includes("Please run /login")) {
  throw RequestError.authRequired();
}

// 执行错误
if (message.is_error) {
  throw RequestError.internalError(undefined, message.result);
}

// 资源限制
if (message.subtype === "error_max_budget_usd") {
  throw RequestError.internalError(
    undefined,
    `Budget limit exceeded: ${message.errors.join(", ")}`
  );
}
```

## 10. 完整最小示例

```typescript
import {
  Agent,
  AgentSideConnection,
  InitializeRequest,
  InitializeResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
  ndJsonStream,
} from "@agentclientprotocol/sdk";
import {
  query,
  Options,
  SDKUserMessage,
  CanUseTool,
} from "@anthropic-ai/claude-agent-sdk";

class MinimalAgent implements Agent {
  sessions: any = {};

  async initialize(req: InitializeRequest): Promise<InitializeResponse> {
    return {
      protocolVersion: 1,
      agentCapabilities: { promptCapabilities: { image: true } },
      agentInfo: { name: "minimal-agent", version: "1.0.0" },
      authMethods: [{ id: "none", name: "None" }],
    };
  }

  async newSession(req: NewSessionRequest): Promise<NewSessionResponse> {
    const sessionId = randomUUID();
    const input = new Pushable<SDKUserMessage>();

    const q = query({
      prompt: input,
      options: {
        cwd: req.cwd,
        permissionMode: "default",
        canUseTool: this.canUseTool(sessionId),
      },
    });

    this.sessions[sessionId] = { query: q, input };
    const models = await q.supportedModels();

    return {
      sessionId,
      models: {
        currentModelId: models[0].value,
        availableModels: models.map((m) => ({
          modelId: m.value,
          name: m.displayName,
        })),
      },
      modes: { currentModeId: "default", availableModes: [] },
    };
  }

  async prompt(req: PromptRequest): Promise<PromptResponse> {
    const session = this.sessions[req.sessionId];

    session.input.push({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text: req.prompt[0].text }],
      },
      session_id: req.sessionId,
      parent_tool_use_id: null,
    });

    for await (const msg of session.query) {
      if (msg.type === "result" && msg.subtype === "success") {
        return { stopReason: "end_turn" };
      }
    }

    return { stopReason: "end_turn" };
  }

  canUseTool(sessionId: string): CanUseTool {
    return async (toolName) => ({ behavior: "allow" });
  }

  // ... 实现其他必需方法 ...
}

function runAgent() {
  const input = nodeToWebWritable(process.stdout);
  const output = nodeToWebReadable(process.stdin);
  const stream = ndJsonStream(input, output);
  new AgentSideConnection((client) => new MinimalAgent(), stream);
}

runAgent();
process.stdin.resume();
```
