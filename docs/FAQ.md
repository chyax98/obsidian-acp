# 常见问题 FAQ

> 收集使用 Obsidian ACP Plugin 时的常见问题和解决方案。

## 📦 安装相关

### Q1: 插件安装后无法启用？

**可能原因**：
1. 没有关闭"安全模式"
2. 插件文件不完整
3. Obsidian 版本过旧

**解决方法**：
```bash
# 1. 检查文件完整性
ls -la .obsidian/plugins/obsidian-acp/
# 应该包含：main.js, manifest.json, styles.css

# 2. 查看 Obsidian 控制台
Ctrl/Cmd + Shift + I → Console
# 查看是否有错误信息

# 3. 更新 Obsidian
# 确保使用 v1.4.0 或更高版本
```

### Q2: 如何手动构建插件？

```bash
# 1. 克隆仓库
git clone https://github.com/YOUR_USERNAME/obsidian-acp.git
cd obsidian-acp

# 2. 安装依赖
npm install

# 3. 构建
npm run build

# 4. 复制文件
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/obsidian-acp/

# 5. 重启 Obsidian
```

---

## 🤖 Agent 配置

### Q3: Agent 下拉框为空，检测不到 Agent？

**可能原因**：
1. CLI 未安装
2. 环境变量未设置
3. Obsidian 未从终端启动（macOS/Linux）

**解决方法**：

**步骤 1：验证 CLI 安装**
```bash
# Claude Code
npx @zed-industries/claude-code-acp --version

# Kimi
kimi --version

# Codex ACP
npx @zed-industries/codex-acp --version

# Gemini CLI
gemini --version

# Qwen Code
qwen --version
```

**步骤 2：设置环境变量**
```bash
# macOS/Linux
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_API_KEY="..."

# 持久化到 shell
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.zshrc
source ~/.zshrc
```

**步骤 3：从终端启动 Obsidian**
```bash
# macOS
open -a Obsidian

# Linux
obsidian &

# Windows（在 PowerShell 中设置环境变量后）
start obsidian://
```

**步骤 4：手动配置路径**

如果自动检测失败，可在插件设置中手动输入：
- 设置 → ACP Agent Client → Agent 配置
- 输入完整的 CLI 路径，例如：
  - `/usr/local/bin/kimi --acp`
  - `npx @google/gemini-cli --experimental-acp`

### Q4: 哪个 Agent 最适合我？

| 需求 | 推荐 Agent | 理由 |
|------|-----------|------|
| **最强编程能力** | Claude Code 或 Codex ACP | 代码理解、重构、调试最强 |
| **中文对话** | Kimi 或 Qwen Code | 中文理解和表达优秀 |
| **完全免费** | Qwen Code | 无需 API Key，开箱即用 |
| **有免费额度** | Gemini CLI | 每天 1000 次请求 |
| **快速响应** | Qwen Code 或 Kimi | 国内访问速度快 |
| **尝鲜新技术** | Gemini CLI | Google 最新 ACP 参考实现 |

**建议**：先试用 Qwen Code（完全免费），再根据需求选择付费 Agent。

### Q5: API Key 安全吗？会被上传吗？

**完全安全**：
- ✅ API Key 仅保存在本地环境变量
- ✅ 插件通过本地 CLI 子进程与 API 交互
- ✅ 不经过任何第三方服务器
- ✅ 所有通信通过 HTTPS 加密
- ✅ 代码开源，可审计

**数据流**：
```
Obsidian Plugin
    ↓ (本地子进程)
CLI (claude-code-acp / kimi / codex-acp)
    ↓ (HTTPS)
AI Provider API (Anthropic / Moonshot / OpenAI)
```

---

## 🔌 连接相关

### Q6: 点击"连接"后一直卡在"连接中"？

**可能原因**：
1. API Key 无效或过期
2. 网络问题（无法访问 API）
3. CLI 启动失败
4. 超时（默认 30 秒）

**解决方法**：

**步骤 1：检查 API Key**
```bash
# 检查环境变量
echo $ANTHROPIC_API_KEY
echo $OPENAI_API_KEY
echo $GOOGLE_API_KEY

# 测试 API Key（Claude）
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-opus-20240229","max_tokens":1024,"messages":[{"role":"user","content":"hello"}]}'
```

**步骤 2：检查网络**
```bash
# 测试 Anthropic API
ping api.anthropic.com

# 测试 OpenAI API
ping api.openai.com

# 如果无法访问，需要配置代理或使用国内 Agent（Kimi/Qwen）
```

**步骤 3：查看详细日志**
- 打开开发者工具：`Ctrl/Cmd + Shift + I`
- 在 Console 中查看 `[ACP]` 开头的日志
- 查找错误信息

**步骤 4：手动测试 CLI**
```bash
# Claude Code
npx @zed-industries/claude-code-acp --help

# Kimi
kimi --acp --help

# Qwen Code
qwen --experimental-acp --help
```

### Q7: 连接成功但无法发送消息？

**可能原因**：
1. ACP 协议握手失败
2. 权限配置问题
3. 工作目录配置错误

**解决方法**：

**步骤 1：重新连接**
- 点击"断开连接"
- 等待 2 秒
- 点击"连接"

**步骤 2：检查工作目录**
- 设置 → ACP Agent Client → 工作目录模式
- 推荐使用"Vault 根目录"
- 确保目录存在且可访问

**步骤 3：查看日志**
```javascript
// 在开发者工具 Console 中运行
localStorage.getItem('acp-debug-enabled', 'true')
```

### Q8: 连接突然断开？

**可能原因**：
1. CLI 进程崩溃
2. 网络中断
3. API 配额用尽
4. 长时间无活动（超时）

**解决方法**：
- 插件会自动尝试重连（最多 3 次）
- 手动点击"连接"重新连接
- 如果频繁断开，检查：
  - API 配额是否充足
  - 网络是否稳定
  - CLI 日志是否有错误

---

## 🔒 权限相关

### Q9: 每次文件操作都弹出权限对话框，很烦？

**解决方法**：

**方式 1：配置权限模式**
- 设置 → ACP Agent Client → 权限模式
- 选择"快速编辑"或"完全自动"（谨慎）

**方式 2：配置单个工具权限**
- 在权限对话框中选择"始终允许"
- 针对安全操作（如 `fs/read`）
- **不建议**对 `fs/write` 或 `bash/run` 选择"始终允许"

**方式 3：配置规则**（未来功能）
- 预定义允许的文件路径
- 预定义允许的命令模式

**推荐配置**：
```
fs/read    → 始终允许（安全）
fs/write   → 每次询问（谨慎）
bash/run   → 每次询问（危险）
```

### Q10: Agent 能访问 Vault 外的文件吗？

**默认行为**：
- ✅ **Vault 内部**：Agent 可以访问（根据权限配置）
- ⚠️ **Vault 外部**：需要明确权限批准

**安全措施**：
- 工作目录限制（设置中配置）
- 路径越界检测
- 每个操作都有详细日志
- 敏感操作二次确认

**如何限制**：
- 设置 → ACP Agent Client → 工作目录模式
- 选择"当前笔记文件夹"（最严格）
- 或自定义路径

### Q11: Agent 会删除或覆盖我的文件吗？

**保护机制**：
- ✅ 所有文件写入需要权限批准
- ✅ 覆盖现有文件会明确提示
- ✅ 可以在权限对话框中查看完整内容
- ✅ 操作历史完整记录

**建议**：
- 定期备份 Vault（使用 Git 或其他工具）
- 对重要文件操作仔细检查权限对话框
- 使用"允许一次"而非"始终允许"

**未来功能**（计划中）：
- 文件操作撤销（Undo）
- 操作预览和 Diff 查看
- 只读模式（仅查看，不修改）

---

## ⚡ 性能相关

### Q12: Agent 响应很慢？

**可能原因**：
1. 网络延迟（国外 API）
2. 复杂任务需要更多时间
3. API 配额限制

**解决方法**：

**方式 1：使用国内 Agent**
- Kimi（Moonshot AI，国内服务器）
- Qwen Code（阿里云，国内服务器）

**方式 2：优化提示词**
```
❌ 不好：帮我分析整个 Vault
✅ 更好：分析 notes/ 目录下最近 7 天创建的笔记

❌ 不好：重构所有代码
✅ 更好：重构 src/main.ts 中的 SessionManager 类
```

**方式 3：检查网络**
```bash
# 测试延迟
ping api.anthropic.com
ping api.openai.com

# 如果延迟高，考虑使用代理或国内 Agent
```

### Q13: UI 卡顿，Obsidian 变慢？

**可能原因**：
1. 消息更新过于频繁
2. 内存泄漏
3. 长对话历史

**解决方法**：

**已优化**：
- ✅ 消息缓冲机制（300ms 批量更新）
- ✅ 减少 95% 的 UI 渲染次数
- ✅ 智能滚动（仅在底部时自动滚动）

**手动优化**：
- 清空对话历史（右上角菜单）
- 重启 Obsidian
- 关闭其他占用资源的插件

**报告问题**：
如果持续卡顿，请在 GitHub Issues 中提供：
- Obsidian 版本
- 对话长度（消息数）
- 开发者工具 Performance 录制

---

## 🛠️ 故障排查

### Q14: 如何查看详细日志？

**方法 1：浏览器开发者工具**
```
1. 打开开发者工具：Ctrl/Cmd + Shift + I
2. 切换到 Console 标签
3. 过滤日志：输入 "[ACP]"
4. 查看详细信息
```

**方法 2：启用 Debug 模式**
```javascript
// 在开发者工具 Console 中运行
localStorage.setItem('acp-debug-enabled', 'true')
// 重新加载 Obsidian
```

**方法 3：CLI 日志**
```bash
# 手动运行 CLI 查看输出
npx @zed-industries/claude-code-acp --debug

# 或查看系统日志
# macOS
tail -f ~/Library/Logs/Obsidian/main.log

# Linux
tail -f ~/.config/Obsidian/logs/main.log

# Windows
type %APPDATA%\Obsidian\logs\main.log
```

### Q15: 遇到错误如何报告？

**报告前准备**：
1. 开发者工具截图（包含完整错误信息）
2. 插件版本（设置中查看）
3. Obsidian 版本（关于 → 版本）
4. Agent 类型和版本
5. 操作步骤（如何复现）

**报告渠道**：
- [GitHub Issues](https://github.com/YOUR_USERNAME/obsidian-acp/issues)
- 使用 Bug Report 模板
- 提供上述所有信息

**紧急问题**：
- 先尝试重启 Obsidian
- 断开并重新连接 Agent
- 查看 FAQ 和文档

---

## 🎯 使用技巧

### Q16: 如何让 Agent 更好地理解我的需求？

**提示词技巧**：

**✅ 清晰具体**
```
❌ 帮我整理笔记
✅ 为 notes/projects/ 目录下的所有笔记添加 #project 标签
```

**✅ 分步骤**
```
1. 读取 README.md
2. 提取所有一级标题
3. 生成目录索引
4. 保存到 INDEX.md
```

**✅ 提供上下文**
```
我在写关于 TypeScript 的学习笔记，现在需要...
```

**✅ 明确约束**
```
只处理 .md 文件，忽略 .obsidian 目录
```

### Q17: 如何使用 Agent 批量处理笔记？

**示例 1：批量添加标签**
```
为 notes/ 目录下所有笔记添加 frontmatter：
---
created: {{文件创建日期}}
modified: {{今天日期}}
tags: [processed]
---
```

**示例 2：批量重命名**
```
将 daily-notes/ 目录下的文件从 YYYY-MM-DD.md 格式
重命名为 YYYYMMDD.md 格式
```

**示例 3：批量整理**
```
分析 inbox/ 目录下的所有笔记，
根据内容分类移动到对应的主题文件夹
```

### Q18: Agent 能理解 Obsidian 的 `[[双链]]` 吗？

**部分支持**：
- ✅ Agent 可以读取包含双链的文件
- ✅ Agent 可以解析双链语法
- ⚠️ 需要明确告知 Agent 这是 Obsidian 语法
- 🚧 完整的双链网络理解（未来功能）

**示例**：
```
读取 [[项目A]] 笔记，然后：
1. 找到所有 [[双链]]
2. 读取这些关联笔记
3. 生成一份结构化总结
```

---

## 📚 其他问题

### Q19: 插件会收费吗？

**当前状态**：
- ✅ 插件完全免费开源（MIT License）
- ⚠️ Agent 本身可能需要付费（Claude/Codex 需订阅）
- ✅ 有完全免费的选择（Qwen Code）

**未来计划**：
- 插件核心功能永久免费
- 可能推出企业版（团队协作、审计日志等）
- 社区捐赠支持开发

### Q20: 如何贡献代码或提建议？

**贡献方式**：
1. **报告 Bug**：[GitHub Issues](https://github.com/YOUR_USERNAME/obsidian-acp/issues)
2. **功能建议**：[GitHub Discussions](https://github.com/YOUR_USERNAME/obsidian-acp/discussions)
3. **代码贡献**：Fork → Pull Request
4. **文档改进**：编辑 docs/ 目录

**开发环境搭建**：
```bash
git clone https://github.com/YOUR_USERNAME/obsidian-acp.git
cd obsidian-acp
npm install
npm run dev  # 监听文件变化，自动构建
```

**编码规范**：
- TypeScript strict 模式
- ESLint 0 errors
- 所有 public 方法需要 JSDoc
- 测试覆盖新增功能

---

## 🔗 相关资源

- [快速开始](./GETTING_STARTED.md) - 5 分钟上手
- [Agent 配置](./AGENT_SETUP.md) - 详细配置教程
- [权限系统](./PERMISSIONS.md) - 理解权限管理
- [产品愿景](../CLAUDE.md) - 完整设计文档
- [GitHub Issues](https://github.com/YOUR_USERNAME/obsidian-acp/issues) - 报告问题
- [GitHub Discussions](https://github.com/YOUR_USERNAME/obsidian-acp/discussions) - 交流讨论

**还有其他问题？** 欢迎在 GitHub Discussions 提问！ 💬
