import fs from 'node:fs/promises';
import path from 'node:path';
const root=import.meta.dirname;
const evidence=JSON.parse(await fs.readFile(path.join(root,'evidence-summary.json'),'utf8'));
let targetedReview={};
try{targetedReview=JSON.parse(await fs.readFile(path.join(root,'parent-targeted.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const cards=[];
for(const batch of evidence.batches){
 for(const [i,c] of batch.cases.entries()){
  const n=String(i+1).padStart(2,'0');
  const png=batch.batch===1?`batch-1/slide-${n}.png`:batch.batch===2?`batch-2/rendered/slide-${n}.png`:`batch-3/rendered-${n}.png`;
  cards.push({id:c.caseId,mode:'自然选型',title:c.title,selected:c.selectedAssetIds.join(', '),review:c.visualReview,png,deck:`batch-${batch.batch}/candidate.pptx`});
 }
}
for(const batch of evidence.targeted){
 for(const [i,c] of batch.choices.entries()){
  const n=String(i+1).padStart(2,'0');
  const png=batch.group==='a'?`targeted-a/slide-${n}.png`:batch.group==='b'?`targeted-b/rendered/slide-${n}.png`:`targeted-c/rendered-${n}.png`;
  cards.push({id:c.caseId,mode:'指定补测',title:c.caseId,selected:c.selectedAssetIds.join(', '),review:targetedReview[c.caseId]??'父级复核中',png,deck:batch.deck});
 }
}
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>结构适配审查</title><style>body{font:16px/1.6 system-ui;background:#f5f4ef;color:#252521;margin:32px auto;max-width:1400px;padding:0 24px}h1{margin-bottom:8px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(500px,1fr));gap:24px}article{background:white;padding:18px;border:1px solid #ddd}img{width:100%;height:auto}small{color:#666}p{margin:10px 0}.status{font-weight:600}a{color:#28567c}button{padding:8px 16px;margin:12px 8px 24px 0;cursor:pointer}</style><h1>Luna high 结构适配审查</h1><p>35 稿自然选型覆盖 ${evidence.coverage.natural} 种；另 8 页指定补测。合计调用覆盖 ${evidence.coverage.combined}/${evidence.coverage.total} 种。调用成功不代表视觉通过。</p><p>自然选型保留首轮结果，补测单独呈现。以下均为导出 PPTX 后重新导入的页面图。</p><button onclick="filter('全部')">全部</button><button onclick="filter('自然选型')">自然选型</button><button onclick="filter('指定补测')">指定补测</button><main>${cards.map(c=>`<article data-mode="${c.mode}"><small>${esc(c.id)} · ${c.mode}</small><h2>${esc(c.title)}</h2><small>${esc(c.selected)}</small><a href="${c.png}"><img loading="lazy" src="${c.png}"></a><p class="status">${esc(c.review)}</p><a href="${c.deck}">可编辑 PPTX</a></article>`).join('')}</main><script>function filter(mode){document.querySelectorAll('article').forEach(el=>el.hidden=mode!=='全部'&&el.dataset.mode!==mode)}</script></html>`;
await fs.writeFile(path.join(root,'gallery.html'),html);
console.log(`Gallery: ${cards.length} pages`);
