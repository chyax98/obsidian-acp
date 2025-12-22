/**
 * ACP 类型定义导出入口
 *
 * 统一导出所有 ACP 协议相关类型。
 *
 * @module acp/types
 */

// JSON-RPC 基础类型
export {
	JSONRPC_VERSION,
	JsonRpcErrorCode,
	type RequestId,
	type AcpRequest,
	type AcpResponse,
	type AcpNotification,
	type AcpMessage,
	type JsonRpcError,
	isAcpRequest,
	isAcpResponse,
	isAcpNotification,
	createRequest,
	createResponse,
	createErrorResponse,
} from "./jsonrpc";

// 初始化与能力类型
export {
	AcpMethod,
	type AcpMethodType,
	type MetaData,
	type FsCapabilities,
	type ClientCapabilities,
	type PromptCapabilities,
	type McpCapabilities,
	type SessionCapabilities,
	type AgentCapabilities,
	type ClientInfo,
	type AgentInfo,
	type AuthMethod,
	type InitializeParams,
	type InitializeResponse,
	type AuthenticateParams,
	type AuthenticateResponse,
	type EnvVariable,
	type SessionNewMcpServerConfig,
	type SessionNewMcpServerStdio,
	type SessionNewMcpServerHttp,
	type SessionNewMcpServerSse,
	type SessionNewParams,
} from "./initialize";

// 会话管理类型
export {
	type NewSessionParams,
	type NewSessionResponse,
	type LoadSessionParams,
	type LoadSessionResponse,
	type TextContent,
	type ImageContent,
	type AudioContent,
	type EmbeddedContext,
	type PromptContent,
	type CommandInvocation,
	type PromptParams,
	type PromptResponse,
	type StopReason,
	type CancelSessionParams,
	type AvailableModel,
	type SessionModelState,
	type AvailableMode,
	type SessionModeState,
	type SetSessionModelParams,
	type SetSessionModelResponse,
	type SetSessionModeParams,
	type SetSessionModeResponse,
	type ReadTextFileParams,
	type ReadTextFileResponse,
	type WriteTextFileParams,
	type WriteTextFileResponse,
} from "./session";

// 会话更新通知类型
export {
	SessionUpdateType,
	type SessionUpdateTypeLiteral,
	type SessionNotificationParams,
	type TextMessageContent,
	type ImageMessageContent,
	type ResourceLinkContent,
	type MessageContent,
	type AgentMessageChunkUpdateData,
	type AgentThoughtChunkUpdateData,
	type ToolCallStatus,
	type ToolCallKind,
	type ToolCallTextContent,
	type ToolCallDiffContent,
	type ToolCallTerminalContent,
	type ToolCallContent,
	type ToolCallLocation,
	type ToolCallUpdateData,
	type ToolCallStatusUpdateData,
	type PlanEntryStatus,
	type PlanEntryPriority,
	type PlanEntry,
	type PlanUpdateData,
	type CommandInput,
	type AvailableCommand,
	type AvailableCommandsUpdateData,
	type UserMessageChunkUpdateData,
	type CurrentModeUpdateData,
	type SessionUpdateData,
	isAgentMessageChunk,
	isAgentThoughtChunk,
	isToolCall,
	isToolCallUpdate,
	isPlanUpdate,
	isAvailableCommandsUpdate,
} from "./updates";

// 权限请求类型
export {
	type PermissionOptionKind,
	type PermissionOption,
	type PermissionToolCall,
	type RequestPermissionParams,
	type PermissionOutcome,
	type RequestPermissionResponse,
	type PermissionRequestData,
	createAllowOnceOption,
	createAllowAlwaysOption,
	createRejectOnceOption,
	createRejectAlwaysOption,
} from "./permissions";

// 错误处理类型
export {
	AcpErrorType,
	type AcpError,
	type AcpSuccess,
	type AcpFailure,
	type AcpResult,
	createAcpError,
	isRetryableError,
	success,
	failure,
	isSuccess,
	isFailure,
	connectionNotReadyError,
	timeoutError,
	cliNotFoundError,
	spawnFailedError,
	protocolError,
} from "./errors";
