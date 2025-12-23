# Changelog

所有重要更改将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [1.0.0] - 2025-12-23

### 破坏性变更
- **移除多 Agent 支持**：只保留 Claude Code，移除 Kimi、Codex、Gemini、Qwen 支持
- **移除检测系统**：删除 5 层优先级检测，简化为 npx/全局安装两种启动方式

### 新增
- **模式切换**：支持 default/plan 模式切换
- **环境变量配置**：设置页面支持配置 API Key、Base URL、HTTP Proxy
- **启动方式选择**：支持 npx（默认）和全局安装两种方式
- **@ 文件引用**：输入 `@` 弹出文件搜索
- **拖拽文件**：从文件树拖拽到聊天输入框
- **斜杠命令**：输入 `/` 显示可用命令
- **历史查看模式**：查看历史对话时显示返回按钮
- **清除错误卡片**：一键清除连接错误提示
- **增强工具调用渲染**：详细显示输入输出内容

### 修复
- **isProcessing 状态**：修复发送消息后状态未重置的问题
- **dev-deploy.sh**：修复部署脚本

### 重构
- **连接模块**：拆分 connection.ts（1277 行 → 744 行）
- **会话管理器**：拆分 session-manager.ts 为模块化结构
- **ChatView**：拆分为模块化组件
- **MessageRenderer**：拆分为独立渲染器（diff、terminal、plan、thought）

### 文档
- **更新 README**：简化为只支持 Claude Code
- **清理过时文档**：删除多 Agent 配置指南

## [0.2.0] - 2025-12-22

### 修复
- **权限响应格式**：修复 ACP 权限响应格式，从 `{ outcome: { type: 'selected' } }` 改为正确的 `{ outcome: { outcome: 'selected' } }`
- **历史消息覆盖**：修复 `MessageRenderer.renderMessage()` 中 `container.empty()` 导致新消息覆盖历史消息的问题
- **类型安全**：修复 `PermissionOutcome` 联合类型处理

### 优化
- **布局紧凑化**：减少消息间距、内边距
- **工具显示**：为不同工具类型添加 emoji 图标
- **状态颜色**：为工具调用状态添加颜色区分

### 新增
- **流式消息缓冲**：实现 `StreamingMessageBuffer` 类，减少 UI 更新频率
- **模式更新事件**：实现 `current_mode_update` 和 `available_commands_update` 处理
- **思考过程渲染**：实现 `agent_thought_chunk` 处理和 UI 渲染

## [0.1.0] - 2024-12-18

### 初始版本
- ACP 协议基础实现
- Claude Code 后端支持
- 基础聊天界面
- 权限请求弹窗
- 会话持久化
