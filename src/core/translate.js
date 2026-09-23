import { toast } from './helpers.js';
import { saveInstr } from './passwords.js';
import { G, S } from './state.js';

/* ---------- Translations (DeepL via Edge Function) ---------- */
const LANGS = [['EN','English'],['FR','Français'],['ES','Español'],['IT','Italiano'],['NL','Nederlands'],['PL','Polski'],['CS','Čeština'],['TR','Türkçe'],['PT','Português'],['RO','Română'],['HU','Magyar'],['ZH','中文'],['DE','Deutsch']];

const FLAGS = {EN:'🇬🇧',FR:'🇫🇷',ES:'🇪🇸',IT:'🇮🇹',NL:'🇳🇱',PL:'🇵🇱',CS:'🇨🇿',TR:'🇹🇷',PT:'🇵🇹',RO:'🇷🇴',HU:'🇭🇺',ZH:'🇨🇳',DE:'🇩🇪'};

const langName = k => (LANGS.find(x=>x[0]===k)||[k,k])[1];

const srcTexts = instr => { const arr = [{k:'title', v:instr.title||''}]; for(const st of instr.steps){ if(st.kind==='chapter') arr.push({k:'ch:'+st.id, v:st.title||''}); else { arr.push({k:'t:'+st.id, v:st.title||''}); arr.push({k:'d:'+st.id, v:st.desc||''}); arr.push({k:'w:'+st.id, v:st.warn||''}); } } return arr; };

const strHash = str => { let h = 5381; for(let i=0;i<str.length;i++) h = ((h<<5)+h+str.charCodeAt(i))|0; return (h>>>0).toString(36); };

const srcHash = instr => strHash(srcTexts(instr).map(x=>x.v).join('\u0001'));

async function translateInstr(instr, target){
  const items = srcTexts(instr); const {data, error} = await G.sb.functions.invoke('translate', {body:{texts: items.map(x=>x.v), target}});
  if(error) throw new Error(error.message||String(error)); if(!data || data.error) throw new Error((data&&data.error)||'translate failed');
  const map = {}; items.forEach((x,i) => map[x.k] = data.translations[i]||'');
  instr.translations = instr.translations||{}; instr.translations[target] = {map, at:Date.now(), hash:srcHash(instr), by:S.user?S.user.name:''};
  await saveInstr(instr);
}

const hasTx = (instr, lang) => !!(lang && instr.translations && instr.translations[lang.toUpperCase()]);

function withLang(instr, lang){ // shallow clone with translated texts (original instr untouched)
  if(!hasTx(instr, lang)) return instr; const m = instr.translations[lang.toUpperCase()].map; const c = Object.assign({}, instr);
  c.title = m.title || instr.title; c.steps = instr.steps.map(st => st.kind==='chapter' ? Object.assign({}, st, {title: m['ch:'+st.id]||st.title}) : Object.assign({}, st, {title: m['t:'+st.id]||st.title, desc: m['d:'+st.id]||st.desc, warn: m['w:'+st.id]||st.warn})); c._lang = lang.toUpperCase(); return c;
}

const rememberRemote = instr => { for(const s of instr.steps||[]){ if(s.mediaUrl) S.remoteUrl.set(s.mediaId, s.mediaUrl); } };

const rowToInstr = r => { const i = r.data || {}; i.id = r.id; i.ws = r.ws; i.status = r.status; i.title = r.title; i.updatedAt = new Date(r.updated_at).getTime(); rememberRemote(i); return i; };

const loadInstrs = async () => {
  if(!G.sb || !S.user) { S.instrs = []; return; }
  const {data, error} = await G.sb.from('instructions').select('*').eq('ws', S.user.ws).is('deleted_at', null).order('updated_at', {ascending:false});
  if(error){ toast(error.message); S.instrs = []; return; }
  S.instrs = data.map(rowToInstr);
};

export { LANGS, FLAGS, langName, srcTexts, strHash, srcHash, translateInstr, hasTx, withLang, rememberRemote, rowToInstr, loadInstrs };
