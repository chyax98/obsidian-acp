# Task T05: AcpConnection 核心类

> 📅 执行时间: 2025-12-18
> 🔒 执行者: Claude-Terminal-5F45
> 📊 预估 Token: 25k

---

## 任务目标

实现 ACP 连接核心类，负责子进程管理、JSON-RPC 通信、协议初始化等核心功能。

---

## 技术方案

### 文件结构

```
src/acp/core/
├── index.ts        # 导出入口
└── connection.ts   # AcpConnection 主类
```

### 核心功能

1. **子进程管理**
   - spawn CLI 进程
   - stdio 通信
   - 进程生命周期

2. **JSON-RPC 通信**
   - 请求/响应匹配
   - 通知处理
   - 超时管理

3. **协议流程**
   - initialize 握手
   - authenticate 认证
   - session/new 会话创建
   - session/prompt 发送提示

### 事件回调

```typescript
// 会话更新
onSessionUpdate: (data: SessionNotificationParams) => void

// 权限请求
onPermissionRequest: (data: RequestPermissionParams) => Promise<PermissionOutcome>

// 文件操作
onFileOperation: (op: FileOperation) => void
```

---

## 实施检查清单

- [x] 创建 `src/acp/core/connection.ts`
- [x] 实现子进程 spawn 与管理
- [x] 实现 JSON-RPC 请求/响应
- [x] 实现超时管理
- [x] 实现 initialize/authenticate
- [x] 实现 session/new, session/prompt
- [x] 创建 `src/acp/core/index.ts`
- [x] 运行 `npm run build` 验证 ✅ 成功

---

## 参考

- AionUi: `tmp/AionUi/src/agent/acp/AcpConnection.ts`
- ACP 协议: https://agentclientprotocol.com
