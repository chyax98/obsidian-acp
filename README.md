# Obsidian ACP Plugin

在 Obsidian 中连接 ACP 兼容的 AI Agent，读写笔记并完成辅助工作流。

## 核心特性

- 多 Agent：Claude Code、Goose、OpenCode、Gemini CLI（可覆盖 CLI 路径）
- 文件操作：支持 Vault 读写，权限弹窗/完全信任两种模式
- 上下文引用：`@` 引用文件、拖拽文件、斜杠命令
- UI：Plan / Thought / ToolCall 渲染，会话历史与 Markdown 导出
- MCP 能力感知：按 Agent 能力过滤 MCP 服务器

## 安装

1. 从 Releases 下载最新包，解压到 Vault 的 `.obsidian/plugins/obsidian-acp/`，在设置中启用。
2. 或手动构建并拷贝产物：
   ```bash
   git clone https://github.com/YOUR_USERNAME/obsidian-acp.git
   cd obsidian-acp
   npm install
   npm run build
   cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/obsidian-acp/
   ```

## 配置

- 支持的 Agent（默认命令，可在设置页填写绝对路径覆盖）：
  - Claude Code: `npx @zed-industries/claude-code-acp`
  - Goose: `goose acp`
  - OpenCode: `opencode acp`
  - Gemini CLI: `gemini --experimental-acp`
- Anthropic API Key（仅 Claude Code 使用）：环境变量 `ANTHROPIC_API_KEY` 或设置页填写；Claude Pro/Max 登录也可用。
- 可选（Claude Code 专用）：自定义 API Base URL、HTTP(S) 代理、请求超时（默认 5 分钟）。
- 其他 Agent 的认证与环境变量按各自 CLI 约定在系统环境或配置文件中完成。

## 使用

1. 打开左侧 ACP 面板，选择 Agent，点击「连接」。
2. 在输入框输入问题或拖入文件，使用 `@` 引用笔记后回车发送。
3. 需要文件写入时按弹窗确认；完全信任模式会自动放行。
4. 会话历史可保存/加载，支持导出为 Markdown。

### 快捷操作

- `@` 引用文件；`/` 斜杠命令；拖拽文件到输入框。
- `Enter` 发送，`Shift + Enter` 换行。

### 权限模式

| 模式 | 说明 |
|------|------|
| 每次询问 | 每次读写操作弹窗确认 |
| 完全信任 | 自动允许所有操作 |

## 文档

- 架构概览：`docs/ARCHITECTURE.md`
- 更新记录：`CHANGELOG.md`

## 许可证

MIT
