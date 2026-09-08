import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
const base=process.env.DASHBOARD_URL??'http://127.0.0.1:4194';
const out=import.meta.dirname;
const data=await fetch(base+'/api/dashboard-data').then(r=>r.json());
const records=data.records.filter(a=>a.structureSkill&&a.status==='core'&&a.userApprovedHtmlNative);
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1170,height:492}});const report=[];
try {
for(const a of records)for(const state of ['default','few','many']) {
 const url=new URL(a.componentPreviewUrl,base);url.searchParams.set('skin','neutral');url.searchParams.set('size','large');
 for(const c of a.componentControls)url.searchParams.set(c.key,state==='few'?c.values[0]:state==='many'?c.values.at(-1):(a.componentInitialSelection[c.key]??c.default));
 const response=await page.goto(url.href);await page.evaluate(()=>document.fonts.ready);
 const root=await page.locator('[data-ppt-root]').count();
 const clipped=await page.locator('[data-slot-content-type="text"],[data-text-flow-part]').evaluateAll(es=>es.filter(e=>/hidden|clip/.test(getComputedStyle(e).overflow)&&(e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2)).map(e=>e.textContent));
 const file=a.id+(state==='default'?'':'-'+state)+'.png';await page.screenshot({path:out+'/'+file});
 report.push({id:a.id,name:a.name,state,selection:Object.fromEntries(url.searchParams),status:response.status(),root,clipped,file});
 console.log(a.id,state,response.status(),root,clipped.length);
}
} finally {await browser.close();await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));}
await fs.writeFile(out+'/index.html','<!doctype html><meta charset="utf-8"><title>已审批结构 · 中性 Skin</title><style>body{background:#f5f4ef;color:#20201d;font:16px sans-serif;margin:32px}article{margin:28px 0;border-top:1px solid #d8d5cc;padding-top:12px}.states{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}img{width:100%}button{font:inherit}small{color:#85837b}</style><h1>35 个已审批结构 · 中性 Skin</h1><p>每个结构比较默认、较少、较多内容状态（均为大尺寸）。保留原结构几何，检查中性表达。此页为 HTML 审阅，不是 Luna 整页调用验证。</p>'+records.map(a=>'<article><h2>'+a.name+'</h2><div class="states">'+report.filter(r=>r.id===a.id).map(r=>'<div><small>'+({default:'默认内容',few:'较少内容',many:'较多内容'}[r.state])+'</small><a href="'+r.file+'"><img src="'+r.file+'"></a></div>').join('')+'</div></article>').join(''));
if(report.some(r=>r.status!==200||r.root!==1||r.clipped.length))process.exitCode=1;
