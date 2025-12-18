/**
 * Obsidian API Mocks
 *
 * 用于单元测试的 Obsidian API 模拟
 */

import type { App, Vault, Workspace, TFile, TAbstractFile, WorkspaceLeaf } from 'obsidian';

/**
 * Mock App
 */
export class MockApp implements Partial<App> {
	public vault: MockVault;
	public workspace: MockWorkspace;

	constructor() {
		this.vault = new MockVault();
		this.workspace = new MockWorkspace();
	}
}

/**
 * Mock Vault
 */
export class MockVault implements Partial<Vault> {
	private files: TFile[] = [];

	public getMarkdownFiles(): TFile[] {
		return this.files.filter((f) => f.extension === 'md');
	}

	public getAbstractFileByPath(path: string): TAbstractFile | null {
		return this.files.find((f) => f.path === path) || null;
	}

	public async read(file: TFile): Promise<string> {
		return `# ${file.basename}\n\nMock content`;
	}

	public async modify(file: TFile, data: string): Promise<void> {
		// Mock implementation
	}

	public async create(path: string, data: string): Promise<TFile> {
		const file: Partial<TFile> = {
			path,
			basename: path.split('/').pop() || '',
			extension: path.split('.').pop() || '',
			name: path.split('/').pop() || '',
		};
		this.files.push(file as TFile);
		return file as TFile;
	}

	public async delete(file: TFile): Promise<void> {
		const index = this.files.indexOf(file);
		if (index > -1) {
			this.files.splice(index, 1);
		}
	}

	// Helper: 添加测试文件
	public addMockFile(file: Partial<TFile>): void {
		this.files.push(file as TFile);
	}

	// Helper: 清空文件
	public clearFiles(): void {
		this.files = [];
	}
}

/**
 * Mock Workspace
 */
export class MockWorkspace implements Partial<Workspace> {
	private activeLeaf: WorkspaceLeaf | null = null;

	public getActiveFile(): TFile | null {
		return null;
	}

	public getActiveViewOfType<T>(_type: new (...args: unknown[]) => T): T | null {
		return null;
	}

	public onLayoutReady(callback: () => void): void {
		// 立即执行（模拟已就绪）
		callback();
	}
}

/**
 * 创建 Mock App 实例
 */
export function createMockApp(): MockApp {
	return new MockApp();
}

/**
 * 创建 Mock Vault 实例
 */
export function createMockVault(): MockVault {
	return new MockVault();
}

/**
 * 创建测试文件
 */
export function createMockFile(path: string, content = ''): Partial<TFile> {
	const parts = path.split('/');
	const name = parts[parts.length - 1] || '';
	const ext = name.split('.').pop() || '';
	const basename = name.replace(`.${ext}`, '');

	return {
		path,
		name,
		basename,
		extension: ext,
		parent: null,
		stat: {
			ctime: Date.now(),
			mtime: Date.now(),
			size: content.length,
		},
	};
}
