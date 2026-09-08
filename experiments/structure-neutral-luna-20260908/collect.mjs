import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import JSZip from 'jszip';
import { chromium } from 'playwright-core';
const out=import.meta.dirname,rows=[];
const norm=s=>String(s).replace(/\s/g,'');
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"');
for(const group of ['a','b','c','parent']){
 for(const name of await fs.readdir(path.join(out,group))){
  if(!/^[abc]\d-attempt-\d+\.json$/.test(name))continue;
  const r=JSON.parse(await fs.readFile(path.join(out,group,name),'utf8'));
  r.group=group;r.prefix=`${group}/${name.replace('.json','')}`;
  if(r.status==='rendered-unreviewed'){
   const zip=await JSZip.loadAsync(await fs.readFile(path.join(out,`${r.prefix}.pptx`)));
   const xml=await zip.file('ppt/slides/slide1.xml').async('string');
   const texts=[...xml.matchAll(/<a:t>(.*?)<\/a:t>/gs)].map(m=>decode(m[1]));
   const all=norm(texts.join(''));
   const c=r.spec.content;
   const expected=[r.spec.title,...(r.spec.blocks??[]).map(b=>b.text),...(c.items??[]).flatMap(i=>[i.title,i.body,...(i.points??[])]),...(c.levels??[]).flatMap(i=>[i.title,i.body]),...(c.steps??[]).map(i=>i.title)].filter(Boolean);
   const missing=expected.filter(t=>!all.includes(norm(t)));
   const sizes=[...new Set([...xml.matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)].map(m=>Number(m[1])/100))];
   const fonts=[...new Set([...xml.matchAll(/<a:(?:latin|ea)\b[^>]*typeface="([^"]+)"/g)].map(m=>m[1]))];
   r.verification={missingText:missing,fontSizesPt:sizes,fontFamilies:fonts,unexpectedSizes:sizes.filter(s=>![11.25,12.75,15.75,18.75].includes(s)),nativeShapes:(xml.match(/<p:sp>/g)??[]).length};
   if(missing.length||r.verification.unexpectedSizes.length)throw new Error(`${r.prefix}: ${JSON.stringify(r.verification)}`);
  }
  rows.push(r);
 }
}
rows.sort((a,b)=>a.spec.pageNumber-b.spec.pageNumber || (a.group==='parent')-(b.group==='parent') || a.attempt-b.attempt);
const cases=[...new Set(rows.map(r=>r.caseId))].map(id=>{
 const attempts=rows.filter(r=>r.caseId===id),luna=attempts.filter(r=>r.group!=='parent');
 const final=attempts.filter(r=>r.status==='rendered-unreviewed').at(-1);
 return {id,first:luna[0]?.status,lunaFinal:luna.at(-1)?.status,final:final?.prefix,attempts:attempts.map(r=>({prefix:r.prefix,status:r.status,assetId:r.spec.assetId,error:r.error,group:r.group,verification:r.verification}))};
});
const issues={a4:'Luna 第三次扩区撞上引导块；父任务保留原稿、调整区域后成功。不能判为必须拆页。',b3:'Luna 将筛选收敛误选为成熟度阶梯；其技术成功不算语义通过。父任务改用六层漏斗并保留原说明。',c3:'Luna 第二次同时扩区和缩短说明，不是同稿对照。父任务恢复原稿后单独验证。',c4:'Luna 第二次同时扩区和缩短说明，不是同稿对照；试验说明也混入成品页。父任务恢复原稿再验证。',a1:'首次调用成功，但中性标题带有共享样式覆盖问题；父任务修复后 Luna 原稿重跑。',a2:'同 a1 的样式修复；四项稿件不变，改为左结构与右侧说明。',a3:'六项短稿成功；共享样式修复后原稿重跑。',b1:'首次调用成功；父任务指出制作说明混入页面，Luna 修订并处理标点换行。',b2:'与 b1 结构内容相同，改为居中与两侧说明。',b4:'长标题小区域被拒绝；Luna 扩区并将完整含义移到旁文，短标题留在图内。',c1:'四级原稿宽区域首次调用成功。',c2:'与 c1 原稿相同，高度缩减并增加下方双列说明，首次调用成功。'};
await fs.writeFile(path.join(out,'audit.json'),JSON.stringify({model:'gpt-5.6-luna',reasoning:'high',firstPass:cases.filter(c=>c.first==='rendered-unreviewed').length,totalCases:cases.length,issues,cases},null,2));
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;');
const css='body{margin:24px auto;max-width:1380px;padding:0 20px;background:#F5F4EF;color:#20201D;font:16px/1.65 system-ui}article{padding:24px 0;border-top:1px solid #D8D5CC}img{display:block;width:100%}a{color:#8a4e43}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}pre{white-space:pre-wrap;font-size:13px;max-height:230px;overflow:auto}summary{cursor:pointer}h1{font-size:28px}h2{font-size:21px}';
await fs.writeFile(path.join(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>中性 Skin · Luna high 调用压力实验</title><style>${css}</style><h1>中性 Skin · 12 个稿件与布局实验</h1><p>Luna high 首轮技术成功 ${cases.filter(c=>c.first==='rendered-unreviewed').length}/12。成功不代表语义、内容控制与视觉全部通过。下面分别保留首次结果、Luna 后续尝试和父任务纠正。点击图片查看大图，旁边可下载可编辑 PPTX。</p><p><a href="README.md">实验结论</a> · <a href="audit.json">结构化审计</a></p>${cases.map(c=>{const entries=rows.filter(r=>r.caseId===c.id);const final=entries.find(r=>r.prefix===c.final);return `<article><h2>${c.id} · ${esc(entries[0].spec.title)}</h2><p>${esc(issues[c.id])}</p><p>首次：${c.first}；Luna 最后：${c.lunaFinal}。最终展示：${final?.group==='parent'?'父任务纠正／同稿对照':'Luna 产物'}。</p>${final?`<a href="${final.prefix}.png"><img src="${final.prefix}.png"></a><a href="${final.prefix}.pptx">下载可编辑 PPTX</a> · <a href="${final.prefix}.html">HTML</a>`:''}<details><summary>查看全部 ${entries.length} 次尝试与失败记录</summary>${entries.map(r=>`<p><b>${r.prefix} · ${r.status}</b> · ${r.spec.assetId} · ${r.spec.frame.width}×${r.spec.frame.height}</p>${r.status==='rejected'?`<pre>${esc(r.error)}</pre>`:`<div class="pair"><a href="${r.prefix}-html.png"><img src="${r.prefix}-html.png"></a><a href="${r.prefix}.png"><img src="${r.prefix}.png"></a></div><a href="${r.prefix}.pptx">PPTX</a>`}`).join('')}</details></article>`;}).join('')}`);
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{for(const group of ['a','b','c']){
 const subset=cases.filter(c=>c.id.startsWith(group));
 const html=`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#eee;font:18px system-ui}main{display:grid;grid-template-columns:1fr 1fr;gap:12px}img{width:100%}article{background:white;padding:8px}</style><main>${subset.map(c=>`<article>${c.id} · ${c.final}<img src="${c.final}.png"></article>`).join('')}</main>`;
 const file=path.join(out,`${group}-contact.html`);await fs.writeFile(file,html);
 const page=await browser.newPage({viewport:{width:1600,height:980}});await page.goto(pathToFileURL(file).href);await page.screenshot({path:path.join(out,`${group}-contact.png`),fullPage:true});await page.close();
}}finally{await browser.close();}
console.log(JSON.stringify({cases:cases.length,firstPass:cases.filter(c=>c.first==='rendered-unreviewed').length,renderedArtifacts:rows.filter(r=>r.verification).length}));
