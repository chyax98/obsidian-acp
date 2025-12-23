# 快速开始

5 分钟完成安装，开始与 Claude Code 对话。

## 第一步：安装插件

### 从 Release 安装

1. 前往 [GitHub Releases](https://github.com/YOUR_USERNAME/obsidian-acp/releases)
2. 下载最新的 `obsidian-acp-vX.X.X.zip`
3. 解压到 Vault 的 `.obsidian/plugins/obsidian-acp/`
4. 在 Obsidian 设置中启用插件

### 手动构建

```bash
git clone https://github.com/YOUR_USERNAME/obsidian-acp.git
cd obsidian-acp
npm install
npm run build
# 将 main.js, manifest.json, styles.css 复制到 Vault/.obsidian/plugins/obsidian-acp/
```

## 第二步：配置 Claude Code

### 设置 API Key（三选一）

**方式 1：环境变量**

```bash
# macOS/Linux
export ANTHROPIC_API_KEY="sk-ant-..."
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.zshrc

# Windows PowerShell
$env:ANTHROPIC_API_KEY="sk-ant-..."
```

**方式 2：插件设置页面**

设置 → ACP Agent Client → API Key

**方式 3：Claude Pro/Max 订阅**

使用 OAuth 登录，无需 API Key。

### 获取 API Key

1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 注册/登录账号
3. 前往 "API Keys" 页面
4. 创建新的 API Key

## 第三步：连接

1. 点击左侧工具栏的 ACP 图标
2. 点击「连接」
3. 等待状态显示「已连接」

## 第四步：开始对话

### 测试连接

```
你好！请介绍一下你自己
```

### 测试文件访问

```
读取当前 Vault 根目录下的 README.md 文件
```

首次文件操作会弹出权限对话框，选择「允许一次」或「始终允许」。

## 快捷操作

| 操作 | 说明 |
|------|------|
| `@` | 引用文件 |
| `/` | 斜杠命令 |
| 拖拽文件 | 添加文件引用 |
| `Cmd/Ctrl + Enter` | 发送消息 |

## 常见问题

### 连接失败？

1. 检查 API Key 是否正确
2. 从终端启动 Obsidian（继承环境变量）：
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   open -a Obsidian  # macOS
   ```
3. 查看开发者工具日志：`Cmd/Ctrl + Shift + I`

### 想用全局安装？

```bash
npm install -g @anthropic-ai/claude-code
```

然后在设置页面选择「全局安装」启动方式。

## 下一步

- [权限系统](./PERMISSIONS.md) - 理解权限管理
- [常见问题](./FAQ.md) - 更多问题解答
