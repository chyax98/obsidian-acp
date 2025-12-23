# 补充评估：MCP 通用逻辑 + JSONL 适配

## 1. MCP 通用逻辑适配

### 1.1 当前实现分析

当前 `McpConfigProcessor` 已实现通用的 MCP 配置处理：

```typescript
// src/acp/core/mcp-config.ts
class McpConfigProcessor {
  getServersConfig(mcpServers: McpServerConfig[]): SessionNewMcpServerConfig[]
  buildStdioConfig(server): SessionNewMcpServerConfig
  buildHttpConfig(server): SessionNewMcpServerConfig
  buildSseConfig(server): SessionNewMcpServerConfig
}
```

支持的传输类型：
- `stdio` - 所有 Agent 必须支持
- `http` - Claude Code ✅, OpenCode ✅, Goose ❓
- `sse` - Claude Code ❓, OpenCode ❌, Goose ❌

### 1.2 各 Agent 的 MCP 支持差异

| Agent | stdio | http | sse | 备注 |
|-------|-------|------|-----|------|
| Claude Code | ✅ | ✅ | ❓ | 通过 session/new 传递 |
| Goose | ✅ | ❓ | ❌ | 通过 extensions 系统管理 |
| OpenCode | ✅ | ✅ | ❌ | 通过配置文件或 session/new |

### 1.3 评估结论

**MCP 处理策略**：

1. **通用逻辑保持不变**
   - `McpConfigProcessor` 已足够通用
   - 只需在 `session/new` 时传递配置

2. **Agent 特定适配**
   - Claude Code: 无需修改
   - Goose: 自动加载 extensions，可选择是否传递 mcpServers
   - OpenCode: 同 Claude Code

3. **能力感知**
   - 根据 `initialize` 响应的 `mcpCapabilities` 判断支持的传输类型
   - 只传递 Agent 支持的 MCP 服务器类型

```typescript
// 建议的适配逻辑
function filterMcpServers(
  servers: McpServerConfig[],
  agentCapabilities: McpCapabilities
): McpServerConfig[] {
  return servers.filter(server => {
    if (server.type === 'stdio') return true; // 所有 Agent 必须支持
    if (server.type === 'http') return agentCapabilities.http === true;
    if (server.type === 'sse') return agentCapabilities.sse === true;
    return false;
  });
}
```

4. **Goose 特殊处理**
   - Goose 通过 `~/.config/goose/profiles.yaml` 管理 extensions
   - 可选择：
     - 方案 A：不传递 mcpServers，使用 Goose 自己的配置
     - 方案 B：传递 mcpServers，让 Goose 额外加载

**建议采用方案 B**，保持行为一致。

---

## 2. JSONL 适配 (JSON Lines)

### 2.1 当前实现分析

当前 `connection.ts` 的 JSONL 处理：

```typescript
// 接收数据
private handleStdoutData(data: string): void {
  this.messageBuffer += data;
  const lines = this.messageBuffer.split("\n");
  this.messageBuffer = lines.pop() || "";  // 保留不完整的行

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      const message = JSON.parse(trimmed) as AcpMessage;
      this.handleMessage(message);
    }
  }
}

// 发送数据
const json = JSON.stringify(message);
const lineEnding = Platform.isWin ? "\r\n" : "\n";
this.child.stdin.write(json + lineEnding);
```

### 2.2 ACP 协议规范

根据 ACP 协议文档：
- 传输层使用 JSON-RPC 2.0 over stdio
- 每条消息是一行有效的 JSON
- 消息以换行符分隔

### 2.3 各 Agent 的 JSONL 格式

| Agent | 输入行结束符 | 输出行结束符 | 格式 |
|-------|-------------|-------------|------|
| Claude Code | `\n` | `\n` | 标准 JSONL |
| Goose | `\n` | `\n` | 标准 JSONL |
| OpenCode | `\n` | `\n` | 标准 JSONL |

**结论**：所有 ACP Agent 使用相同的 JSONL 格式，无需适配。

### 2.4 Zed ACP 嵌套兼容性

**问题描述**：
- `@zed-industries/claude-code-acp` 是 Claude Code 的 ACP 适配器
- 它本身会 spawn Claude Code 进程并转发 ACP 消息
- 存在"嵌套"关系：Obsidian → claude-code-acp → Claude Code CLI

**兼容性分析**：

1. **协议层面**
   - claude-code-acp 完全遵循 ACP 协议
   - 对 Obsidian 透明，无需特殊处理

2. **消息格式**
   - 输入/输出都是标准 JSONL
   - 无特殊编码或嵌套

3. **与原生 ACP CLI 的对比**

   | 特性 | claude-code-acp | 原生 ACP CLI (如 Goose) |
   |------|-----------------|----------------------|
   | 启动命令 | `npx @zed-industries/claude-code-acp` | `goose acp` |
   | 消息格式 | JSONL | JSONL |
   | 协议版本 | ACP 1.0 | ACP 1.0 |
   | 嵌套层级 | 2 层 | 1 层 |
   | 性能 | 略慢（npx 开销） | 较快 |

4. **潜在问题**
   - `npx` 首次运行需要下载包
   - Windows 上的路径处理差异（已在 `createSpawnConfig` 中处理）

### 2.5 评估结论

**JSONL 无需适配**：
- 所有 ACP Agent 使用相同的 JSONL 格式
- 当前的 `handleStdoutData` 实现已经正确处理

**Zed ACP 嵌套兼容**：
- claude-code-acp 是透明的适配层
- 不影响上层协议处理
- 唯一需要注意的是 npx 的首次启动延迟

---

## 3. 需要新增的适配代码

### 3.1 MCP 能力过滤

```typescript
// src/acp/core/mcp-config.ts 新增方法
export function filterByCapabilities(
  servers: McpServerConfig[],
  capabilities?: McpCapabilities
): McpServerConfig[] {
  if (!capabilities) return servers;

  return servers.filter(server => {
    switch (server.type) {
      case 'stdio':
        return true; // 所有 Agent 必须支持
      case 'http':
        return capabilities.http === true;
      case 'sse':
        return capabilities.sse === true;
      default:
        return false;
    }
  });
}
```

### 3.2 Agent 能力缓存

```typescript
// src/acp/core/connection.ts 新增
export class AcpConnection {
  private agentCapabilities: AgentCapabilities | null = null;

  public getMcpCapabilities(): McpCapabilities | undefined {
    return this.agentCapabilities?.mcpCapabilities;
  }
}
```

### 3.3 无需修改的部分

- JSONL 解析逻辑（已通用）
- 消息发送逻辑（已通用）
- 平台行结束符处理（已处理）

---

## 4. 任务清单更新

原 tasks.md 已包含 MCP 相关任务，补充以下内容：

```markdown
## 6.5 MCP 能力感知
- [ ] 6.5.1 在 initialize 后缓存 Agent 能力
- [ ] 6.5.2 实现 MCP 服务器类型过滤
- [ ] 6.5.3 在 session/new 前过滤不支持的 MCP 服务器
- [ ] 6.5.4 对不支持的 MCP 类型显示警告

## 7.6 JSONL 兼容性测试
- [ ] 7.6.1 测试 Claude Code (npx) 的消息流
- [ ] 7.6.2 测试 Goose 的消息流
- [ ] 7.6.3 测试 OpenCode 的消息流
- [ ] 7.6.4 测试大消息的分片接收
```

---

## 5. 风险评估更新

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| MCP http 类型不支持 | 低 | 过滤并警告用户 |
| JSONL 解析错误 | 极低 | 已有错误处理 |
| Zed 嵌套延迟 | 低 | 提示用户使用全局安装 |
| Goose extensions 冲突 | 中 | 文档说明，建议清理 |

---

## 总结

1. **MCP 通用逻辑**：已基本完备，只需添加能力过滤
2. **JSONL 适配**：无需修改，格式完全一致
3. **Zed ACP 嵌套**：透明兼容，无需特殊处理
4. **建议**：将上述任务添加到 tasks.md
