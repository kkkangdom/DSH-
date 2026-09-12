/**
 * Build both halves of the dsh-skills-sh plugin:
 * - lib/index.js  — node half (ESM, for the host loader)
 * - lib/client.js — browser half (CJS closure factory for __ModuleLoader__)
 */
import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { build } from 'esbuild'
import { transform } from 'lightningcss'

const PKG_ID = 'dsh-skills-sh'

const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
]

const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

const cssModulesPlugin = {
  name: 'dsh-css-modules-inline',
  setup(buildApi) {
    buildApi.onResolve({ filter: /\.module\.css$/ }, (args) => ({
      path: CSS_VIRTUAL_PREFIX + args.path + CSS_VIRTUAL_SUFFIX,
      namespace: 'dsh-css',
      pluginData: { resolveDir: args.resolveDir },
    }))
    buildApi.onLoad({ filter: /.*/, namespace: 'dsh-css' }, async (args) => {
      const file = args.path.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      const abs = resolve(args.pluginData.resolveDir, file)
      const source = await readFile(abs)
      const { code, exports: cssExports } = transform({
        filename: abs,
        code: source,
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap = {}
      for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
      const tagId = `${PKG_ID}/${basename(abs)}`
      const contents = [
        `const css = ${JSON.stringify(code.toString())};`,
        `const tagId = ${JSON.stringify(tagId)};`,
        `if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + tagId + '"]') === null) {`,
        '  const tag = document.createElement(\'style\');',
        `  tag.dataset.plugin = ${JSON.stringify(PKG_ID)};`,
        '  tag.dataset.pluginCss = tagId;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
        `export default ${JSON.stringify(classMap)};`,
      ].join('\n')
      return { contents, loader: 'js' }
    })
  },
}

const nodeEnv = process.env.NODE_ENV ?? 'production'

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  packages: 'external',
  sourcemap: true,
  define: { 'process.env.NODE_ENV': JSON.stringify(nodeEnv) },
})

await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'lib/client.js',
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  jsx: 'automatic',
  sourcemap: true,
  external: PLATFORM_MODULES,
  define: {
    'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    'import.meta.env.MODE': JSON.stringify(nodeEnv),
    'import.meta.env': JSON.stringify({ MODE: nodeEnv }),
  },
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PKG_ID)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;`,
  },
  footer: { js: 'return module.exports; } });' },
  plugins: [cssModulesPlugin],
})

console.log('built lib/index.js and lib/client.js')
