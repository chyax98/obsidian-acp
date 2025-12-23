# Change: 添加多 Agent 支持

## Why

当前 Obsidian ACP 插件只支持 Claude Code，限制了用户选择。随着 ACP 协议生态的发展，越来越多的开源 Agent 支持 ACP，包括 Goose (Block)、OpenCode 等。用户需要：
- 使用本地模型（隐私、成本考虑）
- 选择不同的 AI 提供商
- 使用特定 Agent 的独特功能

## What Changes

### 核心变更

1. **扩展后端类型系统**
   - `AcpBackendId` 从 `"claude"` 扩展为 `"claude" | "goose" | "opencode" | "custom"`
   - 添加 `AcpBackendConfig` 注册表支持多个预设 Agent

2. **重构 AcpConnection**
   - 将 `connectClaude()` 重构为通用的 `connectAgent(backendId)` 方法
   - 使用 `createSpawnConfig()` 统一处理不同 Agent 的启动参数

3. **扩展设置页面**
   - 添加 Agent 选择下拉框
   - 为每个 Agent 提供独立的配置区域
   - 支持自定义 Agent 配置

4. **斜杠命令适配** **BREAKING**
   - 斜杠命令由各 Agent 通过 `available_commands_update` 动态提供
   - 移除硬编码的命令列表

5. **消息格式适配**
   - 所有 Agent 遵循 ACP 标准，消息格式统一
   - 差异仅在于支持的能力（如部分 Agent 不支持音频）

### 优先支持的 Agent

| Agent | 启动命令 | 特点 |
|-------|---------|------|
| Claude Code | `npx @zed-industries/claude-code-acp` | 默认，当前已支持 |
| Goose | `goose acp` | 开源，Rust 实现，原生 ACP |
| OpenCode | `opencode acp` | 开源，多模型支持 |

## Impact

- **Affected specs**: 新增 `multi-agent` 能力规格
- **Affected code**:
  - `src/acp/backends/types.ts` - 类型扩展
  - `src/acp/backends/registry.ts` - 多 Agent 注册
  - `src/acp/core/connection.ts` - 连接逻辑重构
  - `src/ui/SettingsTab.ts` - 设置 UI 扩展
  - `src/ui/chat/helpers/command-menu.ts` - 斜杠命令动态化
  - `src/main.ts` - 设置结构更新

## Migration

现有用户无需迁移，Claude Code 保持为默认 Agent。新功能为可选扩展。

## Risks

1. **不同 Agent 的能力差异** - 需要优雅降级处理
2. **斜杠命令不兼容** - 不同 Agent 有不同命令，用户需要适应
3. **测试覆盖** - 需要测试多个 Agent 的集成
