/* ---------- Storage (IndexedDB with memory fallback) ---------- */
const DB = (() => {
  const mem = {instr:new Map(), media:new Map(), runs:new Map()};
  let db = null, failed = false;
  const open = () => new Promise(res => {
    if(db||failed) return res(db);
    try{
      const rq = indexedDB.open('giri-go', 1);
      rq.onupgradeneeded = e => { const d = e.target.result; ['instr','media','runs'].forEach(s => { if(!d.objectStoreNames.contains(s)) d.createObjectStore(s,{keyPath:'id'}); }); };
      rq.onsuccess = e => { db = e.target.result; res(db); };
      rq.onerror = () => { failed = true; res(null); };
    }catch(e){ failed = true; res(null); }
  });
  const tx = (store, mode, fn) => open().then(d => new Promise((res, rej) => {
    if(!d){ try{ res(fn(null, store)); }catch(e){ rej(e); } return; }
    const tr = d.transaction(store, mode); const st = tr.objectStore(store);
    const r = fn(st, store); if(!r){ tr.oncomplete = () => res(); tr.onerror = () => rej(tr.error); return; }
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  return {
    put:(s,o) => tx(s,'readwrite',(st,name)=> st ? st.put(o) : (mem[name].set(o.id,o), null)),
    get:(s,id) => tx(s,'readonly',(st,name)=> st ? st.get(id) : mem[name].get(id)),
    del:(s,id) => tx(s,'readwrite',(st,name)=> st ? st.delete(id) : (mem[name].delete(id), null)),
    all:(s) => tx(s,'readonly',(st,name)=> st ? st.getAll() : [...mem[name].values()])
  };
})();

const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);

const LS = { get:k=>{try{return JSON.parse(localStorage.getItem(k));}catch(e){return null;}}, set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}} , del:k=>{try{localStorage.removeItem(k);}catch(e){}} };

export { DB, uid, LS };
