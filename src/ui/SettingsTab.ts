/**
 * ACP 插件设置页面
 *
 * 提供：
 * - Agent 自动检测和状态显示
 * - MCP 服务器管理
 * - 工作目录配置
 * - 权限管理
 */

import type { App } from 'obsidian';
import { PluginSettingTab, Setting, Notice } from 'obsidian';
import type AcpPlugin from '../main';
import type { McpServerConfig } from '../main';
import { ACP_BACKENDS } from '../acp/backends/registry';
import type { AcpBackendId, AcpBackendConfig } from '../acp/backends/types';
import { McpServerModal } from './McpServerModal';

/**
 * ACP 插件设置页面
 */
export class AcpSettingTab extends PluginSettingTab {
	public plugin: AcpPlugin;

	constructor(app: App, plugin: AcpPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	public display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// 标题
		containerEl.createEl('h2', { text: 'ACP Agent 设置' });

		// 描述
		const descDiv = containerEl.createDiv({ cls: 'setting-item-description' });
		descDiv.style.marginBottom = '1.5em';
		descDiv.setText(
			'配置 ACP 协议的 AI 编程助手（Claude、Codex、Kimi、Qwen 等）',
		);

		// Agent 配置
		this.renderAgentSection(containerEl);

		// MCP 服务器配置
		this.renderMcpSection(containerEl);

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
	 * Agent 配置部分 - 完全重构
	 */
	private renderAgentSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Agent 配置' });

		// 全局检测按钮
		new Setting(containerEl)
			.setName('自动检测已安装的 Agent')
			.setDesc('扫描系统中已安装的 ACP 兼容 Agent')
			.addButton(button => {
				button
					.setButtonText('重新检测')
					.setCta()
					.onClick(async () => {
						button.setButtonText('检测中...');
						button.setDisabled(true);

						try {
							const result = await this.plugin.detector.detect(
								true,
								this.plugin.settings.manualAgentPaths,
							);
							new Notice(
								`检测完成：发现 ${result.agents.length} 个 Agent`,
							);
							this.display(); // 刷新显示
						} catch (error) {
							const errMsg =
								error instanceof Error ? error.message : String(error);
							new Notice('检测失败：' + errMsg);
						} finally {
							button.setButtonText('重新检测');
							button.setDisabled(false);
						}
					});
			});

		// Agent 列表容器
		const agentListEl = containerEl.createDiv({ cls: 'acp-agent-list' });

		// 遍历所有 Agent 配置
		for (const [agentId, config] of Object.entries(ACP_BACKENDS)) {
			if (!config.enabled) continue; // 跳过禁用的

			const agentItemEl = agentListEl.createDiv({ cls: 'acp-agent-item' });

			// Agent 名称和状态
			const headerEl = agentItemEl.createDiv({ cls: 'acp-agent-header' });

			headerEl.createDiv({
				cls: 'acp-agent-name',
				text: config.name,
			});

			const statusEl = headerEl.createDiv({ cls: 'acp-agent-status' });

			// 异步检测状态
			this.detectAgentStatus(agentId as AcpBackendId, config).then(status => {
				if (status.installed) {
					statusEl.textContent = `✅ 已安装${status.version ? ` (${status.version})` : ''}`;
					statusEl.style.color = 'var(--color-green)';

					// 添加测试按钮
					const testBtn = agentItemEl.createEl('button', {
						cls: 'mod-cta',
						text: '测试连接',
					});
					testBtn.style.marginTop = '8px';

					testBtn.addEventListener('click', async () => {
						testBtn.disabled = true;
						testBtn.textContent = '测试中...';

						const success = await this.testAgentConnection(
							agentId as AcpBackendId,
						);

						testBtn.disabled = false;
						testBtn.textContent = success ? '✅ 连接成功' : '❌ 连接失败';

						setTimeout(() => {
							testBtn.textContent = '测试连接';
						}, 2000);
					});
				} else {
					statusEl.textContent = '⚠️ 未安装';
					statusEl.style.color = 'var(--text-muted)';

					// 显示安装命令
					const installEl = agentItemEl.createDiv({
						cls: 'acp-agent-install',
					});
					installEl.createEl('div', {
						text: '安装命令:',
						cls: 'acp-install-label',
					});

					installEl.createEl('code', {
						text: this.getInstallCommand(config),
						cls: 'acp-install-command',
					});

					const copyBtn = installEl.createEl('button', { text: '复制' });
					copyBtn.addEventListener('click', () => {
						navigator.clipboard.writeText(this.getInstallCommand(config));
						new Notice('已复制安装命令');
					});
				}
			});

			// Agent 描述
			if (config.description) {
				agentItemEl.createDiv({
					cls: 'acp-agent-description',
					text: config.description,
				});
			}
		}
	}

	/**
	 * 检测单个 Agent 的安装状态
	 */
	private async detectAgentStatus(
		agentId: AcpBackendId,
		_config: AcpBackendConfig,
	): Promise<{
		installed: boolean;
		version?: string;
		path?: string;
	}> {
		// 从 detector 获取状态
		const detectedInfo = this.plugin.detector.getBackendInfo(agentId);

		if (detectedInfo) {
			return {
				installed: true,
				version: detectedInfo.version,
				path: detectedInfo.cliPath,
			};
		}

		// 检查手动配置
		const manualPath = this.plugin.settings.manualAgentPaths?.[agentId];
		if (manualPath) {
			// 验证手动路径是否有效
			try {
				const { promises: fs, constants } = await import('fs');
				await fs.access(manualPath, constants.X_OK);
				return {
					installed: true,
					path: manualPath,
				};
			} catch {
				// 手动路径无效
				return { installed: false };
			}
		}

		return { installed: false };
	}

	/**
	 * 测试 Agent 连接
	 */
	private async testAgentConnection(agentId: AcpBackendId): Promise<boolean> {
		try {
			// 获取 Agent 信息
			const detectedInfo = this.plugin.detector.getBackendInfo(agentId);
			if (!detectedInfo) {
				new Notice('Agent 未安装');
				return false;
			}

			// 实际测试：尝试运行 --version 命令
			const { spawn } = await import('child_process');

			return new Promise((resolve) => {
				// ✅ 修复：先定义 proc，再在 timeout 中使用
				const proc = spawn(detectedInfo.cliPath, ['--version'], {
					stdio: 'pipe',
					timeout: 10000,
				});

				const timeout = setTimeout(() => {
					proc.kill();
					new Notice(`测试超时: ${agentId}`);
					resolve(false);
				}, 10000); // 10 秒超时

				let stdout = '';
				let stderr = '';

				proc.stdout?.on('data', (data: Buffer) => {
					stdout += data.toString();
				});

				proc.stderr?.on('data', (data: Buffer) => {
					stderr += data.toString();
				});

				proc.on('close', (code: number) => {
					clearTimeout(timeout);
					if (code === 0 || stdout || stderr) {
						new Notice(`✅ ${detectedInfo.name} 可用${detectedInfo.version ? ` (${detectedInfo.version})` : ''}`);
						resolve(true);
					} else {
						new Notice(`❌ ${detectedInfo.name} 测试失败 (退出码: ${code})`);
						resolve(false);
					}
				});

				proc.on('error', (error: Error) => {
					clearTimeout(timeout);
					new Notice(`❌ 启动失败: ${error.message}`);
					resolve(false);
				});
			});
		} catch (error) {
			console.error('[Test Connection]', error);
			const errMsg = error instanceof Error ? error.message : String(error);
			new Notice(`测试失败: ${errMsg}`);
			return false;
		}
	}

	/**
	 * 获取安装命令
	 */
	private getInstallCommand(config: AcpBackendConfig): string {
		// 1. 优先使用 registry 中的 installCommand（如果存在）
		if ('installCommand' in config && typeof (config as any).installCommand === 'string') {
			return (config as any).installCommand;
		}

		// 2. 根据 command 生成安装指令
		if (config.defaultCliPath?.startsWith('npx @')) {
			return `npm install -g ${config.defaultCliPath.replace('npx ', '')}`;
		}

		// 3. Fallback: 特定 Agent 的安装命令
		switch (config.id) {
			case 'kimi':
				return 'npm install -g @moonshot-ai/kimi-cli';
			case 'qwen':
				return 'npm install -g @qwenlm/qwen-code'; // ✅ 修正包名
			case 'gemini':
				return 'npm install -g @google/gemini-cli';
			case 'goose':
				return 'brew install goose';
			case 'auggie':
				return 'npm install -g auggie';
			case 'opencode':
				return 'npm install -g opencode';
			default:
				return `# 请手动安装 ${config.name}`;
		}
	}

	/**
	 * MCP 服务器管理部分
	 */
	private renderMcpSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'MCP 服务器 (工具扩展)' });

		const mcpDescDiv = containerEl.createDiv({ cls: 'setting-item-description' });
		mcpDescDiv.style.marginBottom = '1em';
		mcpDescDiv.setText(
			'MCP (Model Context Protocol) 服务器为 Agent 提供额外的工具能力，如文件系统访问、网络搜索等。',
		);

		const mcpListEl = containerEl.createDiv({ cls: 'acp-mcp-list' });

		for (const server of this.plugin.settings.mcpServers) {
			const serverItemEl = mcpListEl.createDiv({ cls: 'acp-mcp-item' });

			// 启用/禁用开关
			new Setting(serverItemEl)
				.setName(server.name)
				.setDesc(this.getMcpServerDesc(server))
				.addToggle(toggle =>
					toggle.setValue(server.enabled).onChange(async value => {
						server.enabled = value;
						await this.plugin.saveSettings();
					}),
				);

			// 编辑和删除按钮
			const actionsEl = serverItemEl.createDiv({ cls: 'acp-mcp-actions' });

			const editBtn = actionsEl.createEl('button', { text: '编辑' });
			editBtn.addEventListener('click', () => {
				this.openMcpServerModal(server);
			});

			if (server.id !== 'filesystem') {
				// 内置 filesystem 不允许删除
				const deleteBtn = actionsEl.createEl('button', {
					text: '删除',
					cls: 'mod-warning',
				});
				deleteBtn.addEventListener('click', async () => {
					this.plugin.settings.mcpServers =
						this.plugin.settings.mcpServers.filter(s => s.id !== server.id);
					await this.plugin.saveSettings();
					this.display(); // 重新渲染
				});
			}
		}

		// 添加 MCP server 按钮
		const addBtn = containerEl.createEl('button', {
			cls: 'mod-cta',
			text: '+ 添加 MCP 服务器',
		});
		addBtn.style.marginTop = '1em';

		addBtn.addEventListener('click', () => {
			this.openMcpServerModal();
		});
	}

	/**
	 * 获取 MCP 服务器描述
	 */
	private getMcpServerDesc(server: McpServerConfig): string {
		if (server.type === 'stdio') {
			return `命令: ${server.command} ${(server.args || []).join(' ')}`;
		} else {
			return `URL: ${server.url}`;
		}
	}

	/**
	 * 打开 MCP 服务器配置弹窗
	 */
	private openMcpServerModal(server?: McpServerConfig): void {
		const modal = new McpServerModal(
			this.app,
			server || null,
			async (updatedServer: McpServerConfig) => {
				if (server) {
					// 编辑现有服务器
					const index = this.plugin.settings.mcpServers.findIndex(
						s => s.id === server.id,
					);
					if (index !== -1) {
						this.plugin.settings.mcpServers[index] = updatedServer;
					}
				} else {
					// 添加新服务器
					this.plugin.settings.mcpServers.push(updatedServer);
				}

				await this.plugin.saveSettings();
				this.display(); // 重新渲染
				new Notice('MCP 服务器配置已保存');
			},
		);

		modal.open();
	}

	/**
	 * 工作目录设置部分
	 */
	private displayWorkingDirectorySettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: '工作目录设置' });

		const workingDirDesc = containerEl.createDiv({
			cls: 'setting-item-description',
		});
		workingDirDesc.setText('Agent 运行的工作目录，影响文件操作的根路径。');

		// 工作目录模式选择
		new Setting(containerEl)
			.setName('工作目录模式')
			.setDesc('选择 Agent 的工作目录')
			.addDropdown(dropdown => {
				dropdown
					.addOption('vault', 'Vault 根目录')
					.addOption('current-note-folder', '当前笔记所在文件夹')
					.addOption('custom', '自定义路径')
					.setValue(this.plugin.settings.workingDir)
					.onChange(async value => {
						this.plugin.settings.workingDir = value as
							| 'vault'
							| 'current-note-folder'
							| 'custom';
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
				.addText(text =>
					text
						.setPlaceholder('例如: /Users/username/projects/myproject')
						.setValue(this.plugin.settings.customWorkingDir || '')
						.onChange(async value => {
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
			.addDropdown(dropdown => {
				dropdown
					.addOption('interactive', '每次询问（推荐新手）')
					.addOption('trustAll', '完全信任（配合 Git 使用）')
					.setValue(this.plugin.settings.permission.mode)
					.onChange(async value => {
						this.plugin.settings.permission.mode = value as
							| 'interactive'
							| 'trustAll';
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
				.setDesc(
					allowedCount > 0
						? `当前已记录 ${allowedCount} 个工具：${Object.keys(allowedTools).join(', ')}`
						: '当前没有记录任何工具',
				)
				.addButton(button => {
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
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.showToolCallDetails)
					.onChange(async value => {
						this.plugin.settings.showToolCallDetails = value;
						await this.plugin.saveSettings();
					}),
			);

		// 调试模式
		new Setting(containerEl)
			.setName('调试模式')
			.setDesc('在控制台输出详细的 ACP 通信日志')
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.debugMode).onChange(async value => {
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
