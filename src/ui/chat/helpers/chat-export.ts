import type { App } from "obsidian";
import { TFolder, normalizePath } from "obsidian";
import type { SessionManager } from "../../../acp/core/session-manager";

/**
 * 将当前会话导出为 Markdown 文件写入 Vault。
 *
 * @returns 创建的文件路径（Vault 相对路径）
 */
export async function exportChatSessionMarkdown(
	app: App,
	sm: SessionManager,
	exportFolder: string = "export-acp-agent",
): Promise<string> {
	// 确保导出目录存在
	const existingFolder = app.vault.getAbstractFileByPath(exportFolder);
	if (!existingFolder) {
		await app.vault.createFolder(exportFolder);
	} else if (!(existingFolder instanceof TFolder)) {
		throw new Error(`无法创建导出文件夹：路径已被文件占用 (${exportFolder})`);
	}

	const markdown = sm.toMarkdown();
	const timestamp = new Date().toISOString().slice(0, 10);
	const firstMsg =
		sm.turns[0]?.userMessage.content
			.slice(0, 30)
			.replace(/[/\\?%*:|"<>]/g, "-") || "chat";
	const fileName = `ACP-${timestamp}-${firstMsg}.md`;

	const basePath = normalizePath(`${exportFolder}/${fileName}`);
	let finalPath = basePath;
	if (app.vault.getAbstractFileByPath(finalPath)) {
		finalPath = normalizePath(
			`${exportFolder}/ACP-${Date.now()}-${firstMsg.slice(0, 20)}.md`,
		);
	}

	// 极端情况下（同毫秒重复导出）避免冲突
	while (app.vault.getAbstractFileByPath(finalPath)) {
		finalPath = normalizePath(
			`${exportFolder}/ACP-${Date.now()}-${Math.floor(Math.random() * 10000)}-${firstMsg.slice(0, 20)}.md`,
		);
	}

	await app.vault.create(finalPath, markdown);
	return finalPath;
}


