import { chromium } from 'playwright'; import { BASE, OUT, TESTS, launchArgs } from './env.mjs'; import fs from 'fs';
const browser = await chromium.launch(launchArgs([]));
const ctx = await browser.newContext({viewport:{width:1280,height:800}, acceptDownloads:true}); const page = await ctx.newPage(); const errs=[];
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if(m.type()==='error' || m.text().includes('pdf fonts')) errs.push('console: '+m.text()); });
await page.goto(BASE+'/index3.html'); await page.waitForTimeout(2000);
// instruction with Polish + Chinese translations (fake maps) so both font paths run
await page.evaluate(()=>{ const r = window.__tables.instructions[0]; const steps = r.data.steps; const mk = (pre) => { const map = {title: pre+' Tytuł: Zażółć gęślą jaźń – ěščřžýáíé ğışİ őű'}; steps.forEach(s => { if(s.kind==='chapter') map['ch:'+s.id] = pre+' rozdział ĄĘŁ'; else { map['t:'+s.id] = pre+' Krok: przykręcić śrubę M6 – řízení'; map['d:'+s.id] = pre+' Opis **10 Nm** – nie tłumaczyć ==M6=='; map['w:'+s.id] = pre+' Uwaga!'; } }); return map; };
  const zh = {title:'夹具设置示例 – 工作指导'}; steps.forEach(s => { if(s.kind==='chapter') zh['ch:'+s.id] = '准备工作'; else { zh['t:'+s.id] = '将工件放入夹具并对齐'; zh['d:'+s.id] = '扭矩 **10 Nm**，使用 ==M6== 螺栓'; zh['w:'+s.id] = '注意安全'; } });
  
  sessionStorage.setItem('gg_dash','all'); });
await page.goto(BASE+'/index3.html#/'); await page.waitForTimeout(1000);
for(const l of ['PL','ZH','']){
  await page.click('[data-a="more"]'); await page.waitForTimeout(300); await page.click('[data-m="pdf"]'); await page.waitForTimeout(400);
  if(l==='PL') await page.screenshot({path:OUT+'/p1-pdf-langs.png'});
  const [dl] = await Promise.all([ page.waitForEvent('download', {timeout:60000}), page.click(`[data-l="${l}"]`) ]);
  const path = OUT+'/out-'+(l||'orig')+'.pdf'; await dl.saveAs(path); console.log(l||'orig', 'pdf bytes:', fs.statSync(path).size);
  await page.waitForTimeout(500);
}
console.log(errs.join('\n')||'NO ERRORS');
await browser.close();
