# 流式渲染多余换行问题

**日期**: 2025-12-20
**严重性**: 🟡 中等
**状态**: ✅ 已修复
**影响范围**: MessageRenderer / Streaming Display
**修复时间**: 20 分钟（分两次迭代）

---

## 问题描述

### 现象

Agent 回复的每行文字之间出现多余的空白行，用户反馈：

> "每行文字之间都有一个换行 \n"
> "还是有空格"（第二次反馈，附带截图）

**实际效果**（用户截图）:
- 正常段落之间有过多的垂直空白
- Agent 输出的文本显得稀疏、难以阅读

### 触发条件

- Agent 流式输出文本内容
- Agent 输出包含多个换行符（如 `\n\n\n`）
- 影响所有流式消息渲染

### 预期行为

- 正常段落间距（两个换行符 = 一个空行）
- 不应该有过多的垂直空白
- 保持可读性

---

## 根本原因

### 错误分析（第一次）

**原始实现**: 使用 `innerHTML` 手动替换换行符

```typescript
// ❌ 问题代码
contentEl.innerHTML = newContent.replace(/\n/g, '<br>');
```

**问题**: 每个 `\n` 都转为 `<br>`，导致：
- 单个换行 → 换行
- 双换行 `\n\n` → 两个 `<br>` → 两个换行
- 多换行 `\n\n\n` → 三个 `<br>` → 三个换行

### 错误分析（第二次）

**第一次修复**: 使用 `textContent` + CSS `white-space: pre-wrap`

```typescript
// ⚠️ 半对半错
contentEl.textContent = newContent;  // CSS: white-space: pre-wrap
```

**新问题**: Agent 生成的内容包含多个连续换行符（如 `\n\n\n\n`），`pre-wrap` 会原样保留所有换行，导致过多空白。

**根本原因**: Agent 的输出格式不规范，需要在渲染层进行清理。

### 相关代码

**文件位置**: `src/ui/MessageRenderer.ts:351-358`

---

## 修复方案

### 解决思路

**第一次修复** (失败):
- 从 `innerHTML` 改为 `textContent`
- 使用 CSS `white-space: pre-wrap` 保留换行
- ❌ 问题：没有处理多余的连续换行

**第二次修复** (成功):
- 保留 `textContent` + `white-space: pre-wrap`
- **关键**: 添加正则表达式折叠连续换行
- 规则：3+ 个换行 → 2 个换行（保留段落间距，去除过度空白）

### 代码变更

**修改文件**:
- `src/ui/MessageRenderer.ts` (Line 351-358)
- `styles.css` (Line 217-222)

**关键修复**: MessageRenderer

```typescript
// ✅ 最终修复
if (newContent !== existingText) {
    // 存储原始内容供后续使用
    contentEl.setAttribute('data-raw-content', newContent);

    // 流式期间使用纯文本显示，折叠多余的连续换行（3+ 个换行 → 2 个换行）
    const displayContent = newContent.replace(/\n{3,}/g, '\n\n');
    contentEl.textContent = displayContent;
    contentEl.addClass('acp-message-streaming');
}
```

**配套 CSS**: styles.css

```css
/* 流式输出期间的样式优化 */
.acp-message-streaming {
    /* 流式期间使用固定最小高度，避免内容增长时的抖动 */
    min-height: 2em;
    /* 保留换行符和空格，但允许自动换行 */
    white-space: pre-wrap;
}
```

### Git Commit

```bash
# 第一次修复（与权限修复一起提交）
git commit -m "fix: 修复权限响应格式不符合 ACP 协议和流式渲染多余换行"

# 第二次修复（清理日志 + 改进换行处理）
git commit -m "refactor: 清理调试日志并优化流式渲染换行处理"
```

**Commit SHA**: 查看 git log

---

## 验证方式

### 测试步骤

1. 开启新对话
2. 发送请求，等待 Agent 流式回复
3. 观察消息渲染：
   - ✅ 正常段落间距（不过分稀疏）
   - ✅ 换行符正确保留
   - ✅ 没有多余的空白行

### 回归测试

- [x] 手动测试 - 流式消息正常显示
- [x] 手动测试 - 段落间距合理
- [x] 手动测试 - 代码块格式正确
- [ ] 自动化测试 - 待补充

---

## 影响评估

### 用户影响

**影响面**: 100% 用户
- 所有流式消息渲染受影响
- 严重影响阅读体验

**修复后**:
- ✅ 消息显示紧凑、可读
- ✅ 保留必要的段落间距
- ✅ 折叠过度的空白行

### 技术债务

无新增技术债务。建议后续：
- 考虑是否需要更智能的格式化（如 Markdown 渲染期完成前的预处理）
- 添加单元测试覆盖渲染逻辑

---

## 经验教训

### 避免方法

1. **渲染策略选择**
   - `innerHTML` 适合 HTML 内容，但需防范 XSS
   - `textContent` 适合纯文本，配合 CSS `white-space`
   - 外部内容需要进行清理/规范化

2. **正则表达式清理**
   - 使用 `/\n{3,}/g` 折叠多余换行
   - 保留最少必要格式（2 个换行 = 1 个空行）

3. **迭代修复**
   - 第一次修复解决了 XSS 风险和基础渲染
   - 第二次修复解决了格式清理问题
   - 用户反馈是关键（"还是有空格"）

### 相关工具

**建议添加**:
- 单元测试：测试各种换行组合的渲染结果
- 可视化测试：截图对比工具
- Markdown 预处理器：统一格式化 Agent 输出

---

## 相关链接

- MessageRenderer 实现: `src/ui/MessageRenderer.ts`
- CSS 样式: `styles.css`
- 相关 Bug: [2025-12-20-permission-format-mismatch.md](./2025-12-20-permission-format-mismatch.md)
