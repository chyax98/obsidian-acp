<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Obsidian ACP Plugin

**版本**: 0.3.0
**日期**: 2025-12-23
**状态**: 支持多 Agent (Claude Code, Goose, OpenCode, 自定义)

---

## 项目简介

Obsidian ACP Plugin 通过 ACP (Agent Client Protocol) 协议将多个 AI Agent 集成到 Obsidian 中，让用户在笔记环境中使用 AI 助手。

### 核心特性

- **多 Agent 支持**: Claude Code, Goose, OpenCode, 自定义 Agent
- **文件操作**: AI 可读写 Obsidian Vault 中的文件
- **权限控制**: 2 种模式（每次询问 / 完全信任）
- **@ 引用文件**: 输入 @ 弹出文件搜索
- **拖拽文件**: 从文件树拖拽到聊天输入
- **选中文本**: 命令面板发送选中文本到 Chat
- **斜杠命令**: 输入 / 显示可用命令菜单（动态由 Agent 提供）
- **模式切换**: 支持 default/plan 等模式
- **会话历史**: 保存和加载历史对话
- **导出对话**: 导出为 Markdown 文件
- **MCP 能力感知**: 根据 Agent 能力自动过滤 MCP 服务器

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     Obsidian 插件 (TypeScript)                   │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  ChatView   │───▶│SessionManager│───▶│  AcpConnection   │   │
│  │  (UI 层)    │    │ (会话管理)   │    │ (协议通信层)     │   │
│  └─────────────┘    └──────────────┘    └────────┬─────────┘   │
└───────────────────────────────────────────────────┼─────────────┘
                                                    │
                                         JSON-RPC 2.0 over stdio
                                                    │
                            ┌───────────────────────┼───────────────────────┐
                            ▼                       ▼                       ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐ ┌─────────────┐
│   Claude Code     │ │      Goose        │ │     OpenCode      │ │  自定义 CLI  │
│ (npx claude-acp)  │ │   (goose acp)     │ │  (opencode acp)   │ │             │
└───────────────────┘ └───────────────────┘ └───────────────────┘ └─────────────┘
```

### 目录结构

```
src/
├── main.ts                    # 插件入口
├── acp/
│   ├── core/
│   │   ├── connection.ts      # ACP JSON-RPC 通信
│   │   ├── session-manager.ts # 会话状态管理
│   │   ├── mcp-config.ts      # MCP 配置与能力过滤
│   │   └── message-buffer.ts  # 流式消息缓冲
│   ├── backends/
│   │   ├── types.ts           # 多 Agent 类型定义
│   │   └── registry.ts        # Agent 注册表 (Claude, Goose, OpenCode)
│   └── types/                 # ACP 协议类型
└── ui/
    ├── chat/
    │   ├── ChatView.ts        # 聊天主界面
    │   └── helpers/           # UI 辅助类
    ├── renderers/
    │   ├── message-renderer.ts    # 消息渲染（Markdown + 图片）
    │   ├── tool-call-renderer.ts  # 工具调用卡片
    │   ├── diff-renderer.ts       # Diff 视图
    │   ├── plan-renderer.ts       # Plan 列表
    │   ├── thought-renderer.ts    # 思考过程
    │   └── terminal-renderer.ts   # 终端输出
    ├── FileInputSuggest.ts    # @ 文件引用
    ├── SettingsTab.ts         # 设置页面 (Agent 选择与配置)
    └── PermissionModal.ts     # 权限对话框
```

---

## 开发命令

```bash
# 开发模式（实时编译）
npm run dev

# 构建
npm run build

# 部署到 Vault
./dev-deploy.sh

# 安装到指定 Vault
./install-to-vault.sh /path/to/vault
```

---

## ACP 协议

### 支持的 Agent

| Agent | 启动命令 | ACP 参数 |
|-------|---------|---------|
| Claude Code | `npx @zed-industries/claude-code-acp` | 无 |
| Goose | `goose` | `acp` |
| OpenCode | `opencode` | `acp` |
| 自定义 | 用户配置 | 用户配置 |

### 核心方法

| 方法 | 说明 |
|------|------|
| `initialize` | 初始化连接，交换能力声明 |
| `session/new` | 创建新会话 |
| `session/prompt` | 发送用户消息 |
| `session/update` | 接收流式更新（通知） |
| `session/cancel` | 取消当前请求 |
| `session/set_mode` | 切换会话模式 |
| `fs/readTextFile` | 读取文件 |
| `fs/writeTextFile` | 写入文件 |

### 渲染支持

**SessionUpdate 类型**（全部已实现）：
- `agent_message_chunk` - Agent 消息（Markdown + 图片）
- `agent_thought_chunk` - Agent 思考过程
- `tool_call` / `tool_call_update` - 工具调用卡片
- `plan` - Plan 计划列表
- `available_commands_update` - 可用命令
- `current_mode_update` - 模式更新

**Tool Call Content 类型**（全部已实现）：
- `content` - 文本内容
- `diff` - Diff 视图（带行号、高亮、文件路径点击）
- `terminal` - 终端输出

### 权限系统

- **interactive**: 每次操作询问用户
- **trustAll**: 完全信任，自动允许所有操作
- **alwaysAllowedTools**: 记住用户选择的"始终允许"

---

## 代码规范

### TypeScript

- 0 TypeScript errors (强制)
- 尽量避免 `any` 类型
- 所有 public 方法需要 JSDoc

### ACP 协议类型

- **ToolCallStatus**: `'pending' | 'in_progress' | 'completed' | 'failed'`
- **禁止使用**: `'error'`, `'cancelled'`

---

## 明确拒绝的功能

以下功能已被明确拒绝，不要实现：

1. **Agent 自动检测** - 用户手动选择 Agent，不自动检测
2. **"始终拒绝" 按钮** - 笔记场景不需要
3. **复杂权限规则** - 只需要 2 种模式
4. **Terminal 交互** - Obsidian 不是 IDE，只显示输出不支持交互

---

## Bug 修复记录

见 `docs/development/bugfixes/` 目录

---

**最后更新**: 2025-12-23
