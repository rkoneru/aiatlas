#!/usr/bin/env tsx
// Bundles src/scripts/boot.ts into a classic script (it must run before the classic runtime).
import { build } from 'esbuild';
await build({
  entryPoints: ['src/scripts/boot.ts'],
  outfile: 'src/generated/boot.js',
  bundle: true, format: 'iife', target: 'es2020', minify: true, legalComments: 'none',
});
console.log('built src/generated/boot.js');
