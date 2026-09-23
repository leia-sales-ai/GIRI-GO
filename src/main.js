import './styles/index.css';
import { checkUpdate, pickupSession } from './app/pwa.js';
import { render } from './app/router.js';
import { $, $$, toast } from './core/helpers.js';
import { UI_LANGS, t } from './core/i18n.js';
import { BRAND_DEFAULT, G, S } from './core/state.js';
import { initSb } from './core/supabase.js';
import { runUploads } from './core/uploads.js';

// from core/i18n
try{ const st = localStorage.getItem('gg_lang'); const nav = (navigator.language||'de').slice(0,2).toLowerCase(); G.LANG = UI_LANGS.includes(st) ? st : (UI_LANGS.includes(nav) ? nav : 'en'); }catch(e){}

// from core/state
S.brand = Object.assign({}, BRAND_DEFAULT);

// from core/workspace
S.wsRow = {folders:[], teams:[], invites:[], symbols:[]};

// from core/uploads
window.addEventListener('online', () => runUploads());

// from app/router
window.addEventListener('hashchange', () => { if(/^#(access_token|error|refresh_token)/.test(location.hash) || location.hash.includes('access_token=')) return; render(); });

// from views/login
initSb();

// from views/symbols
try{ G.recentEmojis = JSON.parse(localStorage.getItem('gg_emo')||'[]'); }catch(e){}

// from pdf/export
window.addEventListener('error', e => { try{ toast('JS: '+(e.message||'').slice(0,120)); }catch(x){} });

// from pdf/export
window.addEventListener('unhandledrejection', e => { try{ const m = e.reason && (e.reason.message||String(e.reason)); if(m && !/AbortError|play\(\)/.test(m)) toast('Fehler: '+m.slice(0,120)); }catch(x){} });

// from app/pwa
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); G.installPrompt = e; $$('[data-install]').forEach(b => b.hidden = false); const n = $('#inst-note'); if(n) n.hidden = false; });

// from app/pwa
window.addEventListener('appinstalled', () => { G.installPrompt = null; toast(t('install_done')); const n = $('#inst-note'); if(n) n.remove(); });

// from app/pwa
if('serviceWorker' in navigator && /^https:/.test(location.protocol)){ window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {})); }

// from app/pwa
setTimeout(() => checkUpdate(true), 2500);

// from app/pwa
setInterval(() => checkUpdate(false), 30*60000);

// from app/pwa
document.addEventListener('visibilitychange', () => { if(document.visibilityState==='visible'){ checkUpdate(false); pickupSession(); } });

// from app/pwa
window.addEventListener('pageshow', e => { if(e.persisted){ checkUpdate(true); pickupSession(); } });

// from app/pwa
window.addEventListener('focus', () => pickupSession());

// from app/pwa
window.addEventListener('storage', e => { if(e.key && /^sb-/.test(e.key)) pickupSession(); });

/* ---------- Boot ---------- */

// from main
(function boot(){
  if(initSb()){ render(); return; }
  render();
  const tryLoad = (src, next) => { const sc = document.createElement('script'); sc.src = src; sc.onload = () => { if(initSb()) render(); else next(); }; sc.onerror = next; document.head.appendChild(sc); };
  tryLoad('https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js', () => tryLoad('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js', () => {}));
})();
