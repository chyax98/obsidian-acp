#!/bin/bash

# 快速配置脚本：在设置文件中添加 Agent 路径

VAULT_PATH="$HOME/note-vsc"
DATA_FILE="$VAULT_PATH/.obsidian/plugins/obsidian-acp/data.json"

# 检查 data.json 是否存在
if [ ! -f "$DATA_FILE" ]; then
    echo "创建配置文件..."
    cat > "$DATA_FILE" << 'EOF'
{
  "selectedBackend": "claude",
  "customCliPath": "",
  "workingDir": "vault",
  "backendPaths": {
    "kimi": "/Users/Apple/.local/bin/kimi"
  },
  "showToolCallDetails": true,
  "autoApproveRead": false,
  "debugMode": false
}
EOF
    echo "✅ 已添加 kimi 路径到配置"
else
    echo "ℹ️ 配置文件已存在，请在 Obsidian 设置中手动添加："
    echo "   设置 → ACP Agent Client → Kimi CLI (kimi)"
    echo "   输入: /Users/Apple/.local/bin/kimi"
fi

echo ""
echo "完成后重启 Obsidian 即可看到 Kimi 选项"
