/**
 * 日志工具 - 根据 debugMode 控制输出
 */

let debugEnabled = false;

/**
 * 设置调试模式
 */
export function setDebugMode(enabled: boolean): void {
	debugEnabled = enabled;
}

/**
 * 获取调试模式状态
 */
export function isDebugMode(): boolean {
	return debugEnabled;
}

/**
 * 调试日志（仅在 debugMode 开启时输出）
 */
export function debug(...args: unknown[]): void {
	if (debugEnabled) {
		console.log(...args);
	}
}

/**
 * 警告日志（始终输出）
 */
export function warn(...args: unknown[]): void {
	console.warn(...args);
}

/**
 * 错误日志（始终输出）
 */
export function error(...args: unknown[]): void {
	console.error(...args);
}
