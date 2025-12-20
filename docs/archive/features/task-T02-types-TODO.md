# Task T02: ACP 类型定义

> 📅 执行时间: 2025-12-18
> 🔒 执行者: Claude-Terminal-3505
> 📊 预估 Token: 12k

---

## 任务目标

定义完整的 ACP (Agent Client Protocol) TypeScript 类型系统，为后续核心模块提供类型安全基础。

---

## 技术方案

### 文件结构

```
src/acp/types/
├── index.ts          # 导出入口
├── jsonrpc.ts        # JSON-RPC 2.0 基础类型
├── initialize.ts     # 初始化与能力协商类型
├── session.ts        # 会话管理类型
├── updates.ts        # 会话更新通知类型
├── permissions.ts    # 权限请求类型
└── errors.ts         # 错误类型
```

### 核心类型概览

#### 1. JSON-RPC 基础 (`jsonrpc.ts`)
```typescript
// JSON-RPC 2.0 协议基础
interface AcpRequest { jsonrpc: '2.0'; id: number; method: string; params?: unknown }
interface AcpResponse { jsonrpc: '2.0'; id: number; result?: unknown; error?: AcpError }
interface AcpNotification { jsonrpc: '2.0'; method: string; params?: unknown }
```

#### 2. 初始化类型 (`initialize.ts`)
```typescript
// 能力协商
interface ClientCapabilities { fs?: { readTextFile?: boolean; writeTextFile?: boolean }; terminal?: boolean }
interface AgentCapabilities { promptCapabilities?: PromptCapabilities; loadSession?: boolean }
```

#### 3. 会话更新类型 (`updates.ts`)
```typescript
// 流式更新类型联合
type SessionUpdate =
  | AgentMessageChunkUpdate
  | AgentThoughtChunkUpdate
  | ToolCallUpdate
  | PlanUpdate
  | AvailableCommandsUpdate
```

---

## 参考资料

- **ACP 官方 Schema**: `tmp/agent-client-protocol/schema/schema.json`
- **AionUi 实现**: `tmp/AionUi/src/types/acpTypes.ts`
- **协议文档**: https://agentclientprotocol.com

---

## 实施检查清单

- [x] 创建 `src/acp/types/jsonrpc.ts` - JSON-RPC 基础类型
- [x] 创建 `src/acp/types/initialize.ts` - 初始化与能力类型
- [x] 创建 `src/acp/types/session.ts` - 会话管理类型
- [x] 创建 `src/acp/types/updates.ts` - 会话更新通知类型
- [x] 创建 `src/acp/types/permissions.ts` - 权限请求类型
- [x] 创建 `src/acp/types/errors.ts` - 错误处理类型
- [x] 创建 `src/acp/types/index.ts` - 统一导出
- [x] 运行 `npm run build` 验证 ✅ 成功

---

## 设计原则

1. **严格类型**: 使用 `as const` 和字面量类型确保类型安全
2. **可扩展**: 保留 `_meta` 字段支持协议扩展
3. **文档化**: 每个类型都有 JSDoc 注释说明用途
4. **参考官方**: 类型命名和结构与官方 schema 保持一致
