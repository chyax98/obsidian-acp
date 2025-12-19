# Agent Thought Chunk 功能实现

## 概述

实现了 ACP 协议中的 `agent_thought_chunk` 事件处理，允许显示 Agent 的思考过程。

## 实现内容

### 1. 后端处理 (session-manager.ts)

#### 1.1 Turn 类型增强
```typescript
export interface Turn {
	// ... 其他字段
	/** 思考内容列表 */
	thoughts: string[];
}
```

#### 1.2 思考块回调
```typescript
/** 思考块更新回调 */
public onThought: (thought: string) => void = () => {};
```

#### 1.3 处理方法
```typescript
/**
 * 处理 Agent 思考块
 */
private handleAgentThoughtChunk(update: SessionUpdateData): void {
	if (!this.currentTurn) return;

	const content = (update as { content?: { text?: string } }).content;
	const text = content?.text || '';

	if (text) {
		// 添加到思考列表
		this.currentTurn.thoughts.push(text);
		// 触发回调
		this.onThought(text);
	}
}
```

### 2. UI 渲染 (MessageRenderer.ts)

#### 2.1 渲染方法
```typescript
/**
 * 渲染思考块
 *
 * @param container - 容器元素
 * @param thoughts - 思考内容列表
 * @returns 思考块元素
 */
static renderThoughts(container: HTMLElement, thoughts: string[]): HTMLElement
```

#### 2.2 特性
- **可折叠设计**：默认折叠，点击展开
- **独特样式**：灰色背景，斜体显示
- **图标标识**：💭 思考过程
- **动态更新**：支持流式追加思考内容

### 3. ChatView 集成

#### 3.1 回调绑定
```typescript
// 思考块更新
this.sessionManager.onThought = (thought: string) => {
	this.handleThought(thought);
};
```

#### 3.2 处理逻辑
```typescript
/**
 * 处理思考块
 */
private handleThought(thought: string): void {
	if (!this.sessionManager) return;

	const turn = this.sessionManager.activeTurn;
	if (!turn) return;

	// 使用 MessageRenderer 渲染思考块（渲染整个思考列表）
	MessageRenderer.renderThoughts(this.messagesEl, turn.thoughts);
	this.scrollToBottom();
}
```

### 4. 样式设计 (styles.css)

#### 4.1 容器样式
```css
.acp-thoughts {
	margin: 12px 0;
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	background-color: var(--background-secondary);
	overflow: hidden;
}
```

#### 4.2 头部样式
```css
.acp-thoughts-header {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px 12px;
	cursor: pointer;
	user-select: none;
	background-color: var(--background-secondary-alt);
	border-bottom: 1px solid var(--background-modifier-border);
}
```

#### 4.3 思考条目样式
```css
.acp-thought-item {
	padding: 8px 12px;
	margin: 4px 0;
	background-color: var(--background-primary);
	border-left: 3px solid var(--text-muted);
	border-radius: 4px;
	font-style: italic;
	color: var(--text-muted);
	line-height: 1.6;
	white-space: pre-wrap;
	word-wrap: break-word;
}
```

## 使用方式

### 前端显示

当 Agent 发送 `agent_thought_chunk` 事件时：

1. **自动捕获**：SessionManager 自动捕获思考内容
2. **存储管理**：思考内容存储在当前 Turn 的 `thoughts` 数组
3. **UI 渲染**：ChatView 调用 MessageRenderer 渲染思考块
4. **用户交互**：用户可点击思考块头部展开/折叠

### 视觉效果

```
┌─────────────────────────────────┐
│ > 💭 思考过程                    │  ← 可点击头部（默认折叠）
└─────────────────────────────────┘

点击展开后：

┌─────────────────────────────────┐
│ v 💭 思考过程                    │  ← 可点击头部
├─────────────────────────────────┤
│  思考内容 1                      │  ← 斜体，灰色，左侧竖线
│  思考内容 2                      │
│  思考内容 3                      │
└─────────────────────────────────┘
```

## 技术细节

### 事件流

1. Agent 发送 `agent_thought_chunk` 事件
2. Connection 接收并通过 `onSessionUpdate` 回调传递
3. SessionManager 的 `handleAgentThoughtChunk` 处理
4. 存储到 `currentTurn.thoughts` 数组
5. 触发 `onThought` 回调
6. ChatView 调用 MessageRenderer 渲染
7. UI 更新，自动滚动到底部

### 数据结构

```typescript
// ACP 事件
interface AgentThoughtChunkUpdateData {
	sessionUpdate: 'agent_thought_chunk';
	content: {
		type: 'text';
		text: string;
	};
}

// Turn 中的存储
interface Turn {
	thoughts: string[];  // 思考内容数组
}
```

## 兼容性

- ✅ 支持流式追加
- ✅ 支持多个思考块
- ✅ 自动处理空内容
- ✅ 与现有消息系统集成良好
- ✅ 遵循 Obsidian 主题变量

## 未来增强

可能的改进方向：

1. **持久化**：将思考过程保存到会话历史
2. **搜索**：支持在思考内容中搜索
3. **导出**：支持导出思考过程到 Markdown
4. **高亮**：支持关键词高亮
5. **时间戳**：显示每个思考块的时间戳

## 相关文件

- `/Users/Apple/dev/obsidian-acp/src/acp/core/session-manager.ts`
- `/Users/Apple/dev/obsidian-acp/src/ui/MessageRenderer.ts`
- `/Users/Apple/dev/obsidian-acp/src/ui/ChatView.ts`
- `/Users/Apple/dev/obsidian-acp/styles.css`
