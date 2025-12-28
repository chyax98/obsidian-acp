import { ToolCallContentRenderer } from "../src/ui/renderers/tool-call-content";

describe("ToolCallContentRenderer.extractInputFromContext", () => {
	const extract = (
		ToolCallContentRenderer as any
	).extractInputFromContext.bind(ToolCallContentRenderer) as (
		toolCall: any,
	) => Record<string, unknown> | null;

	test("prefers locations for path/line", () => {
		const res = extract({
			title: "anything",
			locations: [{ path: "/a/b/c.ts", line: 12 }],
		});
		expect(res).toEqual({ path: "/a/b/c.ts", line: 12 });
	});

	test("extracts path from title 'Read <path>'", () => {
		const res = extract({
			title: "Read /Users/me/file.txt",
		});
		expect(res).toEqual({ path: "/Users/me/file.txt" });
	});

	test("extracts path+line from title '编辑 <path>:<line>'", () => {
		const res = extract({
			title: "编辑 /tmp/foo.ts:10",
		});
		expect(res).toEqual({ path: "/tmp/foo.ts", line: 10 });
	});

	test("extracts command from title '执行 <command>'", () => {
		const res = extract({
			title: "执行 echo hello",
		});
		expect(res).toEqual({ command: "echo hello" });
	});

	test("extracts path from content <file> tag", () => {
		const res = extract({
			title: "tool",
			content: [
				{
					type: "content",
					content: { type: "text", text: "<file>/tmp/a.md</file>" },
				},
			],
		});
		expect(res).toEqual({ path: "/tmp/a.md" });
	});

	test("extracts path from diff content", () => {
		const res = extract({
			content: [{ type: "diff", path: "foo/bar.ts", newText: "x" }],
		});
		expect(res).toEqual({ path: "foo/bar.ts" });
	});
});


