/**
 * ACP 连接相关类型定义
 */

import type { AcpBackendId } from '../backends';
import type { PermissionSettings } from '../../main';

/**
 * 文件操作信息
 */
export interface FileOperation {
	method: string;
	path: string;
	content?: string;
	sessionId: string;
}

/**
 * MCP 服务器配置
 */
export interface McpServerConfig {
	id: string;
	name: string;
	type: 'stdio' | 'http' | 'sse';
	command?: string;
	args?: string[];
	url?: string;
	headers?: Array<{ name: string; value: string }>;
	env?: Array<{ name: string; value: string }>;
	enabled: boolean;
}

/**
 * 连接选项
 */
export interface ConnectionOptions {
	/** 后端 ID */
	backendId: AcpBackendId;
	/** CLI 路径 (custom 后端必需) */
	cliPath?: string;
	/** 工作目录 */
	workingDir?: string;
	/** ACP 启动参数 */
	acpArgs?: string[];
	/** 自定义环境变量 */
	env?: Record<string, string>;
	/** Obsidian App 实例 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	app?: any;
	/** 权限设置 */
	permissionSettings?: PermissionSettings;
	/** 保存设置回调 */
	saveSettings?: () => Promise<void>;
	/** MCP 服务器配置 */
	mcpServers?: McpServerConfig[];
}

/**
 * 连接状态
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
