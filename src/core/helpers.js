import { t } from './i18n.js';
import { G } from './state.js';


/* ---------- Helpers ---------- */
const $ = (sel, root=document) => root.querySelector(sel);

const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
 const toast = msg => { const e = $('#toast'); e.textContent = msg; e.classList.add('show'); clearTimeout(G.toastT); G.toastT = setTimeout(()=>e.classList.remove('show'), 2200); };

const modal = (html, onMount) => new Promise(res => {
  const bg = el(`<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`);
  const onKey = e => { if(e.key==='Escape' && bg.isConnected){ e.stopPropagation(); close(null); } };
  const close = v => { document.removeEventListener('keydown', onKey, true); bg.remove(); res(v); };
  bg.addEventListener('click', e => { if(e.target === bg) close(null); });
  document.addEventListener('keydown', onKey, true);
  $('#modals').appendChild(bg);
  if(onMount) onMount(bg, close);
  const f = bg.querySelector('input:not([data-nofocus]),textarea,button'); if(f) setTimeout(()=>f.focus(), 30);
});

const confirmM = (text, okLabel) => modal(`<p style="margin:0 0 4px;font-size:15px">${esc(text)}</p><div class="actions"><button class="btn ghost" data-x>${t('cancel')}</button><button class="btn danger" data-ok>${esc(okLabel||t('delete'))}</button></div>`, (bg, close) => { bg.querySelector('[data-x]').onclick = ()=>close(false); bg.querySelector('[data-ok]').onclick = ()=>close(true); });

const promptM = (title, ph, val='') => modal(`<h2>${esc(title)}</h2><div class="field"><input id="pm-in" placeholder="${esc(ph||'')}" value="${esc(val)}"></div><div class="actions"><button class="btn ghost" data-x>${t('cancel')}</button><button class="btn" data-ok>OK</button></div>`, (bg, close) => { const inp = bg.querySelector('#pm-in'); bg.querySelector('[data-x]').onclick = ()=>close(null); bg.querySelector('[data-ok]').onclick = ()=>close(inp.value); inp.addEventListener('keydown', e => { if(e.key==='Enter') close(inp.value); }); });

const fitRect = (bw, bh, mw, mh) => { if(!mw||!mh) return {x:0,y:0,w:bw,h:bh}; const s = Math.min(bw/mw, bh/mh); const w = mw*s, h = mh*s; return {x:(bw-w)/2, y:(bh-h)/2, w, h}; };

const fmtSec = s => (Math.round(s*10)/10).toFixed(1).replace('.', (G.LANG==='en'||G.LANG==='zh')?'.':',');

export { $, $$, esc, el, toast, modal, confirmM, promptM, fitRect, fmtSec };
