# T14: 会话持久化 - 任务清单

> 📅 开始时间: 2025-12-18
> 👤 执行者: Claude-Agent-T14
> 📦 文件位置: `src/acp/session-storage.ts`

---

## 📋 任务目标

实现会话历史的本地存储和恢复功能，使用 Obsidian 的 plugin data API。

## ✅ 核心功能

- [x] 定义 `StoredSession` 接口
- [x] 实现 `SessionStorage` 类
- [x] 实现 `saveSession()` 保存会话
- [x] 实现 `loadSession()` 加载会话
- [x] 实现 `listSessions()` 会话列表
- [x] 实现 `deleteSession()` 删除会话
- [x] 实现 `clearOldSessions()` 清理旧会话
- [x] 限制存储的会话数量

## 📦 文件清单

- [x] `src/acp/session-storage.ts` - SessionStorage 类
- [x] `src/acp/index.ts` - 导出更新

## 🏗️ 实施状态

- [x] 创建任务文档
- [x] 实现 SessionStorage 类
- [x] 构建验证
- [x] 任务完成

## 📝 实施笔记

### 存储格式

```typescript
interface StoredSession {
  id: string;
  backendId: AcpBackendId;
  workingDir: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}
```

### 存储策略

- 使用 Obsidian Plugin.loadData() / Plugin.saveData() API
- 所有会话存储在单个 JSON 文件中
- 限制最大存储会话数量 (默认 50)
- 支持手动清理旧会话

### API 设计

```typescript
class SessionStorage {
  async saveSession(session: StoredSession): Promise<void>;
  async loadSession(id: string): Promise<StoredSession | null>;
  async listSessions(): Promise<StoredSession[]>;
  async deleteSession(id: string): Promise<void>;
  async clearOldSessions(keepCount: number): Promise<void>;
}
```

---

## 🎯 后续集成

- 在 ChatView 中集成 SessionStorage
- 实现会话列表 UI
- 实现自动保存机制

---

**状态**: ✅ 完成
**完成时间**: 2025-12-18
