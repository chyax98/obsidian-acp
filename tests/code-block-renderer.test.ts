import { CodeBlockRenderer } from "../src/ui/renderers/code-block-renderer";

describe("CodeBlockRenderer.cleanLineNumbers", () => {
	const clean = (CodeBlockRenderer as any).cleanLineNumbers.bind(
		CodeBlockRenderer,
	) as (text: string) => string;

	test("cleans OpenCode 00001| prefixes", () => {
		const input = "00001| a\n00002| b";
		expect(clean(input)).toBe("a\nb");
	});

	test("cleans cat -n arrow prefixes", () => {
		const input = "   1→a\n   2→b";
		expect(clean(input)).toBe("a\nb");
	});

	test("cleans colon prefixes", () => {
		const input = "  1: a\n  2: b";
		expect(clean(input)).toBe("a\nb");
	});

	test("cleans tab prefixes", () => {
		const input = "  1\ta\n  2\tb";
		expect(clean(input)).toBe("a\nb");
	});

	test("cleans content wrapped in <file> tags", () => {
		const input = "<file>\n00001| a\n00002| b\n</file>";
		expect(clean(input)).toBe("a\nb");
	});
});


