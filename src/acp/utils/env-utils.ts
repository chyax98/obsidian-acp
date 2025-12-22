/**
 * 环境变量工具类
 *
 * 处理不同版本管理器（nvm, nvm-windows 等）的环境变量增强
 */

/**
 * 增强环境变量以支持版本管理器（nvm）
 *
 * 当 CLI 路径包含 .nvm 时，自动添加对应的 bin 目录到 PATH，
 * 解决 Node.js 脚本（#!/usr/bin/env node）找不到 node 的问题。
 *
 * @param cliPath - CLI 可执行文件路径
 * @param baseEnv - 基础环境变量（默认 process.env）
 * @returns 增强后的环境变量
 *
 * @example
 * // Unix/macOS nvm
 * const env = enhanceEnvForNodeScript(
 *   '/Users/xxx/.nvm/versions/node/v22.21.1/bin/claude-code-acp'
 * );
 * // env.PATH 会包含 /Users/xxx/.nvm/versions/node/v22.21.1/bin
 *
 * @example
 * // Windows nvm-windows
 * const env = enhanceEnvForNodeScript(
 *   'C:\\Users\\xxx\\AppData\\Roaming\\nvm\\v22.21.1\\claude-code-acp.exe'
 * );
 * // env.PATH 会包含 C:\Users\xxx\AppData\Roaming\nvm\v22.21.1
 */
export function enhanceEnvForNodeScript(
	cliPath: string,
	baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	const env = { ...baseEnv };

	// 跳过 npx 命令（npx 会自己处理环境）
	if (cliPath.startsWith("npx ")) {
		return env;
	}

	// 检测并处理 Unix/macOS nvm 路径
	// 格式: /Users/xxx/.nvm/versions/node/v22.21.1/bin/command
	// 或: /home/xxx/.nvm/versions/node/v22.21.1/bin/command
	if (cliPath.includes("/.nvm/")) {
		const binDirMatch = cliPath.match(
			/^(.+\/\.nvm\/versions\/[^/]+\/[^/]+\/bin)\//,
		);
		if (binDirMatch) {
			const nvmBinDir = binDirMatch[1];
			const pathSeparator = ":";
			env.PATH = `${nvmBinDir}${pathSeparator}${env.PATH || ""}`;
			// eslint-disable-next-line no-console
			console.log(
				`[EnvUtils] 检测到 Unix nvm 路径，添加到 PATH: ${nvmBinDir}`,
			);
			return env;
		}
	}

	// 检测并处理 Windows nvm-windows 路径
	// 格式: C:\Users\xxx\AppData\Roaming\nvm\v22.21.1\command.exe
	if (
		process.platform === "win32" &&
		/[/\\]nvm[/\\]v\d+\.\d+\.\d+[/\\]/i.test(cliPath)
	) {
		const binDirMatch = cliPath.match(
			/^(.+[/\\]nvm[/\\]v\d+\.\d+\.\d+)[/\\]/i,
		);
		if (binDirMatch) {
			const nvmBinDir = binDirMatch[1];
			const pathSeparator = ";";
			env.PATH = `${nvmBinDir}${pathSeparator}${env.PATH || ""}`;
			// 使用 console.warn 避免 no-console 警告
			// eslint-disable-next-line no-console
			console.log(
				`[EnvUtils] 检测到 Windows nvm 路径，添加到 PATH: ${nvmBinDir}`,
			);
			return env;
		}
	}

	// 未检测到特殊路径，返回原始环境
	return env;
}
