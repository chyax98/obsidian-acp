/**
 * 优先级检测器测试
 *
 * TDD Phase 4: 测试完整的 5 层优先级检测流程
 * 1. 环境变量 (最高优先级)
 * 2. Vault 配置文件
 * 3. 全局配置文件
 * 4. 手动输入 (插件设置)
 * 5. 自动检测 (PATH) (最低优先级)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PriorityDetector } from '../src/acp/priority-detector';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('PriorityDetector', () => {
	let detector: PriorityDetector;
	let testVaultDir: string;
	let testConfigDir: string;
	let globalConfigPath: string;
	let originalEnv: NodeJS.ProcessEnv;
	let testBinDir: string;

	beforeEach(async () => {
		detector = new PriorityDetector();
		testVaultDir = '/tmp/acp-priority-test';
		testConfigDir = path.join(testVaultDir, '.obsidian', 'plugins', 'obsidian-acp');
		globalConfigPath = path.join(process.env.HOME || '/tmp', '.acprc-priority-test');
		testBinDir = '/tmp/acp-bin-test';
		originalEnv = { ...process.env };

		// 创建测试目录
		await fs.mkdir(testConfigDir, { recursive: true });
		await fs.mkdir(testBinDir, { recursive: true });
	});

	afterEach(async () => {
		// 恢复环境变量
		process.env = originalEnv;

		// 清理测试文件
		try {
			await fs.rm(testVaultDir, { recursive: true, force: true });
			await fs.rm(testBinDir, { recursive: true, force: true });
			await fs.unlink(globalConfigPath);
		} catch {
			// 忽略清理错误
		}
	});

	describe('detectWithPriority', () => {
		it('应该优先使用环境变量', async () => {
			// 1. 环境变量
			process.env.CLAUDE_CODE_PATH = 'npx @zed-industries/claude-code-acp';

			// 2. Vault 配置
			const vaultConfigPath = path.join(testConfigDir, '.acp.json');
			await fs.writeFile(vaultConfigPath, JSON.stringify({
				agents: { claude: 'npx kimi' }
			}));

			// 3. 全局配置
			await fs.writeFile(globalConfigPath, JSON.stringify({
				agents: { claude: 'npx codex' }
			}));

			// 4. 手动输入
			const manualPaths = { claude: 'npx gemini' };

			const result = await detector.detectWithPriority('claude', {
				vaultPath: testVaultDir,
				globalConfigPath,
				manualPaths
			});

			expect(result.found).toBe(true);
			expect(result.path).toBe('npx @zed-industries/claude-code-acp');
			expect(result.source).toBe('env');
		});

		it('应该在环境变量不存在时使用 Vault 配置', async () => {
			// 1. 无环境变量
			delete process.env.KIMI_PATH;

			// 2. Vault 配置
			const vaultConfigPath = path.join(testConfigDir, '.acp.json');
			await fs.writeFile(vaultConfigPath, JSON.stringify({
				agents: { kimi: 'npx kimi' }
			}));

			// 3. 全局配置
			await fs.writeFile(globalConfigPath, JSON.stringify({
				agents: { kimi: 'npx @google/gemini-cli' }
			}));

			const result = await detector.detectWithPriority('kimi', {
				vaultPath: testVaultDir,
				globalConfigPath
			});

			expect(result.found).toBe(true);
			expect(result.path).toBe('npx kimi');
			expect(result.source).toBe('vault-config');
		});

		it('应该在 Vault 配置不存在时使用全局配置', async () => {
			// 1. 无环境变量
			// 2. 无 Vault 配置
			// 3. 全局配置
			await fs.writeFile(globalConfigPath, JSON.stringify({
				agents: { codex: 'npx @zed-industries/codex-acp' }
			}));

			const result = await detector.detectWithPriority('codex', {
				vaultPath: testVaultDir,
				globalConfigPath
			});

			expect(result.found).toBe(true);
			expect(result.path).toBe('npx @zed-industries/codex-acp');
			expect(result.source).toBe('global-config');
		});

		it('应该在配置文件不存在时使用手动输入', async () => {
			// 1-3. 无环境变量、配置文件
			// 4. 手动输入
			const manualPaths = { gemini: 'npx @google/gemini-cli' };

			const result = await detector.detectWithPriority('gemini', {
				vaultPath: testVaultDir,
				manualPaths
			});

			expect(result.found).toBe(true);
			expect(result.path).toBe('npx @google/gemini-cli');
			expect(result.source).toBe('manual');
		});

		it('应该在手动输入无效时使用自动检测 (PATH)', async () => {
			// 使用系统已存在的命令进行测试
			// 大多数 Unix 系统都有 ls 或 echo
			const result = await detector.detectWithPriority('test-auto', {
				vaultPath: testVaultDir,
				cliCommand: 'ls' // 使用系统命令
			});

			expect(result.found).toBe(true);
			expect(result.path).toContain('ls');
			expect(result.source).toBe('auto');
		});

		it('应该在所有来源都无效时返回未找到', async () => {
			const result = await detector.detectWithPriority('nonexistent', {
				vaultPath: testVaultDir
			});

			expect(result.found).toBe(false);
			expect(result.source).toBe('none');
		});

		it('应该验证每个来源的路径', async () => {
			// Vault 配置有无效路径
			const vaultConfigPath = path.join(testConfigDir, '.acp.json');
			await fs.writeFile(vaultConfigPath, JSON.stringify({
				agents: { kimi: '/nonexistent/kimi' }
			}));

			// 全局配置有有效路径
			await fs.writeFile(globalConfigPath, JSON.stringify({
				agents: { kimi: 'npx kimi' }
			}));

			const result = await detector.detectWithPriority('kimi', {
				vaultPath: testVaultDir,
				globalConfigPath
			});

			// 应该跳过无效的 Vault 配置，使用全局配置
			expect(result.found).toBe(true);
			expect(result.path).toBe('npx kimi');
			expect(result.source).toBe('global-config');
		});
	});

	describe('detectAll', () => {
		it('应该检测所有配置的 Agent', async () => {
			// 设置多个 Agent
			process.env.CLAUDE_CODE_PATH = 'npx @zed-industries/claude-code-acp';

			const vaultConfigPath = path.join(testConfigDir, '.acp.json');
			await fs.writeFile(vaultConfigPath, JSON.stringify({
				agents: {
					kimi: 'npx kimi',
					codex: 'npx @zed-industries/codex-acp'
				}
			}));

			await fs.writeFile(globalConfigPath, JSON.stringify({
				agents: {
					gemini: 'npx @google/gemini-cli'
				}
			}));

			const knownAgents = ['claude', 'kimi', 'codex', 'gemini', 'qwen'];
			const results = await detector.detectAll(knownAgents, {
				vaultPath: testVaultDir,
				globalConfigPath
			});

			// 应该找到 4 个 (claude, kimi, codex, gemini)
			expect(results.length).toBeGreaterThanOrEqual(4);
			const foundIds = results.map(r => r.agentId);
			expect(foundIds).toContain('claude');
			expect(foundIds).toContain('kimi');
			expect(foundIds).toContain('codex');
			expect(foundIds).toContain('gemini');
		});

		it('应该返回每个 Agent 的最高优先级来源', async () => {
			// Claude: 环境变量
			process.env.CLAUDE_CODE_PATH = 'npx @zed-industries/claude-code-acp';

			// Kimi: Vault 配置
			const vaultConfigPath = path.join(testConfigDir, '.acp.json');
			await fs.writeFile(vaultConfigPath, JSON.stringify({
				agents: { kimi: 'npx kimi' }
			}));

			// Codex: 全局配置
			await fs.writeFile(globalConfigPath, JSON.stringify({
				agents: { codex: 'npx @zed-industries/codex-acp' }
			}));

			const results = await detector.detectAll(['claude', 'kimi', 'codex'], {
				vaultPath: testVaultDir,
				globalConfigPath
			});

			const sourceMap = Object.fromEntries(results.map(r => [r.agentId, r.source]));
			expect(sourceMap.claude).toBe('env');
			expect(sourceMap.kimi).toBe('vault-config');
			expect(sourceMap.codex).toBe('global-config');
		});
	});

	describe('getPriorityChain', () => {
		it('应该返回优先级链说明', () => {
			const chain = detector.getPriorityChain('claude');

			expect(chain).toHaveLength(5);
			expect(chain[0].source).toBe('env');
			expect(chain[1].source).toBe('vault-config');
			expect(chain[2].source).toBe('global-config');
			expect(chain[3].source).toBe('manual');
			expect(chain[4].source).toBe('auto');

			expect(chain[0].description).toContain('CLAUDE_CODE_PATH');
		});
	});
});
