/**
 * ACP Agent 后端注册表
 *
 * 包含所有支持的 Agent 后端配置和工具函数。
 */

import type { AcpBackendConfig, AcpBackendId, DetectableAcpCli } from './types';

// ============================================================================
// 默认配置常量
// ============================================================================

/** 默认 ACP 启动参数 */
const DEFAULT_ACP_ARGS = ['--experimental-acp'];

// ============================================================================
// 后端配置注册表
// ============================================================================

/**
 * 所有 ACP 后端配置
 *
 * 此插件专注于 Claude Code SDK 模式，其他 Agent 已禁用。
 * Claude Code 通过 SDK 直接调用，无需 CLI 检测。
 */
export const ACP_BACKENDS: Record<AcpBackendId, AcpBackendConfig> = {
	// ========================================
	// Claude Code - ACP 模式（通过 Zed 桥接）
	// ========================================
	claude: {
		id: 'claude',
		name: 'Claude Code',
		description: 'Anthropic Claude Code - ACP 协议（通过 Zed 桥接）',
		cliCommand: 'npx',
		defaultCliPath: 'npx @zed-industries/claude-code-acp',
		authRequired: false,
		enabled: true,
		supportsStreaming: false,
		acpArgs: [], // npx 包已包含参数
	},

	// ========================================
	// Claude Code - SDK 模式（已禁用 - Electron 不兼容）
	// ========================================
	'claude-sdk': {
		id: 'claude-sdk',
		name: 'Claude Code (SDK)',
		description: 'SDK 模式 - 在 Electron 中不兼容',
		cliCommand: undefined,
		authRequired: false,
		enabled: false, // 禁用
		supportsStreaming: false,
		acpArgs: [],
	},

	// ========================================
	// 其他 Agent
	// ========================================
	codex: {
		id: 'codex',
		name: 'Codex CLI',
		description: 'OpenAI Codex 命令行工具',
		cliCommand: 'codex',
		authRequired: false,
		enabled: true, // 启用
		supportsStreaming: false,
	},

	gemini: {
		id: 'gemini',
		name: 'Gemini CLI',
		description: 'Google Gemini 命令行工具',
		cliCommand: 'gemini',
		authRequired: true,
		enabled: false, // 已禁用
		supportsStreaming: true,
	},

	qwen: {
		id: 'qwen',
		name: 'Qwen Code',
		description: '阿里通义千问编程助手',
		cliCommand: 'qwen',
		defaultCliPath: 'npx @qwen-code/qwen-code',
		authRequired: true,
		enabled: false, // 已禁用
		supportsStreaming: true,
	},

	goose: {
		id: 'goose',
		name: 'Goose',
		description: 'Block 开源 AI 编程助手',
		cliCommand: 'goose',
		authRequired: false,
		enabled: false, // 已禁用
		supportsStreaming: false,
		acpArgs: ['acp'],
	},

	auggie: {
		id: 'auggie',
		name: 'Augment Code',
		description: 'Augment 代码助手',
		cliCommand: 'auggie',
		authRequired: false,
		enabled: false, // 已禁用
		supportsStreaming: false,
		acpArgs: ['--acp'],
	},

	kimi: {
		id: 'kimi',
		name: 'Kimi CLI',
		description: 'Moonshot Kimi 命令行工具',
		cliCommand: 'kimi',
		authRequired: false,
		enabled: true, // 重新启用测试 ACP
		supportsStreaming: false,
		acpArgs: ['--acp'],
	},

	opencode: {
		id: 'opencode',
		name: 'OpenCode',
		description: 'OpenCode 开源编程助手',
		cliCommand: 'opencode',
		authRequired: false,
		enabled: false, // 已禁用
		supportsStreaming: false,
		acpArgs: ['acp'],
	},

	custom: {
		id: 'custom',
		name: '自定义 Agent',
		description: '用户配置的自定义 ACP Agent',
		cliCommand: undefined,
		authRequired: false,
		enabled: false, // 已禁用
		supportsStreaming: false,
	},
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 获取所有启用的后端配置
 */
export function getEnabledBackends(): AcpBackendConfig[] {
	return Object.values(ACP_BACKENDS).filter((config) => config.enabled);
}

/**
 * 获取所有后端配置 (包括禁用的)
 */
export function getAllBackends(): AcpBackendConfig[] {
	return Object.values(ACP_BACKENDS);
}

/**
 * 获取指定后端配置
 */
export function getBackendConfig(id: AcpBackendId): AcpBackendConfig | undefined {
	return ACP_BACKENDS[id];
}

/**
 * 检查后端 ID 是否有效
 */
export function isValidBackendId(id: string): id is AcpBackendId {
	return id in ACP_BACKENDS;
}

/**
 * 检查后端是否启用
 */
export function isBackendEnabled(id: AcpBackendId): boolean {
	return ACP_BACKENDS[id]?.enabled ?? false;
}

/**
 * 获取后端的 ACP 启动参数
 */
export function getBackendAcpArgs(id: AcpBackendId): string[] {
	const config = ACP_BACKENDS[id];
	return config?.acpArgs ?? DEFAULT_ACP_ARGS;
}

/**
 * 获取后端的启动命令
 *
 * @param id 后端 ID
 * @param customCliPath 自定义 CLI 路径 (用于 custom 后端)
 * @returns CLI 命令和参数数组
 */
export function getBackendCommand(id: AcpBackendId, customCliPath?: string): { cmd: string; args: string[] } | null {
	const config = ACP_BACKENDS[id];
	if (!config) return null;

	// 自定义后端使用传入的路径
	if (id === 'custom') {
		if (!customCliPath) return null;
		const parts = customCliPath.split(' ');
		const cmd = parts[0];
		const baseArgs = parts.slice(1);
		return {
			cmd,
			args: [...baseArgs, ...(config.acpArgs ?? DEFAULT_ACP_ARGS)],
		};
	}

	// 优先使用 defaultCliPath，否则使用 cliCommand
	const cliPath = config.defaultCliPath ?? config.cliCommand;
	if (!cliPath) return null;

	const parts = cliPath.split(' ');
	const cmd = parts[0];
	const baseArgs = parts.slice(1);

	return {
		cmd,
		args: [...baseArgs, ...(config.acpArgs ?? DEFAULT_ACP_ARGS)],
	};
}

// ============================================================================
// CLI 检测列表
// ============================================================================

/**
 * 生成可检测的 CLI 列表
 *
 * 仅包含有 cliCommand 且已启用的后端。
 * 排除 custom (用户配置) 和 gemini (暂未支持)。
 */
export function getDetectableCliList(): DetectableAcpCli[] {
	return Object.entries(ACP_BACKENDS)
		.filter(([id, config]) => {
			// 排除无 CLI 命令的后端
			if (!config.cliCommand) return false;
			// 排除 custom 和 gemini
			if (id === 'custom' || id === 'gemini') return false;
			// 仅包含启用的后端
			return config.enabled;
		})
		.map(([id, config]) => ({
			cmd: config.cliCommand!,
			args: config.acpArgs ?? DEFAULT_ACP_ARGS,
			name: config.name,
			backendId: id as AcpBackendId,
		}));
}

/**
 * 懒加载的可检测 CLI 列表
 */
let _detectableCliList: DetectableAcpCli[] | null = null;

/**
 * 获取可检测 CLI 列表 (缓存)
 */
export function getDetectableClis(): DetectableAcpCli[] {
	if (_detectableCliList === null) {
		_detectableCliList = getDetectableCliList();
	}
	return _detectableCliList;
}

// ============================================================================
// 后端选项 (用于 UI 下拉菜单)
// ============================================================================

/**
 * 后端选项 (用于 UI)
 */
export interface BackendOption {
	value: AcpBackendId;
	label: string;
	description?: string;
}

/**
 * 获取后端选项列表 (用于设置界面下拉菜单)
 */
export function getBackendOptions(): BackendOption[] {
	return getEnabledBackends().map((config) => ({
		value: config.id,
		label: config.name,
		description: config.description,
	}));
}
