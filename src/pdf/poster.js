import { realSteps } from '../core/auth.js';
import { modal, toast } from '../core/helpers.js';
import { fmtD, t } from '../core/i18n.js';
import { S, loadBrand } from '../core/state.js';
import { stepImages } from './export.js';
import { pdfFonts } from './fonts.js';
import { IC } from '../ui/icons.js';
import { nOf } from '../views/dashboard.js';
import { hexToRgb, saveFile, slug } from '../views/results.js';


/* ---------- Project poster: one A4 sheet with a QR tile per instruction ---------- */
const qrDataUrl = async (text, size) => { const tmp = document.createElement('div'); tmp.style.position='fixed'; tmp.style.left='-9999px'; document.body.appendChild(tmp); let out = null; try{ new QRCode(tmp, {text, width:size||512, height:size||512, colorDark:'#000000', colorLight:'#ffffff', correctLevel:QRCode.CorrectLevel.M}); await new Promise(r=>setTimeout(r,60)); const c = tmp.querySelector('canvas'); out = c ? c.toDataURL('image/png') : ((tmp.querySelector('img')||{}).src || null); }catch(e){} tmp.remove(); return out; };

// cover-crop an image data URL to a given aspect ratio (w/h) – posters never show squashed pictures
const coverCrop = (dataUrl, ratio, maxW) => new Promise(res => { const i = new Image(); i.onload = () => { const sw = i.naturalWidth, sh = i.naturalHeight; let cw = sw, ch = Math.round(sw/ratio); if(ch > sh){ ch = sh; cw = Math.round(sh*ratio); } const sc = Math.min(1, (maxW||900)/cw); const c = document.createElement('canvas'); c.width = Math.round(cw*sc); c.height = Math.round(ch*sc); c.getContext('2d').drawImage(i, (sw-cw)/2, (sh-ch)/2, cw, ch, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .85)); }; i.onerror = () => res(null); i.src = dataUrl; });

async function posterDialog(f, rows){
  const pub = rows.filter(i => i.status==='published');
  const r = await modal(`<h2>${t('poster')}</h2><p class="muted" style="margin:0 0 12px">${t('poster_sub')}</p>
    <label class="opt" style="margin-bottom:8px"><input type="checkbox" id="po-pub" ${pub.length?'checked':''} ${pub.length?'':'disabled'}> ${t('poster_only_pub')} <span class="muted">(${pub.length} / ${rows.length})</span></label>
    <label class="opt" style="margin-bottom:8px"><input type="checkbox" id="po-img" checked> ${t('qr_image')}</label>
    <label class="opt" style="margin-bottom:8px"><input type="checkbox" id="po-brand" checked> ${t('qr_brand')}</label>
    <div class="actions"><button class="btn ghost" data-x>${t('cancel')}</button><button class="btn" data-ok>${IC.pdf} ${t('poster_make')}</button></div>`, (bg, close) => {
      bg.querySelector('[data-x]').onclick = () => close(null);
      bg.querySelector('[data-ok]').onclick = () => close({onlyPub: bg.querySelector('#po-pub').checked, image: bg.querySelector('#po-img').checked, brand: bg.querySelector('#po-brand').checked}); });
  if(!r) return;
  const list = r.onlyPub ? pub : rows; if(!list.length){ toast(t('empty_title')); return; }
  await exportPosterPdf(f, list, r);
}

async function exportPosterPdf(f, list, opts){
  if(!window.jspdf){ toast('jsPDF n/a'); return; } toast(t('pdf_making'));
  const {jsPDF} = window.jspdf; const doc = new jsPDF({unit:'mm', format:'a4', putOnlyUsedFonts:true}); const W = 210, H = 297, M = 12; const F = await pdfFonts(doc, 'DE');
  const brand = await loadBrand(S.user.ws); const bc = hexToRgb(brand.color||'#004EAD'); const base = location.href.split('#')[0];
  let logoData = null, logoRatio = 1; if(opts.brand && brand.logo){ try{ const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin='anonymous'; i.onload=()=>res(i); i.onerror=rej; i.src = brand.logo; }); const cv = document.createElement('canvas'); cv.width=img.naturalWidth; cv.height=img.naturalHeight; cv.getContext('2d').drawImage(img,0,0); logoData = cv.toDataURL('image/png'); logoRatio = cv.width/cv.height; }catch(e){} }
  // tiles: 2 columns up to 4 instructions, else 3; page holds 2 or 3 rows
  const cols = list.length <= 4 ? 2 : 3, maxRows = cols===2 ? 2 : 3, perPage = cols*maxRows;
  const rowsPerPage = Math.min(maxRows, Math.ceil(list.length/cols)); // fewer instructions → taller tiles, no empty band
  const headH = 30, footH = 10, gap = 6; const gridTop = M + headH + 8, gridH = H - gridTop - footH - M;
  const tileW = (W - 2*M - gap*(cols-1))/cols, tileH = (gridH - gap*(rowsPerPage-1))/rowsPerPage;
  const imgH = opts.image ? Math.min(tileH*(cols===2 ? 0.46 : 0.4), tileW*0.62) : 0; const titleFs = cols===2 ? 13 : 10.5, lineH = titleFs*0.42;
  const qrS = Math.max(18, Math.min(tileW*0.5, tileH - imgH - 2*lineH - 16));
  const pages = Math.ceil(list.length/perPage);
  const header = (pg) => {
    doc.setFillColor(...bc); doc.roundedRect(M, M, W-2*M, headH, 4, 4, 'F');
    let lx = M+7; if(logoData){ const lh = 11, lw = Math.min(46, lh*logoRatio); doc.setFillColor(255); doc.roundedRect(lx-2, M+6, lw+4, lh+4, 2, 2, 'F'); try{ doc.addImage(logoData, 'PNG', lx, M+8, lw, lh); }catch(e){} lx += lw+8; }
    doc.setTextColor(255); F(false); doc.setFontSize(9); doc.text((opts.brand && brand.name) ? brand.name.toUpperCase() : 'GIRI GO', lx, M+11);
    F(true); doc.setFontSize(19); const tl = doc.splitTextToSize(f.name, W-2*M-(lx-M)-60)[0]; doc.text(tl, lx, M+21);
    F(false); doc.setFontSize(8.5); doc.text(`${nOf(list.length,'instruction','instructions')}${pages>1?`  ·  ${pg}/${pages}`:''}`, W-M-6, M+11, {align:'right'});
    doc.setFontSize(9); doc.text(t('poster_scan'), W-M-6, M+21, {align:'right'});
    doc.setTextColor(140); doc.setFontSize(7.5); doc.text(`GIRI Go  ·  ${base.replace(/^https?:\/\//,'')}  ·  ${fmtD(Date.now())}`, W/2, H-M+2, {align:'center'});
  };
  for(let k=0; k<list.length; k++){
    const pg = Math.floor(k/perPage); if(k % perPage === 0){ if(k) doc.addPage(); header(pg+1); }
    const i = list[k]; const idx = k % perPage; const cx = M + (idx % cols)*(tileW+gap), cy = gridTop + Math.floor(idx/cols)*(tileH+gap);
    doc.setFillColor(255); doc.setDrawColor(215); doc.setLineWidth(.35); doc.roundedRect(cx, cy, tileW, tileH, 3.5, 3.5, 'FD');
    let y = cy;
    if(opts.image){ const first = realSteps(i)[0]; let data = null; if(first){ try{ const imgs = await stepImages(first, 1); if(imgs[0]) data = await coverCrop(imgs[0], tileW/imgH, 900); }catch(e){} }
      if(data){ try{ doc.addImage(data, 'JPEG', cx+1.5, cy+1.5, tileW-3, imgH-1.5); }catch(e){} } else { doc.setFillColor(238); doc.rect(cx+1.5, cy+1.5, tileW-3, imgH-1.5, 'F'); }
      y = cy + imgH + 4; }
    else y = cy + 5;
    // number badge
    doc.setFillColor(...bc); doc.circle(cx+tileW-8, cy+7, 4.2, 'F'); doc.setTextColor(255); F(true); doc.setFontSize(9); doc.text(String(k+1), cx+tileW-8, cy+8.4, {align:'center'});
    // title across the tile, then QR with the facts beside it
    doc.setTextColor(20); F(true); doc.setFontSize(titleFs); const lines = doc.splitTextToSize(i.title, tileW-10).slice(0, 2); doc.text(lines, cx+5, y+lineH); y += lines.length*lineH + 3;
    const link = base + '#/v/' + i.id; const qr = await qrDataUrl(link, 384); const qy = Math.min(y, cy+tileH-qrS-7); if(qr){ try{ doc.addImage(qr, 'PNG', cx+4, qy, qrS, qrS); }catch(e){} }
    const tx = cx + 4 + qrS + 4; F(false); doc.setFontSize(cols===2 ? 9 : 8); doc.setTextColor(90);
    const meta = [nOf(realSteps(i).length,'step','steps'), 'v'+i.version]; if(i.status!=='published') meta.push(t(i.status==='review'?'in_review':'draft'));
    meta.forEach((m, mi) => doc.text(m, tx, qy + 5 + mi*(cols===2 ? 5 : 4.4)));
    doc.setFontSize(7); doc.setTextColor(150); doc.text(doc.splitTextToSize(t('qr_scan'), tileW-qrS-14), tx, qy + qrS - 2);
  }
  const blob = doc.output('blob'); const ok = await saveFile(`poster-${slug(f.name)}.pdf`, blob, 'application/pdf'); if(ok) toast(t('pdf_done'));
}

export { qrDataUrl, coverCrop, posterDialog, exportPosterPdf };
