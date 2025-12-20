# Task T08: 文件操作处理器

> 📅 执行时间: 2025-12-18
> 🔒 执行者: Claude-Terminal-5F45
> 📊 预估 Token: 12k

---

## 任务目标

创建独立的文件操作处理器，集成 Obsidian Vault API，处理 Agent 的文件读写请求。

---

## 技术方案

### 文件结构

```
src/acp/
├── core/              # 核心模块
├── file-handler.ts    # 文件操作处理器 (新建)
└── index.ts           # 主导出 (更新)
```

### FileOperationHandler 功能

1. **文件读取**
   - 支持 line/limit 参数
   - 优先使用 Obsidian Vault API
   - 降级到 Node.js fs

2. **文件写入**
   - 自动创建目录
   - Vault 内文件使用 Vault API
   - Vault 外文件使用 Node.js fs

3. **路径处理**
   - 相对路径解析
   - Vault 路径判断
   - 安全检查

4. **操作历史**
   - 记录所有文件操作
   - 支持查询和清空

### API 设计

```typescript
class FileOperationHandler {
  constructor(vault: Vault, workingDir: string);

  // 文件操作
  async readFile(params: ReadFileParams): Promise<ReadFileResult>;
  async writeFile(params: WriteFileParams): Promise<void>;

  // 路径工具
  resolvePath(path: string): string;
  isVaultPath(path: string): boolean;

  // 历史管理
  get history(): FileOperationRecord[];
  clearHistory(): void;
}
```

---

## 实施检查清单

- [x] 创建 `src/acp/file-handler.ts`
- [x] 实现文件读取 (Vault + fs)
- [x] 实现文件写入 (Vault + fs)
- [x] 实现路径解析和安全检查
- [x] 实现操作历史记录
- [x] 创建 `src/acp/index.ts` 模块入口
- [x] 运行 `npm run build` 验证 ✅ 成功

---

## 参考

- 协议文档: `tmp/agent-client-protocol/docs/protocol/file-system.mdx`
- 现有实现: `src/acp/core/connection.ts` (handleReadFile/handleWriteFile)
