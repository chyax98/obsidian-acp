# Claude Agent SDK 实现对比与最佳实践

## 核心设计决策对比

### 1. Query 创建方式

#### Zed 实现方式（推荐）

```typescript
// 创建可推送的输入流
const input = new Pushable<SDKUserMessage>();

// 创建 Query
const q = query({
  prompt: input,
  options: {
    cwd: params.cwd,
    permissionMode: "default",
    canUseTool: this.canUseTool(sessionId),
    // ... 更多选项
  },
});

// 存储供后续使用
this.sessions[sessionId] = {
  query: q,
  input: input,
  // ...
};

// 稍后推送消息
input.push({
  type: "user",
  message: { role: "user", content: [...] },
  session_id: sessionId,
  parent_tool_use_id: null,
});

// 异步迭代处理响应
while (true) {
  const { value: message, done } = await q.next();
  if (done) break;
  // 处理消息
}
```

**优点：**
- 分离创建和输入（解耦合）
- 可以推送多个消息到同一个会话
- 支持会话暂停和恢复
- 支持流式实时处理

**缺点：**
- 需要管理 Pushable 对象生命周期
- 需要追踪多个会话的状态

#### 更简单的实现方式（不推荐）

```typescript
// 这种方式无法使用
// query({
//   prompt: staticPrompt,  // 字符串或数组
//   options: { ... }
// });

// 实际上必须提供异步迭代器
```

**为什么 query() 需要异步迭代器？**
- 允许会话的多轮交互
- 支持流式处理
- 可以动态添加消息

---

### 2. 消息处理方式

#### 方式1：立即流式处理（Zed 使用）

```typescript
case "stream_event": {
  // 立即处理流式事件
  for (const notification of streamEventToAcpNotifications(...)) {
    await this.client.sessionUpdate(notification);
  }
  break;
}
```

**优点：**
- 最小延迟
- 最好的用户体验
- 内存高效（不缓冲）

**缺点：**
- 需要更复杂的状态管理
- 需要 toolUseCache 追踪工具调用

#### 方式2：缓冲完整消息

```typescript
const allChunks = [];
for await (const message of query) {
  if (message.type === "stream_event") {
    allChunks.push(message.event);
  }
  if (message.type === "result") {
    // 所有流事件已收集，现在处理
    processStreamEvents(allChunks);
    break;
  }
}
```

**优点：**
- 逻辑更简单
- 易于理解

**缺点：**
- 延迟大（等待所有消息）
- 内存占用多
- 用户体验差

---

### 3. 权限管理实现

#### Zed 的分层权限检查

```typescript
async canUseTool(toolName, toolInput, options) {
  // 1. 检查权限模式
  if (session.permissionMode === "bypassPermissions") {
    return { behavior: "allow", ... };
  }

  // 2. 检查特殊模式 + 工具类型
  if (session.permissionMode === "acceptEdits" && EDIT_TOOL_NAMES.includes(toolName)) {
    return { behavior: "allow", ... };
  }

  // 3. 请求用户确认
  const response = await this.client.requestPermission({...});

  // 4. 根据用户选择处理
  if (response.outcome?.outcome === "selected") {
    if (response.outcome.optionId === "allow_always") {
      // 添加规则以便下次自动允许
      return {
        behavior: "allow",
        updatedPermissions: [{
          type: "addRules",
          rules: [{ toolName }],
          behavior: "allow",
          destination: "session",
        }],
      };
    }
  }
}
```

**这个设计的好处：**
1. **灵活的权限模式**
   - `default` - 询问每个操作
   - `acceptEdits` - 自动接受编辑
   - `bypassPermissions` - 跳过所有检查
   - `plan` - 不执行任何操作
   - `dontAsk` - 预先批准或拒绝

2. **动态规则管理**
   - 用户可以"永远允许"某个工具
   - 系统学习用户的偏好

3. **安全性**
   - 不跳过认可的工具
   - 每个操作都经过某种检查

#### 简单权限检查（不推荐）

```typescript
canUseTool() {
  return async () => ({ behavior: "allow" });  // 总是允许
}
```

**问题：**
- 用户无法控制
- 安全风险
- 不能追踪执行的操作

---

### 4. 工具执行追踪

#### Zed 的 ToolUseCache 模式

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
  // 1. 缓存工具使用信息
  toolUseCache[chunk.id] = chunk;

  // 2. 注册回调以接收执行后的结构化输出
  registerHookCallback(chunk.id, {
    onPostToolUseHook: async (toolUseId, toolInput, toolResponse) => {
      // 现在我们有：
      // - 原始工具信息
      // - 工具响应
      // 可以进行后处理
    },
  });

  // 3. 发送通知给客户端
  break;
}

// 当看到工具结果时
case "tool_result": {
  const toolUse = toolUseCache[chunk.tool_use_id];
  // 现在我们知道哪个工具返回了这个结果
  break;
}
```

**为什么这个模式重要？**
1. **工具链路追踪** - 知道每个结果来自哪个工具
2. **后处理能力** - 可以在工具执行后做特殊处理
3. **用户反馈** - 可以显示哪个工具被调用和执行了

#### 不追踪的问题

```typescript
// 如果没有 toolUseCache
case "tool_result": {
  // 我们不知道这个结果来自哪个工具！
  // 无法给用户显示有意义的信息
  console.log("Tool returned something...");  // 太模糊
}
```

---

### 5. 消息类型处理

#### 完整的消息类型树

```
Message
├─ SystemMessage
│  ├─ init: 初始化完成
│  ├─ compact_boundary: 对话压缩边界
│  ├─ hook_response: 钩子执行响应
│  └─ status: 状态更新
│
├─ ResultMessage
│  ├─ success: 成功完成
│  ├─ error_during_execution: 执行错误
│  ├─ error_max_turns: 达到最大轮数
│  ├─ error_max_budget_usd: 达到预算限制
│  └─ error_max_structured_output_retries: 重试次数超限
│
├─ StreamEventMessage
│  └─ event: ContentBlockStartEvent | ContentBlockDeltaEvent | ...
│
├─ UserMessage
│  └─ message: { role: "user", content: [...] }
│
├─ AssistantMessage
│  └─ message: { role: "assistant", content: [...] }
│
├─ ToolProgressMessage
│  └─ tool_use_id, tool_name, status
│
└─ AuthStatusMessage
   └─ 认证状态信息
```

#### 必须处理的消息类型

```typescript
// 1. stream_event - 实时更新
// 必须：立即发送给客户端
case "stream_event":
  for (const notif of streamEventToAcpNotifications(...)) {
    await client.sessionUpdate(notif);
  }
  break;

// 2. result - 最终结果
// 必须：检查状态并返回 PromptResponse
case "result":
  if (message.subtype === "success") {
    return { stopReason: "end_turn" };
  }
  break;

// 3. user/assistant - 完整消息
// 可选：如果不在 stream_event 中处理
case "user":
case "assistant":
  // 通常被 stream_event 覆盖
  break;

// 4. system - 系统事件
// 通常：忽略或日志记录
case "system":
  break;

// 5. tool_progress - 工具进度
// 通常：忽略
case "tool_progress":
  break;

// 6. auth_status - 认证状态
// 通常：忽略
case "auth_status":
  break;
```

---

### 6. 会话管理方式

#### Zed 的三种会话创建方式

```typescript
// 1. 新会话
async newSession(params: NewSessionRequest) {
  const sessionId = randomUUID();
  // 创建新的 Query 对象
}

// 2. 恢复会话
async unstable_resumeSession(params: ResumeSessionRequest) {
  return this.createSession(
    { cwd: params.cwd, mcpServers: params.mcpServers },
    { resume: params.sessionId }  // 告诉 SDK 使用现有会话 ID
  );
}

// 3. Fork 会话（创建分支）
async unstable_forkSession(params: ForkSessionRequest) {
  return this.createSession(
    { cwd: params.cwd, mcpServers: params.mcpServers },
    { resume: params.sessionId, forkSession: true }
  );
}
```

**关键概念：**
- `resume: undefined` → 创建新会话
- `resume: existingId` → 恢复或分支现有会话
- `forkSession: true` → 基于现有会话创建分支（带独立历史）

---

## 最佳实践清单

### 必做事项

- [x] 重定向 console 输出到 stderr
- [x] 实现流式事件实时处理
- [x] 使用 ToolUseCache 追踪工具调用
- [x] 实现权限检查回调 `canUseTool()`
- [x] 为每个会话生成唯一 ID
- [x] 检查会话存在性
- [x] 处理取消请求 `query.interrupt()`
- [x] 处理身份验证错误
- [x] 注册钩子监控工具执行

### 不要做

- [ ] 使用 console.log 输出信息
- [ ] 缓冲完整消息后再发送
- [ ] 忽略权限检查
- [ ] 重复会话 ID
- [ ] 假设会话总是存在
- [ ] 同步处理异步操作
- [ ] 在权限检查中捕获所有异常
- [ ] 修改客户端的 requestPermission 响应

---

## 性能优化建议

### 1. 并行处理多个会话

```typescript
// ✅ 好的做法
this.sessions = {
  [sessionId1]: { query: q1, ... },
  [sessionId2]: { query: q2, ... },
  [sessionId3]: { query: q3, ... },
};

// 每个会话独立运行
const promises = Object.values(this.sessions).map(session =>
  processSession(session)
);
await Promise.all(promises);
```

### 2. 高效的工具追踪

```typescript
// ✅ 好的做法 - O(1) 查找
toolUseCache[id] = toolUse;
const tool = toolUseCache[id];  // O(1)

// ❌ 差的做法 - O(n) 查找
tools.find(t => t.id === id);  // O(n)
```

### 3. 及时清理资源

```typescript
// 会话完成后清理
if (message.type === "result") {
  // 清理工具缓存
  Object.keys(this.toolUseCache).forEach(id => {
    if (isFromThisSession(id)) {
      delete this.toolUseCache[id];
    }
  });

  // 删除会话
  delete this.sessions[sessionId];
}
```

---

## 常见错误和修复

### 错误1：忘记推送初始消息

```typescript
// ❌ 错误
const q = query({ prompt: input, options });
// 开始迭代但没有推送任何消息
for await (const msg of q) { /* ... */ }  // 永远等待

// ✅ 正确
const q = query({ prompt: input, options });
input.push({ type: "user", message: {...} });  // 先推送
for await (const msg of q) { /* ... */ }  // 现在会接收消息
```

### 错误2：丢弃 stream_event 消息

```typescript
// ❌ 错误
case "stream_event":
  // 忽略流式事件
  break;  // 用户看不到任何东西!

// ✅ 正确
case "stream_event":
  for (const notif of streamEventToAcpNotifications(...)) {
    await client.sessionUpdate(notif);
  }
  break;  // 用户看到实时更新
```

### 错误3：权限检查中的死锁

```typescript
// ❌ 错误
canUseTool() {
  return async (toolName) => {
    // 在权限检查中再次调用 query
    const result = await this.query.next();  // 死锁!
    return { behavior: "allow" };
  };
}

// ✅ 正确
canUseTool() {
  return async (toolName) => {
    // 只与客户端通信，不与 query 通信
    const response = await this.client.requestPermission(...);
    return { behavior: "allow" };
  };
}
```

### 错误4：忽视 signal.aborted

```typescript
// ❌ 错误
canUseTool() {
  return async (toolName, toolInput, { signal }) => {
    const response = await this.client.requestPermission(...);
    return { behavior: "allow" };  // 可能太晚了
  };
}

// ✅ 正确
canUseTool() {
  return async (toolName, toolInput, { signal }) => {
    const response = await this.client.requestPermission(...);

    if (signal.aborted) {
      throw new Error("Tool use aborted");
    }

    return { behavior: "allow" };
  };
}
```

### 错误5：工具缓存中的内存泄漏

```typescript
// ❌ 错误
case "tool_use": {
  this.toolUseCache[chunk.id] = chunk;  // 永远不删除！
  // 缓存无限增长，内存溢出
  break;
}

// ✅ 正确
case "tool_use": {
  this.toolUseCache[chunk.id] = chunk;
  // 在会话结束时清理
  break;
}

async prompt(params) {
  // ... 处理消息 ...

  if (message.type === "result") {
    // 清理该会话的工具缓存
    const sessionTools = Object.keys(this.toolUseCache)
      .filter(id => toolUseBelongsToSession(id, params.sessionId));
    sessionTools.forEach(id => delete this.toolUseCache[id]);
  }
}
```

---

## 总结

关键要点：
1. **Query 是异步迭代器** - 必须提供异步可迭代的输入流
2. **流式优于缓冲** - 立即处理流式事件提供更好的 UX
3. **权限很重要** - 实现 canUseTool 回调确保安全
4. **追踪工具执行** - 使用 toolUseCache 匹配调用和结果
5. **管理会话状态** - 为每个会话维护独立的状态
6. **处理所有消息类型** - 不要忽视任何消息
7. **实时日志** - 输出到 stderr，不要破坏 ACP 协议
