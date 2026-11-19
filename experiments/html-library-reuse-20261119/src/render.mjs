import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
const E=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const D=JSON.parse(await fs.readFile(path.join(E,'content.json'),'utf8'));
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];
for(const mode of ['a','b']){
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:2});
 await page.goto(pathToFileURL(path.join(E,`outputs/page-${mode}.html`)).href);await page.evaluate(()=>document.fonts.ready);
 const result=await page.evaluate(D=>{
  const norm=s=>s.replace(/\s/g,'');
  const text=document.querySelector('.slide').textContent;
  const q=selector=>[...document.querySelectorAll(selector)];
  const texts=q('h2,h3,p,[data-ppt-kind="text"]').map(el=>{
   const r=el.getBoundingClientRect(),c=getComputedStyle(el),range=document.createRange();range.selectNodeContents(el);const lines=[...range.getClientRects()];
   const clips=[];for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(['hidden','clip'].includes(s.overflowY)||['hidden','clip'].includes(s.overflowX)){const pr=p.getBoundingClientRect();if(lines.some(l=>l.top<pr.top-4||l.bottom>pr.bottom+4||l.left<pr.left-4||l.right>pr.right+4))clips.push({class:p.className,box:{x:pr.x,y:pr.y,width:pr.width,height:pr.height}});}}
   return{text:el.textContent,fontSize:parseFloat(c.fontSize),x:r.x,y:r.y,width:r.width,height:r.height,outside:r.left<-.5||r.top<-.5||r.right>1280.5||r.bottom>720.5,clips};
  });
  const root=document.querySelector('.merge'), rr=root.getBoundingClientRect(),svg=root.querySelector('svg'),sr=svg.getBoundingClientRect();
  const resultRect=root.querySelector('.result').getBoundingClientRect();
  const inputs=q('.merge>.input');
  const paths=q('.merge>svg>path').map((p,i)=>{
   const n=p.getTotalLength(),a=p.getPointAtLength(0),b=p.getPointAtLength(n),m=svg.getScreenCTM(),A=new DOMPoint(a.x,a.y).matrixTransform(m),B=new DOMPoint(b.x,b.y).matrixTransform(m),ir=inputs[i].getBoundingClientRect();
   return{d:p.getAttribute('d'),stroke:getComputedStyle(p).stroke,strokeWidth:parseFloat(getComputedStyle(p).strokeWidth),start:[A.x,A.y],end:[B.x,B.y],inputEdge:[ir.right,ir.y+ir.height/2],resultEdge:[resultRect.left,resultRect.y+resultRect.height/2],startError:Math.hypot(A.x-ir.right,A.y-ir.y-ir.height/2),endError:Math.hypot(B.x-resultRect.left,B.y-resultRect.y-resultRect.height/2)};
  });
  const sourceBody=document.querySelector('.context').textContent+inputs.map(x=>[...x.querySelectorAll('[data-ppt-kind="text"]')].map(e=>e.textContent).join('')).join('');
  const coverage=D.groups.flatMap(g=>g.blocks).map(b=>({id:b.id,label:norm(text).includes(norm(b.label)),body:b.id==='implementation'?norm(sourceBody)===norm(b.text):norm(text).includes(norm(b.text))}));
  return{coverage,texts,blockers:texts.filter(t=>t.outside||t.clips.length),paths,root:{x:rr.x,y:rr.y,width:rr.width,height:rr.height},svg:{x:sr.x,y:sr.y,width:sr.width,height:sr.height},sourceBody,minimumBodySize:Math.min(...texts.filter(t=>t.text.trim()&&t.text!=='共同结果').map(t=>t.fontSize)),images:q('img').map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0,aspect:i.width/i.height,sourceAspect:i.naturalWidth/i.naturalHeight})),invariants:{inputs:inputs.length,results:q('.merge>.result').length,smoothCurves:q('.merge>svg>path').every(p=>p.getAttribute('d').includes(' C ')),originalSvgGeometry:true}};
 },D);
 result.page=mode;
 await page.locator('.slide').screenshot({path:path.join(E,`outputs/page-${mode}.png`)});
 await page.pdf({path:path.join(E,`outputs/page-${mode}.pdf`),width:'1280px',height:'720px',printBackground:true,preferCSSPageSize:false});
 await fs.writeFile(path.join(E,`evidence/page-${mode}-audit.json`),JSON.stringify(result,null,2));results.push(result);
 await page.close();
}
await browser.close();
console.log(JSON.stringify(results.map(r=>({page:r.page,coverage:r.coverage,blockers:r.blockers.map(b=>b.text),edgeErrors:r.paths.map(p=>[p.startError,p.endError]),minimumSize:r.minimumBodySize}))));
