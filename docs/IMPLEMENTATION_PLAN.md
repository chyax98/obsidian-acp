# Obsidian ACP Plugin - 完整实现计划

**日期**: 2025-12-20
**目标**: 完善 ACP 协议支持，优化 Settings 页面，实现 MCP 集成

---

## 🎯 核心目标

1. **ACP 协议完整支持** - 实现所有必要的协议特性
2. **Settings 页面优化** - 用户配置即用，无需复杂设置
3. **MCP 服务器集成** - 支持本机 MCP servers (stdio)
4. **UI/UX 优化** - 流畅的用户体验

---

## 📊 MCP vs ACP 关系理解

### MCP (Model Context Protocol)
- **作用**: AI 连接数据源和工具的标准协议
- **类比**: USB-C 接口 (Universal connector for AI)
- **提供方**: MCP Server (文件系统、数据库、API、搜索等)
- **消费方**: AI Agent 通过 MCP Client 访问

### ACP (Agent Client Protocol)
- **作用**: Editor 和 Agent 之间通信的协议
- **传输**: JSON-RPC 2.0 over stdio
- **职责**: 会话管理、消息流、工具调用、权限请求

### 互补关系
```
用户 (Obsidian)
    ↓ ACP (通信协议)
AI Agent (Claude/Codex)
    ↓ MCP (访问工具)
数据源 (文件系统/数据库/API)
```

- **MCP**: Agent 访问工具 (what)
- **ACP**: Agent 在哪运行 (where)
- **结合**: Agent 通过 ACP 与 Editor 通信，通过 MCP 访问外部工具

---

## 🔧 Phase 1: Settings 页面重构 (1-2 天)

### 当前问题
- Agent 配置散乱，需要手动配置 CLI 路径
- 缺少 MCP 服务器管理界面
- 无 Agent 在线检测和安装引导

### 目标改进

#### 1.1 Agent 配置优化
```typescript
// SettingsTab.ts 新增功能
- ✅ 自动检测已安装的 Agent CLI
- ✅ 显示 Agent 状态 (已安装/未安装/版本)
- ✅ 一键测试连接 (点击按钮验证 Agent 可用性)
- ✅ 安装引导 (提供 npm install 命令)
- ✅ 自定义 Agent 支持 (高级用户)
```

**UI 设计**:
```
┌─────────────────────────────────────┐
│ Agent 配置                          │
├─────────────────────────────────────┤
│ ✅ Claude Code (已安装 v1.2.3)      │
│    [测试连接] [禁用]                │
│                                      │
│ ⚠️ Kimi (未安装)                    │
│    安装: npm install -g kimi-cli    │
│    [复制命令]                        │
│                                      │
│ ✅ Gemini CLI (已安装 v0.8.5)       │
│    [测试连接] [禁用]                │
│                                      │
│ [+ 添加自定义 Agent]                │
└─────────────────────────────────────┘
```

#### 1.2 MCP 服务器管理
```typescript
// 新增 MCP 配置区域
interface McpServerConfig {
  name: string;           // 服务器名称
  type: 'stdio' | 'http'; // 传输类型
  command?: string;       // stdio: 命令路径
  args?: string[];        // stdio: 参数
  url?: string;           // http: 服务器 URL
  enabled: boolean;       // 是否启用
}
```

**UI 设计**:
```
┌─────────────────────────────────────┐
│ MCP 服务器 (工具扩展)               │
├─────────────────────────────────────┤
│ ✅ Filesystem (内置)                │
│    提供文件读写能力                 │
│    [配置] [禁用]                    │
│                                      │
│ ⚠️ Brave Search (可选)              │
│    提供网络搜索能力                 │
│    [安装指南] [添加]                │
│                                      │
│ [+ 添加 MCP 服务器]                 │
│    - 从社区模板选择                 │
│    - 自定义配置                     │
└─────────────────────────────────────┘
```

#### 1.3 常用 MCP Servers 预设
```typescript
const COMMON_MCP_SERVERS = {
  filesystem: {
    name: 'Filesystem',
    command: '@modelcontextprotocol/server-filesystem',
    args: ['--root', '{VAULT_PATH}'],
    description: '提供 Vault 文件读写能力',
  },
  brave_search: {
    name: 'Brave Search',
    command: '@modelcontextprotocol/server-brave-search',
    args: [],
    description: '提供网络搜索能力 (需要 API Key)',
    requiresApiKey: true,
  },
  github: {
    name: 'GitHub',
    command: '@modelcontextprotocol/server-github',
    args: [],
    description: '访问 GitHub 仓库和 issues',
    requiresAuth: true,
  },
};
```

---

## 🚀 Phase 2: ACP 协议完整实现 (2-3 天)

### 2.1 Image ContentBlock 真实渲染

**当前**: 转为 Markdown `![](URI)` 占位
**目标**: 实际显示图片

```typescript
// MessageRenderer.ts
private static renderImageContent(
  container: HTMLElement,
  imageContent: ImageMessageContent,
): void {
  const imgEl = container.createEl('img', {
    cls: 'acp-content-image',
  });

  if (imageContent.data) {
    // Base64 编码图片
    imgEl.src = `data:${imageContent.mimeType || 'image/png'};base64,${imageContent.data}`;
  } else if (imageContent.uri) {
    // URL 图片
    imgEl.src = imageContent.uri;
  }

  imgEl.alt = 'Agent generated image';
}
```

### 2.2 Plan (计划) 实时更新

**当前**: 基础渲染
**目标**: 实时更新状态，折叠/展开

```typescript
// ChatView.ts
private handlePlanUpdate(plan: PlanEntry[]): void {
  // 查找或创建 plan 容器
  const planEl = this.findOrCreatePlanElement();

  // 实时更新每个条目的状态
  for (const entry of plan) {
    this.updatePlanEntry(planEl, entry);
  }

  // 自动展开 in_progress 条目
  this.expandInProgressEntries(planEl);
}
```

### 2.3 Available Commands 支持

**当前**: 类型定义存在，无 UI
**目标**: 显示可用命令，快速调用

```typescript
// ChatView.ts
private renderAvailableCommands(commands: AvailableCommand[]): void {
  const commandsEl = this.chatContainer.createDiv({
    cls: 'acp-available-commands',
  });

  for (const cmd of commands) {
    const cmdBtn = commandsEl.createEl('button', {
      cls: 'acp-command-button',
      text: `/${cmd.name}`,
    });

    cmdBtn.addEventListener('click', () => {
      this.sendPrompt(`/${cmd.name} ${cmd.input?.hint || ''}`);
    });
  }
}
```

### 2.4 ToolCall locations 跟随

**当前**: 类型定义存在，无 UI
**目标**: 显示文件路径，点击跳转

```typescript
// MessageRenderer.ts
private static renderToolCallLocations(
  container: HTMLElement,
  locations: ToolCallLocation[],
  app: App,
): void {
  if (!locations || locations.length === 0) return;

  const locationsEl = container.createDiv({
    cls: 'acp-tool-call-locations',
  });

  for (const loc of locations) {
    const locEl = locationsEl.createDiv({
      cls: 'acp-location-item',
    });

    // 文件路径
    const pathEl = locEl.createEl('span', {
      cls: 'acp-location-path',
      text: loc.path,
    });

    // 点击跳转
    pathEl.addEventListener('click', () => {
      app.workspace.openLinkText(loc.path, '', false, {
        line: loc.line,
      });
    });

    // 行号
    if (loc.line) {
      locEl.createEl('span', {
        cls: 'acp-location-line',
        text: `:${loc.line}`,
      });
    }
  }
}
```

---

## 🔌 Phase 3: MCP 集成实现 (2-3 天)

### 3.1 MCP Server 配置存储

```typescript
// main.ts
interface ObsidianAcpSettings {
  // ... 现有配置
  mcpServers: McpServerConfig[];
}

const DEFAULT_SETTINGS: ObsidianAcpSettings = {
  // ... 现有默认值
  mcpServers: [
    {
      name: 'Obsidian Filesystem',
      type: 'stdio',
      command: 'npx',
      args: [
        '@modelcontextprotocol/server-filesystem',
        '--root',
        '{VAULT_PATH}', // 自动替换为 Vault 路径
      ],
      enabled: true,
    },
  ],
};
```

### 3.2 MCP Server 启动集成

```typescript
// SessionManager.ts
async start(workingDir?: string): Promise<void> {
  const cwd = workingDir || this.workingDir;

  // 准备 MCP servers 配置
  const mcpServers = this.prepareMcpServers(
    this.settings.mcpServers.filter(s => s.enabled)
  );

  // 创建会话时传递 MCP servers
  const response = await this.connection.newSession(cwd, mcpServers);
  this._sessionId = response.sessionId;
}

private prepareMcpServers(
  configs: McpServerConfig[]
): McpServer[] {
  return configs.map(config => {
    if (config.type === 'stdio') {
      return {
        type: 'stdio',
        name: config.name,
        command: config.command!,
        args: this.replaceVariables(config.args!),
        env: [],
      };
    } else {
      return {
        type: 'http',
        name: config.name,
        url: config.url!,
        headers: [],
      };
    }
  });
}

private replaceVariables(args: string[]): string[] {
  return args.map(arg => {
    return arg
      .replace('{VAULT_PATH}', this.app.vault.adapter.getBasePath())
      .replace('{USER_HOME}', process.env.HOME || '~');
  });
}
```

### 3.3 MCP Server 状态监控

```typescript
// SettingsTab.ts
private async testMcpServer(config: McpServerConfig): Promise<boolean> {
  try {
    // 尝试启动 MCP server
    const process = spawn(config.command!, config.args || []);

    // 等待初始化响应 (JSON-RPC handshake)
    const initialized = await this.waitForMcpInit(process, 5000);

    process.kill();
    return initialized;
  } catch (error) {
    console.error('[MCP Test]', error);
    return false;
  }
}
```

### 3.4 MCP Tools 展示

**在 ChatView 中显示 Agent 可用的 MCP 工具**:

```typescript
// ChatView.ts
private async loadSessionInfo(): Promise<void> {
  // Agent 连接后，显示可用的 MCP 工具
  const tools = await this.sessionManager.getAvailableTools();

  this.renderToolsPanel(tools);
}

private renderToolsPanel(tools: McpTool[]): void {
  const panelEl = this.chatContainer.createDiv({
    cls: 'acp-tools-panel',
  });

  panelEl.createEl('h3', { text: '可用工具' });

  for (const tool of tools) {
    const toolEl = panelEl.createDiv({
      cls: 'acp-tool-item',
    });

    toolEl.createEl('span', {
      cls: 'acp-tool-name',
      text: tool.name,
    });

    toolEl.createEl('span', {
      cls: 'acp-tool-description',
      text: tool.description,
    });
  }
}
```

---

## 🎨 Phase 4: UI/UX 优化 (1-2 天)

### 4.1 加载状态

```typescript
// ChatView.ts
private showLoadingState(message: string): void {
  const loadingEl = this.chatContainer.createDiv({
    cls: 'acp-loading',
  });

  const spinnerEl = loadingEl.createDiv({
    cls: 'acp-loading-spinner',
  });
  setIcon(spinnerEl, 'loader-2');

  loadingEl.createDiv({
    cls: 'acp-loading-message',
    text: message,
  });
}

private hideLoadingState(): void {
  this.chatContainer.querySelector('.acp-loading')?.remove();
}
```

### 4.2 错误提示优化

```typescript
// ChatView.ts
private showError(error: Error, context?: string): void {
  const errorEl = this.chatContainer.createDiv({
    cls: 'acp-error-message',
  });

  // 图标
  const iconEl = errorEl.createDiv({ cls: 'acp-error-icon' });
  setIcon(iconEl, 'alert-circle');

  // 错误信息
  errorEl.createDiv({
    cls: 'acp-error-title',
    text: context || '发生错误',
  });

  errorEl.createDiv({
    cls: 'acp-error-detail',
    text: error.message,
  });

  // 重试按钮
  if (this.canRetry(error)) {
    const retryBtn = errorEl.createEl('button', {
      cls: 'acp-retry-button',
      text: '重试',
    });

    retryBtn.addEventListener('click', () => {
      this.retryLastRequest();
      errorEl.remove();
    });
  }
}
```

### 4.3 智能滚动优化

```typescript
// ChatView.ts
private shouldAutoScroll(): boolean {
  const container = this.chatContainer;
  const scrollTop = container.scrollTop;
  const scrollHeight = container.scrollHeight;
  const clientHeight = container.clientHeight;

  // 距离底部 100px 内才自动滚动
  return scrollHeight - scrollTop - clientHeight < 100;
}

private scrollToBottom(smooth: boolean = true): void {
  if (this.shouldAutoScroll()) {
    this.chatContainer.scrollTo({
      top: this.chatContainer.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }
}
```

### 4.4 消息操作栏

```typescript
// MessageRenderer.ts
private static addMessageActions(
  messageEl: HTMLElement,
  message: Message,
): void {
  const actionsEl = messageEl.createDiv({
    cls: 'acp-message-actions',
  });

  // 复制按钮
  this.addCopyButton(actionsEl, message.content);

  // 重新生成按钮 (仅 assistant 消息)
  if (message.role === 'assistant') {
    this.addRegenerateButton(actionsEl, message);
  }

  // 编辑按钮 (仅 user 消息)
  if (message.role === 'user') {
    this.addEditButton(actionsEl, message);
  }
}
```

---

## 📝 Phase 5: 文档和测试 (1 天)

### 5.1 用户文档

- **docs/GETTING_STARTED.md**: 快速开始指南
- **docs/MCP_GUIDE.md**: MCP 服务器配置指南
- **docs/AGENT_COMPARISON.md**: Agent 对比和选择建议
- **docs/TROUBLESHOOTING.md**: 常见问题排查

### 5.2 开发者文档

- **docs/ARCHITECTURE.md**: 架构设计文档
- **docs/API_REFERENCE.md**: API 参考
- **docs/CONTRIBUTING.md**: 贡献指南

### 5.3 测试

```typescript
// tests/mcp-integration.test.ts
describe('MCP Integration', () => {
  it('should start MCP server', async () => {
    const config: McpServerConfig = {
      name: 'Test Filesystem',
      type: 'stdio',
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem', '--root', '/tmp'],
      enabled: true,
    };

    const server = await startMcpServer(config);
    expect(server.isRunning()).toBe(true);
  });

  it('should list MCP tools', async () => {
    const tools = await mcpClient.listTools();
    expect(tools).toContainEqual(
      expect.objectContaining({ name: 'read_file' })
    );
  });
});
```

---

## 🎯 实现优先级总结

### P0 (必须实现)
1. ✅ Settings 页面 Agent 自动检测和配置
2. ✅ MCP Server 管理界面 (stdio 类型)
3. ✅ Image ContentBlock 真实渲染
4. ✅ 加载状态和错误提示优化

### P1 (重要)
5. ⚠️ ToolCall locations 显示和跳转
6. ⚠️ Plan 实时更新和交互
7. ⚠️ Available Commands 快捷调用
8. ⚠️ MCP Tools 展示

### P2 (可选)
9. ❌ MCP HTTP/SSE 支持 (远程 MCP servers)
10. ❌ Session 持久化和恢复
11. ❌ Agent 性能监控

---

## 📅 时间规划

| Phase | 任务 | 时间 | 状态 |
|-------|------|------|------|
| Phase 1 | Settings 页面重构 | 1-2 天 | 待开始 |
| Phase 2 | ACP 协议完整实现 | 2-3 天 | 待开始 |
| Phase 3 | MCP 集成实现 | 2-3 天 | 待开始 |
| Phase 4 | UI/UX 优化 | 1-2 天 | 待开始 |
| Phase 5 | 文档和测试 | 1 天 | 待开始 |
| **总计** | | **7-11 天** | |

---

## 🚀 启动方式

### Phase 1 立即开始
```bash
# 1. 创建 Phase 1 分支
git checkout -b feature/settings-revamp

# 2. 使用 Task Agent 并行执行
- Agent 自动检测逻辑
- MCP 配置界面
- UI 组件优化
```

### 验收标准

**Phase 1 完成标志**:
- [ ] Agent 列表显示安装状态
- [ ] 一键测试连接可用
- [ ] MCP 服务器列表可管理
- [ ] 0 TypeScript errors
- [ ] Settings 页面截图更新到文档

**最终验收**:
- [ ] 用户首次打开插件，无需配置即可使用 (自动检测 Agent)
- [ ] MCP 服务器可视化管理，一键启用/禁用
- [ ] 所有 ACP ContentBlock 类型正确渲染
- [ ] UI 流畅无卡顿，错误提示友好
- [ ] 完整的用户文档和示例

---

## 📚 参考资源

### MCP 官方资源
- 官网: https://www.anthropic.com/news/model-context-protocol
- 文档: https://docs.anthropic.com/en/docs/build-with-claude/mcp
- Servers: https://github.com/modelcontextprotocol/servers
- 快速开始: https://modelcontextprotocol.io/quickstart

### ACP 官方资源
- 官网: https://agentclientprotocol.com
- GitHub: https://github.com/zed-industries/agent-client-protocol
- Schema: https://agentclientprotocol.com/protocol/schema

### 协议对比
- MCP vs ACP vs A2A: https://boomi.com/blog/what-is-mcp-acp-a2a/
- Agent Protocols Survey: https://arxiv.org/html/2505.02279v1

---

**创建日期**: 2025-12-20
**最后更新**: 2025-12-20
**负责人**: Claude (AI Assistant)
