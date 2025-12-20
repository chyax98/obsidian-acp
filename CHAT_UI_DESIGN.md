# ACP Chat 界面 - 完整产品设计与交互规范

## 一、产品概述

### 1.1 核心功能
ACP Chat 是一个用于与 AI Agent 实时交互的聊天界面，支持：
- 多 Agent 选择和切换
- 文本对话（流式输出）
- 工具调用可视化
- 文件操作权限管理
- 会话持久化

### 1.2 用户旅程
```
1. 打开 Chat 视图
2. 选择 Agent → 点击连接
3. 等待连接成功
4. 输入消息 → 发送
5. 查看 AI 回复（流式）
6. 查看工具调用过程
7. 继续对话...
```

## 二、界面布局

### 2.1 整体结构

```
┌─────────────────────────────────────────┐
│ Header (固定)                           │
│ ┌─────────────────────────────────────┐ │
│ │ [Agent 选择器 ▼] [连接]            │ │
│ │ 状态: ● 已连接 (Claude Code)        │ │
│ │ 模式: 💻 Code                       │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Messages (可滚动，flex: 1)             │
│ ┌─────────────────────────────────────┐ │
│ │ 欢迎消息                            │ │
│ │                                     │ │
│ │ [用户消息]                          │ │
│ │                                     │ │
│ │ [AI 回复 - 流式中...]               │ │
│ │ ├─ 思考过程                         │ │
│ │ ├─ 工具调用 (read_file)             │ │
│ │ │  ├─ 路径: src/main.ts             │ │
│ │ │  └─ 状态: ✓ 完成                  │ │
│ │ └─ 回复内容                         │ │
│ │                                     │ │
│ │ [用户消息]                          │ │
│ │ ...                                 │ │
│ │                           [↓跳到底] │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Input Area (固定)                       │
│ ┌─────────────────────────────────────┐ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ /ask - 询问问题                 │ │ │ <- 斜杠命令菜单（浮层）
│ │ │ /code - 编写代码                │ │ │
│ │ └─────────────────────────────────┘ │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ 输入消息...                     │ │ │ <- 输入框（固定）
│ │ └─────────────────────────────────┘ │ │
│ │ [发送] [取消]                       │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 2.2 CSS 布局关键点

```css
.acp-chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;  /* 填满 Obsidian 侧边栏 */
}

.acp-chat-header {
  flex-shrink: 0;  /* 固定高度，不收缩 */
}

.acp-messages-container {
  flex: 1;  /* 占据剩余空间 */
  min-height: 0;  /* 关键：允许 flexbox 子元素收缩 */
  position: relative;
}

.acp-chat-messages {
  height: 100%;  /* 填满父容器 */
  overflow-y: auto;  /* 可滚动 */
  overflow-x: hidden;
}

.acp-chat-input {
  flex-shrink: 0;  /* 固定高度，不收缩 */
  position: relative;  /* 为斜杠命令菜单定位 */
}
```

## 三、状态机设计

### 3.1 连接状态

```
状态枚举：
- disconnected: 未连接
- connecting: 连接中
- connected: 已连接
- error: 连接错误
```

**状态转换：**
```
disconnected → connecting (用户点击"连接")
  → connected (连接成功)
  → error (连接失败)
  → disconnected (断开连接)

connected → disconnected (用户断开/连接断开)
connected → error (运行时错误)
```

**UI 映射：**
| 状态 | 状态显示 | 输入框 | 发送按钮 | 连接按钮 | Agent 选择器 |
|------|---------|--------|---------|---------|-------------|
| disconnected | 灰色"未连接" | 禁用 | 禁用 | 显示"连接" | 可选择 |
| connecting | 黄色"连接中" | 禁用 | 禁用 | 禁用 | 禁用 |
| connected | 绿色"已连接" | 启用 | 启用 | 显示"断开" | 禁用 |
| error | 红色"错误" | 禁用 | 禁用 | 显示"重新连接" | 可选择 |

### 3.2 会话状态

```
状态枚举：
- idle: 空闲（等待用户输入）
- processing: 处理中（AI 思考/回复）
- cancelled: 已取消
```

**状态转换：**
```
idle → processing (用户发送消息)
  → idle (AI 回复完成)
  → cancelled (用户取消)

processing → idle (回合结束)
processing → cancelled (用户点击"取消")
cancelled → idle (自动恢复)
```

**UI 映射：**
| 会话状态 | 输入框 | 发送按钮 | 取消按钮 | 状态文本 |
|---------|--------|---------|---------|---------|
| idle | 启用 | 显示"发送" | 隐藏 | "已连接" |
| processing | 禁用 | 隐藏 | 显示"取消" | "处理中" |
| cancelled | 禁用 | 隐藏 | 隐藏 | "已取消" |

### 3.3 输入框状态

```
状态条件：
1. enabled: 连接已建立 && 会话空闲
2. disabled: 
   - 未连接
   - 连接中
   - 处理中
   - 已取消（短暂）
   - 错误
```

**关键点：输入框永远不应该"消失"，只应该 enabled/disabled 切换！**

## 四、交互流程详解

### 4.1 连接 Agent

```
用户操作：
1. 选择 Agent
2. 点击"连接"

系统响应：
1. 更新连接状态: disconnected → connecting
2. 禁用所有交互元素
3. 显示"连接中..."
4. 调用 AcpConnection.connect()
5. 如果成功:
   - 更新连接状态: connecting → connected
   - 创建 SessionManager
   - 启用输入框和发送按钮
   - 显示"已连接 (Agent名)"
6. 如果失败:
   - 更新连接状态: connecting → error
   - 显示错误消息
   - 保持输入框禁用
```

### 4.2 发送消息

```
用户操作：
1. 在输入框输入文本
2. 点击"发送"或按 Enter

系统响应：
1. 验证输入（非空）
2. 验证连接状态（已连接）
3. 保存消息到输入历史
4. 清空输入框
5. 更新会话状态: idle → processing
6. 禁用输入框，显示"发送中..."
7. 添加用户消息到消息列表
8. 调用 SessionManager.sendPrompt()
9. 切换按钮: 发送 → 取消
10. 等待 AI 回复...
```

### 4.3 接收 AI 回复（流式）

```
AI 回复过程：
1. SessionManager 触发 onMessageStream 事件
2. ChatView 接收消息片段
3. 使用 StreamingMessageBuffer 缓冲
4. 批量更新 UI（减少重绘）
5. 自动滚动到底部
6. 重复 1-5 直到流结束

回合结束：
1. SessionManager 触发 onTurnEnd 事件
2. 更新会话状态: processing → idle
3. 启用输入框
4. 切换按钮: 取消 → 发送
5. 重置发送状态（重要！）
6. 清空当前 Turn 容器
7. 输入框获得焦点（可选）
```

### 4.4 取消请求

```
用户操作：
1. 在 AI 处理过程中点击"取消"

系统响应：
1. 调用 SessionManager.cancel()
2. 更新会话状态: processing → cancelled
3. 显示系统消息"⚠️ 已取消"
4. 短暂延迟后（自动或立即）：
5. 更新会话状态: cancelled → idle
6. 启用输入框
7. 切换按钮: 取消 → 发送
8. 重置发送状态
```

### 4.5 工具调用可视化

```
工具调用生命周期：
1. onToolCallUpdate: 创建工具调用卡片
   - 显示工具名称、参数
   - 状态: pending → in_progress
   
2. onToolCallStatusUpdate: 更新卡片状态
   - 更新状态图标和颜色
   - 状态: in_progress → completed/failed
   
3. 显示结果或错误信息
```

### 4.6 斜杠命令交互

详见 `SLASH_COMMAND_DESIGN.md`

要点：
- 输入 `/` 触发菜单
- 实时过滤
- 键盘导航
- 有参数：预填充；无参数：直接发送
- **菜单不应该遮挡或影响输入框的显示**

## 五、关键问题分析

### 5.1 "对话框没了" 的可能原因

#### 原因 1：CSS 布局问题
```css
/* 错误示例：*/
.acp-messages-container {
  overflow: hidden;  /* 阻止滚动 */
}

.acp-command-menu {
  position: absolute;
  bottom: XXX;  /* 可能覆盖输入框 */
}

/* 正确方案：*/
.acp-messages-container {
  overflow: visible;  /* 或者只对 .acp-chat-messages 设置 overflow */
  min-height: 0;  /* 关键！ */
}

.acp-command-menu {
  position: absolute;
  bottom: 100%;  /* 相对于输入框，始终在上方 */
  margin-bottom: 8px;
}
```

#### 原因 2：状态管理混乱
```typescript
// 问题：在多个地方设置 inputEl.disabled
// 可能导致状态不一致

// 解决方案：统一的状态更新方法
private updateInputState(): void {
  const enabled = this.isConnected() && this.isIdle();
  this.inputEl.disabled = !enabled;
  this.sendButtonEl.disabled = !enabled;
}
```

#### 原因 3：DOM 操作错误
```typescript
// 问题：斜杠命令菜单的创建/销毁可能影响输入框
// 错误：直接替换父元素
this.inputContainerEl.empty();  // 输入框也被删除了！

// 正确：只操作菜单元素
this.commandMenuEl?.remove();
```

#### 原因 4：事件冲突
```typescript
// 问题：多个事件监听器可能互相干扰
// 例如：input 事件和 keydown 事件的处理顺序

// 解决方案：明确优先级
keydown: 处理特殊键（Enter, Esc, 方向键）
input: 处理内容变化（过滤命令）
```

### 5.2 输入框状态管理方案

```typescript
// 集中管理输入框状态
class InputState {
  // 状态标志
  private isConnected = false;
  private isProcessing = false;
  private isSending = false;
  
  // 计算是否应该启用
  get enabled(): boolean {
    return this.isConnected && !this.isProcessing && !this.isSending;
  }
  
  // 更新连接状态
  setConnected(connected: boolean): void {
    this.isConnected = connected;
    this.update();
  }
  
  // 更新处理状态
  setProcessing(processing: boolean): void {
    this.isProcessing = processing;
    this.update();
  }
  
  // 更新发送状态
  setSending(sending: boolean): void {
    this.isSending = sending;
    this.update();
  }
  
  // 统一更新 UI
  private update(): void {
    this.inputEl.disabled = !this.enabled;
    this.sendButtonEl.disabled = !this.enabled;
    this.updateButtonState();
  }
}
```

## 六、完整状态矩阵

| 连接状态 | 会话状态 | 输入框 | 发送按钮 | 取消按钮 | Agent选择 | 连接按钮 |
|---------|---------|--------|---------|---------|----------|---------|
| disconnected | idle | ❌ 禁用 | ❌ 禁用 | ⚪ 隐藏 | ✅ 启用 | ✅ "连接" |
| connecting | idle | ❌ 禁用 | ❌ 禁用 | ⚪ 隐藏 | ❌ 禁用 | ❌ 禁用 |
| connected | idle | ✅ 启用 | ✅ "发送" | ⚪ 隐藏 | ❌ 禁用 | ✅ "断开" |
| connected | processing | ❌ 禁用 | ⚪ 隐藏 | ✅ "取消" | ❌ 禁用 | ❌ 禁用 |
| connected | cancelled | ❌ 禁用(短暂) | ⚪ 隐藏 | ⚪ 隐藏 | ❌ 禁用 | ❌ 禁用 |
| error | idle | ❌ 禁用 | ❌ 禁用 | ⚪ 隐藏 | ✅ 启用 | ✅ "重连" |

**关键原则：**
1. 输入框永远存在（display: block），只切换 disabled 状态
2. 发送/取消按钮互斥显示（一个 display:none，另一个 display:block）
3. 所有状态更新必须通过统一的方法
4. 避免在事件回调中直接操作 DOM

## 七、代码实现方案

### 7.1 状态管理重构

```typescript
export class AcpChatView extends ItemView {
  // 状态标志（明确的 boolean）
  private isConnected = false;
  private isConnecting = false;
  private sessionState: SessionState = 'idle';
  private isSendingMessage = false;
  
  // 统一的状态更新
  private updateUIState(): void {
    this.updateConnectionStatus();
    this.updateInputState();
    this.updateButtonState();
  }
  
  private updateInputState(): void {
    // 计算是否启用
    const enabled = this.isConnected 
      && this.sessionState === 'idle' 
      && !this.isSendingMessage;
    
    this.inputEl.disabled = !enabled;
  }
  
  private updateButtonState(): void {
    const showSend = this.isConnected && this.sessionState === 'idle';
    const showCancel = this.isConnected && this.sessionState === 'processing';
    
    this.sendButtonEl.style.display = showSend ? 'inline-block' : 'none';
    this.cancelButtonEl.style.display = showCancel ? 'inline-block' : 'none';
    this.sendButtonEl.disabled = this.isSendingMessage;
  }
  
  // 在所有状态变化时调用 updateUIState()
  private handleConnect(): void {
    this.isConnecting = true;
    this.updateUIState();
    // ... 连接逻辑 ...
    this.isConnecting = false;
    this.isConnected = true;
    this.updateUIState();
  }
  
  private handleStateChange(state: SessionState): void {
    this.sessionState = state;
    this.updateUIState();
  }
  
  private async handleSend(): Promise<void> {
    this.isSendingMessage = true;
    this.updateUIState();
    try {
      // ... 发送逻辑 ...
    } finally {
      this.isSendingMessage = false;
      this.updateUIState();
    }
  }
}
```

### 7.2 斜杠命令菜单位置修正

```typescript
private showCommandMenu(filter = ''): void {
  // ...过滤逻辑...
  
  // 创建菜单（作为 inputContainerEl 的子元素）
  this.commandMenuEl = this.inputContainerEl.createDiv({
    cls: 'acp-command-menu',
  });
  
  // 关键：不设置 bottom，使用 CSS 处理定位
  // CSS 中使用 position: absolute; bottom: 100%; margin-bottom: 8px;
  // 这样菜单始终在输入框上方，不会覆盖
  
  // ... 渲染命令项 ...
}
```

```css
.acp-chat-input {
  position: relative;  /* 为子元素定位基准 */
  flex-shrink: 0;
}

.acp-command-menu {
  position: absolute;
  bottom: 100%;  /* 相对于 .acp-chat-input */
  left: 0;
  right: 0;
  margin-bottom: 8px;  /* 间距 */
  /* ...其他样式... */
}
```

### 7.3 消息区域滚动修正

```css
.acp-chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.acp-messages-container {
  flex: 1;
  min-height: 0;  /* 关键！允许 flex 子元素收缩 */
  position: relative;
  overflow: visible;  /* 不阻止子元素的滚动 */
}

.acp-chat-messages {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.acp-chat-input {
  flex-shrink: 0;  /* 固定高度 */
  position: relative;
}
```

## 八、实现清单

### 8.1 必须修复的问题
- [ ] 统一状态管理，避免状态不一致
- [ ] 修正斜杠命令菜单定位，确保不覆盖输入框
- [ ] 修正 CSS flexbox 布局，确保滚动正常
- [ ] 确保输入框在所有状态下都显示（只切换 disabled）
- [ ] 统一按钮显示/隐藏逻辑

### 8.2 状态同步检查点
- [ ] 连接成功后，输入框立即可用
- [ ] 发送消息后，输入框变为禁用
- [ ] AI 回复完成后，输入框恢复可用
- [ ] 取消请求后，输入框恢复可用
- [ ] 断开连接后，输入框变为禁用

### 8.3 测试场景
- [ ] 快速连续发送多条消息
- [ ] 在 AI 回复过程中取消
- [ ] 输入 `/` 触发命令菜单后发送消息
- [ ] 长对话（50+ 条消息）时滚动
- [ ] 切换 Agent
- [ ] 连接失败后重新连接

## 九、最佳实践

### 9.1 DO ✅
- 使用统一的状态更新方法
- 明确的状态标志（boolean）
- CSS flexbox 正确使用 min-height: 0
- position: absolute 配合明确的 bottom: 100%
- 事件处理有明确的优先级
- 输入框始终存在，只切换 disabled

### 9.2 DON'T ❌
- 在多个地方直接修改 inputEl.disabled
- 使用复杂的 bottom 计算（容易出错）
- 删除并重新创建输入框
- overflow: hidden 阻止滚动
- 没有 min-height: 0 的 flex 布局
- 状态更新不同步

## 十、参考设计

### 10.1 优秀的聊天 UI
- **ChatGPT**: 清晰的状态指示，流畅的滚动
- **Claude.ai**: 简洁的工具调用可视化
- **Cursor Chat**: 良好的键盘导航
- **VS Code Chat**: 稳定的布局，不会跳动

### 10.2 Obsidian 插件最佳实践
- 遵循 Obsidian 的设计语言
- 使用 Obsidian 的 CSS 变量
- 响应式布局（适配不同宽度）
- 性能优化（避免频繁重绘）

