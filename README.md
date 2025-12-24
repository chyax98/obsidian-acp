# Obsidian ACP Plugin

在 Obsidian 中使用 AI Agent，让 AI 理解并操作你的知识库。

## 功能特性

- **多 Agent 支持**: Claude Code, Goose, OpenCode, 自定义 Agent
- **文件操作**: AI 可读写 Vault 中的文件
- **@ 引用文件**: 输入 `@` 弹出文件搜索，快速引用笔记
- **拖拽文件**: 从文件树拖拽到聊天输入框
- **选中文本发送**: 命令面板发送选中文本到 Chat
- **斜杠命令**: 输入 `/` 显示可用命令（由 Agent 动态提供）
- **模式切换**: 支持 default / plan 等模式
- **权限控制**: 每次询问 / 完全信任 两种模式
- **会话历史**: 保存和加载历史对话
- **导出对话**: 导出为 Markdown 文件
- **MCP 能力感知**: 根据 Agent 能力自动过滤 MCP 服务器

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

### 支持的 Agent

| Agent | 启动命令 | 说明 |
|-------|---------|------|
| Claude Code | `npx @zed-industries/claude-code-acp` | 默认，无需安装 |
| Goose | `goose acp` | 需安装 Goose |
| OpenCode | `opencode acp` | 需安装 OpenCode |
| 自定义 | 用户配置 | 任意 ACP 兼容 CLI |

### 可选配置

- **Base URL**: 自定义 API 端点（代理/中转）
- **HTTP Proxy**: 代理服务器地址
- **请求超时**: 默认 5 分钟

## 使用

1. 点击左侧工具栏的 ACP 图标打开聊天面板
2. 选择 Agent（每个标签页可独立选择）
3. 点击「连接」或直接发送消息
4. 开始对话

### 快捷操作

- `@` - 引用文件
- `/` - 斜杠命令
- 拖拽文件到输入框 - 添加文件引用
- `Enter` - 发送消息
- `Shift + Enter` - 换行

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
