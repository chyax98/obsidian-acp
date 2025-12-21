# 权限响应格式不符合 ACP 协议

**日期**: 2025-12-20
**严重性**: 🔴 高
**状态**: ✅ 已修复
**影响范围**: Permission Manager / ACP Connection
**修复时间**: 30 分钟

---

## 问题描述

### 现象

即使在 `trustAll` 权限模式下，Agent 依然拒绝执行工具，返回错误：

```
User refused permission to run tool
```

调试日志显示：
```
[PermissionManager] mode === "trustAll": true
[PermissionManager] ✅ trustAll 模式，自动批准
[ACP Connection] 📤 PermissionManager 响应: {outcome: 'selected', optionId: 'allow-once'}
```

### 触发条件

- 权限模式设置为 `trustAll`
- 或者工具已在 `alwaysAllowedTools` 列表中
- Agent 请求任何工具权限时

### 预期行为

`trustAll` 模式下应该自动批准所有权限请求，Agent 应该能够正常执行工具。

---

## 根本原因

### 错误分析

**核心问题**: `optionId` 格式不符合 ACP 协议标准

我们实现的格式：
```typescript
optionId: 'allow-once' | 'allow-always' | 'reject-once'
```

ACP 协议期望的格式（参考 Zed claude-code-acp 实现）：
```typescript
optionId: 'allow' | 'allow_always' | 'reject'
```

**关键差异**:
1. ❌ `'allow-once'` → ✅ `'allow'` （一次性允许）
2. ❌ `'allow-always'` → ✅ `'allow_always'` （破折号 vs 下划线）
3. ❌ `'reject-once'` → ✅ `'reject'` （移除 -once 后缀）

### 相关代码

**问题代码位置 1**: `src/acp/permission-manager.ts:70`
```typescript
// ❌ 错误格式
return {
    outcome: 'selected',
    optionId: 'allow-once',  // Agent 无法识别
};
```

**问题代码位置 2**: `src/ui/PermissionModal.ts:77`
```typescript
// ❌ 错误格式
allowOnceBtn.addEventListener('click', () => {
    this.respond({ outcome: 'selected', optionId: 'allow-once' });
});
```

---

## 修复方案

### 解决思路

参考 Zed 官方 `claude-code-acp` 实现，将所有 `optionId` 格式统一为 ACP 标准格式。

**参考资料**:
- Zed ACP 实现: https://github.com/zed-industries/claude-code-acp
- ACP 协议规范: https://agentclientprotocol.com/protocol/permissions

### 代码变更

**修改文件**:
1. `src/acp/permission-manager.ts` - 修复 3 处
2. `src/ui/PermissionModal.ts` - 修复 5 处
3. `src/acp/core/connection.ts` - 修复 1 处

**关键修复 1**: PermissionManager trustAll 模式

```typescript
// ✅ 修复后
if (this.settings.mode === 'trustAll') {
    console.log('[PermissionManager] trustAll 模式，自动批准');
    return {
        outcome: 'selected',
        optionId: 'allow',  // 改为 ACP 标准格式
    };
}
```

**关键修复 2**: PermissionModal 按钮响应

```typescript
// ✅ 拒绝按钮
rejectBtn.addEventListener('click', () => {
    this.respond({ outcome: 'selected', optionId: 'reject' });
});

// ✅ 允许一次按钮
allowOnceBtn.addEventListener('click', () => {
    this.respond({ outcome: 'selected', optionId: 'allow' });
});

// ✅ 始终允许按钮
alwaysBtn.addEventListener('click', () => {
    this.respond({ outcome: 'selected', optionId: 'allow_always' });
});
```

**关键修复 3**: Connection 降级处理

```typescript
// ✅ 修复后
return {
    outcome: {
        outcome: 'selected',
        optionId: response.optionId || 'allow',  // 默认值改为 'allow'
    },
};
```

### Git Commit

```bash
git commit -m "fix: 修复权限响应格式不符合 ACP 协议和流式渲染多余换行"
```

**Commit SHA**: 查看 git log

---

## 验证方式

### 测试步骤

1. 设置权限模式为 `trustAll`
2. 开启新对话，发送需要文件读写的请求
3. 观察 Agent 是否能正常执行工具，不再提示 "User refused permission"

### 回归测试

- [x] 手动测试 - trustAll 模式正常工作
- [x] 手动测试 - interactive 模式对话框正常弹出
- [x] 手动测试 - "始终允许"功能正常记忆
- [ ] 单元测试 - 待补充
- [ ] 集成测试 - 待补充

---

## 影响评估

### 用户影响

**影响面**: 100% 用户
- 所有权限请求都受影响
- `trustAll` 模式完全不可用
- `alwaysAllowedTools` 记忆功能失效

**修复后**:
- ✅ trustAll 模式正常工作
- ✅ interactive 模式对话框正常
- ✅ 记住用户选择功能正常

### 技术债务

无新增技术债务。建议后续：
- 添加单元测试覆盖权限响应格式
- 添加 ACP 协议兼容性测试套件

---

## 经验教训

### 避免方法

1. **协议对齐检查**
   - 在实现 ACP 协议时，应该参考官方实现（如 Zed）
   - 不要自行猜测协议格式

2. **类型定义**
   - 应该定义严格的字面量类型：
   ```typescript
   type PermissionOptionId = 'allow' | 'allow_always' | 'reject';
   ```

3. **协议测试**
   - 应该添加协议兼容性测试
   - 使用真实 Agent 进行集成测试

### 相关工具

**建议添加**:
- ESLint 规则：禁止使用字符串字面量，强制使用类型常量
- 集成测试：对接真实 Agent，验证协议兼容性
- 单元测试：Mock ACP 协议，验证响应格式

---

## 相关链接

- ACP 协议文档: https://agentclientprotocol.com/protocol/permissions
- Zed claude-code-acp: https://github.com/zed-industries/claude-code-acp
- PermissionManager 实现: `src/acp/permission-manager.ts`
- PermissionModal 实现: `src/ui/PermissionModal.ts`
