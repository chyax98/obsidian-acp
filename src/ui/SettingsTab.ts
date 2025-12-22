/**
 * ACP 插件设置页面
 *
 * 提供：
 * - Claude Code 配置
 * - MCP 服务器管理
 * - 工作目录配置
 * - 权限管理
 */

import type { App } from "obsidian";
import { PluginSettingTab, Setting, Notice } from "obsidian";
import type AcpPlugin from "../main";
import type { McpServerConfig } from "../main";
import { ACP_BACKENDS } from "../acp/backends/registry";
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
		descDiv.setText("通过 ACP 协议连接 Claude Code");

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
	 * Agent 配置部分 - 只显示 Claude Code
	 */
	private renderAgentSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Agent 配置" });

		const config = ACP_BACKENDS.claude;

		// Claude Code 配置
		new Setting(containerEl)
			.setName(config.name)
			.setDesc("自定义启动命令（留空使用默认）")
			.addText((text) => {
				text.inputEl.style.width = "300px";
				text.setPlaceholder(config.defaultCliPath || "")
					.setValue(
						this.plugin.settings.manualAgentPaths?.claude || "",
					)
					.onChange(async (value) => {
						if (!this.plugin.settings.manualAgentPaths) {
							this.plugin.settings.manualAgentPaths = {};
						}
						if (value.trim()) {
							this.plugin.settings.manualAgentPaths.claude =
								value.trim();
						} else {
							delete this.plugin.settings.manualAgentPaths.claude;
						}
						await this.plugin.saveSettings();
					});
			});

		// 安装说明
		const installDiv = containerEl.createDiv({
			cls: "setting-item-description",
		});
		installDiv.style.marginTop = "0.5em";
		installDiv.style.padding = "0.5em";
		installDiv.style.backgroundColor = "var(--background-secondary)";
		installDiv.style.borderRadius = "4px";
		installDiv.innerHTML = `
			<strong>默认命令:</strong> <code>npx @zed-industries/claude-code-acp</code><br>
			<small>需要 Node.js 18+，首次运行会自动安装</small><br><br>
			<strong>⚠️ 如果连接失败 (ENOENT):</strong><br>
			<small>Obsidian 无法访问 shell 环境变量，需要使用 <strong>绝对路径</strong>。</small><br>
			<small>在终端运行 <code>which npx</code> 获取路径，然后填写：</small><br>
			<code>/完整路径/npx @zed-industries/claude-code-acp</code>
		`;
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
