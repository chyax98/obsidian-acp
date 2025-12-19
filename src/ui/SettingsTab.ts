/**
 * ACP 插件设置页面
 *
 * 提供：
 * - Agent 选择和配置
 * - 手动路径配置
 * - 工作目录配置
 * - UI 偏好设置
 */

import type { App } from 'obsidian';
import { PluginSettingTab, Setting, Notice } from 'obsidian';
import type AcpPlugin from '../main';
import { getEnabledBackends, ACP_BACKENDS } from '../acp/backends/registry';
import type { AcpBackendId } from '../acp/backends/types';

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
		containerEl.createEl('h2', { text: 'ACP Agent 设置' });

		// 描述
		const descDiv = containerEl.createDiv({ cls: 'setting-item-description' });
		descDiv.style.marginBottom = '1.5em';
		descDiv.setText('配置 ACP 协议的 AI 编程助手（Claude、Codex、Kimi、Qwen 等）');

		// Agent 检测和配置
		this.displayAgentSettings(containerEl);

		// 工作目录设置
		this.displayWorkingDirectorySettings(containerEl);

		// 权限管理
		this.displayPermissionSettings(containerEl);

		// UI 偏好设置
		this.displayUiPreferences(containerEl);

		// 关于信息
		this.displayAboutSection(containerEl);
	}

	/**
	 * Agent 配置部分
	 */
	private displayAgentSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Agent 配置' });

		// 检测按钮
		new Setting(containerEl)
			.setName('自动检测已安装的 Agent')
			.setDesc('扫描系统中已安装的 ACP 兼容 Agent')
			.addButton((button) => {
				button
					.setButtonText('重新检测')
					.setCta()
					.onClick(async () => {
						button.setButtonText('检测中...');
						button.setDisabled(true);

						try {
							const result = await this.plugin.detector.detect(true);
							new Notice(`检测完成：发现 ${result.agents.length} 个 Agent`);
							this.display(); // 刷新显示
						} catch (error) {
							const errMsg = error instanceof Error ? error.message : String(error);
							new Notice('检测失败：' + errMsg);
						} finally {
							button.setButtonText('重新检测');
							button.setDisabled(false);
						}
					});
			});

		// 显示检测到的 Agent
		const detectedAgents = this.plugin.detector.getDetectedAgents();
		if (detectedAgents.length > 0) {
			const detectedDiv = containerEl.createDiv({ cls: 'setting-item-description' });
			detectedDiv.style.marginBottom = '1em';
			detectedDiv.style.padding = '0.5em';
			detectedDiv.style.backgroundColor = 'var(--background-secondary)';
			detectedDiv.style.borderRadius = '4px';

			detectedDiv.createEl('strong', { text: '✅ 已检测到的 Agent：' });
			const list = detectedDiv.createEl('ul');
			list.style.marginTop = '0.5em';
			list.style.marginBottom = '0';

			for (const agent of detectedAgents) {
				const item = list.createEl('li');
				item.setText(`${agent.name} - ${agent.cliPath}`);
				if (agent.version) {
					item.createEl('span', {
						text: ` (${agent.version})`,
						cls: 'setting-item-description',
					});
				}
			}
		}

		// 找出未检测到的 Agent
		const enabledBackends = getEnabledBackends();
		const detectedBackendIds = new Set(detectedAgents.map((a) => a.backendId));
		const missingBackends = enabledBackends.filter((b) => !detectedBackendIds.has(b.id));

		// 只为未检测到的 Agent 显示手动配置
		if (missingBackends.length > 0) {
			containerEl.createEl('h4', { text: '⚠️ 未检测到的 Agent（需手动配置）' });

			for (const backend of missingBackends) {
				new Setting(containerEl)
					.setName(backend.name)
					.setDesc(backend.description || `${backend.name} CLI 命令的完整路径`)
					.addText((text) => {
						const savedPath = this.plugin.settings.manualAgentPaths?.[backend.id];
						text
							.setPlaceholder(backend.defaultCliPath || backend.cliCommand || '例如: /usr/local/bin/agent')
							.setValue(savedPath || '')
							.onChange(async (value) => {
								if (!this.plugin.settings.manualAgentPaths) {
									this.plugin.settings.manualAgentPaths = {};
								}
								if (value) {
									this.plugin.settings.manualAgentPaths[backend.id] = value;
								} else {
									delete this.plugin.settings.manualAgentPaths[backend.id];
								}
								await this.plugin.saveSettings();
							});
						text.inputEl.style.width = '100%';
					});
			}

			// 提示：如何获取路径
			const tipDiv = containerEl.createDiv({ cls: 'setting-item-description' });
			tipDiv.style.marginTop = '1em';
			tipDiv.style.padding = '0.5em';
			tipDiv.style.backgroundColor = 'var(--background-secondary)';
			tipDiv.style.borderRadius = '4px';
			tipDiv.createEl('strong', { text: '💡 提示：' });
			tipDiv.createEl('br');
			tipDiv.appendText('在终端运行 ');
			tipDiv.createEl('code', { text: 'which claude-code-acp' });
			tipDiv.appendText(' 或 ');
			tipDiv.createEl('code', { text: 'which codex' });
			tipDiv.appendText(' 获取完整路径');
		} else if (detectedAgents.length === 0) {
			// 如果一个都没检测到，显示警告
			const noAgentDiv = containerEl.createDiv({ cls: 'setting-item-description' });
			noAgentDiv.style.marginBottom = '1em';
			noAgentDiv.style.padding = '0.5em';
			noAgentDiv.style.backgroundColor = 'var(--background-modifier-error)';
			noAgentDiv.style.borderRadius = '4px';
			noAgentDiv.style.color = 'var(--text-error)';
			noAgentDiv.setText('⚠️ 未检测到任何 Agent，请先安装或手动配置路径');
		}
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
	 * 权限管理设置
	 */
	private displayPermissionSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: '权限管理' });

		// 权限模式选择
		new Setting(containerEl)
			.setName('权限模式')
			.setDesc('控制 AI Agent 如何请求文件操作权限')
			.addDropdown((dropdown) => {
				dropdown
					.addOption('interactive', '每次询问（推荐新手）')
					.addOption('trustAll', '完全信任（配合 Git 使用）')
					.setValue(this.plugin.settings.permission.mode)
					.onChange(async (value) => {
						this.plugin.settings.permission.mode = value as 'interactive' | 'trustAll';
						await this.plugin.saveSettings();

						// 显示提示
						if (value === 'trustAll') {
							new Notice('⚠️ 已开启完全信任模式，建议配合 Git 使用');
						}

						// 重新渲染以显示/隐藏重置按钮
						this.display();
					});
			});

		// 模式说明
		const modeDescDiv = containerEl.createDiv({ cls: 'setting-item-description' });
		modeDescDiv.style.marginTop = '0.5em';
		modeDescDiv.style.marginBottom = '1em';
		modeDescDiv.style.padding = '0.5em';
		modeDescDiv.style.backgroundColor = 'var(--background-secondary)';
		modeDescDiv.style.borderRadius = '4px';
		modeDescDiv.innerHTML = `
			<strong>每次询问</strong>：每个操作都弹窗确认，可选择"始终允许"特定工具<br>
			<strong>完全信任</strong>：自动批准所有操作，配合 Git 回滚保证安全
		`;

		// 重置"始终允许"记录（仅在 interactive 模式下显示）
		if (this.plugin.settings.permission.mode === 'interactive') {
			const allowedTools = this.plugin.settings.permission.alwaysAllowedTools;
			const allowedCount = Object.keys(allowedTools).length;

			new Setting(containerEl)
				.setName('重置"始终允许"记录')
				.setDesc(allowedCount > 0
					? `当前已记录 ${allowedCount} 个工具：${Object.keys(allowedTools).join(', ')}`
					: '当前没有记录任何工具')
				.addButton((button) => {
					button
						.setButtonText('清除')
						.setDisabled(allowedCount === 0)
						.onClick(async () => {
							this.plugin.settings.permission.alwaysAllowedTools = {};
							await this.plugin.saveSettings();
							new Notice('已清除所有"始终允许"记录');
							this.display(); // 刷新页面
						});
				});
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
			text: '此插件通过 ACP 协议连接各种 AI 编程助手，为 Obsidian 提供智能编码功能。',
		});

		aboutDiv.createEl('p', {
			text: '支持的 Agent：Claude Code、Codex、Kimi、Qwen、Goose、Augment 等。',
		});

		const linkDiv = aboutDiv.createDiv({ cls: 'acp-about-links' });
		linkDiv.style.marginTop = '1em';

		const acpLink = linkDiv.createEl('a', {
			text: 'ACP 协议文档',
			href: 'https://agentclientprotocol.com',
		});
		acpLink.style.marginRight = '1em';

		linkDiv.createEl('a', {
			text: 'GitHub 仓库',
			href: 'https://github.com/agent-client-protocol/agent-client-protocol',
		});
	}
}
