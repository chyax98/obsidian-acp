# 常见问题 (FAQ)

本文档整理了 Obsidian ACP 插件使用过程中的常见问题和解决方案。

---

## 目录

- [安装与配置](#安装与配置)
- [连接问题](#连接问题)
- [权限问题](#权限问题)
- [性能问题](#性能问题)
- [功能使用](#功能使用)
- [错误排查](#错误排查)

---

## 安装与配置

### Q: 插件安装后在设置中找不到?

**A**: 可能的原因:

1. 未启用第三方插件
   - 设置 → 第三方插件 → 关闭安全模式

2. 文件未正确复制
   - 检查 `.obsidian/plugins/obsidian-acp/` 目录
   - 确认包含 `main.js`, `manifest.json`, `styles.css`

3. 权限问题 (macOS)
   ```bash
   # 移除隔离属性
   xattr -cr ~/.obsidian/plugins/obsidian-acp/
   ```

4. 重启 Obsidian 后重试

---

### Q: 如何更新插件到最新版本?

**A**:

1. 手动更新:
   - 下载最新 Release 的三个文件
   - 覆盖 `.obsidian/plugins/obsidian-acp/` 中的文件
   - 重启 Obsidian

2. 从源码更新:
   ```bash
   cd obsidian-acp
   git pull
   npm run build
   cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/obsidian-acp/
   ```

---

### Q: 可以在移动端使用吗?

**A**: 目前不支持。

**原因**:
- ACP 协议依赖本地 CLI 工具和子进程
- 移动端 (iOS/Android) 限制进程调用
- Obsidian Mobile API 不支持 `child_process`

**未来计划**: 可能通过远程连接模式支持,但需要 ACP 协议扩展

---

### Q: 支持哪些 Agent?

**A**: 目前支持:

| Agent | CLI 命令 | 状态 | 备注 |
|-------|---------|------|------|
| Claude Code | `claude` | ✅ 完全支持 | 推荐 |
| Codex CLI | `codex` | ✅ 完全支持 | - |
| Qwen Code | `qwen` | ✅ 完全支持 | 中文友好 |
| Goose | `goose` | ✅ 完全支持 | 开源 |
| Augment Code | `auggie` | ✅ 完全支持 | - |
| Kimi CLI | `kimi` | ✅ 完全支持 | - |
| OpenCode | `opencode` | ✅ 完全支持 | - |
| Gemini CLI | `gemini` | ⏳ 部分支持 | 等待官方完善 |
| 自定义 | 用户配置 | ✅ 支持 | 任何 ACP 兼容 CLI |

---

## 连接问题

### Q: Agent 下拉菜单为空,没有检测到任何 Agent?

**A**: 依次检查:

1. **确认 CLI 已安装**:
   ```bash
   # 测试命令
   claude --version
   qwen --version
   goose --version
   ```

2. **检查 PATH 环境变量**:
   ```bash
   # macOS/Linux
   echo $PATH
   which claude

   # Windows
   echo %PATH%
   where claude
   ```

3. **Obsidian 未继承 PATH** (macOS 常见):
   - 从终端启动 Obsidian:
     ```bash
     open -a Obsidian
     ```
   - 或在插件设置中手动指定 CLI 完整路径

4. **手动配置**:
   - 设置 → ACP Agent Client
   - 找到对应 Agent 的路径输入框
   - 输入完整路径,例如: `/usr/local/bin/claude`

---

### Q: 连接时提示 "spawn ENOENT" 错误?

**A**: CLI 可执行文件未找到。

**解决方法**:

1. 获取 CLI 完整路径:
   ```bash
   which claude  # macOS/Linux
   where claude  # Windows
   ```

2. 在插件设置中指定该路径

3. 确认路径有执行权限:
   ```bash
   chmod +x /path/to/claude
   ```

---

### Q: 连接时提示 "Authentication required" 或 "API key not found"?

**A**: Agent 需要认证但未配置。

**解决方法**:

1. **Claude Code**:
   ```bash
   claude auth
   # 输入 Anthropic API Key
   ```
   获取 Key: https://console.anthropic.com

2. **Qwen Code**:
   ```bash
   qwen auth
   # 输入阿里云 API Key
   ```

3. **其他 Agent**: 参考各自的官方文档

4. 认证配置后,重新连接

---

### Q: 连接成功但发送消息无响应?

**A**: 可能原因:

1. **网络问题**:
   - 检查网络连接
   - 某些 Agent 需要访问国外服务器,可能需要代理

2. **Agent 进程卡住**:
   - 断开连接
   - 重新连接

3. **权限请求被遮挡**:
   - 检查是否有权限弹窗
   - 点击允许或拒绝

4. **查看控制台日志**:
   - `Ctrl/Cmd + Shift + I` 打开开发者工具
   - 查看 Console 中的错误信息

---

### Q: 连接后一段时间自动断开?

**A**: 正常行为。

**原因**:
- 长时间无操作,Agent 进程可能超时退出
- 某些 Agent 有会话时长限制

**解决**: 重新连接即可,会话历史已保存

---

## 权限问题

### Q: 每次操作都弹出权限请求,很烦?

**A**: 配置自动批准规则:

1. **方法 1**: 选择 "始终允许"
   - 弹窗中点击 "始终允许"
   - 以后该工具操作自动批准

2. **方法 2**: 开启自动批准读取
   - 设置 → ACP Agent Client
   - 启用 "自动批准文件读取"
   - 仅自动批准读操作,写操作仍需确认

3. **方法 3**: 禁用权限检查 (不推荐)
   - 目前不支持完全禁用
   - 考虑安全性,建议保留写入和命令执行的确认

---

### Q: 不小心选了 "始终拒绝",如何撤销?

**A**:

1. 打开插件数据目录:
   ```
   .obsidian/plugins/obsidian-acp/data.json
   ```

2. 找到 `permissions` 字段

3. 删除对应的 `always_deny` 规则

4. 重启 Obsidian 或重新加载插件

**未来计划**: 将在设置界面添加权限管理 UI

---

### Q: Agent 读取了敏感文件怎么办?

**A**:

1. **立即断开连接**

2. **检查读取了哪些文件**:
   - 聊天记录中会显示工具调用详情
   - 查看 "ReadTextFile" 工具调用的参数

3. **预防措施**:
   - 首次使用时谨慎授权
   - 配置合适的工作目录,限制访问范围
   - 敏感文件放在工作目录外

4. **检查 API 日志** (如担心数据泄露):
   - 联系 Agent 服务提供商
   - 查看 API 使用记录

---

### Q: 如何限制 Agent 只能访问特定目录?

**A**:

1. **配置工作目录**:
   - 设置 → ACP Agent Client → 工作目录
   - 选择 "自定义路径"
   - 指定允许访问的目录

2. **注意**:
   - Agent 可以访问工作目录及其子目录
   - 如果 Agent 尝试访问工作目录外的文件,操作会失败
   - 相对路径会被解析为相对于工作目录

---

## 性能问题

### Q: Agent 响应很慢,要等很久?

**A**: 可能的原因和解决方法:

1. **网络延迟**:
   - 检查网络连接速度
   - 使用网络工具测试延迟
   - 考虑使用代理

2. **任务复杂度高**:
   - Agent 需要处理大量文件
   - 拆分任务为多个小步骤
   - 示例:
     ```
     # 慢: 分析整个项目并生成文档
     # 快: 先列出文件 → 再分析关键文件 → 最后总结
     ```

3. **使用本地 Agent**:
   - 如 Codex 某些模式支持本地运行
   - Goose 可以配置本地模型
   - 响应速度更快,但能力可能受限

4. **模型选择**:
   - 某些 Agent 支持选择模型
   - 较小的模型响应更快

---

### Q: 聊天界面卡顿,滚动不流畅?

**A**:

1. **消息过多**:
   - 新建会话,清空当前消息
   - 定期清理旧会话

2. **Markdown 渲染复杂**:
   - 大量代码块、表格会影响性能
   - 考虑限制单次回复长度

3. **工具调用显示过多**:
   - 设置 → 关闭 "显示工具调用详情"
   - 减少 DOM 元素数量

4. **重启 Obsidian**:
   - 长时间运行可能导致内存占用过高

---

### Q: 插件占用存储空间过大?

**A**:

会话历史保存在 `.obsidian/plugins/obsidian-acp/sessions/`

**清理方法**:

1. **手动删除旧会话**:
   - 进入 `sessions/` 目录
   - 删除不需要的 JSON 文件

2. **保留重要会话**:
   - 复制关键对话到 Markdown 笔记
   - 然后删除会话文件

**未来计划**: 添加会话管理 UI,支持批量清理

---

## 功能使用

### Q: 如何让 Agent 读取 Obsidian 笔记?

**A**:

直接在消息中引用文件路径:

```
分析 [[我的笔记]] 的内容
```

或使用相对路径:

```
读取 daily-notes/2025-01-15.md 并总结要点
```

Agent 会自动请求文件读取权限。

---

### Q: Agent 可以创建新笔记吗?

**A**: 可以。

示例:

```
在 notes/ 目录下创建一个名为 "会议记录-2025-01-15.md" 的笔记,包含以下内容:
- 时间:
- 参与者:
- 议题:
- 决议:
```

Agent 会请求文件写入权限,批准后即可创建。

---

### Q: 如何批量处理多个文件?

**A**:

示例任务:

```
遍历 notes/2025-01/ 目录下所有 Markdown 文件:
1. 检查是否有 frontmatter
2. 如果没有,添加创建日期和标签
3. 列出处理的文件清单
```

Agent 会:
1. 列出目录文件
2. 逐个读取
3. 根据需要修改
4. 请求写入权限

---

### Q: 可以让 Agent 执行终端命令吗?

**A**: 可以,如果 Agent 支持 `ExecuteCommand` 工具。

示例:

```
运行 npm test 并分析测试结果
```

**安全提示**:
- 命令执行需要权限确认
- 仔细检查命令内容再批准
- 避免执行不可逆操作 (如 `rm -rf`)

---

### Q: 会话历史可以导出吗?

**A**:

**当前方案**:

1. 手动复制对话内容到笔记

2. 或直接读取会话文件:
   ```
   .obsidian/plugins/obsidian-acp/sessions/<session-id>.json
   ```

**未来计划**: 添加一键导出为 Markdown 功能

---

### Q: 如何恢复之前的会话?

**A**:

**方法 1**: 会话列表 (如果已实现)
- 点击 "加载会话" 按钮
- 从列表中选择

**方法 2**: 继续对话
- 重新连接同一个 Agent
- 发送新消息
- Agent 可能记住部分上下文 (取决于实现)

**注意**: 跨会话的完整上下文恢复尚未完全实现

---

## 错误排查

### Q: 出现 "JSON-RPC parse error" 怎么办?

**A**:

**原因**: Agent 输出了非标准 JSON-RPC 消息

**排查**:

1. **查看控制台**:
   - `Ctrl/Cmd + Shift + I`
   - 查看完整错误消息和原始输出

2. **检查 Agent 版本**:
   ```bash
   npx @zed-industries/claude-code-acp --version
   ```
   确保可以正常运行

3. **检查 API Key**:
   ```bash
   echo $ANTHROPIC_API_KEY
   ```
   如果为空，需要配置环境变量

4. **尝试其他 Agent**:
   - 如果只有特定 Agent 出现问题
   - 可能是该 Agent 的 ACP 实现有 Bug

---

### Q: 出现 "Request timeout" 怎么办?

**A**:

**原因**: Agent 响应超时 (默认 2 分钟)

**解决**:

1. **等待权限请求**:
   - 检查是否有未处理的权限弹窗
   - 点击允许或拒绝

2. **网络问题**:
   - 检查网络连接
   - 重试请求

3. **任务过于复杂**:
   - 拆分为更小的任务
   - 减少一次处理的文件数量

**未来计划**: 添加可配置的超时时间

---

### Q: Agent 一直重复执行同一个操作?

**A**:

**原因**: Agent 陷入循环

**解决**:

1. **立即取消**:
   - 点击 "取消" 按钮

2. **断开连接**:
   - 如果取消无效,断开 Agent 连接

3. **新建会话**:
   - 清空上下文,避免重复错误

4. **调整提示词**:
   - 更明确地描述期望结果
   - 避免模糊的指令

---

### Q: 日志在哪里查看?

**A**:

1. **浏览器控制台** (主要日志):
   - `Ctrl/Cmd + Shift + I`
   - 切换到 Console 标签
   - 过滤: `[ACP`

2. **Obsidian 日志** (部分信息):
   - 设置 → 关于 → 显示调试信息
   - 查看 `app.log`

3. **详细调试** (开发模式):
   - 在控制台运行: `localStorage.setItem('acp-debug', 'true')`
   - 刷新 Obsidian
   - 查看详细的 JSON-RPC 消息

---

### Q: 遇到未列出的问题如何反馈?

**A**:

1. **检查 GitHub Issues**:
   - 搜索是否已有类似问题
   - https://github.com/YOUR_USERNAME/obsidian-acp/issues

2. **提交新 Issue**:
   - 包含以下信息:
     - Obsidian 版本
     - 插件版本
     - Agent 类型和版本
     - 操作系统
     - 错误截图或日志
     - 复现步骤

3. **参与讨论**:
   - https://github.com/YOUR_USERNAME/obsidian-acp/discussions

4. **紧急问题**:
   - 联系开发者 (GitHub Issues 优先)

---

## 贡献文档

如果您发现了新的问题或解决方案,欢迎:

1. Fork 项目
2. 编辑 `docs/FAQ.md`
3. 提交 Pull Request

或者在 Issues 中分享,我们会更新到文档中。

---

**祝使用愉快!**
