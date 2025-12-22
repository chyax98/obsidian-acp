/**
 * 渲染器工具函数
 */

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;

	// 小于 1 分钟
	if (diff < 60000) {
		return '刚刚';
	}

	// 小于 1 小时
	if (diff < 3600000) {
		const minutes = Math.floor(diff / 60000);
		return `${minutes}分钟前`;
	}

	// 小于 1 天
	if (diff < 86400000) {
		const hours = Math.floor(diff / 3600000);
		return `${hours}小时前`;
	}

	// 显示时间
	const date = new Date(timestamp);
	const today = new Date();

	// 今天：显示时间
	if (date.toDateString() === today.toDateString()) {
		return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
	}

	// 昨天
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);
	if (date.toDateString() === yesterday.toDateString()) {
		return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
	}

	// 其他：显示日期和时间
	return date.toLocaleString('zh-CN', {
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	});
}

/**
 * 格式化持续时间
 */
export function formatDuration(ms: number): string {
	if (ms < 1000) {
		return `${ms}ms`;
	}
	if (ms < 60000) {
		return `${(ms / 1000).toFixed(1)}s`;
	}
	const minutes = Math.floor(ms / 60000);
	const seconds = ((ms % 60000) / 1000).toFixed(0);
	return `${minutes}m ${seconds}s`;
}

/**
 * 获取文件名（从完整路径）
 */
export function getFileName(path: string): string {
	const parts = path.split(/[/\\]/);
	const fileName = parts[parts.length - 1] || path;
	// 如果路径很长，显示 ...目录/文件名
	if (parts.length > 2 && path.length > 40) {
		return `.../${parts[parts.length - 2]}/${fileName}`;
	}
	return fileName;
}

/**
 * 安全获取字符串参数（从多个可能的 key 中）
 */
export function getStringParam(rawInput: Record<string, unknown>, keys: string[]): string | undefined {
	for (const key of keys) {
		const value = rawInput[key];
		if (typeof value === 'string' && value.length > 0) {
			return value;
		}
	}
	return undefined;
}

/**
 * 获取除指定 key 外的其他参数
 */
export function getOtherParams(
	rawInput: Record<string, unknown>,
	excludeKeys: string[],
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const key of Object.keys(rawInput)) {
		if (!excludeKeys.includes(key) && !key.startsWith('_')) {
			result[key] = rawInput[key];
		}
	}
	return result;
}
