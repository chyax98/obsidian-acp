/**
 * ACP Agent 后端模块导出入口
 *
 * 支持多个 ACP Agent: Claude Code, Goose, OpenCode
 */

// 类型定义
export type {
	AcpBackendId,
	AcpBackendConfig,
	DetectableAcpCli,
	BackendDetectionStatus,
	BackendRuntimeState,
} from "./types";

// 后端注册表
export {
	ACP_BACKENDS,
	getBackendConfig,
	getBackendAcpArgs,
	getBackendStartCommand,
	getAllBackends,
	isBuiltinBackend,
} from "./registry";
