# Spec: Multi-Agent Support

本规格定义 Obsidian ACP 插件的多 Agent 支持能力。

## ADDED Requirements

### Requirement: Agent 选择

系统 SHALL 支持用户在多个 ACP Agent 之间进行选择。

#### Scenario: 用户选择内置 Agent
- **GIVEN** 用户打开设置页面
- **WHEN** 用户点击 Agent 选择下拉框
- **THEN** 显示可用的内置 Agent 列表（Claude Code, Goose, OpenCode）
- **AND** 用户可以选择其中一个作为当前 Agent

#### Scenario: 切换 Agent 需要重新连接
- **GIVEN** 用户已连接到 Claude Code
- **WHEN** 用户在设置中切换到 Goose
- **AND** 用户返回聊天界面
- **THEN** 系统自动断开 Claude Code 连接
- **AND** 使用 Goose 建立新连接

### Requirement: 内置 Agent 配置

系统 SHALL 为每个内置 Agent 提供预设配置。

#### Scenario: Claude Code 预设配置
- **GIVEN** 用户选择 Claude Code
- **THEN** 使用启动命令 `npx @zed-industries/claude-code-acp`
- **AND** 无需额外 ACP 参数
- **AND** 支持 `ANTHROPIC_API_KEY` 环境变量

#### Scenario: Goose 预设配置
- **GIVEN** 用户选择 Goose
- **THEN** 使用启动命令 `goose acp`
- **AND** 无需额外 ACP 参数
- **AND** 使用 Goose 内置的认证机制

#### Scenario: OpenCode 预设配置
- **GIVEN** 用户选择 OpenCode
- **THEN** 使用启动命令 `opencode acp`
- **AND** 无需额外 ACP 参数
- **AND** 支持 `ANTHROPIC_API_KEY` 和其他提供商的 API Key

### Requirement: 自定义 Agent 配置

系统 SHALL 支持用户添加自定义 ACP Agent。

#### Scenario: 添加自定义 Agent
- **GIVEN** 用户点击"添加自定义 Agent"按钮
- **WHEN** 用户填写以下信息：
  - 名称
  - CLI 命令
  - ACP 启动参数
  - 环境变量（可选）
- **THEN** 自定义 Agent 出现在选择列表中
- **AND** 配置保存到插件设置

#### Scenario: 编辑自定义 Agent
- **GIVEN** 用户已添加自定义 Agent
- **WHEN** 用户点击该 Agent 的编辑按钮
- **THEN** 显示配置编辑表单
- **AND** 用户可以修改所有配置项

#### Scenario: 删除自定义 Agent
- **GIVEN** 用户已添加自定义 Agent
- **WHEN** 用户点击该 Agent 的删除按钮
- **THEN** 显示确认对话框
- **AND** 确认后删除该 Agent 配置

### Requirement: Agent 配置覆盖

系统 SHALL 允许用户覆盖内置 Agent 的默认配置。

#### Scenario: 覆盖 CLI 路径
- **GIVEN** 用户选择 Claude Code
- **WHEN** 用户在设置中填写自定义 CLI 路径
- **THEN** 使用用户指定的路径启动 Agent
- **AND** 保存该覆盖配置

#### Scenario: 清空覆盖恢复默认
- **GIVEN** 用户已覆盖 Claude Code 的 CLI 路径
- **WHEN** 用户清空自定义路径输入框
- **THEN** 恢复使用默认启动命令

### Requirement: 斜杠命令动态适配

系统 SHALL 根据当前 Agent 动态显示可用斜杠命令。

#### Scenario: Agent 提供命令列表
- **GIVEN** 用户已连接到某 Agent
- **WHEN** Agent 发送 `available_commands_update` 通知
- **THEN** 系统更新斜杠命令菜单
- **AND** 显示 Agent 提供的命令

#### Scenario: 用户输入斜杠命令
- **GIVEN** 命令菜单已更新
- **WHEN** 用户输入 `/` 字符
- **THEN** 显示当前 Agent 的可用命令列表
- **AND** 用户可以选择命令

#### Scenario: 命令不存在的处理
- **GIVEN** 用户从 Claude Code 切换到 Goose
- **WHEN** 用户尝试使用 Claude Code 特有的命令
- **THEN** 该命令不在菜单中显示
- **OR** 如果用户直接输入，提示命令不可用

### Requirement: Agent 能力感知

系统 SHALL 感知不同 Agent 的能力差异并优雅处理。

#### Scenario: 图像输入支持
- **GIVEN** 用户连接的 Agent 在 initialize 响应中声明 `image: true`
- **WHEN** 用户拖拽图片到输入框
- **THEN** 允许发送图片

#### Scenario: 图像输入不支持
- **GIVEN** 用户连接的 Agent 未声明图像支持
- **WHEN** 用户尝试发送图片
- **THEN** 显示提示"当前 Agent 不支持图像输入"

#### Scenario: 模式切换支持
- **GIVEN** Agent 在 session/new 响应中提供 modes 列表
- **WHEN** 用户尝试切换模式
- **THEN** 只显示 Agent 支持的模式选项

### Requirement: 连接错误处理

系统 SHALL 为不同 Agent 提供有意义的错误提示。

#### Scenario: Agent 未安装
- **GIVEN** 用户选择 Goose
- **AND** 系统中未安装 Goose CLI
- **WHEN** 用户尝试连接
- **THEN** 显示错误提示"Goose CLI 未找到"
- **AND** 提供安装说明链接

#### Scenario: 认证失败
- **GIVEN** 用户连接需要 API Key 的 Agent
- **AND** 未配置 API Key
- **WHEN** 连接失败
- **THEN** 提示"请配置 API Key"
- **AND** 提供设置页面链接

## Interface Specifications

### AcpBackendId 类型

```typescript
type AcpBackendId = "claude" | "goose" | "opencode" | "custom";
```

### AcpBackendConfig 接口

```typescript
interface AcpBackendConfig {
  id: AcpBackendId;
  name: string;
  description?: string;
  cliCommand: string;
  defaultCliPath?: string;
  acpArgs: string[];
  authRequired: boolean;
  enabled: boolean;
  supportsStreaming?: boolean;
  env?: Record<string, string>;
  capabilities?: AgentCapabilities;
}

interface AgentCapabilities {
  image?: boolean;
  audio?: boolean;
  embeddedContext?: boolean;
  loadSession?: boolean;
  modes?: string[];
}
```

### 内置 Agent 配置

```typescript
const BUILTIN_AGENTS: Record<Exclude<AcpBackendId, "custom">, AcpBackendConfig> = {
  claude: {
    id: "claude",
    name: "Claude Code",
    description: "Anthropic Claude Code (Zed 官方 ACP 适配器)",
    cliCommand: "npx",
    defaultCliPath: "npx @zed-industries/claude-code-acp",
    acpArgs: [],
    authRequired: false,
    enabled: true,
  },
  goose: {
    id: "goose",
    name: "Goose",
    description: "Block (Square) 开源 AI Agent",
    cliCommand: "goose",
    defaultCliPath: "goose",
    acpArgs: ["acp"],
    authRequired: false,
    enabled: true,
    capabilities: {
      image: true,
      embeddedContext: true,
      loadSession: true,
    },
  },
  opencode: {
    id: "opencode",
    name: "OpenCode",
    description: "开源多模型 AI Agent",
    cliCommand: "opencode",
    defaultCliPath: "opencode",
    acpArgs: ["acp"],
    authRequired: false,
    enabled: true,
    capabilities: {
      image: true,
      audio: true,
      embeddedContext: true,
      loadSession: true,
    },
  },
};
```
