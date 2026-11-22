#!/usr/bin/env node
// Minimal static server for a built site, close to how the real hosts serve it:
//   /x/ -> <root>/x/index.html, 404 -> <root>/404.html, gzip for text types,
//   _redirects honoured at base "/" (Cloudflare/Netlify); ignored under a base path (GitHub Pages).
// CLI: node tests/static-server.mjs [root=dist] [port=4321] [base=/]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain', '.xml': 'application/xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const normBase = (b) => ('/' + String(b || '').replace(/^\/+|\/+$/g, '') + '/').replace(/\/+/g, '/');

export function serve(port = 4321, root = 'dist', base = '/') {
  const ROOT = path.resolve(root);
  const BASE = normBase(base);
  const redirects = new Map();
  if (BASE === '/') try { for (const l of fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8').split('\n')) { const m = l.trim().match(/^(\S+)\s+(\S+)\s+(\d+)$/); if (m && !l.startsWith('#')) redirects.set(m[1], [m[2], +m[3]]); } } catch { /* none */ }
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
    const type = TYPES[path.extname(p)] || 'application/octet-stream';
    // Compress text like Cloudflare/GitHub Pages do, so Lighthouse sees realistic transfer sizes.
    if (/text|javascript|json|xml|svg|manifest/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      res.writeHead(200, { 'Content-Type': type, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
      return fs.createReadStream(p).pipe(zlib.createGzip()).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((ok) => srv.listen(port, () => ok(srv)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [root = 'dist', port = process.env.PORT || '4321', base = '/'] = process.argv.slice(2);
  serve(+port, root, base).then(() => console.log(`serving ${root} on http://localhost:${port}${normBase(base)}`));
}
