/**
 * Accessibility enhancer (Phase 5). Runs after the Atlas runtime (ATLAS.after) and again when
 * the runtime redraws part of the page. It only adds what assistive technology needs and never
 * changes what the runtime renders. Everything it adds is marked so tests can tell it apart:
 * elements carry class "atlas-a11y", attributes it sets are listed in data-a11y.
 *
 *  - controls without an accessible name get aria-label from their visible context
 *  - scrollable regions without focusable content become focusable regions (keyboard scrolling)
 *  - tab lists get tab roles and aria-selected
 *  - Enter/Space activate non-native [role=button] elements
 *  - every diagram gets a "Text version": title, boxes, connections and steps (like flowText())
 */
type Def = { title?: string; intro?: string; nodes?: any[]; edges?: any[]; steps?: any[] };

const strip = (s: unknown) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

function mark(el: Element, attr: string, value: string) {
  el.setAttribute(attr, value);
  const have = (el.getAttribute('data-a11y') || '').split(' ').filter(Boolean);
  if (!have.includes(attr)) el.setAttribute('data-a11y', [...have, attr].join(' '));
}

/* ---------- names for unlabelled form controls ---------- */
function hasName(el: HTMLElement) {
  if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.title) return true;
  // A wrapping <label> or <label for=id>. Cheaper than el.labels, which is slow on pages with many fields.
  const wrap = el.closest('label');
  if (wrap && strip(wrap.textContent)) return true;
  if (el.id) {
    const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (l && strip(l.textContent)) return true;
  }
  return false;
}
function contextText(el: HTMLElement): string {
  const ph = el.getAttribute('placeholder');
  if (ph) return ph;
  // text right before the control (a sibling label-like element or text node)
  let n: Node | null = el.previousSibling;
  for (let i = 0; n && i < 4; i++, n = n.previousSibling) {
    const t = strip(n.textContent);
    if (t && t.length <= 90) return t;
    if (t) break;
  }
  // the nearest container's heading/label text
  let p = el.parentElement;
  for (let i = 0; p && i < 4; i++, p = p.parentElement) {
    const h = p.querySelector(':scope > b, :scope > strong, :scope > h3, :scope > h4, :scope > label, :scope > .lbl, :scope > span:first-child');
    const t = h && !h.contains(el) ? strip(h.textContent) : '';
    if (t && t.length <= 90) return t;
  }
  const dataKey = Object.entries(el.dataset).map(([k, v]) => `${k} ${v}`).join(' ');
  return strip((el.id || dataKey || el.getAttribute('name') || el.tagName.toLowerCase()).replace(/[-_]+/g, ' '));
}
function nameControls(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('input:not([type=hidden]), select, textarea').forEach((el) => {
    if (hasName(el)) return;
    let t = contextText(el);
    if ((el as HTMLInputElement).type === 'checkbox' || (el as HTMLInputElement).type === 'radio') {
      const v = (el as HTMLInputElement).value;
      if (v && v !== 'on' && !t.includes(v)) t = `${t} ${v}`.trim();
    }
    if (t) mark(el, 'aria-label', t);
  });
}

/* ---------- scrollable regions reachable by keyboard ---------- */
const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),summary';
// Only block containers can scroll here; skipping inline elements and SVG internals (diagrams have
// thousands of shapes) keeps this pass cheap.
const BOXES = 'div,pre,ul,ol,dl,table,section,nav,aside,details,figure,form,fieldset,main';
function scrollRegions(els: Iterable<HTMLElement>) {
  for (const el of els) {
    // Form controls scroll on their own and are already focusable; they can't take role=region.
    if (!el.isConnected || el.hasAttribute('tabindex') || el.closest('svg')) continue;
    const cs = getComputedStyle(el);
    const ox = /auto|scroll/.test(cs.overflowX), oy = /auto|scroll/.test(cs.overflowY);
    if (!ox && !oy) continue;
    const sx = ox && el.scrollWidth > el.clientWidth + 1;
    const sy = oy && el.scrollHeight > el.clientHeight + 1;
    if (!sx && !sy) continue;
    if (el.querySelector(FOCUSABLE)) continue;
    mark(el, 'tabindex', '0');
    if (!el.getAttribute('role')) mark(el, 'role', 'region');
    if (!el.getAttribute('aria-label')) {
      const h = el.closest('.card,section')?.querySelector('h2,h3,h4');
      mark(el, 'aria-label', strip(h?.textContent) || 'Scrollable content');
    }
  }
}
const boxesIn = (root: Element): HTMLElement[] => [...(root.matches(BOXES) ? [root as HTMLElement] : []), ...root.querySelectorAll<HTMLElement>(BOXES)];

/* ---------- tabs ---------- */
function tabRoles(root: ParentNode) {
  root.querySelectorAll('[role=tablist]').forEach((list) => {
    [...list.children].forEach((b) => {
      if (b.tagName !== 'BUTTON') return;
      if (b.getAttribute('role') !== 'tab') mark(b, 'role', 'tab');
      const sel = String(b.classList.contains('on') || b.classList.contains('active'));
      if (b.getAttribute('aria-selected') !== sel) mark(b, 'aria-selected', sel);
    });
  });
}

/* ---------- diagram text versions ---------- */
function flowText(def: Def): string {
  const H = (s: unknown) => strip(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const nodes = (def.nodes || []).filter((n) => n && n.t && !n.pt);
  const name: Record<string, string> = {};
  (def.nodes || []).forEach((n) => { name[n.id] = strip(n.t); });
  const li = (items: string[]) => (items.length ? `<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>` : '<p>None.</p>');
  return `<p><b>${H(def.title || 'Diagram')}</b>${def.intro ? ` — ${H(def.intro).replace(/Press <b>Play<\/b>.*$/i, '')}` : ''}</p>` +
    `<h4>Boxes</h4>` + li(nodes.map((n) => `<b>${H(n.t)}</b>${n.s ? ` (${H(n.s)})` : ''}${n.d ? `: ${H(n.d)}` : ''}`)) +
    `<h4>Connections</h4>` + li((def.edges || []).map((e) => `${H(name[e.f] || e.f)} → ${H(name[e.t] || e.t)}${e.l ? ` (${H(e.l)})` : ''}`)) +
    ((def.steps || []).length ? `<h4>Steps</h4><ol>${(def.steps || []).map((s) => `<li><b>${H(s.title)}</b>: ${H(s.t)}</li>`).join('')}</ol>` : '');
}
function textVersion(flow: any) {
  const host: HTMLElement | undefined = flow && flow.host;
  if (!host || !host.isConnected || !host.closest('main') || !flow.def) return;
  let box = host.nextElementSibling as HTMLElement | null;
  if (!box || !box.classList.contains('flow-text')) {
    box = document.createElement('details');
    box.className = 'atlas-a11y flow-text';
    box.innerHTML = '<summary>Text version of this diagram</summary><div class="flow-text-body"></div>';
    host.after(box);
  }
  box.querySelector('.flow-text-body')!.innerHTML = flowText(flow.def);
}
// Flow and FLOWS are top-level class/const declarations of the classic runtime: global, but not
// properties of window. A Function-constructor body runs in the global scope and can read them.
const globalRef = (name: string) => { try { return new Function(`return typeof ${name}!=='undefined'?${name}:undefined`)(); } catch { return undefined; } };
function diagrams() {
  const Flow = globalRef('Flow');
  if (!Flow || Flow.prototype.__a11y) return;
  const load = Flow.prototype.load;
  Flow.prototype.load = function (def: Def) { const r = load.call(this, def); try { textVersion(this); } catch { /* ignore */ } return r; };
  Flow.prototype.__a11y = true;
}
function allDiagrams() {
  const FLOWS = globalRef('FLOWS') || {};
  Object.values(FLOWS).forEach((f) => { try { textVersion(f); } catch { /* ignore */ } });
}

/* ---------- wiring ---------- */
// The first pass covers the whole page; after that only what the runtime added or changed is
// checked (added elements, and a few ancestors whose scroll size may have changed).
let pending = new Set<Element>();
let queued = false;
function runAll() {
  const main = document.querySelector('main');
  if (!main) return;
  nameControls(document);
  tabRoles(document);
  scrollRegions(boxesIn(main));
}
function runChanged() {
  queued = false;
  const roots = [...pending].filter((r) => r.isConnected);
  pending = new Set();
  const boxes = new Set<HTMLElement>();
  for (const r of roots) {
    if (r.closest('svg')) continue;
    nameControls(r.parentElement || r);
    tabRoles(r.closest('[role=tablist]')?.parentElement || r);
    boxesIn(r).forEach((b) => boxes.add(b));
    for (let a = r.parentElement, i = 0; a && i < 4 && a.tagName !== 'MAIN'; a = a.parentElement, i++) if (a.matches(BOXES)) boxes.add(a as HTMLElement);
  }
  scrollRegions(boxes);
}
export function enhanceA11y() {
  diagrams();
  allDiagrams();
  runAll();
  const main = document.querySelector('main');
  if (main) new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.target instanceof Element && m.target.closest('svg')) continue; // diagram animation
      m.addedNodes.forEach((n) => { if (n instanceof Element) pending.add(n); else if (n.parentElement) pending.add(n.parentElement); });
      if (m.target instanceof Element && m.addedNodes.length) pending.add(m.target);
    }
    if (pending.size && !queued) { queued = true; requestAnimationFrame(runChanged); }
  }).observe(main, { childList: true, subtree: true });
  addEventListener('resize', () => requestAnimationFrame(runAll));
  // Skip link: focus <main> without a hash change (the runtime routes on hash changes).
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a.skip-link');
    if (!a) return;
    e.preventDefault();
    const m = document.getElementById('main');
    if (m) { m.focus(); m.scrollIntoView({ block: 'start' }); }
  });
  // Enter/Space on non-native buttons (diagram lanes, chips drawn as divs)
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || (e.key !== 'Enter' && e.key !== ' ')) return;
    const t = e.target as HTMLElement;
    if (!t || t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
    if (t.getAttribute('role') === 'button' || t.getAttribute('role') === 'tab') { e.preventDefault(); t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); }
  });
}
