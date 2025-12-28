import { exportChatSessionMarkdown } from "../src/ui/chat/helpers/chat-export";
import { TFolder } from "obsidian";

function createMockApp() {
	const files = new Map<string, any>();

	const app: any = {
		vault: {
			getAbstractFileByPath: (p: string) => files.get(p) || null,
			createFolder: async (p: string) => {
				const folder = new TFolder(p);
				files.set(p, folder);
				return folder;
			},
			create: async (p: string, data: string) => {
				const file = { path: p, data };
				files.set(p, file);
				return file;
			},
		},
		__files: files,
	};

	return app;
}

describe("exportChatSessionMarkdown", () => {
	test("creates export folder and writes markdown into it", async () => {
		const app = createMockApp();
		const sm: any = {
			turns: [{ userMessage: { content: "Hello world" } }],
			toMarkdown: () => "# md",
		};

		const finalPath = await exportChatSessionMarkdown(app, sm);

		expect(finalPath.startsWith("export-acp-agent/")).toBe(true);
		expect(app.__files.get("export-acp-agent")).toBeInstanceOf(TFolder);
		expect(app.__files.get(finalPath)?.data).toBe("# md");
	});

	test("throws when export folder path exists as a file", async () => {
		const app = createMockApp();
		app.__files.set("export-acp-agent", { path: "export-acp-agent" }); // not a TFolder

		const sm: any = {
			turns: [{ userMessage: { content: "Hello" } }],
			toMarkdown: () => "md",
		};

		await expect(exportChatSessionMarkdown(app, sm)).rejects.toThrow(
			"路径已被文件占用",
		);
	});

	test("avoids name collision by generating a different filename", async () => {
		const app = createMockApp();
		const sm: any = {
			turns: [{ userMessage: { content: "Hello world" } }],
			toMarkdown: () => "md",
		};

		// Freeze time for deterministic paths
		const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1700000000000);

		// First export
		const p1 = await exportChatSessionMarkdown(app, sm);
		// Force collision on the same base path by creating a fake file at p1
		expect(app.__files.get(p1)).toBeDefined();

		// Second export should choose a different path
		const p2 = await exportChatSessionMarkdown(app, sm);
		expect(p2).not.toBe(p1);
		expect(app.__files.get(p2)).toBeDefined();

		nowSpy.mockRestore();
	});

	test("sanitizes filename from the first user message", async () => {
		const app = createMockApp();
		const sm: any = {
			turns: [{ userMessage: { content: 'a/b\\c?d%e*f:"g|h<i>j' } }],
			toMarkdown: () => "md",
		};

		const p = await exportChatSessionMarkdown(app, sm);
		// Only validate the filename portion (folder separator '/' is expected)
		const filename = p.split("/").pop() || p;
		expect(filename).not.toMatch(/[\\?%*:|"<>]/);
	});
});


