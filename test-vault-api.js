/**
 * 在 Obsidian 开发者工具控制台运行此代码
 * 检查 getBasePath() 的实际返回值
 */

(function testGetBasePath() {
    console.log('%c=== 测试 Vault API ===', 'color: blue; font-size: 16px; font-weight: bold');

    const app = window.app;
    if (!app) {
        console.error('✗ app 对象不存在');
        return;
    }

    console.log('✓ app 对象存在');
    console.log('app.vault:', app.vault);
    console.log('app.vault.adapter:', app.vault.adapter);

    // 测试 getBasePath
    const adapter = app.vault.adapter;
    console.log('\n--- 测试 getBasePath() ---');
    console.log('adapter 类型:', adapter.constructor.name);
    console.log('有 getBasePath 方法?', 'getBasePath' in adapter);
    console.log('getBasePath 是函数?', typeof adapter.getBasePath);

    if (typeof adapter.getBasePath === 'function') {
        try {
            const basePath = adapter.getBasePath();
            console.log('✓ getBasePath() 返回:', basePath);
            console.log('  类型:', typeof basePath);
            console.log('  长度:', basePath?.length);
        } catch (error) {
            console.error('✗ getBasePath() 抛出异常:', error);
        }
    } else {
        console.warn('✗ getBasePath 不是函数');
    }

    // 测试 basePath 属性（旧方法）
    console.log('\n--- 测试 basePath 属性 ---');
    const basePath = (adapter as any).basePath;
    console.log('adapter.basePath:', basePath);
    console.log('  类型:', typeof basePath);

    // 测试 process.cwd()
    console.log('\n--- 测试 process.cwd() ---');
    try {
        const cwd = process.cwd();
        console.log('process.cwd():', cwd);
        console.log('  类型:', typeof cwd);
    } catch (error) {
        console.error('✗ process.cwd() 失败:', error);
    }

    console.log('\n%c=== 测试完成 ===', 'color: blue; font-size: 16px; font-weight: bold');
})();
