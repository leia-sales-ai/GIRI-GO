import { renderTrash } from '../views/trash.js';
import { reloadForUpdate, updateSafe } from './pwa.js';
import { ensureSeed } from './seed.js';
import { loadProfile } from '../core/auth.js';
import { $, el, toast } from '../core/helpers.js';
import { IC } from '../ui/icons.js';
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

// another device changed the instruction that is open here: refresh right away when nothing is being typed, otherwise show a banner
function remoteChanged(row){
  const cur = S.instrs.find(i => i.id===row.id); const remoteAt = row.updated_at ? Date.parse(row.updated_at) : 0;
  if(cur && remoteAt && remoteAt <= (cur.updatedAt||0)) return;
  const typing = document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) && !document.activeElement.readOnly;
  if(!typing && G.saving===0 && (!G.busyCheck || !G.busyCheck())){ render(); toast(t('remote_refreshed')); return; }
  if($('#rt-note')) return; const n = el(`<div class="rt-banner" id="rt-note">${IC.refresh||''}<span>${t('remote_changed')}</span><button class="btn sm">${t('refresh_now')}</button></div>`); n.querySelector('button').onclick = () => { n.remove(); render(); }; document.body.appendChild(n);
}
// when the tab comes back to the front: has the open instruction moved on elsewhere? (websockets often die in background tabs)
async function refreshIfStale(){
  if(!G.sb || !S.user) return; const h = location.hash.replace(/^#\/?/, ''); const [view, id] = h.split('/');
  if(!view || ['p','trash','results','stats','admin'].includes(view)){ try{ await loadInstrs(); }catch(e){} render(); return; }
  if((view==='edit'||view==='rec') && id){ try{ const {data} = await G.sb.from('instructions').select('id, updated_at').eq('id', id).maybeSingle(); if(data) remoteChanged(data); }catch(e){} }
}
function ensureRealtime(){
  if(!G.sb || !S.user || G.rtChannel) return;
  G.rtChannel = G.sb.channel('instr-'+S.user.ws).on('postgres_changes', {event:'*', schema:'public', table:'instructions', filter:'ws=eq.'+S.user.ws}, payload => {
    if(G.saving>0) return; // eigene Schreibvorgänge ignorieren
    if(payload.new && payload.new.updated_at && ownWrites.has(Date.parse(payload.new.updated_at))) return;
    const h = location.hash.replace(/^#\/?/, ''); const [view, id] = h.split('/');
    if(!view || ['p','trash','results','stats','admin'].includes(view)){ debounce('rt', render, 300); }
    else if((view==='edit'||view==='rec') && payload.new && payload.new.id===id){ debounce('rt', () => remoteChanged(payload.new), 500); }
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
  if(view === 'trash') return renderTrash(app);
  if(view === 'admin') return renderAdmin(app);
  return renderDashboard(app);
}

export { remoteChanged, refreshIfStale, go, ensureRealtime, render };
