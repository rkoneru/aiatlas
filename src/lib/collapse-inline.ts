/**
 * Inline script (BaseLayout <head>): on phones (≤ 640px), sections made only of text fold
 * under their h2. It runs before first paint, once on the server-rendered section and again
 * when the runtime restores the original markup (scripts/build-runtime.ts RESTORE), so folding
 * causes no layout shift. A section is folded only if none of its blocks holds a diagram, a
 * form control, a canvas or SVG, a button, or an element with an id (something the runtime
 * fills in). src/scripts/mobile.ts reopens a section when a link or search points inside it.
 *
 * App layout (pages in APP, trial): nothing is hidden at section level. Every heading and
 * tile title shows; each text tile opens on tap, each table becomes a stack of row cards that
 * open on tap, and a sticky bar of section tabs (with "Expand all") sits above the content.
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
/* ---- App layout (trial pages): everything shown, detail collapsible ---- */
var APP={'agentic-coding':1};
var FIXED='input,select,textarea,button,canvas,svg,[id],[data-flow]';
function btn(cls,host){
 if(host.querySelector(':scope>.'+cls))return;
 var b=document.createElement('button');b.type='button';b.className=cls;b.setAttribute('aria-expanded','false');
 while(host.firstChild)b.appendChild(host.firstChild);host.appendChild(b);
}
function tiles(s){
 [].slice.call(s.querySelectorAll('.card')).forEach(function(c){
  if(c.closest('[data-flow],.fwrap,.src-box,.ptools,.atlas-a11y')||c.querySelector(FIXED))return;
  var h=c.querySelector(':scope>h3');if(!h)return;
  var rest=[].slice.call(c.children).filter(function(e){return e!==h&&!e.classList.contains('tag');});
  if(!rest.length)return;
  c.classList.add('tc');btn('tc-t',h);
 });
}
function tables(s){
 [].slice.call(s.querySelectorAll('table')).forEach(function(t){
  if(t.closest('[data-flow],.src-box,.ptools')||t.querySelector('input,select,textarea,button,[id]'))return;
  var rows=[].slice.call(t.rows);if(rows.length<2)return;
  var head=rows[0].querySelector('th')?rows[0]:null;
  var labels=head?[].slice.call(head.cells).map(function(c){return c.textContent.trim();}):[];
  t.classList.add('tt');if(head)head.classList.add('tt-head');
  rows.forEach(function(r){
   if(r===head||r.cells.length<2)return;
   var first=r.cells[0];first.classList.add('tt-h');r.classList.add('tt-row');btn('tt-t',first);
   for(var i=1;i<r.cells.length;i++){var l=labels[i];if(l)r.cells[i].setAttribute('data-label',l);}
  });
 });
}
function tabs(s){
 var hs=[].slice.call(s.querySelectorAll('h2')).filter(function(h){return !h.closest('[data-flow],.src-box,.atlas-a11y');});
 if(hs.length<2||document.querySelector('nav.mtabs'))return;
 var n=document.createElement('nav');n.className='mtabs';n.setAttribute('aria-label','Sections on this page');n.setAttribute('style',s.getAttribute('style')||'');
 var h='';hs.forEach(function(x,i){h+='<button type="button" data-i="'+i+'">'+x.textContent.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</button>';});
 n.innerHTML=h+'<button type="button" class="mtabs-all" aria-pressed="false">Expand all</button>';
 s.parentNode.insertBefore(n,s);
}
function app(s){document.documentElement.classList.add('m-app');tiles(s);tables(s);tabs(s);}
window.__atlasMC=function(s){
 if(!s||!window.matchMedia||!matchMedia(MQ).matches)return;
 if(APP[document.documentElement.getAttribute('data-page')])app(s);else walk(s);
};
document.addEventListener('click',function(e){
 var t=e.target&&e.target.closest&&e.target.closest('.tc-t,.tt-t,.mtabs button');
 if(!t){ // a tap anywhere on a tile or table row (but not on a link inside it) toggles it
  var box0=e.target&&e.target.closest&&e.target.closest('html.m-app .card.tc, html.m-app tr.tt-row');
  if(!box0||e.target.closest('a,button,summary,input,select,textarea'))return;
  var b0=box0.querySelector('.tc-t,.tt-t');if(b0)b0.click();return;
 }
 var s=document.querySelector('main>section');
 if(t.classList.contains('tc-t')||t.classList.contains('tt-t')){
  var box=t.closest(t.classList.contains('tc-t')?'.card':'tr'),open=t.getAttribute('aria-expanded')!=='true';
  t.setAttribute('aria-expanded',String(open));box.classList.toggle('open',open);return;
 }
 if(t.classList.contains('mtabs-all')){
  var on=t.getAttribute('aria-pressed')!=='true';t.setAttribute('aria-pressed',String(on));t.textContent=on?'Collapse all':'Expand all';
  [].slice.call(s.querySelectorAll('.tc-t,.tt-t')).forEach(function(b){b.setAttribute('aria-expanded',String(on));b.closest(b.classList.contains('tc-t')?'.card':'tr').classList.toggle('open',on);});
  return;
 }
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
