/**
 * 配置文件检测器测试
 *
 * TDD Phase 3: 测试配置文件检测逻辑
 * - 支持 Vault 配置文件 (.obsidian/plugins/obsidian-acp/.acp.json)
 * - 支持全局配置文件 (~/.acprc)
 * - JSON 格式验证
 * - 路径扩展支持
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ConfigDetector } from '../src/acp/config-detector';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('ConfigDetector', () => {
	let detector: ConfigDetector;
	let testVaultDir: string;
	let testConfigDir: string;
	let globalConfigPath: string;

	beforeEach(async () => {
		detector = new ConfigDetector();
		testVaultDir = '/tmp/acp-test-vault';
		testConfigDir = path.join(testVaultDir, '.obsidian', 'plugins', 'obsidian-acp');
		globalConfigPath = path.join(process.env.HOME || '/tmp', '.acprc-test');

		// 创建测试目录
		await fs.mkdir(testConfigDir, { recursive: true });
	});

	afterEach(async () => {
		// 清理测试文件
		try {
			await fs.rm(testVaultDir, { recursive: true, force: true });
			await fs.unlink(globalConfigPath);
		} catch {
			// 忽略清理错误
		}
	});

	describe('loadVaultConfig', () => {
		it('应该加载 Vault 配置文件', async () => {
			const configPath = path.join(testConfigDir, '.acp.json');
			const config = {
				agents: {
					claude: 'npx @zed-industries/claude-code-acp',
					kimi: '/usr/local/bin/kimi'
				}
			};

			await fs.writeFile(configPath, JSON.stringify(config, null, 2));

			const result = await detector.loadVaultConfig(testVaultDir);

			expect(result.loaded).toBe(true);
			expect(result.configPath).toBe(configPath);
			expect(result.agents).toHaveProperty('claude');
			expect(result.agents).toHaveProperty('kimi');
		});

		it('应该在配置文件不存在时返回空结果', async () => {
			const result = await detector.loadVaultConfig('/nonexistent/vault');

			expect(result.loaded).toBe(false);
			expect(result.agents).toEqual({});
		});

		it('应该处理无效的 JSON', async () => {
			const configPath = path.join(testConfigDir, '.acp.json');
			await fs.writeFile(configPath, 'invalid json{');

			const result = await detector.loadVaultConfig(testVaultDir);

			expect(result.loaded).toBe(false);
			expect(result.error).toContain('JSON');
		});

		it('应该扩展配置中的路径变量', async () => {
			const configPath = path.join(testConfigDir, '.acp.json');
			const config = {
				agents: {
					kimi: '~/bin/kimi',
					claude: '${HOME}/tools/claude-code'
				}
			};

			await fs.writeFile(configPath, JSON.stringify(config, null, 2));

			const result = await detector.loadVaultConfig(testVaultDir);

			expect(result.loaded).toBe(true);
			expect(result.agents.kimi).not.toContain('~');
			expect(result.agents.claude).not.toContain('${');
		});
	});

	describe('loadGlobalConfig', () => {
		it('应该加载全局配置文件', async () => {
			const config = {
				agents: {
					claude: 'npx @zed-industries/claude-code-acp',
					codex: 'npx @zed-industries/codex-acp',
					gemini: 'npx @google/gemini-cli'
				}
			};

			await fs.writeFile(globalConfigPath, JSON.stringify(config, null, 2));

			const result = await detector.loadGlobalConfig(globalConfigPath);

			expect(result.loaded).toBe(true);
			expect(result.configPath).toBe(globalConfigPath);
			expect(Object.keys(result.agents)).toHaveLength(3);
		});

		it('应该支持默认路径 ~/.acprc', async () => {
			const defaultPath = path.join(process.env.HOME || '/tmp', '.acprc-test-default');
			const config = {
				agents: {
					kimi: 'npx kimi'
				}
			};

			await fs.writeFile(defaultPath, JSON.stringify(config, null, 2));

			const result = await detector.loadGlobalConfig(defaultPath);

			expect(result.loaded).toBe(true);

			// 清理
			await fs.unlink(defaultPath);
		});

		it('应该在配置文件不存在时返回空结果', async () => {
			const result = await detector.loadGlobalConfig('/nonexistent/.acprc');

			expect(result.loaded).toBe(false);
			expect(result.agents).toEqual({});
		});
	});

	describe('detectAgentPath', () => {
		it('应该优先使用 Vault 配置', async () => {
			// Vault 配置 (使用 npx 命令避免文件验证)
			const vaultConfigPath = path.join(testConfigDir, '.acp.json');
			await fs.writeFile(vaultConfigPath, JSON.stringify({
				agents: {
					claude: 'npx @zed-industries/claude-code-acp'
				}
			}));

			// 全局配置
			await fs.writeFile(globalConfigPath, JSON.stringify({
				agents: {
					claude: 'npx kimi'
				}
			}));

			const result = await detector.detectAgentPath('claude', testVaultDir, globalConfigPath);

			expect(result.found).toBe(true);
			expect(result.path).toBe('npx @zed-industries/claude-code-acp');
			expect(result.source).toBe('vault-config');
		});

		it('应该在 Vault 配置不存在时使用全局配置', async () => {
			// 只有全局配置
			await fs.writeFile(globalConfigPath, JSON.stringify({
				agents: {
					kimi: 'npx kimi'
				}
			}));

			const result = await detector.detectAgentPath('kimi', testVaultDir, globalConfigPath);

			expect(result.found).toBe(true);
			expect(result.path).toBe('npx kimi');
			expect(result.source).toBe('global-config');
		});

		it('应该验证配置中的路径', async () => {
			const configPath = path.join(testConfigDir, '.acp.json');
			await fs.writeFile(configPath, JSON.stringify({
				agents: {
					kimi: '/nonexistent/kimi'
				}
			}));

			const result = await detector.detectAgentPath('kimi', testVaultDir);

			expect(result.found).toBe(false);
			expect(result.error).toBeDefined();
		});

		it('应该支持 npx 命令', async () => {
			const configPath = path.join(testConfigDir, '.acp.json');
			await fs.writeFile(configPath, JSON.stringify({
				agents: {
					claude: 'npx @zed-industries/claude-code-acp'
				}
			}));

			const result = await detector.detectAgentPath('claude', testVaultDir);

			expect(result.found).toBe(true);
			expect(result.isNpxCommand).toBe(true);
		});
	});

	describe('listConfiguredAgents', () => {
		it('应该列出所有配置的 Agent', async () => {
			const configPath = path.join(testConfigDir, '.acp.json');
			await fs.writeFile(configPath, JSON.stringify({
				agents: {
					claude: 'npx @zed-industries/claude-code-acp',
					kimi: 'npx kimi',
					codex: 'npx @zed-industries/codex-acp'
				}
			}));

			const result = await detector.listConfiguredAgents(testVaultDir);

			expect(result).toHaveLength(3);
			expect(result.map(r => r.agentId)).toContain('claude');
			expect(result.map(r => r.agentId)).toContain('kimi');
			expect(result.map(r => r.agentId)).toContain('codex');
		});

		it('应该合并 Vault 和全局配置', async () => {
			// Vault 配置
			const vaultConfigPath = path.join(testConfigDir, '.acp.json');
			await fs.writeFile(vaultConfigPath, JSON.stringify({
				agents: {
					claude: 'npx @zed-industries/claude-code-acp'
				}
			}));

			// 全局配置
			await fs.writeFile(globalConfigPath, JSON.stringify({
				agents: {
					kimi: 'npx kimi',
					codex: 'npx @zed-industries/codex-acp'
				}
			}));

			const result = await detector.listConfiguredAgents(testVaultDir, globalConfigPath);

			expect(result.length).toBeGreaterThanOrEqual(1);
			const agentIds = result.map(r => r.agentId);
			expect(agentIds).toContain('claude'); // Vault 配置的应该存在
		});
	});

	describe('saveVaultConfig', () => {
		it('应该保存 Vault 配置', async () => {
			const agents = {
				claude: 'npx @zed-industries/claude-code-acp',
				kimi: '/usr/local/bin/kimi'
			};

			await detector.saveVaultConfig(testVaultDir, agents);

			const configPath = path.join(testConfigDir, '.acp.json');
			const content = await fs.readFile(configPath, 'utf-8');
			const config = JSON.parse(content);

			expect(config.agents).toEqual(agents);
		});

		it('应该创建目录如果不存在', async () => {
			const newVault = '/tmp/acp-test-new-vault';

			await detector.saveVaultConfig(newVault, {
				claude: 'npx @zed-industries/claude-code-acp'
			});

			const configPath = path.join(newVault, '.obsidian', 'plugins', 'obsidian-acp', '.acp.json');
			const exists = await fs.access(configPath).then(() => true).catch(() => false);

			expect(exists).toBe(true);

			// 清理
			await fs.rm(newVault, { recursive: true, force: true });
		});
	});
});
