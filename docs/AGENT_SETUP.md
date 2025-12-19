# Agent 配置指南

> 详细介绍 5 个支持的 AI Agent 的安装、配置和使用方法。

## 📊 Agent 对比

| 特性 | Claude Code | Kimi | Codex ACP | Gemini CLI | Qwen Code |
|------|-------------|------|-----------|------------|-----------|
| **编程能力** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **中文支持** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **响应速度** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **价格** | $20/月 | 有免费额度 | $20/月 | 有免费额度 | 完全免费 |
| **安装难度** | 简单（npx） | 中等（npm） | 简单（npx） | 中等（npm） | 简单（npm） |
| **需要 API Key** | ✅ 是 | ⚠️ 可选 | ✅ 是 | ⚠️ 可选 | ❌ 否 |

**推荐选择**：
- 🏆 **最强编程**：Claude Code 或 Codex ACP
- 🇨🇳 **中文优先**：Kimi 或 Qwen Code
- 💰 **预算有限**：Qwen Code（完全免费）或 Gemini CLI（有免费额度）
- 🚀 **快速上手**：Qwen Code（无需配置）

---

## 1️⃣ Claude Code（Anthropic 官方）

### 特点

- ✅ **编程能力最强**：代码理解、重构、调试
- ✅ **Zed 官方支持**：通过 `@zed-industries/claude-code-acp` 适配器
- ✅ **流式输出**：实时显示思考过程
- ⚠️ **需要付费**：Claude Pro ($20/月) 或 API Key

### 安装

```bash
# 方式 1：使用 npx（推荐，插件会自动调用）
# 无需手动操作

# 方式 2：全局安装（加速启动）
npm install -g @zed-industries/claude-code-acp

# 验证安装
npx @zed-industries/claude-code-acp --version
```

### 配置 API Key

**方式 1：环境变量（推荐）**

```bash
# macOS/Linux
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# 持久化到 shell 配置
echo 'export ANTHROPIC_API_KEY="sk-ant-api03-..."' >> ~/.zshrc
source ~/.zshrc

# Windows PowerShell
$env:ANTHROPIC_API_KEY="sk-ant-api03-..."

# 持久化
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-ant-api03-...", "User")
```

**方式 2：从终端启动 Obsidian**

```bash
# macOS
export ANTHROPIC_API_KEY="sk-ant-api03-..."
open -a Obsidian

# Linux
export ANTHROPIC_API_KEY="sk-ant-api03-..."
obsidian &

# Windows
set ANTHROPIC_API_KEY=sk-ant-api03-...
start obsidian://
```

### 获取 API Key

1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 注册/登录账号
3. 前往 "API Keys" 页面
4. 创建新的 API Key
5. 复制并保存（仅显示一次）

### 验证配置

```bash
# 检查环境变量
echo $ANTHROPIC_API_KEY  # macOS/Linux
echo %ANTHROPIC_API_KEY%  # Windows

# 测试 CLI
npx @zed-industries/claude-code-acp --help
```

### 常见问题

**Q: 为什么不直接使用 `@anthropic-ai/claude-code`？**
A: Electron 环境不支持 native bindings，需要使用 Zed 的 ACP 适配器。

**Q: API Key 会被上传吗？**
A: 不会。所有通信完全本地，通过 CLI 子进程与 Anthropic API 交互。

---

## 2️⃣ Kimi（Moonshot AI）

### 特点

- ✅ **中文友好**：国产 AI，中文理解和表达优秀
- ✅ **原生 ACP 支持**：使用 `--acp` 参数
- ✅ **有免费额度**：注册即可使用
- ⚠️ **安装稍复杂**：需要 npm 全局安装

### 安装

```bash
# 安装 Kimi CLI
npm install -g @moonshot-ai/kimi-cli

# 验证安装
kimi --version
```

### 配置认证（可选）

Kimi CLI 支持两种模式：
1. **免费模式**：无需 API Key，有每日限额
2. **API Key 模式**：更高额度和优先级

```bash
# 方式 1：免费模式（推荐先试用）
# 直接使用，无需配置

# 方式 2：API Key 模式
export MOONSHOT_API_KEY="sk-..."

# 持久化
echo 'export MOONSHOT_API_KEY="sk-..."' >> ~/.zshrc
source ~/.zshrc
```

### 获取 API Key（可选）

1. 访问 [Moonshot AI 开放平台](https://platform.moonshot.cn/)
2. 注册/登录账号
3. 创建 API Key
4. 复制并保存

### 验证配置

```bash
# 测试 CLI
kimi --help

# 测试 ACP 模式
kimi --acp --help
```

### 常见问题

**Q: 免费模式有什么限制？**
A: 每日请求次数有限，具体限额见官方文档。

**Q: 支持哪些模型？**
A: 默认使用 Kimi-1.5，支持长上下文（200K tokens）。

---

## 3️⃣ Codex ACP（OpenAI）

### 特点

- ✅ **OpenAI Codex**：基于 GPT-4，编程能力强
- ✅ **Zed 官方适配器**：通过 `@zed-industries/codex-acp`
- ✅ **流式输出**：支持实时响应
- ⚠️ **需要付费**：ChatGPT Plus/Pro ($20/月) 或 OPENAI_API_KEY

### 安装

```bash
# 方式 1：使用 npx（推荐，插件会自动调用）
# 无需手动操作

# 方式 2：全局安装（加速启动）
npm install -g @zed-industries/codex-acp

# 验证安装
npx @zed-industries/codex-acp --version
```

### 配置认证

**方式 1：OPENAI_API_KEY（推荐）**

```bash
# macOS/Linux
export OPENAI_API_KEY="sk-..."

# 持久化
echo 'export OPENAI_API_KEY="sk-..."' >> ~/.zshrc
source ~/.zshrc

# Windows
$env:OPENAI_API_KEY="sk-..."
```

**方式 2：ChatGPT 订阅**

如果你有 ChatGPT Plus/Pro/Team/Enterprise 订阅，CLI 会自动使用。

**方式 3：CODEX_API_KEY**

```bash
export CODEX_API_KEY="sk-..."
```

### 获取 API Key

1. 访问 [OpenAI Platform](https://platform.openai.com/)
2. 注册/登录账号
3. 前往 "API Keys" 页面
4. 创建新的 API Key
5. 复制并保存

### 验证配置

```bash
# 检查环境变量
echo $OPENAI_API_KEY

# 测试 CLI
npx @zed-industries/codex-acp --help
```

### 常见问题

**Q: 和原生 `codex` CLI 有什么区别？**
A: 原生 `codex` CLI 不支持 ACP，`codex-acp` 是 Zed 开发的 ACP 适配器。

**Q: 支持哪些模型？**
A: 默认使用 GPT-4，可在 CLI 参数中指定其他模型。

---

## 4️⃣ Gemini CLI（Google 官方）

### 特点

- ✅ **Google × Zed 联合发布**：ACP 首个参考实现
- ✅ **免费额度**：每天 1000 次请求
- ✅ **流式输出**：支持实时响应
- ✅ **多种认证方式**：OAuth / API Key / Vertex AI
- ⚠️ **实验性参数**：使用 `--experimental-acp`（历史原因）

### 安装

```bash
# 方式 1：npm 全局安装
npm install -g @google/gemini-cli

# 方式 2：Homebrew (macOS)
brew install google-gemini/tap/gemini-cli

# 验证安装
gemini --version
```

### 配置认证

**方式 1：Google Account OAuth（推荐）**

```bash
# 登录 Google 账号
gemini auth login

# 按提示在浏览器中登录
# 授权后自动返回终端
```

**方式 2：API Key**

```bash
# 获取 API Key：https://ai.google.dev/
export GOOGLE_API_KEY="..."

# 持久化
echo 'export GOOGLE_API_KEY="..."' >> ~/.zshrc
source ~/.zshrc
```

**方式 3：Vertex AI（企业用户）**

```bash
export GOOGLE_CLOUD_PROJECT="your-project-id"
# 需配置服务账号和 gcloud CLI
```

### 验证配置

```bash
# 测试 CLI
gemini --help

# 测试 ACP 模式
gemini --experimental-acp --help
```

### 免费额度

- **每分钟**：60 次请求
- **每天**：1000 次请求
- **模型**：Gemini 2.5 Pro

### 常见问题

**Q: 为什么叫 `--experimental-acp`？**
A: 历史原因。虽然名字有 "experimental"，但实际已是生产就绪。

**Q: 需要绑定信用卡吗？**
A: 免费额度内不需要。超额后需升级。

---

## 5️⃣ Qwen Code（阿里通义千问）

### 特点

- ✅ **完全免费**：无需 API Key，开箱即用
- ✅ **中文优秀**：国产 AI，中文理解和生成能力强
- ✅ **原生 ACP 支持**：使用 `--experimental-acp` 参数
- ✅ **快速响应**：国内访问速度快
- ✅ **最简单配置**：npm 安装即用

### 安装

```bash
# 安装 Qwen Code
npm install -g qwen-code

# 验证安装
qwen --version
```

### 配置认证

**完全不需要！** Qwen Code 在促销期内完全免费，无需任何 API Key 或账号。

### 验证配置

```bash
# 测试 CLI
qwen --help

# 测试 ACP 模式
qwen --experimental-acp --help

# 测试对话（可选）
qwen chat "你好"
```

### 使用限制

- 免费额度：每日请求次数充足（具体限额见官方文档）
- 模型：Qwen Code 最新版本
- 功能：完整的 ACP 支持，包括 MCP 服务器集成

### 常见问题

**Q: 真的完全免费吗？**
A: 是的，促销期内完全免费。未来可能会有付费计划，但免费版会继续保留。

**Q: 国内访问速度如何？**
A: 非常快，服务器在国内，无需翻墙。

**Q: 数据会被收集吗？**
A: 请查看阿里云通义千问的隐私政策。所有通信通过 HTTPS 加密。

---

## 🔄 切换 Agent

插件支持随时切换 Agent，无需重启 Obsidian：

1. 点击"断开连接"按钮（如果已连接）
2. 在顶部下拉框中选择其他 Agent
3. 点击"连接"按钮
4. 等待新 Agent 连接成功

**建议**：
- 编程任务：使用 Claude Code 或 Codex ACP
- 中文对话：使用 Kimi 或 Qwen Code
- 快速测试：使用 Qwen Code（免费且快速）
- 实验新功能：使用 Gemini CLI（Google 最新技术）

---

## 🛠️ 高级配置

### 自定义 CLI 路径

如果 CLI 安装在非标准位置：

1. 打开 Obsidian 设置
2. 前往 "ACP Agent Client"
3. 找到对应 Agent 配置
4. 输入完整的 CLI 路径
   - 例如：`/usr/local/bin/kimi --acp`
   - 或：`/opt/homebrew/bin/gemini --experimental-acp`

### 配置环境变量

在插件设置中，可以为每个 Agent 单独配置环境变量：

```json
{
  "ANTHROPIC_API_KEY": "sk-ant-...",
  "OPENAI_API_KEY": "sk-...",
  "GOOGLE_API_KEY": "..."
}
```

### 调试模式

启用详细日志：

1. 打开开发者工具：`Ctrl/Cmd + Shift + I`
2. 在 Console 中查看 `[ACP]` 开头的日志
3. 查看连接状态、消息流、错误信息

---

## 📖 下一步

- [快速开始](./GETTING_STARTED.md) - 5 分钟上手
- [常见问题 FAQ](./FAQ.md) - 疑难解答
- [权限系统](./PERMISSIONS.md) - 理解权限管理
- [快速参考](../USAGE.md) - 常用操作

**祝配置顺利！** 🚀
