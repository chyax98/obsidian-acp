/**
 * 增强的 Agent 设置界面
 *
 * 添加：
 * - 手动路径输入框
 * - 检测来源显示（5层优先级）
 * - 实时路径验证
 * - 优先级说明
 */

import { Setting, Notice } from 'obsidian';
import type { AcpBackendId, AcpBackendConfig } from '../acp/backends/types';
import type { UnifiedDetector } from '../acp/unified-detector';
import type AcpPlugin from '../main';

/**
 * 渲染增强的 Agent 配置项
 *
 * @param containerEl - 容器元素
 * @param agentId - Agent ID
 * @param config - Agent 配置
 * @param plugin - 插件实例
 * @param detector - 统一检测器
 */
export async function renderEnhancedAgentItem(
	containerEl: HTMLElement,
	agentId: AcpBackendId,
	config: AcpBackendConfig,
	plugin: AcpPlugin,
	detector: UnifiedDetector,
): Promise<void> {
	const agentItemEl = containerEl.createDiv({ cls: 'acp-agent-item-enhanced' });

	// ===== 1. Agent 标题和状态 =====
	const headerEl = agentItemEl.createDiv({ cls: 'acp-agent-header' });

	headerEl.createDiv({
		cls: 'acp-agent-name',
		text: config.name,
	});

	const statusEl = headerEl.createDiv({ cls: 'acp-agent-status' });
	statusEl.textContent = '🔍 检测中...';
	statusEl.style.color = 'var(--text-muted)';

	// ===== 2. Agent 描述 =====
	if (config.description) {
		agentItemEl.createDiv({
			cls: 'acp-agent-description',
			text: config.description,
		});
	}

	// ===== 3. 手动路径输入 =====
	const manualPathSetting = new Setting(agentItemEl)
		.setName('手动指定路径')
		.setDesc('留空则使用自动检测。支持绝对路径、~/路径、${VAR}变量、npx命令')
		.addText(text => {
			text
				.setPlaceholder('例: npx @zed-industries/claude-code-acp 或 /usr/local/bin/kimi')
				.setValue(plugin.settings.manualAgentPaths?.[agentId] || '')
				.onChange(async (value) => {
					// 保存手动路径
					if (!plugin.settings.manualAgentPaths) {
						plugin.settings.manualAgentPaths = {};
					}
					plugin.settings.manualAgentPaths[agentId] = value;
					await plugin.saveSettings();

					// 触发重新检测
					detector.clearCache();
					void updateDetectionStatus();
				});
		});

	// ===== 4. 检测状态和来源显示 =====
	const detectionInfoEl = agentItemEl.createDiv({ cls: 'acp-detection-info' });

	// 执行检测并更新状态
	const updateDetectionStatus = async () => {
		statusEl.textContent = '🔍 检测中...';
		statusEl.style.color = 'var(--text-muted)';
		detectionInfoEl.empty();

		try {
			// 使用统一检测器
			const result = await detector.detectSingle(agentId, {
				vaultPath: (plugin.app.vault.adapter as { basePath?: string }).basePath,
				globalConfigPath: undefined, // 使用默认 ~/.acprc
				manualPath: plugin.settings.manualAgentPaths?.[agentId],
				cliCommand: config.cliCommand, // 使用 cliCommand 而不是 cmd
			});

			if (result.found && result.path) {
				// ✅ 检测成功
				statusEl.textContent = `✅ 已检测${result.version ? ` (${result.version})` : ''}`;
				statusEl.style.color = 'var(--color-green)';

				// 显示检测来源
				const sourceInfo = getSourceInfo(result.source, result.envVar);
				const sourceEl = detectionInfoEl.createDiv({ cls: 'acp-detection-source' });
				sourceEl.createSpan({ cls: 'acp-source-label', text: '检测来源:' });
				sourceEl.createSpan({
					cls: `acp-source-value acp-source-badge ${sourceInfo.cssClass}`,
					text: sourceInfo.text,
				});

				// 显示检测到的路径
				const pathEl = detectionInfoEl.createDiv({ cls: 'acp-detection-path' });
				pathEl.createSpan({ cls: 'acp-path-label', text: 'CLI 路径:' });
				pathEl.createEl('code', { cls: 'acp-path-value', text: result.path });

				// 添加复制按钮
				const copyBtn = pathEl.createEl('button', {
					cls: 'acp-copy-btn',
					text: '📋',
				});
				copyBtn.title = '复制路径';
				copyBtn.addEventListener('click', () => {
					void navigator.clipboard.writeText(result.path!).then(() => {
						new Notice('已复制路径');
					});
				});

				// 添加测试按钮
				const testBtn = detectionInfoEl.createEl('button', {
					cls: 'mod-cta',
					text: '测试连接',
				});
				testBtn.addEventListener('click', async () => {
					testBtn.disabled = true;
					testBtn.textContent = '测试中...';

					const success = await testConnection(result.path!);

					testBtn.disabled = false;
					testBtn.textContent = success ? '✅ 连接成功' : '❌ 连接失败';

					setTimeout(() => {
						testBtn.textContent = '测试连接';
					}, 2000);
				});

			} else {
				// ❌ 未检测到
				statusEl.textContent = '⚠️ 未检测到';
				statusEl.style.color = 'var(--text-muted)';

				// 显示安装提示
				const installEl = detectionInfoEl.createDiv({ cls: 'acp-install-help' });
				installEl.createDiv({ cls: 'acp-install-title', text: '💡 如何安装：' });
				installEl.createEl('code', { cls: 'acp-install-command', text: getInstallCommand(config) });


				const copyInstallBtn = installEl.createEl('button', {
					text: '复制安装命令',
				});
				copyInstallBtn.addEventListener('click', () => {
					void navigator.clipboard.writeText(getInstallCommand(config)).then(() => {
						new Notice('已复制安装命令');
					});
				});

				// 显示优先级说明
				const priorityChain = detector.getPriorityChain(agentId);
				const priorityEl = detectionInfoEl.createDiv({ cls: 'acp-priority-help' });
				priorityEl.createDiv({ cls: 'acp-priority-title', text: '🔍 检测优先级：' });
				const priorityList = priorityEl.createEl('ol', { cls: 'acp-priority-list' });

				for (const priority of priorityChain) {
					const item = priorityList.createEl('li');
					item.textContent = priority.description;
				}
			}
		} catch (error) {
			// 检测错误
			statusEl.textContent = '❌ 检测失败';
			statusEl.style.color = 'var(--text-error)';

			const errorEl = detectionInfoEl.createDiv({ cls: 'acp-detection-error' });
			errorEl.textContent = `错误: ${error instanceof Error ? error.message : String(error)}`;
		}
	};

	// 初始检测
	void updateDetectionStatus();
}

/**
 * 获取来源文本和样式类
 */
function getSourceInfo(source: string, envVar?: string): { text: string; cssClass: string } {
	switch (source) {
		case 'env':
			return {
				text: `🔧 环境变量${envVar ? ` (${envVar})` : ''}`,
				cssClass: 'acp-source-env',
			};
		case 'vault-config':
			return {
				text: '📁 Vault 配置',
				cssClass: 'acp-source-vault',
			};
		case 'global-config':
			return {
				text: '🌍 全局配置 (~/.acprc)',
				cssClass: 'acp-source-global',
			};
		case 'manual':
			return {
				text: '✏️ 手动输入',
				cssClass: 'acp-source-manual',
			};
		case 'auto':
			return {
				text: '🤖 自动检测 (PATH)',
				cssClass: 'acp-source-auto',
			};
		default:
			return {
				text: '❓ 未知来源',
				cssClass: '',
			};
	}
}

/**
 * 获取安装命令
 */
function getInstallCommand(config: AcpBackendConfig): string {
	// 如果有 defaultCliPath 且以 npx 开头，直接使用
	if (config.defaultCliPath?.startsWith('npx ')) {
		return config.defaultCliPath;
	}

	// 如果有 cliCommand
	if (config.cliCommand) {
		// 常见的 npm 包安装
		return `npm install -g ${config.cliCommand}`;
	}

	// 默认
	return `# 请参考 ${config.name} 官方文档`;
}

/**
 * 测试连接
 */
async function testConnection(cliPath: string): Promise<boolean> {
	try {
		const { spawn } = await import('child_process');
		const { access, constants } = await import('fs/promises');

		// 解析命令：支持 "npx @pkg" 或 "/path/to/cli" 格式
		const parts = cliPath.trim().split(/\s+/);
		const command = parts[0];
		const baseArgs = parts.slice(1);

		// Windows 下 npx 需要使用 npx.cmd
		const actualCommand = process.platform === 'win32' && command === 'npx' ? 'npx.cmd' : command;

		// 设置环境变量：处理 nvm 路径
		const env = { ...process.env };
		if (cliPath.includes('/.nvm/') && !cliPath.startsWith('npx ')) {
			const binDirMatch = cliPath.match(/^(.+\/\.nvm\/versions\/[^/]+\/[^/]+\/bin)\//);
			if (binDirMatch) {
				const nvmBinDir = binDirMatch[1];
				env.PATH = `${nvmBinDir}:${env.PATH || ''}`;
			}
		}

		// 尝试执行命令的辅助函数
		const tryCommand = (args: string[]): Promise<boolean> => {
			return new Promise((resolve) => {
				const proc = spawn(actualCommand, [...baseArgs, ...args], {
					stdio: 'pipe',
					timeout: 5000,
					env, // 使用修改后的环境变量
				});

				const timeout = setTimeout(() => {
					proc.kill();
					resolve(false);
				}, 5000);

				proc.on('error', () => {
					clearTimeout(timeout);
					resolve(false);
				});

				proc.on('exit', (code) => {
					clearTimeout(timeout);
					// 退出码 0 表示成功，null 表示被信号终止（某些命令可能会这样）
					resolve(code === 0 || code === null);
				});
			});
		};

		// 1. 先尝试 --version
		const versionSuccess = await tryCommand(['--version']);
		if (versionSuccess) return true;

		// 2. 尝试 --help
		const helpSuccess = await tryCommand(['--help']);
		if (helpSuccess) return true;

		// 3. 对于非 npx 命令，检查文件是否可执行
		if (actualCommand !== 'npx' && actualCommand !== 'npx.cmd') {
			try {
				await access(actualCommand, constants.X_OK);
				return true; // 文件存在且可执行
			} catch {
				return false;
			}
		}

		return false;
	} catch {
		return false;
	}
}
