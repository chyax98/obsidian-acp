# 斜杠命令 - 产品设计与交互规范

## 一、产品目标

将 AI Agent 的"可用命令"从固定显示的命令栏改为按需唤起的斜杠命令菜单，减少界面占用，提升交互效率。

## 二、参考设计

借鉴以下产品的斜杠命令设计：
- **Slack**: `/` 唤起命令，实时过滤，键盘导航
- **Discord**: 斜杠命令菜单，带描述和参数提示
- **Notion**: 斜杠触发块类型选择器
- **VS Code**: 命令面板 (Cmd+Shift+P)

## 三、交互流程

### 3.1 触发命令菜单

**触发时机：**
- 用户在输入框**开头**输入 `/` 字符

**行为：**
1. 立即显示命令菜单（如果有可用命令）
2. 菜单显示所有可用命令
3. 第一个命令自动高亮

**边界情况：**
- 如果没有可用命令，不显示菜单
- 如果 `/` 不在开头（如 `hello /test`），不触发菜单

### 3.2 过滤命令

**触发时机：**
- 用户继续输入（如 `/ask`, `/code`）

**行为：**
1. 实时过滤命令列表
2. 匹配命令名称和描述（忽略大小写）
3. 第一个匹配项自动高亮
4. 如果没有匹配项，隐藏菜单

**示例：**
```
输入: /as
显示: /ask, /assist (如果有)

输入: /xyz
显示: (菜单隐藏，因为无匹配)
```

### 3.3 选择命令

**方式一：键盘导航**
- `↑` 上一个命令
- `↓` 下一个命令
- `Enter` 选择当前高亮命令
- `Esc` 关闭菜单

**方式二：鼠标操作**
- 鼠标悬停高亮命令
- 点击选择命令

**方式三：直接输入**
- 完整输入命令名（如 `/ask`）
- 按 `Enter` 发送

### 3.4 执行命令

**情况A：命令需要参数**
- 预填充输入框：`/commandName [hint]`
- 光标选中 `[hint]` 部分
- 用户输入实际参数
- 按 `Enter` 发送

**情况B：命令无需参数**
- 清空输入框
- 自动填充：`/commandName`
- 自动发送给 AI Agent

### 3.5 关闭菜单

**触发时机：**
- 用户按 `Esc`
- 用户删除了 `/` 字符（输入框不以 `/` 开头）
- 用户选择了命令
- 用户点击菜单外部区域（TODO: 可选实现）
- 用户开始发送消息

## 四、视觉设计

### 4.1 布局结构

```
┌────────────────────────────────────┐
│  消息区域 (Messages)                │
│                                    │
│  [滚动区域]                         │
│                                    │
├────────────────────────────────────┤
│  ┌──────────────────────────────┐ │
│  │ ⚡ /ask - 询问问题           │ │ <- 命令菜单（浮层）
│  │ 💻 /code - 编写代码          │ │
│  │ 📋 /plan - 制定计划          │ │
│  └──────────────────────────────┘ │
│                                    │
│  ┌──────────────────────────────┐ │
│  │ /ask                         │ │ <- 输入框（固定位置）
│  └──────────────────────────────┘ │
│  [发送] [取消]                     │
└────────────────────────────────────┘
```

### 4.2 样式规范

**命令菜单容器：**
- **定位**: 绝对定位在输入框上方
- **宽度**: 与输入框一致
- **最大高度**: 300px（超出滚动）
- **背景**: 主背景色 + 边框 + 阴影
- **圆角**: 6px
- **动画**: 淡入 (150ms)

**命令项：**
- **布局**: 横向 - 图标 + 信息
- **高度**: 自适应内容，padding 10px 12px
- **图标**: 18×18px，左侧，accent 颜色
- **命令名**: 等宽字体，加粗，主文本色
- **描述**: 小字体，次要文本色，单行省略
- **悬停**: 背景色变化 + 过渡动画
- **选中**: 与悬停相同的背景色

### 4.3 颜色和间距

```css
/* 容器 */
background: var(--background-primary)
border: 1px solid var(--background-modifier-border)
box-shadow: var(--shadow-l)
padding: 4px 0

/* 命令项 */
padding: 10px 12px
gap: 10px (图标与文字)
gap: 2px (命令名与描述)

/* 交互状态 */
hover/selected: var(--background-modifier-hover)
transition: background-color 0.15s
```

## 五、技术实现

### 5.1 DOM 结构

```html
<div class="acp-chat-input">
  <!-- 命令菜单（动态创建/销毁） -->
  <div class="acp-command-menu" style="position: absolute; bottom: [计算值]px;">
    <div class="acp-command-menu-item acp-command-menu-item-selected">
      <div class="acp-command-menu-icon">[图标]</div>
      <div class="acp-command-menu-info">
        <div class="acp-command-menu-name">/ask</div>
        <div class="acp-command-menu-desc">询问问题</div>
      </div>
    </div>
    <!-- 更多命令项... -->
  </div>
  
  <!-- 输入框 -->
  <textarea class="acp-input-textarea">...</textarea>
  
  <!-- 按钮 -->
  <div class="acp-input-buttons">
    <button class="acp-send-button">发送</button>
    <button class="acp-cancel-button">取消</button>
  </div>
</div>
```

### 5.2 位置计算

```typescript
// 菜单应该显示在输入框上方
const inputRect = this.inputEl.getBoundingClientRect();
const containerRect = this.inputContainerEl.getBoundingClientRect();

// bottom = 容器底部到输入框顶部的距离 + 间距
const bottomOffset = containerRect.bottom - inputRect.top + 8;
this.commandMenuEl.style.bottom = `${bottomOffset}px`;
```

### 5.3 状态管理

```typescript
// 命令菜单状态
private commandMenuEl: HTMLElement | null = null;
private commandMenuSelectedIndex: number = -1;
private availableCommands: AvailableCommand[] = [];

// 显示菜单
showCommandMenu(filter: string): void

// 隐藏菜单
hideCommandMenu(): void

// 导航菜单（上下键）
navigateCommandMenu(direction: 'up' | 'down'): void

// 选择命令（回车）
async selectCommand(command?: AvailableCommand): Promise<void>
```

### 5.4 事件处理

**输入事件（input）：**
```typescript
this.inputEl.addEventListener('input', () => {
  const value = this.inputEl.value;
  
  if (value.startsWith('/') && value.length > 0) {
    const filter = value.slice(1);
    this.showCommandMenu(filter);
  } else {
    this.hideCommandMenu();
  }
});
```

**键盘事件（keydown）：**
```typescript
this.inputEl.addEventListener('keydown', (e) => {
  // 如果菜单显示中
  if (this.commandMenuEl) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.navigateCommandMenu('up');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.navigateCommandMenu('down');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await this.selectCommand();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.hideCommandMenu();
      return;
    }
  }
  
  // 正常的输入处理...
});
```

## 六、边界情况和错误处理

### 6.1 无可用命令
- 不显示菜单
- 输入 `/` 时无反应（或显示提示"暂无可用命令"）

### 6.2 菜单溢出
- 最大高度 300px
- 超出部分滚动
- 选中项自动滚动到可视区域

### 6.3 输入框高度变化
- Textarea 自动扩展时，重新计算菜单位置
- 或者：固定 textarea 高度，避免位置变化

### 6.4 快速输入
- 使用防抖（debounce）？- 不需要，实时过滤即可

### 6.5 会话状态
- 发送消息后，菜单自动隐藏
- AI 回复过程中，输入框可能禁用，菜单也应该隐藏

## 七、可访问性 (Accessibility)

- 菜单项添加 `role="option"`
- 菜单容器添加 `role="listbox"`
- 选中项添加 `aria-selected="true"`
- 输入框添加 `aria-expanded` 状态
- 支持完整的键盘导航

## 八、性能优化

- 命令列表较短（通常 < 10 个），不需要虚拟滚动
- 过滤算法使用简单的字符串匹配，性能足够
- 避免频繁的 DOM 操作：只在必要时重新渲染

## 九、未来优化

- [ ] 点击菜单外部关闭（需要全局点击监听）
- [ ] 命令分组（如果命令很多）
- [ ] 模糊搜索（fuzzy search）
- [ ] 命令别名（alias）
- [ ] 最近使用的命令优先显示
- [ ] 命令快捷键提示
- [ ] 命令参数的智能补全

## 十、测试清单

### 基本功能
- [ ] 输入 `/` 显示菜单
- [ ] 删除 `/` 隐藏菜单
- [ ] 输入过滤词，命令列表实时过滤
- [ ] 无匹配命令时隐藏菜单

### 键盘导航
- [ ] 上下键切换选中项
- [ ] 回车选择当前命令
- [ ] ESC 关闭菜单
- [ ] 菜单未显示时，上下键正常导航历史消息

### 鼠标操作
- [ ] 悬停高亮命令项
- [ ] 点击选择命令

### 命令执行
- [ ] 有参数的命令：预填充 + 选中提示
- [ ] 无参数的命令：自动发送
- [ ] 执行后菜单正确关闭

### 边界情况
- [ ] 无可用命令时不显示菜单
- [ ] 命令列表很长时可以滚动
- [ ] 输入框在禁用状态时菜单行为正确
- [ ] 连续对话时输入框不消失
- [ ] 多次快速输入/删除斜杠，菜单正确显示/隐藏

### 视觉和交互
- [ ] 菜单位置正确（输入框上方）
- [ ] 菜单不遮挡输入框
- [ ] 动画流畅自然
- [ ] 高亮状态清晰可见
- [ ] 响应式（窗口大小变化）

