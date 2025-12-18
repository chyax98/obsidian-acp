# Obsidian ACP 插件设计文档

> 📅 版本: 1.0
> 🎯 目标: 为 Obsidian 实现标准化 AI Agent 集成

---

## 1. 概述

### 1.1 项目背景

Agent Client Protocol (ACP) 是一个标准化 AI 编程助手与编辑器通信的协议，类似于 LSP 对语言服务器的标准化作用。本项目旨在为 Obsidian 实现 ACP Client，使用户能够在 Obsidian 中使用 Claude Code、Codex、Gemini CLI 等 AI Agent。

### 1.2 核心价值

- **统一接入**: 一套代码支持多种 AI Agent
- **原生体验**: 深度集成 Obsidian 工作流
- **本地安全**: 所有数据本地处理，Agent 作为子进程运行

### 1.3 目标用户

- 使用 Obsidian 进行知识管理的开发者
- 希望在笔记中使用 AI 辅助的用户
- 需要本地 AI Agent 的隐私敏感用户

---

## 2. 技术架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Obsidian Desktop                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │                ACP Plugin (Main Process)             │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────┐    │    │
│  │  │  ChatView │  │ Settings  │  │ SessionStore  │    │    │
│  │  │   (UI)    │  │   Tab     │  │   (Storage)   │    │    │
│  │  └─────┬─────┘  └───────────┘  └───────────────┘    │    │
│  │        │                                             │    │
│  │  ┌─────▼─────────────────────────────────────────┐  │    │
│  │  │              AcpConnection                     │  │    │
│  │  │  ┌─────────────┐  ┌─────────────────────────┐ │  │    │
│  │  │  │ RequestQueue│  │ SessionManager         │ │  │    │
│  │  │  └─────────────┘  └─────────────────────────┘ │  │    │
│  │  │  ┌─────────────┐  ┌─────────────────────────┐ │  │    │
│  │  │  │FileOperation│  │ AcpDetector            │ │  │    │
│  │  │  └─────────────┘  └─────────────────────────┘ │  │    │
│  │  └─────────────────────┬─────────────────────────┘  │    │
│  └────────────────────────┼────────────────────────────┘    │
│                           │ stdio (JSON-RPC)                 │
│  ┌────────────────────────▼────────────────────────────┐    │
│  │                Agent Subprocess                      │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │    │
│  │  │  Claude  │ │  Codex   │ │  Gemini  │ │  Qwen  │ │    │
│  │  │   Code   │ │   CLI    │ │   CLI    │ │  Code  │ │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分

```
src/
├── acp/                          # ACP 协议层
│   ├── types/                    # 类型定义
│   │   ├── index.ts              # 主导出
│   │   ├── protocol.ts           # JSON-RPC 基础类型
│   │   ├── session.ts            # 会话相关类型
│   │   └── tools.ts              # 工具调用类型
│   ├── backends/                 # Agent 后端配置
│   │   ├── index.ts              # 后端注册中心
│   │   ├── types.ts              # 后端配置类型
│   │   ├── claude.ts             # Claude Code 配置
│   │   ├── codex.ts              # Codex 配置
│   │   ├── gemini.ts             # Gemini 配置
│   │   ├── qwen.ts               # Qwen Code 配置
│   │   └── goose.ts              # Goose 配置
│   ├── AcpConnection.ts          # 核心连接类
│   ├── AcpDetector.ts            # CLI 检测器
│   └── FileOperationHandler.ts   # 文件操作处理
├── ui/                           # UI 层
│   ├── ChatView.ts               # 主聊天视图
│   ├── MessageRenderer.ts        # 消息渲染
│   ├── ToolCallRenderer.ts       # 工具调用渲染
│   └── PermissionModal.ts        # 权限请求弹窗
├── settings/                     # 设置层
│   ├── types.ts                  # 设置类型
│   └── SettingsTab.ts            # 设置界面
├── storage/                      # 存储层
│   ├── types.ts                  # 存储类型
│   └── SessionStorage.ts         # 会话持久化
└── main.ts                       # 插件入口
```

### 2.3 数据流

```
用户输入
    │
    ▼
┌─────────────┐
│  ChatView   │ ──(prompt)──▶ ┌──────────────────┐
└─────────────┘               │  AcpConnection   │
                              │                  │
                              │  session/prompt  │───▶ Agent
                              │       │          │      (subprocess)
                              │       ▼          │
                              │  session/update  │◀─── Agent
                              │  (notifications) │
                              └────────┬─────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────┐
│                    消息分发                              │
├─────────────┬─────────────┬─────────────┬───────────────┤
│ agent_      │ tool_call   │ plan        │ request_      │
│ message_    │             │             │ permission    │
│ chunk       │             │             │               │
├─────────────┼─────────────┼─────────────┼───────────────┤
│ Message     │ ToolCall    │ Plan        │ Permission    │
│ Renderer    │ Renderer    │ Renderer    │ Modal         │
└─────────────┴─────────────┴─────────────┴───────────────┘
```

---

## 3. 核心模块设计

### 3.1 AcpConnection

**职责**: 管理与 Agent 的通信生命周期

```typescript
class AcpConnection {
  // === 状态 ===
  private child: ChildProcess | null;
  private pendingRequests: Map<number, PendingRequest>;
  private sessionId: string | null;
  private backend: AgentBackend | null;

  // === 生命周期 ===
  async connect(backend: AgentBackend, cwd: string): Promise<void>;
  disconnect(): void;

  // === 协议方法 ===
  private async initialize(): Promise<InitializeResponse>;
  async authenticate(methodId?: string): Promise<void>;
  async newSession(cwd: string): Promise<string>;
  async sendPrompt(content: ContentBlock[]): Promise<PromptResponse>;
  cancelSession(): void;

  // === 回调 ===
  onSessionUpdate: (update: SessionUpdate) => void;
  onPermissionRequest: (req: PermissionRequest) => Promise<PermissionResponse>;
  onFileOperation: (op: FileOperation) => void;
  onEndTurn: () => void;

  // === 状态查询 ===
  get isConnected(): boolean;
  get hasActiveSession(): boolean;
  get currentBackend(): AgentBackend | null;
}
```

**关键实现细节**:

1. **子进程管理**
   ```typescript
   private spawnAgent(config: SpawnConfig): ChildProcess {
     const { command, args, options } = config;
     return spawn(command, args, {
       ...options,
       stdio: ['pipe', 'pipe', 'pipe'],
     });
   }
   ```

2. **消息解析**
   ```typescript
   private setupStdoutHandler(): void {
     let buffer = '';
     this.child.stdout.on('data', (data) => {
       buffer += data.toString();
       const lines = buffer.split('\n');
       buffer = lines.pop() || '';

       for (const line of lines) {
         if (line.trim()) {
           const message = JSON.parse(line);
           this.handleMessage(message);
         }
       }
     });
   }
   ```

3. **请求超时管理**
   ```typescript
   private sendRequest<T>(method: string, params?: any): Promise<T> {
     return new Promise((resolve, reject) => {
       const id = this.nextRequestId++;
       const timeout = method === 'session/prompt' ? 120000 : 60000;

       const timeoutId = setTimeout(() => {
         this.pendingRequests.delete(id);
         reject(new Error(`Request ${method} timed out`));
       }, timeout);

       this.pendingRequests.set(id, { resolve, reject, timeoutId, method });
       this.sendMessage({ jsonrpc: '2.0', id, method, params });
     });
   }
   ```

### 3.2 ChatView

**职责**: 提供聊天 UI 界面

```typescript
class AcpChatView extends ItemView {
  // === Obsidian API ===
  getViewType(): string { return VIEW_TYPE_ACP_CHAT; }
  getDisplayText(): string { return 'ACP Chat'; }
  getIcon(): string { return 'message-circle'; }

  // === 生命周期 ===
  async onOpen(): Promise<void>;
  async onClose(): Promise<void>;

  // === UI 组件 ===
  private renderHeader(): HTMLElement;      // Agent 选择器、连接状态
  private renderMessages(): HTMLElement;    // 消息列表容器
  private renderInput(): HTMLElement;       // 输入框、发送按钮

  // === 交互处理 ===
  private handleAgentChange(agent: string): Promise<void>;
  private handleSubmit(): Promise<void>;
  private handleCancel(): void;

  // === 消息更新 ===
  appendMessage(message: ChatMessage): void;
  updateMessage(id: string, content: string): void;
  appendToolCall(toolCall: ToolCallUpdate): void;
  updateToolCall(id: string, update: ToolCallUpdateStatus): void;
}
```

**布局结构**:
```html
<div class="acp-chat-view">
  <!-- 头部 -->
  <div class="acp-header">
    <select class="acp-agent-select">...</select>
    <button class="acp-connect-btn">连接</button>
    <span class="acp-status">已连接</span>
  </div>

  <!-- 消息区域 -->
  <div class="acp-messages">
    <div class="acp-message acp-user">...</div>
    <div class="acp-message acp-assistant">...</div>
    <div class="acp-tool-call">...</div>
  </div>

  <!-- 输入区域 -->
  <div class="acp-input-area">
    <textarea class="acp-input"></textarea>
    <button class="acp-send-btn">发送</button>
  </div>
</div>
```

### 3.3 AcpDetector

**职责**: 检测系统已安装的 ACP Agent CLI

```typescript
class AcpDetector {
  private static instance: AcpDetector;
  private detectedAgents: DetectedAgent[] = [];
  private isDetected: boolean = false;

  static getInstance(): AcpDetector;

  // === 检测 ===
  async initialize(): Promise<void>;
  async refresh(): Promise<void>;

  // === 查询 ===
  getDetectedAgents(): DetectedAgent[];
  hasAgents(): boolean;
  isAgentAvailable(id: string): boolean;
}

interface DetectedAgent {
  backend: AgentBackend;
  name: string;
  cliPath: string;
  acpArgs?: string[];
}
```

**检测逻辑**:
```typescript
async function checkCliExists(cmd: string): Promise<boolean> {
  const whichCmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    execSync(`${whichCmd} ${cmd}`, { stdio: 'pipe', timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}
```

---

## 4. 类型系统设计

### 4.1 协议基础类型

```typescript
// === JSON-RPC ===
type JsonRpcVersion = '2.0';

interface AcpRequest {
  jsonrpc: JsonRpcVersion;
  id: number;
  method: string;
  params?: unknown;
}

interface AcpResponse {
  jsonrpc: JsonRpcVersion;
  id: number;
  result?: unknown;
  error?: AcpError;
}

interface AcpNotification {
  jsonrpc: JsonRpcVersion;
  method: string;
  params?: unknown;
}

interface AcpError {
  code: number;
  message: string;
  data?: unknown;
}

// === 消息联合类型 ===
type AcpMessage = AcpRequest | AcpResponse | AcpNotification;
```

### 4.2 初始化类型

```typescript
interface InitializeParams {
  protocolVersion: number;
  clientCapabilities: ClientCapabilities;
  clientInfo?: {
    name: string;
    title?: string;
    version: string;
  };
}

interface ClientCapabilities {
  fs: {
    readTextFile: boolean;
    writeTextFile: boolean;
  };
  terminal?: boolean;
}

interface InitializeResponse {
  protocolVersion: number;
  agentCapabilities: AgentCapabilities;
  agentInfo?: {
    name: string;
    title?: string;
    version: string;
  };
  authMethods?: AuthMethod[];
}

interface AgentCapabilities {
  loadSession?: boolean;
  promptCapabilities?: {
    image?: boolean;
    audio?: boolean;
    embeddedContext?: boolean;
  };
  mcpCapabilities?: {
    http?: boolean;
    sse?: boolean;
  };
}
```

### 4.3 会话类型

```typescript
interface SessionNewParams {
  cwd: string;
  mcpServers?: McpServerConfig[];
}

interface SessionNewResponse {
  sessionId: string;
}

interface SessionPromptParams {
  sessionId: string;
  prompt: ContentBlock[];
}

interface SessionPromptResponse {
  stopReason: StopReason;
}

type StopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'max_turn_requests'
  | 'refusal'
  | 'cancelled';

// === 内容块 ===
type ContentBlock = TextContent | ImageContent | ResourceContent;

interface TextContent {
  type: 'text';
  text: string;
}

interface ImageContent {
  type: 'image';
  data: string;       // base64
  mimeType: string;
}

interface ResourceContent {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}
```

### 4.4 会话更新类型

```typescript
// === 基础接口 ===
interface BaseSessionUpdate {
  sessionId: string;
}

// === 消息块 ===
interface AgentMessageChunkUpdate extends BaseSessionUpdate {
  update: {
    sessionUpdate: 'agent_message_chunk';
    content: TextContent | ImageContent;
  };
}

// === 思考块 ===
interface AgentThoughtChunkUpdate extends BaseSessionUpdate {
  update: {
    sessionUpdate: 'agent_thought_chunk';
    content: TextContent;
  };
}

// === 工具调用 ===
interface ToolCallUpdate extends BaseSessionUpdate {
  update: {
    sessionUpdate: 'tool_call';
    toolCallId: string;
    title: string;
    kind: 'read' | 'edit' | 'execute' | 'other';
    status: ToolCallStatus;
    rawInput?: unknown;
    content?: ToolCallContent[];
    locations?: { path: string }[];
  };
}

type ToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

type ToolCallContent =
  | { type: 'content'; content: TextContent }
  | { type: 'diff'; path: string; oldText: string | null; newText: string };

// === 计划 ===
interface PlanUpdate extends BaseSessionUpdate {
  update: {
    sessionUpdate: 'plan';
    entries: PlanEntry[];
  };
}

interface PlanEntry {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority?: 'low' | 'medium' | 'high';
}

// === 联合类型 ===
type SessionUpdate =
  | AgentMessageChunkUpdate
  | AgentThoughtChunkUpdate
  | ToolCallUpdate
  | ToolCallUpdateStatus
  | PlanUpdate
  | AvailableCommandsUpdate;
```

### 4.5 权限请求类型

```typescript
interface PermissionRequest {
  sessionId: string;
  toolCall: {
    toolCallId: string;
    title?: string;
    kind?: string;
    rawInput?: {
      command?: string;
      description?: string;
      [key: string]: unknown;
    };
  };
  options: PermissionOption[];
}

interface PermissionOption {
  optionId: string;
  name: string;
  kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';
}

interface PermissionResponse {
  outcome: {
    outcome: 'selected' | 'rejected' | 'cancelled';
    optionId: string;
  };
}
```

---

## 5. 设置系统设计

### 5.1 设置数据结构

```typescript
interface AcpPluginSettings {
  // === Agent 配置 ===
  defaultAgent: string;                      // 默认 Agent ID
  agentPaths: Record<string, string>;        // 自定义 CLI 路径

  // === 工作目录 ===
  defaultCwd: 'vault' | 'current_folder' | 'custom';
  customCwd?: string;

  // === UI 偏好 ===
  showToolCallDetails: boolean;              // 显示工具调用详情
  autoScrollToBottom: boolean;               // 自动滚动到底部

  // === 权限控制 ===
  autoApproveRead: boolean;                  // 自动批准文件读取
  autoApproveWrite: boolean;                 // 自动批准文件写入 (危险)
  trustedCommands: string[];                 // 信任的命令列表

  // === 存储 ===
  maxStoredSessions: number;                 // 最大保存会话数
  autoSaveInterval: number;                  // 自动保存间隔 (ms)
}

const DEFAULT_SETTINGS: AcpPluginSettings = {
  defaultAgent: 'claude',
  agentPaths: {},
  defaultCwd: 'vault',
  showToolCallDetails: true,
  autoScrollToBottom: true,
  autoApproveRead: false,
  autoApproveWrite: false,
  trustedCommands: [],
  maxStoredSessions: 50,
  autoSaveInterval: 5000,
};
```

### 5.2 设置界面结构

```typescript
class AcpSettingsTab extends PluginSettingTab {
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // === Agent 设置组 ===
    containerEl.createEl('h2', { text: 'Agent 设置' });
    this.addAgentSelector(containerEl);
    this.addAgentPathOverrides(containerEl);

    // === 工作目录设置组 ===
    containerEl.createEl('h2', { text: '工作目录' });
    this.addCwdSettings(containerEl);

    // === UI 设置组 ===
    containerEl.createEl('h2', { text: '界面设置' });
    this.addUISettings(containerEl);

    // === 权限设置组 ===
    containerEl.createEl('h2', { text: '权限控制' });
    this.addPermissionSettings(containerEl);

    // === 存储设置组 ===
    containerEl.createEl('h2', { text: '存储设置' });
    this.addStorageSettings(containerEl);
  }
}
```

---

## 6. 存储系统设计

### 6.1 数据结构

```typescript
interface StoredSession {
  id: string;
  agentId: string;
  agentName: string;
  cwd: string;
  title: string;                   // 会话标题 (第一条消息摘要)
  messages: StoredMessage[];
  createdAt: number;
  updatedAt: number;
}

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: StoredToolCall[];
}

interface StoredToolCall {
  id: string;
  title: string;
  kind: string;
  status: ToolCallStatus;
  content?: string;
}

interface SessionSummary {
  id: string;
  title: string;
  agentName: string;
  messageCount: number;
  updatedAt: number;
}
```

### 6.2 存储接口

```typescript
class SessionStorage {
  constructor(private plugin: AcpPlugin) {}

  // === CRUD ===
  async saveSession(session: StoredSession): Promise<void>;
  async loadSession(id: string): Promise<StoredSession | null>;
  async deleteSession(id: string): Promise<void>;
  async listSessions(): Promise<SessionSummary[]>;

  // === 批量操作 ===
  async clearOldSessions(keepCount: number): Promise<void>;
  async exportSession(id: string): Promise<string>;  // JSON
  async importSession(json: string): Promise<string>; // 返回新 ID
}
```

### 6.3 存储策略

```typescript
// 使用 Obsidian 的 Plugin.loadData() / saveData()
// 数据存储在 .obsidian/plugins/obsidian-acp/data.json

interface PluginData {
  settings: AcpPluginSettings;
  sessions: Record<string, StoredSession>;  // sessionId -> session
  sessionIndex: SessionSummary[];           // 用于快速列表展示
}
```

---

## 7. 错误处理设计

### 7.1 错误类型

```typescript
enum AcpErrorCode {
  // === 连接错误 ===
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_LOST = 'CONNECTION_LOST',
  SPAWN_FAILED = 'SPAWN_FAILED',

  // === 协议错误 ===
  INIT_FAILED = 'INIT_FAILED',
  AUTH_FAILED = 'AUTH_FAILED',
  SESSION_FAILED = 'SESSION_FAILED',

  // === 超时错误 ===
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',

  // === 用户操作 ===
  USER_CANCELLED = 'USER_CANCELLED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

class AcpPluginError extends Error {
  constructor(
    public code: AcpErrorCode,
    message: string,
    public recoverable: boolean = false,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AcpPluginError';
  }
}
```

### 7.2 错误处理策略

```typescript
// === UI 层错误处理 ===
async function handleUserAction(): Promise<void> {
  try {
    await connection.sendPrompt(input);
  } catch (error) {
    if (error instanceof AcpPluginError) {
      switch (error.code) {
        case AcpErrorCode.CONNECTION_LOST:
          // 显示重连提示
          showReconnectNotice();
          break;
        case AcpErrorCode.REQUEST_TIMEOUT:
          // 显示超时提示，允许重试
          showTimeoutNotice(error.message);
          break;
        case AcpErrorCode.USER_CANCELLED:
          // 静默处理
          break;
        default:
          // 通用错误提示
          new Notice(`错误: ${error.message}`);
      }
    } else {
      // 未知错误
      console.error('Unknown error:', error);
      new Notice('发生未知错误，请查看控制台');
    }
  }
}
```

---

## 8. 安全考虑

### 8.1 文件访问控制

```typescript
// 限制文件操作范围
function isPathAllowed(targetPath: string, allowedRoot: string): boolean {
  const resolved = path.resolve(targetPath);
  const root = path.resolve(allowedRoot);
  return resolved.startsWith(root + path.sep);
}

// 文件操作前检查
async function handleFileWrite(params: { path: string; content: string }): Promise<void> {
  if (!isPathAllowed(params.path, this.cwd)) {
    throw new AcpPluginError(
      AcpErrorCode.PERMISSION_DENIED,
      `拒绝访问 Vault 外的路径: ${params.path}`
    );
  }
  // 继续处理...
}
```

### 8.2 命令执行控制

```typescript
// 危险命令检测
const DANGEROUS_PATTERNS = [
  /rm\s+-rf/,
  /sudo\s+/,
  /chmod\s+777/,
  // ...
];

function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(command));
}

// 权限请求增强
async function handlePermissionRequest(request: PermissionRequest): Promise<PermissionResponse> {
  const command = request.toolCall.rawInput?.command;

  if (command && isDangerousCommand(command)) {
    // 显示额外警告
    const confirmed = await showDangerWarning(command);
    if (!confirmed) {
      return { outcome: { outcome: 'rejected', optionId: 'reject_once' } };
    }
  }

  // 正常权限请求流程
  return await showPermissionModal(request);
}
```

---

## 9. 性能优化

### 9.1 消息渲染优化

```typescript
// 虚拟滚动（大量消息时）
class VirtualizedMessageList {
  private visibleRange: { start: number; end: number };
  private itemHeight: number = 80;

  renderVisibleMessages(messages: ChatMessage[]): void {
    const { start, end } = this.visibleRange;
    const visibleMessages = messages.slice(start, end);
    // 只渲染可见消息
  }

  onScroll(scrollTop: number, containerHeight: number): void {
    const start = Math.floor(scrollTop / this.itemHeight);
    const end = start + Math.ceil(containerHeight / this.itemHeight) + 1;
    this.visibleRange = { start, end };
    this.renderVisibleMessages(this.messages);
  }
}
```

### 9.2 流式输出优化

```typescript
// 批量更新，减少 DOM 操作
class MessageBuffer {
  private buffer: string = '';
  private flushTimeout: NodeJS.Timeout | null = null;

  append(chunk: string): void {
    this.buffer += chunk;

    if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => {
        this.flush();
      }, 50); // 50ms 批量更新
    }
  }

  private flush(): void {
    if (this.buffer) {
      this.updateDOM(this.buffer);
      this.buffer = '';
    }
    this.flushTimeout = null;
  }
}
```

---

## 10. 扩展性设计

### 10.1 自定义 Agent 支持

```typescript
interface CustomAgentConfig {
  id: string;
  name: string;
  command: string;          // CLI 命令或路径
  args?: string[];          // 启动参数
  env?: Record<string, string>;
  enabled: boolean;
}

// 设置中允许添加自定义 Agent
class SettingsTab {
  addCustomAgentSection(): void {
    // 添加/编辑/删除自定义 Agent
  }
}
```

### 10.2 MCP 服务器集成（未来）

```typescript
interface McpServerConfig {
  name: string;
  transport: 'stdio' | 'http' | 'sse';

  // stdio 配置
  command?: string;
  args?: string[];
  env?: EnvVariable[];

  // http/sse 配置
  url?: string;
  headers?: HttpHeader[];
}

// 会话创建时传递 MCP 配置
async newSession(cwd: string, mcpServers?: McpServerConfig[]): Promise<string>;
```

---

## 11. 参考资源

| 资源 | 位置 |
|------|------|
| ACP 协议文档 | `tmp/agent-client-protocol/docs/` |
| ACP Schema | `tmp/agent-client-protocol/schema/schema.json` |
| AionUi 实现参考 | `tmp/AionUi/src/agent/acp/` |
| TypeScript SDK | https://github.com/agentclientprotocol/typescript-sdk |
| Obsidian API | https://docs.obsidian.md/Plugins |

---

## 12. 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| 1.0 | 2024-12-18 | 初始设计文档 |

