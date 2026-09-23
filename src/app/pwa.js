import { render } from './router.js';
import { loadProfile } from '../core/auth.js';
import { APP_VERSION } from '../core/config.js';
import { $, $$, el, toast } from '../core/helpers.js';
import { t } from '../core/i18n.js';
import { G, S } from '../core/state.js';

/* ---------- PWA: service worker + install ---------- */

const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints > 1);

async function doInstall(){ if(!G.installPrompt){ if(isIOS()) toast(t('install_ios')); return false; } G.installPrompt.prompt(); const r = await G.installPrompt.userChoice.catch(() => null); G.installPrompt = null; return !!(r && r.outcome==='accepted'); }

function installNote(){ // dashboard card, once per device, never inside the installed app
  if(isStandalone()) return null; try{ if(localStorage.getItem('gg_inst_dismissed')) return null; }catch(e){}
  const ios = isIOS(); const n = el(`<div class="card inst-note" id="inst-note" ${(!G.installPrompt && !ios)?'hidden':''}><span class="big">📲</span><div><b>${t('install_app')}</b><div class="muted">${ios ? t('install_ios') : t('install_sub')}</div></div><div class="row">${ios?'':`<button class="btn sm" data-install>${t('install_app')}</button>`}<button class="btn ghost sm" data-later>${t('later')}</button></div></div>`);
  const ib = n.querySelector('[data-install]'); if(ib) ib.onclick = doInstall;
  n.querySelector('[data-later]').onclick = () => { try{ localStorage.setItem('gg_inst_dismissed', '1'); }catch(e){} n.remove(); };
  return n;
}

/* ---------- Update check (GitHub Pages / Safari cache) ---------- */
 // busyCheck: set by viewer/editor while work is in progress
const reloadForUpdate = () => { const v = G.pendingUpdate; if(!v) return; try{ if(navigator.serviceWorker && navigator.serviceWorker.controller) caches.keys().then(ks => ks.forEach(k => caches.delete(k))); }catch(e){} location.replace(location.pathname + '?v=' + v + location.hash); };

const updateSafe = () => { const view = location.hash.replace(/^#\/?/, '').split('/')[0]; if(!S.user && view!=='v') return true; if(['', 'p', 'admin', 'stats', 'results'].includes(view)) return true; return !!(G.busyCheck && !G.busyCheck()); };

function applyUpdateIfSafe(){ if(G.pendingUpdate && updateSafe()) reloadForUpdate(); }

async function checkUpdate(force){
  if(!force && Date.now() - G.lastUpdCheck < 60000) return; G.lastUpdCheck = Date.now();
  try{ const r = await fetch(location.pathname.endsWith('/') ? location.pathname+'index.html' : location.pathname, {cache:'no-store'}); const txt = await r.text(); const m = /APP_VERSION = '([^']+)'/.exec(txt); if(!m || m[1]===APP_VERSION) return;
    G.pendingUpdate = m[1]; if(updateSafe()){ reloadForUpdate(); return; }
    if($('#upd-note')) return; const n = el(`<div class="sync show" id="upd-note" style="pointer-events:auto;cursor:pointer;background:var(--blue)">${t('update_avail',{v:m[1]})}</div>`); n.onclick = reloadForUpdate; document.body.appendChild(n);
  }catch(e){}
}

// installed app: iOS/Android keep the page alive for days – re-check whenever it comes back to the front

// magic link opened in the browser next to the installed app (Android/desktop share the storage): pick the session up without a reload

async function pickupSession(){ if(!G.sb || S.user || G.pickingUp || !G.authReady) return; G.pickingUp = true; try{ const {data:{session}} = await G.sb.auth.getSession(); if(session){ await loadProfile(); if(S.user) render(); } }catch(e){} G.pickingUp = false; }

export { isStandalone, isIOS, doInstall, installNote, reloadForUpdate, updateSafe, applyUpdateIfSafe, checkUpdate, pickupSession };
