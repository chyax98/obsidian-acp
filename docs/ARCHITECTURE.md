# 架构概览

简要说明 Obsidian ACP Plugin 的组成与数据流，便于快速定位代码与排查问题。

## 分层

- **插件入口** (`src/main.ts`): 注册视图、设置页和命令，初始化 ACP 子系统。
- **ACP 核心** (`src/acp/core/*`, `src/acp/permission-manager.ts`):
  - `AcpConnection` 通过子进程与 Agent CLI 建立 JSON-RPC (stdio) 通信。
  - `SessionManager`/`RequestQueue` 负责会话生命周期、排队与超时处理。
  - `MessageBuffer`、`session-storage`、`session-export` 处理流式输出、历史与导出。
  - `file-handler`/`permission-manager` 负责 Vault 读写与权限决策，必要时降级到 Node `fs`。
  - `mcp-config` 根据 Agent 声明过滤 MCP 服务器。
- **Agent 注册表** (`src/acp/backends/*`): 内置 Claude Code / Goose / OpenCode / Gemini CLI 配置，统一启动命令与能力声明，支持手动覆盖 CLI 路径。
- **UI 层** (`src/ui/*`): ChatView、各类渲染器（消息、Plan、ToolCall、终端、思考过程），以及设置、权限、会话历史、MCP 服务器选择等对话框。

## 数据流

1. 用户在 ChatView 中输入、选择模式或拖拽文件。
2. `SessionManager` 生成请求，经 `RequestQueue` 送入 `AcpConnection`。
3. `AcpConnection` 启动 Agent CLI（如 `npx @zed-industries/claude-code-acp`、`goose acp`、`opencode acp`、`gemini --experimental-acp`），通过 stdio 交换 JSON-RPC 消息。
4. Agent 返回的 `session_update`（消息、思考、Plan、ToolCall、模式/命令更新等）由 `SessionManager` 分发给 UI 渲染器。
5. 涉及写入/删除时触发权限对话框，通过 `permission-manager` 校验后由 `file-handler` 执行。

## 边界与取舍

- 仅展示终端输出，不提供交互式终端。
- Session 模式以 Agent 能力为准，当前覆盖 default/plan 场景。
- 不支持音频输入；图像/嵌入上下文依 Agent 能力声明。
- 优先使用 Obsidian Vault API，Vault 外文件仅在必要时使用 Node `fs`。

## 目录速览

- `src/main.ts` — 插件入口与设置注册。
- `src/acp/core/*` — 连接、排队、缓冲、存储、MCP 过滤与文件处理。
- `src/acp/backends/*` — Agent 配置与能力声明。
- `src/ui/*` — ChatView、渲染器、对话框与设置页面。
- `styles.css` — 渲染器与对话框样式。
