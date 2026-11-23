/**
 * Inline script (BaseLayout <head>): on phones (≤ 640px), sections made only of text fold
 * under their h2. It runs before first paint, once on the server-rendered section and again
 * when the runtime restores the original markup (scripts/build-runtime.ts RESTORE), so folding
 * causes no layout shift. A section is folded only if none of its blocks holds a diagram, a
 * form control, a canvas or SVG, a button, or an element with an id (something the runtime
 * fills in). src/scripts/mobile.ts reopens a section when a link or search points inside it.
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
window.__atlasMC=function(s){if(s&&window.matchMedia&&matchMedia(MQ).matches)walk(s);};
document.addEventListener('click',function(e){
 var t=e.target&&e.target.closest&&e.target.closest('.mc-t');if(!t)return;
 var open=t.getAttribute('aria-expanded')!=='true';t.setAttribute('aria-expanded',String(open));
 for(var el=t.closest('h2').nextElementSibling;el&&el.tagName!=='H2';el=el.nextElementSibling)if(el.classList.contains('mc-b'))el.classList.toggle('mc-show',open);
});
})();`;
