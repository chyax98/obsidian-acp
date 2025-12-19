# Zed 官方 Claude Code ACP 适配器实现分析

完整分析日期: 2025-12-18
仓库: https://github.com/zed-industries/claude-code-acp
版本: v0.12.6

## 核心架构概览

```
┌─────────────────────────────────────────────────────────┐
│ ACP Client (Zed/Emacs/Neovim)                           │
│ - Agent Client Protocol (ndJson stream)                 │
└──────────────────────┬──────────────────────────────────┘
                       │ ndJson Stream
                       │ (stdin/stdout)
                       ▼
┌─────────────────────────────────────────────────────────┐
│ ClaudeAcpAgent (implements Agent interface)             │
│ - Manages sessions                                       │
│ - Handles permissions                                    │
│ - Converts between ACP & Claude Code SDK formats        │
└──────────────────────┬──────────────────────────────────┘
                       │ query() + streaming
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Claude Code SDK (query function)                        │
│ - Session management                                     │
│ - Tool execution                                         │
│ - Model interaction                                      │
│ - Stream events                                          │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Claude API + Tools (MCP, built-in tools)                │
└─────────────────────────────────────────────────────────┘
```

## 1. 核心文件说明

### 1.1 入口点: `src/index.ts`

**关键职责:**
- 设置日志重定向 (stdout -> stderr)
- 加载托管设置 (managed settings)
- 初始化 ACP 代理

```typescript
// 全部 console 输出重定向到 stderr，确保 stdout 用于 ACP 通信
console.log = console.error;
console.info = console.error;
console.warn = console.error;
console.debug = console.error;

// 处理未捕获的异常
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// 启动 ACP
runAcp();

// 保持进程活跃
process.stdin.resume();
```

**为什么重定向日志?**
- ACP 使用 ndjson 协议在 stdout 传输
- 任何意外输出都会破坏协议
- 所以所有日志必须输出到 stderr

### 1.2 库导出: `src/lib.ts`

导出公开 API 供其他应用使用:
- `ClaudeAcpAgent` - 核心代理类
- `SettingsManager` - 权限/配置管理
- `createMcpServer` - MCP 服务器工厂
- 工具相关函数
- `runAcp()` - 完整运行函数

### 1.3 核心代理: `src/acp-agent.ts` (1200+ 行)

**这是最重要的文件，实现了 ACP Agent 接口**

#### 依赖导入关键点:

```typescript
import {
  Agent,
  AgentSideConnection,
  // ACP SDK types...
} from "@agentclientprotocol/sdk";

import {
  CanUseTool,          // 权限检查回调类型
  Options,             // SDK 选项
  PermissionMode,      // "default"|"acceptEdits"|"bypassPermissions"|"dontAsk"|"plan"
  Query,               // 异步迭代器，处理流式响应
  query,               // 创建 Query 对象的工厂函数
  SDKPartialAssistantMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
```

#### 核心类型定义:

```typescript
// Session 类型定义
type Session = {
  query: Query;                          // 流式查询对象
  input: Pushable<SDKUserMessage>;       // 输入管道
  cancelled: boolean;                    // 取消标志
  permissionMode: PermissionMode;        // 权限模式
  settingsManager: SettingsManager;      // 设置管理器
};

// 工具使用缓存 - 用于追踪工具调用及其结果
type ToolUseCache = {
  [toolUseId: string]: {
    type: "tool_use" | "server_tool_use" | "mcp_tool_use";
    id: string;
    name: string;
    input: any;
  };
};
```

#### 新类型定义 - 供外部使用:

```typescript
// 创建新会话时的元数据
export type NewSessionMeta = {
  claudeCode?: {
    options?: Options;  // 转发给 Claude Code SDK 的选项
    systemPrompt?: string | { append: string };
  };
};

// 工具更新时的元数据
export type ToolUpdateMeta = {
  claudeCode?: {
    toolName: string;           // 工具名称
    toolResponse?: unknown;     // 工具的结构化输出
  };
};
```

## 2. 关键函数详解

### 2.1 创建会话: `createSession()`

这是最复杂的函数，设置整个 Claude Code 环境：

```typescript
private async createSession(
  params: NewSessionRequest,
  creationOpts: { resume?: string; forkSession?: boolean } = {},
): Promise<NewSessionResponse> {
  // 1. 生成会话 ID
  const sessionId = creationOpts.resume ?? randomUUID();
  const input = new Pushable<SDKUserMessage>();

  // 2. 初始化设置管理器 (权限管理)
  const settingsManager = new SettingsManager(params.cwd, {
    logger: this.logger,
  });
  await settingsManager.initialize();

  // 3. 整理 MCP 服务器配置
  const mcpServers: Record<string, McpServerConfig> = {};
  // ... 处理 params.mcpServers ...

  // 4. 注册 ACP 内置 MCP 服务器 (Read/Write/Bash 等)
  if (!params._meta?.disableBuiltInTools) {
    const server = createMcpServer(this, sessionId, this.clientCapabilities);
    mcpServers["acp"] = {
      type: "sdk",
      name: "acp",
      instance: server,
    };
  }

  // 5. 配置系统提示
  let systemPrompt: Options["systemPrompt"] = {
    type: "preset",
    preset: "claude_code"
  };
  if (params._meta?.systemPrompt) {
    // ... 处理自定义系统提示 ...
  }

  // 6. 构建 Claude Code SDK 选项
  const options: Options = {
    systemPrompt,
    settingSources: ["user", "project", "local"],
    stderr: (err) => this.logger.error(err),
    ...userProvidedOptions,

    // 必须由 ACP 控制的字段
    cwd: params.cwd,
    includePartialMessages: true,
    mcpServers,
    extraArgs,
    allowDangerouslySkipPermissions: !IS_ROOT,
    permissionMode,
    canUseTool: this.canUseTool(sessionId),  // 权限检查回调
    executable: process.execPath as any,

    // 注册钩子 (hooks)
    hooks: {
      ...userProvidedOptions?.hooks,
      PreToolUse: [...],
      PostToolUse: [...],
    },
  };

  // 7. 创建 Query 对象 - 这是关键!
  const q = query({
    prompt: input,  // Pushable<SDKUserMessage>
    options,
  });

  // 8. 存储会话
  this.sessions[sessionId] = {
    query: q,
    input: input,
    cancelled: false,
    permissionMode,
    settingsManager,
  };

  // 9. 获取可用命令和模型
  const availableCommands = await getAvailableSlashCommands(q);
  const models = await getAvailableModels(q);

  // 10. 异步发送更新 (不阻塞返回)
  setTimeout(() => {
    this.client.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: "available_commands_update",
        availableCommands,
      },
    });
  }, 0);

  return {
    sessionId,
    models,
    modes: { currentModeId: permissionMode, availableModes },
  };
}
```

**关键洞察:**
1. `query()` 返回的 Query 对象是一个异步迭代器
2. 通过 `Pushable<SDKUserMessage>` 推送用户消息
3. 选项中的 `hooks` 让我们监控工具执行前后
4. `canUseTool` 回调在每次工具调用时执行，用于权限检查

### 2.2 处理提示: `prompt()` 函数

```typescript
async prompt(params: PromptRequest): Promise<PromptResponse> {
  const { query, input } = this.sessions[params.sessionId];

  // 1. 将 ACP 格式的提示转换为 Claude SDK 格式
  input.push(promptToClaude(params));

  // 2. 异步迭代 query 返回的消息
  while (true) {
    const { value: message, done } = await query.next();
    if (done || !message) {
      if (this.sessions[params.sessionId].cancelled) {
        return { stopReason: "cancelled" };
      }
      break;
    }

    // 3. 处理不同类型的消息
    switch (message.type) {
      case "system":
        // 系统消息 (init, compact_boundary, hook_response, status)
        break;

      case "result": {
        // 最终结果消息
        // - success: 成功完成
        // - error_during_execution: 执行错误
        // - error_max_turns/budget/retries: 达到限制
        switch (message.subtype) {
          case "success":
            return { stopReason: "end_turn" };
          case "error_during_execution":
            return { stopReason: "end_turn" };
          // ...
        }
        break;
      }

      case "stream_event": {
        // 流式事件 (contentBlock start/delta, tool_use, 等等)
        for (const notification of streamEventToAcpNotifications(
          message,
          params.sessionId,
          this.toolUseCache,
          this.client,
          this.logger,
        )) {
          await this.client.sessionUpdate(notification);
        }
        break;
      }

      case "user":
      case "assistant": {
        // 完整消息块 (非流式)
        for (const notification of toAcpNotifications(
          content,
          message.message.role,
          params.sessionId,
          this.toolUseCache,
          this.client,
          this.logger,
        )) {
          await this.client.sessionUpdate(notification);
        }
        break;
      }

      case "tool_progress":
      case "auth_status":
        break;
    }
  }
}
```

**关键洞察:**
1. `query.next()` 返回 `{ value: Message, done: boolean }`
2. 消息类型包括: system, result, stream_event, user, assistant, tool_progress, auth_status
3. stream_event 用于实时流式更新 (工具调用、文本块等)
4. 使用 `toolUseCache` 追踪工具调用，用于匹配工具结果

### 2.3 权限检查: `canUseTool()` 回调

```typescript
canUseTool(sessionId: string): CanUseTool {
  return async (toolName, toolInput, { signal, suggestions, toolUseID }) => {
    const session = this.sessions[sessionId];
    if (!session) {
      return { behavior: "deny", message: "Session not found", interrupt: true };
    }

    // 特殊处理: ExitPlanMode 需要确认
    if (toolName === "ExitPlanMode") {
      const response = await this.client.requestPermission({
        options: [
          { kind: "allow_always", name: "Yes, and auto-accept edits", optionId: "acceptEdits" },
          { kind: "allow_once", name: "Yes, and manually approve edits", optionId: "default" },
          { kind: "reject_once", name: "No, keep planning", optionId: "plan" },
        ],
        sessionId,
        toolCall: {
          toolCallId: toolUseID,
          rawInput: toolInput,
          title: toolInfoFromToolUse({ name: toolName, input: toolInput }).title,
        },
      });

      if (signal.aborted || response.outcome?.outcome === "cancelled") {
        throw new Error("Tool use aborted");
      }
      if (response.outcome?.outcome === "selected") {
        session.permissionMode = response.outcome.optionId;
        // 更新客户端
        await this.client.sessionUpdate({
          sessionId,
          update: { sessionUpdate: "current_mode_update", currentModeId: response.outcome.optionId },
        });
        return { behavior: "allow", updatedInput: toolInput, updatedPermissions: [...] };
      } else {
        return { behavior: "deny", message: "User rejected request to exit plan mode.", interrupt: true };
      }
    }

    // 检查权限模式
    if (
      session.permissionMode === "bypassPermissions" ||
      (session.permissionMode === "acceptEdits" && EDIT_TOOL_NAMES.includes(toolName))
    ) {
      // 自动允许
      return {
        behavior: "allow",
        updatedInput: toolInput,
        updatedPermissions: suggestions ?? [
          { type: "addRules", rules: [{ toolName }], behavior: "allow", destination: "session" },
        ],
      };
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
        title: toolInfoFromToolUse({ name: toolName, input: toolInput }).title,
      },
    });

    if (response.outcome?.outcome === "selected" &&
        (response.outcome.optionId === "allow" || response.outcome.optionId === "allow_always")) {
      return {
        behavior: "allow",
        updatedInput: toolInput,
        updatedPermissions: response.outcome.optionId === "allow_always"
          ? [{ type: "addRules", rules: [{ toolName }], behavior: "allow", destination: "session" }]
          : [],
      };
    } else {
      return { behavior: "deny", message: "User refused permission to run tool", interrupt: true };
    }
  };
}
```

**权限模式说明:**
- `default` - 询问用户每个危险操作
- `acceptEdits` - 自动接受文件编辑 (Edit/Write)
- `bypassPermissions` - 跳过所有权限检查 (仅非root用户)
- `dontAsk` - 不询问，如果未预先批准则拒绝
- `plan` - 规划模式，不执行工具

### 2.4 消息转换: `promptToClaude()`

```typescript
export function promptToClaude(prompt: PromptRequest): SDKUserMessage {
  const content: any[] = [];
  const context: any[] = [];

  for (const chunk of prompt.prompt) {
    switch (chunk.type) {
      case "text": {
        let text = chunk.text;
        // 转换 MCP 命令格式: /mcp:server:cmd -> /server:cmd (MCP)
        const mcpMatch = text.match(/^\/mcp:([^:\s]+):(\S+)(\s+.*)?$/);
        if (mcpMatch) {
          const [, server, command, args] = mcpMatch;
          text = `/${server}:${command} (MCP)${args || ""}`;
        }
        content.push({ type: "text", text });
        break;
      }
      case "resource_link": {
        // 链接资源
        const formattedUri = formatUriAsLink(chunk.uri);
        content.push({ type: "text", text: formattedUri });
        break;
      }
      case "resource": {
        // 文本资源 - 添加到上下文
        if ("text" in chunk.resource) {
          content.push({ type: "text", text: formatUriAsLink(chunk.resource.uri) });
          context.push({
            type: "text",
            text: `\n<context ref="${chunk.resource.uri}">\n${chunk.resource.text}\n</context>`,
          });
        }
        break;
      }
      case "image": {
        // 支持 base64 和 URL 图像
        if (chunk.data) {
          content.push({
            type: "image",
            source: {
              type: "base64",
              data: chunk.data,
              media_type: chunk.mimeType,
            },
          });
        } else if (chunk.uri && chunk.uri.startsWith("http")) {
          content.push({
            type: "image",
            source: { type: "url", url: chunk.uri },
          });
        }
        break;
      }
    }
  }

  content.push(...context);

  return {
    type: "user",
    message: {
      role: "user",
      content: content,
    },
    session_id: prompt.sessionId,
    parent_tool_use_id: null,
  };
}
```

### 2.5 消息转换: `toAcpNotifications()`

将 Claude SDK 消息转换为 ACP 通知：

```typescript
export function toAcpNotifications(
  content: string | ContentBlockParam[] | BetaContentBlock[] | BetaRawContentBlockDelta[],
  role: "assistant" | "user",
  sessionId: string,
  toolUseCache: ToolUseCache,
  client: AgentSideConnection,
  logger: Logger,
): SessionNotification[] {
  const output = [];

  for (const chunk of content) {
    let update: SessionNotification["update"] | null = null;

    switch (chunk.type) {
      case "text":
      case "text_delta":
        update = {
          sessionUpdate: role === "assistant" ? "agent_message_chunk" : "user_message_chunk",
          content: { type: "text", text: chunk.text },
        };
        break;

      case "image":
        update = {
          sessionUpdate: role === "assistant" ? "agent_message_chunk" : "user_message_chunk",
          content: {
            type: "image",
            data: chunk.source.type === "base64" ? chunk.source.data : "",
            mimeType: chunk.source.type === "base64" ? chunk.source.media_type : "",
            uri: chunk.source.type === "url" ? chunk.source.url : undefined,
          },
        };
        break;

      case "thinking":
      case "thinking_delta":
        update = {
          sessionUpdate: "agent_thought_chunk",
          content: { type: "text", text: chunk.thinking },
        };
        break;

      case "tool_use":
      case "server_tool_use":
      case "mcp_tool_use": {
        // 缓存工具使用以便稍后匹配结果
        toolUseCache[chunk.id] = chunk;

        // TodoWrite 特殊处理 - 转换为计划
        if (chunk.name === "TodoWrite") {
          if (Array.isArray(chunk.input.todos)) {
            update = {
              sessionUpdate: "plan",
              entries: planEntries(chunk.input as { todos: ClaudePlanEntry[] }),
            };
          }
        } else {
          // 注册钩子回调以获取结构化输出
          registerHookCallback(chunk.id, {
            onPostToolUseHook: async (toolUseId, toolInput, toolResponse) => {
              const toolUse = toolUseCache[toolUseId];
              if (toolUse) {
                // 发送工具响应更新
                const update: SessionNotification["update"] = {
                  _meta: {
                    claudeCode: {
                      toolResponse,
                      toolName: toolUse.name,
                    },
                  } satisfies ToolUpdateMeta,
                  toolCallId: toolUseId,
                  sessionUpdate: "tool_call_update",
                };
                await client.sessionUpdate({ sessionId, update });
              }
            },
          });

          // 创建工具调用通知
          update = {
            _meta: { claudeCode: { toolName: chunk.name } } satisfies ToolUpdateMeta,
            toolCallId: chunk.id,
            sessionUpdate: "tool_call",
            rawInput: JSON.parse(JSON.stringify(chunk.input)),
            status: "pending",
            ...toolInfoFromToolUse(chunk),
          };
        }
        break;
      }

      case "tool_result":
      case "mcp_tool_result": {
        const toolUse = toolUseCache[chunk.tool_use_id];
        if (!toolUse) {
          logger.error(
            `[claude-code-acp] Got tool result for unknown tool use: ${chunk.tool_use_id}`,
          );
          break;
        }

        if (toolUse.name !== "TodoWrite") {
          update = {
            _meta: { claudeCode: { toolName: toolUse.name } } satisfies ToolUpdateMeta,
            toolCallId: chunk.tool_use_id,
            sessionUpdate: "tool_call_update",
            status: "is_error" in chunk && chunk.is_error ? "failed" : "completed",
            ...toolUpdateFromToolResult(chunk, toolUseCache[chunk.tool_use_id]),
          };
        }
        break;
      }
    }

    if (update) {
      output.push({ sessionId, update });
    }
  }

  return output;
}
```

### 2.6 流式事件处理: `streamEventToAcpNotifications()`

处理来自 SDK 的流式事件：

```typescript
export function streamEventToAcpNotifications(
  message: SDKPartialAssistantMessage,
  sessionId: string,
  toolUseCache: ToolUseCache,
  client: AgentSideConnection,
  logger: Logger,
): SessionNotification[] {
  const event = message.event;
  switch (event.type) {
    case "content_block_start":
      // 新内容块开始 (text, image, tool_use, etc)
      return toAcpNotifications(
        [event.content_block],
        "assistant",
        sessionId,
        toolUseCache,
        client,
        logger,
      );

    case "content_block_delta":
      // 内容块增量 (text_delta, thinking_delta, etc)
      return toAcpNotifications(
        [event.delta],
        "assistant",
        sessionId,
        toolUseCache,
        client,
        logger,
      );

    case "message_start":
    case "message_delta":
    case "message_stop":
    case "content_block_stop":
      // 不产生输出的事件
      return [];
  }
}
```

### 2.7 核心循环: `runAcp()`

```typescript
export function runAcp() {
  // 1. 转换 Node.js streams 为 Web Streams
  const input = nodeToWebWritable(process.stdout);
  const output = nodeToWebReadable(process.stdin);

  // 2. 创建 ndJson 流
  const stream = ndJsonStream(input, output);

  // 3. 创建 ACP 连接 - 自动启动事件循环
  new AgentSideConnection((client) => new ClaudeAcpAgent(client), stream);
}
```

## 3. 关键概念

### 3.1 Query 对象 - 流式消息迭代

Query 是一个异步迭代器，通过 `query()` 工厂函数创建：

```typescript
// 创建 Query
const q = query({
  prompt: inputIterable,  // Pushable<SDKUserMessage>
  options: { ... }
});

// 迭代消息
for await (const message of q) {
  // message 可以是:
  // - SystemMessage (init, compact_boundary, hook_response, status)
  // - ResultMessage (success, error_*, etc)
  // - StreamEventMessage (处理流式实时内容)
  // - UserMessage / AssistantMessage (完整消息块)
  // - ToolProgressMessage
  // - AuthStatusMessage
}

// 或使用 next()
while (true) {
  const { value: message, done } = await q.next();
  if (done) break;
  // process message
}

// 可以与 Query 交互
await q.setModel("claude-opus-4-1-20250805");
await q.setPermissionMode("acceptEdits");
await q.interrupt();  // 取消当前请求
const commands = await q.supportedCommands();
const models = await q.supportedModels();
```

### 3.2 Pushable - 推送消息到 Query

Pushable 实现了 AsyncIterable 接口，允许主动推送消息：

```typescript
const input = new Pushable<SDKUserMessage>();

// 推送消息
input.push({
  type: "user",
  message: { role: "user", content: [...] },
  session_id: sessionId,
  parent_tool_use_id: null,
});

// 标记完成 (可选，Query 通常管理生命周期)
input.end();
```

### 3.3 权限管理流程

```
┌─────────────────────────────────────────┐
│ Claude 使用工具 (tool_use 事件)          │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ canUseTool() 回调被触发                  │
│ - 检查权限模式                          │
│ - 检查权限规则                          │
│ - 如需要，请求用户批准                  │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
   ┌────────┐           ┌────────┐
   │ 允许   │           │ 拒绝   │
   │ { behavior: "allow" }│
   │ { behavior: "deny" } │
   └────────┘           └────────┘
        │                     │
        ▼                     ▼
   执行工具            中断执行
   返回结果             抛出错误
```

### 3.4 MCP 服务器集成

创建 MCP 服务器提供 ACP 工具：

```typescript
const mcpServers: Record<string, McpServerConfig> = {
  "acp": {
    type: "sdk",
    name: "acp",
    instance: createMcpServer(this, sessionId, clientCapabilities),
  },
  // 用户提供的其他 MCP 服务器
  "user-server": {
    type: "stdio",
    command: "node",
    args: ["server.js"],
  },
  "http-server": {
    type: "http",
    url: "http://localhost:3000",
    headers: { "X-Custom": "value" },
  },
};
```

## 4. 工具处理

### 4.1 工具名称映射

```typescript
// ACP 工具名称前缀 (避免与 Claude 内置工具冲突)
export const ACP_TOOL_NAME_PREFIX = "mcp__acp__";

export const acpToolNames = {
  read: "mcp__acp__Read",
  edit: "mcp__acp__Edit",
  write: "mcp__acp__Write",
  bash: "mcp__acp__Bash",
  killShell: "mcp__acp__KillShell",
  bashOutput: "mcp__acp__BashOutput",
};
```

### 4.2 工具调用追踪

通过 `toolUseCache` 追踪工具调用，匹配结果：

```typescript
// 当看到 tool_use 事件时
case "tool_use": {
  toolUseCache[chunk.id] = chunk;  // 缓存
  // ... 发送 tool_call 通知 ...
}

// 当看到 tool_result 事件时
case "tool_result": {
  const toolUse = toolUseCache[chunk.tool_use_id];  // 查找原始调用
  // ... 发送 tool_call_update 通知 ...
}
```

### 4.3 工具权限规则

在 `settings.json` 中定义规则：

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Read(./.env)",
      "Read(./public/**)",
      "Bash(npm run:*)",
      "Edit"
    ],
    "deny": [
      "Bash(rm:*)",
      "Write(/etc/**)"
    ],
    "ask": [
      "Bash"
    ]
  }
}
```

## 5. 会话生命周期

```
1. newSession(NewSessionRequest)
   │
   ├─ 创建会话
   ├─ 初始化设置管理器
   ├─ 创建 Query 对象
   ├─ 获取可用命令和模型
   └─ 返回 NewSessionResponse { sessionId, models, modes }

2. prompt(PromptRequest)
   │
   ├─ 推送用户消息到 input
   ├─ 迭代 query.next()
   ├─ 处理消息和流事件
   ├─ 发送 sessionUpdate 通知
   ├─ 处理权限请求
   └─ 返回 PromptResponse { stopReason }

3. cancel(CancelNotification)
   │
   ├─ 设置 cancelled 标志
   ├─ 调用 query.interrupt()
   └─ 下次 prompt 会检查标志返回 "cancelled"

4. Session 清理
   │
   └─ Query 对象自动清理
```

## 6. 错误处理

### 6.1 认证错误

```typescript
if (message.result.includes("Please run /login")) {
  throw RequestError.authRequired();
}
```

### 6.2 执行错误

```typescript
if (message.is_error) {
  throw RequestError.internalError(undefined, message.result);
}
```

### 6.3 限制错误

```typescript
case "error_max_budget_usd":
case "error_max_turns":
case "error_max_structured_output_retries":
  throw RequestError.internalError(
    undefined,
    message.errors.join(", ") || message.subtype,
  );
```

## 7. 最佳实践

### 7.1 日志管理

```typescript
// ✅ 正确 - 输出到 stderr
this.logger.error("Something went wrong");

// ❌ 错误 - 不要使用 console.log (会破坏 ACP 协议)
console.log("output");
```

### 7.2 流式处理

```typescript
// ✅ 正确 - 实时发送更新
for (const notification of streamEventToAcpNotifications(...)) {
  await this.client.sessionUpdate(notification);
}

// ❌ 错误 - 不要等待完整消息再发送
const allMessages = [];
for await (const msg of query) {
  allMessages.push(msg);
}
// 最后发送 - 用户体验差
```

### 7.3 权限检查

```typescript
// ✅ 正确 - 尊重权限模式
if (session.permissionMode === "bypassPermissions") {
  return { behavior: "allow", ... };
}

// ✅ 正确 - 请求用户确认
const response = await this.client.requestPermission(...);
if (response.outcome?.outcome === "selected") {
  // ...
}

// ❌ 错误 - 没有权限检查就执行危险操作
```

### 7.4 会话管理

```typescript
// ✅ 正确 - 为每个会话生成唯一 ID
const sessionId = creationOpts.resume ?? randomUUID();

// ✅ 正确 - 检查会话存在
if (!this.sessions[params.sessionId]) {
  throw new Error("Session not found");
}

// ❌ 错误 - 允许会话 ID 冲突
const sessionId = Date.now().toString();  // 不唯一!
```

### 7.5 钩子使用

```typescript
// ✅ 正确 - 使用钩子监控工具执行
hooks: {
  PreToolUse: [{
    hooks: [createPreToolUseHook(settingsManager, logger)],
  }],
  PostToolUse: [{
    hooks: [createPostToolUseHook(logger)],
  }],
}

// 这允许：
// - 权限检查
// - 工具参数验证
// - 工具结果处理
```

## 8. 关键依赖版本

```json
{
  "@agentclientprotocol/sdk": "0.12.0",
  "@anthropic-ai/claude-agent-sdk": "0.1.70",
  "@modelcontextprotocol/sdk": "1.25.0"
}
```

## 9. 实现检查清单

使用 Claude Agent SDK 时：

- [ ] 导入 `query` 函数和相关类型
- [ ] 创建 `Pushable<SDKUserMessage>` 用于输入管道
- [ ] 调用 `query({ prompt: input, options })` 创建查询
- [ ] 异步迭代 `query.next()` 获取消息
- [ ] 处理所有消息类型 (system, result, stream_event, user, assistant, etc)
- [ ] 实现 `canUseTool` 回调用于权限检查
- [ ] 注册钩子 (PreToolUse, PostToolUse) 监控执行
- [ ] 追踪工具调用和结果 (toolUseCache)
- [ ] 将 SDK 消息转换为 ACP 格式
- [ ] 处理流式事件实时更新
- [ ] 实现会话取消 (query.interrupt())
- [ ] 处理权限请求和用户交互
- [ ] 错误处理和身份验证

## 10. 文件映射

| 文件 | 职责 | 行数 |
|------|------|------|
| `index.ts` | 入口点、日志设置 | 27 |
| `lib.ts` | 公开 API 导出 | 37 |
| `acp-agent.ts` | 核心 Agent 实现 | 1200+ |
| `tools.ts` | 工具信息转换 | 500+ |
| `mcp-server.ts` | MCP 服务器实现 | 400+ |
| `settings.ts` | 权限管理 | 400+ |
| `utils.ts` | 工具函数 | 172 |

## 总结

Zed 的 Claude Code ACP 适配器是一个精心设计的实现，展示了如何：

1. **正确使用 Claude Agent SDK**
   - 通过 `query()` 创建流式会话
   - 使用 `Pushable` 管理输入流
   - 异步迭代处理所有消息类型

2. **实现 ACP Agent 接口**
   - 处理会话生命周期 (new/resume/fork)
   - 转换消息格式 (ACP ↔ Claude SDK)
   - 实时流式更新

3. **权限管理**
   - 灵活的权限模式 (default, acceptEdits, bypassPermissions, dontAsk, plan)
   - 基于规则的权限检查
   - 用户交互请求

4. **工具集成**
   - MCP 服务器（stdio, HTTP, SDK）
   - 内置工具 (Read, Write, Edit, Bash)
   - 工具追踪和结果匹配

5. **稳定性**
   - 错误处理和边界情况
   - 日志管理 (防止干扰协议)
   - 会话隔离
