#!/usr/bin/env tsx
// Bundles the classic scripts that must run before the classic Atlas runtime:
//   src/generated/boot.js      boot + platform shim (shipped on every page)
//   src/generated/platform.js  platform shim alone (injected into the original file by tests)
// PUBLIC_* settings come from the environment or .env files, like Astro's.
import { build } from 'esbuild';
import { loadEnv } from 'vite';

const env = { ...loadEnv(process.env.NODE_ENV === 'development' ? 'development' : 'production', process.cwd(), 'PUBLIC_'), ...process.env };
const AI = String(env.PUBLIC_AI_ENABLED || '').toLowerCase() === 'true';
const define = {
  __AI_ENABLED__: JSON.stringify(AI),
  __AI_ENDPOINT__: JSON.stringify(env.PUBLIC_AI_ENDPOINT || '/api/claude'),
  __TURNSTILE_SITE_KEY__: JSON.stringify(AI ? env.PUBLIC_TURNSTILE_SITE_KEY || '' : ''),
};
const common = { bundle: true, format: 'iife' as const, target: 'es2020', minify: true, legalComments: 'none' as const, define };
await build({ ...common, entryPoints: ['src/scripts/boot.ts'], outfile: 'src/generated/boot.js' });
await build({ ...common, entryPoints: ['src/scripts/platform.ts'], outfile: 'src/generated/platform.js' });
console.log(`built boot.js + platform.js (AI features ${AI ? 'ON' : 'off'})`);
