import { realSteps } from '../core/auth.js';
import { toast } from '../core/helpers.js';
import { fmtD, t } from '../core/i18n.js';
import { S, loadBrand } from '../core/state.js';
import { stepImages } from './export.js';
import { hexToRgb, saveFile, slug } from '../views/results.js';

/* ---------- PDF fonts: Montserrat (Latin/Cyrillic) or Noto Sans SC (Chinese), loaded once from /fonts ---------- */
const PDF_FONT_CACHE = {};

async function loadFontB64(path){ if(PDF_FONT_CACHE[path]) return PDF_FONT_CACHE[path]; const r = await fetch(path); if(!r.ok) throw new Error('font '+path); const u8 = new Uint8Array(await r.arrayBuffer()); let bin = ''; for(let i=0;i<u8.length;i+=8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i+8192)); PDF_FONT_CACHE[path] = btoa(bin); return PDF_FONT_CACHE[path]; }

async function pdfFonts(doc, lang){
  try{
    if(lang==='ZH'){ const b = await loadFontB64('fonts/NotoSansSC-Regular.ttf'); doc.addFileToVFS('NotoSansSC-Regular.ttf', b); doc.addFont('NotoSansSC-Regular.ttf', 'NotoSansSC', 'normal'); doc.addFont('NotoSansSC-Regular.ttf', 'NotoSansSC', 'bold'); return bold => doc.setFont('NotoSansSC', bold ? 'bold' : 'normal'); }
    const [r, b] = await Promise.all([loadFontB64('fonts/Montserrat-Regular.ttf'), loadFontB64('fonts/Montserrat-Bold.ttf')]);
    doc.addFileToVFS('Montserrat-Regular.ttf', r); doc.addFont('Montserrat-Regular.ttf', 'Montserrat', 'normal'); doc.addFileToVFS('Montserrat-Bold.ttf', b); doc.addFont('Montserrat-Bold.ttf', 'Montserrat', 'bold');
    return bold => doc.setFont('Montserrat', bold ? 'bold' : 'normal');
  }catch(e){ console.warn('pdf fonts', e); return bold => doc.setFont('helvetica', bold ? 'bold' : 'normal'); }
}

async function exportQrPdf(instr, link, opts, qrEl){
  if(!window.jspdf){ toast('jsPDF n/a'); return; } toast(t('pdf_making'));
  const {jsPDF} = window.jspdf; const doc = new jsPDF({unit:'mm', format:'a4', putOnlyUsedFonts:true}); const W = 210, H = 297; const F = await pdfFonts(doc, 'DE');
  const brand = await loadBrand(instr.ws); const bc = hexToRgb(brand.color||'#004EAD');
  // QR as image (from the rendered canvas/img)
  let qrData = null; const c = qrEl.querySelector('canvas'), im = qrEl.querySelector('img'); try{ qrData = c ? c.toDataURL('image/png') : (im ? im.src : null); }catch(e){}
  if(!qrData){ const tmp = document.createElement('div'); tmp.style.position='fixed'; tmp.style.left='-9999px'; document.body.appendChild(tmp); try{ new QRCode(tmp, {text:link, width:512, height:512, colorDark:'#000000', colorLight:'#ffffff', correctLevel:QRCode.CorrectLevel.M}); await new Promise(r=>setTimeout(r,80)); const cc = tmp.querySelector('canvas'); qrData = cc ? cc.toDataURL('image/png') : null; }catch(e){} tmp.remove(); }
  // card layout
  const cardW = 150, cardH = opts.image ? 190 : 150, cx = (W-cardW)/2, cy = (H-cardH)/2;
  doc.setDrawColor(220); doc.setLineWidth(.3); doc.roundedRect(cx, cy, cardW, cardH, 4, 4, 'S');
  let y = cy;
  if(opts.brand){ doc.setFillColor(...bc); doc.roundedRect(cx, cy, cardW, 14, 4, 4, 'F'); doc.rect(cx, cy+7, cardW, 7, 'F');
    let lx = cx+6; if(brand.logo){ try{ const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin='anonymous'; i.onload=()=>res(i); i.onerror=rej; i.src = brand.logo; }); const cv = document.createElement('canvas'); cv.width=img.naturalWidth; cv.height=img.naturalHeight; cv.getContext('2d').drawImage(img,0,0); const lh = 9, lw = Math.min(40, lh*cv.width/cv.height); doc.setFillColor(255); doc.roundedRect(lx-1, cy+2.5, lw+2, lh, 1.5, 1.5, 'F'); doc.addImage(cv.toDataURL('image/png'), 'PNG', lx, cy+2.5, lw, lh); lx += lw+4; }catch(e){} }
    doc.setTextColor(255); F(true); doc.setFontSize(11); doc.text(brand.name || S.user && S.user.ws || '', lx, cy+9.5); y = cy+14; }
  y += 10;
  if(opts.image){ const first = realSteps(instr)[0]; if(first){ const imgs = await stepImages(first, 1); if(imgs[0]){ const iw = cardW-24, ih = Math.min(iw*(first.h||3)/(first.w||4), 60); try{ doc.addImage(imgs[0], 'JPEG', cx+12, y, iw, ih); }catch(e){} y += ih + 8; } } }
  const qrSize = opts.image ? 46 : 60; y += opts.image ? 0 : 6; if(qrData){ try{ doc.addImage(qrData, 'PNG', cx + (cardW-qrSize)/2, y, qrSize, qrSize); }catch(e){} } y += qrSize + 10;
  if(opts.title){ doc.setTextColor(0); F(true); doc.setFontSize(15); const tl = doc.splitTextToSize(instr.title, cardW-20); doc.text(tl, W/2, y, {align:'center'}); y += tl.length*6.5 + 2; }
  F(false); doc.setFontSize(9.5); doc.setTextColor(90);
  const meta = []; const lastHist = instr.history[instr.history.length-1];
  if(opts.version) meta.push(`v${instr.version}`); if(opts.date) meta.push(fmtD(lastHist ? lastHist.at : instr.updatedAt)); if(opts.creator) meta.push(instr.createdBy||'');
  if(meta.length){ doc.text(meta.filter(Boolean).join('  ·  '), W/2, y, {align:'center'}); y += 6; }
  doc.setFontSize(7.5); doc.setTextColor(150); doc.text(t('qr_scan'), W/2, cy+cardH-8, {align:'center'});
  const blob = doc.output('blob'); const ok = await saveFile(`qr-${slug(instr.title)}.pdf`, blob, 'application/pdf'); if(ok) toast(t('pdf_done'));
}

export { PDF_FONT_CACHE, loadFontB64, pdfFonts, exportQrPdf };
