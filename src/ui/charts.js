import { rr } from '../annotations/draw.js';
import { esc, modal } from '../core/helpers.js';
import { LOCALE, fmtDate, t } from '../core/i18n.js';
import { mediaUrl } from '../core/state.js';


/* ---------- Charts (canvas, no library) ---------- */
function barChart(cv, labels, values, opts={}){
  const dpr = window.devicePixelRatio||1; const W = cv.clientWidth||600, H = cv.clientHeight||220; cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
  const col = opts.color||'#004EAD', ink = opts.ink||'#525252', line = opts.line||'rgba(0,0,0,.08)'; const max = Math.max(1, ...values);
  ctx.font = '600 11px Montserrat, sans-serif'; ctx.fillStyle = ink; ctx.textBaseline = 'middle';
  if(opts.horizontal){
    const lw = Math.min(W*0.42, 190); const rowH = Math.min(30, (H-6)/Math.max(1, values.length)); const x0 = lw+8, bw = W - x0 - 44;
    values.forEach((val, i) => { const y = 3 + i*rowH + rowH/2; let lab = labels[i]||''; while(ctx.measureText(lab).width > lw-6 && lab.length > 3) lab = lab.slice(0,-2); if(lab !== labels[i]) lab += '…';
      ctx.textAlign = 'right'; ctx.fillStyle = ink; ctx.fillText(lab, x0-8, y); const w = bw*val/max; ctx.fillStyle = col; rr(ctx, x0, y-rowH*0.32, Math.max(2, w), rowH*0.64, 4); ctx.fill(); ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.fillText(String(val), x0+w+6, y); });
    return;
  }
  const padL = 30, padB = 22, padT = 8; const cw = W-padL-6, ch = H-padT-padB; const n = values.length; const bw = cw/Math.max(1,n);
  ctx.strokeStyle = line; ctx.lineWidth = 1; const ticks = Math.max(1, Math.min(4, max)); ctx.textAlign = 'right';
  for(let k=0;k<=ticks;k++){ const y = padT + ch - ch*k/ticks; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W-6, y); ctx.stroke(); ctx.fillStyle = ink; ctx.fillText(String(Math.round(max*k/ticks)), padL-6, y); }
  values.forEach((val, i) => { const x = padL + i*bw + bw*0.15, w = bw*0.7, h = ch*val/max; ctx.fillStyle = col; rr(ctx, x, padT+ch-h, w, Math.max(h, val?2:0), Math.min(4, w/2)); ctx.fill(); });
  ctx.textAlign = 'center'; ctx.fillStyle = ink; const every = Math.ceil(n/ (W<420 ? 5 : 8)); let lastDrawn = -99;
  labels.forEach((lab, i) => { const isLast = i===n-1; if((i%every) && !isLast) return; if(isLast && i-lastDrawn < every*0.6) return; lastDrawn = i; ctx.fillText(lab, padL + i*bw + bw/2, H-padB/2); });
}

const fmtDurS = sec => `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;

function runDetailsModal(r, steps){
  Promise.all(steps.map(async (s,i) => { const it = r.items[s.id]; const u = it ? (it.photoUrl || (it.photoId ? await mediaUrl(it.photoId) : null)) : null; const st = it && it.ok!=null; return `<tr><td class="tnum">${i+1}</td><td>${esc(s.title)||'–'}</td><td class="${st?(it.ok?'ok-n':'nok-n'):''}">${st?(it.ok?'OK':'✗'):'–'}</td><td class="tnum">${it?new Date(it.at).toLocaleTimeString(LOCALE()):''}</td><td>${it&&it.note?esc(it.note):''}${u?`<br><img src="${u}" style="width:80px;border-radius:6px" alt="">`:''}</td></tr>`; }))
    .then(rows2 => modal(`<h2>${esc(r.worker)} · ${fmtDate(r.startedAt)}</h2>${r.title?`<p class="muted" style="margin:0 0 10px">${esc(r.title)} · v${r.version}</p>`:''}<div class="tbl-wrap"><table class="res"><thead><tr><th>#</th><th>${t('step')}</th><th>Status</th><th>Zeit</th><th>${t('nok_note')}</th></tr></thead><tbody>${rows2.join('')}</tbody></table></div><div class="actions"><button class="btn ghost" data-x>${t('close')}</button></div>`, (bg, close) => bg.querySelector('[data-x]').onclick = () => close()));
}

export { barChart, fmtDurS, runDetailsModal };
