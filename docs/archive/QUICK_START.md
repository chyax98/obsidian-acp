# 快速开始指南

欢迎使用 Obsidian ACP 插件!本指南将帮助您在 5 分钟内完成设置并开始使用。

---

## 前置要求

- Obsidian 版本 >= 1.0.0
- Node.js >= 16 (用于安装某些 Agent CLI)
- macOS、Windows 或 Linux 桌面操作系统

---

## 第一步: 安装插件

### 选项 A: 从 Release 安装 (推荐)

1. 访问 [GitHub Releases](https://github.com/YOUR_USERNAME/obsidian-acp/releases)
2. 下载最新版本的三个文件:
   - `main.js`
   - `manifest.json`
   - `styles.css`
3. 在您的 Vault 中创建插件目录:
   ```
   YourVault/.obsidian/plugins/obsidian-acp/
   ```
4. 将下载的三个文件复制到该目录
5. 重启 Obsidian
6. 打开 设置 → 第三方插件
7. 找到并启用 "ACP Agent Client"

### 选项 B: 从源码构建

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/obsidian-acp.git
cd obsidian-acp

# 安装依赖
npm install

# 构建
npm run build

# 复制到您的 Vault (修改路径)
cp main.js manifest.json styles.css ~/Documents/YourVault/.obsidian/plugins/obsidian-acp/
```

---

## 第二步: 安装 Agent CLI

选择您想使用的 AI Agent,并安装对应的 CLI 工具。

### 推荐: Claude Code

Claude Code 是 Anthropic 官方的编程助手,功能强大且对 ACP 支持完善。

#### 安装

```bash
# 插件会自动使用 npx @zed-industries/claude-code-acp
# 无需手动安装
```

#### 配置 API Key

**方式 1: 环境变量** (推荐)
```bash
# 添加到 ~/.zshrc 或 ~/.bashrc
export ANTHROPIC_API_KEY="your-api-key-here"

# 重新加载
source ~/.zshrc
```

**方式 2: 配置文件**
```bash
mkdir -p ~/.config/claude-code
echo '{"apiKey":"your-api-key-here"}' > ~/.config/claude-code/config.json
```

> **获取 API Key**: 访问 [console.anthropic.com](https://console.anthropic.com)

#### 验证

```bash
npx @zed-industries/claude-code-acp --version
```

**重要**: 从终端启动 Obsidian 以继承环境变量
```bash
export ANTHROPIC_API_KEY="your-api-key-here"
open -a Obsidian
```

---

### 其他 Agent 选项

#### Qwen Code (阿里通义千问)

```bash
npm install -g @qwen-code/qwen-code
qwen auth
```

#### Goose (开源)

```bash
pip install goose-ai
# 无需认证
```

#### Codex CLI

```bash
npm install -g codex-cli
# 按照提示配置
```

#### Augment Code

```bash
npm install -g augment-code
auggie auth
```

---

## 第三步: 打开 ACP Chat 视图

在 Obsidian 中打开 ACP 聊天界面有三种方式:

### 方式 1: 侧边栏图标

点击左侧边栏的机器人图标 (🤖)

### 方式 2: 命令面板

1. 按 `Ctrl/Cmd + P` 打开命令面板
2. 输入 "ACP"
3. 选择 "ACP: Open Chat View"

### 方式 3: 功能区

点击 Obsidian 功能区(左上角)的 ACP 图标

---

## 第四步: 连接 Agent

1. 在 Chat View 顶部的下拉菜单中选择一个 Agent

   插件会自动检测已安装的 Agent。如果没有检测到,请:
   - 确认 CLI 已正确安装
   - 检查 CLI 在系统 PATH 中
   - 或在设置中手动指定路径

2. 点击 "连接" 按钮

3. 等待连接成功

   看到 "已连接" 状态提示后即可使用

---

## 第五步: 开始对话

在输入框中输入您的问题,按 `Enter` 或点击发送按钮。

### 示例问题

#### 文件分析

```
帮我分析 README.md 文件,总结主要内容
```

#### 代码生成

```
创建一个 TypeScript 函数,用于解析 ISO 日期字符串并格式化为 YYYY-MM-DD
```

#### 项目搜索

```
在当前项目中搜索所有包含 TODO 的文件,并列出来
```

#### 批量操作

```
遍历 notes/ 目录,为每个 Markdown 文件添加创建日期的 frontmatter
```

---

## 第六步: 处理权限请求

当 Agent 需要执行某些操作时,会弹出权限请求窗口。

### 权限类型

- **文件读取**: Agent 读取文件内容
- **文件写入**: Agent 创建或修改文件
- **命令执行**: Agent 在终端执行命令
- **网络请求**: Agent 访问网络

### 权限选项

- **允许一次**: 仅本次允许,下次再问
- **始终允许**: 记住选择,以后自动允许(针对该工具)
- **拒绝一次**: 拒绝本次操作
- **始终拒绝**: 记住选择,以后自动拒绝

### 建议

- 首次使用时选择 "允许一次",观察 Agent 行为
- 确认安全后,可以选择 "始终允许" 提高效率
- 对于敏感操作(如写入重要文件),保持谨慎

---

## 配置优化 (可选)

### 设置工作目录

打开 设置 → ACP Agent Client → 工作目录:

- **Vault 根目录**: 让 Agent 可以访问整个 Vault
- **当前文件夹**: Agent 只能访问当前打开文件所在的文件夹
- **自定义路径**: 指定任意项目路径

**建议**: 如果主要在 Vault 中使用,选择 "Vault 根目录"

### 自动批准文件读取

如果您信任 Agent,可以在设置中开启 "自动批准文件读取",减少权限弹窗。

⚠️ **注意**: 这会让 Agent 可以无确认读取工作目录下的任何文件

### 手动指定 CLI 路径

如果插件未能自动检测到 Agent,可以在设置中手动配置:

```
Claude Code: /usr/local/bin/claude
Qwen Code: /Users/yourname/.nvm/versions/node/v18.0.0/bin/qwen
```

---

## 常见问题排查

### 1. Agent 下拉菜单为空

**原因**: 未检测到任何已安装的 Agent

**解决**:
```bash
# 测试 CLI 是否可用
claude --version
qwen --version

# 检查 PATH
echo $PATH   # macOS/Linux
echo %PATH%  # Windows
```

如果 CLI 已安装但不在 PATH 中,在插件设置中手动指定完整路径。

### 2. 连接失败

**原因**: 认证未配置或网络问题

**解决**:
```bash
# 运行认证命令
claude auth
qwen auth
```

确保输入了有效的 API Key。

### 3. 权限请求无响应

**原因**: 弹窗被其他窗口遮挡

**解决**: 检查 Obsidian 窗口是否有弹窗,点击 "允许一次" 或 "拒绝一次"

### 4. Agent 回复很慢

**原因**: 网络延迟或任务复杂

**解决**:
- 检查网络连接
- 拆分大任务为多个小步骤
- 考虑使用本地 Agent (如 Goose)

---

## 高级技巧

### 技巧 1: 使用上下文

Agent 会记住会话中的上下文,您可以利用这一点:

```
用户: 分析 src/main.ts 的 onload 方法
Agent: [分析结果]

用户: 现在重构这个方法,拆分成更小的函数
Agent: [重构建议]
```

### 技巧 2: 明确指定文件路径

使用相对路径或绝对路径指定文件:

```
读取 ./docs/features/ACP-INTEGRATION-DESIGN.md 并总结要点
```

### 技巧 3: 批量处理

让 Agent 处理多个文件:

```
分析 src/acp/core/ 目录下所有 .ts 文件,找出代码复杂度最高的函数
```

### 技巧 4: 结合 Obsidian 特性

利用 Obsidian 的链接和嵌入:

```
分析 [[项目规划]] 笔记,提取所有待办事项并整理成清单
```

---

## 下一步

- 查看 [README.md](../README.md) 了解完整功能
- 阅读 [FAQ.md](./FAQ.md) 解决更多问题
- 探索不同 Agent 的特性和优势
- 配置权限规则以匹配您的工作流

---

**享受与 AI Agent 的协作!**
