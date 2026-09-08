import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const dir=import.meta.dirname;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const page=await browser.newPage({viewport:{width:1380,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(dir,'index.html')).href);
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth===1280));
 assert.equal(await page.locator('article').count(),3);
 for(const id of ['P1','P2','P3']){
  const article=page.locator('#'+id),buttons=article.locator('button');
  for(let i=0;i<await buttons.count();i++){
   await buttons.nth(i).click();
   await article.locator('img').evaluate(img=>new Promise((resolve,reject)=>{if(img.complete&&img.naturalWidth===1280)return resolve();img.onload=resolve;img.onerror=reject;}));
   assert.equal(await buttons.nth(i).getAttribute('aria-pressed'),'true');
   for(const link of await article.locator('.links a').evaluateAll(es=>es.map(e=>e.getAttribute('href'))))await fs.access(path.resolve(dir,link));
  }
  await buttons.nth(0).click();
 }
 await page.locator('#overlay').check();
 assert(await page.locator('#P3 .occupied').count()===4);
 await page.locator('#overlay').uncheck();
 await page.locator('#P1').screenshot({path:path.join(dir,'revisions/gallery-P1.png')});
 assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(dir,'revisions/gallery-checks.json'),JSON.stringify({pages:3,variants:7,allDownloadsExist:true,overlays:true,errors},null,2));
 console.log('Three pages, seven comparisons, download links and overlay verified');
}finally{await browser.close();}
