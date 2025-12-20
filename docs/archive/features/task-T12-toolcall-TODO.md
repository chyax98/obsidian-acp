# T12: 工具调用渲染增强 - TODO

> Agent: Claude-Agent-T12
> 开始时间: 2025-12-18
> 完成时间: 2025-12-18
> 状态: ✅ 已完成

## 任务目标

增强 MessageRenderer 中的工具调用渲染，提供更丰富的交互和信息展示。

## 依赖

- ✅ T10 (MessageRenderer 基础版) - 已完成

## 需要实现的功能

### 1. 增强工具调用卡片 ✅

- [x] 显示工具执行时间（开始时间、持续时长）
- [x] 显示输入参数（格式化 JSON）
- [x] 显示输出结果
- [x] 错误信息高亮显示
- [x] 支持终端输出实时渲染

### 2. 改进 Diff 显示 ✅

- [x] 添加行号显示
- [x] 改进颜色区分（使用 +/- 行标记）
- [x] 文件路径显示优化

### 3. 工具调用分组 ✅

- [x] 按回合分组显示工具调用
- [x] 支持整组折叠/展开
- [x] 显示每组的统计信息（总数、成功、失败）

### 4. 交互增强 ✅

- [x] 添加复制按钮（复制工具输出）
- [x] 文件路径点击跳转（在 Obsidian 中打开文件）
- [x] 工具调用详情的展开/收起动画优化

## 实施步骤

1. ✅ 锁定任务（更新执行计划）
2. ✅ 创建 TODO 文档
3. ✅ 增强 MessageRenderer.ts
4. ✅ 更新 styles.css
5. ✅ 运行构建验证
6. ✅ 更新 TODO 标记完成
7. ⏳ Git commit

## 技术要点

### 工具调用数据结构

根据 `session-manager.ts`:

```typescript
interface ToolCall {
	toolCallId: string;
	title: string;
	kind: string;
	status: ToolCallStatus; // 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'error'
	content?: ToolCallContent[];
	startTime: number;
	endTime?: number;
}
```

### 内容类型

- `content`: 文本内容
- `diff`: 文件差异（oldText, newText, path）
- `terminal`: 终端输出

### 增强目标

1. 时间显示：计算 `endTime - startTime`，格式化为可读时长
2. 参数显示：从 content 中提取参数信息
3. 分组：使用 Turn 数据结构，为每个 Turn 创建工具调用组
4. 交互：添加按钮和事件监听

## 实现细节

### MessageRenderer 增强

1. **时间显示**
   - `formatToolCallTime()`: 格式化时间显示（执行中/等待中/持续时长）
   - `formatDuration()`: 将毫秒转换为可读格式（ms/s/m s）

2. **复制功能**
   - `renderTextContentWithCopy()`: 文本内容 + 复制按钮
   - `renderTerminalOutput()`: 终端输出 + 复制按钮
   - 复制后显示勾选图标 1.5 秒

3. **增强 Diff**
   - `renderDiffEnhanced()`: 带行号和文件路径的 diff
   - 行号左对齐，4 位宽度
   - 文件路径可点击跳转
   - 复制按钮复制完整 diff 文本

4. **工具调用分组**
   - `renderToolCallGroup()`: 渲染工具调用组
   - `calculateToolCallStats()`: 计算统计信息
   - 支持折叠/展开
   - 显示总数、成功数、失败数

### 样式增强

1. **工具调用卡片**
   - 标题容器改为 flexbox 列布局
   - 添加时间显示样式（等宽字体）

2. **复制按钮**
   - 绝对定位在右上角
   - hover 时不透明度提升
   - 小尺寸变体用于 diff 头部

3. **Diff 渲染**
   - 文件路径头部，可点击样式（虚线下划线）
   - 行号列 + 内容列的 flex 布局
   - 行号不可选中（user-select: none）

4. **工具调用分组**
   - 分组头部 + 统计信息
   - 折叠动画（max-height transition）
   - 统计徽章颜色编码

## 进度记录

- 2025-12-18: 任务启动，创建 TODO 文档
- 2025-12-18: 完成 MessageRenderer 增强
- 2025-12-18: 完成样式文件更新
- 2025-12-18: 构建验证通过
- 2025-12-18: ✅ 任务完成
