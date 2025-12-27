/**
 * MCP 服务器配置弹窗
 *
 * 用于添加和编辑 MCP 服务器配置。
 */

import type { App } from "obsidian";
import { Modal, Setting, Notice } from "obsidian";
import type { McpServerConfig } from "../main";
import { warn } from "../acp/utils/logger";

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
	private onImport: (servers: McpServerConfig[], replaceAll: boolean) => void;
	private replaceAll = false;

	constructor(
		app: App,
		onImport: (servers: McpServerConfig[], replaceAll: boolean) => void,
	) {
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
			粘贴标准 MCP 配置格式：<br>
			<pre style="font-size: 0.8em; background: var(--background-secondary); padding: 8px; border-radius: 4px; margin-top: 8px; overflow-x: auto;">
{
  "mcpServers": {
    "server-name": {
      "type": "stdio",
      "command": "npx",
      "args": ["package-name"]
    }
  }
}</pre>
		`;

		// JSON 输入区域
		const textAreaEl = contentEl.createEl("textarea", {
			cls: "acp-json-import-textarea",
			attr: { rows: "10", placeholder: "粘贴 JSON 配置..." },
		});
		textAreaEl.style.width = "100%";
		textAreaEl.style.fontFamily = "var(--font-monospace)";
		textAreaEl.style.fontSize = "0.9em";
		textAreaEl.style.resize = "vertical";

		// 导入模式选择
		const modeEl = contentEl.createDiv({ cls: "acp-import-mode" });
		modeEl.style.marginTop = "1em";

		new Setting(modeEl)
			.setName("导入模式")
			.setDesc("增量合并：按名称更新或新增；全量替换：清空后导入")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("merge", "增量合并（推荐）")
					.addOption("replace", "全量替换")
					.setValue("merge")
					.onChange((value) => {
						this.replaceAll = value === "replace";
					}),
			);

		// 错误提示区域
		const errorEl = contentEl.createDiv({
			cls: "acp-json-import-error",
		});
		errorEl.style.color = "var(--text-error)";
		errorEl.style.marginTop = "0.5em";
		errorEl.style.display = "none";

		// 按钮
		const btnEl = contentEl.createDiv({ cls: "modal-button-container" });
		btnEl.style.marginTop = "1em";

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
				const result = this.validateAndNormalize(parsed);

				if (result.servers.length === 0) {
					errorEl.textContent =
						result.errors.length > 0
							? result.errors.join("；")
							: "未找到有效的服务器配置";
					errorEl.style.display = "block";
					return;
				}

				// 如果有警告但也有有效配置，显示警告但继续
				if (result.errors.length > 0) {
					warn("[MCP Import]", result.errors);
				}

				this.onImport(result.servers, this.replaceAll);
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
	 *
	 * 支持标准 MCP 配置格式：
	 * {
	 *   "mcpServers": {
	 *     "server-name": {
	 *       "type": "stdio",
	 *       "command": "npx",
	 *       "args": ["package-name"]
	 *     }
	 *   }
	 * }
	 */
	private validateAndNormalize(parsed: unknown): {
		servers: McpServerConfig[];
		errors: string[];
	} {
		const servers: McpServerConfig[] = [];
		const errors: string[] = [];

		if (typeof parsed !== "object" || parsed === null) {
			errors.push("无效的 JSON 格式");
			return { servers, errors };
		}

		const root = parsed as Record<string, unknown>;

		// 检查是否是标准格式 { mcpServers: { ... } }
		let mcpServersObj: Record<string, unknown> | null = null;

		if (root.mcpServers && typeof root.mcpServers === "object") {
			// 标准格式
			mcpServersObj = root.mcpServers as Record<string, unknown>;
		} else if (!root.mcpServers && !Array.isArray(root)) {
			// 可能直接是 { "server-name": { ... } } 格式
			// 检查第一个值是否像服务器配置
			const firstKey = Object.keys(root)[0];
			if (firstKey && typeof root[firstKey] === "object") {
				const firstValue = root[firstKey] as Record<string, unknown>;
				if (firstValue.type || firstValue.command || firstValue.url) {
					mcpServersObj = root;
				}
			}
		}

		if (!mcpServersObj) {
			errors.push("未找到 mcpServers 配置");
			return { servers, errors };
		}

		// 遍历每个服务器配置
		for (const [serverName, serverConfig] of Object.entries(mcpServersObj)) {
			if (typeof serverConfig !== "object" || serverConfig === null) {
				errors.push(`${serverName}: 配置无效`);
				continue;
			}

			const config = serverConfig as Record<string, unknown>;
			const type = (config.type as string) || "stdio";

			// 验证类型
			if (!["stdio", "http", "sse"].includes(type)) {
				errors.push(`${serverName}: 不支持的类型 "${type}"`);
				continue;
			}

			const server: McpServerConfig = {
				id: `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
				name: serverName,
				type: type as "stdio" | "http" | "sse",
				enabled: config.enabled !== false, // 默认启用
			};

			// stdio 类型验证
			if (server.type === "stdio") {
				const command = config.command as string | undefined;
				if (!command) {
					errors.push(`${serverName}: stdio 类型必须指定 command`);
					continue;
				}
				server.command = command;
				server.args = Array.isArray(config.args)
					? (config.args as unknown[])
							.filter((arg) => typeof arg === "string")
							.map((arg) => arg as string)
					: [];
			}

			// http/sse 类型验证
			if (server.type === "http" || server.type === "sse") {
				const url = config.url as string | undefined;
				if (!url) {
					errors.push(`${serverName}: ${server.type} 类型必须指定 url`);
					continue;
				}
				// 简单的 URL 格式验证
				if (!url.startsWith("http://") && !url.startsWith("https://")) {
					errors.push(`${serverName}: url 必须以 http:// 或 https:// 开头`);
					continue;
				}
				server.url = url;

				// headers 验证
				if (config.headers) {
					if (Array.isArray(config.headers)) {
						server.headers = (config.headers as unknown[])
							.filter(
								(h): h is { name: string; value: string } =>
									typeof h === "object" &&
									h !== null &&
									typeof (h as Record<string, unknown>).name ===
										"string" &&
									typeof (h as Record<string, unknown>).value ===
										"string",
							)
							.map((h) => ({ name: h.name, value: h.value }));
					} else if (typeof config.headers === "object") {
						// 对象格式: { "Header-Name": "value" }
						const headersObj = config.headers as Record<string, unknown>;
						server.headers = Object.entries(headersObj)
							.filter(([, v]) => typeof v === "string")
							.map(([name, value]) => ({
								name,
								value: value as string,
							}));
					}
				}
			}

			// 环境变量验证 - 支持两种格式
			if (config.env) {
				if (Array.isArray(config.env)) {
					// 数组格式: [{ name: "KEY", value: "VALUE" }]
					server.env = (config.env as unknown[])
						.filter(
							(e): e is { name: string; value: string } =>
								typeof e === "object" &&
								e !== null &&
								typeof (e as Record<string, unknown>).name === "string" &&
								typeof (e as Record<string, unknown>).value === "string",
						)
						.map((e) => ({ name: e.name, value: e.value }));
				} else if (typeof config.env === "object") {
					// 对象格式: { KEY: "VALUE" } - 标准格式
					const envObj = config.env as Record<string, unknown>;
					server.env = Object.entries(envObj)
						.filter(([, v]) => typeof v === "string" || typeof v === "number")
						.map(([name, value]) => ({
							name,
							value: String(value),
						}));
				}
			}

			servers.push(server);
		}

		return { servers, errors };
	}

	public onClose(): void {
		this.contentEl.empty();
	}
}
