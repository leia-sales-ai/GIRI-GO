import { reloadForUpdate, updateSafe } from './pwa.js';
import { ensureSeed } from './seed.js';
import { loadProfile } from '../core/auth.js';
import { $, el } from '../core/helpers.js';
import { I18N, loadUiLang, t } from '../core/i18n.js';
import { ownWrites } from '../core/passwords.js';
import { G, S } from '../core/state.js';
import { loadInstrs } from '../core/translate.js';
import { runUploads } from '../core/uploads.js';
import { loadWs } from '../core/workspace.js';
import { renderAdmin } from '../views/admin.js';
import { renderCapture } from '../views/capture.js';
import { renderDashboard } from '../views/dashboard.js';
import { debounce, renderEditor } from '../views/editor.js';
import { renderLogin } from '../views/login.js';
import { renderResults } from '../views/results.js';
import { renderGlobalStats } from '../views/stats.js';
import { renderViewer } from '../views/viewer.js';


/* ---------- Router ---------- */
const go = h => { location.hash = h; };

function ensureRealtime(){
  if(!G.sb || !S.user || G.rtChannel) return;
  G.rtChannel = G.sb.channel('instr-'+S.user.ws).on('postgres_changes', {event:'*', schema:'public', table:'instructions', filter:'ws=eq.'+S.user.ws}, payload => {
    if(G.saving>0) return; // eigene Schreibvorgänge ignorieren
    if(payload.new && payload.new.updated_at && ownWrites.has(Date.parse(payload.new.updated_at))) return;
    const h = location.hash.replace(/^#\/?/, ''); const [view, id] = h.split('/');
    if(!view || view===''){ debounce('rt', render, 300); }
    else if((view==='edit'||view==='rec') && payload.new && payload.new.id===id){ debounce('rt', () => { if(!$('#rt-note')){ const n = el(`<div class="sync show" id="rt-note" style="pointer-events:auto;cursor:pointer">${t('remote_changed')}</div>`); n.onclick = () => render(); document.body.appendChild(n); setTimeout(()=>n.remove(), 8000); } }, 500); }
  }).subscribe();
}

async function render(){
  if(G.pdfBusy){ G.renderAfterPdf = true; return; }
  const seq = ++G.renderSeq; const stale = () => seq !== G.renderSeq;
  if(G.activeCleanup){ try{ G.activeCleanup(); }catch(e){} G.activeCleanup = null; }
  const h = location.hash.replace(/^#\/?/, '');
  const [view, id, extra, extra2] = h.split('/');
  const app = $('#app'); G.busyCheck = null; if(G.pendingUpdate && updateSafe()){ reloadForUpdate(); return; }
  if(!G.sb){ app.innerHTML = `<main class="page page-narrow"><div class="card empty"><h2>GIRI Go</h2><div>${t('loading_backend')}</div><br><button class="btn" onclick="location.reload()">${t('reload')}</button></div></main>`; return; }
  if(!I18N[G.LANG]){ app.innerHTML = `<div class="loading"><div class="spin"></div></div>`; const ok = await loadUiLang(G.LANG); if(stale()) return; if(!ok) G.LANG = 'en'; }
  if(view === 'v' && id){ app.innerHTML = ''; return renderViewer(app, id, false, extra, extra2); }
  if(!G.authReady){ app.innerHTML = `<div class="loading"><div class="spin"></div></div>`; await loadProfile(); if(stale()) return; G.authReady = true; }
  app.innerHTML = '';
  if(!S.user){ return renderLogin(app); }
  ensureRealtime(); runUploads();
  app.innerHTML = `<div class="loading"><div class="spin"></div></div>`;
  await loadInstrs(); if(stale()) return;
  if(!S.instrs.length && S.user.role!=='viewer'){ await ensureSeed(); await loadInstrs(); if(stale()) return; }
  app.innerHTML = '';
  await loadWs(view==='' || view==='admin' || view==='p'); if(stale()) return;
  if(view === 'rec' && id) return renderCapture(app, id, extra, extra2);
  if(view === 'edit' && id) return renderEditor(app, id, extra, extra2);
  if(view === 'preview' && id) return renderViewer(app, id, true, extra, extra2);
  if(view === 'results' && id) return renderResults(app, id);
  if(view === 'p' && id) return renderDashboard(app, id);
  if(view === 'stats') return renderGlobalStats(app);
  if(view === 'admin') return renderAdmin(app);
  return renderDashboard(app);
}

export { go, ensureRealtime, render };
