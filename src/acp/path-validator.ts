/**
 * 路径验证器
 *
 * 负责验证 Agent CLI 路径的有效性
 * - 检查文件是否存在
 * - 检查是否有执行权限
 * - 支持 npx 命令格式
 * - 扩展波浪线和环境变量
 * - 可选地验证版本信息
 *
 * TDD: 测试驱动开发 (Green Phase - 实现代码)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 验证选项
 */
export interface ValidateOptions {
	/**
	 * 是否检查版本信息
	 */
	checkVersion?: boolean;

	/**
	 * 版本检查使用的 flag (默认 --version)
	 */
	versionFlag?: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
	/**
	 * 是否有效
	 */
	isValid: boolean;

	/**
	 * 扩展后的完整路径
	 */
	path?: string;

	/**
	 * 错误信息
	 */
	error?: string;

	/**
	 * 版本信息
	 */
	version?: string;

	/**
	 * 是否为 npx 命令
	 */
	isNpxCommand?: boolean;

	/**
	 * 是否已检查版本
	 */
	versionChecked?: boolean;

	/**
	 * Agent ID
	 */
	agentId?: string;
}

/**
 * npx 命令解析结果
 */
export interface NpxCommand {
	/**
	 * 是否为 npx 命令
	 */
	isNpx: boolean;

	/**
	 * NPM 包名
	 */
	package: string;

	/**
	 * 额外参数
	 */
	args: string[];
}

/**
 * 路径验证器
 */
export class PathValidator {
	/**
	 * 验证路径
	 *
	 * @param pathStr - 要验证的路径
	 * @param options - 验证选项
	 * @returns 验证结果
	 */
	public async validatePath(
		pathStr: string,
		options: ValidateOptions = {},
	): Promise<ValidationResult> {
		// 检查空路径
		if (!pathStr || pathStr.trim() === '') {
			return {
				isValid: false,
				error: '路径不能为空',
			};
		}

		// 检查是否为 npx 命令
		const npxInfo = this.getNpxCommand(pathStr);
		if (npxInfo.isNpx) {
			// npx 命令总是有效的 (假设 npx 存在)
			// 在实际执行时才会知道包是否存在
			const result: ValidationResult = {
				isValid: true,
				path: pathStr,
				isNpxCommand: true,
			};

			// 可选地检查版本
			if (options.checkVersion) {
				result.versionChecked = true;
				try {
					const versionFlag = options.versionFlag || '--version';
					const { stdout } = await execAsync(`${pathStr} ${versionFlag}`);
					result.version = stdout.trim();
				} catch (err) {
					// npx 命令可能不支持 --version,但仍然有效
					result.version = undefined;
				}
			}

			return result;
		}

		// 扩展路径
		const expandedPath = this.expandPath(pathStr);

		// 检查文件是否存在
		try {
			const stats = await fs.stat(expandedPath);

			if (!stats.isFile()) {
				return {
					isValid: false,
					path: expandedPath,
					error: `文件不存在: ${expandedPath}`,
				};
			}
		} catch (err) {
			return {
				isValid: false,
				path: expandedPath,
				error: `文件不存在: ${expandedPath}`,
			};
		}

		// 检查执行权限 (Unix-like 系统)
		if (process.platform !== 'win32') {
			try {
				await fs.access(expandedPath, fs.constants.X_OK);
			} catch (err) {
				return {
					isValid: false,
					path: expandedPath,
					error: `文件没有执行权限: ${expandedPath}`,
				};
			}
		}

		// 构建基础结果
		const result: ValidationResult = {
			isValid: true,
			path: expandedPath,
			isNpxCommand: false,
		};

		// 可选地检查版本
		if (options.checkVersion) {
			result.versionChecked = true;
			try {
				const versionFlag = options.versionFlag || '--version';
				const { stdout } = await execAsync(`${expandedPath} ${versionFlag}`);
				result.version = stdout.trim();
			} catch (err) {
				// 版本检查失败不影响路径有效性
				result.version = undefined;
			}
		}

		return result;
	}

	/**
	 * 验证 Agent CLI 路径
	 *
	 * @param agentId - Agent ID
	 * @param pathStr - CLI 路径
	 * @param options - 验证选项
	 * @returns 验证结果
	 */
	public async validateAgentCli(
		agentId: string,
		pathStr: string,
		options: ValidateOptions = {},
	): Promise<ValidationResult> {
		const result = await this.validatePath(pathStr, options);

		// 添加 agentId
		return {
			...result,
			agentId,
		};
	}

	/**
	 * 扩展路径
	 *
	 * 支持:
	 * - 波浪线 (~) 扩展为用户主目录
	 * - 环境变量 (${VAR}) 扩展
	 *
	 * @param pathStr - 原始路径
	 * @returns 扩展后的路径
	 */
	public expandPath(pathStr: string): string {
		let expanded = pathStr;

		// 扩展波浪线
		if (expanded.startsWith('~')) {
			const homeDir = process.env.HOME || process.env.USERPROFILE || '/';
			expanded = expanded.replace('~', homeDir);
		}

		// 扩展环境变量 (${VAR} 格式)
		expanded = expanded.replace(/\$\{([^}]+)\}/g, (match, varName) => {
			return process.env[varName] || match;
		});

		return expanded;
	}

	/**
	 * 解析 npx 命令
	 *
	 * @param command - 命令字符串
	 * @returns npx 命令信息
	 */
	public getNpxCommand(command: string): NpxCommand {
		const trimmed = command.trim();

		// 检查是否以 npx 开头
		if (!trimmed.startsWith('npx ')) {
			return {
				isNpx: false,
				package: '',
				args: [],
			};
		}

		// 分割参数
		const parts = trimmed.split(/\s+/);
		parts.shift(); // 移除 'npx'

		if (parts.length === 0) {
			return {
				isNpx: false,
				package: '',
				args: [],
			};
		}

		// 第一个参数是包名
		const packageName = parts[0];
		const args = parts.slice(1);

		return {
			isNpx: true,
			package: packageName,
			args,
		};
	}
}
