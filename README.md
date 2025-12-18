# Obsidian ACP - Agent Client Protocol 集成插件

> 在 Obsidian 中直接与 AI Agent 对话,支持 Claude Code、Codex、Qwen 等多种 AI 编程助手

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Obsidian](https://img.shields.io/badge/Obsidian-1.0.0+-purple)](https://obsidian.md)

---

## 功能特性

- **多 Agent 支持**: 支持 Claude Code、Codex、Qwen、Goose、Augment、Kimi、OpenCode 等多种 AI Agent
- **原生协议集成**: 基于 Agent Client Protocol (ACP) 标准协议,确保最佳兼容性
- **智能权限管理**: 细粒度工具调用权限控制,保护您的文件安全
- **流畅交互体验**: 实时流式响应、Markdown 渲染、代码高亮
- **会话持久化**: 自动保存对话历史,随时恢复之前的会话
- **工作目录灵活配置**: 支持 Vault 根目录、当前文件夹、自定义路径
- **桌面端专用**: 充分利用本地文件系统能力

---

## 支持的 Agent

| Agent | 状态 | CLI 命令 | 认证 | 说明 |
|-------|------|---------|------|------|
| **Claude Code** | ✅ | `claude` | API Key | Anthropic 官方编程助手 |
| **Codex CLI** | ✅ | `codex` | - | OpenAI Codex 命令行工具 |
| **Qwen Code** | ✅ | `qwen` | API Key | 阿里通义千问编程助手 |
| **Goose** | ✅ | `goose` | - | Block 开源 AI 助手 |
| **Augment Code** | ✅ | `auggie` | - | Augment 代码助手 |
| **Kimi CLI** | ✅ | `kimi` | - | Moonshot Kimi 工具 |
| **OpenCode** | ✅ | `opencode` | - | OpenCode 开源助手 |
| **自定义** | ✅ | 用户配置 | - | 支持任何兼容 ACP 的 CLI |

> **注意**: Gemini CLI 暂未完全支持,正在等待官方完善 ACP 实现

---

## 快速开始

### 1. 安装插件

#### 方法 A: 手动安装 (推荐)

1. 下载最新 Release 中的 `main.js`, `manifest.json`, `styles.css`
2. 在 Vault 中创建目录 `.obsidian/plugins/obsidian-acp/`
3. 将三个文件复制到该目录
4. 重启 Obsidian
5. 在设置 → 第三方插件中启用 "ACP Agent Client"

#### 方法 B: 从源码构建

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/obsidian-acp.git
cd obsidian-acp

# 安装依赖
npm install

# 构建插件
npm run build

# 复制到 Obsidian 插件目录
cp main.js manifest.json styles.css /path/to/your/vault/.obsidian/plugins/obsidian-acp/
```

### 2. 安装 Agent CLI

选择一个您想使用的 Agent,安装对应的 CLI 工具:

#### Claude Code (推荐)

```bash
# 全局安装
npm install -g @anthropic-ai/claude-code

# 或使用 npx (无需安装)
# 插件会自动使用 npx
```

配置 API Key:
```bash
claude auth
```

#### Qwen Code

```bash
npm install -g @qwen-code/qwen-code
qwen auth
```

#### Goose

```bash
pip install goose-ai
```

#### 其他 Agent

参考各 Agent 的官方文档进行安装

### 3. 打开 ACP Chat 视图

- 点击左侧边栏的机器人图标
- 或使用命令面板: `ACP: Open Chat View`
- 或通过功能区按钮打开

### 4. 连接 Agent 并开始对话

1. 在顶部下拉菜单中选择一个检测到的 Agent
2. 点击 "连接" 按钮
3. 等待连接成功提示
4. 在输入框中输入问题并发送

就这么简单!

---

## 配置说明

### 插件设置

在 Obsidian 设置 → 插件选项 → ACP Agent Client 中可以配置:

#### 基础设置

- **默认 Agent**: 启动时自动选择的 Agent
- **工作目录**: Agent 的工作路径
  - `Vault 根目录`: 使用 Obsidian Vault 的根目录
  - `当前文件夹`: 使用当前打开文件所在的文件夹
  - `自定义路径`: 指定任意路径

#### Agent 路径覆盖

如果自动检测失败,可以手动指定各 Agent 的 CLI 路径:

```
Claude Code: /usr/local/bin/claude
Codex CLI: /Users/username/.nvm/versions/node/v18.0.0/bin/codex
```

#### UI 偏好

- **显示工具调用详情**: 在聊天中显示 Agent 执行的工具调用
- **自动批准文件读取**: 跳过文件读取权限确认(信任 Agent 时可开启)

### 权限管理

Agent 执行某些操作时需要您的授权:

- **文件读取**: Agent 需要读取文件内容
- **文件写入**: Agent 需要修改或创建文件
- **命令执行**: Agent 需要执行终端命令
- **网络请求**: Agent 需要访问网络

权限选项:
- **允许一次**: 仅本次允许
- **始终允许**: 记住选择,以后自动允许(针对当前工具)
- **拒绝一次**: 拒绝本次操作
- **始终拒绝**: 记住选择,以后自动拒绝

> **安全提示**: 首次使用 Agent 时,建议谨慎授予权限,特别是文件写入和命令执行

---

## 使用技巧

### 1. 高效提问

好的问题示例:
```
分析 src/main.ts 中的 onload 方法,解释它做了什么

帮我重构 utils/helpers.ts 中的 formatDate 函数,使用 date-fns 库

在当前项目中搜索所有 TODO 注释并整理成列表
```

### 2. 利用工作目录

- 如果主要操作 Vault 中的笔记,选择 "Vault 根目录"
- 如果在处理某个项目文件夹,选择 "当前文件夹" 或指定项目路径

### 3. 会话管理

- 使用 "新建会话" 开始全新对话
- 从侧边栏加载历史会话继续之前的工作
- 定期清理旧会话节省存储空间

### 4. Markdown 集成

Agent 的回复支持完整的 Obsidian Markdown 语法:
- `[[链接]]` 会被正确渲染
- 代码块支持语法高亮
- 可以直接点击链接跳转

---

## 常见问题

### 连接 Agent 失败

**可能原因**:
1. CLI 未正确安装
2. CLI 不在 PATH 环境变量中
3. Agent 需要认证但未配置

**解决方法**:
1. 在终端运行 CLI 命令测试: `claude --version`
2. 检查 PATH: `echo $PATH` (macOS/Linux) 或 `echo %PATH%` (Windows)
3. 运行认证命令: `claude auth` 或 `qwen auth`
4. 在插件设置中手动指定 CLI 完整路径

### Agent 响应很慢

**可能原因**:
1. 网络延迟
2. 模型处理复杂任务
3. 文件操作较多

**解决方法**:
1. 检查网络连接
2. 拆分大任务为多个小步骤
3. 考虑使用本地 Agent (如 Codex)

### 权限请求频繁弹出

**解决方法**:
1. 选择 "始终允许" 记住选择
2. 在设置中开启 "自动批准文件读取" (信任 Agent 时)
3. 检查是否 Agent 遇到循环操作

### 会话丢失

**预防措施**:
- 插件会自动保存会话到 `.obsidian/plugins/obsidian-acp/sessions/`
- 定期备份 Vault
- 重要对话可以复制到笔记中

---

## 高级用法

### 自定义 Agent

如果您有自己的 ACP 兼容 Agent:

1. 在设置中选择 "自定义 Agent"
2. 指定 CLI 完整路径和启动参数
3. 示例: `/path/to/my-agent --acp --model=gpt-4`

### 批量操作

利用 Agent 能力批量处理文件:

```
遍历 notes/ 目录下所有 Markdown 文件,为每个文件添加创建日期的 frontmatter
```

### 与其他插件配合

- **Templater**: 让 Agent 生成模板内容
- **Dataview**: 让 Agent 帮助编写复杂查询
- **Tasks**: 让 Agent 分析任务并生成报告

---

## 开发文档

### 项目结构

```
src/
├── acp/                    # ACP 协议核心
│   ├── types/             # 类型定义
│   ├── core/              # 核心模块
│   │   ├── connection.ts  # ACP 连接管理
│   │   ├── session-manager.ts  # 会话管理
│   │   └── request-queue.ts    # 请求队列
│   ├── backends/          # Agent 后端配置
│   └── detector.ts        # CLI 检测器
├── ui/                    # 用户界面
│   ├── ChatView.ts       # 聊天视图
│   ├── MessageRenderer.ts # 消息渲染
│   └── PermissionModal.ts # 权限弹窗
├── settings/              # 设置界面
└── storage/               # 会话存储
```

### 扩展指南

#### 添加新的 Agent 支持

1. 在 `src/acp/backends/registry.ts` 中添加配置:

```typescript
export const ACP_BACKENDS = {
  // ...existing agents
  myagent: {
    id: 'myagent',
    name: 'My Agent',
    description: '我的自定义 Agent',
    cliCommand: 'myagent',
    acpArgs: ['--acp'],
    authRequired: false,
    enabled: true,
    supportsStreaming: true,
  },
};
```

2. 重新构建插件: `npm run build`

#### 自定义消息渲染

扩展 `MessageRenderer` 类以支持自定义内容块渲染。

---

## 路线图

- [x] 核心 ACP 协议实现
- [x] 多 Agent 支持
- [x] 权限管理系统
- [x] 会话持久化
- [ ] 工具调用可视化 (进行中)
- [ ] Gemini CLI 完整支持
- [ ] 移动端支持 (受限于 ACP 协议)
- [ ] Agent 能力对比视图
- [ ] 对话导出为 Markdown
- [ ] 快捷指令系统

---

## 贡献指南

欢迎贡献代码、报告 Bug 或提出建议!

1. Fork 本仓库
2. 创建特性分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'feat: add amazing feature'`
4. 推送到分支: `git push origin feature/amazing-feature`
5. 提交 Pull Request

### 代码规范

- 使用 TypeScript
- 遵循 ESLint 规则
- 中文注释和文档
- 提交信息使用约定式提交 (Conventional Commits)

---

## 致谢

- [Obsidian](https://obsidian.md) - 强大的知识管理工具
- [Agent Client Protocol](https://github.com/agent-client-protocol/agent-client-protocol) - 统一的 Agent 通信协议
- [Claude Code](https://claude.ai/code) - 首个支持 ACP 的 AI 编程助手
- 所有贡献者和用户的反馈

---

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 联系方式

- 项目主页: [GitHub](https://github.com/YOUR_USERNAME/obsidian-acp)
- 问题反馈: [Issues](https://github.com/YOUR_USERNAME/obsidian-acp/issues)
- 讨论交流: [Discussions](https://github.com/YOUR_USERNAME/obsidian-acp/discussions)

---

**享受与 AI Agent 在 Obsidian 中的协作吧!**
