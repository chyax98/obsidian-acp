/**
 * ACP Core 模块
 *
 * 导出 ACP 连接核心类和相关类型。
 */

export {
	AcpConnection,
	type ConnectionOptions,
	type ConnectionState,
	type FileOperation,
} from './connection';

export {
	RequestQueue,
	type RequestHandle,
	type QueueStats,
} from './request-queue';

export {
	SessionManager,
	type SessionManagerConfig,
	type SessionState,
	type StopReason,
	type Message,
	type MessageRole,
	type ToolCall,
	type ToolCallStatus,
	type Turn,
	type PlanEntry,
} from './session-manager';
