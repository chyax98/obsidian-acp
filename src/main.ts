/**
 * Obsidian ACP Plugin - Agent Client Protocol 集成
 *
 * 支持连接 Claude Code、Codex、Gemini 等 AI Agent
 */

import type { WorkspaceLeaf } from 'obsidian';
import { App, Plugin } from 'obsidian';
import { AcpSettingTab } from './ui/SettingsTab';
import { AcpChatView, ACP_CHAT_VIEW_TYPE } from './ui/ChatView';
import type { AcpBackendId } from './acp/backends/types';
import { cliDetector, type AcpCliDetector } from './acp/detector';

// ============================================================================
// 类型定义
// ============================================================================

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

	/** 是否自动批准文件读取 */
	autoApproveRead: boolean;

	/** 是否启用调试模式 */
	debugMode: boolean;
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
	autoApproveRead: false,
	debugMode: false,
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
	settings: AcpPluginSettings = DEFAULT_SETTINGS;
	detector: AcpCliDetector = cliDetector;

	async onload(): Promise<void> {
		console.log('ACP Plugin: 加载中...');

		// 加载设置
		await this.loadSettings();

		// 注册 ChatView
		this.registerView(ACP_CHAT_VIEW_TYPE, (leaf) => new AcpChatView(leaf, this));

		// 添加打开 ACP Chat 的命令
		this.addCommand({
			id: 'open-acp-chat',
			name: '打开 ACP Chat',
			callback: () => this.activateChatView(),
		});

		// 添加 Ribbon 图标
		this.addRibbonIcon('bot', 'ACP Agent Chat', () => {
			this.activateChatView();
		});

		// 注册设置页面
		this.addSettingTab(new AcpSettingTab(this.app, this));

		console.log('ACP Plugin: 加载完成');
	}

	onunload() {
		console.log('ACP Plugin: 已卸载');
	}

	/**
	 * 激活或创建 ChatView
	 */
	async activateChatView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(ACP_CHAT_VIEW_TYPE);

		if (leaves.length > 0) {
			// 已存在，激活它
			leaf = leaves[0];
		} else {
			// 不存在，在右侧创建新的
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: ACP_CHAT_VIEW_TYPE, active: true });
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
