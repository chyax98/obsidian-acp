# Changelog

所有重要更改将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [0.3.0] - 2025-12-23

### 新增
- **多 Agent 支持**：Claude Code, Goose, OpenCode, 自定义 Agent
- **标签页独立 Agent**：每个 ChatView 标签页可独立选择 Agent
- **Agent 切换锁定**：对话进行中禁止切换 Agent，需新建对话
- **设置页 Agent 平铺**：Agent 配置改为平铺展示
- **请求超时配置**：可配置请求超时时间（默认 5 分钟）
- **MCP 能力感知**：根据 Agent 能力自动过滤 MCP 服务器

### 重构
- **MessageRenderer 拆分**：拆分为独立渲染器模块（message, tool-call, diff, terminal, plan, thought）
- **删除兼容层**：移除 `src/ui/MessageRenderer.ts` 和 `src/ui/ChatView.ts` 兼容层

## [0.2.0] - 2025-12-22

### 修复
- **权限响应格式**：修复 ACP 权限响应格式
- **历史消息覆盖**：修复新消息覆盖历史消息的问题
- **类型安全**：修复 `PermissionOutcome` 联合类型处理

### 优化
- **布局紧凑化**：减少消息间距、内边距
- **工具显示**：为不同工具类型添加 emoji 图标
- **状态颜色**：为工具调用状态添加颜色区分

### 新增
- **流式消息缓冲**：实现 `StreamingMessageBuffer` 类，减少 UI 更新频率
- **模式更新事件**：实现 `current_mode_update` 和 `available_commands_update` 处理
- **思考过程渲染**：实现 `agent_thought_chunk` 处理和 UI 渲染
- **模式切换**：支持 default/plan 模式切换
- **环境变量配置**：设置页面支持配置 API Key、Base URL、HTTP Proxy
- **@ 文件引用**：输入 `@` 弹出文件搜索
- **拖拽文件**：从文件树拖拽到聊天输入框
- **斜杠命令**：输入 `/` 显示可用命令

## [0.1.0] - 2024-12-18

### 初始版本
- ACP 协议基础实现
- Claude Code 后端支持
- 基础聊天界面
- 权限请求弹窗
- 会话持久化
