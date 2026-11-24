/**
 * Inline script (BaseLayout <head>): on phones (≤ 640px), sections made only of text fold
 * under their h2. It runs before first paint, once on the server-rendered section and again
 * when the runtime restores the original markup (scripts/build-runtime.ts RESTORE), so folding
 * causes no layout shift. A section is folded only if none of its blocks holds a diagram, a
 * form control, a canvas or SVG, a button, or an element with an id (something the runtime
 * fills in). src/scripts/mobile.ts reopens a section when a link or search points inside it.
 *
 * App layout (pages in APP, trial): each group of text cards and each table becomes a grid of
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
var APP={'agentic-coding':1};
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
var RULES=[[/pull request|merge/,'git'],[/inject|secur|attack|supply chain|threat|destruct/,'shield'],[/test|eval|benchmark/,'flask'],[/sandbox|isolat|container/,'box'],[/review|watch|observ|explor/,'eye'],[/human|people|role|junior|atroph/,'user'],[/tool|skill|mcp|integrat/,'wrench'],[/metric|measur|rate|kpi|throughput|defect/,'chart'],[/cost|price|budget/,'coin'],[/time|cycle|schedul|background/,'clock'],[/agent|bot|autonom|fleet/,'bot'],[/spec|doc|instruction|context|file/,'file'],[/code|repo|refactor|migrat|bug|completion|edit/,'code'],[/risk|fail|danger|vague|poor/,'alert'],[/fast|speed|latency/,'bolt'],[/good|fit/,'check']];
var COLORS=['blue','purple','green','orange','pink','teal'];
function icon(t){t=t.toLowerCase();for(var i=0;i<RULES.length;i++)if(RULES[i][0].test(t))return IC[RULES[i][1]];return IC.layers;}
function esc(x){return x.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
var mk=0;
function tile(src,title,tag,color,i){
 src.setAttribute('data-mk',++mk);
 return '<button type="button" class="mtile" data-mk="'+mk+'" style="--c:var(--'+(color||COLORS[i%COLORS.length])+')">'+
  '<span class="mi" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="'+icon(title+' '+(tag||''))+'"/></svg></span>'+
  '<span class="mt">'+(tag?'<small>'+esc(tag)+'</small>':'')+'<b>'+esc(title)+'</b></span></button>';
}
function grid(before,html){var g=document.createElement('div');g.className='mgrid';g.innerHTML=html;before.parentNode.insertBefore(g,before);}
function tagColor(t){var m=/var\(--(\w+)\)/.exec(t&&t.getAttribute('style')||'');return m&&m[1];}
function cards(s){
 [].slice.call(s.querySelectorAll('.grid')).forEach(function(g){
  if(g.closest('[data-flow],.fwrap,.src-box,.ptools,.atlas-a11y,.m-src'))return;
  var cs=[].slice.call(g.children).filter(function(c){return c.classList.contains('card')&&!c.querySelector(FIXED)&&c.querySelector(':scope>h3');});
  if(!cs.length||cs.length!==g.children.length)return;
  grid(g,cs.map(function(c,i){var t=c.querySelector(':scope>.tag');return tile(c,c.querySelector(':scope>h3').textContent.trim(),t&&t.textContent.trim(),tagColor(t),i);}).join(''));
  g.classList.add('m-src');
 });
}
function tables(s){
 [].slice.call(s.querySelectorAll('table')).forEach(function(t){
  if(t.closest('[data-flow],.src-box,.ptools,.m-src')||t.querySelector('input,select,textarea,button,[id]'))return;
  var rows=[].slice.call(t.rows),head=rows[0]&&rows[0].querySelector('th')?rows[0]:null;
  var body=rows.filter(function(r){return r!==head&&r.cells.length>1;});if(body.length<2)return;
  var wrap=t.closest('.card.tablewrap')||t;
  grid(wrap,body.map(function(r,i){return tile(r,r.cells[0].textContent.trim(),'',null,i);}).join(''));
  wrap.classList.add('m-src');
 });
}
function longText(s){
 [].slice.call(s.querySelectorAll(':scope>p,:scope>.callout,:scope>.lead')).forEach(function(p){
  if(p.querySelector(FIXED)||p.textContent.length<140||p.nextElementSibling&&p.nextElementSibling.classList.contains('mmore'))return;
  p.classList.add('m-clamp');p.setAttribute('data-mk',++mk);
  var b=document.createElement('button');b.type='button';b.className='mmore';b.setAttribute('data-mk',mk);b.textContent='Read more';
  p.parentNode.insertBefore(b,p.nextSibling);
 });
}
function tabs(s){
 var hs=[].slice.call(s.querySelectorAll('h2')).filter(function(h){return !h.closest('[data-flow],.src-box,.atlas-a11y');});
 if(hs.length<2||document.querySelector('nav.mtabs'))return;
 var n=document.createElement('nav');n.className='mtabs';n.setAttribute('aria-label','Sections on this page');n.setAttribute('style',s.getAttribute('style')||'');
 var h='';hs.forEach(function(x,i){h+='<button type="button" data-i="'+i+'">'+esc(x.textContent)+'</button>';});
 n.innerHTML=h;s.parentNode.insertBefore(n,s);
}
function app(s){mk=0;document.documentElement.classList.add('m-app');cards(s);tables(s);longText(s);tabs(s);}
window.__atlasMC=function(s){
 if(!s||!window.matchMedia||!matchMedia(MQ).matches)return;
 if(APP[document.documentElement.getAttribute('data-page')])app(s);else walk(s);
};
document.addEventListener('click',function(e){
 var t=e.target&&e.target.closest&&e.target.closest('.mtabs button');if(!t)return;
 var s=document.querySelector('main>section');
 var hs=[].slice.call(s.querySelectorAll('h2')).filter(function(h){return !h.closest('[data-flow],.src-box,.atlas-a11y');});
 var h=hs[+t.getAttribute('data-i')];if(!h)return;
 var bar=document.querySelector('nav.mtabs'),off=(bar?bar.getBoundingClientRect().bottom:0)+8;
 window.scrollTo({top:h.getBoundingClientRect().top+window.scrollY-off,behavior:'smooth'});
});
document.addEventListener('click',function(e){
 var t=e.target&&e.target.closest&&e.target.closest('.mc-t');if(!t)return;
 var open=t.getAttribute('aria-expanded')!=='true';t.setAttribute('aria-expanded',String(open));
 for(var el=t.closest('h2').nextElementSibling;el&&el.tagName!=='H2';el=el.nextElementSibling)if(el.classList.contains('mc-b'))el.classList.toggle('mc-show',open);
});
})();`;
