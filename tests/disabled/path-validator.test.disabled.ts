/**
 * 路径验证器测试
 *
 * TDD: 测试驱动开发
 * - 先写测试，定义期望行为
 * - 再写实现，满足测试
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PathValidator, ValidationResult } from '../src/acp/path-validator';

describe('PathValidator', () => {
	let validator: PathValidator;
	let testDir: string;

	beforeEach(async () => {
		validator = new PathValidator();
		testDir = '/tmp/acp-test';

		// 创建测试目录
		try {
			await fs.mkdir(testDir, { recursive: true });
		} catch {
			// 目录已存在
		}
	});

	describe('validatePath', () => {
		it('应该拒绝空路径', async () => {
			const result = await validator.validatePath('');

			expect(result.isValid).toBe(false);
			expect(result.error).toBe('路径不能为空');
		});

		it('应该拒绝不存在的文件', async () => {
			const result = await validator.validatePath('/nonexistent/path/to/cli');

			expect(result.isValid).toBe(false);
			expect(result.error).toContain('文件不存在');
		});

		it('应该接受存在的可执行文件', async () => {
			// 创建一个测试可执行文件
			const testFile = path.join(testDir, 'test-cli');
			await fs.writeFile(testFile, '#!/bin/bash\necho "test"', { mode: 0o755 });

			const result = await validator.validatePath(testFile);

			expect(result.isValid).toBe(true);
			expect(result.path).toBe(testFile);
			expect(result.error).toBeUndefined();
		});

		it('应该拒绝没有执行权限的文件', async () => {
			// 创建一个没有执行权限的文件
			const testFile = path.join(testDir, 'no-exec');
			await fs.writeFile(testFile, 'test', { mode: 0o644 });

			const result = await validator.validatePath(testFile);

			expect(result.isValid).toBe(false);
			expect(result.error).toContain('没有执行权限');
		});

		it('应该支持 npx 命令格式', async () => {
			const result = await validator.validatePath('npx @zed-industries/claude-code-acp');

			// npx 命令应该被接受（假设 npx 存在）
			expect(result.isValid).toBe(true);
			expect(result.isNpxCommand).toBe(true);
		});

		it('应该扩展波浪线路径', async () => {
			const result = await validator.validatePath('~/test-cli');

			// 路径应该被扩展为绝对路径
			expect(result.path).not.toContain('~');
			expect(result.path).toContain(process.env.HOME || '/');
		});

		it('应该验证命令的版本信息', async () => {
			// 使用系统的 echo 命令作为测试
			const result = await validator.validatePath('/bin/echo', {
				checkVersion: true,
				versionFlag: '--version'
			});

			expect(result.isValid).toBe(true);
			// echo 可能没有 --version，但应该尝试过
			expect(result.versionChecked).toBe(true);
		});
	});

	describe('validateAgentCli', () => {
		it('应该验证 Claude Code 路径', async () => {
			const result = await validator.validateAgentCli('claude', 'npx @zed-industries/claude-code-acp');

			expect(result.isValid).toBe(true);
			expect(result.agentId).toBe('claude');
		});

		it('应该验证 Kimi 路径', async () => {
			// 创建模拟的 kimi 可执行文件
			const kimiPath = path.join(testDir, 'kimi');
			await fs.writeFile(kimiPath, '#!/bin/bash\necho "kimi"', { mode: 0o755 });

			const result = await validator.validateAgentCli('kimi', kimiPath);

			expect(result.isValid).toBe(true);
			expect(result.agentId).toBe('kimi');
		});

		it.skip('应该检测并返回版本信息', async () => {
		// 跳过原因：此测试需要实际运行 npx，可能：
		// 1. 超时（10秒）- npx 下载包需要时间
		// 2. 失败 - 需要网络、认证、或 Claude Code 未安装
		// 3. 在 CI/CD 环境中不稳定
		// 如需运行，请确保已安装 Claude Code 并移除 .skip
			const result = await validator.validateAgentCli(
				'claude',
				'npx @zed-industries/claude-code-acp',
				{ checkVersion: true }
			);

			if (result.isValid) {
				expect(result.version).toBeDefined();
			}
		});
	});

	describe('expandPath', () => {
		it('应该扩展 ~ 为用户主目录', () => {
			const expanded = validator.expandPath('~/test');

			expect(expanded).not.toContain('~');
			expect(expanded).toContain(process.env.HOME || '/');
		});

		it('应该扩展环境变量', () => {
			process.env.TEST_VAR = '/test/path';
			const expanded = validator.expandPath('${TEST_VAR}/cli');

			expect(expanded).toBe('/test/path/cli');
		});

		it('应该处理绝对路径', () => {
			const expanded = validator.expandPath('/usr/local/bin/test');

			expect(expanded).toBe('/usr/local/bin/test');
		});
	});

	describe('getNpxCommand', () => {
		it('应该识别 npx 命令', () => {
			const result = validator.getNpxCommand('npx @zed-industries/claude-code-acp');

			expect(result).toEqual({
				isNpx: true,
				package: '@zed-industries/claude-code-acp',
				args: []
			});
		});

		it('应该识别带参数的 npx 命令', () => {
			const result = validator.getNpxCommand('npx @zed-industries/claude-code-acp --version');

			expect(result.isNpx).toBe(true);
			expect(result.package).toBe('@zed-industries/claude-code-acp');
			expect(result.args).toContain('--version');
		});

		it('应该拒绝非 npx 命令', () => {
			const result = validator.getNpxCommand('/usr/local/bin/kimi');

			expect(result.isNpx).toBe(false);
		});
	});
});
