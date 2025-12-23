#!/bin/bash

# 开发部署脚本 - 构建并复制到 Obsidian 插件目录

set -e

PLUGIN_DIR="$HOME/note-vsc/.obsidian/plugins/obsidian-acp"

echo "🔨 构建插件..."
npm run build

echo ""
echo "📦 复制到插件目录..."
mkdir -p "$PLUGIN_DIR"
cp main.js "$PLUGIN_DIR/"
cp manifest.json "$PLUGIN_DIR/"
cp styles.css "$PLUGIN_DIR/"

echo ""
echo "✅ 完成！请在 Obsidian 中重新加载插件"
