# Task T06: 请求/响应队列管理

> 📅 执行时间: 2025-12-18
> 🔒 执行者: Claude-Terminal-5F45
> 📊 预估 Token: 18k

---

## 任务目标

将请求队列逻辑从 AcpConnection 提取为独立模块，提高可测试性和代码组织。

---

## 技术方案

### 文件结构

```
src/acp/core/
├── index.ts           # 导出入口 (更新)
├── connection.ts      # AcpConnection (重构使用 RequestQueue)
└── request-queue.ts   # RequestQueue 独立模块 (新建)
```

### RequestQueue 功能

1. **请求生命周期管理**
   - 创建请求 (自动分配 ID)
   - 完成请求 (resolve/reject)
   - 超时管理

2. **超时控制**
   - 暂停/恢复超时
   - 按方法名批量暂停

3. **队列查询**
   - 获取待处理请求数
   - 按方法名查询
   - 清空队列

### API 设计

```typescript
class RequestQueue {
  // 创建请求
  create<T>(method: string, timeoutMs: number): {
    id: number;
    promise: Promise<T>;
  }

  // 完成请求
  resolve(id: number, value: unknown): void;
  reject(id: number, error: Error): void;

  // 超时控制
  pauseTimeout(id: number): void;
  resumeTimeout(id: number): void;
  pauseByMethod(method: string): void;
  resumeByMethod(method: string): void;

  // 队列管理
  get size(): number;
  has(id: number): boolean;
  clear(): void;
}
```

---

## 实施检查清单

- [x] 创建 `src/acp/core/request-queue.ts`
- [x] 实现 RequestQueue 类
- [x] 重构 AcpConnection 使用 RequestQueue
- [x] 更新 `src/acp/core/index.ts` 导出
- [x] 运行 `npm run build` 验证 ✅ 成功

---

## 参考

- 现有实现: `src/acp/core/connection.ts`
- AionUi: `tmp/AionUi/src/agent/acp/AcpConnection.ts`
