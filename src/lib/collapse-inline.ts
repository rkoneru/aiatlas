/**
 * Inline script (BaseLayout <head>): on phones (≤ 640px), sections made only of text fold
 * under their h2. It runs before first paint, once on the server-rendered section and again
 * when the runtime restores the original markup (scripts/build-runtime.ts RESTORE), so folding
 * causes no layout shift. A section is folded only if none of its blocks holds a diagram, a
 * form control, a canvas or SVG, a button, or an element with an id (something the runtime
 * fills in). src/scripts/mobile.ts reopens a section when a link or search points inside it.
 *
 * App layout (every page except NOT_APP): each group of text cards and each table becomes a grid of
 * small icon tiles; tapping a tile opens its full content in a bottom sheet (src/scripts/mobile.ts).
 * Long paragraphs are clipped with "Read more", which opens the same sheet. Sticky section tabs
 * sit above the content. The original markup stays in the page, hidden on phones (.m-src).
 */
export const COLLAPSE_INLINE = `(function(){
var MQ='(max-width: 640px)';
function textOnly(el){
 if(/^(TEMPLATE|SCRIPT|STYLE|H1|H2|DETAILS)$/.test(el.tagName))return false;
 if(el.matches('[data-flow],.ptools,.src-box,.atlas-a11y,.kicker,.lead,[id]'))return false;
 return !el.querySelector('[data-flow],input,select,textarea,canvas,svg,button,[id]');
}
function walk(s){
 var h=null,bl=[];
 function flush(){
  if(!h||!bl.length||!bl.every(textOnly))return;
  h.classList.add('mc-h');
  if(!h.querySelector('.mc-t')){var b=document.createElement('button');b.type='button';b.className='mc-t';b.setAttribute('aria-expanded','false');while(h.firstChild)b.appendChild(h.firstChild);h.appendChild(b);}
  bl.forEach(function(e){e.classList.add('mc-b');});
 }
 [].slice.call(s.children).forEach(function(el){
  if(el.tagName==='H2'){flush();h=el;bl=[];}
  else if(el.querySelector(':scope>h2')){flush();h=null;bl=[];walk(el);}
  else if(h)bl.push(el);
 });
 flush();
}
/* ---- App layout (trial pages): icon tiles; content opens in a sheet (src/scripts/mobile.ts) ---- */
// Every page uses the app layout except full-screen tools.
var NOT_APP={'course':1,'playground':1,'team':1};
var FIXED='input,select,textarea,button,canvas,svg,[id],[data-flow]';
// 24px stroke icons, chosen by keywords in a tile's title and tag
var IC={
 flask:'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3',
 box:'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10',
 eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
 wrench:'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
 shield:'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
 chart:'M4 20V10M10 20V4M16 20v-7M2 20h20',
 bolt:'M13 2L4 14h7l-1 8 9-12h-7z',
 user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
 bot:'M5 8h14v11H5zM12 4v4M9 13h.01M15 13h.01M9 16.5h6',
 code:'M8 6l-6 6 6 6M16 6l6 6-6 6',
 file:'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
 alert:'M12 3l10 18H2zM12 9v5M12 17h.01',
 coin:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 9h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9M12 6v2M12 16v2',
 clock:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 3',
 git:'M6 3v12M6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9c0 6-6 6-12 8',
 check:'M5 12l5 5 9-10',
 layers:'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5'
};
var RULES=[[/pull request|merge/,'git'],[/inject|secur|attack|supply chain|threat|destruct/,'shield'],[/test|\\beval|benchmark/,'flask'],[/sandbox|isolat|container/,'box'],[/review|watch|observ|explor/,'eye'],[/human|people|role|junior|atroph/,'user'],[/tool|skill|mcp|integrat/,'wrench'],[/metric|measur|rate|kpi|throughput|defect/,'chart'],[/cost|price|budget/,'coin'],[/time|cycle|schedul|background/,'clock'],[/agent|bot|autonom|fleet/,'bot'],[/spec|doc|instruction|context|file/,'file'],[/code|repo|refactor|migrat|bug|completion|edit/,'code'],[/risk|fail|danger|vague|poor/,'alert'],[/fast|speed|latency/,'bolt'],[/good|fit/,'check']];
var COLORS=['blue','purple','green','orange','pink','teal'];
function icon(t){t=t.toLowerCase();for(var i=0;i<RULES.length;i++)if(RULES[i][0].test(t))return IC[RULES[i][1]];return IC.layers;}
function esc(x){return x.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
var mk=0;
function tile(src,title,tag,color,i,tEl){
 src.setAttribute('data-mk',++mk);if(tEl)tEl.setAttribute('data-mti','');
 return '<button type="button" class="mtile" data-mk="'+mk+'" style="--c:var(--'+(color||COLORS[i%COLORS.length])+')">'+
  '<span class="mi" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="'+icon(title+' '+(tag||''))+'"/></svg></span>'+
  '<span class="mt">'+(tag?'<small>'+esc(tag)+'</small>':'')+'<b>'+esc(title)+'</b></span></button>';
}
function grid(before,html){var g=document.createElement('div');g.className='mgrid';g.innerHTML=html;before.parentNode.insertBefore(g,before);}
function live(el,s){for(var x=el.parentElement;x&&x!==s;x=x.parentElement)if(x.id&&!x.classList.contains('merged'))return true;return false;}
function tagColor(t){var m=/var\\(--(\\w+)\\)/.exec(t&&t.getAttribute('style')||'');return m&&m[1];}
function cards(s){
 [].slice.call(s.querySelectorAll('.grid')).forEach(function(g){
  if(g.closest('[data-flow],.fwrap,.src-box,.ptools,.atlas-a11y,.m-src')||g.id||live(g,s))return;
  var cs=[].slice.call(g.children).filter(function(c){return c.classList.contains('card')&&!c.querySelector(FIXED)&&c.querySelector(':scope>h3');});
  if(!cs.length||cs.length!==g.children.length)return;
  grid(g,cs.map(function(c,i){var t=c.querySelector(':scope>.tag'),h=c.querySelector(':scope>h3');if(t)t.setAttribute('data-mti','');return tile(c,h.textContent.trim(),t&&t.textContent.trim(),tagColor(t),i,h);}).join(''));
  g.classList.add('m-src');
 });
}
function tables(s){
 [].slice.call(s.querySelectorAll('table')).forEach(function(t){
  if(t.closest('[data-flow],.src-box,.ptools,.m-src')||t.querySelector('input,select,textarea,button,[id]')||t.id||live(t,s))return;
  var rows=[].slice.call(t.rows),head=rows[0]&&rows[0].querySelector('th')?rows[0]:null;
  var body=rows.filter(function(r){return r!==head&&r.cells.length>1;});if(body.length<2)return;
  var wrap=t.closest('.card.tablewrap')||t;
  grid(wrap,body.map(function(r,i){return tile(r,r.cells[0].textContent.trim(),'',null,i);}).join(''));
  wrap.classList.add('m-src');
 });
}
function longText(s){
 [].slice.call(s.querySelectorAll(':scope>p,:scope>.callout,:scope>.merged>p,:scope>.merged>.callout')).forEach(function(p){
  if(p.id||p.querySelector(FIXED)||live(p,s)||p.textContent.length<140||p.nextElementSibling&&p.nextElementSibling.classList.contains('mmore'))return;
  p.classList.add('m-clamp');p.setAttribute('data-mk',++mk);
  var b=document.createElement('button');b.type='button';b.className='mmore';b.setAttribute('data-mk',mk);b.textContent='Read more';
  p.parentNode.insertBefore(b,p.nextSibling);
 });
}
function tabHeads(root){return [].slice.call(root.querySelectorAll('h2')).filter(function(h){return !h.closest('[data-flow],.src-box,.atlas-a11y')&&!live(h,root);});}
function tabs(s){
 // Headings from the page's own markup only. Before the runtime runs, that markup waits in the
 // atlas-src template while the server snapshot (which also has headings the runtime adds, such
 // as "Key formulas" or glossary letters) is on screen; using the template keeps the bar the same
 // before and after, so it never shifts the page. (Don't write the template's tag here: the build
 // looks for it in the page HTML.)
 var tpl=document.getElementById('atlas-src');
 var src=tpl&&tpl.content?tpl.content:s;
 var hs=tabHeads(src.nodeType===11?wrapFrag(src):src);
 if(src===s)hs.forEach(function(h,i){h.setAttribute('data-mtab',i);});
 var old=document.querySelector('nav.mtabs');
 if(old&&old.getAttribute('data-n')===String(hs.length))return; // same bar
 if(old)old.remove();
 if(hs.length<2)return;
 var n=document.createElement('nav');n.className='mtabs';n.setAttribute('aria-label','Sections on this page');n.setAttribute('style',s.getAttribute('style')||'');n.setAttribute('data-n',hs.length);
 var h='';hs.forEach(function(x,i){h+='<button type="button" data-i="'+i+'">'+esc(x.textContent)+'</button>';});
 n.innerHTML=h;s.parentNode.insertBefore(n,s);
}
// live() walks up to a root element; a template's content is a fragment, so give it one
function wrapFrag(f){var d=document.createElement('div');d.appendChild(f.cloneNode(true));return d;}
/* Cards the runtime draws into a container (glossary, catalogues, release log...). Runs on the
   first render and again as the runtime's last statement; rebuilds when a filter re-renders. */
var TSEL=':scope>h3,:scope>summary b,:scope>.gl-th>b,:scope>div>h3,:scope>h4,:scope>b,:scope>div>b,:scope>strong';
var NOPE='input,select,textarea,button,canvas,svg,[data-flow]';
function titleOf(c){
 var t=c.querySelector(TSEL);if(!t)return null;
 var x=t.cloneNode(true);[].slice.call(x.querySelectorAll('.muted,.pill,small')).forEach(function(e){e.remove();});
 var txt=x.textContent.replace(/\\s+/g,' ').trim();
 if(!txt||txt.length>90||/^[\\d.,%$€£+\\-–~×x\\s]+$/.test(txt))return null; // stat boxes ("308") stay as they are
 return [t,txt];
}
function tagOf(c,tEl){var g=c.querySelector('.gl-tag,.pill,.tag,.ch-v');return g&&!tEl.contains(g)&&g.textContent.length<50?g:null;}
function textCards(E,root){
 var k=[].slice.call(E.children);
 // a small group (a glossary letter with one or two terms, or a filtered result) counts when this
 // container already had groups like it tiled, or has at least three of them
 var cls=E.classList[0],seen=root&&root.__mcls&&cls&&root.__mcls[cls];
 var min=cls&&!E.id&&(seen||E.parentElement.querySelectorAll(':scope>.'+cls).length>=3)?1:3;
 if(k.length<min)return null;
 return k.every(function(c){return c.classList.contains('card')&&!c.querySelector(NOPE)&&titleOf(c);})?k:null;
}
var mbox=0;
function dynList(E,root){
 var key=E.id||E.getAttribute('data-mbox');if(!key){key='b'+(++mbox);E.setAttribute('data-mbox',key);}
 var prev=E.previousElementSibling;if(prev&&prev.classList.contains('mgrid')&&prev.getAttribute('data-for')===key)prev.remove();
 E.classList.remove('m-src');
 var kids=textCards(E,root);if(!kids)return;
 if(root&&E.classList[0]){root.__mcls=root.__mcls||{};root.__mcls[E.classList[0]]=1;}
 var shown=kids.filter(function(c){return !c.hidden&&c.style.display!=='none';});
 var html=shown.map(function(c,i){var ti=titleOf(c),tg=tagOf(c,ti[0]);if(tg)tg.setAttribute('data-mti','');var col=/var\\(--(\\w+)\\)/.exec(c.getAttribute('style')||'');return tile(c,ti[1],tg&&tg.textContent.trim(),col&&col[1],i,ti[0]);}).join('');
 var g=document.createElement('div');g.className='mgrid';g.setAttribute('data-for',key);g.innerHTML=html||'<p class="muted">Nothing to show.</p>';
 E.parentNode.insertBefore(g,E);E.classList.add('m-src');
}
/* Lists of text cards the runtime draws (glossary, catalogues, release log...): tiled on the first
   render, again as the runtime's last statement, and whenever a filter or search re-renders them. */
function scan(root,s){
 var list=[root].concat([].slice.call(root.querySelectorAll('div,ul,ol')));
 list.forEach(function(E){
  if(E===s||E.closest('[data-flow],.src-box,.ptools,.mgrid,.atlas-a11y')||(E.parentElement&&E.parentElement.closest('.m-src')))return;
  var mine=E.id||E.hasAttribute('data-mbox');
  if(E.classList.contains('m-src')&&!mine)return; // a static grid already tiled
  if(!E.id&&!live(E,s))return;                  // only runtime-filled content
  if(!mine&&!textCards(E,root))return;
  dynList(E,root);
 });
 // Ignore our own changes to this container only. Dropping other containers' records too would
 // lose a real redraw that happened meanwhile (seen as a missed glossary rebuild in WebKit).
 if(root.__mobs)root.__mobs.takeRecords();
}
window.__atlasDyn=function(s){
 if(!s||!document.documentElement.classList.contains('m-app'))return;
 if(document.documentElement.classList.contains('m-screen'))flowMore(s);
 [].slice.call(s.querySelectorAll('[id]')).forEach(function(root){
  if(root.classList.contains('merged')||root.closest('[data-flow],.src-box,.ptools,.mgrid')||live(root,s))return; // nested lists are scanned with their outermost container
  scan(root,s);
  // watch only containers that hold cards or are still empty (filled later); not calculators
  if(!root.__mwatch&&window.MutationObserver&&(root.querySelector('.card')||!root.children.length)){
   root.__mwatch=1;var q=0;
   var o=new MutationObserver(function(){if(q)return;q=1;setTimeout(function(){q=0;scan(root,s);},0);});
   o.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['style','hidden']});root.__mobs=o;
  }
 });
};
/* ---- Screen layout (trial): sections become tabs, one shown at a time, so a page fits in one
   or two scrolls; the diagram's secondary controls fold behind "⋯". ---- */
var SCREEN={'agentic-coding':1};
var mgSel=0;
function screen(s){
 document.documentElement.classList.add('m-screen');
 var nav=document.querySelector('nav.mtabs');if(!nav)return;
 var btns=[].slice.call(nav.querySelectorAll('button[data-i]'));
 var labels=btns.map(function(b){return b.textContent.trim();});
 var g=-1,li=0,first=null;
 [].slice.call(s.children).forEach(function(el){
  if(el===nav)return;
  if(el.tagName==='H2'&&li<labels.length&&el.textContent.trim()===labels[li]){g=li++;if(!first)first=el;}
  if(g>=0)el.setAttribute('data-mg',g);
 });
 if(!first)return;
 s.insertBefore(nav,first); // the tabs sit right above the sections
 nav.setAttribute('role','tablist');
 btns.forEach(function(b){b.setAttribute('role','tab');});
 pick(s,mgSel<labels.length?mgSel:0);
}
function pick(s,i){
 mgSel=i;
 [].slice.call(s.querySelectorAll(':scope>[data-mg]')).forEach(function(el){el.classList.toggle('mg-on',el.getAttribute('data-mg')===String(i));});
 [].slice.call(document.querySelectorAll('nav.mtabs button[data-i]')).forEach(function(b){var on=b.getAttribute('data-i')===String(i);b.setAttribute('aria-selected',String(on));b.classList.toggle('on',on);b.tabIndex=on?0:-1;});
}
function flowMore(s){
 [].slice.call(s.querySelectorAll('[data-flow] .fctl')).forEach(function(f){
  if(f.querySelector('.fx-more'))return;
  var b=document.createElement('button');b.type='button';b.className='b fx-more';b.setAttribute('aria-expanded','false');b.setAttribute('aria-label','More diagram options: view, reset, steps, voice-over, export');b.textContent='⋯';
  f.appendChild(b);
 });
}
function app(s){mk=0;document.documentElement.classList.add('m-app');cards(s);tables(s);longText(s);tabs(s);
 if(SCREEN[document.documentElement.getAttribute('data-page')]){screen(s);flowMore(s);}
 window.__atlasDyn(s);}
window.__atlasMC=function(s){
 if(!s||!window.matchMedia||!matchMedia(MQ).matches)return;
 if(!NOT_APP[document.documentElement.getAttribute('data-page')])app(s);else walk(s);
};
document.addEventListener('click',function(e){
 var t=e.target&&e.target.closest&&e.target.closest('.mtabs button');if(!t)return;
 var s=document.querySelector('main>section');
 if(document.documentElement.classList.contains('m-screen')){
  pick(s,+t.getAttribute('data-i'));
  var nb=t.closest('nav.mtabs'),top=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mbar'))||66;
  if(nb.getBoundingClientRect().top<top+1)window.scrollTo({top:nb.getBoundingClientRect().top+window.scrollY-top-1});
  return;
 }
 var h=s.querySelector('h2[data-mtab="'+t.getAttribute('data-i')+'"]');if(!h)return;
 var bar=document.querySelector('nav.mtabs'),off=(bar?bar.getBoundingClientRect().bottom:0)+8;
 window.scrollTo({top:h.getBoundingClientRect().top+window.scrollY-off,behavior:'smooth'});
});
// "⋯" on a diagram shows its secondary controls (steps, reset, voice-over, export)
document.addEventListener('click',function(e){
 var b=e.target&&e.target.closest&&e.target.closest('.fx-more');if(!b)return;
 var f=b.closest('.fctl'),open=!f.classList.contains('open');f.classList.toggle('open',open);b.setAttribute('aria-expanded',String(open));
});
// arrow keys move between section tabs
document.addEventListener('keydown',function(e){
 var t=e.target&&e.target.closest&&e.target.closest('nav.mtabs[role=tablist] button[data-i]');if(!t||(e.key!=='ArrowRight'&&e.key!=='ArrowLeft'))return;
 var all=[].slice.call(t.parentNode.querySelectorAll('button[data-i]')),i=all.indexOf(t)+(e.key==='ArrowRight'?1:-1);
 if(all[i]){e.preventDefault();all[i].focus();all[i].click();}
});
document.addEventListener('click',function(e){
 var t=e.target&&e.target.closest&&e.target.closest('.mc-t');if(!t)return;
 var open=t.getAttribute('aria-expanded')!=='true';t.setAttribute('aria-expanded',String(open));
 for(var el=t.closest('h2').nextElementSibling;el&&el.tagName!=='H2';el=el.nextElementSibling)if(el.classList.contains('mc-b'))el.classList.toggle('mc-show',open);
});
})();`;
