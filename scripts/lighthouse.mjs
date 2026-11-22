#!/usr/bin/env node
// Lighthouse (mobile, default throttling) on a few pages of a running server.
// Usage: node scripts/lighthouse.mjs [baseUrl] [paths...]   e.g. http://localhost:4390 / /rag/ /cx-metrics/
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const base = process.argv[2] || 'http://localhost:4390';
const paths = process.argv.slice(3).length ? process.argv.slice(3) : ['/', '/rag/', '/cx-metrics/'];
const chrome = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-'));
const rows = [];
for (const p of paths) {
  const out = path.join(dir, (p.replace(/\W+/g, '_') || 'home') + '.json');
  try { execFileSync('npx', ['lighthouse', base + p, '--quiet', '--chrome-flags=--headless=new --no-sandbox', '--only-categories=performance,accessibility,best-practices,seo', '--output=json', `--output-path=${out}`], { env: { ...process.env, CHROME_PATH: chrome }, stdio: 'ignore' }); } catch { /* lighthouse exits non-zero on some warnings */ }
  const r = JSON.parse(fs.readFileSync(out, 'utf8')); const a = r.audits, c = r.categories;
  rows.push({ page: p, perf: Math.round(c.performance.score * 100), a11y: Math.round(c.accessibility.score * 100), bp: Math.round(c['best-practices'].score * 100), seo: Math.round(c.seo.score * 100),
    FCP: a['first-contentful-paint'].displayValue, LCP: a['largest-contentful-paint'].displayValue, TBT: a['total-blocking-time'].displayValue, CLS: a['cumulative-layout-shift'].displayValue, SI: a['speed-index'].displayValue, report: out });
}
console.table(rows.map(({ report, ...r }) => r));
fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(rows, null, 1));
console.log('reports in', dir);
