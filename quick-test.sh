#!/bin/bash

# Obsidian ACP Plugin - 快速测试脚本
# 用于验证插件部署和 Agent CLI 安装

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Obsidian ACP Plugin - 快速测试"
echo "=================================="
echo ""

# 1. 检查插件部署
echo "📦 检查插件部署..."
PLUGIN_DIR="$HOME/note-vsc/.obsidian/plugins/obsidian-acp"

if [ -f "$PLUGIN_DIR/main.js" ]; then
    SIZE=$(du -h "$PLUGIN_DIR/main.js" | cut -f1)
    echo -e "${GREEN}✅ 插件已部署${NC}: $PLUGIN_DIR/main.js ($SIZE)"
else
    echo -e "${RED}❌ 插件未部署${NC}"
    exit 1
fi

echo ""

# 2. 检查 Agent CLI 安装
echo "🤖 检查 Agent CLI 安装..."

check_cli() {
    CMD=$1
    NAME=$2
    if command -v $CMD &> /dev/null; then
        VERSION=$($CMD --version 2>&1 | head -1)
        echo -e "${GREEN}✅ $NAME${NC}: $VERSION"
        return 0
    else
        echo -e "${YELLOW}⚠️  $NAME 未安装${NC}"
        return 1
    fi
}

FOUND_COUNT=0

# 检查 Qwen Code
if check_cli "qwen" "Qwen Code"; then
    ((FOUND_COUNT++))
fi

# 检查 Kimi
if check_cli "kimi" "Kimi CLI"; then
    ((FOUND_COUNT++))
fi

# 检查 Gemini
if check_cli "gemini" "Gemini CLI"; then
    ((FOUND_COUNT++))
fi

# 检查 Claude Code（使用 npx）
echo -n "检查 Claude Code (npx)... "
if npx @zed-industries/claude-code-acp --version &> /dev/null; then
    echo -e "${GREEN}✅ 可用${NC}"
    ((FOUND_COUNT++))
else
    echo -e "${YELLOW}⚠️  不可用 (需要 ANTHROPIC_API_KEY)${NC}"
fi

echo ""
echo "发现 $FOUND_COUNT 个可用的 Agent CLI"

if [ $FOUND_COUNT -eq 0 ]; then
    echo -e "${RED}❌ 没有可用的 Agent CLI${NC}"
    echo ""
    echo "推荐安装 Qwen Code（完全免费）："
    echo "  npm install -g qwen-code"
    exit 1
fi

echo ""

# 3. 检查环境变量
echo "🔑 检查 API Keys..."

if [ ! -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${GREEN}✅ ANTHROPIC_API_KEY 已设置${NC}"
else
    echo -e "${YELLOW}⚠️  ANTHROPIC_API_KEY 未设置（Claude Code 需要）${NC}"
fi

if [ ! -z "$OPENAI_API_KEY" ]; then
    echo -e "${GREEN}✅ OPENAI_API_KEY 已设置${NC}"
else
    echo -e "${YELLOW}⚠️  OPENAI_API_KEY 未设置（Codex 需要）${NC}"
fi

if [ ! -z "$GOOGLE_API_KEY" ]; then
    echo -e "${GREEN}✅ GOOGLE_API_KEY 已设置${NC}"
else
    echo -e "${YELLOW}⚠️  GOOGLE_API_KEY 未设置（Gemini 需要）${NC}"
fi

echo ""

# 4. 检查 Obsidian vault
echo "📂 检查 Obsidian Vault..."
VAULT_DIR="$HOME/note-vsc"

if [ -d "$VAULT_DIR/.obsidian" ]; then
    FILE_COUNT=$(find "$VAULT_DIR" -name "*.md" -type f | wc -l | tr -d ' ')
    echo -e "${GREEN}✅ Vault 有效${NC}: $VAULT_DIR ($FILE_COUNT 个 .md 文件)"
else
    echo -e "${RED}❌ Vault 无效${NC}"
    exit 1
fi

echo ""

# 5. 总结
echo "=================================="
echo "📊 测试总结"
echo "=================================="
echo -e "✅ 插件已部署到 vault"
echo -e "✅ 发现 $FOUND_COUNT 个可用的 Agent CLI"

if [ $FOUND_COUNT -gt 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 准备就绪！${NC}"
    echo ""
    echo "下一步："
    echo "1. 打开 Obsidian: open -a Obsidian ~/note-vsc"
    echo "2. 启用插件: 设置 → 社区插件 → 启用 'ACP Agent Client'"
    echo "3. 打开 ACP Chat: 点击左侧工具栏的 🤖 图标"
    echo "4. 选择 Agent 并点击'连接'"
    echo ""
    echo "详细测试指南: /Users/chyax/tmp/obsidian-acp/DEPLOYMENT_TEST_GUIDE.md"
else
    echo ""
    echo -e "${YELLOW}⚠️  需要安装至少一个 Agent CLI${NC}"
    echo ""
    echo "推荐安装："
    echo "  npm install -g qwen-code        # 完全免费"
    echo "  npm install -g @moonshot-ai/kimi-cli  # 中文友好"
fi

echo ""


