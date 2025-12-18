/**
 * ACP 插件设置页面
 *
 * 提供：
 * - Agent 后端选择
 * - 工作目录配置
 * - 自定义 CLI 路径
 * - UI 偏好设置
 */

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type AcpPlugin from '../main';
import type { AcpPluginSettings } from '../main';
import { getAllBackends, getEnabledBackends } from '../acp/backends/registry';
import type { AcpBackendId } from '../acp/backends/types';

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
		containerEl.createEl('h2', { text: 'ACP Agent Client 设置' });

		// 基础设置部分
		this.displayBasicSettings(containerEl);

		// 工作目录设置
		this.displayWorkingDirectorySettings(containerEl);

		// 后端路径覆盖
		this.displayBackendPathSettings(containerEl);

		// UI 偏好设置
		this.displayUiPreferences(containerEl);

		// 关于信息
		this.displayAboutSection(containerEl);
	}

	/**
	 * 基础设置部分
	 */
	private displayBasicSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: '基础设置' });

		// 默认 Agent 后端选择
		const backends = getEnabledBackends();
		const backendOptions: Record<string, string> = {};
		backends.forEach((config) => {
			backendOptions[config.id] = config.name;
		});

		new Setting(containerEl)
			.setName('默认 Agent 后端')
			.setDesc('选择默认使用的 AI Agent 后端。连接时会自动使用此后端。')
			.addDropdown((dropdown) => {
				for (const [id, name] of Object.entries(backendOptions)) {
					dropdown.addOption(id, name);
				}
				dropdown.setValue(this.plugin.settings.selectedBackend).onChange(async (value) => {
					this.plugin.settings.selectedBackend = value as AcpBackendId;
					await this.plugin.saveSettings();
				});
			});

		// 自定义 CLI 路径（用于 custom 后端）
		new Setting(containerEl)
			.setName('自定义 Agent CLI 路径')
			.setDesc('仅在选择"自定义 Agent"后端时使用。例如: /usr/local/bin/my-agent 或 npx my-agent-package')
			.addText((text) =>
				text
					.setPlaceholder('例如: /usr/local/bin/my-agent')
					.setValue(this.plugin.settings.customCliPath)
					.onChange(async (value) => {
						this.plugin.settings.customCliPath = value;
						await this.plugin.saveSettings();
					})
			);
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
						})
				);
		}
	}

	/**
	 * 后端路径覆盖设置
	 */
	private displayBackendPathSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: '后端路径覆盖 (高级)' });

		const desc = containerEl.createDiv({ cls: 'setting-item-description' });
		desc.setText('为特定后端指定自定义 CLI 路径，留空则使用自动检测或默认路径。');

		const backends = getAllBackends();

		backends.forEach((backend) => {
			// 跳过 custom 后端
			if (backend.id === 'custom') return;

			// 跳过未启用的后端
			if (!backend.enabled) return;

			const currentPath = this.plugin.settings.backendPaths?.[backend.id] || '';
			const placeholder = backend.defaultCliPath || backend.cliCommand || '';

			new Setting(containerEl)
				.setName(`${backend.name} (${backend.id})`)
				.setDesc(backend.description || '')
				.addText((text) =>
					text
						.setPlaceholder(placeholder)
						.setValue(currentPath)
						.onChange(async (value) => {
							if (!this.plugin.settings.backendPaths) {
								this.plugin.settings.backendPaths = {};
							}
							if (value.trim() === '') {
								// 清空则删除覆盖
								delete this.plugin.settings.backendPaths[backend.id];
							} else {
								this.plugin.settings.backendPaths[backend.id] = value;
							}
							await this.plugin.saveSettings();
						})
				)
				.addExtraButton((button) =>
					button
						.setIcon('reset')
						.setTooltip('重置为默认')
						.onClick(async () => {
							if (this.plugin.settings.backendPaths) {
								delete this.plugin.settings.backendPaths[backend.id];
							}
							await this.plugin.saveSettings();
							new Notice(`已重置 ${backend.name} 路径`);
							this.display();
						})
				);
		});
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
				})
			);

		// 自动批准文件读取
		new Setting(containerEl)
			.setName('自动批准文件读取')
			.setDesc('自动批准 Agent 的文件读取请求，不显示权限弹窗（写入仍需确认）')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoApproveRead).onChange(async (value) => {
					this.plugin.settings.autoApproveRead = value;
					await this.plugin.saveSettings();
				})
			);

		// 调试模式
		new Setting(containerEl)
			.setName('调试模式')
			.setDesc('在控制台输出详细的 ACP 通信日志')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				})
			);
	}

	/**
	 * 关于部分
	 */
	private displayAboutSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: '关于' });

		const aboutDiv = containerEl.createDiv({ cls: 'acp-about-section' });

		aboutDiv.createEl('p', {
			text: 'ACP (Agent Client Protocol) 是一个标准化协议，用于连接代码编辑器与 AI 编码助手。',
		});

		aboutDiv.createEl('p', {
			text: '本插件支持以下 Agent:',
		});

		const list = aboutDiv.createEl('ul');
		const backends = getAllBackends().filter((b) => b.enabled);
		backends.forEach((backend) => {
			const li = list.createEl('li');
			li.setText(`${backend.name} - ${backend.description || ''}`);
		});

		const linkDiv = aboutDiv.createDiv({ cls: 'acp-about-links' });
		linkDiv.style.marginTop = '1em';
		linkDiv.createEl('a', {
			text: 'ACP 协议文档',
			href: 'https://github.com/agent-client-protocol/agent-client-protocol',
		});
	}
}
