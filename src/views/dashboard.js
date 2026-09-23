import { trashInstr } from '../core/trash.js';
import { installNote } from '../app/pwa.js';
import { go, render } from '../app/router.js';
import { realSteps } from '../core/auth.js';
import { $$, confirmM, el, esc, modal, promptM, toast } from '../core/helpers.js';
import { fmtDate, t } from '../core/i18n.js';
import { deleteInstr, pwDialog, saveInstr } from '../core/passwords.js';
import { titleHtml } from '../core/richtext.js';
import { G, S, mediaUrl } from '../core/state.js';
import { uid } from '../core/storage.js';
import { canSee, effRole, folderName, saveWs, teamsOf } from '../core/workspace.js';
import { posterDialog } from '../pdf/poster.js';
import { IC } from '../ui/icons.js';
import { topbar } from '../ui/topbar.js';
import { brandModal } from './branding.js';
import { exportPDFAsk, shareModal } from './share.js';


/* ---------- Dashboard ---------- */
const roleLbl = r => r==='admin' ? t('role_admin') : r==='reviewer' ? t('approver') : t(r||'viewer');

const nOf = (n, one, many) => `${n} ${t(n===1 ? one : many)}`;

const initials = n => String(n||'?').trim().split(/\s+/).slice(0,2).map(x => x[0]||'').join('').toUpperCase() || '?';

const visFolders = () => (S.wsRow.folders||[]).filter(f => S.user.isAdmin || !(f.teams||[]).length || teamsOf().some(tm => (f.teams||[]).includes(tm.id)));

const isLoose = i => !i.folder || !(S.wsRow.folders||[]).find(f=>f.id===i.folder);

async function newFolderDlg(){ const name = await promptM(t('new_folder'), t('folder_ph'), ''); if(!name || !name.trim()) return null; const f = {id:uid(), name:name.trim(), teams:[]}; await saveWs({folders:[...(S.wsRow.folders||[]), f]}); return f; }

async function newInstrDlg(folderId){ const title = await promptM(t('new_instr'), t('new_title_ph'), ''); if(title===null) return; const i = {id:uid(), ws:S.user.ws, title:(title.trim()||t('untitled')), createdBy:S.user.name, createdAt:Date.now(), updatedAt:Date.now(), status:'draft', version:0, approvals:{tech:null,dsgvo:null}, checklist:false, steps:[], history:[]}; if(folderId && folderId!=='none') i.folder = folderId; await saveInstr(i); go('rec/'+i.id); }

async function moveToFolderDlg(i, after){
  const r = await modal(`<h2>${t('move_to')}</h2><div class="menu">${visFolders().map(f => `<button data-fid="${f.id}" class="${i.folder===f.id?'cur':''}">${IC.folder} ${esc(f.name)}</button>`).join('')}<button data-fid="" class="${isLoose(i)?'cur':''}">${t('no_folder')}</button><button data-fid="__new">${IC.plus} ${t('new_folder')}</button></div><div class="actions"><button class="btn ghost" data-x>${t('cancel')}</button></div>`, (bg, close) => { $$('[data-fid]', bg).forEach(b => b.onclick = () => close(b.dataset.fid)); bg.querySelector('[data-x]').onclick = () => close(null); });
  if(r===null) return; let fid = r; if(r==='__new'){ const f = await newFolderDlg(); if(!f) return; fid = f.id; }
  i.folder = fid || undefined; await saveInstr(i); toast(t('saved')); if(after) after();
}

// one instruction card (dashboard "all" view + project page)
function instrCard(i, statMap, opts={}){
  const st = realSteps(i); const first = st[0]; const role = effRole(i); const fname = opts.showFolder ? folderName(i.folder) : '';
  const card = el(`<article class="card instr">
    <img class="thumb" alt="" src="">
    <div><div class="title">${titleHtml(i.title)} ${i.example?`<span class="example-tag">${t('example')}</span>`:''}</div>
      <div class="meta"><span class="chip dot ${i.status}">${t(i.status==='review'?'in_review':i.status)}</span>${fname?`<span class="fold">${IC.folder} ${esc(fname)}</span>`:''}${(i.teams||[]).length?`<span class="fold" title="${t('teams')}">👥 ${esc((i.teams||[]).map(tid => ((S.wsRow.teams||[]).find(x=>x.id===tid)||{}).name).filter(Boolean).join(', '))}</span>`:''}<span class="tnum">${nOf(st.length,'step','steps')}</span><span>v${i.version}</span><span>${t('updated')} ${fmtDate(i.updatedAt)}</span>${i.checklist?`<span>☑ ${G.LANG==='de'?'Checkliste':'Checklist'}</span>`:''}${statMap[i.id] && statMap[i.id].views?`<span title="${t('views_total')}">${IC.eye} ${statMap[i.id].views}</span>`:''}${statMap[i.id] && statMap[i.id].fb?`<button class="fbchip" data-a="feedback" title="${t('feedback')}">${IC.msg} ${statMap[i.id].fb}</button>`:''}${Object.keys(i.translations||{}).length?`<span title="${t('translations')}">${IC.globe} ${Object.keys(i.translations).length}</span>`:''}</div>
      <div class="acts">${role!=='viewer' ? `<button class="btn" data-a="edit">${IC.edit} ${t('edit')}</button><button class="btn mint" data-a="rec">${IC.cam} ${t('record_next')}</button>`:`<button class="btn" data-a="preview">${IC.play} ${t('preview')}</button>`}<button class="btn ghost" data-a="share">${IC.share} ${t('share')}</button><button class="btn ghost icon" data-a="more" title="${t('more')}">${IC.more}</button></div></div></article>`);
  if(first) stepPoster(first).then(u => { if(u) card.querySelector('.thumb').src = u; });
  card.onclick = async e => { let b = e.target.closest('[data-a]'); if(!b){ if(e.target.closest('a, button')) return; b = {dataset:{a: role!=='viewer' ? 'edit' : 'preview'}}; } const a = b.dataset.a;
    const act = async a => {
      if(a==='rec') go('rec/'+i.id); else if(a==='edit') go('edit/'+i.id); else if(a==='preview') go('preview/'+i.id); else if(a==='share') shareModal(i); else if(a==='pdf') exportPDFAsk(i); else if(a==='results') go('results/'+i.id); else if(a==='folder') moveToFolderDlg(i, opts.onChange);
      else if(a==='feedback'){ try{ sessionStorage.setItem('gg_rtab_'+i.id, 'feedback'); }catch(e){} go('results/'+i.id); }
      else if(a==='del'){ if(await confirmM(t('confirm_del_instr',{t:i.title}), t('delete'))){ try{ await trashInstr(i); toast(t('trashed_instr')); }catch(e){ toast(e.message||String(e)); } render(); } } };
    if(a==='more'){ modal(`<div class="menu"><button data-m="preview">${IC.play} ${t('preview')}</button><button data-m="pdf">${IC.pdf} ${t('pdf')}</button><button data-m="results">${IC.eye} ${t('stats')}</button>${role!=='viewer' ? `<button data-m="folder">${IC.folder} ${t('move_to_folder')}</button><button data-m="del" class="del">${IC.trash} ${t('delete')}</button>`:''}</div>`, (bg, close) => { $$('[data-m]', bg).forEach(b => b.onclick = () => { close(); act(b.dataset.m); }); }); return; }
    act(a); };
  return card;
}

/* ---------- Dashboard: projects overview (#/), project page (#/p/<id>), flat list ---------- */
async function renderDashboard(app, pid){
  topbar(app, {back: pid ? '/' : null, sub: S.user.ws});
  const visible = S.instrs.filter(canSee); const hiddenN = S.instrs.length - visible.length;
  const isEditor = S.user.role!=='viewer' || S.user.isAdmin;
  const folders = visFolders();
  let statMap = {}; try{ const {data} = await G.sb.from('instr_stats').select('*').eq('ws', S.user.ws); (data||[]).forEach(r => statMap[r.instr_id] = r); }catch(e){}
  try{ const {data} = await G.sb.from('feedback').select('instr_id,status').eq('ws', S.user.ws).eq('status', 'open'); (data||[]).forEach(r => { statMap[r.instr_id] = statMap[r.instr_id] || {views:0}; statMap[r.instr_id].fb = (statMap[r.instr_id].fb||0)+1; }); }catch(e){}
  const inProject = (i, id) => id==='none' ? isLoose(i) : i.folder===id;
  const fmtCounts = rows => { const pub = rows.filter(i=>i.status==='published').length, rev = rows.filter(i=>i.status==='review').length, dr = rows.length-pub-rev; return `${pub?`<span class="pc pub">${pub} ${t('published')}</span>`:''}${rev?`<span class="pc rev">${rev} ${t('in_review')}</span>`:''}${dr?`<span class="pc dr">${dr} ${t('draft')}</span>`:''}`; };
  // ---- project page ----
  if(pid){
    const f = pid==='none' ? {id:'none', name:t('no_folder'), teams:[]} : folders.find(x=>x.id===pid); if(!f) return go('');
    const rows = visible.filter(i => inProject(i, pid)); const teamNames = (f.teams||[]).map(tid => ((S.wsRow.teams||[]).find(x=>x.id===tid)||{}).name).filter(Boolean);
    const v = el(`<main class="page">
      <div class="crumbs"><a href="#/">${IC.folder} ${t('folders')}</a><span>›</span><b>${esc(f.name)}</b></div>
      <div class="dash-head"><div><h1 class="row" style="gap:8px">${esc(f.name)}${pid!=='none'&&isEditor?`<button class="pen-btn" id="fren" title="${t('rename_folder')}">${IC.edit}</button>`:''}</h1><div class="sub">${nOf(rows.length,'instruction','instructions')}${teamNames.length?` · ${t('teams')}: ${esc(teamNames.join(', '))}`:(pid!=='none'?` · ${t('all_ws')}`:'')}${f.pw?` · 🔒 ${t('link_pw_on')}`:''}</div></div>
        <div class="row">${isEditor ? `<button class="btn mint" id="new">${IC.plus} ${t('new_instr')}</button>`:''}<button class="btn ghost sm" id="fposter" title="${t('poster')}">${IC.qr} ${t('poster_short')}</button>${pid!=='none'&&isEditor?`<button class="btn ghost icon" id="fmore" title="${t('more')}">${IC.more}</button>`:''}</div></div>
      <div class="list" id="list"></div></main>`);
    const list = v.querySelector('#list');
    if(!rows.length) list.innerHTML = `<div class="card empty"><h2>${t('empty_title')}</h2><div>${t('empty_project')}</div></div>`;
    rows.forEach(i => list.appendChild(instrCard(i, statMap, {onChange: render})));
    const nb = v.querySelector('#new'); if(nb) nb.onclick = () => newInstrDlg(pid);
    const doRename = async () => { const n = await promptM(t('rename_folder'), t('folder_ph'), f.name); if(!n || !n.trim()) return; f.name = n.trim(); await saveWs({folders:S.wsRow.folders}); render(); };
    const doPw = async () => { const r = await pwDialog(f.name, !!f.pw); if(r===undefined) return; if(r) f.pw = r; else delete f.pw; await saveWs({folders:S.wsRow.folders}); toast(t('saved')); render(); };
    const doDel = async () => { if(!(await confirmM(t('del_folder_q',{t:f.name})))) return; await saveWs({folders:(S.wsRow.folders||[]).filter(x=>x.id!==f.id)}); go(''); };
    const rn = v.querySelector('#fren'); if(rn) rn.onclick = doRename;
    v.querySelector('#fposter').onclick = () => posterDialog(f, rows);
    const fm = v.querySelector('#fmore'); if(fm) fm.onclick = () => modal(`<div class="menu"><button data-m="poster">${IC.qr} ${t('poster')}</button><button data-m="rename">${IC.edit} ${t('rename_folder')}</button><button data-m="pw">${f.pw?'🔒':'🔓'} ${t('link_pw')}</button><button data-m="del" class="del">${IC.trash} ${t('del_folder')}</button></div>`, (bg, close) => { $$('[data-m]', bg).forEach(b => b.onclick = () => { close(); const m = b.dataset.m; if(m==='poster') posterDialog(f, rows); else if(m==='rename') doRename(); else if(m==='pw') doPw(); else doDel(); }); });
    app.appendChild(v); return;
  }
  // ---- overview ----
  let mode = 'projects'; try{ mode = sessionStorage.getItem('gg_dash') || 'projects'; }catch(e){}
  const pub = visible.filter(i=>i.status==='published').length, rev = visible.filter(i=>i.status==='review').length;
  const v = el(`<main class="page">
    <div class="dash-head"><div><h1>${t('instructions')}</h1><div class="sub">${esc(S.user.name)} · ${roleLbl(S.user.role)} · ${esc(S.user.ws)}</div></div>
      <div class="row"><button class="btn ghost sm" id="gstats">${IC.eye} ${t('global_stats')}</button><a class="btn ghost sm" href="#/trash" title="${t('trash')}">${IC.trash} ${t('trash')}</a>${S.user.isAdmin?`<button class="btn ghost sm" id="admin">${IC.gear} ${t('admin')}</button>`:''}${isEditor ? `<button class="btn ghost sm" id="brand">${IC.brand} ${t('branding')}</button><button class="btn mint" id="new">${IC.plus} ${t('new_instr')}</button>`:''}</div></div>
    <div class="kpis"><div class="kpi"><b class="tnum">${visible.length}</b><span>${t('instructions')}</span></div><div class="kpi"><b class="tnum">${folders.length}</b><span>${t('folders')}</span></div><div class="kpi"><b class="tnum">${pub}</b><span>${t('published')}</span></div><div class="kpi ${rev?'hot':''}"><b class="tnum">${rev}</b><span>${t('in_review')}</span></div></div>
    <div id="inst-slot"></div>
    <div class="tabs" id="dtabs"><button data-m="projects" class="${mode==='projects'?'on':''}">${IC.folder} ${t('folders')}</button><button data-m="all" class="${mode==='all'?'on':''}">${t('all_instr')} <span class="tnum cnt">${visible.length}</span></button></div>
    <div class="pgrid" id="pgrid" ${mode!=='projects'?'hidden':''}></div>
    <div class="list" id="list" ${mode!=='all'?'hidden':''}></div>
    ${hiddenN?`<p class="muted" style="margin-top:10px;font-size:12px">${t('folder_hidden',{n:hiddenN})}</p>`:''}
  </main>`);
  app.appendChild(v);
  const inst = installNote(); if(inst) v.querySelector('#inst-slot').appendChild(inst);
  const pg = v.querySelector('#pgrid'), list = v.querySelector('#list');
  function renderProjects(){
    const loose = visible.filter(isLoose);
    const cardFor = (f, rows) => { const thumbs = rows.slice(0,3); const teamNames = (f.teams||[]).map(tid => ((S.wsRow.teams||[]).find(x=>x.id===tid)||{}).name).filter(Boolean);
      const c = el(`<a class="card pcard ${thumbs.length?'':'blank'}" href="#/p/${f.id}"><div class="pcover">${thumbs.map(()=>`<img alt="" src="">`).join('')}${!thumbs.length?`<div class="pempty">${IC.folder}</div>`:''}<div class="pcap"><b>${esc(f.name)}</b><span>${nOf(rows.length,'instruction','instructions')}${f.pw?' · 🔒':''}</span></div></div><div class="pfoot"><div class="pcounts">${fmtCounts(rows)||`<span class="pc">${t('empty_title')}</span>`}</div>${teamNames.length?`<div class="pteams">${teamNames.map(n=>`<span>${esc(n)}</span>`).join('')}</div>`:''}</div></a>`);
      thumbs.forEach((i,k) => { const first = realSteps(i)[0]; if(first) stepPoster(first).then(u => { if(u) c.querySelectorAll('img')[k].src = u; }); });
      return c; };
    pg.innerHTML = '';
    folders.forEach(f => pg.appendChild(cardFor(f, visible.filter(i=>i.folder===f.id))));
    if(loose.length || !folders.length) pg.appendChild(cardFor({id:'none', name:t('no_folder'), teams:[]}, loose));
    if(isEditor){ const add = el(`<button class="card pcard add"><div class="pcover"><div class="pempty">${IC.plus}</div></div><div class="pfoot"><div class="pname">${t('new_folder')}</div><div class="pmeta">${t('new_folder_sub')}</div></div></button>`); add.onclick = async () => { const f = await newFolderDlg(); if(f) go('p/'+f.id); }; pg.appendChild(add); }
  }
  function renderAll(){ list.innerHTML = ''; if(!visible.length) list.innerHTML = `<div class="card empty"><h2>${t('empty_title')}</h2><div>${t('empty_sub')}</div></div>`; visible.forEach(i => list.appendChild(instrCard(i, statMap, {showFolder:true, onChange:render}))); }
  renderProjects(); renderAll();
  $$('#dtabs button', v).forEach(b => b.onclick = () => { mode = b.dataset.m; try{ sessionStorage.setItem('gg_dash', mode); }catch(e){} $$('#dtabs button', v).forEach(x=>x.classList.toggle('on', x===b)); pg.hidden = mode!=='projects'; list.hidden = mode!=='all'; });
  const bb = v.querySelector('#brand'); if(bb) bb.onclick = brandModal;
  v.querySelector('#gstats').onclick = () => go('stats');
  const ab = v.querySelector('#admin'); if(ab) ab.onclick = () => go('admin');
  const nb = v.querySelector('#new'); if(nb) nb.onclick = async () => {
    if(!folders.length) return newInstrDlg(null);
    const r = await modal(`<h2>${t('new_instr')}</h2><p class="muted" style="margin:0 0 10px">${t('pick_project')}</p><div class="menu">${folders.map(f => `<button data-fid="${f.id}">${IC.folder} ${esc(f.name)}</button>`).join('')}<button data-fid="none">${t('no_folder')}</button></div><div class="actions"><button class="btn ghost" data-x>${t('cancel')}</button></div>`, (bg, close) => { $$('[data-fid]', bg).forEach(b => b.onclick = () => close(b.dataset.fid)); bg.querySelector('[data-x]').onclick = () => close(null); });
    if(r===null) return; newInstrDlg(r); };
}

const posterCache = new Map();

async function stepPoster(step){
  if(step.poster && !(step.type==='video' && (step.trimStart||0) > 0.3)) return step.poster;
  if(!step.mediaId) return null;
  const key = step.mediaId + ':' + (step.trimStart||0);
  if(posterCache.has(key)) return posterCache.get(key);
  const url = await mediaUrl(step.mediaId); if(!url) return null;
  if(step.type==='photo'){ posterCache.set(key,url); return url; }
  const p = grabFrame(url, step.trimStart||0).then(c => c ? c.toDataURL('image/jpeg', .7) : (step.poster||null)).catch(()=>step.poster||null);
  posterCache.set(key, p); return p;
}

function grabFrame(url, time, maxW=640){
  return new Promise((res) => {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline',''); v.preload='auto'; v.crossOrigin='anonymous'; let done = false;
    const finish = () => { if(done) return; done = true; try{ const s = Math.min(1, maxW/(v.videoWidth||1)); const c = document.createElement('canvas'); c.width = Math.round((v.videoWidth||640)*s); c.height = Math.round((v.videoHeight||480)*s); c.getContext('2d').drawImage(v,0,0,c.width,c.height); res(c); }catch(e){ res(null); } try{ v.pause(); v.removeAttribute('src'); v.load(); }catch(e){} };
    const seek = async () => { try{ await v.play(); }catch(e){} try{ v.pause(); }catch(e){} try{ v.currentTime = Math.max(0.05, time); }catch(e){ finish(); } };
    v.addEventListener('loadedmetadata', seek, {once:true});
    v.addEventListener('seeked', () => setTimeout(finish, 60), {once:true});
    v.addEventListener('error', () => { done = true; res(null); }, {once:true});
    setTimeout(() => { if(!done) finish(); }, 5000);
    v.src = url; try{ v.load(); }catch(e){}
  });
}

const posterFromCanvas = (src, w, h, maxW=320) => { try{ const sc = Math.min(1, maxW/(w||1)); const c = document.createElement('canvas'); c.width = Math.round((w||320)*sc); c.height = Math.round((h||240)*sc); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .6); }catch(e){ return null; } };

export { roleLbl, nOf, initials, visFolders, isLoose, newFolderDlg, newInstrDlg, moveToFolderDlg, instrCard, renderDashboard, posterCache, stepPoster, grabFrame, posterFromCanvas };
