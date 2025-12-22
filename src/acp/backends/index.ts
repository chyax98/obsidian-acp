/**
 * ACP Agent 后端模块导出入口
 *
 * 只支持 Claude Code
 */

// 类型定义
export type { AcpBackendId, AcpBackendConfig } from "./types";

// 后端注册表
export { ACP_BACKENDS, getBackendConfig } from "./registry";
