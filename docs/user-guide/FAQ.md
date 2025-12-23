# 常见问题 FAQ

## 安装相关

### Q1: 插件安装后无法启用？

**可能原因**：
1. 没有关闭「安全模式」
2. 插件文件不完整
3. Obsidian 版本过旧

**解决方法**：

```bash
# 检查文件完整性
ls -la .obsidian/plugins/obsidian-acp/
# 应该包含：main.js, manifest.json, styles.css

# 查看控制台错误
Ctrl/Cmd + Shift + I → Console
```

### Q2: 如何手动构建插件？

```bash
git clone https://github.com/YOUR_USERNAME/obsidian-acp.git
cd obsidian-acp
npm install
npm run build
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/obsidian-acp/
```

---

## 连接相关

### Q3: 点击「连接」后一直卡住？

**可能原因**：
1. API Key 无效或过期
2. 网络无法访问 API
3. 超时（默认 30 秒）

**解决方法**：

```bash
# 检查环境变量
echo $ANTHROPIC_API_KEY

# 测试网络
ping api.anthropic.com

# 查看日志
Ctrl/Cmd + Shift + I → Console → 过滤 [ACP]
```

### Q4: 连接成功但无法发送消息？

**解决方法**：
1. 断开连接，等待 2 秒，重新连接
2. 检查工作目录配置
3. 查看控制台日志

### Q5: 连接突然断开？

插件会自动尝试重连（最多 3 次）。如果频繁断开：
- 检查 API 配额
- 检查网络稳定性

---

## 权限相关

### Q6: 每次操作都弹窗，很烦？

**解决方法**：
- 设置 → ACP Agent Client → 权限模式 → 选择「完全信任」
- 或在权限对话框中选择「始终允许」

**推荐配置**：
- 读取操作：始终允许（安全）
- 写入操作：每次询问（谨慎）

### Q7: API Key 安全吗？

**完全安全**：
- API Key 仅保存在本地
- 通过本地子进程与 API 交互
- 不经过任何第三方服务器
- 代码开源可审计

---

## 使用技巧

### Q8: 如何让 AI 更好理解需求？

**提示词技巧**：

```
# 清晰具体
❌ 帮我整理笔记
✅ 为 notes/projects/ 目录下的笔记添加 #project 标签

# 分步骤
1. 读取 README.md
2. 提取所有一级标题
3. 生成目录索引

# 明确约束
只处理 .md 文件，忽略 .obsidian 目录
```

### Q9: AI 能理解 `[[双链]]` 吗？

部分支持：
- 可以读取包含双链的文件
- 可以解析双链语法
- 需要明确告知这是 Obsidian 语法

---

## 其他

### Q10: 插件会收费吗？

- 插件完全免费开源（MIT License）
- Claude API 需要付费或使用 Claude Pro/Max 订阅

### Q11: 如何查看详细日志？

```
1. 打开开发者工具：Ctrl/Cmd + Shift + I
2. 切换到 Console 标签
3. 过滤日志：输入 [ACP]
```

### Q12: 如何报告问题？

准备以下信息：
- 开发者工具截图
- 插件版本
- Obsidian 版本
- 复现步骤

提交到 [GitHub Issues](https://github.com/YOUR_USERNAME/obsidian-acp/issues)

---

## 相关资源

- [快速开始](./GETTING_STARTED.md)
- [权限系统](./PERMISSIONS.md)
