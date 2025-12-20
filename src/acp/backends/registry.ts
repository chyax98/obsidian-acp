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
 * 基于官方文档调研（2025-12-19）确认的 ACP 支持状态。
 */
export const ACP_BACKENDS: Record<AcpBackendId, AcpBackendConfig> = {
	// ========================================
	// Claude Code - ✅ 生产就绪
	// ========================================
	claude: {
		id: 'claude',
		name: 'Claude Code',
		description: 'Anthropic Claude Code (通过 Zed 官方 ACP 适配器)',
		cliCommand: 'npx',
		defaultCliPath: 'npx @zed-industries/claude-code-acp',
		authRequired: false,
		enabled: true,
		supportsStreaming: false,
		acpArgs: [], // NPM 包本身就是 ACP 适配器，无需参数
	},

	// ========================================
	// Claude Code SDK 模式 - ❌ Electron 不兼容
	// ========================================
	'claude-sdk': {
		id: 'claude-sdk',
		name: 'Claude Code (SDK)',
		description: 'SDK 直接调用模式 - Electron 环境不支持 native bindings',
		cliCommand: undefined,
		authRequired: false,
		enabled: false,
		supportsStreaming: false,
		acpArgs: [],
	},

	// ========================================
	// Kimi - ✅ 生产就绪
	// ========================================
	kimi: {
		id: 'kimi',
		name: 'Kimi CLI',
		description: 'Moonshot AI Kimi (原生 ACP 支持，中文友好)',
		cliCommand: 'kimi',
		authRequired: false,
		enabled: true,
		supportsStreaming: false,
		acpArgs: ['--acp'], // 官方参数
	},

	// ========================================
	// Codex ACP - ✅ 生产就绪
	// ========================================
	'codex-acp': {
		id: 'codex-acp',
		name: 'Codex (ACP)',
		description: 'OpenAI Codex (通过 Zed 官方 ACP 适配器)',
		cliCommand: 'npx',
		defaultCliPath: 'npx @zed-industries/codex-acp',
		authRequired: false, // 支持 OPENAI_API_KEY 或 ChatGPT 登录
		enabled: true,
		supportsStreaming: true,
		acpArgs: [], // NPM 包本身就是 ACP 适配器，无需参数
		env: {
			// 用户可以在设置中配置 OPENAI_API_KEY
		},
	},

	// ========================================
	// Goose - ✅ 生产就绪
	// ========================================
	goose: {
		id: 'goose',
		name: 'Goose',
		description: 'Block 开源 AI 编程助手 (Linux Foundation 项目)',
		cliCommand: 'goose',
		authRequired: false,
		enabled: false,
		supportsStreaming: false,
		acpArgs: ['acp'], // 子命令模式
	},

	// ========================================
	// Auggie - ✅ 生产就绪
	// ========================================
	auggie: {
		id: 'auggie',
		name: 'Augment Code',
		description: 'Augment Code CLI (v0.7.0+ 完整 ACP 支持)',
		cliCommand: 'auggie',
		authRequired: false,
		enabled: false,
		supportsStreaming: false,
		acpArgs: ['--acp'], // 官方参数
	},

	// ========================================
	// OpenCode - ✅ 生产就绪
	// ========================================
	opencode: {
		id: 'opencode',
		name: 'OpenCode',
		description: 'SST OpenCode (完整 ACP 支持)',
		cliCommand: 'opencode',
		authRequired: false,
		enabled: false,
		supportsStreaming: false,
		acpArgs: ['acp'], // 子命令模式
	},

	// ========================================
	// Gemini CLI - ✅ 生产就绪（Zed 官方首发）
	// ========================================
	gemini: {
		id: 'gemini',
		name: 'Gemini CLI',
		description: 'Google Gemini 2.5 Pro (ACP 参考实现，Google × Zed 联合发布)',
		cliCommand: 'gemini',
		defaultCliPath: 'npx @google/gemini-cli',
		authRequired: true, // 支持 OAuth、API Key、Vertex AI
		enabled: true, // ✅ 启用 - Zed 官方内置支持
		supportsStreaming: true,
		acpArgs: ['--experimental-acp'], // 实验性参数（历史原因保留）
	},

	// ========================================
	// Codex 原生 CLI - ❌ 不支持 ACP
	// ========================================
	codex: {
		id: 'codex',
		name: 'Codex CLI',
		description: 'OpenAI Codex 原生 CLI (不支持 ACP，请使用 codex-acp)',
		cliCommand: 'codex',
		authRequired: false,
		enabled: false, // 禁用 - 官方 CLI 不支持 ACP
		supportsStreaming: false,
		acpArgs: [], // 官方 CLI 无 ACP 参数
	},

	// ========================================
	// Qwen Code - ✅ 完全支持 ACP
	// ========================================
	qwen: {
		id: 'qwen',
		name: 'Qwen Code',
		description: '阿里通义千问 (完整 ACP 支持，中文友好，免费)',
		cliCommand: 'qwen',
		defaultCliPath: 'npx qwen-code',
		authRequired: false, // 免费使用，无需 API Key
		enabled: true, // ✅ 启用 - 完整 ACP 支持
		supportsStreaming: true,
		acpArgs: ['--experimental-acp'], // 官方 ACP 参数
	},

	// ========================================
	// 自定义 Agent
	// ========================================
	custom: {
		id: 'custom',
		name: '自定义 Agent',
		description: '用户配置的自定义 ACP Agent',
		cliCommand: undefined,
		authRequired: false,
		enabled: false,
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
	const backend = ACP_BACKENDS[id];
	return backend ? (backend.enabled ?? false) : false;
}

/**
 * 获取后端的 ACP 启动参数
 */
export function getBackendAcpArgs(id: AcpBackendId): string[] {
	const config = ACP_BACKENDS[id];
	return config && config.acpArgs ? config.acpArgs : DEFAULT_ACP_ARGS;
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
 * 排除 custom (用户配置)。
 */
export function getDetectableCliList(): DetectableAcpCli[] {
	return Object.entries(ACP_BACKENDS)
		.filter(([id, config]) => {
			// 排除无 CLI 命令的后端
			if (!config.cliCommand) return false;
			// 排除 custom (用户自定义后端)
			if (id === 'custom') return false;
			// 仅包含启用的后端
			return config.enabled;
		})
		.map(([id, config]) => ({
			cmd: config.cliCommand as string,
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
