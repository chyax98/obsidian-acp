/**
 * Obsidian 上下文生成器
 *
 * 生成发送给 AI 的 Obsidian Vault 上下文信息
 * 支持自定义系统提示词和预设
 */

import type { App, TFolder } from "obsidian";
import type { AcpPluginSettings, PromptPreset } from "../../../main";

/**
 * 上下文生成配置
 */
export interface ContextConfig {
	/** 显示的最大顶级目录数 */
	maxTopFolders: number;
}

const DEFAULT_CONFIG: ContextConfig = {
	maxTopFolders: 10,
};

/**
 * Obsidian 上下文生成器
 */
export class ObsidianContextGenerator {
	private app: App;
	private config: ContextConfig;
	private getWorkingDirectory: () => string;
	private getSettings: () => AcpPluginSettings;

	constructor(
		app: App,
		getWorkingDirectory: () => string,
		getSettings: () => AcpPluginSettings,
		config: Partial<ContextConfig> = {},
	) {
		this.app = app;
		this.getWorkingDirectory = getWorkingDirectory;
		this.getSettings = getSettings;
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * 生成完整的 Obsidian 上下文
	 */
	public generate(): string {
		const settings = this.getSettings();
		const parts: string[] = [];

		// Layer 1: 用户自定义系统提示词
		if (settings.systemPrompt && settings.systemPrompt.trim()) {
			parts.push("[System Instructions]");
			parts.push(settings.systemPrompt.trim());
			parts.push("");
		}

		// Layer 2: 激活的预设
		if (settings.activePresetId) {
			const preset = settings.promptPresets.find(
				(p) => p.id === settings.activePresetId,
			);
			if (preset) {
				parts.push(`[Style: ${preset.name}]`);
				parts.push(preset.content);
				parts.push("");
			}
		}

		// Vault 信息
		parts.push("[Vault Info]");
		parts.push(`- Name: ${this.app.vault.getName()}`);

		// 工作目录
		try {
			const workingDir = this.getWorkingDirectory();
			parts.push(`- Path: ${workingDir}`);
		} catch {
			// 忽略
		}

		// 当前上下文
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			parts.push(`- Active file: ${activeFile.path}`);
		}

		parts.push("");

		// Obsidian 语法提示
		parts.push("[Obsidian Syntax]");
		parts.push("- Internal links: [[note]] or [[folder/note]]");
		parts.push("- Tags: #tag or #nested/tag");
		parts.push("- Frontmatter: YAML between --- at file start");

		return parts.join("\n");
	}

	/**
	 * 获取当前激活的预设
	 */
	public getActivePreset(): PromptPreset | null {
		const settings = this.getSettings();
		if (!settings.activePresetId) return null;
		return (
			settings.promptPresets.find(
				(p) => p.id === settings.activePresetId,
			) || null
		);
	}

	/**
	 * 获取所有预设
	 */
	public getPresets(): PromptPreset[] {
		return this.getSettings().promptPresets;
	}

	/**
	 * 获取 Vault 统计信息
	 */
	private getVaultStats(): {
		mdFiles: number;
		otherFiles: number;
		folders: number;
	} {
		const vault = this.app.vault;
		const allFiles = vault.getFiles();
		const mdFiles = allFiles.filter((f) => f.extension === "md");
		const folders = vault.getAllLoadedFiles().filter((f) => {
			return (f as TFolder).children !== undefined;
		});

		return {
			mdFiles: mdFiles.length,
			otherFiles: allFiles.length - mdFiles.length,
			folders: folders.length,
		};
	}

	/**
	 * 获取顶级目录
	 */
	private getTopFolders(): string[] {
		const vault = this.app.vault;
		return vault
			.getAllLoadedFiles()
			.filter((f): f is TFolder => {
				const isFolder = (f as TFolder).children !== undefined;
				return isFolder && f.parent?.path === "/";
			})
			.map((f) => f.name)
			.slice(0, this.config.maxTopFolders);
	}
}
