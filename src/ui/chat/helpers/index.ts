/**
 * ChatView 辅助类统一导出
 */

export { ScrollHelper } from "./scroll-helper";
export type { ScrollConfig } from "./scroll-helper";

export { CommandMenuHelper } from "./command-menu";
export type { CommandMenuCallbacks } from "./command-menu";

export { InputHistoryManager } from "./input-history";
export type { InputHistoryConfig } from "./input-history";

export { ErrorDisplayHelper } from "./error-display";
export type { ErrorContext } from "./error-display";

export { DragDropHandler } from "./drag-drop-handler";
export type { DragDropCallbacks } from "./drag-drop-handler";

export { ObsidianContextGenerator } from "./obsidian-context";
export type { ContextConfig } from "./obsidian-context";

export { ConnectionManager } from "./connection-manager";
export type {
	ConnectionConfig,
	ConnectionCallbacks,
} from "./connection-manager";

export { HistoryManager } from "./history-manager";
export type { HistoryManagerCallbacks } from "./history-manager";
