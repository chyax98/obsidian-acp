#!/usr/bin/env node

/**
 * 部署插件到 Obsidian Vault
 *
 * 用法: npm run deploy -- /path/to/vault
 */

import { existsSync, mkdirSync, copyFileSync } from "fs";
import { join } from "path";

const vaultPath = process.argv[2];

if (!vaultPath) {
	console.error("❌ 请提供 Vault 路径");
	console.error("");
	console.error("用法: npm run deploy -- /path/to/vault");
	console.error("示例: npm run deploy -- ~/note-vsc");
	process.exit(1);
}

// 检查 Vault 是否存在
if (!existsSync(vaultPath)) {
	console.error(`❌ 目录不存在: ${vaultPath}`);
	process.exit(1);
}

// 检查是否是 Obsidian Vault
const obsidianDir = join(vaultPath, ".obsidian");
if (!existsSync(obsidianDir)) {
	console.error(`⚠️  警告: 未找到 .obsidian 目录，可能不是 Obsidian Vault`);
}

// 检查构建产物是否存在
if (!existsSync("main.js")) {
	console.error("❌ main.js 不存在，请先运行 npm run build");
	process.exit(1);
}

const pluginDir = join(vaultPath, ".obsidian", "plugins", "obsidian-acp");

console.log(`📦 部署到: ${pluginDir}`);

// 创建插件目录
mkdirSync(pluginDir, { recursive: true });

// 复制文件
const files = ["main.js", "manifest.json", "styles.css"];
for (const file of files) {
	if (existsSync(file)) {
		copyFileSync(file, join(pluginDir, file));
		console.log(`   ✓ ${file}`);
	}
}

console.log("");
console.log("✅ 部署完成！请在 Obsidian 中重新加载插件");
