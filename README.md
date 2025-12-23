# Obsidian ACP Plugin

在 Obsidian 中使用 Claude Code，让 AI 理解并操作你的知识库。

## 功能特性

- **Claude Code 集成**: 通过 ACP 协议连接 Claude Code
- **文件操作**: AI 可读写 Vault 中的文件
- **@ 引用文件**: 输入 `@` 弹出文件搜索，快速引用笔记
- **拖拽文件**: 从文件树拖拽到聊天输入框
- **选中文本发送**: 命令面板发送选中文本到 Chat
- **斜杠命令**: 输入 `/` 显示可用命令
- **模式切换**: 支持 default / plan 模式
- **权限控制**: 每次询问 / 完全信任 两种模式
- **会话历史**: 保存和加载历史对话
- **导出对话**: 导出为 Markdown 文件

## 安装

1. 下载最新 release
2. 解压到 Vault 的 `.obsidian/plugins/obsidian-acp/`
3. 在 Obsidian 设置中启用插件

## 配置

### 前置要求

需要设置 Anthropic API Key（三选一）：

```bash
# 方式 1：环境变量
export ANTHROPIC_API_KEY="sk-ant-..."

# 方式 2：插件设置页面填写

# 方式 3：使用 Claude Pro/Max 订阅（OAuth 登录）
```

### 启动方式

插件支持两种启动方式（设置页面选择）：

| 方式 | 命令 | 说明 |
|------|------|------|
| npx（默认） | `npx @anthropic-ai/claude-code --acp` | 无需安装，每次自动获取最新版 |
| 全局安装 | `claude --acp` | 需先运行 `npm i -g @anthropic-ai/claude-code` |

### 可选配置

- **Base URL**: 自定义 API 端点（代理/中转）
- **HTTP Proxy**: 代理服务器地址

## 使用

1. 点击左侧工具栏的 ACP 图标打开聊天面板
2. 点击「连接」启动 Claude Code
3. 开始对话

### 快捷操作

- `@` - 引用文件
- `/` - 斜杠命令
- 拖拽文件到输入框 - 添加文件引用
- `Cmd/Ctrl + Enter` - 发送消息

### 权限系统

| 模式 | 说明 |
|------|------|
| 每次询问 | 文件读写操作弹窗确认 |
| 完全信任 | 自动允许所有操作 |

## 开发

```bash
npm run dev          # 开发模式
npm run build        # 构建
./dev-deploy.sh      # 部署到测试 Vault
```

## 许可证

MIT

---

**Version**: 1.0.0
