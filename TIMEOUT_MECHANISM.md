# 超时暂停/恢复机制实现总结

## 概述

参考 AionUI 的实现，为 RequestQueue 和 Connection 添加了完整的超时暂停/恢复机制，用于在权限请求等场景中暂停超时计时。

## 实现细节

### 1. RequestQueue 改进 (src/acp/core/request-queue.ts)

#### 新增字段

在 `PendingRequest` 接口中添加了以下字段：

- `isPaused: boolean` - 是否已暂停超时
- `startTime: number` - 请求开始时间
- `timeoutDuration: number` - 超时时长 (ms)
- `pauseTime?: number` - 暂停时的时间戳
- `elapsedTime: number` - 已消耗的时间 (ms)

#### 核心方法

##### `pauseTimeout(id: RequestId): boolean`

暂停指定请求的超时：

1. 清除现有的超时定时器
2. 累加已消耗时间：`elapsedTime += Date.now() - startTime`
3. 记录暂停时间戳
4. 标记为已暂停

##### `resumeTimeout(id: RequestId): boolean`

恢复指定请求的超时：

1. 计算剩余时间：`remaining = timeoutDuration - elapsedTime`
2. 如果 `remaining > 0`：
   - 更新 `startTime` 为当前时间
   - 创建新的超时定时器（使用剩余时间）
   - 标记为未暂停
   - 返回 `true`
3. 如果 `remaining <= 0`：
   - 立即拒绝请求（超时）
   - 返回 `false`

##### `pauseByMethod(method: string): number`

暂停所有匹配方法的请求超时，返回暂停的请求数。

##### `resumeByMethod(method: string): number`

恢复所有匹配方法的请求超时，返回恢复的请求数。

### 2. Connection 改进 (src/acp/core/connection.ts)

#### 新增方法

##### `pausePromptTimeouts(): void`

暂停所有 `session/prompt` 请求的超时：

```typescript
private pausePromptTimeouts(): void {
	this.requestQueue.pauseByMethod(AcpMethod.SESSION_PROMPT);
}
```

##### `resumePromptTimeouts(): void`

恢复所有 `session/prompt` 请求的超时：

```typescript
private resumePromptTimeouts(): void {
	this.requestQueue.resumeByMethod(AcpMethod.SESSION_PROMPT);
}
```

#### 在权限请求中使用

在 `handlePermissionRequest()` 中使用 finally 确保恢复：

```typescript
private async handlePermissionRequest(
	params: RequestPermissionParams,
): Promise<{ outcome: { type: string; optionId?: string } }> {
	// 暂停 prompt 超时
	this.pausePromptTimeouts();

	try {
		const outcome = await this.onPermissionRequest(params);
		return ...;
	} catch (error) {
		return { outcome: { type: 'cancelled' } };
	} finally {
		// 恢复 prompt 超时（无论成功或失败）
		this.resumePromptTimeouts();
	}
}
```

### 3. 分级超时设置

在 `sendRequest()` 中设置不同的超时时间：

```typescript
private sendRequest<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
	// 超时时间: session/prompt 2 分钟，其他 1 分钟
	const timeoutDuration = method === AcpMethod.SESSION_PROMPT ? 120000 : 60000;

	// 创建请求
	const { id, promise } = this.requestQueue.create<T>(method, timeoutDuration);
	// ...
}
```

超时时间配置：
- `session/prompt`: 120000ms (120s, 2分钟)
- 文件操作和其他: 60000ms (60s, 1分钟)

## 测试结果

所有测试通过 ✅：

1. **基本超时**: 请求在指定时间后正确超时
2. **暂停/恢复（有剩余时间）**: 暂停期间不超时，恢复后继续计时
3. **暂停/恢复（无剩余时间）**: 恢复时正确判断剩余时间
4. **按方法暂停/恢复**: 可以批量暂停/恢复特定方法的请求
5. **队列统计**: 正确统计待处理和已暂停的请求

## 关键优势

1. **精确计时**: 通过 `elapsedTime` 累加机制，确保暂停期间不计时
2. **安全恢复**: 使用 finally 确保超时恢复，避免内存泄漏
3. **批量操作**: 支持按方法批量暂停/恢复，方便管理
4. **分级超时**: 不同请求类型使用不同超时时间，更合理
5. **向后兼容**: 不影响现有代码，仅在需要时使用暂停/恢复

## 使用场景

- 权限请求时暂停 prompt 超时
- 用户交互时暂停相关请求
- 长时间操作前临时暂停超时
- 调试时延长超时时间
