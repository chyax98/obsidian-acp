# Agent 环境变量配置调研报告

**调研日期**: 2025-12-28
**状态**: 待实现

---

## 概述

本文档记录各 ACP Agent 的环境变量配置支持情况，为后续添加插件内配置 UI 提供参考。

---

## 支持情况汇总

| Agent | API Key | Model | Base URL | ACP 模式支持 |
|-------|---------|-------|----------|-------------|
| **Claude Code** | ✅ `ANTHROPIC_API_KEY` | ⚠️ 可能不生效 | ✅ `ANTHROPIC_BASE_URL` | ✅ 完全支持 |
| **Goose** | ✅ `GOOSE_PROVIDER__API_KEY` | ✅ `GOOSE_MODEL` | ✅ `GOOSE_PROVIDER__HOST` | ✅ 完全支持 |
| **OpenCode** | ✅ Provider 专属 | ✅ 配置文件 | ✅ 配置文件 | ✅ 完全支持 |
| **Gemini CLI** | ⚠️ 有已知问题 | ✅ `--model` 参数 | ❌ 不支持 | ⚠️ 有问题 |

---

## Claude Code ACP

### 支持的环境变量

#### 认证
| 环境变量 | 作用 |
|---------|------|
| `ANTHROPIC_API_KEY` | API 密钥（主要认证方式） |
| `ANTHROPIC_AUTH_TOKEN` | 认证令牌（替代方式） |

#### 模型配置
| 环境变量 | 作用 | 备注 |
|---------|------|------|
| `ANTHROPIC_MODEL` | 指定模型 | ⚠️ ACP 模式下可能不生效 |

#### API 端点
| 环境变量 | 作用 | 示例 |
|---------|------|------|
| `ANTHROPIC_BASE_URL` | 自定义 API URL | `https://openrouter.ai/api` |
| `ANTHROPIC_CUSTOM_HEADERS` | 自定义 HTTP 头 | `{"x-api-key": "..."}` |

#### 网络代理
| 环境变量 | 作用 |
|---------|------|
| `HTTP_PROXY` | HTTP 代理 |
| `HTTPS_PROXY` | HTTPS 代理 |

#### 云服务商
| 环境变量 | 作用 |
|---------|------|
| `CLAUDE_CODE_USE_BEDROCK=1` | 使用 AWS Bedrock |
| `CLAUDE_CODE_USE_VERTEX=1` | 使用 Google Vertex AI |

### 第三方代理配置示例

```bash
# OpenRouter
export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
export ANTHROPIC_API_KEY=""  # 设为空
export ANTHROPIC_CUSTOM_HEADERS='{"x-api-key": "your-openrouter-key"}'
```

### 已知限制
- `ANTHROPIC_MODEL` 在 ACP 模式下可能不生效
- 使用 `apiKeyHelper` 时代理可能失效

---

## Goose

### 支持的环境变量

#### 核心配置
| 环境变量 | 作用 | 必需 |
|---------|------|------|
| `GOOSE_PROVIDER` | LLM 提供商 (anthropic/openai 等) | ✅ |
| `GOOSE_MODEL` | 模型名称 | ✅ |
| `GOOSE_TEMPERATURE` | 温度参数 | ❌ |

#### 高级提供商配置
| 环境变量 | 作用 |
|---------|------|
| `GOOSE_PROVIDER__TYPE` | 提供商类型 |
| `GOOSE_PROVIDER__HOST` | 自定义 API 端点 |
| `GOOSE_PROVIDER__API_KEY` | API 密钥 |

#### 代码编辑配置（三个必须全部设置）
| 环境变量 | 作用 |
|---------|------|
| `GOOSE_EDITOR_API_KEY` | 代码编辑模型 API Key |
| `GOOSE_EDITOR_HOST` | 代码编辑模型端点 |
| `GOOSE_EDITOR_MODEL` | 代码编辑模型名称 |

#### 行为控制
| 环境变量 | 作用 | 值 |
|---------|------|-----|
| `GOOSE_MODE` | 工具执行模式 | auto/approve/chat/smart_approve |
| `GOOSE_MAX_TURNS` | 最大回合数 | 默认 1000 |
| `GOOSE_DEBUG` | 调试模式 | true/false |

### ACP 配置示例

```json
{
  "command": "goose",
  "args": ["acp"],
  "env": {
    "GOOSE_PROVIDER": "anthropic",
    "GOOSE_MODEL": "claude-sonnet-4-20250514",
    "GOOSE_PROVIDER__API_KEY": "sk-ant-..."
  }
}
```

### 已知限制
- 会话不持久化，每次重启客户端需要新建会话
- @ 引用文件上下文可能丢失（Issue #5626）

---

## OpenCode

### 配置方式

OpenCode 使用 **JSON/JSONC 配置文件**（不支持 YAML）。

#### 配置文件位置（优先级从高到低）
1. `OPENCODE_CONFIG` 环境变量指定的路径
2. 项目根目录 `opencode.json`
3. `~/.config/opencode/opencode.json`（全局）

### 核心环境变量

| 环境变量 | 作用 |
|---------|------|
| `OPENCODE_CONFIG` | 自定义配置文件路径 |
| `OPENCODE_CONFIG_CONTENT` | 内联 JSON 配置 |
| `OPENCODE_CONFIG_DIR` | 自定义配置目录 |

### Provider 专属环境变量

| Provider | 环境变量 |
|----------|---------|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Google | `GOOGLE_GENERATIVE_AI_API_KEY` |
| AWS Bedrock | `AWS_PROFILE`, `AWS_ACCESS_KEY_ID` |
| Azure | `AZURE_API_KEY`, `AZURE_RESOURCE_NAME` |

### 变量替换语法

配置文件支持 `{env:VAR}` 和 `{file:path}` 替换：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}"
      }
    }
  }
}
```

### ACP 配置示例

```json
{
  "command": "opencode",
  "args": ["acp"],
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-...",
    "OPENCODE_CONFIG_CONTENT": "{\"model\":\"anthropic/claude-sonnet-4-5\"}"
  }
}
```

---

## Gemini CLI

### 支持的环境变量

#### 认证
| 环境变量 | 作用 | ACP 支持 |
|---------|------|---------|
| `GEMINI_API_KEY` | Gemini API Key | ⚠️ 有问题 |
| `GOOGLE_API_KEY` | Vertex AI API Key | ✅ 更稳定 |
| `GOOGLE_CLOUD_PROJECT` | GCP 项目 ID | ✅ |
| `GOOGLE_CLOUD_LOCATION` | Vertex AI 位置 | ✅ |
| `GOOGLE_APPLICATION_CREDENTIALS` | 服务账号 JSON 路径 | ✅ |

#### 其他
| 环境变量 | 作用 |
|---------|------|
| `GEMINI_MODEL` | 默认模型（不推荐，用 --model） |
| `GOOGLE_GENAI_USE_VERTEXAI` | 强制使用 Vertex AI |
| `NODE_NO_WARNINGS` | 禁用 Node.js 警告 |

### 命令行参数

| 参数 | 作用 | 推荐 |
|-----|------|------|
| `--model` | 指定模型 | ✅ 强烈推荐 |
| `--approval-mode` | 审批模式 | ✅ 推荐 auto_edit |
| `--debug` | 调试模式 | 调试时使用 |

### ACP 配置示例

```json
{
  "command": "gemini",
  "args": ["--experimental-acp", "--model", "gemini-2.5-flash"],
  "env": {
    "GEMINI_API_KEY": "your-api-key",
    "NODE_NO_WARNINGS": "1"
  }
}
```

### 已知问题

1. **Issue #10855**: ACP 模式下 `GEMINI_API_KEY` 仍会弹出交互认证
2. **Issue #12042**: 从子进程启动时忽略缓存 OAuth 凭证
3. **Issue #14893**: 部分用户报告配额问题

### 推荐认证方式

1. **Vertex AI（最稳定）**: `GOOGLE_API_KEY` + `GOOGLE_CLOUD_PROJECT`
2. **Gemini API Key**: 可用但可能有问题

---

## 实现建议

### 方案 A：在安装说明中补充（低成本）

在 `SettingsTab.ts` 的安装说明中添加环境变量配置说明。

### 方案 B：添加配置 UI（中等成本）

在每个 Agent 卡片下添加可配置项：

| Agent | 建议配置项 |
|-------|-----------|
| Claude Code | API Key, Base URL, HTTP Proxy |
| Goose | Provider, Model, API Key, Host |
| OpenCode | 配置文件路径说明 |
| Gemini | Model (--model), API Key (提示有问题) |

### 代码实现位置

1. **类型定义**: `src/acp/backends/types.ts` - 扩展 `AcpBackendConfig`
2. **设置存储**: `src/main.ts` - 添加 `agentEnv: Record<AcpBackendId, Record<string, string>>`
3. **UI**: `src/ui/SettingsTab.ts` - 在 Agent 卡片中添加环境变量输入
4. **连接**: `src/ui/chat/helpers/connection-manager.ts` - 读取并传递环境变量

---

## 参考资料

- [Goose Environment Variables](https://block.github.io/goose/docs/guides/environment-variables/)
- [OpenCode Config](https://opencode.ai/docs/config/)
- [Gemini CLI Configuration](https://geminicli.com/docs/get-started/configuration/)
- [Claude Code Network Config](https://docs.anthropic.com/en/docs/claude-code/network-config)
- [Claude Code Environment Variables Gist](https://gist.github.com/unkn0wncode/f87295d055dd0f0e8082358a0b5cc467)
