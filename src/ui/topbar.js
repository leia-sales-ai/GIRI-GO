import { doInstall, isIOS, isStandalone } from '../app/pwa.js';
import { go, render } from '../app/router.js';
import { APP_VERSION } from '../core/config.js';
import { el, esc, modal, toast } from '../core/helpers.js';
import { I18N, langMenu, loadUiLang, t } from '../core/i18n.js';
import { G, S } from '../core/state.js';
import { FLAGS } from '../core/translate.js';
import { IC } from './icons.js';
import { initials, roleLbl } from '../views/dashboard.js';


/* ---------- Top bar ---------- */
function topbar(app, opts={}){
  const tb = el(`<header class="topbar">
    ${opts.back ? `<button class="tb-btn" data-back aria-label="back">${IC.back}</button>` : ''}
    <div class="brand"><span class="logo" role="img" aria-label="GIRI"></span><span class="wordmark">GIRI</span><span class="go">GO</span>${opts.sub ? `<small>${esc(opts.sub)}</small>`:''}<small class="ver">v${APP_VERSION}</small></div>
    <div class="spacer"></div>
    <button class="tb-btn" data-lang title="${t('language')}">${FLAGS[G.LANG.toUpperCase()]||''} ${G.LANG.toUpperCase()}</button>
    ${S.user && S.user.isAdmin ? `<a class="tb-btn" href="#/admin" title="${t('admin')}">${IC.gear}</a>` : ''}
    ${S.user ? `<button class="tb-btn tb-user" data-profile title="${esc(S.user.name)} · ${roleLbl(S.user.role)}"><span class="avatar">${esc(initials(S.user.name))}</span><span class="tb-name">${esc(S.user.name.split(' ')[0])}</span></button>` : ''}
  </header>`);
  tb.querySelector('[data-lang]').onclick = () => langMenu(async l => { const ll = l.toLowerCase(); if(!I18N[ll]) toast(t('translating')); if(!(await loadUiLang(ll))) return; G.LANG = ll; try{localStorage.setItem('gg_lang', G.LANG);}catch(e){} render(); });
  if(opts.back) tb.querySelector('[data-back]').onclick = () => go(opts.back);
  const lo = tb.querySelector('[data-logout]'); if(lo) lo.onclick = async () => { await G.sb.auth.signOut(); S.user = null; S.session = null; if(G.rtChannel){ G.sb.removeChannel(G.rtChannel); G.rtChannel = null; } go(''); render(); };
  const pf = tb.querySelector('[data-profile]'); if(pf) pf.onclick = profileModal;
  app.appendChild(tb);
}

async function profileModal(){
  const r = await modal(`<div class="me"><span class="avatar big">${esc(initials(S.user.name))}</span><div><b>${esc(S.user.name)}</b><span>${esc(S.user.email||'')}</span><span class="chip dot published" style="margin-top:6px">${roleLbl(S.user.role)}</span></div></div><div class="field"><label for="pf-name">${t('name')}</label><input id="pf-name" value="${esc(S.user.name)}"></div><p class="muted">${t('role_note2')}</p><p class="muted" style="margin-top:8px;opacity:.7">GIRI Go v${APP_VERSION} · ${esc(S.user.ws)}</p><div class="row" style="gap:6px;flex-wrap:wrap">${S.user.isAdmin?`<a class="btn ghost sm" href="#/admin" data-adm>${t('admin')}</a>`:''}${isStandalone()?'':`<button class="btn ghost sm" data-install ${(!G.installPrompt && !isIOS())?'hidden':''}>📲 ${t('install_app')}</button>`}</div><div class="actions"><button class="btn ghost" data-logout2 style="margin-right:auto">${t('logout')}</button><button class="btn ghost" data-x>${t('cancel')}</button><button class="btn" data-ok>${t('save')}</button></div>`, (bg, close) => {
    bg.querySelector('[data-logout2]').onclick = async () => { close(null); await G.sb.auth.signOut(); S.user = null; S.session = null; if(G.rtChannel){ G.sb.removeChannel(G.rtChannel); G.rtChannel = null; } go(''); render(); };
    const adm = bg.querySelector('[data-adm]'); if(adm) adm.onclick = () => close(null);
    const ib = bg.querySelector('[data-install]'); if(ib) ib.onclick = () => { close(null); doInstall(); };
    bg.querySelector('[data-x]').onclick = () => close(null); bg.querySelector('[data-ok]').onclick = () => close({name: bg.querySelector('#pf-name').value.trim()}); });
  if(!r) return; const {error} = await G.sb.from('profiles').update({name:r.name||S.user.name}).eq('id', S.user.id); if(error){ toast(error.message); return; }
  S.user.name = r.name||S.user.name; toast(t('saved')); render();
}

export { topbar, profileModal };
