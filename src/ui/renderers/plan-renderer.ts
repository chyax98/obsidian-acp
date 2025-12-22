/**
 * 计划渲染器
 *
 * 渲染 Agent 的执行计划，支持：
 * - 可折叠展示
 * - 进度显示
 * - 状态图标
 */

import { setIcon } from 'obsidian';
import type { PlanEntry } from '../../acp/core/session-manager';

/**
 * 计划渲染器
 */
export class PlanRenderer {
	/**
	 * 渲染计划
	 *
	 * @param container - 容器元素
	 * @param plan - 计划条目列表
	 * @returns 计划元素
	 */
	public static render(container: HTMLElement, plan: PlanEntry[]): HTMLElement {
		// 查找已存在的计划
		const planEl = container.querySelector('.acp-plan') as HTMLElement;

		// 计算进度
		const completedCount = plan.filter(e => e.status === 'completed').length;
		const progressText = `${completedCount}/${plan.length}`;

		if (planEl) {
			// 增量更新
			this.updateExisting(planEl, plan, progressText);
			return planEl;
		}

		// 创建新元素
		return this.createNew(container, plan, progressText);
	}

	/**
	 * 更新已存在的计划
	 */
	private static updateExisting(planEl: HTMLElement, plan: PlanEntry[], progressText: string): void {
		requestAnimationFrame(() => {
			// 更新进度
			const progressEl = planEl.querySelector('.acp-plan-progress');
			if (progressEl) {
				progressEl.textContent = progressText;
			}

			// 更新列表
			const listEl = planEl.querySelector('.acp-plan-list');
			if (listEl) {
				(listEl as HTMLElement).empty();
				this.renderEntries(listEl as HTMLElement, plan);
			}
		});
	}

	/**
	 * 创建新的计划
	 */
	private static createNew(container: HTMLElement, plan: PlanEntry[], progressText: string): HTMLElement {
		const planEl = container.createDiv({ cls: 'acp-plan' });

		// 头部
		const headerEl = planEl.createDiv({ cls: 'acp-plan-header' });
		const leftEl = headerEl.createDiv({ cls: 'acp-plan-left' });

		// 展开/折叠图标
		const toggleIcon = leftEl.createDiv({ cls: 'acp-plan-toggle' });
		setIcon(toggleIcon, 'chevron-down');

		// 计划图标
		const iconEl = leftEl.createDiv({ cls: 'acp-plan-icon' });
		setIcon(iconEl, 'list-tree');

		// 标题
		leftEl.createDiv({ cls: 'acp-plan-title', text: '执行计划' });

		// 右侧：进度
		const rightEl = headerEl.createDiv({ cls: 'acp-plan-right' });
		rightEl.createDiv({ cls: 'acp-plan-progress', text: progressText });

		// 条目列表
		const listEl = planEl.createDiv({
			cls: 'acp-plan-list',
			attr: { 'data-expanded': 'true' },
		});
		this.renderEntries(listEl, plan);

		// 点击头部切换
		headerEl.addEventListener('click', () => {
			const expanded = listEl.getAttribute('data-expanded') === 'true';
			listEl.setAttribute('data-expanded', expanded ? 'false' : 'true');
			listEl.toggleClass('acp-plan-list-collapsed', expanded);

			toggleIcon.empty();
			setIcon(toggleIcon, expanded ? 'chevron-right' : 'chevron-down');
		});

		return planEl;
	}

	/**
	 * 渲染计划条目
	 */
	private static renderEntries(listEl: HTMLElement, plan: PlanEntry[]): void {
		for (const entry of plan) {
			const entryEl = listEl.createDiv({
				cls: `acp-plan-entry acp-plan-entry-${entry.status}`,
			});

			// 状态图标
			const statusIconEl = entryEl.createDiv({ cls: 'acp-plan-entry-icon' });
			this.setEntryIcon(statusIconEl, entry.status);

			// 内容
			const contentEl = entryEl.createDiv({ cls: 'acp-plan-entry-content' });
			contentEl.textContent = entry.content;

			// 优先级标签
			if (entry.priority && entry.priority !== 'normal') {
				const priorityEl = entryEl.createDiv({
					cls: `acp-plan-entry-priority acp-plan-priority-${entry.priority}`,
				});
				priorityEl.textContent = this.formatPriority(entry.priority);
			}
		}
	}

	/**
	 * 设置计划条目图标
	 */
	private static setEntryIcon(iconEl: HTMLElement, status: string): void {
		iconEl.empty();

		let iconName: string;
		switch (status) {
			case 'pending':
				iconName = 'circle';
				break;
			case 'in_progress':
				iconName = 'loader-2';
				break;
			case 'completed':
				iconName = 'check-circle-2';
				break;
			default:
				iconName = 'circle';
		}

		setIcon(iconEl, iconName);
	}

	/**
	 * 格式化优先级
	 */
	private static formatPriority(priority: string): string {
		const priorityMap: Record<string, string> = {
			high: '高',
			normal: '普通',
			low: '低',
		};
		return priorityMap[priority] || priority;
	}
}
