import { chromium } from 'playwright'; import { BASE, OUT, TESTS, launchArgs } from './env.mjs';
const browser = await chromium.launch(launchArgs([]));
const m = await (await browser.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true})).newPage(); const errs=[];
m.on('pageerror', e => errs.push(e.message+' '+(e.stack||'').split('\n').slice(0,2).join('|')));
await m.goto(BASE+'/index3.html'); await m.waitForTimeout(2000);
await m.evaluate(()=>{ const r = window.__tables.instructions[0]; r.status='published'; r.data.checklist = true; });
const vid = await m.evaluate(()=>window.__tables.instructions[0].id);
await m.goto(BASE+'/index3.html#/v/'+vid); await m.waitForTimeout(1500);
const skipOv = async () => { const b = await m.$('#ov-start'); if(b){ await b.click(); await m.waitForTimeout(400); } };
await skipOv(); await m.screenshot({path:OUT+'/r1-start.png'});
await m.click('#langbtn2'); await m.waitForTimeout(300); await m.click('[data-l="PL"]'); await m.waitForTimeout(1200); await m.screenshot({path:OUT+'/r2-start-pl.png'});
await m.fill('#wname', 'Anna'); await m.click('#begin'); await m.waitForTimeout(500);
// add a note on step 1, then confirm all steps
await m.click('.vstep[data-i="0"] [data-nok]'); await m.waitForTimeout(300); await m.fill('#nk-note', 'Schraube leicht schwergängig'); await m.click('#modals [data-ok]'); await m.waitForTimeout(400);
await m.screenshot({path:OUT+'/r3-note.png'});
const n = await m.evaluate(()=>document.querySelectorAll('.vstep [data-ok]').length);
for(let i=0;i<n;i++){ await m.click(`.vstep[data-i="${i}"] [data-ok]`); await m.waitForTimeout(350); }
console.log('items:', JSON.stringify(await m.evaluate(()=>JSON.parse(localStorage.getItem('gg_run_'+window.__tables.instructions[0].id)).items)).slice(0,160));
// leave without finishing → reopen → dialog offers finish
await m.goto(BASE+'/index3.html#/'); await m.waitForTimeout(500);
console.log('runs after leaving with all done:', JSON.stringify(await m.evaluate(()=>window.__tables.runs.map(r=>({fin:!!r.finished_at, n:Object.keys(r.items).length})))), 'local run left:', await m.evaluate(()=>!!localStorage.getItem('gg_run_'+window.__tables.instructions[0].id)));
await m.evaluate(()=>{ localStorage.setItem('gg_vlang',''); });
// simulate a stale local run with all done (older client) to test the finish dialog
await m.evaluate(()=>{ const r = window.__tables.instructions[0]; const items = {}; r.data.steps.filter(s=>!s.kind).forEach(s => items[s.id] = {ok:true, at:Date.now()}); localStorage.setItem('gg_run_'+r.id, JSON.stringify({id:'oldrun', worker:'Anna', startedAt:Date.now()-6e5, version:r.data.version, items, at:Date.now()-3e5})); });
await m.goto(BASE+'/index3.html#/v/'+vid); await m.waitForTimeout(1500); await skipOv();
await m.fill('#wname', 'Anna'); await m.click('#begin'); await m.waitForTimeout(500); await m.screenshot({path:OUT+'/r4-resume-all.png'});
await m.click('[data-resume]'); await m.waitForTimeout(1200); await m.screenshot({path:OUT+'/r5-finished.png'});
console.log('runs:', JSON.stringify(await m.evaluate(()=>window.__tables.runs.map(r=>({id:r.id, fin:!!r.finished_at, n:Object.keys(r.items).length})))));
console.log(errs.join('\n')||'NO ERRORS');
await browser.close();
