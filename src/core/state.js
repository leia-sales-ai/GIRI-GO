import { DB } from './storage.js';
// mutable app state that used to be top-level "let" variables – one place, live everywhere
const G = {
  LANG: 'de',
  sb: null,
  wsLoaded: false,
  saving: 0,
  toastT: undefined,
  animRaf: 0,
  animLast: 0,
  activeCleanup: null,
  authReady: false,
  rtChannel: null,
  renderSeq: 0,
  seedOnce: null,
  recentEmojis: [],
  pdfBusy: false,
  renderAfterPdf: false,
  installPrompt: null,
  pendingUpdate: null,
  lastUpdCheck: 0,
  busyCheck: null,
  pickingUp: false,
};



/* ---------- State ---------- */
const S = { user: null, session: null, instrs: [], route: null, mediaURL: new Map(), remoteUrl: new Map() };

// Medien: lokal im Browser (IndexedDB) als Offline-Puffer, remote im Storage. Lokal gewinnt, wenn vorhanden.
// Safari: Blobs aus IndexedDB sind als <video>-Quelle unzuverlässig → wir speichern ArrayBuffer + MIME
const mediaBlob = m => m ? (m.buf ? new Blob([m.buf], {type:m.mime||''}) : (m.blob ? new Blob([m.blob], {type:m.blob.type||m.mime||''}) : null)) : null;

async function putMedia(rec){ const blob = rec.blob; if(blob){ rec.buf = await blob.arrayBuffer(); rec.mime = blob.type||''; delete rec.blob; } await DB.put('media', rec); return rec; }

const mediaUrl = async id => {
  if(!id) return null;
  if(S.mediaURL.has(id)) return S.mediaURL.get(id);
  const m = await DB.get('media', id);
  const b = mediaBlob(m);
  if(b && b.size){ const u = URL.createObjectURL(b); S.mediaURL.set(id,u); return u; }
  if(m && m.remote) return m.remote;
  return S.remoteUrl.get(id) || null;
};

const BRAND_DEFAULT = {name:'', color:'#004EAD', logo:null, theme:'dark'};
 const brandCache = new Map();

async function loadBrand(ws){ if(!G.sb || !ws) return S.brand; if(brandCache.has(ws)){ S.brand = brandCache.get(ws); return S.brand; } const {data} = await G.sb.from('workspaces').select('brand').eq('ws', ws).maybeSingle(); S.brand = Object.assign({}, BRAND_DEFAULT, (data && data.brand) || {}); brandCache.set(ws, S.brand); return S.brand; }

async function saveBrand(brand){ const {error} = await G.sb.from('workspaces').upsert({ws:S.user.ws, brand, updated_at:new Date().toISOString()}); if(error) throw error; S.brand = Object.assign({}, BRAND_DEFAULT, brand); brandCache.set(S.user.ws, S.brand); }

export { S, mediaBlob, putMedia, mediaUrl, BRAND_DEFAULT, brandCache, loadBrand, saveBrand, G };
