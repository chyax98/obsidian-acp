# 快速开始指南

> 5 分钟内完成安装，开始与 AI Agent 对话！

## 📦 第一步：安装插件

### 方式 1：从 Release 安装（推荐）

1. 前往 [GitHub Releases](https://github.com/YOUR_USERNAME/obsidian-acp/releases)
2. 下载最新的 `obsidian-acp-vX.X.X.zip`
3. 解压到你的 Vault 的 `.obsidian/plugins/obsidian-acp/` 目录
4. 在 Obsidian 设置中：
   - 打开 `设置` → `社区插件`
   - 关闭"安全模式"（如果尚未关闭）
   - 刷新插件列表
   - 找到并启用 "ACP Agent Client"

### 方式 2：手动构建

```bash
git clone https://github.com/YOUR_USERNAME/obsidian-acp.git
cd obsidian-acp
npm install
npm run build
# 将 main.js, manifest.json, styles.css 复制到 Vault/.obsidian/plugins/obsidian-acp/
```

## 🤖 第二步：选择并配置 Agent

我们推荐从 **Qwen Code**（完全免费）或 **Gemini CLI**（有免费额度）开始。

### 选项 A：Qwen Code（推荐，完全免费）

```bash
# 1. 安装 Qwen Code CLI
npm install -g qwen-code

# 2. 验证安装
qwen --version
# 输出类似：qwen-code version 0.x.x

# 3. 完成！无需 API Key，开箱即用
```

### 选项 B：Gemini CLI（有免费额度）

```bash
# 1. 安装 Gemini CLI
npm install -g @google/gemini-cli

# 2. 配置认证
gemini auth login
# 按提示在浏览器中登录 Google 账号

# 3. 完成！每天有 1000 次免费请求
```

### 选项 C：Claude Code（编程能力最强，需付费）

```bash
# 1. 设置 API Key
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# 2. 插件会自动调用 npx，无需手动安装

# 3. （可选）全局安装以加速启动
npm install -g @zed-industries/claude-code-acp
```

## 🚀 第三步：连接 Agent

1. **打开 ACP Chat 视图**
   - 点击左侧工具栏的 🤖 图标
   - 或使用命令面板：`Ctrl/Cmd + P` → 输入 "ACP" → 选择 "打开 ACP Chat"

2. **选择 Agent**
   - 在顶部下拉框中选择你刚安装的 Agent
   - 例如：Qwen Code、Gemini CLI 或 Claude Code

3. **点击"连接"**
   - 等待 3-5 秒
   - 状态显示"已连接"后即可开始对话

## 💬 第四步：第一次对话

### 简单问候

```
你好！请介绍一下你自己
```

### 测试文件访问

```
读取当前 Vault 根目录下的 README.md 文件，并总结主要内容
```

**第一次文件操作**：会弹出权限对话框
- 点击"允许一次"（安全）
- 或"始终允许读取"（方便，但建议先试用一次）

### 创建笔记

```
在 notes/ 目录下创建一个名为 "AI 测试笔记.md" 的文件，内容为：
# AI 测试笔记

这是由 AI Agent 创建的测试笔记。

- 创建时间：{{date}}
- 使用 Agent：{{agent_name}}

## 测试功能
- [x] 文件创建
- [ ] 内容编辑
- [ ] 批量操作
```

**第一次文件写入**：会弹出权限对话框
- 仔细查看 Agent 要写入的内容
- 确认无误后点击"允许一次"

## 🎓 第五步：了解核心功能

### 1. 思考过程（可折叠）

Agent 工作时会显示：
```
💭 [思考] 用户想要创建笔记，我需要...
    1. 确认目录是否存在
    2. 构建文件内容
    3. 调用 fs/write 工具
```

点击可折叠/展开，帮助你理解 AI 的决策过程。

### 2. 工具调用（详细信息）

```
🔧 [工具调用] fs/write
   文件：notes/AI 测试笔记.md
   状态：✅ 成功
```

实时显示 Agent 使用的工具和执行结果。

### 3. 权限管理

当 Agent 需要访问文件或执行命令时：
- 🟢 **读取操作**：建议"始终允许"（安全）
- 🟡 **写入操作**：建议"允许一次"（谨慎）
- 🔴 **命令执行**：仔细检查命令再批准

### 4. 模式指示

顶部会显示当前模式：
- 📝 **ask**: 对话模式（纯文本回复）
- 💻 **code**: 编程模式（可能调用工具）
- 📋 **plan**: 规划模式（生成执行计划）

## 🎯 实用场景示例

### 场景 1：整理笔记

```
帮我整理 [[项目笔记]] 相关的所有文件，生成一份结构化的总结文档
```

### 场景 2：批量处理

```
为 notes/ 目录下所有没有 frontmatter 的 .md 文件添加：
---
created: {{today}}
tags: []
---
```

### 场景 3：代码重构

```
分析 src/main.ts 的代码结构，建议如何拆分成多个模块
```

### 场景 4：知识提取

```
从我的笔记中提取所有关于 "TypeScript" 的内容，生成一份学习笔记
```

## 🔧 常见问题（快速解决）

### Agent 检测不到？

```bash
# macOS/Linux：从终端启动 Obsidian（继承环境变量）
export ANTHROPIC_API_KEY="sk-ant-..."
open -a Obsidian

# Windows：在环境变量中设置 API Key
set ANTHROPIC_API_KEY=sk-ant-...
start obsidian://
```

### 连接失败？

1. **检查 CLI 安装**
   ```bash
   # Qwen Code
   qwen --version

   # Gemini CLI
   gemini --version

   # Claude Code
   npx @zed-industries/claude-code-acp --version
   ```

2. **检查 API Key**（如果使用 Claude/Codex）
   ```bash
   echo $ANTHROPIC_API_KEY
   echo $OPENAI_API_KEY
   ```

3. **查看详细日志**
   - 打开开发者工具：`Ctrl/Cmd + Shift + I`
   - 在 Console 中查看 `[ACP]` 开头的日志

### 想切换 Agent？

- 断开当前 Agent：点击"断开连接"
- 在下拉框中选择其他 Agent
- 点击"连接"

## 🎉 下一步

你已经完成基础配置！接下来可以：

1. 📚 **学习更多**：
   - [Agent 配置指南](./AGENT_SETUP.md) - 配置其他 4 个 Agent
   - [权限系统详解](./PERMISSIONS.md) - 深入理解权限管理
   - [常见问题 FAQ](./FAQ.md) - 更多疑难解答

2. 🔬 **尝试高级功能**：
   - 在设置中配置"工作目录模式"
   - 探索不同 Agent 的特性差异
   - 使用复杂的多步骤任务

3. 💬 **加入社区**：
   - [GitHub Issues](https://github.com/YOUR_USERNAME/obsidian-acp/issues) - 报告问题
   - [GitHub Discussions](https://github.com/YOUR_USERNAME/obsidian-acp/discussions) - 分享经验

**祝使用愉快！** 🎊
