/**
 * ACP 模块
 *
 * Agent Client Protocol 实现，提供与 AI Agent CLI 工具的通信能力。
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
} from './core';

// 后端配置
export {
	type AcpBackendId,
	type AcpBackendConfig,
	type DetectableAcpCli,
	type BackendRuntimeState,
	ACP_BACKENDS,
	getBackendConfig,
	getBackendAcpArgs,
	getDetectableClis,
	getAllBackends,
	getEnabledBackends,
	isValidBackendId,
	type BackendOption,
	getBackendOptions,
} from './backends';

// CLI 检测器
export {
	cliDetector,
	detectInstalledClis,
	getDetectedAgents,
	isBackendAvailable,
	type DetectedAgent,
	type DetectionResult,
} from './detector';

// 类型定义
export * from './types';
