/**
 * ACP 插件设置页面
 *
 * 提供：
 * - Agent 选择与配置 (Claude Code, Goose, OpenCode, 自定义)
 * - MCP 服务器管理
 * - 工作目录配置
 * - 权限管理
 */

import type { App } from "obsidian";
import { PluginSettingTab, Setting, Notice } from "obsidian";
import type AcpPlugin from "../main";
import type { McpServerConfig } from "../main";
import type { AcpBackendId } from "../acp/backends";
import { ACP_BACKENDS, getAllBackends } from "../acp/backends/registry";
import { McpServerModal } from "./McpServerModal";

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
		containerEl.createEl("h2", { text: "ACP Agent 设置" });

		// 描述
		const descDiv = containerEl.createDiv({
			cls: "setting-item-description",
		});
		descDiv.style.marginBottom = "1.5em";
		descDiv.setText("通过 ACP 协议连接 AI Agent");

		// Agent 配置
		this.renderAgentSection(containerEl);

		// 环境变量配置
		this.renderEnvSection(containerEl);

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
	 * Agent 配置部分 - 支持多个 Agent
	 */
	private renderAgentSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Agent 配置" });

		const currentAgentId = this.plugin.settings.currentAgentId || "claude";

		// Agent 选择下拉框
		new Setting(containerEl)
			.setName("选择 Agent")
			.setDesc("选择要使用的 ACP Agent")
			.addDropdown((dropdown) => {
				// 添加内置 Agent
				for (const backend of getAllBackends()) {
					dropdown.addOption(backend.id, backend.name);
				}
				// 添加自定义选项
				dropdown.addOption("custom", "自定义 Agent");

				dropdown
					.setValue(currentAgentId)
					.onChange(async (value) => {
						const newAgentId = value as AcpBackendId;
						const oldAgentId = this.plugin.settings.currentAgentId;

						this.plugin.settings.currentAgentId = newAgentId;
						await this.plugin.saveSettings();

						// 提示用户
						const newName = this.getAgentDisplayName(newAgentId);
						if (oldAgentId !== newAgentId) {
							new Notice(
								`已切换到 ${newName}\n返回聊天时将自动重新连接`,
								3000,
							);
						}

						this.display(); // 重新渲染
					});
			});

		// 根据选中的 Agent 显示对应配置
		if (currentAgentId === "custom") {
			this.renderCustomAgentConfig(containerEl);
		} else {
			this.renderBuiltinAgentConfig(containerEl, currentAgentId);
		}
	}

	/**
	 * 获取 Agent 显示名称
	 */
	private getAgentDisplayName(id: AcpBackendId): string {
		if (id === "custom") {
			return this.plugin.settings.customAgent?.name || "自定义 Agent";
		}
		return ACP_BACKENDS[id]?.name || id;
	}

	/**
	 * 渲染内置 Agent 配置
	 */
	private renderBuiltinAgentConfig(
		containerEl: HTMLElement,
		agentId: Exclude<AcpBackendId, "custom">,
	): void {
		const config = ACP_BACKENDS[agentId];
		if (!config) return;

		// Agent 描述
		const descDiv = containerEl.createDiv({
			cls: "setting-item-description",
		});
		descDiv.style.marginTop = "0.5em";
		descDiv.style.marginBottom = "1em";
		descDiv.style.padding = "0.5em";
		descDiv.style.backgroundColor = "var(--background-secondary)";
		descDiv.style.borderRadius = "4px";
		descDiv.innerHTML = `
			<strong>${config.name}</strong><br>
			<small>${config.description || ""}</small>
		`;

		// CLI 路径配置
		new Setting(containerEl)
			.setName("CLI 路径")
			.setDesc("自定义启动命令（留空使用默认）")
			.addText((text) => {
				text.inputEl.style.width = "300px";
				text.setPlaceholder(config.defaultCliPath || "")
					.setValue(
						this.plugin.settings.manualAgentPaths?.[agentId] || "",
					)
					.onChange(async (value) => {
						if (!this.plugin.settings.manualAgentPaths) {
							this.plugin.settings.manualAgentPaths = {};
						}
						if (value.trim()) {
							this.plugin.settings.manualAgentPaths[agentId] =
								value.trim();
						} else {
							delete this.plugin.settings.manualAgentPaths[
								agentId
							];
						}
						await this.plugin.saveSettings();
					});
			});

		// 各 Agent 的安装说明
		this.renderAgentInstallGuide(containerEl, agentId);
	}

	/**
	 * 渲染各 Agent 的安装说明
	 */
	private renderAgentInstallGuide(
		containerEl: HTMLElement,
		agentId: Exclude<AcpBackendId, "custom">,
	): void {
		const installDiv = containerEl.createDiv({
			cls: "setting-item-description",
		});
		installDiv.style.marginTop = "0.5em";
		installDiv.style.padding = "0.5em";
		installDiv.style.backgroundColor = "var(--background-secondary)";
		installDiv.style.borderRadius = "4px";

		switch (agentId) {
			case "claude":
				installDiv.innerHTML = `
					<strong>方式一：npx（默认，自动更新）</strong><br>
					<code>npx @zed-industries/claude-code-acp</code><br>
					<small>需要 Node.js 18+，首次运行会自动下载</small><br><br>
					<strong>方式二：全局安装（推荐，启动更快）</strong><br>
					<small>终端运行：<code>npm install -g @zed-industries/claude-code-acp</code></small><br>
					<small>然后填写：<code>claude-code-acp</code> 或绝对路径</small><br><br>
					<strong>⚠️ 连接失败 (ENOENT)?</strong><br>
					<small>Obsidian 无法访问 shell PATH，需要使用<strong>绝对路径</strong>：</small><br>
					<small><code>which claude-code-acp</code> 或 <code>which npx</code> 获取路径</small>
				`;
				break;
			case "goose":
				installDiv.innerHTML = `
					<strong>安装 Goose</strong><br>
					<small>macOS: <code>brew install block/tap/goose</code></small><br>
					<small>其他系统: 访问 <a href="https://github.com/block/goose">github.com/block/goose</a></small><br><br>
					<strong>验证安装</strong><br>
					<small>终端运行：<code>goose --version</code></small><br><br>
					<strong>⚠️ 连接失败?</strong><br>
					<small>使用绝对路径：<code>which goose</code> 获取路径</small>
				`;
				break;
			case "opencode":
				installDiv.innerHTML = `
					<strong>安装 OpenCode</strong><br>
					<small>npm: <code>npm install -g opencode-ai</code></small><br>
					<small>验证: <code>opencode --version</code></small><br><br>
					<strong>配置 API Key</strong><br>
					<small>首次运行 <code>opencode</code> 会引导配置，或使用 <code>opencode auth login</code></small><br><br>
					<strong>⚠️ 连接失败?</strong><br>
					<small>使用绝对路径：<code>which opencode</code> 获取路径</small>
				`;
				break;
		}
	}

	/**
	 * 渲染自定义 Agent 配置
	 */
	private renderCustomAgentConfig(containerEl: HTMLElement): void {
		const customConfig = this.plugin.settings.customAgent || {
			name: "",
			cliPath: "",
			acpArgs: [],
			authRequired: false,
		};

		// 名称
		new Setting(containerEl)
			.setName("Agent 名称")
			.setDesc("自定义 Agent 的显示名称")
			.addText((text) => {
				text.inputEl.style.width = "200px";
				text.setPlaceholder("My Agent")
					.setValue(customConfig.name)
					.onChange(async (value) => {
						if (!this.plugin.settings.customAgent) {
							this.plugin.settings.customAgent = {
								name: "",
								cliPath: "",
								acpArgs: [],
								authRequired: false,
							};
						}
						this.plugin.settings.customAgent.name = value;
						await this.plugin.saveSettings();
					});
			});

		// CLI 路径
		new Setting(containerEl)
			.setName("CLI 命令")
			.setDesc("完整的启动命令或绝对路径")
			.addText((text) => {
				text.inputEl.style.width = "300px";
				text.setPlaceholder("/path/to/my-agent")
					.setValue(customConfig.cliPath)
					.onChange(async (value) => {
						if (!this.plugin.settings.customAgent) {
							this.plugin.settings.customAgent = {
								name: "",
								cliPath: "",
								acpArgs: [],
								authRequired: false,
							};
						}
						this.plugin.settings.customAgent.cliPath = value;
						await this.plugin.saveSettings();
					});
			});

		// ACP 参数
		new Setting(containerEl)
			.setName("ACP 启动参数")
			.setDesc("启用 ACP 模式的参数，用空格分隔")
			.addText((text) => {
				text.inputEl.style.width = "200px";
				text.setPlaceholder("acp 或 --acp")
					.setValue(customConfig.acpArgs.join(" "))
					.onChange(async (value) => {
						if (!this.plugin.settings.customAgent) {
							this.plugin.settings.customAgent = {
								name: "",
								cliPath: "",
								acpArgs: [],
								authRequired: false,
							};
						}
						this.plugin.settings.customAgent.acpArgs = value
							.split(" ")
							.filter((s) => s.trim());
						await this.plugin.saveSettings();
					});
			});

		// 参数说明
		const argsHelpDiv = containerEl.createDiv({
			cls: "setting-item-description",
		});
		argsHelpDiv.style.marginTop = "0.5em";
		argsHelpDiv.style.padding = "0.5em";
		argsHelpDiv.style.backgroundColor = "var(--background-secondary)";
		argsHelpDiv.style.borderRadius = "4px";
		argsHelpDiv.innerHTML = `
			<strong>常见 ACP 参数格式</strong><br>
			<small>• <code>acp</code> - 子命令形式（如 goose, opencode）</small><br>
			<small>• <code>--acp</code> - 标志形式（如 kimi, auggie）</small><br>
			<small>• <code>--experimental-acp</code> - 实验性标志（如 gemini）</small><br>
			<small>• 留空 - NPM 适配器包（如 claude-code-acp）</small>
		`;
	}

	/**
	 * 环境变量配置部分
	 */
	private renderEnvSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "环境变量（可选）" });

		const envDescDiv = containerEl.createDiv({
			cls: "setting-item-description",
		});
		envDescDiv.style.marginBottom = "1em";
		envDescDiv.innerHTML = `
			<small>配置 Claude Code 的环境变量。<strong>留空则使用系统默认配置</strong>。</small><br>
			<small>适用于第三方 API 代理或自定义 API Key。</small>
		`;

		// API Key
		new Setting(containerEl)
			.setName("API Key")
			.setDesc("ANTHROPIC_AUTH_TOKEN - 留空使用系统 Claude Code 认证")
			.addText((text) => {
				text.inputEl.style.width = "300px";
				text.inputEl.type = "password";
				text.setPlaceholder("留空使用默认")
					.setValue(this.plugin.settings.apiKey || "")
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value.trim() || undefined;
						await this.plugin.saveSettings();
					});
			});

		// Base URL
		new Setting(containerEl)
			.setName("API Base URL")
			.setDesc("ANTHROPIC_BASE_URL - 留空使用官方 API")
			.addText((text) => {
				text.inputEl.style.width = "300px";
				text.setPlaceholder("https://api.anthropic.com")
					.setValue(this.plugin.settings.apiUrl || "")
					.onChange(async (value) => {
						this.plugin.settings.apiUrl = value.trim() || undefined;
						await this.plugin.saveSettings();
					});
			});

		// HTTP Proxy
		new Setting(containerEl)
			.setName("HTTP 代理")
			.setDesc("HTTP_PROXY / HTTPS_PROXY - 留空不使用代理")
			.addText((text) => {
				text.inputEl.style.width = "300px";
				text.setPlaceholder("http://127.0.0.1:7890")
					.setValue(this.plugin.settings.httpProxy || "")
					.onChange(async (value) => {
						this.plugin.settings.httpProxy = value.trim() || undefined;
						await this.plugin.saveSettings();
					});
			});
	}

	/**
	 * MCP 服务器管理部分
	 */
	private renderMcpSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "MCP 服务器 (工具扩展)" });

		const mcpDescDiv = containerEl.createDiv({
			cls: "setting-item-description",
		});
		mcpDescDiv.style.marginBottom = "1em";
		mcpDescDiv.setText(
			"MCP (Model Context Protocol) 服务器为 Agent 提供额外的工具能力，如文件系统访问、网络搜索等。",
		);

		const mcpListEl = containerEl.createDiv({ cls: "acp-mcp-list" });

		for (const server of this.plugin.settings.mcpServers) {
			const serverItemEl = mcpListEl.createDiv({ cls: "acp-mcp-item" });

			// 启用/禁用开关
			new Setting(serverItemEl)
				.setName(server.name)
				.setDesc(this.getMcpServerDesc(server))
				.addToggle((toggle) =>
					toggle.setValue(server.enabled).onChange(async (value) => {
						server.enabled = value;
						await this.plugin.saveSettings();
					}),
				);

			// 编辑和删除按钮
			const actionsEl = serverItemEl.createDiv({
				cls: "acp-mcp-actions",
			});

			const editBtn = actionsEl.createEl("button", { text: "编辑" });
			editBtn.addEventListener("click", () => {
				this.openMcpServerModal(server);
			});

			if (server.id !== "filesystem") {
				// 内置 filesystem 不允许删除
				const deleteBtn = actionsEl.createEl("button", {
					text: "删除",
					cls: "mod-warning",
				});
				deleteBtn.addEventListener("click", () => {
					this.plugin.settings.mcpServers =
						this.plugin.settings.mcpServers.filter(
							(s) => s.id !== server.id,
						);
					void this.plugin.saveSettings().then(() => {
						this.display(); // 重新渲染
					});
				});
			}
		}

		// 添加 MCP server 按钮
		const addBtn = containerEl.createEl("button", {
			cls: "mod-cta",
			text: "+ 添加 MCP 服务器",
		});
		addBtn.style.marginTop = "1em";

		addBtn.addEventListener("click", () => {
			this.openMcpServerModal();
		});
	}

	/**
	 * 获取 MCP 服务器描述
	 */
	private getMcpServerDesc(server: McpServerConfig): string {
		if (server.type === "stdio") {
			return `命令: ${server.command} ${(server.args || []).join(" ")}`;
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
			(updatedServer: McpServerConfig) => {
				if (server) {
					// 编辑现有服务器
					const index = this.plugin.settings.mcpServers.findIndex(
						(s) => s.id === server.id,
					);
					if (index !== -1) {
						this.plugin.settings.mcpServers[index] = updatedServer;
					}
				} else {
					// 添加新服务器
					this.plugin.settings.mcpServers.push(updatedServer);
				}

				void this.plugin.saveSettings().then(() => {
					this.display(); // 重新渲染
					new Notice("MCP 服务器配置已保存");
				});
			},
		);

		modal.open();
	}

	/**
	 * 工作目录设置部分
	 */
	private displayWorkingDirectorySettings(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "工作目录设置" });

		const workingDirDesc = containerEl.createDiv({
			cls: "setting-item-description",
		});
		workingDirDesc.setText("Agent 运行的工作目录，影响文件操作的根路径。");

		// 工作目录模式选择
		new Setting(containerEl)
			.setName("工作目录模式")
			.setDesc("选择 Agent 的工作目录")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("vault", "Vault 根目录")
					.addOption("current-note-folder", "当前笔记所在文件夹")
					.addOption("custom", "自定义路径")
					.setValue(this.plugin.settings.workingDir)
					.onChange(async (value) => {
						this.plugin.settings.workingDir = value as
							| "vault"
							| "current-note-folder"
							| "custom";
						await this.plugin.saveSettings();
						// 重新渲染以显示/隐藏自定义路径输入
						this.display();
					});
			});

		// 自定义工作目录路径（仅当选择 custom 时显示）
		if (this.plugin.settings.workingDir === "custom") {
			new Setting(containerEl)
				.setName("自定义工作目录")
				.setDesc("Agent 的工作目录绝对路径")
				.addText((text) =>
					text
						.setPlaceholder(
							"例如: /Users/username/projects/myproject",
						)
						.setValue(this.plugin.settings.customWorkingDir || "")
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
		containerEl.createEl("h3", { text: "权限管理" });

		// 权限模式选择
		new Setting(containerEl)
			.setName("权限模式")
			.setDesc("控制 AI Agent 如何请求文件操作权限")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("interactive", "每次询问（推荐新手）")
					.addOption("trustAll", "完全信任（配合 Git 使用）")
					.setValue(this.plugin.settings.permission.mode)
					.onChange(async (value) => {
						this.plugin.settings.permission.mode = value as
							| "interactive"
							| "trustAll";
						await this.plugin.saveSettings();

						// 显示提示
						if (value === "trustAll") {
							new Notice(
								"⚠️ 已开启完全信任模式，建议配合 Git 使用",
							);
						}

						// 重新渲染以显示/隐藏重置按钮
						this.display();
					});
			});

		// 模式说明
		const modeDescDiv = containerEl.createDiv({
			cls: "setting-item-description",
		});
		modeDescDiv.style.marginTop = "0.5em";
		modeDescDiv.style.marginBottom = "1em";
		modeDescDiv.style.padding = "0.5em";
		modeDescDiv.style.backgroundColor = "var(--background-secondary)";
		modeDescDiv.style.borderRadius = "4px";
		modeDescDiv.innerHTML = `
			<strong>每次询问</strong>：每个操作都弹窗确认，可选择"始终允许"特定工具<br>
			<strong>完全信任</strong>：自动批准所有操作，配合 Git 回滚保证安全
		`;

		// 已授权工具列表（仅在 interactive 模式下显示）
		if (this.plugin.settings.permission.mode === "interactive") {
			const allowedTools =
				this.plugin.settings.permission.alwaysAllowedTools;
			const toolNames = Object.keys(allowedTools);

			if (toolNames.length > 0) {
				// 工具列表容器
				const toolListContainer = containerEl.createDiv({
					cls: "acp-allowed-tools-container",
				});
				toolListContainer.createEl("h4", {
					text: "已授权工具",
					cls: "acp-allowed-tools-title",
				});

				const toolListEl = toolListContainer.createDiv({
					cls: "acp-allowed-tools-list",
				});

				for (const toolName of toolNames) {
					const toolItemEl = toolListEl.createDiv({
						cls: "acp-allowed-tool-item",
					});

					// 工具名称
					toolItemEl.createSpan({
						text: toolName,
						cls: "acp-allowed-tool-name",
					});

					// 移除按钮
					const removeBtn = toolItemEl.createEl("button", {
						text: "×",
						cls: "acp-allowed-tool-remove",
						attr: { "aria-label": "移除授权" },
					});
					removeBtn.addEventListener("click", async () => {
						delete this.plugin.settings.permission
							.alwaysAllowedTools[toolName];
						await this.plugin.saveSettings();
						new Notice(`已移除 ${toolName} 的授权`);
						this.display();
					});
				}

				// 清除全部按钮
				const clearAllBtn = toolListContainer.createEl("button", {
					text: "清除全部授权",
					cls: "acp-clear-all-btn",
				});
				clearAllBtn.addEventListener("click", async () => {
					this.plugin.settings.permission.alwaysAllowedTools = {};
					await this.plugin.saveSettings();
					new Notice("已清除所有授权");
					this.display();
				});
			} else {
				const noToolsEl = containerEl.createDiv({
					cls: "acp-no-allowed-tools",
				});
				noToolsEl.setText(
					'暂无已授权工具。当你选择"始终允许"某个工具时，它会出现在这里。',
				);
			}
		}
	}

	/**
	 * UI 偏好设置
	 */
	private displayUiPreferences(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "UI 偏好" });

		// 显示工具调用详情
		new Setting(containerEl)
			.setName("显示工具调用详情")
			.setDesc("在聊天界面中显示 Agent 使用的工具调用详细信息")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showToolCallDetails)
					.onChange(async (value) => {
						this.plugin.settings.showToolCallDetails = value;
						await this.plugin.saveSettings();
					}),
			);

		// 请求超时时间
		new Setting(containerEl)
			.setName("请求超时时间")
			.setDesc(`等待 Agent 响应的最大时间（当前: ${this.plugin.settings.promptTimeout} 秒）`)
			.addSlider((slider) =>
				slider
					.setLimits(60, 600, 30)
					.setValue(this.plugin.settings.promptTimeout)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.promptTimeout = value;
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		// 调试模式
		new Setting(containerEl)
			.setName("调试模式")
			.setDesc("在控制台输出详细的 ACP 通信日志")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debugMode)
					.onChange(async (value) => {
						this.plugin.settings.debugMode = value;
						await this.plugin.saveSettings();
					}),
			);
	}

	/**
	 * 关于部分
	 */
	private displayAboutSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "关于" });

		const aboutDiv = containerEl.createDiv({ cls: "acp-about-section" });

		aboutDiv.createEl("p", {
			text: "此插件通过 ACP 协议连接 Claude Code，为 Obsidian 提供 AI 编程助手功能。",
		});

		const linkDiv = aboutDiv.createDiv({ cls: "acp-about-links" });
		linkDiv.style.marginTop = "1em";

		const acpLink = linkDiv.createEl("a", {
			text: "ACP 协议文档",
			href: "https://agentclientprotocol.com",
		});
		acpLink.style.marginRight = "1em";

		linkDiv.createEl("a", {
			text: "Claude Code",
			href: "https://github.com/anthropics/claude-code",
		});
	}
}
