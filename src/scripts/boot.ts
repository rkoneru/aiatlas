/**
 * ATLAS boot: runs as a classic script before the Atlas runtime on every page.
 *
 * The runtime was written for one document holding all 98 pages and a #hash router.
 * This file gives it what it used to read from that document:
 *   - ATLAS.hash() / ATLAS.go(): the current page from the URL, navigation to real URLs
 *   - ATLAS.exists() / title() / pageCount(): facts about other pages, from JSON
 *   - ATLAS.searchPages(): the prebuilt search index
 *   - companions: sections a multi-page module needs (e.g. the CAIO tools), attached
 *     hidden and inert outside <main> before the runtime starts
 *   - handoffs: calls made just before navigating away (e.g. "open in playground")
 *     are replayed on the next page
 * See docs/runtime-adaptations.md.
 */
import './platform';
import pages from '../generated/boot-pages.json';
import merged from '../data/redirects.json';

type Replay = { call: string; args: unknown[] };
type SearchEntry = { id: string; title: string; h1: string; text: string; low: string };

const MERGED = merged as Record<string, string>;
const PAGES = pages as Array<{ id: string; title: string; navLabel: string | null; group: string | null }>;
const IDS = new Set(PAGES.map((p) => p.id));
const PAGE = document.documentElement.dataset.page || 'overview';
const HANDOFF = 'atlas-handoff';
const BASE = document.documentElement.dataset.base || '/';
const url = (id: string) => (id === 'overview' ? BASE : `${BASE}${id}/`);
const dec = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
const ss = {
  get(k: string) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k: string) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};
const liveSection = (id: string) => {
  const s = document.getElementById(id);
  return s && s.tagName === 'SECTION' && s.parentElement && s.parentElement.tagName === 'MAIN' ? s : null;
};

const exposed: Record<string, (...a: any[]) => unknown> = {};
let pending: Replay[] = [];
let index: SearchEntry[] | null = null;
let indexLoading: Promise<void> | null = null;
let lastPage: string | null = null;
try { lastPage = localStorage.getItem('atlas-last'); } catch { /* ignore */ }

/** Where a #target lives: a page, a merged block inside a page, or neither. */
function resolve(target: string): { page: string; frag: string } | null {
  const id = dec(String(target).replace(/^#/, ''));
  if (IDS.has(id)) return { page: id, frag: '' };
  if (MERGED[id]) return { page: MERGED[id], frag: '#' + id };
  return null;
}

const ATLAS = {
  page: PAGE,
  pages: PAGES.map((p) => p.id),

  /** What the runtime used to read from location.hash: '#<current page>', or a merged/custom id shown on this page. */
  hash(): string {
    const h = location.hash, id = dec(h.slice(1));
    if (id && ((MERGED[id] && MERGED[id] === PAGE) || (id !== PAGE && liveSection(id)))) return h;
    return '#' + PAGE;
  },

  /** What the runtime used to do with `location.hash = target`. */
  go(target: unknown, replay?: Replay) {
    const raw = String(target ?? '');
    const r = resolve(raw);
    const replays = [...pending, ...(replay ? [replay] : [])];
    pending = [];
    if (!r) {
      const id = dec(raw.replace(/^#/, ''));
      if (/^my-/.test(id) && PAGE !== 'builder') { location.href = url('builder') + '#' + id; return; }
      location.hash = raw; // an in-page anchor or a saved custom page shown on this page
      return;
    }
    if (r.page === PAGE) {
      if (r.frag) { if (location.hash === r.frag) document.getElementById(r.frag.slice(1))?.scrollIntoView({ block: 'start' }); else location.hash = r.frag; }
      else if (location.hash && liveSection(dec(location.hash.slice(1)))) location.hash = ''; // leave a custom page, back to this page
      return;
    }
    if (replays.length) ss.set(HANDOFF, JSON.stringify(replays));
    location.href = url(r.page) + r.frag;
  },

  /** Queue a call for the next page (used by stand-ins for functions that live on another page). */
  queue(r: Replay) { pending.push(r); },
  expose(name: string, fn: (...a: any[]) => unknown) { exposed[name] = fn; },

  exists(id: string) { return IDS.has(id) || id in MERGED || !!document.getElementById(id); },
  group(id: string) { const p = PAGES.find((x) => x.id === id); return (p && p.group) || ''; },
  title(id: string) { const p = PAGES.find((x) => x.id === id); return p ? (p.navLabel || p.title) : id; },
  /** Number of pages the runtime used to count in main>section: all pages plus any saved custom pages. */
  pageCount() { return PAGES.length + Math.max(0, document.querySelectorAll('main>section').length - 1); },
  url,

  /** Search entries for every page. Uses /search-index.json once loaded; until then, the live sections. */
  searchPages(mapLive: (s: Element) => SearchEntry, onReady: () => void): SearchEntry[] {
    const live = [...document.querySelectorAll('main>section')];
    if (index) {
      const have = new Set(index.map((x) => x.id));
      return index.map((x) => ({ ...x, low: '' })).concat(live.filter((s) => !have.has(s.id)).map(mapLive));
    }
    if (!indexLoading) {
      indexLoading = fetch(BASE + 'search-index.json')
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((j: SearchEntry[]) => { index = j; onReady(); })
        .catch(() => { indexLoading = null; });
    }
    return live.map(mapLive);
  },

  /** Runs after the runtime: replay handoffs, add the home-page resume link. */
  after() {
    const raw = ss.get(HANDOFF);
    if (raw) {
      ss.del(HANDOFF);
      setTimeout(() => {
        let list: Replay[] = [];
        try { list = JSON.parse(raw); } catch { /* ignore */ }
        for (const r of list) {
          const fn = exposed[r.call] || (window as any)[r.call];
          if (typeof fn === 'function') { try { fn(...(r.args || [])); } catch (e) { console.warn('[atlas] handoff failed', r.call, e); } }
        }
      }, 0);
    }
    if (PAGE === 'overview' && lastPage && lastPage !== 'overview' && IDS.has(lastPage)) {
      const sec = document.querySelector('main>section');
      if (sec) {
        const p = document.createElement('p');
        p.className = 'atlas-resume';
        const a = document.createElement('a');
        a.href = url(lastPage);
        a.innerHTML = 'Continue where you left off: <b></b> →';
        a.querySelector('b')!.textContent = ATLAS.title(lastPage);
        p.appendChild(a);
        sec.before(p);
      }
    }
  },
};
(window as any).ATLAS = ATLAS;

/* Old shared links (#rag, #rag-math) and hash changes made by the runtime go to the real page. */
function followHash(replace: boolean) {
  const id = dec(location.hash.slice(1));
  if (!id) return;
  const r = resolve(id);
  if (r && r.page !== PAGE) { const to = url(r.page) + r.frag; replace ? location.replace(to) : (location.href = to); return; }
  if (r && r.page === PAGE && !r.frag) { history.replaceState(history.state, '', location.pathname + location.search); return; }
  if (!r && /^my-/.test(id) && PAGE !== 'builder') location.replace(url('builder') + '#' + id);
}
followHash(true);
window.addEventListener('hashchange', () => followHash(false));

/* Links the runtime builds as href="#page-id" navigate to the page's URL. */
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
  if (!a) return;
  const id = dec(a.getAttribute('href')!.slice(1));
  if (resolve(id)) { e.preventDefault(); ATLAS.go('#' + id); }
  else if (/^my-/.test(id) && PAGE !== 'builder') { e.preventDefault(); location.href = url('builder') + '#' + id; }
});

/* Stand-in for the playground's loader on other pages: the call is replayed on /playground/. */
if (PAGE !== 'playground') (window as any).__pgLoad = (...args: unknown[]) => ATLAS.queue({ call: '__pgLoad', args });

/* Companions: hidden, inert copies of sections that a multi-page module on this page needs. */
const tpl = document.getElementById('atlas-companions-tpl') as HTMLTemplateElement | null;
const box = document.getElementById('atlas-companions');
if (tpl && box) box.appendChild(tpl.content.cloneNode(true));
