/**
 * Minimal runtime mock for the `obsidian` module.
 *
 * The real `obsidian` npm package is types-only (no JS entrypoint), so Jest
 * needs a runtime implementation for unit tests that import from "obsidian".
 */

type MockChild = Record<string, unknown> & {
	children?: MockChild[];
};

function createMockElement(): MockChild {
	const el: MockChild = {
		children: [],
		style: {},
		classList: new Set<string>(),
		empty() {
			this.children = [];
		},
		addClass(cls: string) {
			(this.classList as Set<string>).add(cls);
		},
		removeClass(cls: string) {
			(this.classList as Set<string>).delete(cls);
		},
		toggleClass(cls: string, force?: boolean) {
			const set = this.classList as Set<string>;
			if (force === undefined) {
				if (set.has(cls)) set.delete(cls);
				else set.add(cls);
			} else if (force) {
				set.add(cls);
			} else {
				set.delete(cls);
			}
		},
		setAttribute(_name: string, _value: string) {
			// no-op
		},
		appendText(_text: string) {
			// no-op
		},
		createDiv(opts?: any) {
			const child = createMockElement();
			if (opts?.text) (child as any).textContent = opts.text;
			if (opts?.cls) (child as any).cls = opts.cls;
			(this.children as MockChild[]).push(child);
			return child as any;
		},
		createSpan(opts?: any) {
			const child = createMockElement();
			if (opts?.text) (child as any).textContent = opts.text;
			if (opts?.cls) (child as any).cls = opts.cls;
			(this.children as MockChild[]).push(child);
			return child as any;
		},
		createEl(_tag: string, opts?: any) {
			const child = createMockElement();
			if (opts?.text) (child as any).textContent = opts.text;
			if (opts?.cls) (child as any).cls = opts.cls;
			(this.children as MockChild[]).push(child);
			return child as any;
		},
	};
	return el;
}

export function normalizePath(p: string): string {
	if (!p) return p;
	// Convert Windows separators, collapse duplicate slashes
	let out = p.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
	// Remove leading "./"
	out = out.replace(/^\.\//, "");
	// Remove trailing "/" except root
	if (out.length > 1) out = out.replace(/\/$/, "");
	return out;
}

export class TAbstractFile {
	public path: string;
	public name: string;
	public parent: TFolder | null = null;

	constructor(path: string) {
		this.path = path;
		this.name = path.split("/").pop() || path;
	}
}

export class TFolder extends TAbstractFile {}

export class TFile extends TAbstractFile {
	public extension: string;
	public basename: string;

	constructor(path: string) {
		super(path);
		const name = this.name;
		const parts = name.split(".");
		this.extension = parts.length > 1 ? parts[parts.length - 1] : "";
		this.basename = this.extension ? name.slice(0, -(this.extension.length + 1)) : name;
	}
}

export class Notice {
	public message: string;
	constructor(message: string) {
		this.message = message;
	}
}

export function setIcon(_el: any, _iconId: string): void {
	// no-op
}

export class Component {
	public load(): void {}
	public unload(): void {}
}

export class Modal {
	public app: any;
	public contentEl: any;
	public scope: { register: (..._args: any[]) => void };

	constructor(app: any) {
		this.app = app;
		this.contentEl = createMockElement();
		this.scope = { register: () => {} };
	}

	public open(): void {
		// In real Obsidian this triggers onOpen; tests can call onOpen manually if needed.
	}

	public close(): void {
		// In real Obsidian this triggers onClose; tests can call onClose manually if needed.
	}
}

export class ItemView {
	public leaf: any;
	public contentEl: any;
	constructor(leaf: any) {
		this.leaf = leaf;
		this.contentEl = createMockElement();
	}
}

export class Setting {
	constructor(_containerEl: any) {}
	public setName(_name: string): this {
		return this;
	}
	public setDesc(_desc: string): this {
		return this;
	}
	public addText(_cb: any): this {
		return this;
	}
	public addTextArea(_cb: any): this {
		return this;
	}
	public addDropdown(_cb: any): this {
		return this;
	}
	public addToggle(_cb: any): this {
		return this;
	}
}

export class PluginSettingTab {
	constructor(_app: any, _plugin: any) {}
}

export class Plugin {
	public app: any;
	constructor(app: any) {
		this.app = app;
	}
}

export class MarkdownView {}

export class MarkdownRenderer {
	public static async render(_app: any, _markdown: string, _el: any, _sourcePath: string, _component: any): Promise<void> {}
}

export class FuzzySuggestModal<T> extends Modal {
	// Minimal placeholder for subclasses
	constructor(app: any) {
		super(app);
	}
	public setPlaceholder(_text: string): void {}
	public setInstructions(_instructions: any[]): void {}
	public getItems(): T[] {
		return [];
	}
	public getItemText(_item: T): string {
		return "";
	}
	public onChooseItem(_item: T, _evt: any): void {}
}

export const Platform = {
	isMobile: false,
	isDesktop: true,
};


