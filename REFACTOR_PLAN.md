# ACP 完整重构计划

**目标**：彻底解决所有问题，实现生产级 ACP 集成

**时间**：8 小时

**原则**：
- 测试驱动开发（TDD）
- 分支开发
- 每步提交
- 参考 AionUI 最佳实践
- 全量事件适配

---

## Phase 1: 基础架构 (1小时)

### 1.1 禁用 Claude SDK
- [x] 移除 SDK 模式from registry
- [x] 更新类型定义
- [ ] 更新 ChatView 移除 SDK 相关代码
- [ ] 测试：Agent 列表不显示 SDK
- [ ] 提交：`refactor: 移除 Claude SDK 模式（Electron 不兼容）`

### 1.2 工作目录获取
- [ ] 实现基于 getBasePath() 的健壮方案
- [ ] 添加路径验证
- [ ] 添加 fallback 策略
- [ ] 测试：各种场景下的路径获取
- [ ] 提交：`feat: 实现健壮的工作目录获取`

---

## Phase 2: ACP 协议完整实现 (2小时)

### 2.1 修复 protocolVersion
- [x] protocolVersion: 1 (数字)
- [ ] 测试：initialize 成功
- [ ] 提交：`fix: 修复 protocolVersion 类型错误`

### 2.2 session/new 参数
- [x] cwd, mcpServers 参数
- [ ] 测试：session 创建成功
- [ ] 提交：`fix: 修复 session/new 参数`

### 2.3 session/prompt 参数
- [x] prompt 参数
- [ ] 测试：发送消息成功
- [ ] 提交：`fix: 修复 session/prompt 参数`

### 2.4 全量事件适配
- [ ] 研究所有 ACP 事件类型
- [ ] 实现完整的事件处理
- [ ] 测试：所有事件类型
- [ ] 提交：`feat: 全量 ACP 事件适配`

---

## Phase 3: 消息处理 (1.5小时)

### 3.1 消息缓冲
- [ ] 实现行缓冲
- [ ] JSON 解析容错
- [ ] 测试：大消息分片
- [ ] 提交：`feat: 实现消息缓冲`

### 3.2 流式响应
- [ ] 实现流式文本显示
- [ ] 工具调用显示
- [ ] 测试：流式响应
- [ ] 提交：`feat: 实现流式响应`

---

## Phase 4: 错误处理 (1.5小时)

### 4.1 统一错误类型
- [ ] 完善 errors.ts
- [ ] 错误分类
- [ ] 重试策略
- [ ] 提交：`feat: 统一错误处理`

### 4.2 连接错误处理
- [ ] 连接超时
- [ ] 进程崩溃
- [ ] 重连机制
- [ ] 测试：各种错误场景
- [ ] 提交：`feat: 完善连接错误处理`

---

## Phase 5: Agent 支持 (1小时)

### 5.1 Claude Code
- [ ] 测试：连接、发送、接收
- [ ] 提交：`test: Claude Code ACP 测试通过`

### 5.2 Codex
- [ ] 测试：连接、发送、接收
- [ ] 提交：`test: Codex 测试通过`

### 5.3 Kimi
- [ ] 测试：连接、发送、接收
- [ ] 提交：`test: Kimi 测试通过`

---

## Phase 6: 集成测试 (30分钟)

- [ ] 端到端测试脚本
- [ ] 所有 Agent 测试
- [ ] 性能测试
- [ ] 提交：`test: 完整集成测试`

---

## Phase 7: 文档和清理 (30分钟)

- [ ] 更新 README
- [ ] 更新使用文档
- [ ] 删除测试文件
- [ ] 代码注释完善
- [ ] 提交：`docs: 更新文档和清理`

---

## Phase 8: 合并 (30分钟)

- [ ] Code Review
- [ ] Merge 到 master
- [ ] Push
- [ ] Tag release

---

**开始时间**：21:40
**预计完成**：05:40

**当前进度**：Phase 1.1 进行中
