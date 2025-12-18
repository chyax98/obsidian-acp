# Task T04: CLI 检测器

> 📅 执行时间: 2025-12-18
> 🔒 执行者: Claude-Terminal-914A
> 📊 预估 Token: 15k

---

## 任务目标

实现 ACP CLI 检测器，自动发现用户系统中已安装的 Agent CLI 工具。

---

## 技术方案

### 文件结构

```
src/acp/
├── detector.ts      # CLI 检测器实现
└── backends/        # (已完成) 后端配置
```

### 检测流程

1. 获取可检测 CLI 列表 (`getDetectableClis()`)
2. 并行执行 `which <cmd>` (Unix) 或 `where <cmd>` (Windows)
3. 收集检测结果，包含路径信息
4. 缓存结果避免重复检测

### 核心 API

```typescript
// 初始化检测 (启动时调用一次)
await cliDetector.detect();

// 获取已安装的 Agent
const agents = cliDetector.getDetectedAgents();

// 检查特定后端是否可用
const hasClaudeCli = cliDetector.isBackendAvailable('claude');
```

---

## 实施检查清单

- [x] 创建 `src/acp/detector.ts`
- [x] 实现 `which/where` 检测逻辑
- [x] 实现版本检测 (可选)
- [x] 实现单例模式和缓存
- [x] 运行 `npm run build` 验证 ✅ 成功

---

## 注意事项

1. **跨平台**: Windows 用 `where`，Unix 用 `which`
2. **超时处理**: 检测命令设置 1 秒超时
3. **错误处理**: CLI 不存在时静默处理，不抛错
4. **性能**: 并行检测，启动时只执行一次
