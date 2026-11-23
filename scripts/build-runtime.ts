#!/usr/bin/env tsx
/**
 * Per-page runtimes (Phase 3).
 *
 * src/generated/atlas-runtime.js is the whole Atlas runtime. Each page only needs the part
 * that can run there. For every page this script removes, from that runtime, code that the
 * original would skip on that page, then tree-shakes what nothing uses any more:
 *
 *  1. page-guarded code for pages not in this document: top-level statements wrapped in
 *     `if(document.getElementById('x')){…}` and IIFEs whose first statement is
 *     `if(!$('x'))return` (at any nesting depth), when element #x belongs to an absent page.
 *     These would have done nothing on this page.
 *  2. diagram definitions (`DEFS.key = …`) whose key no remaining code or data-flow host uses
 *  3. per-page formula entries (`FM['page-id']`) for absent pages
 *  3b. the release log (`CHANGES`) on every page but /changes/
 *  4. top-level declarations that nothing references any more, when their initializer has
 *     no side effects (literals, functions, object/array data, N()/E() node builders)
 *
 * Order of the remaining statements is unchanged, so behaviour is the same as the full
 * runtime; tests/e2e/parity.spec.ts checks that on every page.
 *
 * The infographic studio is split out as a lazy chunk (infographic.js), loaded by the
 * Infographic button on pages other than /playground/.
 *
 * Output: src/generated/runtime/<page>.js, src/generated/runtime/infographic.js,
 *         src/generated/runtime/report.json
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { transform } from 'esbuild';
import { parse as parseHTML } from 'node-html-parser';

const ROOT = process.cwd();
const RUNTIME = fs.readFileSync(path.join(ROOT, 'src/generated/atlas-runtime.js'), 'utf8');
let CUR = RUNTIME; // code being analysed in the current pass
const RUNTIME_SLICE = (n: any) => CUR.slice(n.start, n.end);
const PAGES: Array<{ id: string }> = JSON.parse(fs.readFileSync('src/data/pages.json', 'utf8'));
const COMP = JSON.parse(fs.readFileSync('src/data/companions.json', 'utf8'));
const OUT = 'src/generated/runtime';
const LAZY_IG = 'igStudio';

/* ---------- which element ids and flows live on which page ---------- */
const idOwner = new Map<string, string>();
const flowKeys = new Map<string, Set<string>>();
for (const p of PAGES) {
  const html = fs.readFileSync(`src/content/pages/${p.id}.html`, 'utf8');
  const doc = parseHTML(html);
  idOwner.set(p.id, p.id);
  doc.querySelectorAll('[id]').forEach((e) => { if (!idOwner.has(e.id)) idOwner.set(e.id, p.id); });
  flowKeys.set(p.id, new Set(doc.querySelectorAll('[data-flow]').map((e) => e.getAttribute('data-flow')!)));
}
function presentPages(id: string): Set<string> {
  const s = new Set([id]);
  for (const ref of COMP.pages[id] || []) (ref.startsWith('@') ? COMP.groups[ref.slice(1)] : [ref]).forEach((x: string) => s.add(x));
  return s;
}

/* ---------- helpers ---------- */
type Node = any;
const parse = (code: string) => acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', locations: false }) as Node;
const iifeBody = (st: Node): Node[] | null => {
  if (st.type !== 'ExpressionStatement') return null;
  let e = st.expression; if (e.type === 'UnaryExpression') e = e.argument;
  if (e.type === 'CallExpression' && /Function/.test(e.callee.type) && e.callee.body.type === 'BlockStatement') return e.callee.body.body;
  return null;
};
/** `document.getElementById('x')` or `$('x')` → 'x' */
const domRead = (code: string, n: Node): string | null => {
  if (!n || n.type !== 'CallExpression' || n.arguments.length !== 1 || n.arguments[0].type !== 'Literal') return null;
  const c = code.slice(n.callee.start, n.callee.end);
  return c === '$' || c === 'document.getElementById' ? String(n.arguments[0].value) : null;
};
/**
 * Element id that a function body returns early without, or null: the body starts with
 * side-effect-free declarations (which may read the DOM) and then `if(!X||…)return …;`
 * where X is `$('x')`, `document.getElementById('x')` or a variable holding one of those.
 */
function earlyReturnGuard(code: string, body: Node[]): { id: string; index: number; ret: Node | null } | null {
  const vars = new Map<string, string>();
  let i = 0;
  for (; i < 6 && body[i] && body[i].type === 'VariableDeclaration'; i++) {
    for (const d of body[i].declarations) {
      if (!isPure(d.init, true)) return null;
      const id = domRead(code, d.init);
      if (id && d.id.type === 'Identifier') vars.set(d.id.name, id);
    }
  }
  const f = body[i];
  if (!f || f.type !== 'IfStatement' || f.alternate) return null;
  const ret = f.consequent.type === 'ReturnStatement' ? f.consequent : f.consequent.type === 'BlockStatement' && f.consequent.body.length === 1 && f.consequent.body[0].type === 'ReturnStatement' ? f.consequent.body[0] : null;
  if (!ret) return null;
  // leftmost operand of a chain of ||
  let t = f.test;
  while (t.type === 'LogicalExpression' && t.operator === '||') t = t.left;
  if (t.type !== 'UnaryExpression' || t.operator !== '!') return null;
  const a = t.argument;
  const id = a.type === 'Identifier' ? vars.get(a.name) : domRead(code, a);
  return id ? { id, index: i, ret: ret.argument } : null;
}
/** Element id a statement is guarded by, or null. */
function guardOf(code: string, st: Node): string | null {
  if (st.type === 'IfStatement' && !st.alternate) {
    const m = code.slice(st.test.start, st.test.end).match(/^document\.getElementById\("([\w-]+)"\)$/);
    if (m) return m[1];
  }
  const body = iifeBody(st);
  if (body) { const g = earlyReturnGuard(code, body); if (g && g.ret === null) return g.id; }
  return null;
}
// Diagram builders with no side effects: N() and E() build node and edge objects, and Q() is a
// one-line wrapper around N(). Q only counts while the runtime still defines it exactly so.
const Q_IS_PURE = RUNTIME.includes("const Q=(id,x,y,t,s,c,d,w=150,h=52)=>N(id,x,y,w,h,t,s,c||'purple',d);");
const PURE_CALLEES = new Set(Q_IS_PURE ? ['N', 'E', 'Q'] : ['N', 'E']);
function isPure(n: Node, domReads = false): boolean {
  if (!n) return true;
  if (domReads && n.type === 'CallExpression' && n.arguments.length === 1 && n.arguments[0].type === 'Literal' && /^(\$|document\.(getElementById|querySelector))$/.test(RUNTIME_SLICE(n.callee))) return true;
  switch (n.type) {
    case 'Literal': case 'Identifier': case 'ThisExpression': case 'ArrowFunctionExpression': case 'FunctionExpression': case 'ClassExpression': return true;
    case 'TemplateLiteral': return n.expressions.every(isPure);
    case 'ArrayExpression': return n.elements.every((e: Node) => !e || isPure(e.type === 'SpreadElement' ? e.argument : e));
    case 'ObjectExpression': return n.properties.every((p: Node) => p.type === 'SpreadElement' ? isPure(p.argument) : (!p.computed || isPure(p.key)) && isPure(p.value));
    case 'UnaryExpression': return n.operator !== 'delete' && isPure(n.argument);
    case 'BinaryExpression': case 'LogicalExpression': return isPure(n.left) && isPure(n.right);
    case 'ConditionalExpression': return isPure(n.test) && isPure(n.consequent) && isPure(n.alternate);
    case 'MemberExpression': return isPure(n.object) && (!n.computed || isPure(n.property));
    case 'CallExpression': {
      const c = n.callee;
      if (c.type === 'Identifier' && PURE_CALLEES.has(c.name)) return n.arguments.every(isPure);
      // Object.assign(<fresh object or N()/E() call>, <pure>…)
      if (c.type === 'MemberExpression' && c.object.name === 'Object' && c.property.name === 'assign' && n.arguments[0] && ['ObjectExpression', 'CallExpression'].includes(n.arguments[0].type)) return n.arguments.every(isPure);
      return false;
    }
    default: return false;
  }
}

type Cut = { start: number; end: number; text?: string };
function apply(code: string, cuts: Cut[]): string {
  cuts.sort((a, b) => a.start - b.start);
  let out = '', pos = 0;
  for (const c of cuts) { if (c.start < pos) continue; out += code.slice(pos, c.start) + (c.text ?? ''); pos = c.end; }
  return out + code.slice(pos);
}

/* ---------- one pruning pass ---------- */
function pass(code: string, present: Set<string>, keepIg: boolean, stats: Record<string, number>, page: string): string {
  CUR = code;
  const ast = parse(code);
  const cuts: Cut[] = [];
  const absent = (id: string) => (id === LAZY_IG ? !keepIg : idOwner.has(id) && !present.has(idOwner.get(id)!));

  // 1. guarded statements, at any depth inside IIFEs
  const visit = (list: Node[]) => {
    for (const st of list) {
      const g = guardOf(code, st);
      if (g && absent(g)) { cuts.push({ start: st.start, end: st.end, text: ';' }); stats.guarded = (stats.guarded || 0) + 1; continue; }
      const b = iifeBody(st); if (b) visit(b);
      if (st.type === 'VariableDeclaration') st.declarations.forEach((d: Node) => {
        const fn = d.init && d.init.type === 'CallExpression' && d.init.arguments.length === 0 && /Function/.test(d.init.callee.type) ? d.init.callee : null;
        if (!fn || fn.body.type !== 'BlockStatement') return;
        // const X=(()=>{if(!$('x'))return {stub};…})() → const X={stub} when #x is absent
        const g = earlyReturnGuard(code, fn.body.body);
        if (g && absent(g.id) && g.ret && isPure(g.ret) && !fn.async && !fn.generator) { cuts.push({ start: d.init.start, end: d.init.end, text: '(' + code.slice(g.ret.start, g.ret.end) + ')' }); stats.stubbed = (stats.stubbed || 0) + 1; return; }
        visit(fn.body.body);
      });
    }
  };
  visit(ast.body);

  // 5a. current-page tests: ATLAS.page==='x', ATLAS.hash()==='#x' (x a page id other than this one)
  const PAGE_IDS = new Set(PAGES.map((p) => p.id));
  walk.simple(ast, {
    BinaryExpression(n: Node) {
      if (!['===', '!=='].includes(n.operator) || n.right.type !== 'Literal' || typeof n.right.value !== 'string') return;
      const l = code.slice(n.left.start, n.left.end);
      let id: string | null = null;
      if (l === 'ATLAS.page') id = n.right.value;
      else if (l === 'ATLAS.hash()' && n.right.value.startsWith('#')) id = n.right.value.slice(1);
      if (!id || !PAGE_IDS.has(id)) return;
      if (l === 'ATLAS.hash()' && id === page) return; // could also be a merged/custom id view: leave
      const eq = id === page;
      cuts.push({ start: n.start, end: n.end, text: String(n.operator === '===' ? eq : !eq) });
      stats.folded = (stats.folded || 0) + 1;
    },
    IfStatement(n: Node) {
      const t = code.slice(n.test.start, n.test.end);
      if (t === 'false' || /^false&&/.test(t)) { cuts.push({ start: n.start, end: n.end, text: n.alternate ? code.slice(n.alternate.start, n.alternate.end) : ';' }); stats.dce = (stats.dce || 0) + 1; }
    },
  });
  // 5b. INIT FLOWS: `if(k==='roles')def=…` branches for flows not on this page
  {
    const presentFlows = new Set<string>(); for (const p of present) flowKeys.get(p)?.forEach((k) => presentFlows.add(k));
    walk.simple(ast, {
      CallExpression(n: Node) {
        if (code.slice(n.callee.start, n.callee.end) !== "document.querySelectorAll('[data-flow]').forEach") return;
        const fn = n.arguments[0]; if (!fn || fn.body.type !== 'BlockStatement') return;
        for (const st of fn.body.body) {
          if (st.type !== 'IfStatement' || st.alternate) continue;
          const m = code.slice(st.test.start, st.test.end).match(/^k==='([\w-]+)'$/);
          if (m && !presentFlows.has(m[1])) { cuts.push({ start: st.start, end: st.end, text: ';' }); stats.flowBranches = (stats.flowBranches || 0) + 1; }
        }
      },
    });
  }

  // 2. DEFS keys
  const need = new Set<string>();
  for (const p of present) flowKeys.get(p)?.forEach((k) => need.add(k));
  const prefixes = new Set<string>();
  const defsAssign = new Set<Node>();
  walk.ancestor(ast, {
    MemberExpression(n: Node, _s: unknown, anc: Node[]) {
      if (n.object.type !== 'Identifier' || n.object.name !== 'DEFS') return;
      const parent = anc[anc.length - 2];
      const isTopAssign = parent && parent.type === 'AssignmentExpression' && parent.left === n && anc.length === 4 && anc[1].type === 'ExpressionStatement';
      if (isTopAssign && !n.computed) { defsAssign.add(anc[1]); return; }
      if (parent && parent.type === 'AssignmentExpression' && parent.left === n) return; // DEFS['ind_'+k] = … (handled below)
      if (!n.computed) need.add(n.property.name);
      else if (n.property.type === 'Literal') need.add(String(n.property.value));
      else if (n.property.type === 'BinaryExpression' && n.property.left.type === 'Literal') prefixes.add(String(n.property.left.value));
      // INIT FLOWS: `const k=h.dataset.flow;let def=DEFS[k]` reads the keys of data-flow hosts, already in `need`
      else if (n.property.type === 'Identifier' && /h\.dataset\.flow;let def=DEFS\[k\]$/.test(code.slice(n.start - 40, n.end))) { /* covered */ }
      else need.add('*');
    },
  });
  const needed = (k: string) => need.has('*') || need.has(k) || [...prefixes].some((p) => k.startsWith(p));
  for (const st of defsAssign) {
    const key = st.expression.left.property.name;
    if (!needed(key)) { cuts.push({ start: st.start, end: st.end }); stats.defs = (stats.defs || 0) + 1; }
  }
  // loops that fill DEFS['prefix'+…]: drop when nothing reads that prefix
  for (const st of ast.body) {
    if (st.type !== 'ExpressionStatement' || defsAssign.has(st)) continue;
    const src = code.slice(st.start, st.end);
    const m = src.match(/DEFS\['([\w-]+)'\+[^\]]+\]\s*=/);
    if (m && !needed(m[1] + '\u0000') && ![...prefixes].includes(m[1]) && ![...need].some((k) => k.startsWith(m[1]))) { cuts.push({ start: st.start, end: st.end }); stats.defsLoops = (stats.defsLoops || 0) + 1; }
  }

  // 3. FM entries for absent pages (const FM = {...} anywhere)
  walk.simple(ast, {
    VariableDeclarator(d: Node) {
      if (d.id.type !== 'Identifier' || d.id.name !== 'FM' || !d.init || d.init.type !== 'ObjectExpression') return;
      const props = d.init.properties;
      const keep = props.filter((p: Node) => { const k = p.key && (p.key.name ?? p.key.value); return !(typeof k === 'string' && idOwner.has(k) && absent(k)); });
      if (keep.length !== props.length) { cuts.push({ start: d.init.start, end: d.init.end, text: '{' + keep.map((p: Node) => code.slice(p.start, p.end)).join(',') + '}' }); stats.fm = (stats.fm || 0) + props.length - keep.length; }
    },
  });

  // 3b. the release log (`const CHANGES = [...]`) is only rendered into #chLog on the changes
  //     page; elsewhere the array is never read, so it ships empty.
  if (!present.has('changes')) {
    walk.simple(ast, {
      VariableDeclarator(d: Node) {
        if (d.id.type !== 'Identifier' || d.id.name !== 'CHANGES' || !d.init || d.init.type !== 'ArrayExpression' || !d.init.elements.length) return;
        cuts.push({ start: d.init.start, end: d.init.end, text: '[]' });
        stats.changelog = 1;
      },
    });
  }

  // 4. tree-shake declarations nobody references: at top level, and inside IIFE bodies
  //    (closure-local names can only be referenced from inside the closure)
  const cutSet = new Set(cuts.map((c) => c.start));
  const shake = (list: Node[], scope: Node) => {
    const decls = new Map<string, Node>();
    for (const st of list) {
      if (st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration') decls.set(st.id.name, st);
      else if (st.type === 'VariableDeclaration' && st.declarations.length === 1 && st.declarations[0].id.type === 'Identifier') decls.set(st.declarations[0].id.name, st);
    }
    if (!decls.size) return;
    const refs = new Map<string, number>();
    walk.fullAncestor(scope, (n: Node, _s: unknown, anc: Node[]) => {
      if (n.type !== 'Identifier' || !decls.has(n.name)) return;
      const p = anc[anc.length - 2];
      if (p && (p.type === 'MemberExpression' && p.property === n && !p.computed)) return;
      if (p && p.type === 'Property' && p.key === n && !p.computed && !p.shorthand) return;
      if (p && (p.type === 'MethodDefinition' || p.type === 'PropertyDefinition') && p.key === n) return;
      const d = decls.get(n.name)!;
      if ((d.type !== 'VariableDeclaration' && d.id === n) || (d.type === 'VariableDeclaration' && d.declarations[0].id === n)) return;
      // references inside code already cut this pass don't count
      if (cuts.some((c) => n.start >= c.start && n.end <= c.end && c.text !== undefined && !c.text.includes(n.name))) return;
      refs.set(n.name, (refs.get(n.name) || 0) + 1);
    });
    for (const [name, st] of decls) {
      if (refs.get(name) || cutSet.has(st.start) || cuts.some((c) => st.start >= c.start && st.end <= c.end)) continue;
      const pure = st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration' || isPure(st.declarations[0].init, true);
      if (pure) { cuts.push({ start: st.start, end: st.end, text: '' }); stats.shaken = (stats.shaken || 0) + 1; }
    }
  };
  shake(ast.body, ast);
  const shakeIifes = (list: Node[]) => { for (const st of list) { const b = iifeBody(st); if (b) { shake(b, st); shakeIifes(b); } } };
  shakeIifes(ast.body);
  return cuts.length ? apply(code, cuts) : code;
}

function prune(page: string, present: Set<string>, keepIg: boolean) {
  let code = RUNTIME;
  const stats: Record<string, number> = {};
  for (let i = 0; i < 20; i++) { const next = pass(code, present, keepIg, stats, page); if (next === code) break; code = next; }
  return { code, stats };
}

/* ---------- infographic studio as a lazy chunk ---------- */
function infographicChunk() {
  const ast = parse(RUNTIME);
  const st = ast.body.find((s: Node) => guardOf(RUNTIME, s) === LAZY_IG);
  if (!st) throw new Error('infographic studio IIFE not found');
  const pg = fs.readFileSync('src/content/pages/playground.html', 'utf8');
  const el = parseHTML(pg).querySelector('#' + LAZY_IG)!;
  const markup = pg.slice(el.range[0], el.range[1]);
  return `/* Infographic studio, loaded on demand outside /playground/ (scripts/build-runtime.ts). */\n` +
    `(function(){var c=document.getElementById('atlas-companions');if(c&&!document.getElementById('${LAZY_IG}')){var d=document.createElement('div');d.setAttribute('data-companion','playground');d.innerHTML=${JSON.stringify(markup)};c.appendChild(d);}})();\n` +
    RUNTIME.slice(st.start, st.end) + ';';
}

/* ---------- build ---------- */
// Keep identifiers intact: the diagram exporter serializes Flow/sv/esc/… via toString().
const minify = process.env.NO_MINIFY ? async (c: string) => c : async (code: string) => (await transform(code, { minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: false, legalComments: 'none', target: 'es2020' })).code;
const gz = (s: string) => zlib.gzipSync(s, { level: 9 }).length;
// Containers listed in data-keep are empty in the original and filled a moment later by a timer
// (e.g. the path cards on /): they keep their snapshot content until the runtime redraws them,
// so nothing below them jumps. scripts/snapshot.mjs verifies each page's final state either way.
const RESTORE = "(function(){var t=document.getElementById('atlas-src'),s=document.querySelector('main>section');if(!t||!s)return;var keep={};(t.dataset.keep||'').split(' ').forEach(function(id){var e=id&&document.getElementById(id);if(e&&s.contains(e))keep[id]=[].slice.call(e.childNodes);});s.replaceChildren(t.content.cloneNode(true));t.remove();Object.keys(keep).forEach(function(id){var e=document.getElementById(id);if(e&&!e.firstChild)e.append.apply(e,keep[id]);});})();\n";

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const report: Record<string, unknown> = {};
const ig = await minify(infographicChunk());
fs.writeFileSync(path.join(OUT, 'infographic.js'), ig);
report.infographic = { raw: ig.length, gzip: gz(ig) };
const full = await minify(RUNTIME);
report.full = { raw: full.length, gzip: gz(full) };
for (const p of PAGES) {
  const { code, stats } = prune(p.id, presentPages(p.id), p.id === 'playground');
  // First statement: swap the build-time snapshot (scripts/snapshot.mjs) back to the original markup.
  const min = RESTORE + await minify(code);
  acorn.parse(min, { ecmaVersion: 'latest', sourceType: 'script' });
  fs.writeFileSync(path.join(OUT, `${p.id}.js`), min);
  report[p.id] = { raw: min.length, gzip: gz(min), ...stats };
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
const sizes = PAGES.map((p) => (report[p.id] as any).gzip);
console.log(`per-page runtimes: gzip min ${(Math.min(...sizes) / 1024).toFixed(0)} KB, median ${(sizes.sort((a, b) => a - b)[sizes.length >> 1] / 1024).toFixed(0)} KB, max ${(Math.max(...sizes) / 1024).toFixed(0)} KB (full runtime minified: ${((report.full as any).gzip / 1024).toFixed(0)} KB; infographic chunk ${((report.infographic as any).gzip / 1024).toFixed(0)} KB)`);
