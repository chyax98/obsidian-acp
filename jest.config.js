/**
 * Jest 配置 - Obsidian 插件测试
 */

module.exports = {
	// 使用 ts-jest 预设处理 TypeScript
	preset: 'ts-jest',

	// Node 环境（Obsidian 运行在 Electron/Node）
	testEnvironment: 'node',

	// 测试文件位置
	roots: ['<rootDir>/src', '<rootDir>/tests'],

	// 匹配测试文件
	testMatch: [
		'**/__tests__/**/*.ts',
		'**/?(*.)+(spec|test).ts',
	],

	// TypeScript 转换配置
	transform: {
		'^.+\\.ts$': ['ts-jest', {
			tsconfig: {
				// 测试环境配置
				esModuleInterop: true,
				allowSyntheticDefaultImports: true,
				resolveJsonModule: true,
			},
		}],
	},

	// Mock 外部依赖
	moduleNameMapper: {
		// Mock Claude Agent SDK (ESM 模块)
		'^@anthropic-ai/claude-agent-sdk$': '<rootDir>/tests/mocks/claude-sdk.ts',
		// 路径别名
		'^@/(.*)$': '<rootDir>/src/$1',
	},

	// 覆盖率收集
	collectCoverageFrom: [
		'src/**/*.ts',
		'!src/**/*.d.ts',
		'!src/main.ts', // 入口文件（集成测试）
	],

	// 覆盖率阈值（强制质量）
	coverageThreshold: {
		global: {
			branches: 60,
			functions: 60,
			lines: 60,
			statements: 60,
		},
	},

	// 覆盖率报告格式
	coverageReporters: ['text', 'lcov', 'html'],

	// 忽略的文件
	testPathIgnorePatterns: [
		'/node_modules/',
		'/dist/',
		'/.obsidian/',
	],

	// 测试超时（ACP 可能需要较长时间）
	testTimeout: 10000,

	// 详细输出
	verbose: true,
};
