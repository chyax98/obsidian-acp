/**
 * 环境变量检测器测试
 *
 * TDD Phase 2: 测试环境变量检测逻辑
 * - 检测 ${AGENT_ID}_PATH 格式的环境变量
 * - 支持变量扩展 (${VAR})
 * - 验证检测到的路径
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EnvDetector } from '../src/acp/env-detector';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('EnvDetector', () => {
	let detector: EnvDetector;
	let testDir: string;
	let originalEnv: NodeJS.ProcessEnv;

	beforeEach(async () => {
		detector = new EnvDetector();
		testDir = '/tmp/acp-test';
		originalEnv = { ...process.env };

		// 创建测试目录
		try {
			await fs.mkdir(testDir, { recursive: true });
		} catch {
			// 目录已存在
		}
	});

	afterEach(() => {
		// 恢复原始环境变量
		process.env = originalEnv;
	});

	describe('detectAgentPath', () => {
		it('应该从环境变量检测 Claude Code 路径', async () => {
			// 创建测试 CLI 文件
			const testCli = path.join(testDir, 'claude-code');
			await fs.writeFile(testCli, '#!/bin/bash\necho "claude"', { mode: 0o755 });

			// 设置环境变量
			process.env.CLAUDE_CODE_PATH = testCli;

			const result = await detector.detectAgentPath('claude');

			expect(result.found).toBe(true);
			expect(result.path).toBe(testCli);
			expect(result.source).toBe('env');
			expect(result.envVar).toBe('CLAUDE_CODE_PATH');
		});

		it('应该从环境变量检测 Kimi 路径', async () => {
			const testCli = path.join(testDir, 'kimi');
			await fs.writeFile(testCli, '#!/bin/bash\necho "kimi"', { mode: 0o755 });

			process.env.KIMI_PATH = testCli;

			const result = await detector.detectAgentPath('kimi');

			expect(result.found).toBe(true);
			expect(result.path).toBe(testCli);
			expect(result.source).toBe('env');
			expect(result.envVar).toBe('KIMI_PATH');
		});

		it('应该支持 npx 命令格式', async () => {
			process.env.CLAUDE_CODE_PATH = 'npx @zed-industries/claude-code-acp';

			const result = await detector.detectAgentPath('claude');

			expect(result.found).toBe(true);
			expect(result.path).toBe('npx @zed-industries/claude-code-acp');
			expect(result.source).toBe('env');
			expect(result.isNpxCommand).toBe(true);
		});

		it('应该扩展环境变量中的路径', async () => {
			process.env.MY_BIN_DIR = testDir;
			process.env.KIMI_PATH = '${MY_BIN_DIR}/kimi';

			const testCli = path.join(testDir, 'kimi');
			await fs.writeFile(testCli, '#!/bin/bash\necho "kimi"', { mode: 0o755 });

			const result = await detector.detectAgentPath('kimi');

			expect(result.found).toBe(true);
			expect(result.path).toBe(testCli);
			expect(result.path).not.toContain('${');
		});

		it('应该支持波浪线扩展', async () => {
			const homeDir = process.env.HOME || '/tmp';
			const testCli = path.join(homeDir, 'kimi-temp');
			await fs.writeFile(testCli, '#!/bin/bash\necho "kimi"', { mode: 0o755 });

			process.env.KIMI_PATH = '~/kimi-temp';

			const result = await detector.detectAgentPath('kimi');

			expect(result.found).toBe(true);
			expect(result.path).toBe(testCli);
			expect(result.path).not.toContain('~');

			// 清理
			await fs.unlink(testCli);
		});

		it('应该在环境变量未设置时返回未找到', async () => {
			delete process.env.CLAUDE_CODE_PATH;

			const result = await detector.detectAgentPath('claude');

			expect(result.found).toBe(false);
			expect(result.path).toBeUndefined();
			expect(result.source).toBe('none');
		});

		it('应该验证环境变量中的路径是否有效', async () => {
			// 设置一个不存在的路径
			process.env.KIMI_PATH = '/nonexistent/kimi';

			const result = await detector.detectAgentPath('kimi');

			expect(result.found).toBe(false);
			expect(result.error).toContain('文件不存在');
		});

		it('应该拒绝没有执行权限的文件', async () => {
			const testCli = path.join(testDir, 'no-exec');
			await fs.writeFile(testCli, 'test', { mode: 0o644 });

			process.env.KIMI_PATH = testCli;

			const result = await detector.detectAgentPath('kimi');

			expect(result.found).toBe(false);
			expect(result.error).toContain('没有执行权限');
		});
	});

	describe('getEnvVarName', () => {
		it('应该生成正确的环境变量名', () => {
			expect(detector.getEnvVarName('claude')).toBe('CLAUDE_CODE_PATH');
			expect(detector.getEnvVarName('kimi')).toBe('KIMI_PATH');
			expect(detector.getEnvVarName('codex')).toBe('CODEX_PATH');
			expect(detector.getEnvVarName('gemini')).toBe('GEMINI_PATH');
			expect(detector.getEnvVarName('qwen')).toBe('QWEN_PATH');
		});

		it('应该处理自定义 Agent ID', () => {
			expect(detector.getEnvVarName('my-agent')).toBe('MY_AGENT_PATH');
			expect(detector.getEnvVarName('test_agent')).toBe('TEST_AGENT_PATH');
		});
	});

	describe('listDetectedAgents', () => {
		it('应该列出所有从环境变量检测到的 Agent', async () => {
			// 设置多个环境变量
			const claudeCli = path.join(testDir, 'claude-code');
			const kimiCli = path.join(testDir, 'kimi');

			await fs.writeFile(claudeCli, '#!/bin/bash\necho "claude"', { mode: 0o755 });
			await fs.writeFile(kimiCli, '#!/bin/bash\necho "kimi"', { mode: 0o755 });

			process.env.CLAUDE_CODE_PATH = claudeCli;
			process.env.KIMI_PATH = kimiCli;
			process.env.CODEX_PATH = 'npx @zed-industries/codex-acp';

			const detected = await detector.listDetectedAgents(['claude', 'kimi', 'codex', 'gemini']);

			expect(detected).toHaveLength(3);
			expect(detected.map(d => d.agentId)).toContain('claude');
			expect(detected.map(d => d.agentId)).toContain('kimi');
			expect(detected.map(d => d.agentId)).toContain('codex');
		});

		it('应该只返回有效的 Agent', async () => {
			process.env.CLAUDE_CODE_PATH = '/nonexistent/claude';
			process.env.KIMI_PATH = 'npx kimi';

			const detected = await detector.listDetectedAgents(['claude', 'kimi']);

			expect(detected).toHaveLength(1);
			expect(detected[0].agentId).toBe('kimi');
		});
	});
});
