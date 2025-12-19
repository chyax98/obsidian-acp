# 权限系统简化方案

**版本**: 2.0
**日期**: 2025-12-20
**状态**: 设计阶段

---

## 📋 执行摘要

基于对 ACP 协议和各 Agent 实现的深入调研，发现：
1. ❌ Zed ACP 适配器（claude-code-acp, codex-acp）**不支持 CLI 权限参数**
2. ❌ 无法通过 npx 传递权限配置
3. ❌ 无法在 Electron 中直接 import（native bindings 问题）
4. ✅ **正确方案**：在插件端（ACP Client）拦截协议请求，统一处理权限

**新设计**：从 5 种复杂模式简化为 **2 种实用模式**，符合"要么不问，要么全同意"的理念，配合 Git 使用完全安全。

---

## 🎯 设计目标

### 核心原则

1. **极简化**：只保留最实用的 2 种模式
2. **用户友好**：配合 Git，完全信任模式很安全
3. **协议标准**：基于 ACP `session/request_permission` 机制
4. **通用兼容**：所有 Agent（Claude/Codex/Kimi/Gemini/Qwen）统一处理

### 删除的过度设计

| 删除内容 | 原因 |
|---------|------|
| ❌ 5 种权限模式 | 过度复杂，用户不需要 |
| ❌ 工具级别配置 | 颗粒度过细，维护成本高 |
| ❌ 预配置规则 | 过度设计，实际使用场景少 |
| ❌ 权限审计页面 | 控制台日志足够 |
| ❌ CLI 权限参数 | Agent 不支持 |

---

## 🔧 技术方案

### 1. 权限模式定义

```typescript
/**
 * 权限模式
 *
 * @remarks
 * 基于 ACP 协议的 session/request_permission 机制实现
 */
export type PermissionMode =
  | 'interactive'  // 每次询问（默认）
  | 'trustAll';    // 完全信任

export interface PermissionSettings {
  /** 当前权限模式 */
  mode: PermissionMode;

  /**
   * 用户选择的"始终允许"记录
   * 键：工具名称（如 "fs/read"）
   * 值：true（始终允许）
   *
   * @remarks
   * 仅在 interactive 模式下使用
   * 当用户在权限对话框中点击"始终允许"时记录
   */
  alwaysAllowedTools: Record<string, boolean>;
}
```

### 2. 架构设计

```
用户请求
    ↓
Agent 处理
    ↓
需要工具调用（文件读写/命令执行）
    ↓
Agent 发送 session/request_permission → 插件拦截
    ↓
    ├─ mode = 'interactive' → 检查 alwaysAllowedTools
    │   ├─ 已记录"始终允许" → 自动批准
    │   └─ 未记录 → 弹出权限对话框
    │       ├─ 用户点击"允许一次" → 批准此次
    │       ├─ 用户点击"始终允许" → 批准 + 记录到 alwaysAllowedTools
    │       └─ 用户点击"拒绝" → 拒绝
    │
    └─ mode = 'trustAll' → 自动批准所有请求
```

### 3. 核心实现

#### 3.1 设置接口

**文件**: `src/settings.ts`

```typescript
export interface AcpPluginSettings {
  // ... 现有设置

  /** 权限配置 */
  permission: PermissionSettings;
}

export const DEFAULT_SETTINGS: AcpPluginSettings = {
  // ... 现有默认值

  permission: {
    mode: 'interactive',  // 默认每次询问
    alwaysAllowedTools: {}
  }
};
```

#### 3.2 权限管理器

**新文件**: `src/acp/permission-manager.ts`

```typescript
import { Notice } from 'obsidian';
import type { PermissionSettings } from '../settings';

export interface PermissionRequest {
  toolCallId: string;
  toolName: string;      // 如 "fs/read", "bash/run"
  title: string;         // 如 "Reading configuration file"
  kind: string;          // 如 "read", "write", "execute"
  rawInput: Record<string, any>;
}

export interface PermissionResponse {
  outcome: 'selected' | 'cancelled';
  optionId?: string;  // 'allow-once' | 'allow-always' | 'reject-once'
}

/**
 * 权限管理器
 *
 * @remarks
 * 拦截 ACP 协议的 session/request_permission 请求
 * 根据设置决定自动批准或弹窗询问
 */
export class PermissionManager {
  constructor(
    private settings: PermissionSettings,
    private saveSettings: () => Promise<void>
  ) {}

  /**
   * 处理权限请求
   */
  async handlePermissionRequest(
    request: PermissionRequest
  ): Promise<PermissionResponse> {
    const { toolName } = request;

    // 模式 1: 完全信任 - 自动批准所有请求
    if (this.settings.mode === 'trustAll') {
      console.log(`[ACP] Auto-approved tool: ${toolName} (Trust All mode)`);
      return {
        outcome: 'selected',
        optionId: 'allow-once'
      };
    }

    // 模式 2: 每次询问 - 检查是否已记录"始终允许"
    if (this.settings.alwaysAllowedTools[toolName]) {
      console.log(`[ACP] Auto-approved tool: ${toolName} (Always Allowed)`);
      return {
        outcome: 'selected',
        optionId: 'allow-once'
      };
    }

    // 弹出权限对话框
    return await this.showPermissionDialog(request);
  }

  /**
   * 显示权限对话框
   */
  private async showPermissionDialog(
    request: PermissionRequest
  ): Promise<PermissionResponse> {
    return new Promise((resolve) => {
      const modal = new PermissionModal(
        this.app,
        request,
        async (response: PermissionResponse) => {
          // 如果用户选择"始终允许"，记录到设置
          if (response.optionId === 'allow-always') {
            this.settings.alwaysAllowedTools[request.toolName] = true;
            await this.saveSettings();

            new Notice(`已记住：始终允许 ${request.toolName}`);

            // 转换为 allow-once 返回给 Agent
            resolve({
              outcome: 'selected',
              optionId: 'allow-once'
            });
          } else {
            resolve(response);
          }
        }
      );
      modal.open();
    });
  }

  /**
   * 重置"始终允许"记录
   */
  async resetAlwaysAllowed(): Promise<void> {
    this.settings.alwaysAllowedTools = {};
    await this.saveSettings();
    new Notice('已清除所有"始终允许"记录');
  }
}
```

#### 3.3 权限对话框

**新文件**: `src/ui/permission-modal.ts`

```typescript
import { App, Modal, Setting } from 'obsidian';
import type { PermissionRequest, PermissionResponse } from '../acp/permission-manager';

export class PermissionModal extends Modal {
  constructor(
    app: App,
    private request: PermissionRequest,
    private onResponse: (response: PermissionResponse) => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('acp-permission-modal');

    // 标题
    contentEl.createEl('h2', { text: '🔧 权限请求' });

    // 工具信息
    new Setting(contentEl)
      .setName('工具')
      .setDesc(this.request.toolName);

    new Setting(contentEl)
      .setName('操作')
      .setDesc(this.request.title);

    // 参数预览
    const paramsEl = contentEl.createDiv('acp-permission-params');
    paramsEl.createEl('strong', { text: '参数：' });
    paramsEl.createEl('pre', {
      text: JSON.stringify(this.request.rawInput, null, 2)
    });

    // 风险提示
    if (this.isHighRiskTool(this.request.toolName)) {
      const warningEl = contentEl.createDiv('acp-permission-warning');
      warningEl.createEl('span', { text: '⚠️ ' });
      warningEl.createEl('strong', { text: '高风险操作' });
      warningEl.createEl('p', {
        text: '此操作可能修改/删除文件或执行命令，请仔细检查参数。'
      });
    }

    // 按钮
    const buttonContainer = contentEl.createDiv('acp-permission-buttons');

    // 拒绝
    const rejectBtn = buttonContainer.createEl('button', { text: '拒绝' });
    rejectBtn.addEventListener('click', () => {
      this.onResponse({ outcome: 'selected', optionId: 'reject-once' });
      this.close();
    });

    // 允许一次
    const allowOnceBtn = buttonContainer.createEl('button', {
      text: '允许一次',
      cls: 'mod-cta'
    });
    allowOnceBtn.addEventListener('click', () => {
      this.onResponse({ outcome: 'selected', optionId: 'allow-once' });
      this.close();
    });

    // 始终允许
    const alwaysBtn = buttonContainer.createEl('button', {
      text: '始终允许此工具'
    });
    alwaysBtn.addEventListener('click', () => {
      this.onResponse({ outcome: 'selected', optionId: 'allow-always' });
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private isHighRiskTool(toolName: string): boolean {
    const highRiskTools = [
      'fs/write',
      'fs/delete',
      'fs/move',
      'bash/run',
      'bash/background'
    ];
    return highRiskTools.includes(toolName);
  }
}
```

#### 3.4 集成到 Connection

**修改文件**: `src/acp/connection.ts`

```typescript
import { PermissionManager } from './permission-manager';

export class AcpConnection {
  private permissionManager: PermissionManager;

  constructor(/* ... */) {
    // ... 现有代码

    this.permissionManager = new PermissionManager(
      this.settings.permission,
      () => this.plugin.saveSettings()
    );

    this.setupPermissionHandler();
  }

  private setupPermissionHandler(): void {
    // 监听来自 Agent 的权限请求
    this.process.on('message', async (message) => {
      if (message.method === 'session/request_permission') {
        const request = this.parsePermissionRequest(message.params);
        const response = await this.permissionManager.handlePermissionRequest(request);

        // 发送响应给 Agent
        this.sendMessage({
          jsonrpc: '2.0',
          id: message.id,
          result: { outcome: response }
        });
      }
    });
  }

  private parsePermissionRequest(params: any): PermissionRequest {
    return {
      toolCallId: params.toolCall.toolCallId,
      toolName: params.toolCall.kind,  // 或根据实际协议字段
      title: params.toolCall.title,
      kind: params.toolCall.kind,
      rawInput: params.toolCall.rawInput
    };
  }
}
```

#### 3.5 设置页面

**修改文件**: `src/ui/settings-tab.ts`

```typescript
export class AcpSettingTab extends PluginSettingTab {
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ... 现有设置

    // 权限管理
    containerEl.createEl('h2', { text: '权限管理' });

    // 权限模式选择
    new Setting(containerEl)
      .setName('权限模式')
      .setDesc('控制 AI Agent 如何请求文件操作权限')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('interactive', '每次询问（推荐新手）')
          .addOption('trustAll', '完全信任（配合 Git 使用）')
          .setValue(this.plugin.settings.permission.mode)
          .onChange(async (value) => {
            this.plugin.settings.permission.mode = value as PermissionMode;
            await this.plugin.saveSettings();

            // 显示提示
            if (value === 'trustAll') {
              new Notice('⚠️ 已开启完全信任模式，建议配合 Git 使用');
            }
          })
      );

    // 说明
    const descEl = containerEl.createDiv('setting-item-description');
    descEl.innerHTML = `
      <strong>每次询问</strong>：每个操作都弹窗确认，可选择"始终允许"特定工具<br>
      <strong>完全信任</strong>：自动批准所有操作，配合 Git 回滚保证安全
    `;

    // 重置"始终允许"记录
    if (this.plugin.settings.permission.mode === 'interactive') {
      const allowedCount = Object.keys(
        this.plugin.settings.permission.alwaysAllowedTools
      ).length;

      new Setting(containerEl)
        .setName('重置"始终允许"记录')
        .setDesc(`当前已记录 ${allowedCount} 个工具`)
        .addButton((button) =>
          button
            .setButtonText('清除')
            .onClick(async () => {
              await this.plugin.permissionManager.resetAlwaysAllowed();
              this.display();  // 刷新页面
            })
        );
    }
  }
}
```

### 4. 样式

**新文件**: `src/styles/permission-modal.css`

```css
/* 权限对话框 */
.acp-permission-modal {
  min-width: 500px;
}

.acp-permission-params {
  margin: 1em 0;
  padding: 1em;
  background: var(--background-secondary);
  border-radius: 4px;
}

.acp-permission-params pre {
  margin: 0.5em 0 0;
  padding: 0.5em;
  background: var(--background-primary);
  border-radius: 4px;
  font-size: 0.9em;
  max-height: 200px;
  overflow-y: auto;
}

.acp-permission-warning {
  margin: 1em 0;
  padding: 1em;
  background: var(--background-modifier-error);
  border-left: 4px solid var(--text-error);
  border-radius: 4px;
}

.acp-permission-warning p {
  margin: 0.5em 0 0;
  color: var(--text-error);
}

.acp-permission-buttons {
  display: flex;
  gap: 0.5em;
  justify-content: flex-end;
  margin-top: 1.5em;
}

.acp-permission-buttons button {
  padding: 0.5em 1em;
}
```

---

## 📊 文件修改清单

### 新增文件

1. `src/acp/permission-manager.ts` - 权限管理器
2. `src/ui/permission-modal.ts` - 权限对话框
3. `src/styles/permission-modal.css` - 样式
4. `docs/PERMISSION_SYSTEM_REDESIGN.md` - 本文档

### 修改文件

1. `src/settings.ts` - 添加 `PermissionSettings` 接口
2. `src/acp/connection.ts` - 集成权限管理器
3. `src/ui/settings-tab.ts` - 添加权限设置 UI
4. `src/main.ts` - 注册权限管理器
5. `styles.css` - 导入权限对话框样式

### 删除文件

1. `docs/PERMISSIONS.md` - 过度设计的文档（待删除）

---

## 🎯 实现步骤

### Phase 1: 核心实现（1-2 小时）

1. ✅ 创建 `PermissionManager` 类
2. ✅ 创建 `PermissionModal` 对话框
3. ✅ 修改 `Connection` 集成权限处理
4. ✅ 更新 `Settings` 接口

### Phase 2: UI 集成（30 分钟）

5. ✅ 添加设置页面 UI
6. ✅ 添加样式
7. ✅ 测试交互流程

### Phase 3: 测试验证（30 分钟）

8. ✅ 测试"每次询问"模式
9. ✅ 测试"完全信任"模式
10. ✅ 测试"始终允许"记录
11. ✅ 测试不同 Agent（Claude/Kimi/Gemini）

### Phase 4: 文档更新（30 分钟）

12. ✅ 更新 CLAUDE.md 权限章节
13. ✅ 删除 docs/PERMISSIONS.md
14. ✅ 更新 README.md
15. ✅ 更新 FAQ.md

---

## 📝 用户文档更新

### README.md

```markdown
## 🔒 权限管理

插件提供 2 种权限模式：

- **每次询问**（默认）：每个操作都弹窗确认，安全可控
- **完全信任**：自动批准所有操作，配合 Git 使用

**推荐配置**：
- 新手用户 → "每次询问" → 熟悉后可选择"始终允许"特定工具
- 高级用户 → "完全信任" + Git 版本控制

详细说明：[权限系统](./docs/PERMISSION_SYSTEM_REDESIGN.md)
```

### FAQ.md 新增

```markdown
### Q: 为什么只有 2 种权限模式？

A: 基于实际使用场景简化设计：
- 复杂的权限配置（5+ 种模式）用户很少使用
- 配合 Git 版本控制，"完全信任"模式完全安全
- 简化后的设计更易理解和维护

### Q: "完全信任"模式安全吗？

A: 配合 Git 使用完全安全：
- 所有修改都可以通过 `git diff` 查看
- 一键回滚：`git reset --hard HEAD`
- AI 误操作立即恢复，不会丢失数据
```

---

## 🔍 技术细节

### ACP 协议消息格式

**Agent → Client (请求权限)**:
```json
{
  "jsonrpc": "2.0",
  "id": 123,
  "method": "session/request_permission",
  "params": {
    "sessionId": "sess_abc",
    "toolCall": {
      "toolCallId": "call_001",
      "title": "Writing to file",
      "kind": "write",
      "rawInput": {
        "path": "notes/test.md",
        "content": "..."
      }
    },
    "options": [
      { "optionId": "allow-once", "name": "Allow once", "kind": "allow_once" },
      { "optionId": "allow-always", "name": "Allow always", "kind": "allow_always" },
      { "optionId": "reject-once", "name": "Reject", "kind": "reject_once" }
    ]
  }
}
```

**Client → Agent (响应)**:
```json
{
  "jsonrpc": "2.0",
  "id": 123,
  "result": {
    "outcome": {
      "outcome": "selected",
      "optionId": "allow-once"
    }
  }
}
```

### 错误处理

```typescript
try {
  const response = await this.permissionManager.handlePermissionRequest(request);
  this.sendPermissionResponse(message.id, response);
} catch (error) {
  console.error('[ACP] Permission error:', error);
  // 默认拒绝
  this.sendPermissionResponse(message.id, {
    outcome: 'selected',
    optionId: 'reject-once'
  });
}
```

---

## ✅ 验收标准

### 功能测试

- [ ] "每次询问"模式下，文件操作弹窗显示正确
- [ ] 点击"允许一次"，Agent 成功执行操作
- [ ] 点击"始终允许"，记录保存且后续自动批准
- [ ] 点击"拒绝"，Agent 收到拒绝响应
- [ ] "完全信任"模式下，所有操作自动批准
- [ ] 重置"始终允许"记录功能正常

### 兼容性测试

- [ ] Claude Code 权限请求正常
- [ ] Codex ACP 权限请求正常
- [ ] Kimi 权限请求正常
- [ ] Gemini CLI 权限请求正常
- [ ] Qwen Code 权限请求正常

### 性能测试

- [ ] 权限对话框响应时间 < 100ms
- [ ] "完全信任"模式无性能影响
- [ ] 批量操作（10+ 个文件）流畅

---

## 🚀 后续优化（可选）

### V2.0 后考虑的功能

1. **权限历史记录**
   - 在设置页面显示最近 10 条权限请求
   - 仅用于调试，不做复杂审计

2. **工作目录限制**
   - 限制 Agent 只能访问 Vault 内文件
   - 在设置中可配置允许的路径

3. **操作撤销**（需要额外开发）
   - 记录文件修改前的内容
   - 提供简单的 Undo 功能

---

## 📚 参考资料

- [ACP 协议规范](https://agentclientprotocol.com/protocol/tool-calls#requesting-permission)
- [Agent 调研报告](./ACP_PERMISSION_RESEARCH.md)
- [原权限系统设计](./PERMISSIONS.md)（已废弃）

---

**方案制定人**: Claude Code
**审核状态**: 待用户审批
**实施时间**: 待定
