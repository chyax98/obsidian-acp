#!/bin/bash

# ACP 插件安装脚本
# 用法: ./install-to-vault.sh [vault_path]
#
# 如果不提供路径，将使用环境变量 ACP_DEV_VAULT 或提示输入

set -e

# 确定 Vault 路径
if [ -n "$1" ]; then
    VAULT_PATH="$1"
elif [ -n "$ACP_DEV_VAULT" ]; then
    VAULT_PATH="$ACP_DEV_VAULT"
    echo "📍 使用环境变量 ACP_DEV_VAULT: $VAULT_PATH"
else
    echo "❌ 错误: 请提供 Vault 路径"
    echo ""
    echo "用法:"
    echo "  ./install-to-vault.sh /path/to/vault"
    echo ""
    echo "或设置环境变量:"
    echo "  export ACP_DEV_VAULT=~/your-vault"
    echo "  ./install-to-vault.sh"
    exit 1
fi

PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/obsidian-acp"

echo "📦 安装 ACP 插件到: $VAULT_PATH"
echo ""

# 检查 Vault 是否存在
if [ ! -d "$VAULT_PATH" ]; then
    echo "❌ 错误: 目录不存在: $VAULT_PATH"
    exit 1
fi

# 检查是否是 Obsidian Vault
if [ ! -d "$VAULT_PATH/.obsidian" ]; then
    echo "⚠️  警告: 未找到 .obsidian 目录"
    read -p "是否继续? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 构建（如果 main.js 不存在或有 --build 参数）
if [ ! -f "main.js" ] || [ "$2" = "--build" ]; then
    echo "🔨 构建插件..."
    npm run build
    echo ""
fi

# 创建插件目录
mkdir -p "$PLUGIN_DIR"

# 复制文件
echo "📋 复制文件..."
cp main.js "$PLUGIN_DIR/"
cp manifest.json "$PLUGIN_DIR/"
cp styles.css "$PLUGIN_DIR/"

echo ""
echo "✅ 安装完成！"
echo ""
echo "下一步: 在 Obsidian 中重新加载插件"
