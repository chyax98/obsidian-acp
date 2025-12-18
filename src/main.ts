/**
 * Obsidian ACP Plugin - Agent Client Protocol 集成
 *
 * 支持连接 Claude Code、Codex、Gemini 等 AI Agent
 */

import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 插件设置接口
 */
interface AcpPluginSettings {
	/** 默认使用的 Agent 后端 */
	defaultBackend: string;
	/** 是否启用调试模式 */
	debugMode: boolean;
}

/**
 * 默认设置
 */
const DEFAULT_SETTINGS: AcpPluginSettings = {
	defaultBackend: 'claude-code',
	debugMode: false,
};

// ============================================================================
// 常量
// ============================================================================

/** ChatView 的唯一标识符 */
export const ACP_CHAT_VIEW_TYPE = 'acp-chat-view';

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
	settings: AcpPluginSettings;

	async onload() {
		console.log('ACP Plugin: 加载中...');

		// 加载设置
		await this.loadSettings();

		// TODO: T09 - 注册 ChatView
		// this.registerView(ACP_CHAT_VIEW_TYPE, (leaf) => new AcpChatView(leaf, this));

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

// ============================================================================
// 设置页面
// ============================================================================

/**
 * ACP 插件设置页面
 */
class AcpSettingTab extends PluginSettingTab {
	plugin: AcpPlugin;

	constructor(app: App, plugin: AcpPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'ACP Agent Client 设置' });

		// Agent 后端选择
		new Setting(containerEl)
			.setName('默认 Agent')
			.setDesc('选择默认使用的 AI Agent 后端')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('claude-code', 'Claude Code')
					.addOption('codex', 'Codex CLI')
					.addOption('gemini', 'Gemini CLI')
					.addOption('qwen-code', 'Qwen Code')
					.addOption('goose', 'Goose')
					.setValue(this.plugin.settings.defaultBackend)
					.onChange(async (value) => {
						this.plugin.settings.defaultBackend = value;
						await this.plugin.saveSettings();
					})
			);

		// 调试模式
		new Setting(containerEl)
			.setName('调试模式')
			.setDesc('启用后会在控制台输出详细的 ACP 通信日志')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				})
			);

		// 关于信息
		containerEl.createEl('h3', { text: '关于' });
		containerEl.createEl('p', {
			text: 'ACP (Agent Client Protocol) 是一个标准化协议，用于连接代码编辑器与 AI 编码助手。',
		});
		containerEl.createEl('p', {
			text: '支持的 Agent: Claude Code, Codex, Gemini CLI, Qwen Code, Goose 等',
		});
	}
}
