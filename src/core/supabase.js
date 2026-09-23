import { G } from './state.js';
import { attachAuth } from '../views/login.js';


/* ---------- Supabase ---------- */
const CFG = window.GIRI_CONFIG || {};

function initSb(){ if(G.sb || !window.supabase || !CFG.SUPABASE_URL) return !!G.sb; G.sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}}); attachAuth(); return true; }

const PUBLIC_MEDIA = path => `${CFG.SUPABASE_URL}/storage/v1/object/public/media/${path}`;

export { CFG, initSb, PUBLIC_MEDIA };
