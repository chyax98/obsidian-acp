/**
 * ACP Agent 后端模块导出入口
 *
 * @module acp/backends
 */

// 类型定义
export type {
	AcpBackendId,
	AcpBackendConfig,
	CustomAgentConfig,
	DetectableAcpCli,
	BackendDetectionStatus,
	BackendRuntimeState,
} from './types';

// 后端注册表与工具函数
export {
	ACP_BACKENDS,
	getEnabledBackends,
	getAllBackends,
	getBackendConfig,
	isValidBackendId,
	isBackendEnabled,
	getBackendAcpArgs,
	getBackendCommand,
	getDetectableCliList,
	getDetectableClis,
	getBackendOptions,
	type BackendOption,
} from './registry';
