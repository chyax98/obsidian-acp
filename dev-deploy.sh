🔨 构建插件...

> obsidian-acp@0.2.0 build
> npm run lint && npm run type-check && node esbuild.config.mjs production


> obsidian-acp@0.2.0 lint
> eslint src --ext .ts

=============

WARNING: You are currently running a version of TypeScript which is not officially 
WARNING: You are currently running a version of TypeScript which is not officially supported by @typescript-eslint/typescript-estree.

You may find that it works just fine, or you may not.

SUPPORTED TYPESCRIPT VERSIONS: >=4.3.5 <5.4.0

YOUR TYPESCRIPT VERSION: 5.9.3

Please only submit bug reports when using the officially supported version.

=============

> obsidian-acp@0.2.0 type-check
> tsc --noEmit


📦 复制到插件目录...
main.js -> /Users/chyax/note-vsc/.obsidian/plugins/obsidian-acp/main.js
manifest.json -> /Users/chyax/note-vsc/.obsidian/plugins/obsidian-acp/manifest.json
styles.css -> /Users/chyax/note-vsc/.obsidian/plugins/obsidian-acp/styles.css

✅ 完成！请在 Obsidian 中重新加载插件
