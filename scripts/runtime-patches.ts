/**
 * Exact-text patches applied to the inline script by scripts/extract.ts.
 *
 * Each patch adapts code that assumed every page was in one document. They change
 * where a value comes from (the URL, a JSON index, a handoff), never what the page shows.
 * `count` is the number of matches expected in the source; extraction fails if it differs,
 * so a changed source can't silently skip a patch.
 */
import fs from 'node:fs';
export type Patch = { id: string; why: string; find: string; replace: string; count?: number };
export type CopyPatch = Patch & { in: 'runtime' | 'content'; page?: string };

/** Wording and export changes (decisions Q3, Q4), shared with the parity test. */
export const COPY_PATCHES: CopyPatch[] = JSON.parse(fs.readFileSync(new URL('./copy-patches.json', import.meta.url), 'utf8')).patches;

export const PATCHES: Patch[] = [
  ...COPY_PATCHES.filter((p) => p.in === 'runtime'),
  /* ---- nav lookups: nav links now carry real URLs, the old #id lives in data-href ---- */
  {
    id: 'nav-selector',
    why: 'Code finds nav links by their #id href. Links now point to /id/, so match data-href instead.',
    find: 'a[href="#',
    replace: 'a[data-href="#',
    count: 9,
  },
  {
    id: 'nav-active',
    why: 'route() marks the active nav link by comparing its href to #id.',
    find: "a.getAttribute('href')==='#'+id",
    replace: "a.getAttribute('data-href')==='#'+id",
  },
  {
    id: 'nav-mypages-builder',
    why: 'The JS-built "My pages" group links to the page builder; give it data-href like the other nav links.',
    find: '<li><a href="#builder" style="--c:var(--purple)" title="Page builder">',
    replace: '<li><a href="#builder" data-href="#builder" style="--c:var(--purple)" title="Page builder">',
  },
  {
    id: 'nav-mypages-item',
    why: 'Saved custom pages are added to the nav at runtime; give them data-href too.',
    find: 'li.innerHTML=`<a href="#${p.id}" style="--c:var(--purple)"',
    replace: 'li.innerHTML=`<a href="#${p.id}" data-href="#${p.id}" style="--c:var(--purple)"',
  },

  /* ---- facts about other pages that used to come from their DOM ---- */
  {
    id: 'page-count',
    why: '"Search across all N pages" and Team progress counted main>section; only one page is in the DOM now.',
    find: "document.querySelectorAll('main>section').length",
    replace: 'ATLAS.pageCount()',
    count: 2,
  },
  {
    id: 'exists-glossary-link',
    why: 'Glossary shows a page link only if that page exists, which it checked in the DOM.',
    find: '${t.p&&document.getElementById(t.p)?',
    replace: '${t.p&&ATLAS.exists(t.p)?',
  },
  {
    id: 'exists-wizard-links',
    why: 'Decision wizard keeps related-page links whose page exists in the DOM.',
    find: 'ids.filter(id=>$(id))',
    replace: 'ids.filter(id=>ATLAS.exists(id))',
  },
  {
    id: 'exists-review-table',
    why: 'Changelog review table lists pages that exist in the DOM.',
    find: 'filter(([id])=>$(id))',
    replace: 'filter(([id])=>ATLAS.exists(id))',
  },
  {
    id: 'navlabel-fallback',
    why: 'Labels for pages not in the nav fell back to that page\'s <h1> in the DOM.',
    find: "const s=$(id);const h=s&&s.querySelector('h1');return h?h.textContent.trim():id;}",
    replace: "const s=$(id);const h=s&&s.querySelector('h1');return h?h.textContent.trim():ATLAS.title(id);}",
    count: 2,
  },

  {
    id: 'exists-practice-pages',
    why: 'The practice page filter lists pages that have cards and exist in the DOM.',
    find: 'w Set(CARDS.map(c=>c.page))].filter(p=>$(p))',
    replace: 'w Set(CARDS.map(c=>c.page))].filter(p=>ATLAS.exists(p))',
  },
  {
    id: 'group-fallback',
    why: 'The sources box picks references by the page\'s nav group. Team mode left the nav (decision 4), so fall back to its original group.',
    find: "const n=g&&g.querySelector('.gname');return n?n.textContent.trim():'';};",
    replace: "const n=g&&g.querySelector('.gname');return n?n.textContent.trim():ATLAS.group(id);};",
  },

  /* ---- site search reads a prebuilt index instead of every section ---- */
  {
    id: 'search-index',
    why: 'Search indexed the text of all 98 sections in the DOM. It now loads /search-index.json (same text, built from the rendered original) and indexes live sections such as saved custom pages as before.',
    find: "IDX=[...document.querySelectorAll('main>section')].map(s=>({id:s.id,title:navLabel(s.id),h1:(s.querySelector('h1')||{}).textContent||'',text:secText(s),low:''}));",
    replace: "IDX=ATLAS.searchPages(s=>({id:s.id,title:navLabel(s.id),h1:(s.querySelector('h1')||{}).textContent||'',text:secText(s),low:''}),()=>{if(!m.hidden){IDX=null;run();}});",
  },
  {
    id: 'search-go',
    why: 'Opening a result on another page highlighted the term after a hash change; it now hands the term to the next page.',
    find: "else{location.hash='#'+h.x.id;setTimeout(()=>highlight(h.x.id,h.x.concept?h.x.title.replace(/\\s*\\(.*\\)$/,''):q),120);}}",
    replace: "else{ATLAS.go('#'+h.x.id,{call:'srHighlight',args:[h.x.id,h.x.concept?h.x.title.replace(/\\s*\\(.*\\)$/,''):q]});}}",
  },
  {
    id: 'search-expose-highlight',
    why: 'Lets the target page run the search highlight handed over by search-go, and lets /?q=term open the search (the site\'s SearchAction and the 404 page use it).',
    find: " function open(q){m.hidden=false;IDX=null;",
    replace: " ATLAS.expose('srHighlight',(id,q)=>setTimeout(()=>highlight(id,q),120));ATLAS.expose('srOpen',q=>open(q));\n function open(q){m.hidden=false;IDX=null;",
  },

  /* ---- "Practice this page" from any page ---- */
  {
    id: 'practice-stub',
    why: 'Off the practice page the practice module was a no-op, so "Practice this page" never showed. Off-page it now shows the button for pages with cards and opens /practice/ filtered to the page.',
    find: "const PR=(()=>{if(!$('practice')||typeof AC==='undefined')return {forPage(){},render(){}};",
    replace: "const PR=(()=>{if(!$('practice')||typeof AC==='undefined'){if(typeof AC!=='undefined')document.querySelectorAll('.ptools').forEach(p=>{const b=p.querySelector('.pt-prac');if(b&&AC.some(r=>r[5]===p.dataset.for))b.hidden=false;});return {forPage(id){ATLAS.go('#practice',{call:'prForPage',args:[id]});},render(){},mastered(){return (Object.values((()=>{try{return JSON.parse(localStorage.getItem('atlas-sr-v1')||'{}')||{};}catch(e){return {};}})())).filter(s=>s&&s.box>=4).length;}};}",
  },
  {
    id: 'practice-expose',
    why: 'Lets /practice/ apply a page filter handed over from another page.',
    find: "cur=null;location.hash='#practice';}",
    replace: "cur=null;ATLAS.go('#practice');}\n ATLAS.expose('prForPage',id=>{forPage(id);render();});",
  },

  /* ---- Phase 3: let per-page builds see that the course view only renders on /course/ ---- */
  {
    id: 'route-course',
    why: 'route() renders the course when the current id is "course". With one page per URL that is only true on /course/; stating it lets other pages drop the course renderer (scripts/build-runtime.ts folds ATLAS.page===…).',
    find: "if(id==='course')cRender();",
    replace: "if(id==='course'&&ATLAS.page==='course')cRender();",
  },

  {
    id: 'export-styles',
    why: 'The interactive diagram export copied every <style> on the page; in the single file that was only the Atlas stylesheet. The site also inlines its font stylesheet (relative font URLs that break in a downloaded file), so copy the Atlas stylesheet only.',
    find: "const css=[...document.querySelectorAll('style')].map(s=>s.textContent).join('\\n');",
    replace: "const css=[...document.querySelectorAll('style[data-atlas]')].map(s=>s.textContent).join('\\n');",
  },

  /* ---- decision Q2: no automatic jump from / to the last page ---- */
  {
    id: 'no-auto-resume',
    why: 'Opening / with no hash jumped to the last page visited. The home page now offers a "Continue where you left off" link instead.',
    find: "if(!location.hash){try{const l=localStorage.getItem('atlas-last');if(l)history.replaceState(null,'','#'+l);}catch(e){}}",
    replace: '/* resume: see ATLAS.resumeLink() (decision Q2) */',
  },
  {
    id: 'flow-hook',
    why: 'Lets src/scripts/mobile.ts wrap Flow.prototype.load before the first diagram is drawn, so phones get a vertical layout on first paint. Does nothing at desktop widths.',
    find: "const stateOrder=['submitted',",
    replace: "if(typeof window.__atlasFlowHook==='function')window.__atlasFlowHook(Flow);\nconst stateOrder=['submitted',",
  },
];
