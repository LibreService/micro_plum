import { build } from 'esbuild'

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  target: 'es2020',
  format: 'esm',
  platform: 'node',
  sourcemap: true,
  external: ['js-yaml', 'luaparse']
})
