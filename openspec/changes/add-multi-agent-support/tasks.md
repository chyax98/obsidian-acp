# Tasks: 添加多 Agent 支持

## 1. 类型系统扩展

- [ ] 1.1 扩展 `AcpBackendId` 类型支持多个 Agent ID
- [ ] 1.2 完善 `AcpBackendConfig` 接口，添加能力声明字段
- [ ] 1.3 添加 `AgentCapabilities` 类型描述各 Agent 支持的功能

## 2. Agent 注册表

- [ ] 2.1 在 `registry.ts` 添加 Goose 配置
- [ ] 2.2 在 `registry.ts` 添加 OpenCode 配置
- [ ] 2.3 添加自定义 Agent 配置支持
- [ ] 2.4 实现 `getActiveBackend()` 获取当前选中的 Agent

## 3. 连接层重构

- [ ] 3.1 将 `connectClaude()` 重构为 `connectAgent(backendId)`
- [ ] 3.2 统一使用 `createSpawnConfig()` 生成启动参数
- [ ] 3.3 添加 Agent 能力检测（基于 initialize 响应）
- [ ] 3.4 处理不同 Agent 的环境变量差异

## 4. 设置页面扩展

- [ ] 4.1 添加 Agent 选择下拉框
- [ ] 4.2 为每个 Agent 创建独立配置区域
- [ ] 4.3 添加自定义 Agent 配置表单
- [ ] 4.4 添加 Agent 状态检测（已安装/未安装）
- [ ] 4.5 更新 `AcpPluginSettings` 接口

## 5. 斜杠命令动态化

- [ ] 5.1 移除硬编码的命令列表
- [ ] 5.2 基于 `available_commands_update` 动态生成命令菜单
- [ ] 5.3 添加命令缓存机制（避免频繁更新 UI）

## 6. 消息兼容性

- [ ] 6.1 验证 Goose 的 session_update 格式兼容性
- [ ] 6.2 验证 OpenCode 的 session_update 格式兼容性
- [ ] 6.3 添加能力降级处理（如 Agent 不支持音频时的处理）
- [ ] 6.4 MCP 能力感知
  - [ ] 6.4.1 在 initialize 后缓存 Agent 能力
  - [ ] 6.4.2 实现 MCP 服务器类型过滤（根据 mcpCapabilities）
  - [ ] 6.4.3 在 session/new 前过滤不支持的 MCP 服务器
  - [ ] 6.4.4 对不支持的 MCP 类型显示警告

## 7. 测试

- [ ] 7.1 测试 Claude Code 连接和消息流
- [ ] 7.2 测试 Goose 连接和消息流
- [ ] 7.3 测试 OpenCode 连接和消息流
- [ ] 7.4 测试 Agent 切换功能
- [ ] 7.5 测试斜杠命令动态更新
- [ ] 7.6 JSONL 兼容性测试
  - [ ] 7.6.1 测试 Claude Code (npx) 的消息流
  - [ ] 7.6.2 测试 Goose 的消息流
  - [ ] 7.6.3 测试 OpenCode 的消息流
  - [ ] 7.6.4 测试大消息的分片接收

## 8. 文档更新

- [ ] 8.1 更新 CLAUDE.md 中的技术架构描述
- [ ] 8.2 添加各 Agent 的安装说明
- [ ] 8.3 更新设置页面的帮助文本
