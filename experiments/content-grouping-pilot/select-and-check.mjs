import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { bindExpressions } from '../../src/composition/content-stages.mjs';
const here=import.meta.dirname;
const read=async n=>JSON.parse(await fs.readFile(path.join(here,n),'utf8'));
const draft=await read('content-draft.json'),review=await read('grouping-review.json'),selections=await read('selections.json');
bindExpressions({draft,review,selections});
const rows={
 'evidence-demand-fact':[['8 周','120 份申请中，'],['74 份','来自三个课程项目集群，占 61.7%；'],['其中 52 份','申请了相同的 GPU 环境模板。']],
 'evidence-record-fact':[['78 份','完成运行的记录中，'],['14 份','缺少实际参数或输出位置，缺口率为 17.9%；'],['14 份中有 9 份','来自两个项目集群。']],
 'evidence-capacity-fact':[['峰值周全量人工审核预计需要','5.0 个管理员工作日，'],['高于每周','3.5 个可支配工作日；'],['限量 5 个项目的试点预计需要','2.6 个工作日，'],['模板稳定后预计降到','1.4 个。']],
};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
let metrics;
try{
 const page=await browser.newPage({viewport:{width:1320,height:900}});
 await page.goto(`file:///${here.replaceAll('\\','/')}/text-draft.html`);
 await page.evaluate(rows=>{
  for(const [id,items] of Object.entries(rows)){
   const section=document.querySelector(`[data-group="${id}"]`),p=section.querySelector('p');
   if(items.flat().join('').replace(/\s/g,'')!==p.textContent.replace(/\s/g,''))throw new Error('表格改写原文');
   const table=document.createElement('table');table.style.cssText='font-size:18px;line-height:24px;border-collapse:collapse;width:100%';
   for(const row of items){const tr=table.insertRow();for(const text of row){const td=tr.insertCell();td.textContent=text;td.style.cssText='border-bottom:1px solid #bbb;padding:4px 6px 4px 0;vertical-align:top';}}
   p.replaceWith(table);
  }
 },rows);
 metrics=await page.evaluate(()=>[...document.querySelectorAll('.lane')].map(lane=>{const [fact,interpretation]=lane.children;return{groupId:fact.dataset.group,actualBottom:fact.querySelector('table').getBoundingClientRect().bottom,nextGroupTop:interpretation.getBoundingClientRect().top,overlap:fact.querySelector('table').getBoundingClientRect().bottom>interpretation.getBoundingClientRect().top};}));
 await page.locator('.page').screenshot({path:path.join(here,'table-trial.png')});
 await fs.writeFile(path.join(here,'table-trial.html'),await page.content());
}finally{await browser.close();}
const final=selections.map(s=>({...s,medium:'text',reason:s.medium==='table'?'本轮保留完整原文，表格试排超过证据区并侵入解读区。先保留文字；后续若重组为表格，须另做字段映射与容量复核。':s.reason}));
await fs.writeFile(path.join(here,'expression-review.json'),JSON.stringify({status:'revised',metrics,decision:'本轮采用完整原文文字表达；不通过删减限制换取表格空间。'},null,2));
await fs.writeFile(path.join(here,'selections-reviewed.json'),JSON.stringify(final,null,2));
await fs.writeFile(path.join(here,'bound-expressions.json'),JSON.stringify(bindExpressions({draft,review,selections:final}),null,2));
console.log(JSON.stringify(metrics));
