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

type Node = { id: string; x: number; y: number; w: number; h: number; sh?: string; lblTop?: boolean; pt?: unknown; g?: unknown; [k: string]: unknown };
type Group = { x: number; y: number; w: number; h: number; [k: string]: unknown };
type Def = { vb: [number, number]; nodes: Node[]; edges: unknown[]; groups?: Group[]; _sp?: unknown; [k: string]: unknown };

/** Widest canvas we aim for, in viewBox units: about 0.78 scale on a 390px-wide phone. */
const MAX_W = 460;
const PAD = 16;
const GAP_X = 18;
const GAP_Y = 58;
const MIN_NODE_W = 118;
const HUB_LABEL = 34;

const cx = (n: Node) => n.x + n.w / 2;
const cy = (n: Node) => n.y + n.h / 2;

/** Group nodes whose centres are close along one axis (columns or rows of the drawing). */
function clusters(nodes: Node[], center: (n: Node) => number, size: (n: Node) => number): Node[][] {
  const out: Node[][] = [];
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

  const nodes: Node[] = def.nodes.map((n) => { const c = { ...n }; delete c.g; return c; });
  const byId = new Map(def.nodes.map((n, i) => [n, nodes[i]]));
  const cols = clusters(nodes, cx, (n) => n.w);
  const rows = clusters(nodes, cy, (n) => n.h);
  // A drawing with more columns than rows reads left to right: its columns become our rows.
  const horizontal = cols.length > rows.length;
  const layers = horizontal ? cols : rows;
  const slots = horizontal ? rows : cols;
  const across = horizontal ? cy : cx; // order inside a layer
  layers.forEach((l) => l.sort((a, b) => across(a) - across(b)));

  const placed: Node[][] = []; // visual rows, top to bottom
  if (slots.length <= 3) {
    // Grid transpose: each slot (a row of the original, or a column) keeps its own lane.
    const slotOf = new Map<Node, number>();
    slots.forEach((s, i) => s.forEach((n) => slotOf.set(n, i)));
    const k = slots.length;
    const lane = Math.max(MIN_NODE_W, Math.min(Math.max(...nodes.map((n) => n.w)), (MAX_W - 2 * PAD - (k - 1) * GAP_X) / k));
    for (const layer of layers) {
      const row: Node[] = [];
      for (const n of layer) {
        const i = slotOf.get(n)!;
        n.w = Math.min(n.w, lane);
        n.x = PAD + i * (lane + GAP_X) + (lane - n.w) / 2;
        row.push(n);
      }
      // two boxes of one layer in the same lane: stack them
      const lanes = new Map<number, Node[]>();
      row.forEach((n) => { const i = slotOf.get(n)!; lanes.set(i, [...(lanes.get(i) || []), n]); });
      const depth = Math.max(...[...lanes.values()].map((v) => v.length));
      for (let d = 0; d < depth; d++) placed.push([...lanes.values()].map((v) => v[d]).filter(Boolean));
    }
  } else {
    // Packed rows: boxes of a layer side by side, wrapping, centred.
    const inner = MAX_W - 2 * PAD;
    for (const layer of layers) {
      let row: Node[] = [];
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
  const hs = [...sec.querySelectorAll('h2')].filter((h) => !h.closest('[data-flow],.src-box,.atlas-a11y'));
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
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

export function mobileText() {
  const main = document.querySelector('main');
  if (!main) return;
  if (document.documentElement.classList.contains('m-app')) { appTabs(); appSheet(); }
  const fromHash = () => { const id = decodeURIComponent(location.hash.slice(1)); if (id) openFor(document.getElementById(id)); };
  fromHash();
  window.addEventListener('hashchange', fromHash);
  // search results highlight their match with <mark>
  new MutationObserver((ms) => {
    for (const m of ms) m.addedNodes.forEach((n) => { if (n instanceof Element) openFor(n.matches('mark') ? n : n.querySelector('mark')); });
  }).observe(main, { childList: true, subtree: true });
}
