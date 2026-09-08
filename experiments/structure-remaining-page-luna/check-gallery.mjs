import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const dir=import.meta.dirname;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const page=await browser.newPage({viewport:{width:1360,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(dir,'index.html')).href);
 await page.locator('article').last().scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>[...document.querySelectorAll('.stage img')].every(i=>i.complete&&i.naturalWidth===1280));
 assert.equal(await page.locator('article').count(),4);
 assert.equal(await page.locator('details').count(),3);
 const links=await page.locator('a').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
 for(const link of links)await fs.access(path.resolve(dir,link));
 for(const layer of ['position','occupied','free','text']){
  await page.locator(`[data-layer="${layer}"]`).check();
  assert.equal(await page.locator('body').evaluate((b,k)=>b.classList.contains(`hide-${k}`),layer),false);
 }
 await page.locator('article').nth(2).locator('.stage').screenshot({path:path.join(dir,'gallery-overlay.png')});
 await fs.writeFile(path.join(dir,'gallery-checks.json'),JSON.stringify({images:4,rejectionRecords:3,links:links.length,layers:4,errors},null,2));
 assert.deepEqual(errors,[]);
 console.log('Gallery: four PNGs, three rejected records, links and four overlay toggles verified');
}finally{await browser.close();}
