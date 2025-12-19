# 快速使用指南

> 快速参考手册，常用操作和示例。详细文档请查看 [docs/](./docs/) 目录。

## 📋 支持的 5 个 Agent

| Agent | 特点 | 免费？ |
|-------|------|--------|
| **Claude Code** | 编程能力最强 | ❌ 需订阅 |
| **Kimi** | 中文友好 | ✅ 有免费额度 |
| **Codex ACP** | OpenAI Codex | ❌ 需订阅 |
| **Gemini CLI** | Google 官方，ACP 参考实现 | ✅ 有免费额度 |
| **Qwen Code** | 阿里通义千问，中文优秀 | ✅ 完全免费 |

**推荐新手**：从 Qwen Code（完全免费）或 Gemini CLI（有免费额度）开始。

## 🚀 连接 Agent

1. **选择 Agent**
   - 在 ChatView 顶部下拉框选择 Agent
   - 5 个 Agent 都可选择（需先安装对应 CLI）
   - 如果下拉框为空，查看 [Agent 配置指南](./docs/AGENT_SETUP.md)

2. **点击连接**
   - 点击 "连接" 按钮
   - 等待状态变为 "已连接" (约 3-5 秒)
   - 如果失败，查看控制台日志 (Cmd/Ctrl + Shift + I)

3. **开始对话**
   - 在输入框输入问题
   - 按 Enter 或点击发送
   - 等待 Agent 回复

## 示例对话

### 简单测试
```
你好，请介绍一下你自己
```

### 文件分析
```
帮我分析 README.md 文件，总结主要内容
```

### 创建笔记
```
在 notes/ 目录下创建一个名为 "测试笔记.md" 的文件，内容为：
# 测试笔记

这是一个测试文件，创建于 2025-12-18。
```

**注意**: 第一次文件操作会弹出权限请求，点击"允许一次"即可。

### 批量操作
```
遍历 notes/ 目录下所有 .md 文件，为没有 frontmatter 的文件添加：
---
created: 2025-12-18
tags: []
---
```

## 权限处理

当 Agent 需要访问文件时，会弹出权限窗口：

**推荐设置**:
- 文件读取: 选择 "始终允许" (安全)
- 文件写入: 选择 "允许一次" (谨慎)
- 命令执行: 仔细检查命令再批准

**自动批准** (可选):
- 设置 → ACP Agent Client → 启用 "自动批准文件读取"
- 这样读取文件不再弹窗，但写入仍需确认

## 常见问题

### Agent 检测不到？
```bash
# macOS 从终端启动 Obsidian (继承环境变量)
export ANTHROPIC_API_KEY="your-api-key-here"
open -a Obsidian

# 或在设置中手动配置路径
# 设置 → ACP Agent Client → Claude Code (claude)
# 输入: npx @zed-industries/claude-code-acp
```

### 连接失败？
```bash
# 检查 API Key
echo $ANTHROPIC_API_KEY

# 测试 CLI
npx @zed-industries/claude-code-acp --version

# 设置 API Key (如果未配置)
export ANTHROPIC_API_KEY="your-api-key-here"
```

### 查看详细日志
打开开发者工具 (Cmd/Ctrl + Shift + I)，在 Console 中查看 `[ACP]` 开头的日志。

## 高级配置

### 设置工作目录
设置 → ACP Agent Client → 工作目录模式:
- **Vault 根目录**: Agent 可以访问整个 Vault
- **当前笔记文件夹**: 限制在当前文件夹 (更安全)
- **自定义路径**: 指定项目目录

推荐: Vault 根目录

### 配置多个 Agent
可以安装多个 Agent CLI，在下拉框中切换：
- Claude Code (推荐，功能最强)
- Qwen Code (中文友好)
- Goose (开源，无需 API Key)

---

**祝使用愉快！** 🎉
