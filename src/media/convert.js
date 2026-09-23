/* ---------- Video converter: every clip becomes H.264 MP4, ≤ 1280 px, ~2 Mbit/s – in the browser (WebCodecs), no server ---------- */
const CONV = {maxSide:1280, fps:30, bitrate:2200000, maxSec:60};

const canConvert = () => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && !!window.Mp4Muxer;

const isCompatVideo = (mime, w, h, size) => /mp4/.test(mime||'') && Math.max(w||0, h||0) <= CONV.maxSide + 64 && (size||0) <= 25*1048576;

async function convertVideo(blob, onProgress){
  if(!canConvert()) return null;
  const url = URL.createObjectURL(blob); const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline',''); v.preload = 'auto'; v.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none'; document.body.appendChild(v); v.src = url;
  try{
    await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('decode')); setTimeout(() => rej(new Error('timeout')), 10000); });
    const sw = v.videoWidth, sh = v.videoHeight; if(!sw || !sh) return null;
    const sc = Math.min(1, CONV.maxSide/Math.max(sw, sh)); const W = Math.round(sw*sc/2)*2, H = Math.round(sh*sc/2)*2;
    const dur = isFinite(v.duration) && v.duration > 0 ? Math.min(v.duration, CONV.maxSec) : CONV.maxSec;
    const cfg = {codec: window.__CONV_CODEC || 'avc1.4d002a', width:W, height:H, bitrate:CONV.bitrate, framerate:CONV.fps, latencyMode:'quality'}; if(cfg.codec.startsWith('avc')) cfg.avc = {format:'avc'};
    let sup = await VideoEncoder.isConfigSupported(cfg).catch(() => ({supported:false}));
    if(!sup.supported && cfg.codec.startsWith('avc')){ cfg.codec = 'avc1.42001f'; sup = await VideoEncoder.isConfigSupported(cfg).catch(() => ({supported:false})); }
    if(!sup.supported) return null;
    const muxer = new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(), video:{codec: cfg.codec.startsWith('avc') ? 'avc' : 'vp9', width:W, height:H}, fastStart:'in-memory', firstTimestampBehavior:'offset'});
    let encErr = null; const enc = new VideoEncoder({output:(chunk, meta) => muxer.addVideoChunk(chunk, meta), error:e => { encErr = e; }}); enc.configure(cfg);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d');
    let frames = 0, lastTs = -1;
    const pushFrame = tSec => { const ts = Math.round(tSec*1e6); if(ts <= lastTs) return; lastTs = ts; ctx.drawImage(v, 0, 0, W, H); const f = new VideoFrame(c, {timestamp:ts, duration:Math.round(1e6/CONV.fps)}); enc.encode(f, {keyFrame: frames % (CONV.fps*2) === 0}); f.close(); frames++; if(onProgress) onProgress(Math.min(1, tSec/dur)); };
    await new Promise((res, rej) => {
      let done = false; const finish = () => { if(done) return; done = true; res(); };
      const tick = () => { if(done) return; if(v.ended || v.currentTime >= dur - 0.02){ finish(); return; } pushFrame(v.currentTime); if(v.requestVideoFrameCallback) v.requestVideoFrameCallback(tick); else setTimeout(tick, 1000/CONV.fps); };
      v.onended = finish; v.onerror = () => rej(new Error('playback'));
      v.currentTime = 0; v.play().then(() => { if(v.requestVideoFrameCallback) v.requestVideoFrameCallback(tick); else setTimeout(tick, 0); }).catch(rej);
      setTimeout(finish, (dur+6)*1000);
    });
    try{ v.pause(); }catch(e){}
    if(encErr) throw encErr; if(frames < 2) return null;
    await enc.flush(); enc.close(); muxer.finalize();
    const out = new Blob([muxer.target.buffer], {type:'video/mp4'}); if(!out.size) return null;
    return {blob:out, w:W, h:H, duration:Math.max(0.5, Math.min(dur, lastTs/1e6 + 1/CONV.fps))};
  } catch(e){ console.warn('convert', e); return null; }
  finally { try{ v.pause(); v.removeAttribute('src'); v.load(); }catch(e){} v.remove(); URL.revokeObjectURL(url); }
}

export { CONV, canConvert, isCompatVideo, convertVideo };
