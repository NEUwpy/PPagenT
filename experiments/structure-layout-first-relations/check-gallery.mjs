import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
const dir=import.meta.dirname,browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const p=await browser.newPage({viewport:{width:1360,height:1000}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(path.join(dir,'index.html')).href);
 const {plans}=JSON.parse(await fs.readFile(path.join(dir,'layout-plan.json'),'utf8'));
 for(const plan of plans){
  for(const view of ['plain','designed']){
   await p.locator(`[data-id="${plan.id}"][data-view="${view}"]`).click();
   await p.locator(`#${plan.id} img`).evaluate(img=>new Promise((res,rej)=>{if(img.complete&&img.naturalWidth===1280)return res();img.onload=res;img.onerror=rej;}));
   for(const href of await p.locator(`#${plan.id} .links a`).evaluateAll(es=>es.map(e=>e.getAttribute('href'))))await fs.access(path.resolve(dir,href));
  }
 }
 await p.locator('#anchors').check();assert.equal(await p.locator('#ladder-compact svg circle').count(),3);assert.equal(await p.locator('#funnel-compact svg line').count(),5);
 await p.locator('#ladder-compact .stage').screenshot({path:path.join(dir,'anchor-preview.png')});
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(dir,'gallery-checks.json'),JSON.stringify({variants:8,downloadsVerified:true,anchorsVerified:true,errors},null,2));
 console.log('Eight variants, downloads and anchor overlays verified');
}finally{await browser.close();}
