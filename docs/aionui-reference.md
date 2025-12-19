# AionUI 消息渲染参考

## Session Update 类型处理

```typescript
// AionUI 支持的 sessionUpdate 类型
switch (update.sessionUpdate) {
  case 'agent_message_chunk':  // AI 文本消息块
  case 'agent_thought_chunk':  // AI 思考过程
  case 'tool_call':            // 工具调用开始
  case 'tool_call_update':     // 工具调用状态更新
  case 'plan':                 // 计划更新
  case 'available_commands_update':  // 可用命令
  case 'user_message_chunk':   // 用户消息回显
  case 'current_mode_update':  // 模式切换
}
```

## 工具调用渲染

### 状态颜色映射
```typescript
const StatusTag = ({ status }) => {
  switch (status) {
    case 'pending':   return { color: 'blue', text: 'Pending' };
    case 'executing': return { color: 'orange', text: 'Executing' };
    case 'success':   return { color: 'green', text: 'Success' };
    case 'error':     return { color: 'red', text: 'Error' };
    case 'canceled':  return { color: 'gray', text: 'Canceled' };
  }
};
```

### 工具类型图标
```typescript
const getKindIcon = (kind: string) => {
  switch (kind) {
    case 'execute':    return '🔧';  // Shell 命令
    case 'patch':      return '📝';  // 文件编辑
    case 'mcp':        return '🔌';  // MCP 工具
    case 'web_search': return '🔍';  // Web 搜索
    case 'read':       return '📖';  // 文件读取
    case 'write':      return '✏️';  // 文件写入
    default:           return '⚙️';  // 默认
  }
};
```

### 工具调用卡片结构
```html
<Card size="small" bordered>
  <div class="flex items-center gap-2">
    <span>{icon}</span>
    <span class="font-medium">{title}</span>
    <StatusTag status={status} />
    {additionalTags}  <!-- exit_code, duration 等 -->
  </div>

  {description && <div class="text-secondary">{description}</div>}

  <!-- 命令显示 -->
  {command && (
    <div class="bg-dark p-2 rounded font-mono">
      <span class="text-muted">$ </span>
      <span class="text-success">{command}</span>
    </div>
  )}

  <!-- 输出内容 -->
  {output && (
    <pre class="whitespace-pre-wrap">{output}</pre>
  )}

  <div class="text-xs text-muted">Tool Call ID: {toolCallId}</div>
</Card>
```

## 思考块渲染

```typescript
// 思考块转换为 tips 类型，居中显示
convertThoughtChunk(update) {
  return {
    type: 'tips',
    position: 'center',
    content: {
      content: update.content.text,
      type: 'warning',  // 黄色警告样式
    },
  };
}
```

## 计划更新渲染

```typescript
// 状态图标
const statusIcon = {
  'completed': '✅',
  'in_progress': '🔄',
  'pending': '⏳',
};

// 转为 Markdown 文本
const planContent = entries.map(entry =>
  `${statusIcon[entry.status]} ${entry.content}`
).join('\n');

return `📋 **Plan Update**\n\n${planContent}`;
```

## 关键设计模式

### 1. msg_id 合并机制
- 同一个工具调用的多个更新使用相同的 `msg_id`
- 这样可以在 UI 中合并显示，而不是创建多条消息

### 2. 消息流重置
- 每次 tool_call、thought_chunk 后调用 `resetMessageTracking()`
- 确保下一个 agent_message_chunk 获得新的 msg_id

### 3. 紧凑布局
- 使用小尺寸卡片 (`size="small"`)
- 间距使用 `gap-2` (8px) 或 `gap-3` (12px)
- 文字大小使用 `text-sm` 或 `text-xs`

## CSS 样式参考

```css
/* 工具调用卡片 */
.tool-card {
  margin-bottom: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

/* 状态标签 */
.status-tag {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

/* 终端输出 */
.terminal-output {
  background: var(--code-bg);
  padding: 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 13px;
  max-height: 240px;
  overflow-y: auto;
}
```
