# Obsidian ACP Plugin - 产品愿景文档

**版本**: 1.0
**日期**: 2025-12-19
**状态**: 核心框架完成，功能实现中

---

## 📋 执行摘要

**Obsidian ACP Plugin** 旨在将 Obsidian 打造成 **AI Agent 协作中心**，通过标准化的 Agent Client Protocol (ACP) 协议，让用户在笔记环境中无缝使用多个 AI 编程助手（Claude、Kimi、Codex、Gemini 等）。

### 核心价值

- **统一入口**: 一个插件连接所有 ACP 兼容的 AI Agent
- **知识库结合**: AI 直接访问 Obsidian 笔记，结合个人知识库工作
- **安全可控**: 细粒度权限管理，用户完全掌控 AI 行为
- **标准化**: 基于开放协议，而非私有 API

### 当前进度

```
✅ 核心架构      100%  (7800+ 行代码)
✅ TypeScript     100%  (0 errors)
✅ 构建系统       100%  (main.js 62KB)
⚠️  功能实现       40%  (5/5 Agent, 基础权限系统)
⚠️  测试覆盖       20%  (5/25+ 预期测试)
🚧 文档完善       60%  (技术文档齐全，用户文档不足)
```

---

## 🎯 产品定位

### 一句话描述

> 让 Obsidian 用户在笔记环境中，通过统一界面使用多个 AI 编程助手，AI 能理解并操作用户的知识库。

### 目标市场

1. **知识工作者** (60%): 使用 Obsidian 管理笔记，需要 AI 辅助整理、总结、提取信息
2. **开发者** (30%): 在 Obsidian 做技术文档，需要 AI 辅助编写代码和文档
3. **内容创作者** (10%): 写作、博客、教程，需要 AI 辅助研究和草稿

---

## 🌟 核心价值主张

### 对用户的价值

| 价值点 | 说明 | 竞品对比 |
|--------|------|----------|
| **环境无缝** | 不离开 Obsidian 即可使用 AI | VS Code Copilot 需要切换工具 |
| **知识库感知** | AI 能读取和理解笔记 `[[双链]]` | ChatGPT 无法访问本地文件 |
| **多 Agent** | 自由切换 Claude/Kimi/Codex | Cursor 仅支持单一 Agent |
| **权限控制** | 5 级细粒度权限（完全控制→完全自动） | GitHub Copilot 权限粗粒度 |
| **数据主权** | 完全本地，不上传云端 | 多数 AI 工具数据存储在云端 |

### 对开发者的价值

1. **标准化接口**: 基于 ACP 开放协议，易于扩展新 Agent
2. **参考实现**: 7800+ 行生产级代码，展示 Electron 中集成 Claude SDK 的完整方案
3. **模块化架构**: 清晰分层（UI → Session → Protocol → Backend → Execution）

---

## 🎨 功能架构

### 横向扩展: Agent 集成

**官方 ACP 支持状态** (基于 2025-12-19 调研)

| Agent | 插件状态 | ACP 官方支持 | 启动方式 | 说明 |
|-------|---------|-------------|---------|------|
| **Claude Code** | ✅ 已启用 | ✅ 完全支持 | `npx @zed-industries/claude-code-acp` | Anthropic 官方，通过 Zed ACP 适配器 |
| **Kimi** | ✅ 已启用 | ✅ 完全支持 | `kimi --acp` | Moonshot AI，原生 ACP 支持，中文友好 |
| **Codex ACP** | ✅ 已启用 | ✅ 完全支持 | `npx @zed-industries/codex-acp` | OpenAI Codex，通过 Zed 官方 ACP 适配器 |
| **Gemini CLI** | ✅ 已启用 | ✅ 完全支持 | `npx @google/gemini-cli --experimental-acp` | Google 官方，ACP 参考实现 |
| **Qwen Code** | ✅ 已启用 | ✅ 完全支持 | `qwen --experimental-acp` | 阿里通义千问，中文友好，免费 |
| **Goose** | ⚠️ 已禁用 | ✅ 完全支持 | `goose acp` | Block/Linux Foundation，子命令模式 |
| **Auggie** | ⚠️ 已禁用 | ✅ 完全支持 | `auggie --acp` | Augment Code，v0.7.0+ 完整支持 |
| **OpenCode** | ⚠️ 已禁用 | ✅ 完全支持 | `opencode acp` | SST OpenCode，子命令模式 |
| **Codex CLI** | ⚠️ 已禁用 | ❌ 不支持 | N/A | OpenAI 原生 CLI 不支持 ACP，请使用 Codex ACP |
| **自定义** | ⚠️ 已禁用 | - | 用户自定义 | 任何 ACP 兼容 Agent |

**图例**:
- ✅ 已启用: 在插件中默认启用
- ⚠️ 已禁用: 在插件中禁用，可手动启用（需先安装 CLI）
- ✅ 完全支持: 官方原生支持 ACP 协议
- ❌ 不支持: 官方未实现 ACP 协议

### 纵向深化: 交互能力

```
用户请求
    ↓
┌─────────────────────────────────┐
│  ChatView 界面                  │
│  • 多轮对话                      │
│  • 上下文管理                    │
│  • Markdown 渲染                 │
├─────────────────────────────────┤
│  权限审批系统                    │
│  • 2 种模式: 每次询问/完全信任   │
│  • 基于 ACP 协议的标准实现       │
│  • 记忆用户选择（始终允许）      │
│  • 配合 Git 使用，简单安全       │
├─────────────────────────────────┤
│  文件操作引擎                    │
│  • Vault API (优先)              │
│  • Node.js fs (降级)             │
│  • 路径安全检查                  │
│  • 操作历史审计                  │
├─────────────────────────────────┤
│  工具调用可视化                  │
│  • 实时显示思考过程              │
│  • 工具使用详情                  │
│  • 执行结果展示                  │
│  • 错误信息友好化                │
├─────────────────────────────────┤
│  会话持久化                      │
│  • 保存会话历史                  │
│  • 恢复中断对话                  │
│  • 分支会话管理                  │
│  • 导出对话记录                  │
└─────────────────────────────────┘
```

### Obsidian 深度集成

1. **笔记感知**
   - 当前文件上下文自动传递给 AI
   - 支持 `[[双链]]` 语法解析
   - 自动识别和传递 frontmatter

2. **工作流嵌入**
   - 侧边栏常驻 Chat 视图
   - 命令面板快速调用 (`Ctrl/Cmd + P` → "ACP")
   - Ribbon 图标一键打开
   - 未来: 右键菜单快捷操作

3. **安全边界**
   - 工作目录限制 (Vault/当前文件夹/自定义)
   - Vault 内外访问控制
   - 操作历史完整记录
   - 敏感操作二次确认

---

## 🏗️ 技术架构

### 分层设计

```
┌──────────────────────────────────────────┐
│         UI Layer (Obsidian Views)       │
│  ChatView | SettingsTab | PermissionModal│
│  • 用户交互                              │
│  • 消息渲染 (MessageRenderer)           │
│  • 权限对话框                            │
├──────────────────────────────────────────┤
│       Session Management Layer          │
│  SessionManager | RequestQueue          │
│  • 会话生命周期                          │
│  • Turn 管理 (用户轮 ↔ AI 轮)           │
│  • 消息缓冲优化 (减少 95% UI 更新)      │
├──────────────────────────────────────────┤
│        ACP Protocol Layer               │
│  Connection | MessageHandler | Events   │
│  • JSON-RPC 2.0 协议                     │
│  • 流式事件处理                          │
│  • 超时和重连管理                        │
├──────────────────────────────────────────┤
│       Backend Abstraction Layer         │
│  BackendRegistry | Detector | Factory   │
│  • Agent 配置注册表                      │
│  • 自动检测已安装 Agent                  │
│  • 统一启动接口                          │
├──────────────────────────────────────────┤
│        Execution Layer                  │
│  CLI Spawner | SDK Wrapper | MCP Bridge│
│  • 子进程管理 (Node.js spawn)            │
│  • SDK 直接调用 (未来)                   │
│  • MCP 服务器集成                        │
└──────────────────────────────────────────┘
```

### 关键技术决策

| 决策 | 选择 | 原因 |
|------|------|------|
| **Agent 调用方式** | CLI 子进程 (npx) | 绕过 Electron 不支持 native bindings 的限制 |
| **协议基础** | ACP (Agent Client Protocol) | 开放标准，多 Agent 支持，未来扩展性 |
| **消息处理** | 流式实时处理 | 低延迟首字节，更好用户体验 |
| **UI 更新策略** | 消息缓冲 (300ms) | 减少 95% 渲染开销，防止卡顿 |
| **文件操作** | Vault API → fs 双降级 | 优先使用 Obsidian API，降级保证兼容性 |
| **权限管理** | 2 种模式 + 记忆 | 简单实用，配合 Git 安全 |

---

## 📋 ACP Agent 支持详情

> 基于 2025-12-19 官方文档调研，确认各 Agent 真实 ACP 支持状态

### ✅ 完全支持 ACP 的 Agent

#### 1. Claude Code (Anthropic 官方)
- **CLI 工具**: `@zed-industries/claude-code-acp` (NPM 包)
- **安装方式**: `npx @zed-industries/claude-code-acp`
- **ACP 参数**: **无需参数** (包本身就是 ACP 适配器)
- **工作原理**: 包装 `@anthropic-ai/claude-agent-sdk`，转换为 ACP 协议
- **状态**: ✅ 生产就绪，Zed Industries 官方维护
- **文档**:
  - NPM: https://www.npmjs.com/package/@zed-industries/claude-code-acp
  - GitHub: https://github.com/zed-industries/claude-code-acp

#### 2. Kimi (Moonshot AI)
- **CLI 工具**: `kimi`
- **安装方式**: `npm install -g @moonshot-ai/kimi-cli`
- **ACP 参数**: `--acp`
- **使用示例**: `kimi --acp`
- **状态**: ✅ 原生 ACP 支持 (2025 年 11 月添加)
- **特性**: 支持 ACP + MCP，中文友好
- **文档**: https://github.com/MoonshotAI/kimi-cli

#### 3. Codex ACP (Zed 官方适配器)
- **CLI 工具**: `@zed-industries/codex-acp` (NPM 包)
- **安装方式**: `npx @zed-industries/codex-acp`
- **ACP 参数**: **无需参数** (包本身就是 ACP 适配器)
- **工作原理**: 包装 OpenAI Codex CLI，转换为 ACP 协议
- **认证方式**:
  - ChatGPT 订阅 (Plus/Pro/Team/Enterprise)
  - `OPENAI_API_KEY` 环境变量
  - `CODEX_API_KEY` 环境变量
- **状态**: ✅ 生产就绪，Zed Industries 官方维护
- **版本**: v0.7.4 (2025-12-18)
- **特性**:
  - ✅ 完整 ACP 协议支持
  - ✅ 图片支持
  - ✅ 工具调用和权限请求
  - ✅ MCP 服务器集成
  - ✅ 流式输出
  - ✅ Slash 命令 (`/review`, `/init`, `/undo` 等)
- **文档**:
  - GitHub: https://github.com/zed-industries/codex-acp
  - Releases: https://github.com/zed-industries/codex-acp/releases

#### 4. Goose (Block/Linux Foundation)
- **CLI 工具**: `goose`
- **安装方式**: CLI 或桌面应用
- **ACP 参数**: `acp` **(子命令模式)**
- **使用示例**: `goose acp`
- **状态**: ✅ 完全支持，2025 年 12 月贡献给 Linux Foundation
- **特性**: 本地优先，多模型配置，MCP 集成
- **文档**: https://block.github.io/goose/

#### 5. Auggie (Augment Code)
- **CLI 工具**: `auggie`
- **ACP 参数**: `--acp`
- **版本**: v0.7.0+ (2025 年 11 月)
- **使用示例**: `auggie --acp`
- **特性**: 支持 Zed, Neovim, Emacs, JetBrains
- **状态**: ✅ 完全支持
- **文档**: https://docs.augmentcode.com/cli/acp/agent

#### 6. OpenCode (SST)
- **CLI 工具**: `opencode`
- **ACP 参数**: `acp` **(子命令模式)**
- **使用示例**: `opencode acp`
- **工作原理**: 桥接编辑器 JSON-RPC 到内部 HTTP Server
- **状态**: ✅ 完全支持
- **文档**: https://opencode.ai/docs/acp/

#### 7. Gemini CLI (Google 官方) ⭐ ACP 参考实现
- **CLI 工具**: `gemini`
- **安装方式**: `npx @google/gemini-cli` 或 `brew install google-gemini/tap/gemini-cli`
- **ACP 参数**: `--experimental-acp` ⚠️ (历史原因保留 experimental 前缀)
- **使用示例**: `gemini --experimental-acp`
- **背景**: 2025 年 8 月，Google 与 Zed 合作，Gemini CLI 成为 **ACP 首个参考实现**
- **认证方式**:
  - Google Account OAuth (推荐)
  - `GOOGLE_API_KEY` 环境变量
  - Vertex AI (`GOOGLE_CLOUD_PROJECT` + 服务账号)
- **状态**: ✅ **生产就绪** (Zed 官方内置支持)
- **特性**:
  - ✅ 免费额度（每分钟 60 次请求，每天 1000 次）
  - ✅ MCP 服务器集成
  - ✅ 多语言支持
  - ✅ Zed/JetBrains/Neovim 全平台
- **文档**:
  - GitHub: https://github.com/google-gemini/gemini-cli
  - Zed 官方博客: https://zed.dev/blog/bring-your-own-agent-to-zed

#### 8. Qwen Code (阿里通义千问) ⭐ 免费使用
- **CLI 工具**: `qwen-code`
- **安装方式**: `npm install -g qwen-code`
- **ACP 参数**: `--experimental-acp`
- **使用示例**: `qwen --experimental-acp`
- **状态**: ✅ **完全支持** (原生 ACP 支持)
- **特性**:
  - ✅ **完全免费**（促销期内每日免费额度）
  - ✅ 中文支持优秀
  - ✅ 支持 MCP 服务器
  - ✅ 提供审批模式（Approval Mode）
  - ✅ 国内访问稳定
- **Zed 配置示例**:
  ```json
  {
    "agent_servers": {
      "Qwen Code": {
        "command": "qwen",
        "args": ["--experimental-acp"],
        "env": {}
      }
    }
  }
  ```
- **文档**:
  - 官方文档: https://qwenlm.github.io/qwen-code-docs/zh/users/integration-zed/
  - GitHub: https://github.com/QwenLM/qwen-code

---

### ❌ 不支持 ACP 的 Agent

#### 9. Codex CLI (OpenAI 原生) - 请使用 Codex ACP
- **CLI 工具**: `codex` (OpenAI 官方 CLI)
- **官方 ACP 支持**: ❌ **OpenAI 原生 CLI 不支持 ACP**
- **替代方案**: ✅ **使用 `codex-acp`** (Zed 官方适配器，见上文第 3 条)
- **原生 CLI 参数**:
  - `--full-auto`: 完全自动化模式
  - `--sandbox`: 沙箱策略
  - `--model`: 指定模型
  - **无 `--acp` 参数**
- **现状**:
  - GitHub Issue #2785 (138 人请求 ACP 支持) 已关闭，未实现
  - Zed 团队开发了 `codex-acp` 作为官方适配器
- **文档**: https://developers.openai.com/codex/cli

---

### 配置建议

**推荐启用** (已在插件中默认启用):
1. ✅ **Claude Code** - 最强编程能力，官方支持
2. ✅ **Kimi** - 中文友好，原生 ACP 支持
3. ✅ **Codex ACP** - OpenAI Codex，完整 ACP 支持
4. ✅ **Gemini CLI** - Google 官方，免费额度，ACP 参考实现
5. ✅ **Qwen Code** - 阿里通义千问，中文优秀，完全免费

**可选启用** (需手动安装 CLI):
6. ⚠️ **Goose** - 开源免费，Linux Foundation 项目
7. ⚠️ **Auggie** - 多编辑器支持
8. ⚠️ **OpenCode** - 社区活跃

**不建议启用**:
9. ❌ **Codex CLI** - 原生 CLI 不支持 ACP，请使用 Codex ACP

---

### ACP 协议参数总结

| Agent | 参数类型 | 参数值 | 说明 |
|-------|---------|--------|------|
| Claude Code | 无需参数 | `[]` | NPM 包本身就是 ACP 适配器 |
| Kimi | Flag | `['--acp']` | 标准 flag 参数 |
| Codex ACP | 无需参数 | `[]` | NPM 包本身就是 ACP 适配器 |
| Gemini CLI | Flag | `['--experimental-acp']` | 历史原因保留 experimental 前缀 |
| Qwen Code | Flag | `['--experimental-acp']` | 官方 ACP 参数 |
| Goose | 子命令 | `['acp']` | 使用子命令模式 |
| Auggie | Flag | `['--acp']` | 标准 flag 参数 |
| OpenCode | 子命令 | `['acp']` | 使用子命令模式 |
| Codex CLI | ❌ 无 | `[]` | 原生 CLI 不支持，使用 Codex ACP |

**关键发现**:
- ❌ **之前的错误**: 认为 Qwen 不支持 ACP，这是**完全错误的**
- ✅ **正确信息**:
  - Claude Code 和 Codex ACP 通过专用 NPM 包（`claude-code-acp`, `codex-acp`），无需参数
  - Gemini CLI 和 Qwen Code 都使用 `--experimental-acp` 参数
  - Kimi 和 Auggie 使用标准 `--acp` 参数
  - Goose 和 OpenCode 使用子命令 (`acp`)
- ⚠️ **子命令 vs Flag**: Goose 和 OpenCode 使用子命令 (`acp`)，其他使用 flag
- 🎯 **Zed 官方支持**: Claude Code、Codex ACP、Gemini CLI 都是 Zed 官方内置或维护的 Agent
- 🆓 **免费选项**: Gemini CLI (免费额度) 和 Qwen Code (完全免费) 适合国内用户

---

## 🎭 核心使用场景

### 场景 1: 知识库助手

```
用户: "帮我整理 [[项目A]] 相关的所有笔记"

Agent 工作流:
1. [fs/read] 读取 "项目A.md" → 解析双链网络
2. [fs/read] 读取 15 篇关联笔记 (批量请求权限)
3. [思考] 分析内容，提取关键信息和 frontmatter
4. [生成] 创建思维导图式总结
5. [fs/write] 保存到 "项目A-总结.md" (请求权限)

结果: 一篇结构化的项目总结文档
```

### 场景 2: 代码重构

```
用户: "重构 src/main.ts，拆分成模块"

Agent 工作流:
1. [fs/read] 读取 main.ts (请求权限)
2. [思考] 分析代码结构 (853 行) → 识别 5 个可拆分模块
3. [fs/write] 创建 src/connection.ts (请求权限)
4. [fs/write] 创建 src/session.ts (请求权限)
5. [fs/write] 创建 src/file-handler.ts (请求权限)
6. [fs/write] 更新 main.ts 导入语句 (请求权限)
7. [报告] 重构完成，建议运行测试

结果: 代码模块化，可维护性提升
```

### 场景 3: 批量文档处理

```
用户: "为 notes/ 下所有 .md 添加标签 #processed"

Agent 工作流:
1. [fs/list] 遍历 notes/ 目录 → 发现 237 个文件
2. [权限] 请求批量写入权限 (用户选择"始终允许写入")
3. [执行] 逐个文件添加 frontmatter 标签
   - 成功: 235 个
   - 失败: 2 个 (文件被锁定)
4. [报告] 详细列出处理结果

结果: 批量标签化完成，2 个例外需手动处理
```

---

## 📊 产品路线图

### MVP (当前 - v0.1.0)

**目标**: 验证核心价值，支持基础功能

- [x] 架构搭建 (7800+ 行代码)
- [x] 支持 Claude Code (npx 方式)
- [x] 支持 Kimi (CLI 方式)
- [x] 基础聊天交互
- [x] 文件读写权限 (简单模式)
- [x] 会话管理 (单会话)
- [x] 构建系统 (0 errors, 242 warnings)

**交付标准**:
- ✅ TypeScript: 0 errors
- ✅ 构建: main.js 62KB
- ⚠️ 测试: 5/25+ (20%)
- ⚠️ 文档: 技术文档完整，用户文档不足

---

### V1.0 (目标: 2026 Q1)

**目标**: 生产就绪，上架社区插件商店

#### 功能完善
- [x] 支持 5+ Agent (Claude, Kimi, Codex, Gemini, Qwen)
- [ ] 完整权限系统 (2 种模式 + 记忆功能)
  - [ ] 每次询问模式 (interactive)
  - [ ] 完全信任模式 (trustAll)
  - [ ] 记住用户选择（始终允许特定工具）
  - [ ] 权限对话框 UI
- [ ] 会话持久化
  - [ ] 保存会话历史 (JSON 格式)
  - [ ] 恢复中断对话
  - [ ] 会话分支管理
  - [ ] 导出为 Markdown
- [ ] MCP 服务器集成
  - [ ] stdio 类型
  - [ ] HTTP/SSE 类型
  - [ ] SDK 类型
- [ ] Agent 自动检测优化
  - [ ] 检测系统 PATH 中的 CLI
  - [ ] 检测常见安装位置
  - [ ] 版本兼容性检查

#### 质量保障
- [ ] 测试覆盖 ≥60%
  - [ ] 单元测试 (20+ 测试)
  - [ ] 集成测试 (5+ 场景)
  - [ ] E2E 测试 (3+ 完整流程)
- [ ] 修复 242 个 ESLint warnings
  - [ ] 添加访问修饰符
  - [ ] 移除 `any` 类型
  - [ ] 降低函数复杂度
  - [ ] 清理 console.log
- [ ] 性能优化
  - [ ] 消息缓冲优化
  - [ ] 大文件读取分页
  - [ ] 内存泄漏检查

#### 用户体验
- [x] 完善用户文档
  - [x] 快速开始指南
  - [x] 每个 Agent 的配置教程
  - [x] 常见问题 FAQ
  - [x] 权限系统简化方案
- [ ] UI 优化
  - [ ] 加载状态动画
  - [ ] 错误提示友好化
  - [ ] 暗色模式适配
  - [ ] 响应式布局

#### 发布准备
- [ ] 社区插件商店上架
- [ ] GitHub Release 发布
- [ ] 演示视频制作
- [ ] 社区反馈收集渠道

---

### V2.0 (愿景: 2026 Q3)

**目标**: 生态建设，高级功能

#### 高级功能
- [ ] 多 Agent 协同
  - [ ] Agent A 负责搜索，Agent B 负责生成
  - [ ] 自动选择最适合的 Agent
  - [ ] Agent 间通信协议
- [ ] 插件市场
  - [ ] 第三方 Agent 扩展系统
  - [ ] Agent 配置分享
  - [ ] 社区 Agent 模板库
- [ ] Vault 级智能搜索
  - [ ] 向量化笔记内容
  - [ ] 语义搜索 (超越关键词)
  - [ ] 相关笔记推荐
- [ ] 工作流编排
  - [ ] 可视化 Agent 流程设计
  - [ ] 自动化任务链
  - [ ] 触发器和定时任务

#### 平台扩展
- [ ] 移动端支持
  - [ ] React Native 桥接
  - [ ] 简化版 UI
  - [ ] 离线功能
- [ ] 云端同步 (可选)
  - [ ] 会话历史云备份
  - [ ] 跨设备同步设置
  - [ ] 端到端加密

#### 企业版功能
- [ ] 团队协作
  - [ ] 共享 Agent 配置
  - [ ] 权限策略模板
  - [ ] 审计日志
- [ ] 私有部署
  - [ ] 自托管 Agent 服务器
  - [ ] VPN/内网支持
  - [ ] SSO 集成

---

## 🏆 成功指标

### 定量指标

| 指标 | MVP | V1.0 | V2.0 |
|------|-----|------|------|
| **活跃用户** | 50+ | 1000+ | 5000+ |
| **社区评分** | N/A | 4.0/5.0 | 4.5/5.0 |
| **测试覆盖** | 20% | 60% | 80% |
| **支持 Agent** | 2 | 5+ | 10+ |
| **文档完整度** | 60% | 95% | 100% |
| **性能 (首字节)** | <2s | <1s | <500ms |

### 定性指标

- **用户反馈**: "终于不用离开 Obsidian 了"
- **开发者采用**: 至少 3 个第三方 Agent 扩展
- **社区活跃**: 月均 10+ GitHub issue/PR
- **品牌认知**: 被 Obsidian 官方推荐

---

## 💡 差异化优势

### 与竞品对比

| 维度 | Obsidian ACP | GitHub Copilot Chat | Cursor | ChatGPT Web |
|------|-------------|---------------------|--------|-------------|
| **环境** | Obsidian 笔记 | VS Code | 独立编辑器 | 浏览器/App |
| **知识库访问** | ✅ 直接访问笔记 | ❌ 仅当前文件 | ❌ 仅项目文件 | ❌ 无文件访问 |
| **多 Agent** | ✅ 自由切换 | ❌ GitHub Copilot 独占 | ❌ Claude 独占 | ❌ GPT 独占 |
| **权限粒度** | ✅ 2 种模式 + 记忆 | ⚠️ 粗粒度 | ⚠️ 粗粒度 | N/A |
| **协议标准** | ✅ ACP 开放标准 | ❌ 私有协议 | ❌ 私有协议 | ❌ 私有 API |
| **数据主权** | ✅ 完全本地 | ⚠️ 云端存储 | ⚠️ 云端存储 | ❌ 完全云端 |
| **价格** | 免费 (Agent 单独计费) | $10/月 | $20/月 | $20/月 |
| **扩展性** | ✅ 插件化 | ⚠️ 有限 | ❌ 封闭 | ❌ 封闭 |

### 独特价值

1. **唯一的笔记环境 AI 助手**: 专为 Obsidian 用户设计
2. **多 Agent 生态**: 不绑定单一 AI 提供商
3. **开放协议**: 基于 ACP 标准，社区可贡献
4. **数据主权**: 完全本地化，符合隐私要求

---

## 🎯 目标用户详细画像

### Persona 1: 知识工作者 - 李明

**背景**:
- 年龄: 32 岁
- 职业: 产品经理
- 使用 Obsidian 2 年，笔记 1000+ 篇
- 每天在 Obsidian 花费 3-4 小时

**痛点**:
- 笔记太多，难以整理和回顾
- 需要从海量笔记中提取洞察
- 写文档效率低，需要 AI 辅助

**使用场景**:
- 每周日用 AI 整理本周笔记，生成周报
- 在 PRD 文档中让 AI 补充技术可行性分析
- 让 AI 分析竞品笔记，提取差异化点

**期望**:
- AI 理解笔记之间的关联 (双链)
- 不离开 Obsidian 即可使用
- 不担心笔记内容被上传云端

---

### Persona 2: 开发者 - 王芳

**背景**:
- 年龄: 28 岁
- 职业: 全栈工程师
- 使用 Obsidian 做技术文档和学习笔记
- 同时使用 VS Code 编码

**痛点**:
- 在 VS Code 和 Obsidian 之间切换频繁
- 技术文档写作效率低
- 需要 AI 辅助代码示例和技术调研

**使用场景**:
- 在 Obsidian 中让 AI 生成 API 文档模板
- 让 AI 解释复杂算法，并记录到笔记
- 让 AI 分析多篇技术文章，总结最佳实践

**期望**:
- 支持多个 AI (Claude 写代码，Kimi 中文解释)
- AI 能读写 Obsidian 中的代码片段
- 细粒度控制 AI 的文件访问权限

---

### Persona 3: 内容创作者 - 张华

**背景**:
- 年龄: 35 岁
- 职业: 技术博主 + 教程作者
- 使用 Obsidian 管理创作素材和草稿
- 每月发布 4-6 篇长文

**痛点**:
- 素材积累多但难以串联成文章
- 写作卡壳时需要灵感
- 需要 AI 辅助校对和改写

**使用场景**:
- 让 AI 分析 10 篇素材笔记，生成文章大纲
- 让 AI 扩写某个章节的草稿
- 让 AI 校对语法和优化表达

**期望**:
- AI 理解创作意图，而非简单生成
- 能查看 AI 的思考过程
- 一键导出和 AI 的对话记录

---

## 🚧 技术挑战与解决方案

### 挑战 1: Electron 环境限制

**问题**: Claude Agent SDK 依赖 native bindings，Electron 不支持

**解决方案**:
- ✅ 使用 `npx @zed-industries/claude-code-acp` 子进程方式
- 🚧 未来: 探索 Electron 的 native module 打包方案
- 🚧 备选: 通过本地 HTTP 服务桥接

**状态**: 已实施，Claude Code 正常工作

---

### 挑战 2: 各 Agent 协议差异

**问题**: 虽然都支持 ACP，但启动参数、认证方式、响应格式略有差异

**解决方案**:
- ✅ Backend Registry 抽象层统一接口
- ✅ Detector 自动检测并适配
- 🚧 为每个 Agent 编写适配器模块
- 🚧 建立 Agent 测试套件 (test-all-agents.js)

**状态**: 框架完成，需逐个 Agent 调试

---

### 挑战 3: 权限管理的简洁性

**问题**: 平衡安全性和便利性，避免过度设计

**解决方案**:
- ✅ 简化为 2 种模式（每次询问 / 完全信任）
- ✅ 在插件端拦截 ACP 协议请求
- ✅ 记忆用户选择（始终允许特定工具）
- ✅ 配合 Git 使用，完全信任模式安全可靠

**状态**: 设计完成，待实现

---

### 挑战 4: 性能优化

**问题**: 流式消息频繁更新导致 UI 卡顿

**解决方案**:
- ✅ 消息缓冲策略 (300ms 批量更新)
- ✅ 智能滚动 (仅在底部时自动滚动)
- 🚧 虚拟滚动 (长对话列表)
- 🚧 Web Worker 处理消息解析

**状态**: 基础优化完成，减少 95% UI 更新

---

### 挑战 5: 测试覆盖不足

**问题**: 当前仅 5 个单元测试，覆盖率 20%

**解决方案**:
- 🚧 Mock Obsidian API (tests/mocks/obsidian.ts)
- 🚧 Mock Claude SDK (tests/mocks/claude-sdk.ts)
- 🚧 集成测试 (tests/integration/)
- 🚧 E2E 测试 (使用真实 Agent)

**目标**: V1.0 达到 60% 覆盖率

---

## 📈 市场分析

### TAM (Total Addressable Market)

- Obsidian 用户: ~100 万 (估计)
- 其中活跃用户: ~50 万
- 有 AI 需求用户: ~20 万 (40%)

**初期目标**: 0.5% 渗透率 = 1,000 用户 (V1.0)

### 竞争格局

**直接竞品**: 无 (目前没有专为 Obsidian 设计的多 Agent 插件)

**间接竞品**:
1. **Copilot Chat in VS Code**: 开发者首选，但仅限 VS Code
2. **Cursor Editor**: 独立编辑器，体验好但需切换工具
3. **ChatGPT Web/App**: 通用对话，无文件访问能力

**差异化策略**:
- 专注 Obsidian 生态，不做大而全
- 多 Agent 支持，不绑定单一提供商
- 开放协议，鼓励社区贡献

---

## 🔮 未来展望

### 短期 (6 个月)

- 完善 V1.0 功能，上架社区插件商店
- 至少支持 5 个 Agent
- 建立用户社区 (Discord/GitHub Discussions)
- 收集反馈，快速迭代

### 中期 (1 年)

- 多 Agent 协同能力
- Vault 级智能搜索 (向量化)
- 第三方 Agent 扩展生态
- 移动端基础支持

### 长期 (2 年)

- 成为 Obsidian 生态中最受欢迎的 AI 插件
- 形成健康的开发者生态 (10+ 第三方扩展)
- 探索商业化路径 (企业版/云服务)

---

## 📝 开发优先级

### 立即执行 (0-1 个月)

1. **修复 242 个 ESLint warnings** (代码质量)
   - 添加访问修饰符
   - 移除 `any` 类型
   - 清理 console.log

2. **完善权限系统** (核心功能)
   - 实现 2 种权限模式（每次询问 / 完全信任）
   - 实现权限对话框 UI
   - 记住用户选择（始终允许）

3. **完善用户文档** (可用性) ✅ 已完成
   - ✅ 快速开始指南
   - ✅ 每个 Agent 配置教程
   - ✅ 常见问题 FAQ
   - ✅ 权限系统简化方案

4. **增加测试** (稳定性)
   - 单元测试覆盖核心逻辑
   - 集成测试覆盖主要流程
   - 目标: 40% 覆盖率

### 次要任务 (1-2 个月)

5. **支持更多 Agent** (横向扩展) ✅ 已完成
   - ✅ Gemini CLI
   - ✅ Qwen Code
   - ✅ Codex ACP
   - ⚠️ 自定义 Agent 配置（待完善）

6. **会话持久化** (用户体验)
   - 保存/恢复对话
   - 导出 Markdown
   - 会话管理界面

7. **MCP 集成** (生态连接)
   - stdio 类型服务器
   - HTTP/SSE 类型服务器

8. **UI 优化** (美化)
   - 加载动画
   - 错误提示友好化
   - 暗色模式适配

### 可延后 (3-6 个月)

9. **性能优化** (体验提升)
   - 虚拟滚动
   - 大文件分页
   - 内存泄漏修复

10. **高级功能** (差异化)
    - 多 Agent 协同
    - 向量搜索
    - 工作流编排

---

## ✅ 验收标准

### V1.0 发布标准

**必须满足**:
- [x] 支持 5+ Agent，每个都能正常对话
- [ ] 完整权限系统，2 种模式全部可用
  - [ ] 每次询问模式
  - [ ] 完全信任模式
  - [ ] 记住用户选择功能
- [ ] 测试覆盖 ≥60%，所有核心功能有测试
- [ ] TypeScript 0 errors，ESLint 0 errors
- [x] 用户文档完整 (快速开始 + FAQ + Agent 配置)
- [ ] 社区插件商店审核通过

**期望满足**:
- [ ] 会话持久化可用
- [ ] MCP 基础支持
- [ ] 性能优化 (首字节 <1s)
- [ ] 暗色模式适配

**可选**:
- [ ] 移动端基础支持
- [ ] 多 Agent 协同 (V2.0 功能)

---

## 🤝 贡献者指南

### 如何参与

1. **报告 Bug**: GitHub Issues
2. **功能建议**: GitHub Discussions
3. **代码贡献**: Pull Request
4. **文档改进**: 编辑 docs/ 目录
5. **Agent 适配**: 参考 `src/acp/backends/registry.ts`

### 开发环境搭建

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/obsidian-acp.git
cd obsidian-acp

# 安装依赖
npm install

# 开发模式 (实时编译)
npm run dev

# 运行测试
npm test

# 代码检查
npm run lint
npm run type-check

# 构建
npm run build
```

### 代码规范

- TypeScript strict 模式
- ESLint 0 errors, 最小化 warnings
- 所有 public 方法需要 JSDoc
- 测试覆盖新增功能

---

## 📞 联系方式

- **GitHub**: https://github.com/YOUR_USERNAME/obsidian-acp
- **Issues**: https://github.com/YOUR_USERNAME/obsidian-acp/issues
- **Discussions**: https://github.com/YOUR_USERNAME/obsidian-acp/discussions
- **Discord**: [待建立社区]

---

## 📄 许可证

MIT License - 开源免费

---

## 🙏 致谢

- **Obsidian 团队**: 提供优秀的笔记平台
- **Anthropic**: Claude Agent SDK
- **Zed Industries**: `@zed-industries/claude-code-acp` 桥接实现
- **ACP 协议制定者**: 开放标准推动生态发展
- **社区贡献者**: [待添加]

---

## 📊 项目统计

**当前状态** (2025-12-19):

```
代码统计:
  总文件数: 24 个 TypeScript 文件
  总行数: 7,854 行
  核心代码: ~3,500 行
  测试代码: ~400 行
  文档: 40+ 个 Markdown 文件

质量指标:
  TypeScript: 0 errors
  ESLint: 0 errors, 242 warnings
  测试覆盖: 20% (5/25+ 测试)
  构建产物: main.js 62KB

Agent 支持:
  ✅ Claude Code
  ✅ Kimi
  ✅ Codex (实验性)
  🚧 Gemini
  🚧 Qwen
  🚧 自定义

功能完成度:
  ✅ 架构搭建: 100%
  ⚠️ 核心功能: 40%
  ⚠️ 测试: 20%
  ⚠️ 文档: 60%
```

---

**版本历史**:
- v0.1.0 (2025-12-19): MVP 架构完成，Claude Code + Kimi 可用
- v1.0.0 (计划 2026 Q1): 生产就绪，上架社区插件商店
- v2.0.0 (计划 2026 Q3): 高级功能，多 Agent 协同

---

**最后更新**: 2025-12-19
**文档版本**: 1.0
**状态**: 🚧 开发中

---

## 🔧 代码规范与实现标准

**最后更新**: 2025-12-20

### TypeScript 类型规范

1. **严格类型检查**
   - 0 TypeScript errors (强制要求)
   - 尽量避免 `any` 类型,使用明确的类型定义
   - 所有 public 方法需要 JSDoc 注释

2. **ACP 协议类型对齐**
   - **ToolCallStatus**: 必须使用 `'pending' | 'in_progress' | 'completed' | 'failed'`
   - **禁止使用**: `'error'`, `'cancelled'` (不符合 ACP 规范)
   - **MessageContent**: 必须支持 `TextMessageContent | ImageMessageContent | ResourceLinkContent`

3. **命名约定**
   - 类型定义: PascalCase (`ToolCallStatus`)
   - 接口: PascalCase (`PermissionRequest`)
   - 枚举/常量: UPPER_SNAKE_CASE (`SessionUpdateType.AGENT_MESSAGE_CHUNK`)
   - 私有方法: camelCase with `private` 修饰符

### 架构设计原则

1. **分层架构** (5 层)
   ```
   UI Layer (ChatView, MessageRenderer)
      ↓
   Session Layer (SessionManager)
      ↓
   Protocol Layer (Connection, MessageHandler)
      ↓
   Backend Layer (Registry, Detector)
      ↓
   Execution Layer (CLI Spawner)
   ```

2. **单一职责**
   - `SessionManager`: 会话状态 + 历史管理
   - `MessageRenderer`: UI 渲染逻辑
   - `Connection`: 协议通信
   - `PermissionManager`: 权限控制

3. **依赖注入**
   - 通过构造函数传递依赖
   - 避免全局单例
   - 使用回调而非事件总线

### UI 渲染规范

1. **Markdown 优先**
   - 所有文本内容使用 Obsidian 的 `MarkdownRenderer.render()`
   - 支持 Obsidian 语法: `[[双链]]`, `#标签`, 代码块

2. **ContentBlock 渲染**
   - `text`: 直接 Markdown 渲染
   - `resource_link`: 转换为 `[Title](URI)` 格式
   - `image`: 转换为 `![alt](URI)` 格式
   - `diff`: 自定义渲染(带行号和复制按钮)

3. **性能优化**
   - 使用 `StreamingMessageBuffer` 批量更新 (300ms 间隔)
   - 仅在底部时自动滚动
   - 避免频繁的 DOM 操作

### 文件组织

```
src/
├── acp/                    # ACP 协议层
│   ├── core/              # 核心逻辑
│   │   ├── connection.ts  # JSON-RPC 通信
│   │   ├── session-manager.ts  # 会话管理
│   │   └── message-buffer.ts   # 消息缓冲
│   ├── backends/          # Agent 后端
│   │   ├── registry.ts    # Agent 配置
│   │   └── detector.ts    # CLI 检测
│   ├── types/             # 类型定义
│   │   ├── updates.ts     # SessionUpdate 类型
│   │   ├── initialize.ts  # 初始化类型
│   │   └── index.ts       # 导出汇总
│   └── permission-manager.ts  # 权限管理
├── ui/                    # UI 层
│   ├── ChatView.ts        # 聊天视图
│   ├── MessageRenderer.ts # 消息渲染
│   ├── PermissionModal.ts # 权限对话框
│   └── SettingsTab.ts     # 设置页面
└── main.ts                # 插件入口
```

---

## 📐 ACP 协议符合度评估

**评估日期**: 2025-12-20
**协议版本**: ACP 1.0
**官方文档**: https://agentclientprotocol.com

### ✅ 已实现的协议特性

#### 1. 核心协议 (100%)

- **JSON-RPC 2.0**: 完全符合规范
- **stdio 通信**: 子进程 stdin/stdout 交互
- **会话管理**: `session/new`, `session/prompt`, `session/cancel`
- **流式更新**: 8 种 `session/update` 类型全部支持
  - `agent_message_chunk`
  - `agent_thought_chunk`
  - `tool_call`
  - `tool_call_update`
  - `plan`
  - `available_commands_update`
  - `user_message_chunk`
  - `current_mode_update`

#### 2. ContentBlock 支持 (60%)

- ✅ **text**: Markdown 渲染 (协议要求必须支持)
- ✅ **resource_link**: 转换为 Markdown 链接 (协议要求必须支持)
- ⚠️ **image**: 基础支持 (转换为 Markdown 图片,但无真实显示)
- ❌ **audio**: 未实现 (笔记场景不需要)
- ❌ **resource** (嵌入资源): 未实现 (可用 resource_link 替代)

#### 3. ToolCall 渲染 (90%)

- ✅ **ToolCallStatus**: 使用协议标准状态 (`pending`, `in_progress`, `completed`, `failed`)
- ✅ **content**: 文本内容渲染
- ✅ **diff**: 带行号的增强渲染
- ✅ **terminal**: 基础支持 (仅显示 terminalId)
- ⚠️ **locations**: 定义了类型但未在 UI 显示

#### 4. Client Capabilities (40%)

- ✅ **fs/read_text_file**: 完全实现
- ✅ **fs/write_text_file**: 完全实现
- ❌ **terminal/***: 声明为 `false`,未实现任何方法
  - `terminal/create`
  - `terminal/output`
  - `terminal/wait_for_exit`
  - `terminal/kill`
  - `terminal/release`

#### 5. 权限系统 (80%)

- ✅ **session/request_permission**: 完全实现
- ✅ **PermissionOption**: 支持 `allow_once`, `allow_always`, `reject_once`
- ✅ **记忆功能**: `alwaysAllowedTools` 持久化
- ⚠️ **简化模式**: 只有 2 种模式 (interactive/trustAll),而非协议定义的 4 种 kind

### ❌ 未实现的协议特性

#### 1. Session Modes (0%)
- **原因**: 简单笔记场景不需要多模式切换
- **协议定义**: `session/set_mode`, `current_mode_update`
- **状态**: 类型定义存在,但无 UI 和逻辑实现

#### 2. Terminal 支持 (0%)
- **原因**: Obsidian 不是开发 IDE,不需要终端功能
- **协议定义**: 5 个 `terminal/*` 方法
- **状态**: 声明 `terminal: false` capability

#### 3. Audio ContentBlock (0%)
- **原因**: 笔记场景不涉及语音交互
- **协议定义**: `ContentBlock::Audio`
- **状态**: 类型定义存在,但无渲染逻辑

#### 4. 高级 MCP 能力 (0%)
- **原因**: 当前只需要 stdio 类型 MCP 服务器
- **协议定义**: HTTP, SSE 传输协议
- **状态**: `mcpCapabilities.http = false`, `mcpCapabilities.sse = false`

### 🎯 针对 Obsidian 笔记场景的优先级

#### 🔴 高优先级 (必须实现)

1. ✅ **text + resource_link ContentBlock** - 已完成
   - 笔记链接、文件引用是核心需求

2. ✅ **ToolCall diff 渲染** - 已完成
   - Agent 修改文件后需要展示变更

3. ✅ **权限系统** - 已完成
   - 2 模式足够 (interactive/trustAll)
   - 记住"始终允许"的工具

#### 🟡 中优先级 (有价值但非必需)

4. ⚠️ **image ContentBlock 真实渲染**
   - 当前: 转为 Markdown `![]()`
   - 改进: 实际显示图片 (Agent 截图、图表)

5. ⚠️ **locations 跟随**
   - 当前: 类型定义存在
   - 改进: UI 显示文件路径,可点击跳转

6. ⚠️ **session/load 支持**
   - 当前: 未声明 `loadSession` capability
   - 改进: 恢复历史会话

#### 🟢 低优先级 (可忽略)

7. ❌ **Session Modes** - 明确不实现
   - 理由: 简单场景不需要模式切换

8. ❌ **terminal 支持** - 明确不实现
   - 理由: Obsidian 不是终端环境

9. ❌ **audio 支持** - 明确不实现
   - 理由: 笔记场景无需语音

---

## 🚫 明确拒绝的功能 (不要重复实现)

**重要**: 以下功能已由用户明确拒绝,不要在任何情况下再次提出或实现。

### 1. ❌ "始终拒绝" 权限选项

**用户原话**: "我都说了我不需要始终拒绝的按钮,你怎么还给我加上始终拒绝？写个笔记，为什么要始终拒绝？不是我们给他添加工具的，你这个又给他拒绝掉。那我们工具的意义何在呢？"

**拒绝理由**:
- Obsidian 笔记场景,工具是为了帮助用户,不是限制用户
- 如果用户不想用某个工具,应该禁用 Agent 或修改权限模式,而非"始终拒绝"
- "始终拒绝"违背了 AI 辅助的初衷

**当前实现**:
- PermissionModal 有 3 个按钮: "拒绝"(reject_once), "允许一次"(allow_once), "始终允许此工具"(allow_always)
- **绝对不要添加** "始终拒绝" / "reject_always" 按钮

### 2. ❌ 复杂的权限规则系统

**用户隐含拒绝**: 用户要求"简单权限系统",只需要 2 模式 (interactive/trustAll)

**拒绝理由**:
- 笔记场景不需要企业级细粒度权限控制
- 过度设计会增加用户学习成本
- 2 模式足够: 完全控制 vs 完全信任

**当前实现**:
- 简单的 `alwaysAllowedTools` 字典记录用户选择
- **不要添加**: 基于路径的规则、基于时间的规则、基于操作类型的规则等

### 3. ❌ Session Modes UI

**协议支持**: ACP 定义了 Session Modes 机制
**拒绝理由**: Obsidian 笔记场景不需要模式切换 (ask/architect/code 等)

**不要实现**:
- `session/set_mode` UI 控件
- 模式切换下拉菜单
- 模式指示器

### 4. ❌ Terminal 相关功能

**协议支持**: ACP 定义了完整的 terminal 支持
**拒绝理由**: Obsidian 不是开发 IDE,不需要终端

**不要实现**:
- `terminal/create`, `terminal/output` 等 5 个方法
- 终端输出真实渲染
- 终端交互功能

### 5. ❌ Audio ContentBlock

**协议支持**: ACP 定义了 audio 类型
**拒绝理由**: 笔记场景无需语音交互

**不要实现**:
- 音频播放控件
- 语音转文字
- 音频可视化

---

## 💡 实现优先级 (2025-12-20)

### Phase 1: 协议对齐修复 ✅ (已完成 2025-12-20)

1. ✅ 修正 ToolCallStatus 类型 (`'failed'` 替代 `'error'`/`'cancelled'`)
2. ✅ 实现 resource_link ContentBlock (转为 Markdown 链接)
3. ✅ 验证构建无错误 (0 TypeScript errors)

**成果**:
- 3 个文件修改: `updates.ts`, `session-manager.ts`, `MessageRenderer.ts`
- 新增 `ResourceLinkContent` 接口
- resource_link 自动转为 `[Title](URI)` 格式

### Phase 2: UI 体验优化 (计划中)

1. **image ContentBlock 真实渲染**
   - 当前: `![](URI)` Markdown 占位
   - 目标: 实际显示图片 (base64 或 URL)

2. **ToolCall locations 显示**
   - 当前: 类型定义存在但未渲染
   - 目标: 显示文件路径,点击跳转

3. **权限 Modal 优化**
   - 当前: 基础功能可用
   - 目标: 显示工具危险等级,参数预览更友好

4. **错误处理增强**
   - 当前: 基础 try-catch
   - 目标: 友好的错误提示,重试机制

### Phase 3: 高级功能 (低优先级)

1. **session/load 支持**
   - 恢复历史会话
   - 会话持久化到文件

2. **MCP HTTP/SSE 支持**
   - 当前: 只支持 stdio
   - 扩展: 支持 HTTP/SSE 类型 MCP 服务器

3. **Agent 自动升级检测**
   - 检测 CLI 版本
   - 提示用户升级

---

## 📚 参考资源

### ACP 协议官方文档

- 官网: https://agentclientprotocol.com
- GitHub: https://github.com/zed-industries/agent-client-protocol
- Schema: https://agentclientprotocol.com/protocol/schema
- Session Setup: https://agentclientprotocol.com/protocol/session-setup

### 实现参考

- Zed Editor: https://zed.dev/acp
- Goose Blog: https://block.github.io/goose/blog/2025/10/24/intro-to-agent-client-protocol-acp/
- Gemini CLI: https://github.com/google-gemini/gemini-cli

### Obsidian API

- Plugin API: https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
- MarkdownRenderer: https://docs.obsidian.md/Reference/TypeScript+API/MarkdownRenderer

---

**维护说明**:
- 本文档是项目的唯一真实来源,所有决策和实现细节都记录于此
- Claude 在后续对话中应**优先参考此文档**,避免重复提出已拒绝的功能
- 定期更新 ACP 符合度评估,确保与协议最新版本同步
