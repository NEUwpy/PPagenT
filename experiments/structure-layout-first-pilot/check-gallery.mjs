import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
const dir=import.meta.dirname,browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const page=await browser.newPage({viewport:{width:1360,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(dir,'index.html')).href);
 for(const id of ['short','normal']){
  for(const view of ['plain','folded','old']){
   await page.locator(`[data-id="${id}"][data-view="${view}"]`).click();
   await page.locator(`#${id} img`).evaluate(img=>new Promise((res,rej)=>{if(img.complete&&img.naturalWidth===1280)return res();img.onload=res;img.onerror=rej;}));
   for(const href of await page.locator(`#${id} .links a`).evaluateAll(es=>es.map(e=>e.getAttribute('href'))))await fs.access(path.resolve(dir,href));
  }
  await page.locator(`[data-id="${id}"][data-view="folded"]`).click();
 }
 await page.locator('#regions').check();
 assert.equal(await page.locator('#normal svg rect').count(),4);
 await page.locator('#normal .stage').screenshot({path:path.join(dir,'layout-regions.png')});
 assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(dir,'gallery-checks.json'),JSON.stringify({variants:6,downloadsVerified:true,projectRegions:4,errors},null,2));
 console.log('Six variants, downloads, and region overlay checked');
}finally{await browser.close();}
