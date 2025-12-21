# ACP 协议分析与渲染需求

**更新日期**: 2025-12-21
**协议版本**: ACP 1.0
**官方文档**: https://agentclientprotocol.com

---

## 1. ACP 协议本质

ACP (Agent Client Protocol) 是一个 **JSON-RPC 2.0** 协议，用于 AI Agent 与编辑器/客户端之间的双向通信。

### 核心概念

```
┌─────────────────┐                    ┌─────────────────┐
│     Client      │◄──── JSON-RPC ────►│      Agent      │
│  (Obsidian/Zed) │                    │  (Claude Code)  │
└─────────────────┘                    └─────────────────┘
        │                                      │
        │  • session/new                       │
        │  • session/prompt ──────────────────►│
        │                                      │
        │◄──────────────── session/update      │
        │◄──────────────── session/request_permission
        │  (fs/read, fs/write, terminal/*)    │
        └──────────────────────────────────────┘
```

### 通信方向

| 方法 | 方向 | 说明 |
|------|------|------|
| `initialize` | Client → Agent | 建立连接，交换能力 |
| `session/new` | Client → Agent | 创建会话 |
| `session/prompt` | Client → Agent | 发送用户消息 |
| `session/update` | Agent → Client | **流式通知**（8 种类型） |
| `session/request_permission` | Agent → Client | 请求权限 |
| `fs/read_text_file` | Agent → Client | 读取文件 |
| `fs/write_text_file` | Agent → Client | 写入文件 |
| `terminal/*` | Agent → Client | 终端操作（5 个方法） |

---

## 2. Zed vs Obsidian 差异

### 2.1 环境差异

| 方面 | Zed | Obsidian |
|------|-----|----------|
| **平台** | 原生桌面应用 (Rust) | Electron + Node.js |
| **核心场景** | 代码编辑 | 笔记管理 |
| **文件操作** | 完整文件系统访问 | Vault API + fs 降级 |
| **终端** | 内置终端模拟器 | ❌ 无终端 |
| **代码编辑器** | 完整 LSP 支持 | CodeMirror (受限) |

### 2.2 能力差异

| Client Capability | Zed | Obsidian (我们) |
|-------------------|-----|-----------------|
| `fs.readTextFile` | ✅ | ✅ |
| `fs.writeTextFile` | ✅ | ✅ |
| `terminal` (5 个方法) | ✅ | ❌ |
| MCP HTTP/SSE | ✅ | ❌ (仅 stdio) |
| Session Modes | ✅ | ❌ (简化) |

### 2.3 渲染差异

| 内容类型 | Zed 渲染 | Obsidian 渲染 | API |
|----------|----------|--------------|-----|
| **text** | 富文本 | `MarkdownRenderer.render()` | ✅ Obsidian 原生 |
| **resource_link** | 文件链接 + 跳转 | Markdown `[name](uri)` | ✅ 转换后原生 |
| **image** | 内联图片 | `<img>` + 预览 Modal | 部分原生 |
| **diff** | 行内 diff 高亮 | 自定义行号渲染 | ❌ 自定义 |
| **terminal** | 嵌入终端模拟器 | 仅显示命令 | ❌ 自定义 |
| **plan** | 任务列表 UI | 自定义折叠列表 | ❌ 自定义 |
| **thoughts** | 折叠思考块 | 自定义折叠块 | ❌ 自定义 |

---

## 3. ACP 支持的内容类型

### 3.1 ContentBlock (消息内容)

Agent 必须支持 `text` 和 `resource_link`，其他可选：

```typescript
type ContentBlock =
  | { type: 'text'; text: string }                    // ✅ 必须
  | { type: 'resource_link'; uri: string; name: string; ... }  // ✅ 必须
  | { type: 'image'; data: string; mimeType: string } // 可选 (需 promptCapabilities.image)
  | { type: 'audio'; data: string; mimeType: string } // 可选 (需 promptCapabilities.audio)
  | { type: 'resource'; resource: { uri, text|blob } } // 可选 (需 promptCapabilities.embeddedContext)
```

### 3.2 ToolCallContent (工具调用内容)

```typescript
type ToolCallContent =
  | { type: 'content'; content: ContentBlock }  // 标准内容 (text/image/...)
  | { type: 'diff'; path: string; oldText?: string; newText: string }  // 文件变更
  | { type: 'terminal'; terminalId: string }    // 终端引用
```

### 3.3 SessionUpdate (会话更新 - 8 种)

```typescript
type SessionUpdate =
  | { sessionUpdate: 'user_message_chunk'; content: ContentBlock }
  | { sessionUpdate: 'agent_message_chunk'; content: ContentBlock }
  | { sessionUpdate: 'agent_thought_chunk'; content: ContentBlock }  // text only
  | { sessionUpdate: 'tool_call'; toolCallId, title, kind, status, content?, locations?, rawInput? }
  | { sessionUpdate: 'tool_call_update'; toolCallId, status?, content?, ... }
  | { sessionUpdate: 'plan'; entries: PlanEntry[] }
  | { sessionUpdate: 'available_commands_update'; availableCommands: Command[] }
  | { sessionUpdate: 'current_mode_update'; currentModeId: string }
```

### 3.4 ToolKind (工具类型)

```typescript
type ToolKind =
  | 'read'      // 读取文件/数据
  | 'edit'      // 修改文件/内容
  | 'delete'    // 删除文件/数据
  | 'move'      // 移动/重命名
  | 'search'    // 搜索信息
  | 'execute'   // 执行命令/代码
  | 'think'     // 内部推理
  | 'fetch'     // 获取外部数据
  | 'switch_mode'  // 切换模式
  | 'other'     // 其他（默认）
```

### 3.5 ToolCallStatus (工具状态)

```typescript
type ToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed'
```

---

## 4. 我们需要渲染的内容

### 4.1 必须渲染 (ACP 强制)

| 内容 | 来源 | 渲染方式 |
|------|------|----------|
| **text** | `agent_message_chunk` | `MarkdownRenderer.render()` |
| **resource_link** | `agent_message_chunk` | 转为 `[name](uri)` Markdown |
| **tool_call** | `tool_call` / `tool_call_update` | 自定义卡片 |
| **plan** | `plan` | 自定义任务列表 |

### 4.2 应该渲染 (提升体验)

| 内容 | 来源 | 渲染方式 |
|------|------|----------|
| **thoughts** | `agent_thought_chunk` | 自定义折叠块 |
| **diff** | `ToolCallContent.diff` | 带行号的 diff 视图 |
| **terminal** | `ToolCallContent.terminal` | 显示命令 (`rawInput.command`) |
| **image** | `agent_message_chunk` | `<img>` 元素 |

### 4.3 可以忽略 (Obsidian 场景不需要)

| 内容 | 原因 |
|------|------|
| **audio** | 笔记场景无需语音 |
| **Session Modes** | 简单场景不需要模式切换 |
| **available_commands** | 可以支持，但非核心 |
| **terminal 交互** | Obsidian 不是终端环境 |

---

## 5. Obsidian API 映射

### 5.1 可用原生 API

| 功能 | Obsidian API | 说明 |
|------|--------------|------|
| **Markdown 渲染** | `MarkdownRenderer.render(app, text, el, sourcePath, component)` | ✅ 核心 |
| **文件读取** | `vault.read(file: TFile)` / `vault.cachedRead(file)` | ✅ Vault 内 |
| **文件写入** | `vault.modify(file, content)` / `vault.create(path, content)` | ✅ Vault 内 |
| **文件跳转** | `workspace.openLinkText(path, '', false)` | ✅ |
| **通知** | `new Notice(message)` | ✅ |
| **模态框** | `new Modal(app)` | ✅ |
| **图标** | `setIcon(el, iconName)` | ✅ Lucide 图标 |
| **资源路径** | `vault.getResourcePath(file: TFile)` | ✅ Vault 内图片 |

### 5.2 需要自定义实现

| 功能 | 实现方式 |
|------|----------|
| **ToolCall 卡片** | 自定义 HTML + CSS |
| **Diff 渲染** | 自定义行号 + 颜色高亮 |
| **Terminal 显示** | 显示 `$ command` 格式 |
| **Plan 列表** | 自定义折叠列表 |
| **Thoughts 块** | 自定义折叠块 + 动画 |
| **Vault 外文件** | Node.js `fs` 降级 |

### 5.3 API 使用优先级

```
1. Obsidian Vault API  (优先 - Vault 内文件)
   └── vault.read(), vault.modify(), vault.getResourcePath()

2. Obsidian 渲染 API  (优先 - Markdown/图标)
   └── MarkdownRenderer.render(), setIcon()

3. Node.js fs API  (降级 - Vault 外文件)
   └── fs.readFile(), fs.writeFile()

4. 自定义 HTML/CSS  (必要 - ACP 特有内容)
   └── ToolCall, Diff, Terminal, Plan, Thoughts
```

---

## 6. 类型定义对照

### 我们的实现 vs ACP 协议

| ACP 协议类型 | 我们的类型 | 状态 |
|-------------|-----------|------|
| `ContentBlock::Text` | `TextMessageContent` | ✅ 一致 |
| `ContentBlock::Image` | `ImageMessageContent` | ✅ 一致 |
| `ContentBlock::ResourceLink` | `ResourceLinkContent` | ✅ 一致 |
| `ContentBlock::Audio` | - | ❌ 未实现 (不需要) |
| `ContentBlock::Resource` | - | ❌ 未实现 (可选) |
| `ToolCallContent::Content` | `ToolCallTextContent` | ✅ 一致 |
| `ToolCallContent::Diff` | `ToolCallDiffContent` | ✅ 一致 |
| `ToolCallContent::Terminal` | `ToolCallTerminalContent` | ✅ 一致 |
| `ToolCallStatus` | `ToolCallStatus` | ✅ 一致 |
| `ToolKind` | `ToolCallKind` | ⚠️ 部分 (只有 read/edit/execute) |
| `PlanEntry` | `PlanEntry` | ✅ 一致 |
| `SessionUpdate` (8 种) | `SessionUpdateData` | ✅ 全部覆盖 |

---

## 7. 改进建议

### 7.1 类型完善

```typescript
// 扩展 ToolCallKind 以匹配 ACP 的 ToolKind
export type ToolCallKind =
  | 'read' | 'edit' | 'delete' | 'move'
  | 'search' | 'execute' | 'think' | 'fetch'
  | 'switch_mode' | 'other';
```

### 7.2 渲染优化

1. **Terminal**: 已修复 - 从 `rawInput.command` 获取命令
2. **Diff**: 使用 `path` 字段跳转文件
3. **Locations**: 实现文件跳转功能

### 7.3 不要实现

1. ❌ `terminal/*` 5 个方法 - Obsidian 不是终端
2. ❌ `audio` 支持 - 笔记场景不需要
3. ❌ Session Modes UI - 简单场景不需要
4. ❌ "始终拒绝" 权限 - 用户明确拒绝

---

## 8. 总结

**ACP 协议本质**: 一个让 AI Agent 与编辑器双向通信的标准化协议，定义了会话管理、流式更新、权限请求、文件操作等能力。

**与 Zed 的核心差异**:
- Zed 是完整的代码编辑器，有终端、LSP、多模式
- Obsidian 是笔记工具，专注文本渲染和 Vault 管理

**渲染策略**:
- **优先 Obsidian API**: Markdown 渲染、文件操作、通知
- **自定义实现**: ToolCall 卡片、Diff 视图、Plan 列表
- **明确不实现**: Terminal 交互、Audio、复杂模式

**类型完备性**: 8 种 SessionUpdate 全覆盖，3 种 ToolCallContent 全覆盖，核心功能完整。
