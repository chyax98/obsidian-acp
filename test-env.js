// 在 Obsidian 控制台运行
console.log('=== 环境变量检查 ===');
console.log('HOME:', process.env.HOME);
console.log('PATH:', process.env.PATH?.split(':').slice(0, 5));
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '已设置' : '未设置');
console.log('which claude:', require('child_process').execSync('which claude 2>&1 || echo "未找到"', {encoding: 'utf8'}).trim());
