/**
 * Obsidian ACP Plugin - Agent Client Protocol 集成
 *
 * 通过 ACP 协议连接 Claude Code
 */

import type { WorkspaceLeaf, Editor } from 'obsidian';
import { Plugin, Notice } from 'obsidian';
import { AcpSettingTab } from './ui/SettingsTab';
import { AcpChatView, ACP_CHAT_VIEW_TYPE } from './ui/ChatView';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 权限模式
 */
export type PermissionMode = 'interactive' | 'trustAll';

/**
 * 权限设置
 */
export interface PermissionSettings {
	/** 权限模式 */
	mode: PermissionMode;

	/**
	 * 用户选择的"始终允许"记录
	 * 键：工具名称（如 "fs/read"）
	 * 值：true（始终允许）
	 */
	alwaysAllowedTools: Record<string, boolean>;
}

/**
 * MCP 服务器配置
 */
export interface McpServerConfig {
	/** 唯一 ID */
	id: string;
	/** 服务器名称 */
	name: string;
	/** 传输类型 */
	type: 'stdio' | 'http' | 'sse';
	/** stdio: 命令 */
	command?: string;
	/** stdio: 参数 */
	args?: string[];
	/** http/sse: 服务器 URL */
	url?: string;
	/** http/sse: 请求头 */
	headers?: Array<{ name: string; value: string }>;
	/** 环境变量 */
	env?: Array<{ name: string; value: string }>;
	/** 是否启用 */
	enabled: boolean;
}

/**
 * 插件设置接口
 *
 * 专注于 Claude Code SDK 模式，简化配置。
 */
export interface AcpPluginSettings {
	/** 工作目录模式 */
	workingDir: 'vault' | 'current-note-folder' | 'custom';

	/** 自定义工作目录路径 */
	customWorkingDir?: string;

	/** 手动配置的 Agent 路径 (backendId -> path) */
	manualAgentPaths?: Record<string, string>;

	/** 自定义 API Key（留空则使用系统 Claude Code 认证）*/
	apiKey?: string;

	/** 自定义 API Base URL（留空则使用默认）*/
	apiUrl?: string;

	/** 是否显示工具调用详情 */
	showToolCallDetails: boolean;

	/** 权限配置 */
	permission: PermissionSettings;

	/** 是否启用调试模式 */
	debugMode: boolean;

	/** MCP 服务器配置 */
	mcpServers: McpServerConfig[];
}

/**
 * 默认设置
 */
const DEFAULT_SETTINGS: AcpPluginSettings = {
	workingDir: 'vault',
	customWorkingDir: undefined,
	apiKey: undefined,
	apiUrl: undefined,
	showToolCallDetails: true,
	permission: {
		mode: 'interactive',  // 默认每次询问
		alwaysAllowedTools: {},
	},
	debugMode: false,
	mcpServers: [
		{
			id: 'filesystem',
			name: 'Obsidian Filesystem',
			type: 'stdio',
			command: 'npx',
			args: [
				'@modelcontextprotocol/server-filesystem',
				'--root',
				'{VAULT_PATH}',
			],
			enabled: true,
		},
	],
};

// ============================================================================
// 主插件类
// ============================================================================

/**
 * ACP 插件主类
 *
 * 负责：
 * - 插件生命周期管理
 * - View 注册
 * - 命令注册
 * - 设置管理
 */
export default class AcpPlugin extends Plugin {
	public settings: AcpPluginSettings = DEFAULT_SETTINGS;

	public async onload(): Promise<void> {
		// 加载设置
		await this.loadSettings();

		// 注册 ChatView
		this.registerView(ACP_CHAT_VIEW_TYPE, (leaf) => new AcpChatView(leaf, this));

		// 添加打开 ACP Chat 的命令
		this.addCommand({
			id: 'open-acp-chat',
			name: '打开 ACP Chat',
			callback: () => {
				void this.activateChatView();
			},
		});

		// 添加新建 ACP Chat 窗口的命令
		this.addCommand({
			id: 'new-acp-chat',
			name: '新建 ACP Chat 窗口',
			callback: () => {
				void this.activateChatView(true);
			},
		});

		// 添加 Ribbon 图标
		this.addRibbonIcon('bot', 'ACP Agent Chat', () => {
			void this.activateChatView();
		});

		// 发送选中文本到 ACP Chat
		this.addCommand({
			id: 'send-selection-to-acp',
			name: '发送选中文本到 ACP Chat',
			editorCallback: (editor: Editor, view) => {
				const selection = editor.getSelection();
				if (!selection) {
					new Notice('未选中任何文本');
					return;
				}
				const filePath = view.file?.path;
				void this.sendSelectionToChat(selection, filePath);
			},
		});

		// 注册设置页面
		this.addSettingTab(new AcpSettingTab(this.app, this));
	}

	public onunload(): void {
	}

	/**
	 * 激活或创建 ChatView
	 * @param forceNew 如果为 true，则强制创建新窗口
	 */
	public async activateChatView(forceNew = false): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(ACP_CHAT_VIEW_TYPE);

		if (!forceNew && leaves.length > 0) {
			// 已存在且不强制新建，激活第一个
			leaf = leaves[0];
		} else {
			// 不存在或强制新建，在右侧创建新的
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: ACP_CHAT_VIEW_TYPE, active: true });
			}
		}

		if (leaf) {
			void workspace.revealLeaf(leaf);
		}
	}

	/**
	 * 发送选中文本到 ACP Chat
	 */
	private async sendSelectionToChat(text: string, filePath?: string): Promise<void> {
		// 激活 ChatView
		await this.activateChatView();

		// 获取 ChatView 实例
		const leaves = this.app.workspace.getLeavesOfType(ACP_CHAT_VIEW_TYPE);
		if (leaves.length > 0) {
			const view = leaves[0].view as AcpChatView;
			if (view && typeof view.appendText === 'function') {
				// 简单格式：在 {文件} 选中的内容
				const fileInfo = filePath ? `在 ${filePath} 选中的内容` : '选中的内容';
				const formattedText = `\n${fileInfo}:\n${text}\n`;
				view.appendText(formattedText);
				new Notice('已添加选中文本到 ACP Chat');
			}
		}
	}

	public async loadSettings(): Promise<void> {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-redundant-type-constituents
		const loadedData = (await this.loadData()) as Partial<AcpPluginSettings> | undefined;

		// 深度合并设置，确保嵌套对象正确合并
		this.settings = {
			...DEFAULT_SETTINGS,
			...loadedData,
			permission: {
				...DEFAULT_SETTINGS.permission,
				...(loadedData?.permission || {}),
			},
		};

		console.log('[ACP] 加载设置:', this.settings.permission);
	}

	public async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
