// Bundles src/extension.ts into a single dist/extension.js. One file means a
// fast activation and no node_modules shipped in the .vsix.
//   node esbuild.js               dev build (sourcemaps)
//   node esbuild.js --watch       rebuild on change
//   node esbuild.js --production  minified, no sourcemaps (vscode:prepublish)
const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    outfile: 'dist/extension.js',
    // The vscode module is provided by the host at runtime, never bundled.
    external: ['vscode'],
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    logLevel: 'info',
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
