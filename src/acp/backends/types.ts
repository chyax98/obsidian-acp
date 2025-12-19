/**
 * ACP Agent 后端配置类型定义
 *
 * 定义支持的 Agent 后端和配置接口。
 */

// ============================================================================
// 后端 ID 类型
// ============================================================================

/**
 * 所有支持的 ACP 后端 ID
 *
 * - claude: Claude Code (ACP 模式) - 通过 @zed-industries/claude-code-acp
 * - claude-sdk: Claude Code (SDK 模式) - Electron 不兼容
 * - codex-acp: OpenAI Codex (ACP 模式) - 通过 @zed-industries/codex-acp
 * - codex: OpenAI Codex 原生 CLI - 不支持 ACP
 * - kimi: Moonshot Kimi
 * - goose: Block Goose
 * - auggie: Augment Code
 * - opencode: SST OpenCode
 * - gemini: Google Gemini CLI
 * - qwen: 阿里 Qwen Code
 * - custom: 用户自定义
 */
export type AcpBackendId =
	| 'claude'
	| 'claude-sdk'
	| 'codex-acp'
	| 'codex'
	| 'gemini'
	| 'qwen'
	| 'goose'
	| 'auggie'
	| 'kimi'
	| 'opencode'
	| 'custom';

// ============================================================================
// 后端配置接口
// ============================================================================

/**
 * ACP 后端配置
 *
 * 定义如何启动和连接到特定的 Agent 后端。
 */
export interface AcpBackendConfig {
	/** 后端唯一标识符 */
	id: AcpBackendId;

	/** 显示名称 */
	name: string;

	/** 后端描述 */
	description?: string;

	/**
	 * CLI 可执行文件名
	 *
	 * 用于 `which` 命令检测是否安装。
	 * 例如: 'claude', 'goose', 'codex'
	 */
	cliCommand?: string;

	/**
	 * 默认 CLI 路径
	 *
	 * 完整的启动命令，可包含参数。
	 * 例如:
	 * - 'claude' (简单二进制)
	 * - 'npx @qwen-code/qwen-code' (npx 包)
	 * - '/usr/local/bin/my-agent --verbose' (完整路径)
	 */
	defaultCliPath?: string;

	/**
	 * ACP 启动参数
	 *
	 * 启用 ACP 模式的参数，不同 CLI 有不同约定:
	 * - [] (无参数) 用于 claude-code-acp, codex-acp (NPM 包本身就是 ACP 适配器)
	 * - ['--acp'] 用于 kimi, auggie
	 * - ['--experimental-acp'] 用于 gemini, qwen (实验性参数，历史原因保留)
	 * - ['acp'] 用于 goose, opencode (子命令)
	 *
	 * 注意: codex 原生 CLI 不支持 ACP，需使用 codex-acp 适配器
	 */
	acpArgs?: string[];

	/** 是否需要认证 */
	authRequired?: boolean;

	/** 是否启用 (显示在 UI 中) */
	enabled?: boolean;

	/** 是否支持流式响应 */
	supportsStreaming?: boolean;

	/**
	 * 环境变量
	 *
	 * 启动进程时传递的自定义环境变量。
	 * 与 process.env 合并。
	 */
	env?: Record<string, string>;
}

// ============================================================================
// 用户自定义配置
// ============================================================================

/**
 * 用户自定义 Agent 配置
 *
 * 用于设置界面，允许用户配置自定义 Agent。
 */
export interface CustomAgentConfig {
	/** 显示名称 */
	name: string;

	/** CLI 完整路径或命令 */
	cliPath: string;

	/** ACP 启动参数 */
	acpArgs: string[];

	/** 是否需要认证 */
	authRequired: boolean;

	/** 环境变量 */
	env?: Record<string, string>;
}

// ============================================================================
// CLI 检测相关
// ============================================================================

/**
 * 可检测的 ACP CLI 信息
 *
 * 用于自动检测用户本地安装的 CLI 工具。
 */
export interface DetectableAcpCli {
	/** CLI 可执行文件名 */
	cmd: string;

	/** ACP 启动参数 */
	args: string[];

	/** 显示名称 */
	name: string;

	/** 对应的后端 ID */
	backendId: AcpBackendId;
}

// ============================================================================
// 后端状态
// ============================================================================

/**
 * 后端检测状态
 */
export type BackendDetectionStatus = 'unknown' | 'checking' | 'installed' | 'not_installed';

/**
 * 后端运行时状态
 */
export interface BackendRuntimeState {
	/** 后端 ID */
	id: AcpBackendId;

	/** 检测状态 */
	detectionStatus: BackendDetectionStatus;

	/** CLI 完整路径 (检测到时填充) */
	cliPath?: string;

	/** 版本信息 */
	version?: string;

	/** 最后检测时间 */
	lastChecked?: number;
}
