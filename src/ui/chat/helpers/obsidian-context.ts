/**
 * Obsidian 上下文生成器
 *
 * 生成发送给 AI 的 Obsidian Vault 上下文信息
 */

import type { App, TFolder } from 'obsidian';

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

	constructor(
		app: App,
		getWorkingDirectory: () => string,
		config: Partial<ContextConfig> = {},
	) {
		this.app = app;
		this.getWorkingDirectory = getWorkingDirectory;
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * 生成完整的 Obsidian 上下文
	 */
	public generate(): string {
		const vault = this.app.vault;
		const parts: string[] = [];

		// 系统角色说明
		parts.push('[System Context]');
		parts.push('You are working in an Obsidian vault - a local knowledge base with interconnected markdown notes.');
		parts.push('The user may reference files using @path syntax. You can read and write files in this vault.');
		parts.push('');

		// Vault 信息
		parts.push('[Vault Info]');
		parts.push(`- Name: ${vault.getName()}`);

		// 工作目录
		try {
			const workingDir = this.getWorkingDirectory();
			parts.push(`- Path: ${workingDir}`);
		} catch {
			// 忽略
		}

		// 统计
		const stats = this.getVaultStats();
		parts.push(`- Stats: ${stats.mdFiles} notes, ${stats.otherFiles} attachments, ${stats.folders} folders`);

		// 顶级目录结构
		const topFolders = this.getTopFolders();
		if (topFolders.length > 0) {
			parts.push(`- Top folders: ${topFolders.join(', ')}`);
		}

		parts.push('');

		// 当前上下文
		parts.push('[Current Context]');
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			parts.push(`- Active file: ${activeFile.path}`);
		} else {
			parts.push('- No file currently open');
		}

		// Obsidian 语法提示
		parts.push('');
		parts.push('[Obsidian Syntax]');
		parts.push('- Internal links: [[note]] or [[folder/note]]');
		parts.push('- Tags: #tag or #nested/tag');
		parts.push('- Frontmatter: YAML between --- at file start');

		return parts.join('\n');
	}

	/**
	 * 获取 Vault 统计信息
	 */
	private getVaultStats(): { mdFiles: number; otherFiles: number; folders: number } {
		const vault = this.app.vault;
		const allFiles = vault.getFiles();
		const mdFiles = allFiles.filter(f => f.extension === 'md');
		const folders = vault.getAllLoadedFiles().filter(f => {
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
		return vault.getAllLoadedFiles()
			.filter((f): f is TFolder => {
				const isFolder = (f as TFolder).children !== undefined;
				return isFolder && f.parent?.path === '/';
			})
			.map(f => f.name)
			.slice(0, this.config.maxTopFolders);
	}
}
