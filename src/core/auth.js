import { G, S } from './state.js';


/* ---------- Auth ---------- */
async function loadProfile(){
  if(!G.sb) return null;
  const {data:{session}} = await G.sb.auth.getSession(); S.session = session; if(!session) { S.user = null; return null; }
  let {data:p} = await G.sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if(!p){ // Trigger noch nicht gelaufen? Selbst anlegen.
    const email = session.user.email||''; const ins = await G.sb.from('profiles').insert({id:session.user.id, email, name: email.split('@')[0], role:'creator', ws: email.split('@')[1].toLowerCase()}).select().maybeSingle(); p = ins.data; }
  S.user = p ? {id:p.id, email:p.email, name:p.name||p.email.split('@')[0], role:p.role, ws:p.ws, isAdmin:!!p.is_admin || p.role==='admin'} : null;
  return S.user;
}

const orderedSteps = i => i.steps;
 // steps array carries order; chapters are entries with kind:'chapter'
const realSteps = i => i.steps.filter(s => s.kind !== 'chapter');

export { loadProfile, orderedSteps, realSteps };
