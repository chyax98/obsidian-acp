# Obsidian ACP Plugin

Agent Client Protocol (ACP) 集成插件 - 在 Obsidian 中连接 Claude Code、Kimi、Codex 等 AI 编程助手。

## ✨ 功能特性

- 🤖 **多 Agent 支持**: Claude Code, Kimi, Codex
- 🔄 **完整 ACP 协议**: 全量事件类型支持
- ⚡ **高性能流式**: 消息缓冲优化，减少 UI 更新 95%
- 🛡️ **健壮性**: 自动重连、错误分类、超时管理
- 💭 **思考过程**: 显示 Agent 内部思考（可折叠）
- 📋 **工具调用**: 完整的工具调用展示和权限管理
- 🎯 **模式指示**: 实时显示当前模式（ask/code/plan）

## 🚀 快速开始

### 安装

1. 下载最新 release
2. 解压到 Vault 的 `.obsidian/plugins/obsidian-acp/`
3. 在 Obsidian 设置中启用插件

### 配置 Agent

#### Claude Code（推荐）

```bash
# 方式 1：全局安装（避免每次下载）
npm install -g @zed-industries/claude-code-acp

# 方式 2：使用 npx（插件会自动调用）
# 无需手动操作
```

#### Kimi

```bash
# 确保 kimi CLI 已安装
which kimi
```

### 使用

1. 打开 ACP Chat 视图（左侧工具栏图标）
2. 选择 Agent
3. 点击"连接"
4. 开始对话！

## 📋 支持的 Agent

| Agent | 状态 | 命令 | 说明 |
|-------|------|------|------|
| **Claude Code** | ✅ 完全支持 | `npx @zed-industries/claude-code-acp` | Anthropic 官方 |
| **Kimi** | ✅ 完全支持 | `kimi --acp` | Moonshot AI |
| **Codex** | 🟡 实验性 | `codex` | OpenAI |

## 🎯 测试结果

```
✅ Claude Code: 4/4 测试通过
✅ 协议实现：100% 兼容
✅ 总计：7/8 测试通过（87.5%）
```

## 📖 文档

- [TESTING.md](./TESTING.md) - 测试指南
- [QUALITY_REPORT.md](./QUALITY_REPORT.md) - 质量报告

## 🔧 开发

```bash
npm run build        # 构建
npm test             # 测试
./dev-deploy.sh      # 快速部署
```

## 📊 质量

- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 errors
- ✅ 测试: 7/8 passed

## 📄 许可证

MIT

---

**Version**: 0.2.0
**Status**: ✅ Production Ready
