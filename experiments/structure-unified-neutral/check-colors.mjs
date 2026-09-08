import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1170,height:492}});
const base=process.env.DASHBOARD_URL??'http://127.0.0.1:4206';
const report={};
try {
 for(const id of ['convergence-many-to-one-003','convergence-simple-funnel-001','convergence-funnel-001','cycle-loop-001']){
  await page.goto(`${base}/api/component-preview?library=core&id=${id}&skin=neutral`);
  report[id]=await page.locator('[data-ppt-root] [data-ppt-name]').evaluateAll(es=>es.map(e=>({name:e.dataset.pptName,fill:getComputedStyle(e).fill,stroke:getComputedStyle(e).stroke,background:getComputedStyle(e).backgroundColor})));
 }
 const lanes=report['convergence-many-to-one-003'].filter(e=>/^merge-lane-/.test(e.name));
 assert.ok(lanes.length>2);
 assert.equal(new Set(lanes.map(e=>e.stroke)).size,lanes.length);
 const firstSimple=report['convergence-simple-funnel-001'].find(e=>e.name==='simple-step-body-0');
 const firstComplex=report['convergence-funnel-001'].find(e=>/step-body-0$/.test(e.name));
 assert.ok(firstSimple&&firstComplex);
 assert.equal(firstSimple.fill,firstComplex.fill);
 const ring=report['cycle-loop-001'];
 for(const band of ring.filter(e=>/^cycle-band-/.test(e.name))){
  const arrow=ring.find(e=>e.name===band.name.replace('band','arrow'));
  assert.equal(band.fill,arrow.fill);
 }
 await fs.writeFile(new URL('color-checks.json',import.meta.url),JSON.stringify(report,null,2));
 console.log('PASS: distinct convergence levels; identical source funnel paint agrees; cycle band and arrow agree.');
}finally{await browser.close();}
