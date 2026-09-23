// builds index3.html = the built app with the Supabase client replaced by an in-memory mock (tables, storage, rpc, auth, functions)
import fs from 'fs'; import path from 'path'; import { ROOT } from './env.mjs';
let html = fs.readFileSync(path.join(ROOT, 'index.html'),'utf8');
const mock = `<script>
window.supabase = { createClient(){
  const now = Date.now();
  const tables = {profiles:[], instructions:[], runs:[], workspaces:[], views:[], instr_stats:[], feedback:[]};
  const session = {user:{id:'u1', email:'bjoern@ar-giri.com'}, access_token:'tok'};
  tables.profiles.push({id:'u1', email:'bjoern@ar-giri.com', name:'Björn', role:'admin', ws:'ar-giri.com', is_admin:true, created_at:new Date(now-8e7).toISOString()});
  tables.profiles.push({id:'u2', email:'anna@ar-giri.com', name:'Anna', role:'viewer', ws:'ar-giri.com', is_admin:false, created_at:new Date(now-4e7).toISOString()});
  tables.workspaces.push({ws:'ar-giri.com', brand:{name:'AR-Experts', color:'#004EAD', theme:'dark'}, folders:[{id:'f1', name:'Linie 3', teams:['t1']},{id:'f2', name:'Vorrichtungen', teams:[]}], teams:[{id:'t1', name:'Montage', members:[{email:'anna@ar-giri.com', role:'viewer'}]}], invites:[{email:'max@ar-giri.com', role:'creator'}]});
  window.__tables = tables;
  const q = (tbl) => { const st = {filters:[], order:null, single:false, count:false, head:false, op:'select', payload:null};
    const api = { select(cols, opts){ if(opts&&opts.count){st.count=true; st.head=!!opts.head;} return api; }, eq(k,v){ st.filters.push([k,v]); return api; }, gte(){ return api; }, order(){ return api; }, limit(){ return api; }, maybeSingle(){ st.single=true; return api; },
      insert(p){ st.op='insert'; st.payload=p; return api; }, upsert(p){ st.op='upsert'; st.payload=p; return api; }, update(p){ st.op='update'; st.payload=p; return api; }, delete(){ st.op='delete'; return api; },
      then(res, rej){ let rows = tables[tbl].filter(r => st.filters.every(([k,v]) => r[k]===v));
        if(st.op==='insert'){ const arr = Array.isArray(st.payload)?st.payload:[st.payload]; tables[tbl].push(...arr); rows = arr; }
        if(st.op==='upsert'){ const key = tbl==='workspaces' ? 'ws' : 'id'; const i = tables[tbl].findIndex(r=>r[key]===st.payload[key]); if(i>=0) Object.assign(tables[tbl][i], st.payload); else tables[tbl].push(st.payload); rows=[st.payload]; }
        if(st.op==='update'){ rows.forEach(r=>Object.assign(r, st.payload)); }
        if(st.op==='delete'){ tables[tbl] = tables[tbl].filter(r=>!rows.includes(r)); }
        const out = st.count ? {data:null, count:rows.length, error:null} : {data: st.single ? (rows[0]||null) : rows, error:null};
        return Promise.resolve(out).then(res, rej); } };
    return api; };
  return {
    from: q,
    rpc: async (name, args) => { window.__rpc = (window.__rpc||[]).concat([{name, args}]); if(name==='open_instr'){ const row = tables.instructions.concat(tables.instructions_hidden||[]).find(r=>r.id===args.p_id && r.status==='published'); if(!row) return {data:null, error:null}; const pw = window.__mockPw; if(pw && args.p_pw!==pw) return {data:{locked:true}, error:null}; return {data:{locked:false, row}, error:null}; } return {data:null, error:null}; },
    auth: { getSession: async()=>({data:{session: localStorage.getItem('gg_nosess') ? null : session}}), onAuthStateChange(cb){ setTimeout(()=>cb('SIGNED_IN', localStorage.getItem('gg_nosess') ? null : session), 50); }, getUser: async()=>({data:{user: localStorage.getItem('gg_nosess') ? null : session.user}}), signInWithOtp: async()=>({error:null}), signInWithOAuth: async(o)=>{ window.__oauth = o; return {error:null}; }, signOut: async()=>{} },
    storage: { from(){ return { upload: async(path)=>({data:{path}, error:null}), remove: async()=>({}) }; } },
    functions: { invoke: async (name, {body}) => { window.__invoked = (window.__invoked||[]).concat([{target:body.target, instrId:body.instrId, ui:body.ui?body.ui.length:undefined}]); if(body.ui){ const map = {}; body.ui.forEach(x => map[x.k] = '['+body.target+'] '+x.v); await new Promise(r=>setTimeout(r,100)); return {data:{map}, error:null}; } if(body.texts){ const pre = body.target==='ZH' ? '夹具设置 ' : body.target==='PL' ? 'Zażółć gęślą jaźń ' : '['+body.target+'] '; return {data:{translations: body.texts.map(x => x ? pre + x : '')}, error:null}; } const row = tables.instructions.find(r=>r.id===body.instrId); const map = {}; if(row){ map.title = '[' + body.target + '] ' + row.title; for(const st of row.data.steps){ if(st.kind==='chapter') map['ch:'+st.id] = '['+body.target+'] '+st.title; else { map['t:'+st.id] = '['+body.target+'] '+st.title; map['d:'+st.id] = st.desc ? '['+body.target+'] '+st.desc : ''; map['w:'+st.id] = st.warn ? '['+body.target+'] '+st.warn : ''; } } } await new Promise(r=>setTimeout(r,150)); return {data:{map, cached:false}, error:null}; } },
    channel(){ const c = {on(){ return c; }, subscribe(){ return c; }}; return c; }, removeChannel(){}
  }; } };
</script>`;
html = html.replace(/<script src="https:\/\/cdn.jsdelivr.net[^>]*><\/script>/, mock);
html = html.replace(/https:\/\/cdnjs.cloudflare.com\/ajax\/libs\/jspdf\/[^"]*/, 'tests/vendor/jspdf.umd.min.js').replace(/https:\/\/cdnjs.cloudflare.com\/ajax\/libs\/qrcodejs\/[^"]*/, 'tests/vendor/qrcode.min.js');
fs.writeFileSync(path.join(ROOT, 'index3.html'), html);
console.log('index3 rebuilt');
