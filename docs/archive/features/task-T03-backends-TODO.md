# Task T03: Agent 后端配置

> 📅 执行时间: 2025-12-18
> 🔒 执行者: Claude-Terminal-E343
> 📊 预估 Token: 10k

---

## 任务目标

定义支持的 ACP Agent 后端配置，包括 Claude Code、Codex、Gemini、Goose 等，为 CLI 检测器和连接管理提供基础。

---

## 技术方案

### 文件结构

```
src/acp/backends/
├── index.ts      # 导出入口
├── types.ts      # 后端配置类型
└── registry.ts   # 后端注册表与工具函数
```

### 支持的 Agent 后端

| ID | 名称 | CLI 命令 | ACP 参数 | 状态 |
|----|------|---------|---------|------|
| claude | Claude Code | `claude` | `--experimental-acp` | ✅ |
| codex | Codex CLI | `codex` | `--experimental-acp` | ✅ |
| gemini | Gemini CLI | `gemini` | `--experimental-acp` | ⚠️ |
| qwen | Qwen Code | `qwen` | `--experimental-acp` | ✅ |
| goose | Goose | `goose` | `acp` (子命令) | ✅ |
| auggie | Augment Code | `auggie` | `--acp` | ✅ |
| kimi | Kimi CLI | `kimi` | `--acp` | ✅ |
| opencode | OpenCode | `opencode` | `acp` (子命令) | ✅ |
| custom | 自定义 | 用户配置 | 用户配置 | ✅ |

---

## 实施检查清单

- [x] 创建 `src/acp/backends/types.ts` - 后端配置类型
- [x] 创建 `src/acp/backends/registry.ts` - 后端注册表
- [x] 创建 `src/acp/backends/index.ts` - 统一导出
- [x] 运行 `npm run build` 验证 ✅ 成功

---

## 设计原则

1. **可扩展**: 新增后端只需在注册表添加配置
2. **类型安全**: 使用字面量联合类型约束后端 ID
3. **灵活性**: 支持自定义 Agent 配置
