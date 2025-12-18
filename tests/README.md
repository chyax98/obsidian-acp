# 基础连接测试

> **说明**: 由于 Obsidian 插件依赖 Obsidian 环境，无法直接编写独立的 Node.js 测试脚本。本文档提供手动测试步骤和验证方法。

---

## 测试目标

验证 ACP 插件的核心连接功能：

1. 子进程启动
2. stdio 通信
3. JSON-RPC 消息解析
4. 初始化握手
5. 会话创建

---

## 前置要求

### 环境

- Node.js >= 16
- Obsidian 已安装
- 至少一个 ACP Agent CLI 已安装

### Agent CLI 安装验证

```bash
# Claude Code
npx @zed-industries/claude-code-acp --version

# Codex
codex --version

# Gemini
gemini --version
```

---

## 测试 1: CLI 检测

### 目标

验证 AcpDetector 能够正确检测已安装的 Agent CLI。

### 步骤

1. 打开 Obsidian 开发者工具（Cmd/Ctrl + Shift + I）
2. 切换到 Console 标签
3. 查找插件加载日志，应该包含检测结果

### 预期日志示例

```
[ACP] Detecting installed agents...
[ACP] Found: Claude Code at /usr/local/bin/npx
[ACP] Found: Codex at /usr/local/bin/codex
[ACP] Detection complete: 2 agents found
```

### 验证

- [ ] 控制台有检测日志
- [ ] 已安装的 Agent 被正确检测
- [ ] 未安装的 Agent 不出现在列表中

---

## 测试 2: 连接 Agent

### 目标

验证能够成功连接到 Agent 并完成初始化。

### 步骤

1. 打开 ChatView
2. 选择 "Claude Code"（或其他已安装的 Agent）
3. 点击"连接"按钮
4. 观察控制台日志

### 预期日志示例

```
[ACP] Connecting to Claude Code...
[ACP] Spawning process: npx @zed-industries/claude-code-acp
[ACP] Process started, PID: 12345
[ACP] Sending initialize request...
[ACP] Received initialize response: {
  capabilities: { ... }
}
[ACP] Connection established
```

### 验证

- [ ] 连接按钮变为"断开"
- [ ] 连接状态显示"已连接"
- [ ] 控制台无错误
- [ ] 子进程正常运行（可以在活动监视器/任务管理器中查看）

---

## 测试 3: 会话创建

### 目标

验证能够成功创建新会话。

### 步骤

1. 连接到 Agent（见测试 2）
2. 观察控制台日志
3. 等待会话创建完成

### 预期日志示例

```
[ACP] Creating new session...
[ACP] Session created: session-abc123
[ACP] Ready to receive messages
```

### 验证

- [ ] 会话 ID 出现在日志中
- [ ] 输入框变为可用状态
- [ ] 控制台无错误

---

## 测试 4: 消息发送

### 目标

验证能够成功发送消息并接收响应。

### 步骤

1. 连接到 Agent 并创建会话
2. 在输入框输入 "你好"
3. 点击发送
4. 观察控制台日志和 UI 显示

### 预期日志示例

```
[ACP] Sending prompt: "你好"
[ACP] Request ID: 3
[ACP] Received session update: message_start
[ACP] Received session update: content_start
[ACP] Received session update: content_delta
[ACP] Received session update: content_end
[ACP] Received session update: message_end
[ACP] Turn completed
```

### 验证

- [ ] 用户消息显示在 ChatView 中
- [ ] Agent 开始响应（显示加载状态）
- [ ] Agent 回复正确显示
- [ ] 流式输出正常工作

---

## 测试 5: 断开连接

### 目标

验证能够正常断开连接并清理资源。

### 步骤

1. 连接到 Agent
2. 点击"断开"按钮
3. 观察控制台日志

### 预期日志示例

```
[ACP] Disconnecting...
[ACP] Cleaning up session: session-abc123
[ACP] Killing process: 12345
[ACP] Process exited with code 0
[ACP] Disconnected
```

### 验证

- [ ] 连接按钮变为"连接"
- [ ] 连接状态显示"未连接"
- [ ] 子进程被正确终止
- [ ] 控制台无错误

---

## 测试 6: 错误处理 - 未安装的 Agent

### 目标

验证连接到未安装的 Agent 时的错误处理。

### 步骤

1. 选择未安装的 Agent（如果 Qwen Code 未安装，选择它）
2. 点击"连接"
3. 观察错误消息

### 预期行为

- 显示错误消息（如 "Qwen Code CLI 未安装"）
- 连接状态重置
- 不导致插件崩溃

### 验证

- [ ] 显示友好的错误消息
- [ ] 控制台有错误日志但不抛出异常
- [ ] 可以重新选择其他 Agent

---

## 测试 7: 错误处理 - 超时

### 目标

验证连接超时的处理。

### 模拟方法

修改代码中的超时时间为 5 秒（临时）：

```typescript
// src/acp/core/connection.ts
private readonly TIMEOUT = 5000; // 原来是 30000
```

### 步骤

1. 修改超时时间
2. 重新构建插件
3. 尝试连接到一个响应慢的 Agent（或模拟）
4. 等待超时

### 预期行为

- 5 秒后显示超时错误
- 连接状态重置

### 验证

- [ ] 超时错误正确触发
- [ ] 错误消息友好
- [ ] 资源正确清理

---

## 测试 8: 压力测试 - 快速断开重连

### 目标

验证系统稳定性。

### 步骤

1. 连接到 Agent
2. 立即断开
3. 立即重新连接
4. 重复 5 次

### 预期行为

- 所有操作正常完成
- 无内存泄漏
- 无进程残留

### 验证

- [ ] 所有连接/断开操作成功
- [ ] 控制台无错误
- [ ] 任务管理器中无多余进程

---

## 调试技巧

### 查看详细日志

在开发者工具中设置日志级别：

```javascript
localStorage.setItem('acp-debug', 'true');
```

然后重新加载插件。

### 监控子进程

macOS/Linux:
```bash
ps aux | grep claude-code-acp
ps aux | grep codex
```

Windows:
```powershell
Get-Process | Where-Object {$_.Name -like "*node*"}
```

### 检查消息通信

在 `src/acp/core/connection.ts` 中添加日志：

```typescript
private handleMessage(message: AcpMessage) {
    console.log('[ACP] Received message:', JSON.stringify(message, null, 2));
    // ...
}
```

---

## 常见问题

### Q1: 连接失败 "Command not found"

**原因**: Agent CLI 不在 PATH 中

**解决**:
1. 检查 CLI 是否正确安装
2. 在设置中指定完整路径

### Q2: 连接成功但无响应

**原因**: JSON-RPC 消息格式错误

**调试**:
1. 查看控制台日志
2. 检查 stdio 输出格式

### Q3: 子进程无法启动

**原因**: 权限问题或路径错误

**解决**:
1. 检查文件权限
2. 使用绝对路径
3. 在终端手动测试 CLI 命令

---

## 自动化测试建议

### 未来可以实现的自动化测试

1. **单元测试**: 使用 Jest 测试独立函数
   - JSON-RPC 消息解析
   - 请求队列管理
   - 超时处理逻辑

2. **Mock 测试**: 使用 Mock Agent
   - 创建假的 Agent 进程
   - 返回预定义的响应
   - 测试各种场景

3. **E2E 测试**: 使用 Playwright
   - 自动化 Obsidian 操作
   - 验证 UI 交互
   - 截图对比

### 示例：单元测试框架

```typescript
// tests/unit/connection.test.ts
import { AcpConnection } from '../../src/acp/core/connection';

describe('AcpConnection', () => {
    test('should parse JSON-RPC message', () => {
        const conn = new AcpConnection();
        const message = '{"jsonrpc":"2.0","id":1,"result":{}}\n';
        const parsed = conn['parseMessage'](message);
        expect(parsed.jsonrpc).toBe('2.0');
    });

    // 更多测试...
});
```

---

## 测试清单总结

- [ ] 测试 1: CLI 检测
- [ ] 测试 2: 连接 Agent
- [ ] 测试 3: 会话创建
- [ ] 测试 4: 消息发送
- [ ] 测试 5: 断开连接
- [ ] 测试 6: 错误处理 - 未安装的 Agent
- [ ] 测试 7: 错误处理 - 超时
- [ ] 测试 8: 压力测试 - 快速断开重连

---

## 报告问题

如果发现问题，请记录：

1. 测试步骤
2. 预期结果
3. 实际结果
4. 错误日志
5. 环境信息（OS, Obsidian 版本, Agent 版本）

将问题添加到 `KNOWN_ISSUES.md`。

---

## 参考资料

- ACP 协议规范: `tmp/agent-client-protocol/`
- 执行计划: `docs/features/ACP-INTEGRATION-EXECUTION.md`
- 手动测试清单: `tests/MANUAL_TESTS.md`
- 测试场景: `tests/TEST_SCENARIOS.md`
