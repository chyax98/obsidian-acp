/**
 * 命令菜单辅助类
 *
 * 处理斜杠命令菜单的显示、导航和选择
 */

import { setIcon } from "obsidian";
import type { AvailableCommand } from "../../../acp/types/updates";

/**
 * 命令菜单回调
 */
export interface CommandMenuCallbacks {
	/** 执行命令 */
	onExecute: (command: AvailableCommand) => Promise<void>;
	/** 连接检查 */
	isConnected: () => boolean;
	/** 触发连接 */
	ensureConnected: () => Promise<boolean>;
	/** 获取输入框值 */
	getInputValue: () => string;
}

/**
 * 命令菜单辅助类
 */
export class CommandMenuHelper {
	private containerEl: HTMLElement;
	private menuEl: HTMLElement | null = null;
	private selectedIndex: number = -1;
	private commands: AvailableCommand[] = [];
	private callbacks: CommandMenuCallbacks;

	constructor(containerEl: HTMLElement, callbacks: CommandMenuCallbacks) {
		this.containerEl = containerEl;
		this.callbacks = callbacks;
	}

	/**
	 * 更新可用命令列表
	 */
	public setCommands(commands: AvailableCommand[]): void {
		this.commands = commands;
	}

	/**
	 * 获取当前命令列表
	 */
	public getCommands(): AvailableCommand[] {
		return this.commands;
	}

	/**
	 * 菜单是否显示中
	 */
	public isVisible(): boolean {
		return this.menuEl !== null;
	}

	/**
	 * 显示命令菜单
	 */
	public show(filter = ""): void {
		// 移除旧菜单
		this.hide();

		// 如果命令列表为空，可能是因为还没连接
		if (this.commands.length === 0) {
			if (!this.callbacks.isConnected()) {
				// 显示"正在连接..."提示
				this.menuEl = this.containerEl.createDiv({
					cls: "acp-command-menu",
				});
				const loadingItem = this.menuEl.createDiv({
					cls: "acp-command-menu-item acp-command-menu-loading",
				});
				loadingItem.createDiv({
					cls: "acp-command-menu-info",
					text: "正在连接 Agent...",
				});

				// 触发连接
				void this.callbacks.ensureConnected().then(() => {
					const val = this.callbacks.getInputValue();
					if (val.startsWith("/") || val.startsWith("、")) {
						this.show(val.slice(1));
					}
				});
				return;
			}
			return;
		}

		// 过滤命令
		const filteredCommands = filter
			? this.commands.filter(
					(cmd) =>
						cmd.name.toLowerCase().includes(filter.toLowerCase()) ||
						cmd.description
							?.toLowerCase()
							.includes(filter.toLowerCase()),
				)
			: this.commands;

		if (filteredCommands.length === 0) {
			return;
		}

		// 创建命令菜单
		this.menuEl = this.containerEl.createDiv({
			cls: "acp-command-menu",
		});

		filteredCommands.forEach((cmd, index) => {
			const item = this.menuEl?.createDiv({
				cls: "acp-command-menu-item",
			});
			if (!item) return;

			if (index === 0) {
				item.addClass("acp-command-menu-item-selected");
				this.selectedIndex = 0;
			}

			// 命令图标
			const iconEl = item.createDiv({ cls: "acp-command-menu-icon" });
			setIcon(iconEl, "terminal");

			// 命令信息
			const infoEl = item.createDiv({ cls: "acp-command-menu-info" });
			infoEl.createDiv({
				cls: "acp-command-menu-name",
				text: `/${cmd.name}`,
			});

			if (cmd.description) {
				infoEl.createDiv({
					cls: "acp-command-menu-desc",
					text: cmd.description,
				});
			}

			// 点击事件
			item.addEventListener("click", () => {
				void this.select(cmd);
			});

			// 鼠标悬停
			item.addEventListener("mouseenter", () => {
				this.menuEl
					?.querySelectorAll(".acp-command-menu-item")
					.forEach((el, i) => {
						el.classList.toggle(
							"acp-command-menu-item-selected",
							i === index,
						);
					});
				this.selectedIndex = index;
			});
		});
	}

	/**
	 * 隐藏命令菜单
	 */
	public hide(): void {
		if (this.menuEl) {
			this.menuEl.remove();
			this.menuEl = null;
			this.selectedIndex = -1;
		}
	}

	/**
	 * 导航命令菜单（上下键）
	 */
	public navigate(direction: "up" | "down"): void {
		if (!this.menuEl) return;

		const items = this.menuEl.querySelectorAll(".acp-command-menu-item");
		if (items.length === 0) return;

		// 移除当前选中
		items[this.selectedIndex]?.classList.remove(
			"acp-command-menu-item-selected",
		);

		// 计算新索引
		if (direction === "up") {
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
		} else {
			this.selectedIndex = Math.min(
				items.length - 1,
				this.selectedIndex + 1,
			);
		}

		// 添加新选中
		const selectedItem = items[this.selectedIndex];
		selectedItem?.classList.add("acp-command-menu-item-selected");
		selectedItem?.scrollIntoView({ block: "nearest" });
	}

	/**
	 * 选择命令（回车确认）
	 */
	public async select(command?: AvailableCommand): Promise<void> {
		// 如果没有传入命令，使用当前选中的
		if (!command && this.menuEl) {
			const items = Array.from(
				this.menuEl.querySelectorAll(".acp-command-menu-item"),
			);
			const selectedItem = items[this.selectedIndex];
			if (selectedItem) {
				const commandName = selectedItem
					.querySelector(".acp-command-menu-name")
					?.textContent?.slice(1);
				command = this.commands.find((cmd) => cmd.name === commandName);
			}
		}

		if (!command) return;

		// 隐藏菜单
		this.hide();

		// 执行命令
		await this.callbacks.onExecute(command);
	}
}
