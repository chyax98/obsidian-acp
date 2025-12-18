# Task T01: 项目初始化与依赖配置

> 📅 执行时间: 2025-12-18
> 🔒 执行者: Claude-Terminal-E947
> 📊 预估 Token: 8k

---

## 任务目标

将 Obsidian 模板项目重构为 ACP 插件项目结构，建立清晰的目录组织和现代化的依赖配置。

---

## 技术方案

### 1. manifest.json 更新

```json
{
  "id": "obsidian-acp",
  "name": "ACP Agent Client",
  "version": "0.1.0",
  "minAppVersion": "1.0.0",
  "description": "Agent Client Protocol integration for Obsidian - Connect with Claude Code, Codex, Gemini and more AI agents",
  "author": "ACP Plugin Team",
  "isDesktopOnly": true
}
```

**关键变更**:
- `id`: 改为 `obsidian-acp`
- `isDesktopOnly`: 必须为 `true`，因为 ACP 需要子进程通信（Node.js child_process）
- `minAppVersion`: 提升到 `1.0.0` 以确保 API 稳定性

### 2. package.json 更新

```json
{
  "name": "obsidian-acp",
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0"
  }
}
```

**关键变更**:
- `@types/node`: 升级到 20.x，支持现代 Node.js API
- `typescript`: 升级到 5.x，支持 satisfies、const 类型参数等特性

### 3. 目录结构

```
src/
├── acp/           # ACP 协议核心模块
│   ├── types/     # 类型定义 (T02)
│   ├── backends/  # Agent 后端配置 (T03)
│   └── core/      # 连接与会话管理 (T05-T07)
├── ui/            # UI 组件
│   ├── views/     # ItemView 实现 (T09)
│   ├── components/# 可复用组件 (T10-T12)
│   └── modals/    # 弹窗组件 (T11)
├── settings/      # 设置相关 (T13)
└── main.ts        # 插件入口
```

### 4. main.ts 重构

```typescript
// 核心变更：
// - 类名: MyPlugin → AcpPlugin
// - 移除所有示例代码
// - 保留设置框架
// - 添加 ChatView 注册预留
```

---

## 测试计划

### 编译测试
```bash
npm run build
# 期望: 无 TypeScript 错误，生成 main.js
```

### 类型检查
```bash
npx tsc --noEmit
# 期望: 无类型错误
```

### Lint 检查
```bash
npx eslint . --ext .ts
# 期望: 无 lint 错误 (或只有 warning)
```

---

## 实施检查清单

- [x] 更新 `manifest.json`
- [x] 更新 `package.json`
- [x] 创建 `src/` 目录结构
- [x] 创建 `src/main.ts` (重构后的入口)
- [x] 移动/删除原 `main.ts`
- [x] 更新 `esbuild.config.mjs` 入口点
- [x] 更新 `tsconfig.json` 排除 tmp 目录
- [x] 运行 `npm install`
- [x] 运行 `npm run build` 验证 ✅ 成功

---

## 风险与注意事项

1. **esbuild 配置**: 需要更新入口点从 `main.ts` 到 `src/main.ts`
2. **Git 冲突**: 若其他 Agent 也在修改配置文件，需注意合并
3. **依赖兼容**: TypeScript 5.x 与 ESLint 旧版本可能不兼容，需同步升级
