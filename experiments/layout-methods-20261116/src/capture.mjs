import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const E=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(await fs.readFile(path.join(E,'content.json'),'utf8'));
const methods={marp:{file:'outputs/marp.html',selector:'section'},yoga:{file:'src/yoga/index.html',selector:'.slide'},seaslides:{file:'src/seaslides/index.html',selector:'section.slide'}};
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
for(const name of process.argv.slice(2).length?process.argv.slice(2):Object.keys(methods)){
 const m=methods[name],page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(E,m.file)).href,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
 const slide=page.locator(m.selector).first();
 const audit=await slide.evaluate((el,data)=>{
   const sr=el.getBoundingClientRect(),tx=el.textContent.replace(/\s/g,'');
   const items=[...el.querySelectorAll('h1,h2,h3,p,[data-body],[data-label]')].map(n=>{
     const r=n.getBoundingClientRect(),c=getComputedStyle(n);
     return {text:n.textContent,x:r.x-sr.x,y:r.y-sr.y,width:r.width,height:r.height,font:c.fontFamily,fontSize:c.fontSize,
       outside:r.left<sr.left-1||r.top<sr.top-1||r.right>sr.right+1||r.bottom>sr.bottom+1,
       overflow:n.scrollHeight>n.clientHeight+2||n.scrollWidth>n.clientWidth+2};
   });
   return {canvas:{width:sr.width,height:sr.height},coverage:data.groups.flatMap(g=>g.blocks).map(b=>({id:b.id,label:tx.includes(b.label.replace(/\s/g,'')),body:tx.includes(b.text.replace(/\s/g,''))})),items,
    images:[...el.querySelectorAll('img')].map(i=>({src:i.src.startsWith('data:')?'embedded':i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0,natural:[i.naturalWidth,i.naturalHeight],rendered:[i.width,i.height]})),fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family)};
 },data);
 audit.jsErrors=errors;
 await fs.writeFile(path.join(E,`evidence/${name}-dom-audit.json`),JSON.stringify(audit,null,2));
 await slide.screenshot({path:path.join(E,`outputs/${name}.png`),animations:'disabled'});
 console.log(name,JSON.stringify({coverage:audit.coverage,blockers:audit.items.filter(i=>i.outside||i.overflow).map(i=>i.text.slice(0,25)),images:audit.images.map(x=>x.loaded),jsErrors:errors}));
 await page.close();
}
await browser.close();
