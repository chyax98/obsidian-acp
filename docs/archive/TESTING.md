# 测试与质量保障指南

本文档说明如何为 Obsidian ACP 插件编写和运行测试。

---

## 🎯 质量目标

- **类型安全**: TypeScript 严格模式
- **代码规范**: ESLint 严格检查
- **测试覆盖**: ≥60% 覆盖率
- **自动化**: CI/CD 集成

---

## 📦 测试框架

### 核心工具

| 工具 | 版本 | 用途 |
|-----|------|------|
| **Jest** | ^29.7.0 | 测试框架 |
| **ts-jest** | ^29.1.2 | TypeScript 支持 |
| **jest-mock-extended** | ^3.0.5 | 高级 Mock |
| **ESLint** | ^8.56.0 | 代码检查 |
| **TypeScript** | ^5.3.3 | 类型检查 |

### 配置文件

```
obsidian-acp/
├── jest.config.js          # Jest 配置
├── .eslintrc.js            # ESLint 规则
├── tsconfig.json           # TypeScript 严格模式
└── tests/
    ├── unit/               # 单元测试
    ├── integration/        # 集成测试
    └── mocks/              # Mock 工具
        ├── obsidian.ts     # Obsidian API Mock
        └── claude-sdk.ts   # Claude SDK Mock
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行测试

```bash
# 运行所有测试
npm test

# 监听模式（实时测试）
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

### 3. 代码检查

```bash
# 运行 ESLint
npm run lint

# 自动修复
npm run lint:fix

# TypeScript 类型检查
npm run type-check
```

### 4. 完整质量检查

```bash
# Lint + 类型检查 + 测试
npm run precommit
```

---

## 📝 编写测试

### 单元测试示例

```typescript
// tests/unit/example.test.ts
import { myFunction } from '@/src/example';

describe('myFunction', () => {
  it('should return expected result', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });

  it('should throw error on invalid input', () => {
    expect(() => myFunction('')).toThrow('Invalid input');
  });
});
```

### 使用 Obsidian Mock

```typescript
import { createMockApp, createMockVault, createMockFile } from '../mocks/obsidian';

describe('MyPlugin', () => {
  let app: MockApp;

  beforeEach(() => {
    app = createMockApp();
    // 添加测试文件
    app.vault.addMockFile(createMockFile('test.md', '# Test'));
  });

  it('should read files from vault', () => {
    const files = app.vault.getMarkdownFiles();
    expect(files.length).toBe(1);
  });
});
```

### 使用 Claude SDK Mock

Claude Agent SDK 已被 mock，可以直接测试：

```typescript
import { ClaudeSdkConnection } from '@/claude/sdk-connection';

describe('ClaudeSdkConnection', () => {
  let connection: ClaudeSdkConnection;

  beforeEach(() => {
    connection = new ClaudeSdkConnection();
  });

  it('should connect successfully', async () => {
    await connection.connect({ cwd: process.cwd() });
    expect(connection.connected).toBe(true);
  });
});
```

---

## 🔍 TypeScript 严格模式

### 启用的检查

```json
{
  "strict": true,                          // 所有严格检查
  "noUnusedLocals": true,                  // 未使用的局部变量
  "noUnusedParameters": true,              // 未使用的参数
  "noImplicitReturns": true,               // 隐式返回
  "noFallthroughCasesInSwitch": true,      // switch 穿透
  "noUncheckedIndexedAccess": true,        // 索引访问
  "noImplicitOverride": true,              // 重写方法
  "noPropertyAccessFromIndexSignature": true // 索引签名访问
}
```

### 常见问题

**问题**: 索引访问返回 `T | undefined`

```typescript
// ❌ 错误
const value = array[0];
value.toString(); // Error: Object is possibly 'undefined'

// ✅ 正确
const value = array[0];
if (value !== undefined) {
  value.toString();
}
```

**问题**: 隐式 any

```typescript
// ❌ 错误
function process(data) { // Parameter 'data' implicitly has an 'any' type
  return data.value;
}

// ✅ 正确
function process(data: DataType): ValueType {
  return data.value;
}
```

---

## 🛡️ ESLint 规则

### 关键规则

| 规则 | 级别 | 说明 |
|-----|------|------|
| `@typescript-eslint/no-explicit-any` | error | 禁止 any |
| `@typescript-eslint/no-non-null-assertion` | error | 禁止 ! 断言 |
| `@typescript-eslint/no-unused-vars` | error | 禁止未使用变量 |
| `@typescript-eslint/explicit-function-return-type` | error | 要求返回类型 |
| `@typescript-eslint/no-floating-promises` | error | 禁止浮动 Promise |
| `eqeqeq` | error | 要求 === |
| `no-console` | warn | 限制 console |
| `complexity` | warn | 复杂度 ≤15 |
| `max-depth` | warn | 嵌套 ≤4 |
| `max-lines-per-function` | warn | 函数 ≤150 行 |

### 忽略规则

在特殊情况下可以禁用规则（谨慎使用）：

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = externalLibrary();
```

---

## 📊 覆盖率要求

### 全局阈值

```javascript
coverageThreshold: {
  global: {
    branches: 60,    // 分支覆盖
    functions: 60,   // 函数覆盖
    lines: 60,       // 行覆盖
    statements: 60,  // 语句覆盖
  },
}
```

### 查看覆盖率报告

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

### 排除文件

某些文件不参与覆盖率统计：

- `src/main.ts` - 插件入口（集成测试）
- `src/**/*.d.ts` - 类型声明文件

---

## 🏗️ 测试分层

### 1. 单元测试 (tests/unit/)

测试独立的业务逻辑，不依赖 Obsidian API。

```typescript
// 测试纯函数
describe('parseMessage', () => {
  it('should parse valid message', () => {
    const result = parseMessage('{"type": "text"}');
    expect(result.type).toBe('text');
  });
});
```

### 2. 适配器测试 (tests/unit/)

测试 Obsidian API 适配器，使用 Mock。

```typescript
// 测试 Vault 适配器
describe('VaultAdapter', () => {
  it('should read files', async () => {
    const vault = createMockVault();
    const adapter = new VaultAdapter(vault);
    const content = await adapter.readFile('test.md');
    expect(content).toContain('# Test');
  });
});
```

### 3. 集成测试 (tests/integration/)

测试完整流程（可选，需要真实环境）。

```typescript
// 在实际 Obsidian 中测试
describe('FullFlow', () => {
  it('should connect and send message', async () => {
    // 需要真实 Obsidian 环境
  });
});
```

---

## 🤖 CI/CD 集成

### GitHub Actions

创建 `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Run tests
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 🐛 调试测试

### 在 VS Code 中调试

添加 `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Jest Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### 运行单个测试文件

```bash
npm test -- tests/unit/claude/sdk-connection.test.ts
```

### 运行单个测试用例

```bash
npm test -- -t "should connect successfully"
```

---

## 📚 最佳实践

### 1. 命名约定

```
tests/
├── unit/
│   └── module-name.test.ts      # 单元测试
├── integration/
│   └── feature-name.test.ts     # 集成测试
└── mocks/
    └── service-name.ts          # Mock 实现
```

### 2. 测试结构

```typescript
describe('FeatureName', () => {
  // 通用设置
  beforeEach(() => {
    // 初始化
  });

  afterEach(() => {
    // 清理
  });

  describe('methodName()', () => {
    it('should handle normal case', () => {
      // 测试正常情况
    });

    it('should throw error on invalid input', () => {
      // 测试异常情况
    });
  });
});
```

### 3. 断言清晰

```typescript
// ✅ 清晰
expect(result).toBe(expected);
expect(array).toHaveLength(3);
expect(fn).toThrow('Error message');

// ❌ 模糊
expect(result).toBeTruthy();
expect(array.length > 0).toBe(true);
```

### 4. 测试独立性

每个测试应该独立运行，不依赖其他测试的结果。

```typescript
// ✅ 独立
describe('Counter', () => {
  let counter: Counter;

  beforeEach(() => {
    counter = new Counter();
  });

  it('should increment', () => {
    counter.increment();
    expect(counter.value).toBe(1);
  });
});
```

---

## 🔧 故障排查

### 问题: ESM 模块错误

**症状**: `SyntaxError: Cannot use import statement outside a module`

**解决**: 在 `jest.config.js` 中 mock 该模块：

```javascript
moduleNameMapper: {
  '^problematic-module$': '<rootDir>/tests/mocks/module.ts',
}
```

### 问题: TypeScript 类型错误

**症状**: 测试文件中类型错误

**解决**: 检查 `tsconfig.json` 是否包含测试目录：

```json
{
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

### 问题: 覆盖率不达标

**症状**: 测试失败，覆盖率低于阈值

**解决**:
1. 运行 `npm run test:coverage` 查看报告
2. 为未覆盖的代码编写测试
3. 或调整 `jest.config.js` 中的阈值

---

## 📖 参考资源

- [Jest 官方文档](https://jestjs.io/)
- [ts-jest 文档](https://kulshekhar.github.io/ts-jest/)
- [Obsidian Plugin 测试指南](https://publish.obsidian.md/hub/04+-+Guides)
- [TypeScript 严格模式](https://www.typescriptlang.org/tsconfig#strict)
- [ESLint TypeScript 规则](https://typescript-eslint.io/rules/)

---

## 🎉 总结

通过配置：
- ✅ **Jest** 测试框架
- ✅ **TypeScript 严格模式**
- ✅ **ESLint 严格规则**
- ✅ **覆盖率≥60%**
- ✅ **Mock 工具**（Obsidian + Claude SDK）

现在可以编写高质量、可维护的代码！

---

**当前测试状态**: ✅ 5/5 passed
