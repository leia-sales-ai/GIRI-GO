import { EMOJI_GROUPS, preloadImg } from '../annotations/draw.js';
import { $$, confirmM, esc, modal, toast } from '../core/helpers.js';
import { t } from '../core/i18n.js';
import { G, S } from '../core/state.js';
import { uid } from '../core/storage.js';
import { PUBLIC_MEDIA } from '../core/supabase.js';
import { saveWs } from '../core/workspace.js';
import { IC } from '../ui/icons.js';
import { debounce } from './editor.js';


/* ---------- Emoji picker ---------- */

function emojiPicker(){
  let grp = 0; try{ grp = Math.min(EMOJI_GROUPS.length-1, +(localStorage.getItem('gg_emogrp')||0)); }catch(e){}
  return modal(`<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h2 style="margin:0">${t('tool_emoji')}</h2><input id="emo-q" data-nofocus placeholder="${t('emoji_search')}" style="flex:1;max-width:220px;padding:8px 10px;border:1.5px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);min-width:0"></div><div class="emo-tabs" id="emo-tabs">${EMOJI_GROUPS.map((g,i)=>`<button data-g="${i}" class="${i===grp?'on':''}" title="${G.LANG==='de'?g.de:g.n}">${g.ic}</button>`).join('')}</div><div class="emo-wrap" id="emo-wrap"></div><div class="actions"><button class="btn ghost" data-x>${t('cancel')}</button></div>`, (bg, close) => {
    const wrap = bg.querySelector('#emo-wrap'), q = bg.querySelector('#emo-q');
    const grid = (title, list) => `${title?`<div class="lbl" style="margin:6px 0 4px">${title}</div>`:''}<div class="emo-grid">${list.map(e=>`<button data-e="${e}">${e}</button>`).join('')}</div>`;
    const pick = e => { G.recentEmojis = [e, ...G.recentEmojis.filter(x=>x!==e)].slice(0,16); try{ localStorage.setItem('gg_emo', JSON.stringify(G.recentEmojis)); }catch(x){} close(e); };
    const show = () => { const term = q.value.trim().toLowerCase(); let html = '';
      if(term){ const hits = []; for(const g of EMOJI_GROUPS){ const es = g.e.split(' '), ns = g.s.split('|'); for(let i=0;i<ns.length && hits.length<240;i++) if(ns[i].includes(term)) hits.push(es[i]); } html = hits.length ? grid('', hits) : `<div class="muted" style="padding:10px">–</div>`; }
      else { const g = EMOJI_GROUPS[grp]; html = (G.recentEmojis.length ? grid(t('recent'), G.recentEmojis) : '') + grid(G.LANG==='de'?g.de:g.n, g.e.split(' ')); }
      wrap.innerHTML = html; $$('[data-e]', wrap).forEach(b => b.onclick = () => pick(b.dataset.e)); };
    $$('[data-g]', bg).forEach(b => b.onclick = () => { grp = +b.dataset.g; try{ localStorage.setItem('gg_emogrp', grp); }catch(e){} q.value = ''; $$('[data-g]', bg).forEach(x=>x.classList.toggle('on', x===b)); show(); wrap.scrollTop = 0; });
    q.oninput = () => debounce('emoq', show, 120); show();
    bg.querySelector('[data-x]').onclick = () => close(null); });
}


/* ---------- Custom symbols (workspace library) ---------- */
// file → PNG ≤ 512 px (alpha kept), uploaded to media/<ws>/symbols/<id>.png, entry in workspaces.symbols
async function symbolFromFile(file){
  const img = await new Promise((res, rej) => { const i = new Image(); const u = URL.createObjectURL(file); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('bad')); }; i.src = u; });
  const iw = img.naturalWidth || img.width || 512, ih = img.naturalHeight || img.height || 512; const sc = Math.min(1, 512/Math.max(iw, ih));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(iw*sc)); c.height = Math.max(1, Math.round(ih*sc)); const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, c.width, c.height);
  let alpha = false; try{ const d = ctx.getImageData(0, 0, c.width, c.height).data; for(let i=3; i<d.length; i+=4*7){ if(d[i] < 240){ alpha = true; break; } } }catch(e){}
  const blob = await new Promise(res => c.toBlob(res, 'image/png')); if(!blob) throw new Error('png');
  const id = uid(); const path = `${S.user.ws}/symbols/${id}.png`;
  const up = await G.sb.storage.from('media').upload(path, blob, {contentType:'image/png', upsert:true}); if(up.error) throw up.error;
  const name = (file.name||'Symbol').replace(/\.[a-z0-9]+$/i, '').slice(0, 24);
  return {id, name, url: PUBLIC_MEDIA(path), path, ar: c.width/c.height, alpha, at: Date.now()};
}

// picker: grid of the workspace symbols, "+" tile uploads (several at once), × removes for everyone
function symbolPicker(){
  return modal(`<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:4px"><h2 style="margin:0">${t('sym_title')}</h2><label class="btn sm" style="cursor:pointer">${IC.plus} ${t('sym_upload')}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" multiple hidden id="sym-file"></label></div><p class="muted" style="margin:0 0 10px;font-size:12px">${t('sym_sub')}</p><div class="sym-grid" id="sym-grid"></div><div class="actions"><button class="btn ghost" data-x>${t('cancel')}</button></div>`, (bg, close) => {
    const grid = bg.querySelector('#sym-grid'), inp = bg.querySelector('#sym-file'); let busy = false;
    const show = () => { const syms = S.wsRow.symbols||[];
      grid.innerHTML = `<button class="sym add" id="sym-add" title="${t('sym_upload')}">${IC.plus}<span>${t('sym_upload')}</span></button>` + syms.map(sy => `<button class="sym" data-id="${sy.id}" title="${esc(sy.name||'')}"><img src="${esc(sy.url)}" alt=""><span>${esc(sy.name||'')}</span><i class="x" data-x-id="${sy.id}" title="${t('delete')}">×</i></button>`).join('') + (syms.length ? '' : `<div class="muted" style="grid-column:2/-1;align-self:center;font-size:12px">${t('sym_empty')}</div>`);
      grid.querySelector('#sym-add').onclick = () => inp.click();
      $$('[data-id]', grid).forEach(b => b.onclick = async e => { const xid = e.target.dataset && e.target.dataset.xId; const sy = (S.wsRow.symbols||[]).find(x=>x.id===b.dataset.id); if(!sy) return;
        if(xid){ if(!(await confirmM(t('sym_del_q',{n:sy.name||''})))) return; await saveWs({symbols:(S.wsRow.symbols||[]).filter(x=>x.id!==xid)}); if(sy.path) G.sb.storage.from('media').remove([sy.path]).catch(()=>{}); show(); return; }
        close(sy); }); };
    inp.onchange = async () => { const files = [...inp.files].filter(f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|svg|gif)$/i.test(f.name)); inp.value = ''; if(!files.length || busy) return; busy = true; const add = bg.querySelector('#sym-add'); if(add) add.disabled = true; const added = [];
      for(const f of files){ try{ added.push(await symbolFromFile(f)); }catch(e){ toast(t('sym_bad',{n:f.name})); } }
      if(added.length){ try{ await saveWs({symbols:[...(S.wsRow.symbols||[]), ...added]}); added.forEach(sy => preloadImg(sy.url)); }catch(e){} }
      busy = false; show(); if(added.length===1 && files.length===1) close(added[0]); };
    show(); bg.querySelector('[data-x]').onclick = () => close(null); });
}

export { emojiPicker, symbolFromFile, symbolPicker };
