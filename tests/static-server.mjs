#!/usr/bin/env node
// Minimal static server for dist/ that behaves like Cloudflare Pages for our purposes:
// /x/ -> dist/x/index.html, 404 -> dist/404.html, _redirects honoured for /old/ paths.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(process.argv[2] || 'dist');
const PORT = +(process.argv[3] || process.env.PORT || 4321);
// Optional base path, e.g. /aiatlas/ for a GitHub Pages project site; '_redirects' is ignored then (GitHub Pages has none).
const BASE = ('/' + (process.argv[4] || '').replace(/^\/+|\/+$/g, '') + '/').replace(/\/+/g, '/');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain', '.xml': 'application/xml', '.ico': 'image/x-icon' };
const redirects = new Map();
if (BASE === '/') try { for (const l of fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split('\n')) { const m = l.trim().match(/^(\S+)\s+(\S+)\s+(\d+)$/); if (m && !l.startsWith('#')) redirects.set(m[1], [m[2], +m[3]]); } } catch {}
export function serve(port = PORT) {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (BASE !== '/') {
      if (!u.pathname.startsWith(BASE)) { if (u.pathname + '/' === BASE) { res.writeHead(301, { Location: BASE }); return res.end(); } res.writeHead(404); return res.end('Not found'); }
      u.pathname = '/' + u.pathname.slice(BASE.length);
    }
    const r = redirects.get(u.pathname);
    if (r) { res.writeHead(r[1], { Location: r[0] }); return res.end(); }
    let p = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!fs.existsSync(p) && !path.extname(p) && fs.existsSync(p + '/index.html')) { res.writeHead(308, { Location: (BASE === '/' ? '' : BASE.slice(0, -1)) + u.pathname + '/' }); return res.end(); }
    if (!fs.existsSync(p)) { const nf = path.join(ROOT, '404.html'); res.writeHead(404, { 'Content-Type': TYPES['.html'] }); return res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((ok) => srv.listen(port, () => ok(srv)));
}
if (import.meta.url === `file://${process.argv[1]}`) serve().then(() => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
