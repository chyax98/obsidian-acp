#!/bin/bash
# 开发脚本 - 构建并自动复制到 Obsidian 插件目录

VAULT_PATH="$HOME/note-vsc"
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/obsidian-acp"

echo "🔨 构建插件..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "📦 复制到插件目录..."
    mkdir -p "$PLUGIN_DIR"
    cp -v main.js "$PLUGIN_DIR/main.js"
    cp -v manifest.json "$PLUGIN_DIR/manifest.json"
    cp -v styles.css "$PLUGIN_DIR/styles.css"

    echo ""
    echo "✅ 完成！请在 Obsidian 中重新加载插件"
    echo "   设置 → Community plugins → 关闭后重新打开 ACP Plugin"
else
    echo "❌ 构建失败"
    exit 1
fi
