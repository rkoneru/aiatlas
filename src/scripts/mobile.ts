/**
 * Phone layout (viewport ≤ 640px).
 *
 * 1. Diagrams. Atlas diagrams are drawn for a 1000-unit-wide canvas, so on a phone they were
 *    either tiny or needed sideways scrolling. Here each diagram is re-laid-out top to bottom
 *    before it's drawn: the boxes keep their order and connections, only their positions
 *    change. Edges are routed by the runtime from the boxes' relative positions, so they follow.
 *    The hook is installed by the runtime itself (runtime patch `flow-hook`), right before the
 *    first diagram is drawn, so phones never see the wide layout.
 *
 * 2. Collapsed text. Sections made only of text (cards, tables, lists) fold under their h2 on
 *    phones; diagrams and interactive tools stay open. The marking itself is a tiny inline
 *    script in BaseLayout (window.__atlasMC) so it applies before first paint; this module only
 *    reopens a folded section when search, a link or find-in-page points into it.
 *
 * Desktop and tablet widths are untouched (the parity test runs at 1280px).
 */
export const NARROW = '(max-width: 640px)';

type FNode = { id: string; x: number; y: number; w: number; h: number; sh?: string; lblTop?: boolean; pt?: unknown; g?: unknown; [k: string]: unknown };
type Group = { x: number; y: number; w: number; h: number; [k: string]: unknown };
type Def = { vb: [number, number]; nodes: FNode[]; edges: unknown[]; groups?: Group[]; _sp?: unknown; [k: string]: unknown };

/** Widest canvas we aim for, in viewBox units: about 0.78 scale on a 390px-wide phone. */
const MAX_W = 460;
const PAD = 16;
const GAP_X = 18;
const GAP_Y = 58;
const MIN_NODE_W = 118;
const HUB_LABEL = 34;

const cx = (n: FNode) => n.x + n.w / 2;
const cy = (n: FNode) => n.y + n.h / 2;

/** Group nodes whose centres are close along one axis (columns or rows of the drawing). */
function clusters(nodes: FNode[], center: (n: FNode) => number, size: (n: FNode) => number): FNode[][] {
  const out: FNode[][] = [];
  for (const n of [...nodes].sort((a, b) => center(a) - center(b))) {
    const cur = out[out.length - 1];
    const last = cur && cur[cur.length - 1];
    if (last && center(n) - center(last) < Math.min(size(n), size(last)) * 0.5) cur.push(n);
    else out.push([n]);
  }
  return out;
}

const cache = new WeakMap<object, Def>();

/** A copy of `def` laid out top to bottom for a narrow screen, or `def` itself if it already fits. */
export function mobileDef(def: Def): Def {
  if (!def || !Array.isArray(def.nodes) || def.nodes.length < 2 || !Array.isArray(def.vb)) return def;
  if (def.vb[0] <= MAX_W + 40) return def;
  if (def.nodes.some((n) => n.pt)) return def; // hand-routed waypoints: keep the author's layout
  const hit = cache.get(def);
  if (hit) return hit;

  const nodes: FNode[] = def.nodes.map((n) => { const c = { ...n }; delete c.g; return c; });
  const byId = new Map(def.nodes.map((n, i) => [n, nodes[i]]));
  const cols = clusters(nodes, cx, (n) => n.w);
  const rows = clusters(nodes, cy, (n) => n.h);
  // A drawing with more columns than rows reads left to right: its columns become our rows.
  const horizontal = cols.length > rows.length;
  const layers = horizontal ? cols : rows;
  const slots = horizontal ? rows : cols;
  const across = horizontal ? cy : cx; // order inside a layer
  layers.forEach((l) => l.sort((a, b) => across(a) - across(b)));

  const placed: FNode[][] = []; // visual rows, top to bottom
  if (slots.length <= 3) {
    // Grid transpose: each slot (a row of the original, or a column) keeps its own lane.
    const slotOf = new Map<FNode, number>();
    slots.forEach((s, i) => s.forEach((n) => slotOf.set(n, i)));
    const k = slots.length;
    const lane = Math.max(MIN_NODE_W, Math.min(Math.max(...nodes.map((n) => n.w)), (MAX_W - 2 * PAD - (k - 1) * GAP_X) / k));
    for (const layer of layers) {
      const row: FNode[] = [];
      for (const n of layer) {
        const i = slotOf.get(n)!;
        n.w = Math.min(n.w, lane);
        n.x = PAD + i * (lane + GAP_X) + (lane - n.w) / 2;
        row.push(n);
      }
      // two boxes of one layer in the same lane: stack them
      const lanes = new Map<number, FNode[]>();
      row.forEach((n) => { const i = slotOf.get(n)!; lanes.set(i, [...(lanes.get(i) || []), n]); });
      const depth = Math.max(...[...lanes.values()].map((v) => v.length));
      for (let d = 0; d < depth; d++) placed.push([...lanes.values()].map((v) => v[d]).filter(Boolean));
    }
  } else {
    // Packed rows: boxes of a layer side by side, wrapping, centred.
    const inner = MAX_W - 2 * PAD;
    for (const layer of layers) {
      let row: FNode[] = [];
      let w = 0;
      for (const n of layer) {
        n.w = Math.min(n.w, inner);
        if (row.length && w + GAP_X + n.w > inner) { placed.push(row); row = []; w = 0; }
        w += (row.length ? GAP_X : 0) + n.w;
        row.push(n);
      }
      if (row.length) placed.push(row);
    }
    placed.forEach((row) => {
      const w = row.reduce((s, n) => s + n.w, 0) + GAP_X * (row.length - 1);
      let x = PAD + Math.max(0, (inner - w) / 2);
      row.forEach((n) => { n.x = x; x += n.w + GAP_X; });
    });
  }

  const hasGroups = (def.groups || []).length > 0;
  let y = PAD + (hasGroups ? 30 : 0);
  for (const row of placed) {
    const h = Math.max(...row.map((n) => n.h));
    row.forEach((n) => { n.y = y + (h - n.h) / 2; });
    const label = row.some((n) => n.sh === 'hub' && !n.lblTop) ? HUB_LABEL : 0;
    y += h + label + GAP_Y;
  }

  // Groups: the box around the nodes that were inside them.
  const groups: Group[] = [];
  for (const g of def.groups || []) {
    const members = def.nodes.filter((n) => cx(n) >= g.x && cx(n) <= g.x + g.w && cy(n) >= g.y && cy(n) <= g.y + g.h).map((n) => byId.get(n)!);
    if (!members.length) continue;
    const x0 = Math.min(...members.map((n) => n.x)) - 12, y0 = Math.min(...members.map((n) => n.y)) - 30;
    const x1 = Math.max(...members.map((n) => n.x + n.w)) + 12, y1 = Math.max(...members.map((n) => n.y + n.h + (n.sh === 'hub' && !n.lblTop ? HUB_LABEL : 0))) + 12;
    groups.push({ ...g, x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }

  const left = Math.min(...nodes.map((n) => n.x), ...groups.map((g) => g.x));
  const right = Math.max(...nodes.map((n) => n.x + n.w), ...groups.map((g) => g.x + g.w));
  const W = Math.max(340, Math.ceil(right - left + 2 * PAD));
  const shift = (W - (right - left)) / 2 - left; // centre the drawing
  nodes.forEach((n) => { n.x += shift; });
  groups.forEach((g) => { g.x += shift; });
  const H = Math.ceil(y - GAP_Y + PAD);
  const out: Def = { ...def, vb: [W, H], nodes, groups: hasGroups ? groups : def.groups, _mobile: true };
  delete out._sp; // let the runtime's spacing pass run on the new layout
  cache.set(def, out);
  return out;
}

// Flow and FLOWS are top-level declarations of the classic runtime: global, not window props.
const globalRef = (name: string) => { try { return new Function(`return typeof ${name}!=='undefined'?${name}:undefined`)(); } catch { return undefined; } };

/** Called by the runtime (patch `flow-hook`) with the Flow class, before any diagram is drawn. */
export function flowHook(Flow: any) {
  if (!Flow || Flow.prototype.__mobileHook) return;
  const mq = matchMedia(NARROW);
  const load = Flow.prototype.load;
  Flow.prototype.load = function (def: Def) {
    this.__origDef = def;
    const host: HTMLElement | undefined = this.host;
    const use = mq.matches && !!host && !host.closest('#playground,#pgFlow,[data-no-reflow]');
    const d = use ? mobileDef(def) : def;
    const r = load.call(this, d);
    try { host?.querySelector('svg.fsvg:not(.seq)')?.classList.toggle('mob', d !== def); } catch { /* ignore */ }
    return r;
  };
  Flow.prototype.__mobileHook = true;
  // Rotating a phone or resizing a window across the breakpoint redraws every diagram.
  mq.addEventListener?.('change', () => {
    const FLOWS = globalRef('FLOWS') || {};
    Object.values(FLOWS).forEach((f: any) => { try { if (f && f.__origDef) f.load(f.__origDef); } catch { /* ignore */ } });
  });
}

/* ---------- collapsed text: reopen when something points inside ---------- */
function openFor(el: Element | null) {
  // screen layout: a section in another tab — select that tab first
  const grp = el && (el.closest('main>section>[data-mg]') as HTMLElement | null);
  if (grp && !grp.classList.contains('mg-on')) {
    (document.querySelector(`nav.mtabs button[data-i="${grp.dataset.mg}"]`) as HTMLElement | null)?.click();
    if (!el!.closest('.m-src, .m-clamp')) requestAnimationFrame(() => (el as HTMLElement).scrollIntoView({ block: 'start' }));
  }
  // app layout: content that is only shown in the sheet
  const src = el && (el.closest('.m-src [data-mk], .m-src[data-mk], .m-clamp[data-mk]') as HTMLElement | null);
  if (src) { openSheet(src.getAttribute('data-mk')!); return; }
  const b = el && (el.closest('.mc-b') as HTMLElement | null);
  if (!b || b.classList.contains('mc-show')) return;
  let h = b.previousElementSibling;
  while (h && !h.classList.contains('mc-h')) h = h.previousElementSibling;
  const t = h && (h.querySelector('.mc-t') as HTMLElement | null);
  if (t && t.getAttribute('aria-expanded') !== 'true') t.click();
}

/* ---------- App layout: bottom sheet for a tile's content ---------- */
let sheet: HTMLDialogElement | null = null;
let opener: HTMLElement | null = null;
const H = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function sheetEl(): HTMLDialogElement {
  if (sheet) return sheet;
  sheet = document.createElement('dialog');
  sheet.className = 'msheet';
  sheet.setAttribute('aria-labelledby', 'msheet-title');
  sheet.innerHTML = '<div class="ms-grab" aria-hidden="true"></div><header class="ms-head"><span class="mi" aria-hidden="true"></span><div class="ms-ttl"><small></small><h2 id="msheet-title"></h2></div><button type="button" class="ms-x" aria-label="Close">×</button></header><div class="ms-body"></div><footer class="ms-foot"><button type="button" class="ms-prev">‹ Previous</button><span class="ms-pos"></span><button type="button" class="ms-next">Next ›</button></footer>';
  const sec = document.querySelector('main>section') as HTMLElement | null;
  if (sec) sheet.setAttribute('style', sec.getAttribute('style') || '');
  document.body.appendChild(sheet);
  sheet.querySelector('.ms-x')!.addEventListener('click', () => sheet!.close());
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet!.close(); }); // tap on the backdrop
  sheet.addEventListener('close', () => { document.documentElement.classList.remove('ms-open'); opener?.focus({ preventScroll: true }); });
  const step = (d: number) => {
    const k = sheet!.dataset.mk!;
    const tiles = siblingsOf(k);
    const i = tiles.indexOf(k);
    if (tiles[i + d]) openSheet(tiles[i + d]);
  };
  sheet.querySelector('.ms-prev')!.addEventListener('click', () => step(-1));
  sheet.querySelector('.ms-next')!.addEventListener('click', () => step(1));
  // swipe down on the handle or header to close
  let y0 = 0;
  const head = sheet.querySelector('.ms-head') as HTMLElement, grab = sheet.querySelector('.ms-grab') as HTMLElement;
  [head, grab].forEach((h) => {
    h.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
    h.addEventListener('touchend', (e) => { if (e.changedTouches[0].clientY - y0 > 70) sheet!.close(); }, { passive: true });
  });
  return sheet;
}

/** Tile keys in the same grid as `k` (for Previous / Next). */
function siblingsOf(k: string): string[] {
  const t = document.querySelector(`.mtile[data-mk="${k}"]`);
  const g = t && t.closest('.mgrid');
  return g ? [...g.querySelectorAll<HTMLElement>('.mtile')].map((x) => x.dataset.mk!) : [k];
}

function sheetContent(src: HTMLElement): { tag: string; title: string; body: Node[] } {
  const clean = (n: Node) => { const c = n.cloneNode(true) as Element; if (c.removeAttribute) { c.removeAttribute('data-mk'); c.classList?.remove('m-clamp'); } return c; };
  if (src.tagName === 'TR') {
    const table = src.closest('table')!;
    const head = table.rows[0] && table.rows[0].querySelector('th') ? table.rows[0] : null;
    const labels = head ? [...head.cells].map((c) => c.textContent!.trim()) : [];
    const cells = [...(src as HTMLTableRowElement).cells];
    const body = cells.slice(1).map((c, i) => {
      const d = document.createElement('div');
      d.className = 'ms-field';
      d.innerHTML = labels[i + 1] ? `<small>${H(labels[i + 1])}</small>` : '';
      const v = document.createElement('div');
      [...c.childNodes].forEach((n) => v.appendChild(clean(n)));
      d.appendChild(v);
      return d;
    });
    // tag: the section heading above the table
    let h: Element | null = (table.closest('.m-src') || table).previousElementSibling;
    while (h && h.tagName !== 'H2') h = h.previousElementSibling;
    return { tag: (h?.textContent || labels[0] || '').trim(), title: cells[0].textContent!.trim(), body };
  }
  if (src.classList.contains('card')) {
    // title and tag as shown on the tile; the body is the card without them
    const tile = document.querySelector(`.mtile[data-mk="${src.getAttribute('data-mk')}"]`);
    const title = tile?.querySelector('.mt b')?.textContent?.trim() || src.querySelector(':scope>h3')?.textContent?.trim() || '';
    const tag = tile?.querySelector('.mt small')?.textContent?.trim() || '';
    const copy = clean(src) as HTMLElement;
    copy.querySelectorAll('[data-mti]').forEach((e) => e.remove());
    let parts: Element[] = [...copy.children];
    if (copy.tagName === 'DETAILS') {
      const sum = copy.querySelector(':scope>summary');
      parts = [...(sum ? [...sum.children] : []), ...parts.filter((e) => e !== sum)];
    }
    const body = parts.filter((e) => (e.textContent || '').trim() || e.querySelector('img,svg,table'));
    return { tag, title, body };
  }
  // a long paragraph or callout: titled by its section heading
  let h: Element | null = src.previousElementSibling;
  while (h && !/^H[12]$/.test(h.tagName)) h = h.previousElementSibling;
  return { tag: '', title: (h?.textContent || document.querySelector('main h1')?.textContent || '').trim(), body: [clean(src)] };
}

function openSheet(k: string) {
  const src = document.querySelector<HTMLElement>(`main>section [data-mk="${k}"]:not(.mtile):not(.mmore)`);
  if (!src) return;
  const d = sheetEl();
  const { tag, title, body } = sheetContent(src);
  const tile = document.querySelector<HTMLElement>(`.mtile[data-mk="${k}"]`);
  d.dataset.mk = k;
  (d.querySelector('.ms-head .mi') as HTMLElement).innerHTML = tile?.querySelector('.mi')?.innerHTML || '';
  d.querySelector('.ms-head')!.setAttribute('style', tile?.getAttribute('style') || '');
  d.querySelector('.ms-ttl small')!.textContent = tag;
  d.querySelector('#msheet-title')!.textContent = title;
  const b = d.querySelector('.ms-body') as HTMLElement;
  b.replaceChildren(...body);
  b.scrollTop = 0;
  const sib = siblingsOf(k), i = sib.indexOf(k);
  const foot = d.querySelector('.ms-foot') as HTMLElement;
  foot.hidden = !tile || sib.length < 2;
  (d.querySelector('.ms-prev') as HTMLButtonElement).disabled = i <= 0;
  (d.querySelector('.ms-next') as HTMLButtonElement).disabled = i >= sib.length - 1;
  d.querySelector('.ms-pos')!.textContent = `${i + 1} of ${sib.length}`;
  if (!d.open) {
    opener = document.activeElement as HTMLElement | null;
    document.documentElement.classList.add('ms-open');
    d.showModal();
  }
}

function appSheet() {
  document.addEventListener('click', (e) => {
    const t = (e.target as Element)?.closest?.('.mtile, .mmore') as HTMLElement | null;
    if (t && t.dataset.mk) openSheet(t.dataset.mk);
  });
}

/** App layout: keep the tab bar under the app bar and highlight the section in view. */
function appTabs() {
  const root = document.documentElement;
  const aside = document.querySelector('aside');
  const setBar = () => root.style.setProperty('--mbar', `${Math.round(aside?.getBoundingClientRect().height || 0)}px`);
  setBar();
  addEventListener('resize', setBar);
  const bar = document.querySelector('nav.mtabs');
  const sec = document.querySelector('main>section');
  if (!bar || !sec) return;
  if (root.classList.contains('m-screen')) return; // tabs switch sections there; nothing to follow
  // the headings the tab bar points to (src/lib/collapse-inline.ts tabs marks them data-mtab)
  const hs = [...sec.querySelectorAll<HTMLElement>('h2[data-mtab]')].sort((a, b) => +a.dataset.mtab! - +b.dataset.mtab!);
  const btns = [...bar.querySelectorAll<HTMLElement>('button[data-i]')];
  let cur = -1;
  const onScroll = () => {
    const y = bar.getBoundingClientRect().bottom + 16;
    let i = -1;
    hs.forEach((h, k) => { if (h.getBoundingClientRect().top <= y) i = k; });
    if (i === cur) return;
    cur = i;
    btns.forEach((b, k) => { b.classList.toggle('on', k === i); if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    if (i >= 0) btns[i].scrollIntoView({ block: 'nearest', inline: 'center' });
  };
  let ticking = false;
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; onScroll(); }); } }, { passive: true });
  onScroll();
}

/* ---------- Phone navigation: bottom bar + Explore sheet ----------
 * Built from the sidebar's own markup (#nav) each time it opens, so it always matches the
 * desktop menu, including "My pages". The sidebar itself is hidden on phones. */
const GROUP_ICONS: Record<string, string> = {
  'Start here': '🚀', 'Models & ML': '🧠', 'RAG & knowledge': '📚', 'Agents': '🤖', 'Protocols': '🔌',
  'Prompting & AI at work': '✍️', 'Architecture': '🏗️', 'Trust & compliance': '🛡️', 'Build & ship': '🚢',
  'Applied AI': '🏭', 'Customer service AI': '🎧', 'FDE kit': '🧰', 'Learn & practice': '🎯',
  'CAIO · Chief AI Officer': '👔', 'My pages': '⭐',
};
const SVG = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const NAV_ICONS = {
  home: SVG('M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10'),
  explore: SVG('M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'),
  search: SVG('M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5'),
  course: SVG('M2 9l10-5 10 5-10 5zM6 11v5c2 2 10 2 12 0v-5'),
};
let navSheet: HTMLDialogElement | null = null;

type NavGroup = { name: string; links: HTMLAnchorElement[] };
function navData() {
  const nav = document.getElementById('nav');
  const pins = nav ? [...nav.querySelectorAll<HTMLAnchorElement>('.navpins a')] : [];
  const groups: NavGroup[] = nav ? [...nav.querySelectorAll('li.grp')].map((g) => ({
    name: (g.querySelector('.gname')?.textContent || '').trim(),
    links: [...g.querySelectorAll<HTMLAnchorElement>('ul a')],
  })).filter((g) => g.name && g.links.length) : [];
  return { pins, groups };
}
const here = () => '#' + (document.documentElement.dataset.page || '');
const linkHTML = (a: HTMLAnchorElement) => {
  const cur = a.getAttribute('data-href') === here();
  return `<a class="mn-link${cur ? ' on' : ''}" href="${a.getAttribute('href')}" style="${a.getAttribute('style') || ''}"${cur ? ' aria-current="page"' : ''}><i aria-hidden="true"></i><span>${H(a.textContent || '')}</span></a>`;
};

function navHome(d: HTMLDialogElement) {
  const { pins, groups } = navData();
  const curGroup = groups.find((g) => g.links.some((a) => a.getAttribute('data-href') === here()));
  const cur = curGroup?.links.find((a) => a.getAttribute('data-href') === here());
  const body = d.querySelector('.mn-body') as HTMLElement;
  body.innerHTML =
    (cur && curGroup ? `<p class="mn-h">You're here</p><button type="button" class="mn-here" data-g="${groups.indexOf(curGroup)}"><span class="mn-gi" aria-hidden="true">${GROUP_ICONS[curGroup.name] || '•'}</span><span><small>${H(curGroup.name)}</small><b>${H(cur.textContent || '')}</b></span><em aria-hidden="true">›</em></button>` : '') +
    `<p class="mn-h">Tools</p><div class="mn-pins">${pins.map((a) => `<a href="${a.getAttribute('href')}" style="${a.getAttribute('style') || ''}"><span aria-hidden="true">${H(a.querySelector('span')?.textContent || '')}</span>${H((a.textContent || '').replace(a.querySelector('span')?.textContent || '', '').trim())}</a>`).join('')}</div>` +
    `<p class="mn-h">Topics</p><div class="mn-groups">${groups.map((g, i) => `<button type="button" class="mn-group${g === curGroup ? ' on' : ''}" data-g="${i}"><span class="mn-gi" aria-hidden="true">${GROUP_ICONS[g.name] || '•'}</span><b>${H(g.name)}</b><small>${g.links.length} page${g.links.length === 1 ? '' : 's'}</small></button>`).join('')}</div>`;
  d.querySelector('.mn-back')!.setAttribute('hidden', '');
  d.querySelector('#mn-title')!.textContent = 'Explore';
  body.scrollTop = 0;
}
function navGroup(d: HTMLDialogElement, i: number) {
  const g = navData().groups[i];
  if (!g) return;
  const body = d.querySelector('.mn-body') as HTMLElement;
  body.innerHTML = `<div class="mn-list">${g.links.map(linkHTML).join('')}</div>`;
  d.querySelector('.mn-back')!.removeAttribute('hidden');
  d.querySelector('#mn-title')!.textContent = `${GROUP_ICONS[g.name] || ''} ${g.name}`.trim();
  body.scrollTop = 0;
  (d.querySelector('.mn-back') as HTMLElement).focus();
}
function navFilter(d: HTMLDialogElement, q: string) {
  const query = q.trim().toLowerCase();
  if (!query) { navHome(d); return; }
  const { groups } = navData();
  const hits = groups.flatMap((g) => g.links.filter((a) => (a.textContent || '').toLowerCase().includes(query) || g.name.toLowerCase().includes(query)));
  const body = d.querySelector('.mn-body') as HTMLElement;
  body.innerHTML = hits.length
    ? `<p class="mn-h">${hits.length} page${hits.length === 1 ? '' : 's'}</p><div class="mn-list">${hits.map(linkHTML).join('')}</div>`
    : `<p class="mn-empty">No page titles match. <button type="button" class="mn-deep">Search all content for “${H(q.trim())}”</button></p>`;
  d.querySelector('.mn-back')!.setAttribute('hidden', '');
  d.querySelector('#mn-title')!.textContent = 'Explore';
}
function openSearch(q?: string) {
  navSheet?.open && navSheet.close();
  const ex = (window as any).ATLAS;
  if (ex?.search) ex.search(q); else (document.getElementById('navsrch') as HTMLElement | null)?.click();
}
function openNav() {
  if (!navSheet) {
    const d = document.createElement('dialog');
    d.className = 'mnav';
    d.setAttribute('aria-labelledby', 'mn-title');
    d.innerHTML = '<div class="ms-grab" aria-hidden="true"></div><header class="mn-head"><button type="button" class="mn-back" aria-label="Back to topics" hidden>‹</button><h2 id="mn-title">Explore</h2><button type="button" class="ms-x" aria-label="Close">×</button></header><div class="mn-find"><input type="search" placeholder="Find a page" aria-label="Find a page" autocomplete="off"></div><div class="mn-body"></div>';
    document.body.appendChild(d);
    d.querySelector('.ms-x')!.addEventListener('click', () => d.close());
    d.addEventListener('click', (e) => {
      const t = e.target as Element;
      if (t === d) { d.close(); return; }
      const g = t.closest?.('[data-g]') as HTMLElement | null;
      if (g) { navGroup(d, +g.dataset.g!); return; }
      if (t.closest?.('.mn-back')) { navHome(d); (d.querySelector('.mn-find input') as HTMLInputElement).value = ''; return; }
      if (t.closest?.('.mn-deep')) { openSearch((d.querySelector('.mn-find input') as HTMLInputElement).value); return; }
      if (t.closest?.('a')) d.close();
    });
    d.querySelector('.mn-find input')!.addEventListener('input', (e) => navFilter(d, (e.target as HTMLInputElement).value));
    d.addEventListener('close', () => { document.documentElement.classList.remove('ms-open'); setBar('none'); });
    let y0 = 0;
    const grab = d.querySelector('.ms-grab') as HTMLElement, head = d.querySelector('.mn-head') as HTMLElement;
    [grab, head].forEach((h) => {
      h.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
      h.addEventListener('touchend', (e) => { if (e.changedTouches[0].clientY - y0 > 70) d.close(); }, { passive: true });
    });
    navSheet = d;
  }
  (navSheet.querySelector('.mn-find input') as HTMLInputElement).value = '';
  navHome(navSheet);
  document.documentElement.classList.add('ms-open');
  setBar('explore');
  navSheet.showModal();
}
function setBar(active: string) {
  document.querySelectorAll('.mbar [data-k]').forEach((b) => {
    const on = (b as HTMLElement).dataset.k === active || (active === 'none' && (b as HTMLElement).dataset.k === (b as HTMLElement).dataset.page);
    if ((b as HTMLElement).dataset.k === 'explore') b.setAttribute('aria-expanded', String(active === 'explore'));
    b.classList.toggle('on', on);
  });
}
function appNav() {
  if (document.querySelector('nav.mbar')) return;
  const base = document.documentElement.dataset.base || '/';
  const page = document.documentElement.dataset.page || '';
  const bar = document.createElement('nav');
  bar.className = 'mbar';
  bar.setAttribute('aria-label', 'Main');
  const cur = page === 'overview' ? 'home' : page === 'course' ? 'course' : '';
  bar.innerHTML =
    `<a href="${base}" data-k="home"${cur === 'home' ? ' aria-current="page" class="on"' : ''}>${NAV_ICONS.home}<span>Home</span></a>` +
    `<button type="button" data-k="explore" aria-haspopup="dialog" aria-expanded="false">${NAV_ICONS.explore}<span>Explore</span></button>` +
    `<button type="button" data-k="search" aria-haspopup="dialog">${NAV_ICONS.search}<span>Search</span></button>` +
    `<a href="${base}course/" data-k="course"${cur === 'course' ? ' aria-current="page" class="on"' : ''}>${NAV_ICONS.course}<span>Course</span></a>`;
  bar.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => { if (b.dataset.k === cur) b.dataset.page = cur; });
  document.body.appendChild(bar);
  bar.addEventListener('click', (e) => {
    const b = (e.target as Element).closest('[data-k]') as HTMLElement | null;
    if (!b) return;
    if (b.dataset.k === 'explore') openNav();
    if (b.dataset.k === 'search') openSearch();
  });
}

export function mobileText() {
  const main = document.querySelector('main');
  if (!main) return;
  if (document.documentElement.classList.contains('m-nav')) appNav();
  if (document.documentElement.classList.contains('m-app')) { appTabs(); appSheet(); }
  const fromHash = () => { const id = decodeURIComponent(location.hash.slice(1)); if (id) openFor(document.getElementById(id)); };
  fromHash();
  window.addEventListener('hashchange', fromHash);
  // search results highlight their match with <mark>
  new MutationObserver((ms) => {
    for (const m of ms) m.addedNodes.forEach((n) => { if (n instanceof Element) openFor(n.matches('mark') ? n : n.querySelector('mark')); });
  }).observe(main, { childList: true, subtree: true });
}
