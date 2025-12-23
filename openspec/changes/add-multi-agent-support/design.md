# Design: 添加多 Agent 支持

## Context

Obsidian ACP 插件当前只支持 Claude Code。随着 ACP 协议被更多 Agent 采用，用户需要选择不同 Agent 的能力。本设计文档描述如何在保持向后兼容的前提下，添加多 Agent 支持。

### 利益相关者
- 现有 Claude Code 用户（需要保持兼容）
- 希望使用 Goose/OpenCode 的用户
- 需要自定义 Agent 的高级用户

### 约束
- 不破坏现有功能
- 保持 UI 简洁
- 最小化代码变更

## Goals / Non-Goals

### Goals
- 支持 Goose、OpenCode 作为内置 Agent
- 提供自定义 Agent 配置能力
- 斜杠命令根据 Agent 动态更新
- 各 Agent 独立配置（路径、环境变量）

### Non-Goals
- 不实现多 Agent 并行运行
- 不实现 Agent 自动检测/安装
- 不实现 Agent 间的消息互通

## Decisions

### Decision 1: Agent 配置结构

**选择**: 扩展现有 `AcpBackendConfig` 结构

```typescript
type AcpBackendId = "claude" | "goose" | "opencode" | "custom";

interface AcpBackendConfig {
  id: AcpBackendId;
  name: string;
  description?: string;
  cliCommand: string;           // 可执行命令
  defaultCliPath?: string;      // 完整启动命令
  acpArgs: string[];            // ACP 启动参数
  authRequired: boolean;
  enabled: boolean;
  supportsStreaming?: boolean;
  env?: Record<string, string>;

  // 新增：能力声明
  capabilities?: {
    image?: boolean;
    audio?: boolean;
    embeddedContext?: boolean;
    loadSession?: boolean;
    modes?: string[];           // 支持的模式
  };
}
```

**理由**:
- 复用现有结构，改动最小
- 类型安全
- 易于扩展

### Decision 2: Agent 注册表设计

**选择**: 静态注册表 + 用户自定义配置

```typescript
// 内置 Agent 配置
const BUILTIN_AGENTS: Record<string, AcpBackendConfig> = {
  claude: { /* Claude Code 配置 */ },
  goose: { /* Goose 配置 */ },
  opencode: { /* OpenCode 配置 */ },
};

// 用户自定义 Agent（存储在 settings）
interface AcpPluginSettings {
  activeAgent: AcpBackendId;
  customAgents: CustomAgentConfig[];
  agentOverrides: Partial<Record<AcpBackendId, Partial<AcpBackendConfig>>>;
}
```

**理由**:
- 内置 Agent 开箱即用
- 用户可覆盖配置（如自定义路径）
- 支持完全自定义的 Agent

### Decision 3: 连接层重构

**选择**: 策略模式 + 统一启动逻辑

```typescript
class AcpConnection {
  async connect(options: ConnectionOptions): Promise<void> {
    const config = this.getBackendConfig(options.backendId);
    const { command, args, spawnOptions } = createSpawnConfig(
      config.defaultCliPath || config.cliCommand,
      options.workingDir,
      config.acpArgs,
      { ...config.env, ...options.env }
    );

    this.child = spawn(command, args, spawnOptions);
    // ... 统一的后续处理
  }
}
```

**理由**:
- 所有 ACP Agent 使用相同的通信协议
- 只有启动方式不同
- 统一处理减少代码重复

### Decision 4: 斜杠命令动态化

**选择**: 完全依赖 `available_commands_update`

```typescript
// 移除硬编码命令
// const SLASH_COMMANDS = [...];

// 改为动态存储
class SessionManager {
  private availableCommands: AvailableCommand[] = [];

  handleAvailableCommandsUpdate(update: AvailableCommandsUpdateData) {
    this.availableCommands = update.availableCommands;
    this.onAvailableCommandsUpdate(this.availableCommands);
  }
}
```

**理由**:
- ACP 标准规定命令由 Agent 提供
- 不同 Agent 有不同命令集
- 避免维护多套命令配置

### Decision 5: 设置 UI 设计

**选择**: 分层设置 + 条件显示

```
┌────────────────────────────────────┐
│ Agent 选择                         │
│ [Claude Code ▼]                   │
├────────────────────────────────────┤
│ Claude Code 设置                   │
│ ┌────────────────────────────────┐ │
│ │ CLI 路径: [                  ] │ │
│ │ API Key:  [••••••••••••••••] │ │
│ └────────────────────────────────┘ │
├────────────────────────────────────┤
│ + 添加自定义 Agent                 │
└────────────────────────────────────┘
```

**理由**:
- 清晰的视觉层级
- 只显示当前 Agent 的相关配置
- 自定义 Agent 作为高级功能

## Risks / Trade-offs

### Risk 1: Agent 能力差异导致用户困惑

**风险**: 用户切换 Agent 后发现某些功能不可用

**缓解**:
- 在 UI 中显示 Agent 能力说明
- 优雅降级处理（如提示"当前 Agent 不支持此功能"）

### Risk 2: 不同 Agent 的命令不兼容

**风险**: 用户习惯的斜杠命令在新 Agent 中不存在

**缓解**:
- 切换 Agent 时提示命令可能不同
- 命令菜单实时更新

### Risk 3: 测试覆盖不足

**风险**: 难以测试所有 Agent 组合

**缓解**:
- 优先测试协议兼容性
- 使用 mock Agent 进行自动化测试

## Migration Plan

### Phase 1: 类型和注册表扩展（无破坏性变更）
1. 扩展类型定义
2. 添加 Goose/OpenCode 配置
3. 保持 Claude Code 为默认

### Phase 2: 连接层重构
1. 重构 `connectAgent()` 方法
2. 统一启动逻辑
3. 向后兼容测试

### Phase 3: UI 扩展
1. 添加 Agent 选择器
2. 添加分 Agent 配置区域
3. 实现斜杠命令动态化

### Rollback Plan
- 每个 Phase 可独立回滚
- 保留原有 `connectClaude()` 代码作为备份
- 设置中保留"使用旧版连接"选项（调试用）

## Open Questions

1. **是否需要 Agent 安装检测？**
   - 当前方案：不检测，启动失败时提示
   - 可选：使用 `which` 命令检测

2. **是否支持 Agent 热切换？**
   - 当前方案：切换需要重新连接
   - 可选：支持保持会话的热切换（复杂度高）

3. **自定义 Agent 的验证？**
   - 当前方案：用户自行确保配置正确
   - 可选：提供"测试连接"按钮

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Obsidian 插件                           │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │  SettingsTab   │  │   ChatView     │  │ SessionManager│ │
│  │  (Agent 选择)  │  │   (消息 UI)    │  │  (会话管理)   │ │
│  └───────┬────────┘  └───────┬────────┘  └───────┬───────┘ │
│          │                   │                   │         │
│          ▼                   ▼                   ▼         │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                   AcpConnection                       │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │  getBackendConfig(activeAgent)                  │  │ │
│  │  │  createSpawnConfig(config)                      │  │ │
│  │  │  spawn(command, args)                           │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  └───────────────────────────┬───────────────────────────┘ │
└──────────────────────────────┼──────────────────────────────┘
                               │ JSON-RPC over stdio
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│ Claude Code │         │   Goose     │         │  OpenCode   │
│ (npx ...)   │         │ (goose acp) │         │(opencode acp│
└─────────────┘         └─────────────┘         └─────────────┘
```
