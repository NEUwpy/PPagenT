import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(pathToFileURL(path.join(import.meta.dirname,'index.html')).href);
 for(const layer of ['position','occupied','text'])await page.locator(`[data-layer="${layer}"]`).check();
 const stage=page.locator('.stage').nth(2);
 if(await stage.locator('.occupied').count()!==4)throw new Error('Expected four measured occupied groups');
 await stage.screenshot({path:path.join(import.meta.dirname,'occupancy-overlay.png')});
 for(const layer of ['position','occupied','text'])await page.locator(`[data-layer="${layer}"]`).uncheck();
 if(await stage.locator('.occupied').first().isVisible())throw new Error('Overlay toggle failed');
 console.log('Three overlay controls and final-page preview verified');
}finally{await browser.close();}
