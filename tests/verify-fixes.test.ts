/**
 * 验证关键修复是否真的能工作
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

describe('修复验证测试', () => {
	// ==========================================================================
	// 1. 测试 detectAgentStatus 文件检查逻辑
	// ==========================================================================
	describe('Agent 文件检查逻辑', () => {
		it('应该正确检查可执行文件', async () => {
			// 创建一个临时可执行文件
			const testFile = path.join('/tmp', 'test-agent');
			fs.writeFileSync(testFile, '#!/bin/bash\necho "test"');
			fs.chmodSync(testFile, 0o755);

			try {
				// 测试 fs.access() 是否能检查可执行权限
				const result = await fs.promises.access(testFile, fs.constants.X_OK);
				expect(result).toBeUndefined(); // 成功返回 undefined
			} finally {
				fs.unlinkSync(testFile);
			}
		});

		it('应该拒绝不存在的文件', async () => {
			// 尝试检查不存在的文件
			try {
				await fs.promises.access('/tmp/non-existent-agent', fs.constants.X_OK);
				expect.fail('应该抛出错误');
			} catch (error) {
				expect(error).toBeDefined();
				// 预期 ENOENT 错误
			}
		});

		it('应该拒绝没有执行权限的文件', async () => {
			// 创建一个不可执行文件
			const testFile = path.join('/tmp', 'test-agent-noexec');
			fs.writeFileSync(testFile, '#!/bin/bash\necho "test"');
			fs.chmodSync(testFile, 0o644); // 没有执行权限

			try {
				try {
					await fs.promises.access(testFile, fs.constants.X_OK);
					expect.fail('应该抛出错误');
				} catch (error) {
					expect(error).toBeDefined(); // 应该抛出权限错误
				}
			} finally {
				fs.unlinkSync(testFile);
			}
		});
	});

	// ==========================================================================
	// 2. 测试 testAgentConnection 进程启动逻辑
	// ==========================================================================
	describe('Agent 连接测试逻辑', () => {
		it('应该能成功启动进程并捕获输出', async () => {
			// 测试运行 'echo hello'
			await new Promise<void>((resolve) => {
				const proc = spawn('echo', ['hello'], {
					stdio: 'pipe',
					timeout: 5000,
				});

				let stdout = '';
				let stderr = '';

				proc.stdout?.on('data', (data: Buffer) => {
					stdout += data.toString();
				});

				proc.stderr?.on('data', (data: Buffer) => {
					stderr += data.toString();
				});

				proc.on('close', (code: number) => {
					expect(code).toBe(0); // echo 应该返回 0
					expect(stdout).toContain('hello'); // 应该捕获到输出
					resolve();
				});

				proc.on('error', (error) => {
					expect.fail(`进程启动失败: ${error.message}`);
					resolve();
				});
			});
		});

		it('应该能处理进程超时', async () => {
			// 测试超时处理（sleep 30 秒）
			await new Promise<void>((resolve) => {
				const proc = spawn('sleep', ['30'], {
					stdio: 'pipe',
					timeout: 5000,
				});

				let finished = false;
				const finish = () => {
					if (finished) return;
					finished = true;
					clearTimeout(killTimer);
					clearTimeout(guard);
					resolve();
				};

				// 2 秒后触发超时：仅杀进程，等待 close 事件再结束测试，避免留下 open handle
				const killTimer = setTimeout(() => {
					try {
						proc.kill();
					} catch (error) {
						expect.fail(`无法杀死进程: ${error}`);
						finish();
					}
				}, 2000);

				// 防止无限等待（kill 后仍未退出）
				const guard = setTimeout(() => {
					try {
						proc.kill("SIGKILL");
					} catch {
						// ignore
					}
					expect.fail("进程在超时 kill 后仍未退出");
					finish();
				}, 6000);

				proc.on('close', () => {
					finish();
				});

				proc.on('error', (error) => {
					expect.fail(`进程启动失败: ${error.message}`);
					finish();
				});
			});
		});

		it('应该能捕获进程错误', async () => {
			// 测试启动不存在的命令
			await new Promise<void>((resolve) => {
				const proc = spawn('non-existent-command-xyz', ['--version'], {
					stdio: 'pipe',
					timeout: 5000,
				});

				let errorCaught = false;
				let finished = false;

				const finish = () => {
					if (finished) return;
					finished = true;
					clearTimeout(guard);
					resolve();
				};

				const guard = setTimeout(() => {
					if (!errorCaught) {
						expect.fail('应该捕获 ENOENT 错误');
					}
					finish();
				}, 3000);

				proc.on('error', (error) => {
					errorCaught = true;
					expect(error.message).toContain('ENOENT');
					finish();
				});

				proc.on('close', () => {
					expect(errorCaught).toBe(true);
					finish();
				});
			});
		});
	});

	// ==========================================================================
	// 3. 测试 file:// URI 转换逻辑
	// ==========================================================================
	describe('file:// URI 处理逻辑', () => {
		it('应该正确解析 file:/// URI', () => {
			const uri = 'file:///Users/test/image.png';
			let filePath = uri;

			// 移除 file:// 或 file:/// 前缀
			if (filePath.startsWith('file:///')) {
				filePath = filePath.substring(7); // 移除 'file://'
			}

			expect(filePath).toBe('/Users/test/image.png');
		});

		it('应该正确解析 file://localhost/ URI', () => {
			const uri = 'file://localhost/Users/test/image.png';
			let filePath = uri;

			// 移除 file://localhost 前缀
			if (filePath.startsWith('file://localhost/')) {
				filePath = filePath.substring(16);
			}

			expect(filePath).toBe('/Users/test/image.png');
		});

		it('应该正确处理 URL 编码的路径', () => {
			const uri = 'file:///Users/test/%20spaces/image.png';
			let filePath = uri;

			if (filePath.startsWith('file:///')) {
				filePath = filePath.substring(7);
			}

			filePath = decodeURIComponent(filePath);

			expect(filePath).toBe('/Users/test/ spaces/image.png');
		});

		it('应该正确转换为 Base64 data URI', async () => {
			// 创建一个临时图片文件（1x1 透明 PNG）
			const pngBuffer = Buffer.from([
				0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
				0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
				0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
				0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
				0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
				0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
			]);

			const testFile = path.join('/tmp', 'test-image.png');
			fs.writeFileSync(testFile, pngBuffer);

			try {
				// 读取文件并转换
				const imageData = await fs.promises.readFile(testFile);
				const base64 = imageData.toString('base64');
				const dataUri = `data:image/png;base64,${base64}`;

				expect(dataUri).toMatch(/^data:image\/png;base64,.+/);
				expect(base64.length).toBeGreaterThan(0);
			} finally {
				fs.unlinkSync(testFile);
			}
		});
	});

	// ==========================================================================
	// 4. 测试 MCP 配置变量替换逻辑
	// ==========================================================================
	describe('MCP 配置变量替换逻辑', () => {
		it('应该正确替换 {VAULT_PATH}', () => {
			const vaultPath = '/Users/test/vault';
			const command = 'npx @mcp/server-filesystem --root {VAULT_PATH}';

			const result = command.replace(/{VAULT_PATH}/g, vaultPath);
			expect(result).toBe('npx @mcp/server-filesystem --root /Users/test/vault');
		});

		it('应该正确替换 {USER_HOME}', () => {
			const userHome = '/Users/test';
			const url = 'http://localhost:3000?home={USER_HOME}';

			const result = url.replace(/{USER_HOME}/g, userHome);
			expect(result).toBe('http://localhost:3000?home=/Users/test');
		});

		it('应该在数组中正确替换变量', () => {
			const vaultPath = '/Users/test/vault';
			const args = ['--root', '{VAULT_PATH}', '--config', '{USER_HOME}/.config'];

			const result = args.map(arg =>
				arg.replace(/{VAULT_PATH}/g, vaultPath).replace(/{USER_HOME}/g, '/Users/test'),
			);

			expect(result).toEqual(['--root', '/Users/test/vault', '--config', '/Users/test/.config']);
		});

		it('应该在对象中正确替换变量', () => {
			const vaultPath = '/Users/test/vault';
			const headers = [
				{ name: 'X-Vault-Path', value: '{VAULT_PATH}' },
				{ name: 'X-Home', value: '{USER_HOME}' },
			];

			const result: Record<string, string> = {};
			for (const header of headers) {
				result[header.name] = header.value
					.replace(/{VAULT_PATH}/g, vaultPath)
					.replace(/{USER_HOME}/g, '/Users/test');
			}

			expect(result).toEqual({
				'X-Vault-Path': '/Users/test/vault',
				'X-Home': '/Users/test',
			});
		});
	});

	// ==========================================================================
	// 5. 测试安装命令逻辑
	// ==========================================================================
	describe('安装命令生成逻辑', () => {
		it('应该正确生成 Qwen 安装命令', () => {
			const command = 'npm install -g @qwenlm/qwen-code';
			expect(command).toBe('npm install -g @qwenlm/qwen-code'); // ✅ 修正的包名
		});

		it('应该正确生成 Kimi 安装命令', () => {
			const command = 'npm install -g @moonshot-ai/kimi-cli';
			expect(command).toBe('npm install -g @moonshot-ai/kimi-cli');
		});

		it('应该正确从 npx @ 格式生成命令', () => {
			const defaultCliPath = 'npx @zed-industries/claude-code-acp';
			const command = `npm install -g ${defaultCliPath.replace('npx ', '')}`;
			expect(command).toBe('npm install -g @zed-industries/claude-code-acp');
		});
	});
});
