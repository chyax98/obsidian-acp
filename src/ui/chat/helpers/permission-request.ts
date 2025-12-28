import type { App } from "obsidian";
import type {
	RequestPermissionParams,
	PermissionOutcome,
} from "../../../acp/types/permissions";
import type { PermissionRequest, PermissionResponse } from "../../../acp/permission-manager";
import { error as logError } from "../../../acp/utils/logger";
import { PermissionModal } from "../../PermissionModal";

/**
 * 使用弹窗处理权限请求，并转换为 ACP 的 PermissionOutcome。
 */
export async function requestPermissionWithModal(
	app: App,
	params: RequestPermissionParams,
	addSystemMessage: (text: string) => void,
): Promise<PermissionOutcome> {
	return new Promise((resolve) => {
		try {
			const toolCall = params.toolCall;

			const request: PermissionRequest = {
				toolCallId: toolCall?.toolCallId || "",
				toolName: toolCall?.kind || "",
				title: toolCall?.title || "",
				kind: toolCall?.kind || "",
				rawInput: toolCall?.rawInput || {},
				options: params.options,
			};

			const modal = new PermissionModal(
				app,
				request,
				(response: PermissionResponse) => {
					const title = toolCall?.title || "操作";
					if (response.outcome === "selected") {
						const actionText = response.optionId?.includes("reject")
							? "✗ 已拒绝"
							: "✓ 已允许";
						addSystemMessage(`${actionText}: ${title}`);
					} else {
						addSystemMessage(`⚠ 已取消: ${title}`);
					}

					resolve(
						response.outcome === "cancelled"
							? { type: "cancelled" }
							: {
									type: "selected",
									optionId: response.optionId || "reject-once",
								},
					);
				},
			);
			modal.open();
		} catch (error) {
			logError("[ChatView] 权限请求处理失败:", error);
			resolve({ type: "cancelled" });
		}
	});
}


