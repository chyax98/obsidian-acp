/**
 * MCP 服务器配置弹窗
 *
 * 用于添加和编辑 MCP 服务器配置。
 */

import type { App } from "obsidian";
import { Modal, Setting, Notice } from "obsidian";
import type { McpServerConfig } from "../main";

/**
 * MCP 服务器配置 Modal
 */
export class McpServerModal extends Modal {
	private server: McpServerConfig;
	private onSave: (server: McpServerConfig) => void;

	constructor(
		app: App,
		server: McpServerConfig | null,
		onSave: (server: McpServerConfig) => void,
	) {
		super(app);
		this.server = server || this.createEmptyServer();
		this.onSave = onSave;
	}

	/**
	 * 创建空服务器配置
	 */
	private createEmptyServer(): McpServerConfig {
		return {
			id: `mcp_${Date.now()}`,
			name: "",
			type: "stdio",
			command: "npx",
			args: [],
			enabled: true,
		};
	}

	public onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "MCP 服务器配置" });

		// 名称
		new Setting(contentEl)
			.setName("服务器名称")
			.setDesc("显示名称，例如：Filesystem, Brave Search")
			.addText((text) =>
				text.setValue(this.server.name).onChange((value) => {
					this.server.name = value;
				}),
			);

		// 类型
		new Setting(contentEl)
			.setName("传输类型")
			.setDesc(
				"stdio: 本地进程 | HTTP: 远程服务器 | SSE: Server-Sent Events",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("stdio", "stdio (本地进程)")
					.addOption("http", "HTTP (远程服务器)")
					.addOption("sse", "SSE (Server-Sent Events)")
					.setValue(this.server.type)
					.onChange((value) => {
						this.server.type = value as "stdio" | "http" | "sse";
						this.onOpen(); // 重新渲染
					}),
			);

		// stdio 配置
		if (this.server.type === "stdio") {
			new Setting(contentEl)
				.setName("命令")
				.setDesc("可执行文件或 npx 包名")
				.addText((text) =>
					text
						.setPlaceholder(
							"例如：npx 或 /usr/local/bin/mcp-server",
						)
						.setValue(this.server.command || "")
						.onChange((value) => {
							this.server.command = value;
						}),
				);

			new Setting(contentEl)
				.setName("参数")
				.setDesc("每行一个参数，支持变量: {VAULT_PATH}, {USER_HOME}")
				.addTextArea((text) => {
					text.inputEl.rows = 6;
					text.inputEl.style.width = "100%";
					text.inputEl.style.fontFamily = "var(--font-monospace)";
					text.inputEl.style.fontSize = "0.9em";
					text.setValue((this.server.args || []).join("\n")).onChange(
						(value) => {
							this.server.args = value
								.split("\n")
								.map((line) => line.trim())
								.filter((line) => line);
						},
					);
				});

			// 变量说明
			const varHintDiv = contentEl.createDiv({
				cls: "setting-item-description",
			});
			varHintDiv.style.marginTop = "0.5em";
			varHintDiv.style.padding = "0.5em";
			varHintDiv.style.backgroundColor = "var(--background-secondary)";
			varHintDiv.style.borderRadius = "4px";
			varHintDiv.innerHTML = `
				<strong>可用变量：</strong><br>
				<code>{VAULT_PATH}</code> - Vault 根目录路径<br>
				<code>{USER_HOME}</code> - 用户主目录
			`;
		}

		// http/sse 配置
		if (this.server.type === "http" || this.server.type === "sse") {
			new Setting(contentEl)
				.setName("服务器 URL")
				.setDesc("MCP 服务器的完整 URL")
				.addText((text) =>
					text
						.setPlaceholder("例如：http://localhost:3000/mcp")
						.setValue(this.server.url || "")
						.onChange((value) => {
							this.server.url = value;
						}),
				);
		}

		// 环境变量（可选）
		new Setting(contentEl)
			.setName("环境变量（可选）")
			.setDesc("每行一个，格式：KEY=VALUE")
			.addTextArea((text) => {
				text.inputEl.rows = 4;
				text.inputEl.style.width = "100%";
				text.inputEl.style.fontFamily = "var(--font-monospace)";
				text.inputEl.style.fontSize = "0.9em";

				const envLines = (this.server.env || [])
					.map((e) => `${e.name}=${e.value}`)
					.join("\n");

				text.setValue(envLines).onChange((value) => {
					const lines = value
						.split("\n")
						.filter((line) => line.trim());
					this.server.env = lines.map((line) => {
						const [name, ...valueParts] = line.split("=");
						return {
							name: name.trim(),
							value: valueParts.join("=").trim(),
						};
					});
				});
			});

		// 启用状态
		new Setting(contentEl)
			.setName("启用此服务器")
			.setDesc("启用后，Agent 可以使用此 MCP 服务器提供的工具")
			.addToggle((toggle) =>
				toggle.setValue(this.server.enabled).onChange((value) => {
					this.server.enabled = value;
				}),
			);

		// 保存和取消按钮
		const btnEl = contentEl.createDiv({ cls: "modal-button-container" });
		btnEl.style.marginTop = "1.5em";

		const saveBtn = btnEl.createEl("button", {
			cls: "mod-cta",
			text: "保存",
		});
		saveBtn.addEventListener("click", () => {
			if (this.validate()) {
				this.onSave(this.server);
				this.close();
			}
		});

		const cancelBtn = btnEl.createEl("button", { text: "取消" });
		cancelBtn.style.marginLeft = "0.5em";
		cancelBtn.addEventListener("click", () => {
			this.close();
		});
	}

	/**
	 * 验证配置
	 */
	private validate(): boolean {
		if (!this.server.name) {
			new Notice("请输入服务器名称");
			return false;
		}

		if (this.server.type === "stdio" && !this.server.command) {
			new Notice("请输入命令");
			return false;
		}

		if (
			(this.server.type === "http" || this.server.type === "sse") &&
			!this.server.url
		) {
			new Notice("请输入服务器 URL");
			return false;
		}

		return true;
	}

	public onClose(): void {
		this.contentEl.empty();
	}
}

/**
 * JSON 导入 Modal
 *
 * 支持直接粘贴 JSON 快速配置 MCP 服务器
 */
export class JsonImportModal extends Modal {
	private onImport: (servers: McpServerConfig[]) => void;

	constructor(app: App, onImport: (servers: McpServerConfig[]) => void) {
		super(app);
		this.onImport = onImport;
	}

	public onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "导入 MCP 服务器配置" });

		const descEl = contentEl.createDiv({ cls: "setting-item-description" });
		descEl.style.marginBottom = "1em";
		descEl.innerHTML = `
			粘贴 MCP 服务器配置 JSON（数组或单个对象）：<br><br>
			<code style="font-size: 0.85em; background: var(--background-secondary); padding: 2px 4px; border-radius: 3px;">
			[{ "id": "xxx", "name": "xxx", "type": "stdio", "command": "npx", "args": [...], "enabled": true }]
			</code>
		`;

		// JSON 输入区域
		const textAreaEl = contentEl.createEl("textarea", {
			cls: "acp-json-import-textarea",
			attr: { rows: "12", placeholder: '粘贴 JSON 配置...' },
		});
		textAreaEl.style.width = "100%";
		textAreaEl.style.fontFamily = "var(--font-monospace)";
		textAreaEl.style.fontSize = "0.9em";
		textAreaEl.style.resize = "vertical";

		// 错误提示区域
		const errorEl = contentEl.createDiv({
			cls: "acp-json-import-error",
		});
		errorEl.style.color = "var(--text-error)";
		errorEl.style.marginTop = "0.5em";
		errorEl.style.display = "none";

		// 按钮
		const btnEl = contentEl.createDiv({ cls: "modal-button-container" });
		btnEl.style.marginTop = "1.5em";

		const importBtn = btnEl.createEl("button", {
			cls: "mod-cta",
			text: "导入",
		});
		importBtn.addEventListener("click", () => {
			const json = textAreaEl.value.trim();
			if (!json) {
				errorEl.textContent = "请输入 JSON 配置";
				errorEl.style.display = "block";
				return;
			}

			try {
				const parsed = JSON.parse(json) as unknown;
				const servers = this.validateAndNormalize(parsed);

				if (servers.length === 0) {
					errorEl.textContent = "未找到有效的服务器配置";
					errorEl.style.display = "block";
					return;
				}

				this.onImport(servers);
				this.close();
			} catch (e) {
				errorEl.textContent = `JSON 解析错误: ${(e as Error).message}`;
				errorEl.style.display = "block";
			}
		});

		const cancelBtn = btnEl.createEl("button", { text: "取消" });
		cancelBtn.style.marginLeft = "0.5em";
		cancelBtn.addEventListener("click", () => {
			this.close();
		});
	}

	/**
	 * 验证并规范化配置
	 */
	private validateAndNormalize(parsed: unknown): McpServerConfig[] {
		const servers: McpServerConfig[] = [];

		// 支持单个对象或数组
		const items = Array.isArray(parsed) ? parsed : [parsed];

		for (const item of items) {
			if (typeof item !== "object" || item === null) {
				continue;
			}

			const obj = item as Record<string, unknown>;

			// 必需字段检查
			if (!obj.name || typeof obj.name !== "string") {
				continue;
			}

			const server: McpServerConfig = {
				id: (obj.id as string) || `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
				name: obj.name,
				type: (obj.type as "stdio" | "http" | "sse") || "stdio",
				enabled: obj.enabled !== false, // 默认启用
			};

			// stdio 类型
			if (server.type === "stdio") {
				server.command = (obj.command as string) || "npx";
				server.args = Array.isArray(obj.args)
					? (obj.args as string[])
					: [];
			}

			// http/sse 类型
			if (server.type === "http" || server.type === "sse") {
				server.url = obj.url as string;
				if (Array.isArray(obj.headers)) {
					server.headers = obj.headers as Array<{
						name: string;
						value: string;
					}>;
				}
			}

			// 环境变量
			if (Array.isArray(obj.env)) {
				server.env = obj.env as Array<{ name: string; value: string }>;
			}

			servers.push(server);
		}

		return servers;
	}

	public onClose(): void {
		this.contentEl.empty();
	}
}
