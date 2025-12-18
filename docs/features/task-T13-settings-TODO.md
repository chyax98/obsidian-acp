# T13: 设置界面 - 任务待办

> Agent: Claude-Agent-T13
> 开始时间: 2025-12-18
> 完成时间: 2025-12-18
> 状态: ✅ 已完成

## 任务目标

创建插件设置界面，配置 Agent 后端

## 依赖任务

- [x] T03: Agent 后端配置

## 实施计划

### 1. 设置数据结构

- [x] 定义 `AcpPluginSettings` 接口
  - selectedBackend: 选中的后端 ID
  - customCliPath: 自定义 CLI 路径
  - workingDir: 工作目录模式
  - customWorkingDir: 自定义工作目录路径
  - backendPaths: 各后端的自定义路径覆盖
  - uiPreferences: UI 偏好设置

### 2. SettingsTab 类

- [x] 创建 `AcpSettingTab` 类
- [x] 实现基础布局
- [x] 实现 Agent 后端选择
- [x] 实现工作目录配置
- [x] 实现各后端的自定义路径配置
- [x] 实现 UI 偏好设置

### 3. 集成到 main.ts

- [x] 更新 main.ts 中的 settings 类型
- [x] 添加设置持久化逻辑
- [x] 注册 SettingsTab

### 4. 验证

- [x] 编译成功
- [x] 设置界面显示正常
- [x] 设置可以保存和加载

## 文件清单

- `src/ui/SettingsTab.ts` (新建) ✅
- `src/main.ts` (修改) ✅

## 完成标准

- [x] 设置界面可正常显示
- [x] 可选择和配置不同的 Agent 后端
- [x] 工作目录配置功能正常
- [x] 设置可持久化
- [x] 编译无错误

## 备注

- 使用 Obsidian 的 PluginSettingTab API
- 后端列表从 `src/acp/backends/registry.ts` 获取
- 设置持久化使用 Obsidian 的 loadData/saveData API

## 执行日志

- 2025-12-18 开始任务
  - 更新执行计划文档
  - 创建任务文档
  - 创建 SettingsTab.ts
  - 更新 main.ts 集成设置
  - 编译验证通过
  - 任务完成

## 实施成果

### 创建的文件

1. **src/ui/SettingsTab.ts** (273 行)
   - 实现了完整的设置界面
   - 包含 4 个设置部分：基础设置、工作目录、后端路径覆盖、UI 偏好
   - 支持动态显示/隐藏自定义工作目录输入
   - 支持重置后端路径到默认值

### 修改的文件

1. **src/main.ts**
   - 更新 AcpPluginSettings 接口，包含完整的设置字段
   - 导入 AcpSettingTab
   - 删除旧的 SettingsTab 类定义
   - 保持设置持久化逻辑不变

### 功能特性

1. **基础设置**
   - 默认 Agent 后端下拉选择
   - 自定义 CLI 路径输入（用于 custom 后端）

2. **工作目录配置**
   - 3 种模式: Vault 根目录 / 当前笔记文件夹 / 自定义路径
   - 自定义路径输入（仅在选择 custom 时显示）

3. **后端路径覆盖**
   - 为每个启用的后端提供路径覆盖输入
   - 显示默认路径作为 placeholder
   - 支持重置按钮清空覆盖

4. **UI 偏好**
   - 显示工具调用详情开关
   - 自动批准文件读取开关
   - 调试模式开关

5. **关于部分**
   - ACP 协议说明
   - 支持的 Agent 列表
   - 协议文档链接
