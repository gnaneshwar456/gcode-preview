const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: true,
};

const webviewConfig = {
  entryPoints: ['src/webview/main.ts'],
  bundle: true,
  outfile: 'dist/webview.js',
  format: 'iife',
  platform: 'browser',
  sourcemap: true,
};

async function build() {
  if (watch) {
    let extCtx = await esbuild.context(extensionConfig);
    let webCtx = await esbuild.context(webviewConfig);
    await extCtx.watch();
    await webCtx.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build(extensionConfig);
    await esbuild.build(webviewConfig);
    console.log('Build complete.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
