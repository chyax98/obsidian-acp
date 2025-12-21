# Terminal 工具调用不显示命令

**日期**: 2025-12-20
**严重性**: 🟡 中等
**状态**: ✅ 已修复
**影响范围**: MessageRenderer / ToolCall Display
**修复时间**: 5 分钟

---

## 问题描述

### 现象

用户反馈：

> "执行 terminal 可以展示出执行的什么命令吗"
> "显然当前没有实现,只显示了 terminal 根本看不到执行的什么"

**实际效果**:
- ToolCall 只显示 `"terminal"` 或 `"执行终端命令"`
- 看不到具体执行的命令内容（如 `du -sh /path/*`）

**用户期望**:
- 显示完整命令，如 `"执行 du: du -sh /Users/chyax/note-vsc/* 2>/dev/null | sort -hr | head -20"`

### 触发条件

- Agent 调用 bash/terminal 相关工具
- `toolCall.kind` 字段为空字符串（Agent 发送的实际数据）
- 影响所有 terminal 类工具调用

### 预期行为

无论 `toolCall.kind` 是什么值，只要 `rawInput.command` 存在，就应该显示完整的命令内容。

---

## 根本原因

### 错误分析

**代码逻辑**: `getToolCallDisplayInfo()` 依赖 `toolCall.kind` 字段判断工具类型

```typescript
// ❌ 问题代码
const kind = toolCall.kind?.toLowerCase() || '';

// Bash / Execute / Terminal 类工具
if (kind === 'bash' || kind === 'execute' || kind === 'shell' || kind === 'terminal') {
    const command = rawInput.command as string;
    if (command) {
        // ... 显示命令
    }
}
```

**实际情况**: 根据调试日志，Agent 发送的 `toolCall.kind` 是 **空字符串**

```
[Debug] toolCall.kind = ""
[Debug] rawInput.command = "du -sh /Users/chyax/note-vsc/* 2>/dev/null | sort -hr | head -20"
```

**导致问题**:
1. `kind === ''`，不匹配任何 `if` 条件
2. 代码跳过 command 检查
3. 直接进入 default 分支，返回通用标题 `"terminal"`

### 相关代码

**文件位置**: `src/ui/MessageRenderer.ts:626-647`

```typescript
// ❌ 错误逻辑顺序
private static getToolCallDisplayInfo(toolCall: ToolCall): { title: string } {
    const kind = toolCall.kind?.toLowerCase() || '';
    const rawInput = toolCall.rawInput || {};

    // 先检查 kind，如果 kind 是空字符串，这里永远匹配不到
    if (kind === 'bash' || kind === 'execute' || ...) {
        const command = rawInput.command as string;
        if (command) {
            return { title: `执行 ${command}` };
        }
    }

    // 默认分支 - 实际总是走到这里
    return { title: toolCall.title || kind || 'Unknown tool' };
}
```

---

## 修复方案

### 解决思路

**核心原则**: 优先检查实际数据（`rawInput.command`），而非元数据（`kind`）

**修复策略**:
1. 将 `rawInput.command` 检查移到函数开头
2. 不依赖 `kind` 字段，直接检查命令是否存在
3. 如果命令存在，立即返回，避免后续逻辑干扰

### 代码变更

**修改文件**:
- `src/ui/MessageRenderer.ts` (Line 626-647)

**关键修复**:

```typescript
// ✅ 修复后的逻辑
private static getToolCallDisplayInfo(toolCall: ToolCall): { title: string } {
    const kind = toolCall.kind?.toLowerCase() || '';
    const rawInput = toolCall.rawInput || {};
    const title = toolCall.title || '';

    // 🔑 关键修复：优先检查 rawInput.command（不管 kind 是什么）
    const command = rawInput.command as string;
    if (command) {
        // 提取命令的第一部分（如 npm, git, python 等）
        const firstWord = command.split(/\s+/)[0];
        // 不截断，显示完整命令
        return { title: `执行 ${firstWord}: ${command}` };
    }

    // Bash / Execute / Terminal 类工具（降级处理）
    if (kind === 'bash' || kind === 'execute' || kind === 'shell' || kind === 'terminal') {
        // 当没有具体命令时，显示更有意义的标题
        if (title && title.toLowerCase() !== kind) {
            return { title: `执行: ${title}` };
        }
        return { title: '执行终端命令' };
    }

    // ... 其他类型处理
}
```

**改进点**:
1. ✅ 移除了 60 字符截断（`command.slice(0, 60)`）
2. ✅ 显示完整命令，提高透明度
3. ✅ 提取命令第一词（如 `du`, `npm`, `git`）作为前缀
4. ✅ 不依赖 `kind` 字段，提高鲁棒性

### Git Commit

```bash
git commit -m "fix: 修复 terminal 工具调用不显示命令的问题"
```

**Commit SHA**: 查看 git log

---

## 验证方式

### 测试步骤

1. 开启新对话
2. 发送需要执行命令的请求（如 "查看目录大小"）
3. 观察 ToolCall 显示：
   - ✅ 显示 `"执行 du: du -sh /path/* 2>/dev/null | sort -hr | head -20"`
   - ✅ 完整命令可见，不截断
   - ✅ 用户可以清楚看到 Agent 执行的内容

### 测试用例

| 命令 | 显示标题 |
|------|---------|
| `du -sh /path/* \| sort -hr` | 执行 du: du -sh /path/* \| sort -hr |
| `npm install` | 执行 npm: npm install |
| `git status` | 执行 git: git status |
| `python script.py` | 执行 python: python script.py |

### 回归测试

- [x] 手动测试 - 命令完整显示
- [x] 手动测试 - 长命令不截断
- [x] 手动测试 - 提取命令首词作为前缀
- [ ] 自动化测试 - 待补充

---

## 影响评估

### 用户影响

**影响面**: 所有使用 terminal/bash 工具的场景
- 用户无法看到 Agent 执行的命令
- 降低透明度和信任度

**修复后**:
- ✅ 完整显示命令内容
- ✅ 提高操作透明度
- ✅ 用户可以监控 Agent 行为

### 技术债务

无新增技术债务。建议后续：
- 考虑是否需要语法高亮（如 bash 命令高亮）
- 添加命令复制按钮
- 支持命令执行结果的折叠/展开

---

## 经验教训

### 避免方法

1. **优先级设计**
   - 实际数据（`rawInput.*`）> 元数据（`kind`, `title`）
   - 不要过度依赖可能为空的字段

2. **字段验证**
   - Agent 发送的数据不一定符合预期
   - `kind` 字段可能是空字符串、null、undefined
   - 应该优先检查实际内容字段

3. **鲁棒性原则**
   - 代码应该处理各种边界情况
   - 不要假设外部数据的格式

4. **用户体验**
   - 显示完整信息（不截断），让用户知道发生了什么
   - 透明度是 AI 工具的关键信任因素

### 相关工具

**建议添加**:
- 单元测试：覆盖各种 `toolCall` 数据格式
- 字段存在性检查：优先级排序
- 代码注释：说明 Agent 可能发送的各种数据格式

---

## 相关链接

- MessageRenderer 实现: `src/ui/MessageRenderer.ts`
- ACP ToolCall 类型: `src/acp/types/updates.ts`
- 相关 Bug: [2025-12-20-streaming-extra-newlines.md](./2025-12-20-streaming-extra-newlines.md)
