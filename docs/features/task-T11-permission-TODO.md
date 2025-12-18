# Task T11: 权限请求弹窗

**开始时间**: 2025-12-18
**执行者**: Claude-Agent-T11
**依赖**: T09 (ChatView) ✅ 已完成

---

## 任务目标

实现 Agent 权限请求的交互式弹窗，用于处理 Agent 发起的工具调用授权请求。

---

## 实施步骤

### 1. 创建 PermissionModal 类

- [x] 创建 `src/ui/PermissionModal.ts`
- [x] 继承 Obsidian `Modal` 基类
- [x] 接收 `RequestPermissionParams` 参数
- [x] 显示权限请求信息（工具名称、描述、参数）
- [x] 提供选项按钮（允许/拒绝/始终允许等）
- [x] 返回用户选择的 `PermissionOutcome`

### 2. 集成到 ChatView

- [x] 修改 `src/ui/ChatView.ts`
- [x] 在 `setupSessionCallbacks()` 添加权限请求处理
- [x] 使用 PermissionModal 显示弹窗
- [x] 根据 `settings.autoApproveRead` 自动批准读取操作
- [x] 返回用户选择结果到 SessionManager

### 3. 样式设计

- [x] 添加弹窗样式到 `styles.css`
- [x] 设计清晰的权限信息显示
- [x] 按钮样式（允许/拒绝）
- [x] 响应式布局

---

## 技术细节

### PermissionModal 接口

```typescript
class PermissionModal extends Modal {
  constructor(
    app: App,
    params: RequestPermissionParams
  );

  // 显示弹窗并等待用户选择
  async show(): Promise<PermissionOutcome>;
}
```

### ChatView 集成点

在 `setupSessionCallbacks()` 中添加：

```typescript
this.sessionManager.onPermissionRequest = async (params) => {
  // 自动批准读取（如果设置启用）
  if (this.plugin.settings.autoApproveRead && isReadOperation(params)) {
    return { type: 'selected', optionId: 'allow_once' };
  }

  // 显示弹窗
  const modal = new PermissionModal(this.app, params);
  return await modal.show();
};
```

---

## 参考文件

- **权限类型**: `src/acp/types/permissions.ts`
- **ChatView**: `src/ui/ChatView.ts`
- **设置**: `src/main.ts` (autoApproveRead)
- **Obsidian Modal API**: https://docs.obsidian.md/Reference/TypeScript+API/Modal

---

## 验收标准

- [x] PermissionModal 能正确显示权限请求信息
- [x] 用户可以选择允许/拒绝选项
- [x] ChatView 能正确接收并处理用户选择
- [x] 自动批准读取功能正常工作
- [x] 支持键盘快捷键（Enter/Escape）
- [x] 编译通过，无 TypeScript 错误（T11 代码无错误，构建失败是 T10 的 MessageRenderer.ts 问题）

---

## 状态

- [x] 任务已锁定
- [x] PermissionModal 实现完成
- [x] ChatView 集成完成
- [x] 样式添加完成
- [x] 编译验证通过（T11 代码本身无问题）
- [x] 任务完成

---

## 实现详情

### 文件清单

**新建文件**:
- `src/ui/PermissionModal.ts` - 权限请求弹窗实现

**修改文件**:
- `src/ui/ChatView.ts` - 集成权限请求处理
- `styles.css` - 添加权限弹窗样式
- `docs/features/ACP-INTEGRATION-EXECUTION.md` - 标记 T11 执行中

### 功能特性

1. **权限请求弹窗**:
   - 继承 Obsidian Modal 类
   - 显示工具调用信息（名称、类型、参数、相关文件）
   - 提供多种权限选项（允许一次、始终允许、拒绝、始终拒绝）
   - 支持键盘快捷键（Enter 允许，Escape 取消）
   - Promise 封装，等待用户选择

2. **自动批准功能**:
   - 读取 `plugin.settings.autoApproveRead` 设置
   - 如果启用，自动批准所有读取操作
   - 在聊天视图显示自动批准消息

3. **用户反馈**:
   - 显示用户选择结果（允许/拒绝/取消）
   - 在聊天视图添加系统消息记录

4. **样式设计**:
   - 清晰的信息布局
   - 响应式设计，支持移动端
   - 符合 Obsidian 主题的颜色变量
   - 按钮悬停效果和动画

### 集成点

- `ChatView.setupSessionCallbacks()` 添加 `onPermissionRequest` 回调
- 调用 `PermissionModal.show()` 显示弹窗
- 返回 `PermissionOutcome` 给 SessionManager

### 编译说明

npm run build 出现错误，但都来自 T10 的 MessageRenderer.ts，不是 T11 引入的问题：
- `MessageRenderer.ts` 中有类型错误
- `request-queue.ts` 中有迭代器相关错误（之前就存在）

T11 的代码本身没有编译错误。

---

## 注意事项

- T10 (消息渲染器) 正在同时执行，注意 ChatView.ts 可能同时被修改
- 确保不与 T10 的修改冲突
- 完成后更新执行计划标记 T11 完成
