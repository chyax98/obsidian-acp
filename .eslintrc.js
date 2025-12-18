/**
 * ESLint 配置 - 严格模式
 *
 * 规则级别：
 * - error: 错误，阻止构建
 * - warn: 警告，但不阻止
 * - off: 关闭
 */

module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	env: {
		node: true,
		es2021: true,
	},
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module',
		project: './tsconfig.json',
	},
	plugins: ['@typescript-eslint'],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:@typescript-eslint/recommended-requiring-type-checking',
	],
	rules: {
		// ========================================
		// TypeScript 严格规则
		// ========================================

		// 禁止 any 类型（警告）
		'@typescript-eslint/no-explicit-any': 'warn',

		// 禁止非 null 断言（警告）
		'@typescript-eslint/no-non-null-assertion': 'warn',

		// 禁止未使用的变量（警告）
		'@typescript-eslint/no-unused-vars': ['warn', {
			argsIgnorePattern: '^_',
			varsIgnorePattern: '^_',
		}],

		// 要求明确的函数返回类型（警告）
		'@typescript-eslint/explicit-function-return-type': ['warn', {
			allowExpressions: true,
			allowTypedFunctionExpressions: true,
		}],

		// 要求明确的成员可见性（警告而非错误）
		'@typescript-eslint/explicit-member-accessibility': ['warn', {
			accessibility: 'explicit',
			overrides: {
				constructors: 'no-public',
			},
		}],

		// 禁止 require()
		'@typescript-eslint/no-var-requires': 'error',

		// 禁止浮动的 Promise（警告）
		'@typescript-eslint/no-floating-promises': 'warn',

		// 禁止误用 Promise（警告）
		'@typescript-eslint/no-misused-promises': 'warn',

		// 需要 await 在 async 函数中
		'@typescript-eslint/require-await': 'warn',

		// 模板表达式类型安全（警告）
		'@typescript-eslint/restrict-template-expressions': 'warn',

		// 禁止对象转字符串（警告）
		'@typescript-eslint/no-base-to-string': 'warn',

		// 禁止不安全的赋值（警告）
		'@typescript-eslint/no-unsafe-assignment': 'warn',

		// 禁止不必要的类型断言（警告）
		'@typescript-eslint/no-unnecessary-type-assertion': 'warn',

		// 不安全操作（警告）
		'@typescript-eslint/no-unsafe-member-access': 'warn',
		'@typescript-eslint/no-unsafe-argument': 'warn',
		'@typescript-eslint/no-unsafe-call': 'warn',
		'@typescript-eslint/no-unsafe-return': 'warn',

		// 统一类型导入
		'@typescript-eslint/consistent-type-imports': ['error', {
			prefer: 'type-imports',
		}],

		// 命名约定
		'@typescript-eslint/naming-convention': [
			'error',
			{
				selector: 'interface',
				format: ['PascalCase'],
				custom: {
					regex: '^I[A-Z]',
					match: false, // 不要 I 前缀
				},
			},
			{
				selector: 'class',
				format: ['PascalCase'],
			},
			{
				selector: 'typeAlias',
				format: ['PascalCase'],
			},
			{
				selector: 'enum',
				format: ['PascalCase'],
			},
			{
				selector: 'variable',
				format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
				leadingUnderscore: 'allow',
			},
		],

		// ========================================
		// 代码质量规则
		// ========================================

		// 禁止 console（允许 warn/error）
		'no-console': ['warn', {
			allow: ['warn', 'error', 'info'],
		}],

		// 禁止 debugger
		'no-debugger': 'error',

		// 禁止 alert
		'no-alert': 'error',

		// 要求使用 === 和 !==
		'eqeqeq': ['error', 'always'],

		// 禁止不必要的 boolean 转换
		'no-extra-boolean-cast': 'error',

		// 禁止不必要的分号
		'no-extra-semi': 'error',

		// 禁止函数声明和表达式不一致
		'func-style': ['error', 'declaration', {
			allowArrowFunctions: true,
		}],

		// 复杂度限制
		'complexity': ['warn', 15],

		// 最大嵌套深度
		'max-depth': ['warn', 4],

		// 最大函数长度
		'max-lines-per-function': ['warn', {
			max: 150,
			skipBlankLines: true,
			skipComments: true,
		}],

		// 最大文件行数
		'max-lines': ['warn', {
			max: 500,
			skipBlankLines: true,
			skipComments: true,
		}],

		// ========================================
		// 代码风格规则
		// ========================================

		// 缩进 (tab)
		'indent': ['error', 'tab', {
			SwitchCase: 1,
		}],

		// 引号
		'quotes': ['error', 'single', {
			avoidEscape: true,
		}],

		// 分号
		'semi': ['error', 'always'],

		// 逗号风格
		'comma-dangle': ['error', 'always-multiline'],

		// 箭头函数空格
		'arrow-spacing': 'error',

		// 对象花括号空格
		'object-curly-spacing': ['error', 'always'],

		// 数组括号空格
		'array-bracket-spacing': ['error', 'never'],

		// 关键字空格
		'keyword-spacing': 'error',

		// 块级作用域空格
		'space-before-blocks': 'error',

		// 函数括号前空格
		'space-before-function-paren': ['error', {
			anonymous: 'never',
			named: 'never',
			asyncArrow: 'always',
		}],
	},
	ignorePatterns: [
		'node_modules/',
		'dist/',
		'*.js', // 忽略配置文件
		'coverage/',
		'.obsidian/',
	],
	overrides: [
		{
			// 测试文件放宽规则
			files: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
			rules: {
				'@typescript-eslint/no-explicit-any': 'off',
				'max-lines-per-function': 'off',
			},
		},
	],
};
