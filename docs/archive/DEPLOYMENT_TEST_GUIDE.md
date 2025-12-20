# 🚀 Obsidian ACP Plugin - 部署和测试指南

**日期**: 2025-12-20  
**状态**: ✅ 插件已部署到 `~/note-vsc/.obsidian/plugins/obsidian-acp/`

---

## ✅ 第一步：插件已部署

插件文件已成功复制到你的 Obsidian vault：

```bash
~/note-vsc/.obsidian/plugins/obsidian-acp/
├── main.js (81KB)
├── manifest.json
├── styles.css (36KB)
└── data.json (插件数据)
```

---

## 🔧 第二步：在 Obsidian 中启用插件

### 1. 打开 Obsidian
```bash
# 如果 Obsidian 正在运行，先关闭它
# 然后重新打开
open -a Obsidian ~/note-vsc
```

### 2. 启用插件
1. 打开 Obsidian 后，按 `Cmd + ,` 打开设置
2. 点击左侧菜单中的 **"社区插件"**
3. 如果显示"安全模式"已开启：
   - 点击 **"关闭安全模式"**
4. 在已安装的插件列表中找到 **"ACP Agent Client"**
5. 点击切换按钮，**启用**插件

### 3. 验证插件加载
打开开发者工具查看日志：
- 按 `Cmd + Shift + I` 打开开发者工具
- 切换到 **Console** 标签
- 查找 `[ACP]` 开头的日志

**预期日志**：
```
[ACP] Plugin loaded
[ACP] Detecting installed agents...
[ACP] Detection complete: X agents found
```

---

## 🤖 第三步：安装并测试 Agent CLI

### 推荐方案 A：Qwen Code（完全免费，中文友好）

#### 安装
```bash
# 全局安装
npm install -g qwen-code

# 验证安装
qwen --version
# 预期输出: qwen-code version 0.x.x
```

#### 测试 CLI
```bash
# 测试 ACP 模式
echo '{"jsonrpc":"2.0","method":"initialize","id":1}' | qwen --experimental-acp
# 应该返回 JSON-RPC 响应
```

---

### 推荐方案 B：Kimi CLI（中文友好，有免费额度）

#### 安装
```bash
# 全局安装
npm install -g @moonshot-ai/kimi-cli

# 验证安装
kimi --version
```

#### 配置认证
```bash
# 按照提示登录 Moonshot AI 账号
kimi login
```

#### 测试 CLI
```bash
# 测试 ACP 模式
echo '{"jsonrpc":"2.0","method":"initialize","id":1}' | kimi --acp
```

---

### 方案 C：Claude Code（编程能力最强，需付费）

#### 前置要求
```bash
# 设置 API Key（需要 Anthropic API 订阅）
export ANTHROPIC_API_KEY="sk-ant-api03-..."
```

#### 测试（使用 npx，无需安装）
```bash
# 插件会自动调用 npx，这里仅用于测试
echo '{"jsonrpc":"2.0","method":"initialize","id":1}' | npx @zed-industries/claude-code-acp
```

---

## 💬 第四步：在 Obsidian 中连接 Agent

### 1. 打开 ACP Chat 视图
- **方法 1**：点击左侧工具栏的 🤖 机器人图标
- **方法 2**：按 `Cmd + P` 打开命令面板，输入 "ACP"，选择 "打开 ACP Chat"

### 2. 选择 Agent
在 Chat 视图顶部的下拉菜单中：
- 如果安装了 Qwen Code，选择 **"Qwen Code"**
- 如果安装了 Kimi，选择 **"Kimi CLI"**
- 如果配置了 Claude Code，选择 **"Claude Code"**

### 3. 点击"连接"按钮
- 等待 3-5 秒
- 观察开发者工具中的日志

**预期日志**：
```
[ACP] Connecting to Qwen Code...
[ACP] Spawning process: qwen --experimental-acp
[ACP] Process started, PID: 12345
[ACP] Sending initialize request...
[ACP] Received initialize response
[ACP] Connection established
```

**预期 UI 变化**：
- 连接按钮变为 **"断开连接"**
- 状态显示 **"已连接"**
- 输入框变为可用状态

---

## 🧪 第五步：测试核心功能

### 测试 1：简单对话（不涉及文件操作）

在输入框输入：
```
你好！请用一句话介绍你自己。
```

**预期结果**：
- 用户消息立即显示
- Agent 开始响应（可能显示 💭 思考过程）
- Agent 回复流式显示
- 最终显示完整回复

**检查点**：
- [ ] 用户消息正确显示
- [ ] Agent 回复流式输出
- [ ] 无控制台错误
- [ ] UI 渲染正常

---

### 测试 2：文件读取（权限系统）

在输入框输入：
```
请读取我的 vault 根目录下的 README.md 文件（如果存在），并总结主要内容。如果不存在，请告诉我 vault 中有哪些 .md 文件。
```

**预期行为**：
1. **权限对话框弹出**：
   - 工具名称：`fs/read_text_file`
   - 显示要读取的文件路径
   - 3 个按钮：
     - "拒绝"（reject_once）
     - "允许一次"（allow_once）
     - "始终允许此工具"（allow_always）

2. 点击 **"允许一次"**

3. Agent 读取文件并回复

**检查点**：
- [ ] 权限对话框正确弹出
- [ ] 对话框显示正确的工具名称和参数
- [ ] 点击"允许一次"后对话框关闭
- [ ] Agent 成功读取文件
- [ ] Agent 回复内容正确
- [ ] 无控制台错误

---

### 测试 3：文件写入（权限系统）

在输入框输入：
```
在 vault 根目录创建一个名为 "ACP-Test.md" 的测试文件，内容为：
# ACP 测试笔记

这是由 AI Agent 自动创建的测试文件。

- 创建时间：{{当前时间}}
- 测试项目：文件写入功能

## 测试结果
- [x] 文件创建成功
```

**预期行为**：
1. **权限对话框弹出**：
   - 工具名称：`fs/write_text_file`
   - 显示要写入的文件路径
   - 显示文件内容预览

2. **仔细查看内容**，确认无误后点击 **"允许一次"**

3. Agent 创建文件并确认

**检查点**：
- [ ] 权限对话框正确弹出
- [ ] 对话框显示文件内容预览
- [ ] 点击允许后文件成功创建
- [ ] 可以在 Obsidian 文件列表中看到 `ACP-Test.md`
- [ ] 打开文件，内容正确
- [ ] 无控制台错误

---

### 测试 4：工具调用显示

观察 Agent 使用工具时的 UI 显示：

**预期显示**（在消息中）：
```
💭 [思考] 用户想要创建文件，我需要...
    1. 构建文件内容
    2. 调用 fs/write 工具
    
🔧 [工具调用] fs/write_text_file
   文件：ACP-Test.md
   状态：✅ 已完成
```

**检查点**：
- [ ] 💭 思考过程正确显示（如果 Agent 提供）
- [ ] 🔧 工具调用正确显示
- [ ] 工具状态有颜色区分（蓝/橙/绿/红）
- [ ] 可以折叠/展开思考过程

---

### 测试 5：断开连接

点击 **"断开连接"** 按钮

**预期行为**：
- 连接按钮变为 **"连接"**
- 状态显示 **"未连接"**
- 输入框变为不可用
- 子进程被正确终止（在任务管理器中检查）

**预期日志**：
```
[ACP] Disconnecting...
[ACP] Process terminated
[ACP] Disconnected
```

**检查点**：
- [ ] UI 状态正确更新
- [ ] 子进程被终止
- [ ] 无控制台错误
- [ ] 可以重新连接

---

## 🔍 第六步：错误场景测试

### 测试 6：未安装的 Agent

1. 在下拉菜单中选择一个 **未安装** 的 Agent（如 Gemini CLI）
2. 点击"连接"

**预期行为**：
- 显示友好的错误消息（如 "Gemini CLI 未检测到，请先安装"）
- 连接状态重置
- 不导致插件崩溃

**检查点**：
- [ ] 显示错误消息
- [ ] 可以重新选择其他 Agent
- [ ] 无崩溃或异常

---

### 测试 7：快速断开重连

1. 连接到 Agent
2. 立即断开
3. 立即重新连接
4. 重复 3 次

**检查点**：
- [ ] 所有操作正常完成
- [ ] 无内存泄漏
- [ ] 无多余子进程残留（用 `ps aux | grep qwen` 检查）

---

### 测试 8：权限拒绝

发送需要文件操作的消息，在权限对话框中点击 **"拒绝"**

**预期行为**：
- Agent 收到拒绝响应
- Agent 回复告知无法执行操作
- 不会再次请求相同权限

**检查点**：
- [ ] 拒绝后 Agent 正确处理
- [ ] 无崩溃或循环请求

---

## 📊 第七步：记录测试结果

### 测试清单

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 插件加载 | ⬜ | |
| Agent 连接 | ⬜ | Agent: ___ |
| 简单对话 | ⬜ | |
| 文件读取 | ⬜ | |
| 文件写入 | ⬜ | |
| 权限对话框 | ⬜ | |
| 工具调用显示 | ⬜ | |
| 思考过程显示 | ⬜ | |
| 断开连接 | ⬜ | |
| 错误处理 | ⬜ | |
| 权限拒绝 | ⬜ | |
| 快速重连 | ⬜ | |

### 发现的问题

请在这里记录所有发现的问题：

```
问题 1:
- 描述：
- 重现步骤：
- 错误日志：
- 严重程度：🔴高 / 🟡中 / 🟢低

问题 2:
...
```

---

## 🐛 调试技巧

### 查看详细日志

在开发者工具 Console 中：
```javascript
// 启用调试模式
localStorage.setItem('acp-debug', 'true');
// 然后重新加载插件 (Cmd + R)
```

### 监控子进程

```bash
# macOS
ps aux | grep -E "(qwen|kimi|claude)" | grep -v grep

# 查看插件数据
cat ~/note-vsc/.obsidian/plugins/obsidian-acp/data.json | jq
```

### 清除插件数据（重置）

```bash
# 备份当前数据
cp ~/note-vsc/.obsidian/plugins/obsidian-acp/data.json ~/note-vsc/.obsidian/plugins/obsidian-acp/data.json.bak

# 删除数据（插件会重新创建默认配置）
rm ~/note-vsc/.obsidian/plugins/obsidian-acp/data.json

# 重新加载 Obsidian
```

---

## 📝 常见问题

### Q1: 连接失败 "Command not found"

**原因**: Agent CLI 不在 PATH 中

**解决**:
```bash
# 检查 CLI 是否正确安装
which qwen
which kimi

# 如果返回空，说明没有安装或不在 PATH 中
# 从终端启动 Obsidian（继承环境变量）
export PATH="$HOME/.npm-global/bin:$PATH"
open -a Obsidian ~/note-vsc
```

### Q2: API Key 问题（Claude Code）

**原因**: 环境变量未设置或 Obsidian 未继承

**解决**:
```bash
# 永久设置（添加到 ~/.zshrc 或 ~/.bash_profile）
export ANTHROPIC_API_KEY="sk-ant-..."

# 应用配置
source ~/.zshrc

# 从终端启动 Obsidian
open -a Obsidian ~/note-vsc
```

### Q3: 权限对话框不弹出

**检查**:
1. 设置中权限模式是否为 `interactive`（每次询问）
2. 查看控制台是否有错误
3. 尝试重新加载插件

---

## ✅ 成功标准

测试通过的标准：

1. ✅ **核心功能**：
   - [x] 插件成功加载
   - [x] 至少 1 个 Agent 连接成功
   - [x] 可以正常对话
   - [x] 权限对话框正常弹出和工作
   - [x] 文件读写操作成功

2. ✅ **稳定性**：
   - [x] 无崩溃或异常
   - [x] 无内存泄漏
   - [x] 可以正常断开和重连

3. ✅ **用户体验**：
   - [x] UI 渲染正常
   - [x] 流式输出流畅
   - [x] 错误消息友好
   - [x] 工具调用显示清晰

---

## 🎉 下一步

测试完成后：

1. **如果发现问题**：
   - 在 `/Users/chyax/tmp/obsidian-acp/TESTING_ISSUES.md` 中记录
   - 根据严重程度优先修复

2. **如果测试通过**：
   - 更新 README.md 的测试状态为 ✅
   - 准备 V1.0 发布清单
   - 开始编写单元测试

3. **增强功能**（可选）：
   - 测试多个 Agent 切换
   - 测试会话持久化
   - 测试 MCP 服务器集成

---

**祝测试顺利！** 🚀

如果遇到任何问题，请查看：
- 开发者工具 Console
- 插件数据：`~/note-vsc/.obsidian/plugins/obsidian-acp/data.json`
- 项目文档：`/Users/chyax/tmp/obsidian-acp/docs/`

