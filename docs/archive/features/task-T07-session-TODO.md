# Task T07: 会话生命周期管理

> 📅 执行时间: 2025-12-18
> 🔒 执行者: Claude-Terminal-5F45
> 📊 预估 Token: 15k

---

## 任务目标

创建高层 SessionManager 类，管理会话状态机、消息历史和回合生命周期。

---

## 技术方案

### 文件结构

```
src/acp/core/
├── index.ts           # 导出入口 (更新)
├── connection.ts      # AcpConnection (底层)
├── request-queue.ts   # RequestQueue
└── session-manager.ts # SessionManager (新建)
```

### 会话状态机

```
idle ──► processing ──► idle
  │          │
  │          ▼
  │      cancelled ──► idle
  │          ▲
  └──────────┘ (cancel during idle returns to idle)
```

### SessionManager 功能

1. **状态管理**
   - `idle`: 空闲，可接收新 prompt
   - `processing`: 处理中，等待响应
   - `cancelled`: 已取消

2. **消息历史**
   - 用户消息
   - Agent 消息
   - 工具调用记录

3. **回合管理**
   - 开始回合 (sendPrompt)
   - 取消回合 (cancel)
   - 回合完成 (end_turn/cancelled/etc)

### API 设计

```typescript
class SessionManager {
  // 状态
  get state(): SessionState;
  get sessionId(): string | null;
  get messages(): Message[];

  // 会话操作
  async start(workingDir: string): Promise<void>;
  async sendPrompt(text: string): Promise<StopReason>;
  async cancel(): Promise<void>;
  end(): void;

  // 事件
  onMessage: (msg: Message) => void;
  onToolCall: (tool: ToolCallUpdate) => void;
  onStateChange: (state: SessionState) => void;
}
```

---

## 实施检查清单

- [x] 创建 `src/acp/core/session-manager.ts`
- [x] 实现会话状态机
- [x] 实现消息历史管理
- [x] 实现回合生命周期
- [x] 更新 `src/acp/core/index.ts` 导出
- [x] 运行 `npm run build` 验证 ✅ 成功

---

## 参考

- 协议文档: `tmp/agent-client-protocol/docs/protocol/session-setup.mdx`
- 协议文档: `tmp/agent-client-protocol/docs/protocol/prompt-turn.mdx`
- 现有实现: `src/acp/core/connection.ts`
