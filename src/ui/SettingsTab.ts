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
import { McpServerModal, JsonImportModal } from "./McpServerModal";
import { setDebugMode } from "../acp/utils/logger";

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
	 * Agent 配置部分 - 平铺展示所有 Agent
	 */
	private renderAgentSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Agent 配置" });

		const currentAgentId = this.plugin.settings.currentAgentId || "claude";

		// 默认 Agent 选择
		new Setting(containerEl)
			.setName("默认 Agent")
			.setDesc("新建聊天标签页时使用的 Agent（可在聊天界面切换）")
			.addDropdown((dropdown) => {
				for (const backend of getAllBackends()) {
					dropdown.addOption(backend.id, backend.name);
				}

				dropdown
					.setValue(currentAgentId)
					.onChange(async (value) => {
						this.plugin.settings.currentAgentId =
							value as AcpBackendId;
						await this.plugin.saveSettings();
					});
			});

		// 平铺展示所有内置 Agent
		for (const backend of getAllBackends()) {
			this.renderAgentCard(containerEl, backend.id);
		}
	}

	/**
	 * 渲染单个 Agent 配置卡片
	 */
	private renderAgentCard(
		containerEl: HTMLElement,
		agentId: AcpBackendId,
	): void {
		const config = ACP_BACKENDS[agentId];
		if (!config) return;

		const cardEl = containerEl.createDiv({ cls: "acp-agent-card" });
		cardEl.style.marginTop = "1.5em";
		cardEl.style.padding = "1em";
		cardEl.style.backgroundColor = "var(--background-secondary)";
		cardEl.style.borderRadius = "8px";

		// Agent 标题和描述
		const headerEl = cardEl.createDiv({ cls: "acp-agent-card-header" });
		headerEl.createEl("strong", { text: config.name });
		if (config.description) {
			const descEl = headerEl.createEl("small");
			descEl.style.display = "block";
			descEl.style.marginTop = "0.25em";
			descEl.style.color = "var(--text-muted)";
			descEl.setText(config.description);
		}

		// CLI 路径配置
		new Setting(cardEl)
			.setName("CLI 路径")
			.setDesc(`留空使用默认: ${config.defaultCliPath || ""}`)
			.addText((text) => {
				text.inputEl.style.width = "280px";
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

		// 安装说明（折叠）
		this.renderAgentInstallGuideCollapsible(cardEl, agentId);
	}

	/**
	 * 渲染可折叠的安装说明
	 */
	private renderAgentInstallGuideCollapsible(
		containerEl: HTMLElement,
		agentId: AcpBackendId,
	): void {
		const detailsEl = containerEl.createEl("details");
		detailsEl.style.marginTop = "0.5em";

		const summaryEl = detailsEl.createEl("summary");
		summaryEl.style.cursor = "pointer";
		summaryEl.style.color = "var(--text-muted)";
		summaryEl.style.fontSize = "0.9em";
		summaryEl.setText("安装说明");

		const contentEl = detailsEl.createDiv();
		contentEl.style.marginTop = "0.5em";
		contentEl.style.paddingLeft = "1em";
		contentEl.style.fontSize = "0.85em";

		switch (agentId) {
			case "claude":
				contentEl.innerHTML = `
					<strong>方式一：npx（默认，自动更新）</strong><br>
					<code>npx @zed-industries/claude-code-acp</code><br>
					<small>需要 Node.js 18+，首次运行会自动下载</small><br><br>
					<strong>方式二：全局安装（推荐，启动更快）</strong><br>
					<small>终端运行：<code>npm install -g @zed-industries/claude-code-acp</code></small><br>
					<small>然后填写：<code>claude-code-acp</code> 或绝对路径</small><br><br>
					<strong>⚠️ 连接失败?</strong><br>
					<small>Obsidian 无法访问 shell PATH，需要使用绝对路径</small>
				`;
				break;
			case "goose":
				contentEl.innerHTML = `
					<strong>安装</strong><br>
					<small>macOS: <code>brew install block/tap/goose</code></small><br>
					<small>其他: <a href="https://github.com/block/goose">github.com/block/goose</a></small><br><br>
					<strong>⚠️ 连接失败?</strong><br>
					<small>使用绝对路径：<code>which goose</code></small>
				`;
				break;
			case "opencode":
				contentEl.innerHTML = `
					<strong>安装</strong><br>
					<small><code>npm install -g opencode-ai</code></small><br><br>
					<strong>⚠️ 连接失败?</strong><br>
					<small>使用绝对路径：<code>which opencode</code></small>
				`;
				break;
		}
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

		// 按钮容器
		const btnContainer = containerEl.createDiv({
			cls: "acp-mcp-buttons",
		});
		btnContainer.style.marginTop = "1em";
		btnContainer.style.display = "flex";
		btnContainer.style.gap = "0.5em";

		// 添加 MCP server 按钮
		const addBtn = btnContainer.createEl("button", {
			cls: "mod-cta",
			text: "+ 添加服务器",
		});
		addBtn.addEventListener("click", () => {
			this.openMcpServerModal();
		});

		// 导入 JSON 按钮
		const importBtn = btnContainer.createEl("button", {
			text: "导入 JSON",
		});
		importBtn.addEventListener("click", () => {
			this.openJsonImportModal();
		});

		// 导出 JSON 按钮
		const exportBtn = btnContainer.createEl("button", {
			text: "导出 JSON",
		});
		exportBtn.addEventListener("click", () => {
			this.exportMcpServersJson();
		});
	}

	/**
	 * 导出 MCP 服务器配置为标准 JSON 格式
	 *
	 * 输出格式：
	 * {
	 *   "mcpServers": {
	 *     "server-name": { "type": "stdio", "command": "...", ... }
	 *   }
	 * }
	 */
	private exportMcpServersJson(): void {
		const servers = this.plugin.settings.mcpServers;

		// 转换为标准格式
		const mcpServers: Record<string, Record<string, unknown>> = {};

		for (const server of servers) {
			const config: Record<string, unknown> = {
				type: server.type,
				enabled: server.enabled,
			};

			// stdio 类型
			if (server.type === "stdio") {
				config.command = server.command;
				if (server.args && server.args.length > 0) {
					config.args = server.args;
				}
			}

			// http/sse 类型
			if (server.type === "http" || server.type === "sse") {
				config.url = server.url;
				if (server.headers && server.headers.length > 0) {
					config.headers = server.headers;
				}
			}

			// 环境变量 - 转换为标准对象格式
			if (server.env && server.env.length > 0) {
				const envObj: Record<string, string> = {};
				for (const e of server.env) {
					envObj[e.name] = e.value;
				}
				config.env = envObj;
			}

			mcpServers[server.name] = config;
		}

		const output = { mcpServers };
		const json = JSON.stringify(output, null, 2);

		void navigator.clipboard.writeText(json).then(() => {
			new Notice(`已复制 ${servers.length} 个 MCP 服务器配置到剪贴板`);
		});
	}

	/**
	 * 打开 JSON 导入弹窗
	 */
	private openJsonImportModal(): void {
		const modal = new JsonImportModal(this.app, (servers, replaceAll) => {
			if (replaceAll) {
				// 全量替换模式：清空现有配置，使用导入的配置
				this.plugin.settings.mcpServers = servers;

				void this.plugin.saveSettings().then(() => {
					this.display();
					new Notice(`已替换为 ${servers.length} 个 MCP 服务器配置`);
				});
			} else {
				// 增量合并模式：按 name 去重
				const existingNames = new Map<string, number>();
				this.plugin.settings.mcpServers.forEach((s, index) => {
					existingNames.set(s.name, index);
				});

				let added = 0;
				let updated = 0;

				for (const server of servers) {
					const existingIndex = existingNames.get(server.name);
					if (existingIndex !== undefined) {
						// 更新现有（保留原有 id）
						const existingId =
							this.plugin.settings.mcpServers[existingIndex].id;
						this.plugin.settings.mcpServers[existingIndex] = {
							...server,
							id: existingId,
						};
						updated++;
					} else {
						// 添加新的
						this.plugin.settings.mcpServers.push(server);
						existingNames.set(
							server.name,
							this.plugin.settings.mcpServers.length - 1,
						);
						added++;
					}
				}

				void this.plugin.saveSettings().then(() => {
					this.display();
					new Notice(`导入完成: 新增 ${added} 个, 更新 ${updated} 个`);
				});
			}
		});

		modal.open();
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
						setDebugMode(value);
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
