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

**版本**: 1.0
**日期**: 2025-12-21
**状态**: 只支持 Claude Code

---

## 项目简介

Obsidian ACP Plugin 通过 ACP (Agent Client Protocol) 协议将 Claude Code 集成到 Obsidian 中，让用户在笔记环境中使用 AI 助手。

### 核心特性

- **Claude Code 集成**: 通过 `npx @zed-industries/claude-code-acp` 启动
- **文件操作**: AI 可读写 Obsidian Vault 中的文件
- **权限控制**: 2 种模式（每次询问 / 完全信任）
- **@ 引用文件**: 输入 @ 弹出文件搜索
- **拖拽文件**: 从文件树拖拽到聊天输入
- **选中文本**: 命令面板发送选中文本到 Chat

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
                                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│               子进程: npx @zed-industries/claude-code-acp        │
└─────────────────────────────────────────────────────────────────┘
```

### 目录结构

```
src/
├── main.ts                    # 插件入口
├── acp/
│   ├── core/
│   │   ├── connection.ts      # ACP JSON-RPC 通信
│   │   ├── session-manager.ts # 会话状态管理
│   │   └── message-buffer.ts  # 流式消息缓冲
│   ├── backends/
│   │   ├── types.ts           # 类型定义 (只有 'claude')
│   │   └── registry.ts        # Claude Code 配置
│   └── types/                 # ACP 协议类型
└── ui/
    ├── ChatView.ts            # 聊天界面
    ├── MessageRenderer.ts     # 消息渲染
    ├── FileInputSuggest.ts    # @ 文件引用
    ├── SettingsTab.ts         # 设置页面
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

### 启动命令

```bash
npx @zed-industries/claude-code-acp
```

### 核心方法

| 方法 | 说明 |
|------|------|
| `initialize` | 初始化连接，交换能力声明 |
| `session/new` | 创建新会话 |
| `session/prompt` | 发送用户消息 |
| `session/update` | 接收流式更新 |
| `session/cancel` | 取消当前请求 |
| `fs/read_text_file` | 读取文件 |
| `fs/write_text_file` | 写入文件 |

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

1. **多 Agent 支持** - 只支持 Claude Code
2. **Agent 检测系统** - 不需要检测，直接使用 npx
3. **"始终拒绝" 按钮** - 笔记场景不需要
4. **复杂权限规则** - 只需要 2 种模式
5. **Terminal 支持** - Obsidian 不是 IDE
6. **Session Modes UI** - 不需要模式切换

---

## Bug 修复记录

见 `docs/development/bugfixes/` 目录

---

**最后更新**: 2025-12-21
