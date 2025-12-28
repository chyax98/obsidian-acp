import { PermissionModal } from "../src/ui/PermissionModal";

describe("PermissionModal (risk classification)", () => {
	test("treats edit/delete/move/execute as high risk", () => {
		const app: any = {};
		const modal = new PermissionModal(
			app,
			{
				toolCallId: "tc",
				toolName: "execute",
				title: "t",
				kind: "execute",
				rawInput: {},
			},
			() => {},
		);

		const isHighRiskTool = (modal as any).isHighRiskTool.bind(modal) as (
			toolName: string,
		) => boolean;

		expect(isHighRiskTool("execute")).toBe(true);
		expect(isHighRiskTool("edit")).toBe(true);
		expect(isHighRiskTool("delete")).toBe(true);
		expect(isHighRiskTool("move")).toBe(true);
	});

	test("does not treat read/search/other as high risk", () => {
		const app: any = {};
		const modal = new PermissionModal(
			app,
			{
				toolCallId: "tc",
				toolName: "read",
				title: "t",
				kind: "read",
				rawInput: {},
			},
			() => {},
		);

		const isHighRiskTool = (modal as any).isHighRiskTool.bind(modal) as (
			toolName: string,
		) => boolean;

		expect(isHighRiskTool("read")).toBe(false);
		expect(isHighRiskTool("search")).toBe(false);
		expect(isHighRiskTool("other")).toBe(false);
	});
});


