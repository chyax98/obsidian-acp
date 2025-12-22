/**
 * 输入历史管理
 *
 * 管理用户输入的历史记录，支持上下键导航
 */

/**
 * 输入历史配置
 */
export interface InputHistoryConfig {
	/** 最大历史记录数 */
	maxSize: number;
}

const DEFAULT_CONFIG: InputHistoryConfig = {
	maxSize: 50,
};

/**
 * 输入历史管理类
 */
export class InputHistoryManager {
	private history: string[] = [];
	private currentIndex: number = -1;
	private config: InputHistoryConfig;

	constructor(config: Partial<InputHistoryConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * 添加到历史记录
	 */
	public add(text: string): void {
		// 避免重复
		if (this.history[0] === text) {
			return;
		}

		// 添加到开头
		this.history.unshift(text);

		// 限制历史数量
		if (this.history.length > this.config.maxSize) {
			this.history.pop();
		}

		// 重置索引
		this.currentIndex = -1;
	}

	/**
	 * 向上导航（获取更旧的记录）
	 */
	public navigateUp(): string | null {
		if (this.history.length === 0) {
			return null;
		}

		if (this.currentIndex < this.history.length - 1) {
			this.currentIndex++;
		}

		return this.history[this.currentIndex];
	}

	/**
	 * 向下导航（获取更新的记录）
	 */
	public navigateDown(): string | null {
		if (this.history.length === 0) {
			return null;
		}

		if (this.currentIndex > -1) {
			this.currentIndex--;
		}

		if (this.currentIndex === -1) {
			return ""; // 返回空字符串表示回到最新（空输入）
		}

		return this.history[this.currentIndex];
	}

	/**
	 * 导航历史
	 * @returns 对应的历史记录，null 表示无变化
	 */
	public navigate(direction: "up" | "down"): string | null {
		if (direction === "up") {
			return this.navigateUp();
		} else {
			return this.navigateDown();
		}
	}

	/**
	 * 重置导航索引
	 */
	public reset(): void {
		this.currentIndex = -1;
	}

	/**
	 * 清空历史
	 */
	public clear(): void {
		this.history = [];
		this.currentIndex = -1;
	}

	/**
	 * 获取历史记录数量
	 */
	public get size(): number {
		return this.history.length;
	}

	/**
	 * 获取所有历史记录（只读）
	 */
	public getAll(): readonly string[] {
		return this.history;
	}
}
