import { SessionExporter } from "../src/acp/core/session-export";
import type { Turn } from "../src/acp/core/types";

describe("SessionExporter.toMarkdown", () => {
	test("does not truncate tool call text output", () => {
		const longText = "x".repeat(600);

		const turns: Turn[] = [
			{
				id: "turn_1",
				userMessage: {
					id: "m1",
					role: "user",
					content: "hi",
					timestamp: Date.now(),
				},
				assistantMessage: {
					id: "m2",
					role: "assistant",
					content: "ok",
					timestamp: Date.now(),
				},
				toolCalls: [
					{
						toolCallId: "tc1",
						title: "Run something",
						kind: "bash",
						status: "completed",
						rawInput: { command: "echo hi" },
						content: [
							{
								type: "content",
								content: { type: "text", text: longText },
							},
						],
						startTime: Date.now(),
						endTime: Date.now(),
					},
				],
				thoughts: [],
				startTime: Date.now(),
				endTime: Date.now(),
			},
		];

		const md = SessionExporter.toMarkdown(turns, "/tmp");
		expect(md).toContain(longText);
		expect(md).not.toContain("...(truncated)");
	});

	test("exports all tool call content blocks (not just the first)", () => {
		const turns: Turn[] = [
			{
				id: "turn_1",
				userMessage: {
					id: "m1",
					role: "user",
					content: "hi",
					timestamp: Date.now(),
				},
				toolCalls: [
					{
						toolCallId: "tc1",
						title: "Tool",
						kind: "other",
						status: "completed",
						content: [
							{
								type: "content",
								content: { type: "text", text: "first block" },
							},
							{
								type: "content",
								content: { type: "text", text: "second block" },
							},
						],
						startTime: Date.now(),
						endTime: Date.now(),
					},
				],
				thoughts: [],
				startTime: Date.now(),
				endTime: Date.now(),
			},
		];

		const md = SessionExporter.toMarkdown(turns, "/tmp");
		expect(md).toContain("first block");
		expect(md).toContain("second block");
	});

	test("formats diff tool call content blocks", () => {
		const turns: Turn[] = [
			{
				id: "turn_1",
				userMessage: {
					id: "m1",
					role: "user",
					content: "hi",
					timestamp: Date.now(),
				},
				toolCalls: [
					{
						toolCallId: "tc1",
						title: "Edit file",
						kind: "edit",
						status: "completed",
						content: [
							{
								type: "diff",
								path: "foo.txt",
								oldText: "a\nb",
								newText: "a\nc",
							},
						],
						startTime: Date.now(),
						endTime: Date.now(),
					},
				],
				thoughts: [],
				startTime: Date.now(),
				endTime: Date.now(),
			},
		];

		const md = SessionExporter.toMarkdown(turns, "/tmp");
		expect(md).toContain("--- foo.txt");
		expect(md).toContain("+++ foo.txt");
		expect(md).toContain("-a");
		expect(md).toContain("-b");
		expect(md).toContain("+a");
		expect(md).toContain("+c");
	});
});


