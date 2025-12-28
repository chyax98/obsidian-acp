import { TFile, TFolder } from "obsidian";
import { DragDropHandler } from "../src/ui/chat/helpers/drag-drop-handler";

function createMockApp(files: TFile[], folders: Array<TFolder & { children?: unknown[] }>) {
	const byPath = new Map<string, any>();
	for (const f of files) byPath.set(f.path, f);
	for (const d of folders) byPath.set(d.path, d);

	const app: any = {
		vault: {
			getAbstractFileByPath: (p: string) => byPath.get(p) || null,
			getFiles: () => files,
			getAllLoadedFiles: () => folders,
		},
	};

	return app;
}

function createMockDropZone() {
	const listeners: Record<string, Array<(evt: any) => void>> = {};
	const el: any = {
		addEventListener: (type: string, cb: (evt: any) => void) => {
			listeners[type] = listeners[type] || [];
			listeners[type].push(cb);
		},
		addClass: jest.fn(),
		removeClass: jest.fn(),
		contains: jest.fn().mockReturnValue(false),
	};

	return { el, listeners };
}

describe("DragDropHandler", () => {
	test("adds extension for file drops when Obsidian provides path without extension", () => {
		const folder = Object.assign(new TFolder("notes"), { children: [] as unknown[] });
		const file = new TFile("notes/meeting.md");
		const app = createMockApp([file], [folder]);

		const { el, listeners } = createMockDropZone();

		let value = "";
		const handler = new DragDropHandler(app, el, {
			getInputValue: () => value,
			setInputValue: (v) => {
				value = v;
			},
			focusInput: jest.fn(),
		});

		expect(handler).toBeDefined();
		const drop = listeners.drop?.[0];
		expect(drop).toBeDefined();

		drop({
			preventDefault: jest.fn(),
			stopPropagation: jest.fn(),
			dataTransfer: {
				getData: (type: string) => {
					if (type === "text/x-obsidian-files") return "notes/meeting";
					return "";
				},
			},
		});

		expect(value).toBe("@notes/meeting.md");
	});

	test("does not add extension for folder drops (even if a similarly named file exists)", () => {
		const folder = Object.assign(new TFolder("notes/meeting"), {
			children: [] as unknown[],
		});
		const parent = Object.assign(new TFolder("notes"), { children: [] as unknown[] });
		const file = new TFile("notes/meeting.md");
		const app = createMockApp([file], [parent, folder]);

		const { el, listeners } = createMockDropZone();

		let value = "";
		new DragDropHandler(app, el, {
			getInputValue: () => value,
			setInputValue: (v) => {
				value = v;
			},
			focusInput: jest.fn(),
		});

		listeners.drop[0]({
			preventDefault: jest.fn(),
			stopPropagation: jest.fn(),
			dataTransfer: {
				getData: (type: string) => {
					if (type === "text/x-obsidian-files") return "notes/meeting";
					return "";
				},
			},
		});

		expect(value).toBe("@notes/meeting");
	});

	test("parses internal links and resolves to real vault path with extension", () => {
		const folder = Object.assign(new TFolder("notes"), { children: [] as unknown[] });
		const file = new TFile("notes/meeting.md");
		const app = createMockApp([file], [folder]);

		const { el } = createMockDropZone();

		let value = "";
		const handler = new DragDropHandler(app, el, {
			getInputValue: () => value,
			setInputValue: (v) => {
				value = v;
			},
			focusInput: jest.fn(),
		});

		const resolved = (handler as any).resolveDroppedPath("[[notes/meeting]]");
		expect(resolved).toBe("notes/meeting.md");
	});
});


