/**
 * ACP 插件设置页面
 *
 * 提供：
 * - 工作目录配置
 * - Claude API Key（可选）
 * - UI 偏好设置
 *
 * 专注于 Claude Code SDK 模式，简化配置。
 */

import type { App } from 'obsidian';
import { PluginSettingTab, Setting } from 'obsidian';
import type AcpPlugin from '../main';

// ============================================================================
// 设置页面类
// ============================================================================

/**
 * ACP 插件设置页面
 */
export class AcpSettingTab extends PluginSettingTab {
	plugin: AcpPlugin;

	constructor(app: App, plugin: AcpPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// 标题
		containerEl.createEl('h2', { text: 'Claude Code 设置' });

		// 描述
		const descDiv = containerEl.createDiv({ cls: 'setting-item-description' });
		descDiv.style.marginBottom = '1.5em';
		descDiv.setText('通过 Claude Code SDK 连接，无需安装额外的 CLI 工具。');

		// API Key 配置（可选）
		this.displayApiKeySettings(containerEl);

		// 工作目录设置
		this.displayWorkingDirectorySettings(containerEl);

		// UI 偏好设置
		this.displayUiPreferences(containerEl);

		// 关于信息
		this.displayAboutSection(containerEl);
	}

	/**
	 * API Key 设置部分
	 */
	private displayApiKeySettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'API 认证（可选）' });

		const desc = containerEl.createDiv({ cls: 'setting-item-description' });
		desc.style.marginBottom = '1em';
		desc.setText('默认会使用 Claude Code 的已有认证。如需覆盖，可在此设置自定义配置。');

		// API Key 设置
		new Setting(containerEl)
			.setName('自定义 API Key')
			.setDesc('留空则使用系统 Claude Code 认证')
			.addText((text) => {
				text
					.setPlaceholder('sk-ant-...')
					.setValue(this.plugin.settings.apiKey || '')
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value || undefined;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		// API URL 设置
		new Setting(containerEl)
			.setName('自定义 API Base URL')
			.setDesc('留空则使用默认 Anthropic API (用于代理或第三方兼容服务)')
			.addText((text) => {
				text
					.setPlaceholder('https://api.anthropic.com')
					.setValue(this.plugin.settings.apiUrl || '')
					.onChange(async (value) => {
						this.plugin.settings.apiUrl = value || undefined;
						await this.plugin.saveSettings();
					});
			});
	}

	/**
	 * 工作目录设置部分
	 */
	private displayWorkingDirectorySettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: '工作目录设置' });

		const workingDirDesc = containerEl.createDiv({ cls: 'setting-item-description' });
		workingDirDesc.setText('Agent 运行的工作目录，影响文件操作的根路径。');

		// 工作目录模式选择
		new Setting(containerEl)
			.setName('工作目录模式')
			.setDesc('选择 Agent 的工作目录')
			.addDropdown((dropdown) => {
				dropdown
					.addOption('vault', 'Vault 根目录')
					.addOption('current-note-folder', '当前笔记所在文件夹')
					.addOption('custom', '自定义路径')
					.setValue(this.plugin.settings.workingDir)
					.onChange(async (value) => {
						this.plugin.settings.workingDir = value as 'vault' | 'current-note-folder' | 'custom';
						await this.plugin.saveSettings();
						// 重新渲染以显示/隐藏自定义路径输入
						this.display();
					});
			});

		// 自定义工作目录路径（仅当选择 custom 时显示）
		if (this.plugin.settings.workingDir === 'custom') {
			new Setting(containerEl)
				.setName('自定义工作目录')
				.setDesc('Agent 的工作目录绝对路径')
				.addText((text) =>
					text
						.setPlaceholder('例如: /Users/username/projects/myproject')
						.setValue(this.plugin.settings.customWorkingDir || '')
						.onChange(async (value) => {
							this.plugin.settings.customWorkingDir = value;
							await this.plugin.saveSettings();
						}),
				);
		}
	}

	/**
	 * UI 偏好设置
	 */
	private displayUiPreferences(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'UI 偏好' });

		// 显示工具调用详情
		new Setting(containerEl)
			.setName('显示工具调用详情')
			.setDesc('在聊天界面中显示 Agent 使用的工具调用详细信息')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showToolCallDetails).onChange(async (value) => {
					this.plugin.settings.showToolCallDetails = value;
					await this.plugin.saveSettings();
				}),
			);

		// 自动批准文件读取
		new Setting(containerEl)
			.setName('自动批准文件读取')
			.setDesc('自动批准 Agent 的文件读取请求，不显示权限弹窗（写入仍需确认）')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoApproveRead).onChange(async (value) => {
					this.plugin.settings.autoApproveRead = value;
					await this.plugin.saveSettings();
				}),
			);

		// 调试模式
		new Setting(containerEl)
			.setName('调试模式')
			.setDesc('在控制台输出详细的 ACP 通信日志')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				}),
			);
	}

	/**
	 * 关于部分
	 */
	private displayAboutSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: '关于' });

		const aboutDiv = containerEl.createDiv({ cls: 'acp-about-section' });

		aboutDiv.createEl('p', {
			text: '此插件通过 Claude Code SDK 连接 Anthropic Claude，为 Obsidian 提供 AI 编程助手功能。',
		});

		aboutDiv.createEl('p', {
			text: '无需安装额外的 CLI 工具，直接使用 Claude Code 的 SDK 进行通信。',
		});

		const linkDiv = aboutDiv.createDiv({ cls: 'acp-about-links' });
		linkDiv.style.marginTop = '1em';

		const claudeLink = linkDiv.createEl('a', {
			text: 'Claude Code 文档',
			href: 'https://docs.anthropic.com/claude/docs',
		});
		claudeLink.style.marginRight = '1em';

		linkDiv.createEl('a', {
			text: 'ACP 协议文档',
			href: 'https://github.com/agent-client-protocol/agent-client-protocol',
		});
	}
}
