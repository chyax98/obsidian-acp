#!/bin/bash

# ACP 插件安装脚本
# 用法: ./install-to-vault.sh /path/to/your/vault

set -e

if [ -z "$1" ]; then
    echo "❌ 错误: 请提供 Vault 路径"
    echo "用法: ./install-to-vault.sh /path/to/your/vault"
    echo ""
    echo "示例:"
    echo "  ./install-to-vault.sh ~/Documents/MyVault"
    exit 1
fi

VAULT_PATH="$1"
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/obsidian-acp"

echo "📦 安装 ACP 插件到: $VAULT_PATH"
echo ""

# 检查 Vault 是否存在
if [ ! -d "$VAULT_PATH" ]; then
    echo "❌ 错误: Vault 目录不存在: $VAULT_PATH"
    exit 1
fi

# 检查是否是 Obsidian Vault
if [ ! -d "$VAULT_PATH/.obsidian" ]; then
    echo "⚠️  警告: 未找到 .obsidian 目录，可能不是有效的 Vault"
    read -p "是否继续? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 创建插件目录
echo "📁 创建插件目录..."
mkdir -p "$PLUGIN_DIR"

# 检查构建文件
if [ ! -f "main.js" ]; then
    echo "❌ 错误: main.js 不存在，请先运行 npm run build"
    exit 1
fi

# 复制文件
echo "📋 复制文件..."
cp main.js "$PLUGIN_DIR/"
cp manifest.json "$PLUGIN_DIR/"
cp styles.css "$PLUGIN_DIR/"

echo ""
echo "✅ 安装完成！"
echo ""
echo "下一步:"
echo "1. 重启 Obsidian"
echo "2. 打开 设置 → 第三方插件"
echo "3. 找到并启用 'ACP Agent Client'"
echo "4. 点击左侧栏的机器人图标打开 ChatView"
echo ""
echo "📖 详细使用指南: README.md"
