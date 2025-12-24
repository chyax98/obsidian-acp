/**
 * ACP 模块
 *
 * Agent Client Protocol 实现，提供与多个 AI Agent 的通信能力。
 */

// 核心模块
export {
	AcpConnection,
	type ConnectionOptions,
	type ConnectionState,
	type FileOperation,
	RequestQueue,
	type RequestHandle,
	type QueueStats,
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
} from "./core";

// 后端配置
export {
	type AcpBackendId,
	type AcpBackendConfig,
	ACP_BACKENDS,
	getBackendConfig,
} from "./backends";

// 类型定义
export * from "./types";
