import type { PermissionResponse } from "../src/acp/permission-manager";
import type { RequestPermissionParams } from "../src/acp/types/permissions";

let lastRequest: any = null;
let nextResponse: PermissionResponse = { outcome: "selected", optionId: "allow" };

jest.mock("../src/ui/PermissionModal", () => {
	class PermissionModal {
		constructor(_app: any, request: any, onResponse: (resp: any) => void) {
			lastRequest = request;
			this._onResponse = onResponse;
		}
		private _onResponse: (resp: any) => void;
		open() {
			this._onResponse(nextResponse);
		}
	}

	return { PermissionModal };
});

// Import after mocking PermissionModal
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { requestPermissionWithModal } = require("../src/ui/chat/helpers/permission-request");

describe("requestPermissionWithModal", () => {
	beforeEach(() => {
		lastRequest = null;
		nextResponse = { outcome: "selected", optionId: "allow" };
	});

	test("passes through options and maps selected outcome", async () => {
		const app: any = {};
		const addSystemMessage = jest.fn();

		const params: RequestPermissionParams = {
			sessionId: "s1",
			options: [
				{ optionId: "allow_once_id", name: "Allow once", kind: "allow_once" },
				{ optionId: "reject_once_id", name: "Reject once", kind: "reject_once" },
			],
			toolCall: {
				toolCallId: "tc1",
				title: "Do thing",
				kind: "execute",
				rawInput: { command: "echo hi" },
			},
		};

		nextResponse = { outcome: "selected", optionId: "allow_once_id" };

		const outcome = await requestPermissionWithModal(app, params, addSystemMessage);

		expect(lastRequest).toBeTruthy();
		expect(lastRequest.options).toBe(params.options);
		expect(outcome).toEqual({ type: "selected", optionId: "allow_once_id" });
		expect(addSystemMessage).toHaveBeenCalledWith("✓ 已允许: Do thing");
	});

	test("maps cancelled outcome", async () => {
		const app: any = {};
		const addSystemMessage = jest.fn();

		const params: RequestPermissionParams = {
			sessionId: "s1",
			options: [],
			toolCall: {
				toolCallId: "tc1",
				title: "Do thing",
				kind: "execute",
				rawInput: {},
			},
		};

		nextResponse = { outcome: "cancelled" };

		const outcome = await requestPermissionWithModal(app, params, addSystemMessage);

		expect(outcome).toEqual({ type: "cancelled" });
		expect(addSystemMessage).toHaveBeenCalledWith("⚠ 已取消: Do thing");
	});

	test("treats reject optionId as rejected message", async () => {
		const app: any = {};
		const addSystemMessage = jest.fn();

		const params: RequestPermissionParams = {
			sessionId: "s1",
			options: [],
			toolCall: {
				toolCallId: "tc1",
				title: "Danger",
				kind: "delete",
				rawInput: {},
			},
		};

		nextResponse = { outcome: "selected", optionId: "reject_once" };

		const outcome = await requestPermissionWithModal(app, params, addSystemMessage);

		expect(outcome).toEqual({ type: "selected", optionId: "reject_once" });
		expect(addSystemMessage).toHaveBeenCalledWith("✗ 已拒绝: Danger");
	});
});


