import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'dist/bundle.cjs',
  external: [],
  minify: true,
  sourcemap: false,
});

console.log('Bundle created: dist/bundle.cjs');
