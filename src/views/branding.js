import { $$, esc, modal, toast } from '../core/helpers.js';
import { t } from '../core/i18n.js';
import { G, S, loadBrand, saveBrand } from '../core/state.js';
import { PUBLIC_MEDIA } from '../core/supabase.js';
import { IC } from '../ui/icons.js';


/* ---------- Branding (white label for viewer + PDF) ---------- */
async function brandModal(){
  await loadBrand(S.user.ws); const b = Object.assign({}, S.brand); const PRESETS = ['#004EAD','#012756','#0EA5E9','#0891B2','#03D39B','#15803D','#06513D','#84CC16','#FFD23F','#F5A524','#F97316','#DC2626','#E11D48','#7C3AED','#000000','#525252'];
  await modal(`<h2>${t('branding')}</h2><p class="muted" style="margin:0 0 14px">${t('branding_sub')}</p>
    <div class="field"><label for="br-name">${t('brand_name')}</label><input id="br-name" value="${esc(b.name||'')}" placeholder="${esc(S.user.ws)}"></div>
    <div class="lbl" style="margin-bottom:6px">${t('brand_color')}</div><div class="pal" id="br-colors">${PRESETS.map(c=>`<button class="sw ${c.toLowerCase()===(b.color||'').toLowerCase()?'on':''}" data-c="${c}" style="background:${c}"></button>`).join('')}</div>
    <div class="lbl" style="margin-bottom:6px">${t('brand_logo')}</div><div class="row" style="margin-bottom:14px"><div id="br-logo" class="logo-prev">${b.logo?`<img src="${esc(b.logo)}" alt="">`:`<span class="muted">${t('brand_nologo')}</span>`}</div><label class="btn ghost sm" style="cursor:pointer">${IC.upload} ${t('upload')}<input type="file" accept="image/png,image/jpeg,image/svg+xml" hidden id="br-file"></label>${b.logo?`<button class="btn ghost sm" id="br-rmlogo">${t('remove')}</button>`:''}</div>
    <div class="lbl" style="margin-bottom:6px">${t('brand_theme')}</div><div class="tabs" id="br-theme"><button data-th="dark" class="${b.theme!=='light'?'on':''}">${t('theme_dark')}</button><button data-th="light" class="${b.theme==='light'?'on':''}">${t('theme_light')}</button></div>
    <div class="actions"><button class="btn ghost" data-x>${t('cancel')}</button><button class="btn" data-ok>${t('save')}</button></div>`, (bg, close) => {
    $$('#br-colors .sw', bg).forEach(x => x.onclick = () => { b.color = x.dataset.c; $$('#br-colors .sw', bg).forEach(y=>y.classList.toggle('on', y===x)); });
    $$('#br-theme button', bg).forEach(x => x.onclick = () => { b.theme = x.dataset.th; $$('#br-theme button', bg).forEach(y=>y.classList.toggle('on', y===x)); });
    bg.querySelector('#br-file').onchange = async e => { const f = e.target.files[0]; if(!f) return; const ext = f.type.includes('svg')?'svg':f.type.includes('png')?'png':'jpg'; const path = `${S.user.ws}/brand/logo-${Date.now()}.${ext}`; const up = await G.sb.storage.from('media').upload(path, f, {contentType:f.type}); if(up.error){ toast(up.error.message); return; } b.logo = PUBLIC_MEDIA(path); bg.querySelector('#br-logo').innerHTML = `<img src="${esc(b.logo)}" alt="">`; };
    const rm = bg.querySelector('#br-rmlogo'); if(rm) rm.onclick = () => { b.logo = null; bg.querySelector('#br-logo').innerHTML = `<span class="muted">${t('brand_nologo')}</span>`; };
    bg.querySelector('[data-x]').onclick = () => close(null);
    bg.querySelector('[data-ok]').onclick = async () => { b.name = bg.querySelector('#br-name').value.trim(); try{ await saveBrand(b); toast(t('saved')); close(true); }catch(err){ toast(err.message); } };
  });
}

export { brandModal };
