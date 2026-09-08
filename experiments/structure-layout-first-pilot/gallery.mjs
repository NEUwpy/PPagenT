import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
const dir=import.meta.dirname;
const read=async p=>JSON.parse(await fs.readFile(path.join(dir,p),'utf8'));
const cases=['short','normal'],checks=[];
for(const id of cases){
 const trees=[];
 for(const appearance of ['plain','folded']){
  const stem=`renders/${id}-${appearance}-attempt-2`;
  const r=await read(stem+'.json'),tree=await read(stem+'.tree.json');
  assert.equal(r.status,'rendered-unreviewed');
  trees.push(tree);
  const zip=await JSZip.loadAsync(await fs.readFile(path.join(dir,stem+'.pptx')));
  const xml=await zip.file('ppt/slides/slide1.xml').async('string');
  const txt=[...xml.matchAll(/<a:t>(.*?)<\/a:t>/gs)].map(m=>m[1]).join('').replace(/\s/g,'');
  const expected=[r.spec.title,...r.spec.blocks.map(b=>b.text),...r.spec.content.items.flatMap(i=>[i.title,i.body])];
  assert(expected.every(s=>txt.includes(s.replace(/\s/g,''))));
  const fontSizesPt=[...new Set([...xml.matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)].map(m=>Number(m[1])/100))];
  assert(fontSizesPt.every(n=>[11.25,12.75,15.75,18.75].includes(n)));
  for(let i=0;i<4;i++){
   const node=tree.nodes.find(n=>n.name===(appearance==='plain'?`plain-surface-${i+1}`:`note-sheet-paper-${i}`));
   const region=r.spec.itemRegions[i];
   for(const k of ['left','top','width','height'])assert(Math.abs(node.frame[k]-region[k])<2,`${id} ${appearance} ${k}`);
  }
  checks.push({id,appearance,stem,fonts:fontSizesPt,manuscriptIntact:true,regionsRespected:true,shapeCount:(xml.match(/<p:sp>/g)??[]).length,source:r.execution,structureInvocation:appearance==='folded'?'invokeStructure custom build using original design':'none; plain control'});
 }
 const texts=t=>t.nodes.filter(n=>n.text).map(n=>({name:n.name,text:n.text,frame:n.frame,style:n.style}));
 assert.deepEqual(texts(trees[0]),texts(trees[1]),'Decoration must not move text or change typography');
}
const folded=await read('renders/normal-folded-attempt-2.tree.json');
const compact=await read('renders/short-folded-attempt-2.tree.json');
const fold=t=>t.nodes.find(n=>n.name==='note-sheet-fold-0').frame;
assert(Math.abs(fold(folded).width-fold(compact).width)<.1);
assert(Math.abs(fold(folded).height-fold(compact).height)<.1);
await fs.writeFile(path.join(dir,'checks.json'),JSON.stringify({checks,identicalTextGeometry:true,foldSizeStable:true},null,2));
const datasets={short:{title:'P1 · 原短稿',note:'左侧表达验收主张，右侧展开四项并列条件。'},normal:{title:'P1 · 常规稿',note:'主张与两列解释沿页面展开。四项说明与上一轮常规稿相同，仅重新断行。'}};
const panels=cases.map(id=>`<article id="${id}"><h2>${datasets[id].title}</h2><p>${datasets[id].note}</p><div class="buttons"><button data-id="${id}" data-view="plain">普通色块 · 同一排版</button><button data-id="${id}" data-view="folded" aria-pressed="true">折角便签 · 适配后</button><button data-id="${id}" data-view="old">上一版</button></div><div class="stage"><img width="1280" height="720" src="renders/${id}-folded-attempt-2.png"><svg viewBox="0 0 1280 720"></svg></div><p class="links"></p></article>`).join('');
const {plans}=await read('layout-plan.json');
await fs.writeFile(path.join(dir,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>P1 · 排版先行对照</title><style>body{max-width:1280px;padding:0 24px;margin:32px auto;background:#F5F4EF;color:#20201D;font:16px/1.65 system-ui}h1{font-size:28px}h2{font-size:22px}a{color:#975443}article{margin:40px 0;border-top:1px solid #d8d5cc;scroll-margin-top:80px}.buttons{display:flex;gap:10px;margin:18px 0}button{font:inherit;padding:8px 18px;background:transparent;border:1px solid #b9b4a9;cursor:pointer}button[aria-pressed=true]{background:#20201d;color:#f5f4ef}.stage{position:relative}.stage img{width:100%;height:auto;display:block}.stage svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:none}.regions .stage svg{display:block}.stage svg rect{fill:none;stroke:#a35d4f;stroke-width:1.5;stroke-dasharray:7 5}.stage[data-old=true] svg{display:none!important}nav{position:sticky;top:0;z-index:4;padding:12px;background:#f5f4eff5;border-bottom:1px solid #d8d5cc}nav a{margin-right:24px}small{color:#65635d}</style><body><h1>先有完整排版，再用结构改善表达</h1><p>两版使用同一份稿件、相同文字坐标与字号、相同项目区域。切换时只改变普通色块与便签设计，页面编排不动。</p><nav><a href="#short">原短稿</a><a href="#normal">常规稿</a><label><input id="regions" type="checkbox">显示排版给出的项目区域</label></nav>${panels}<p><a href="checks.json">同稿／同文字坐标／同区域检查</a> · <a href="layout-plan.json">先行排版方案</a> · <a href="README.md">实现与范围</a> · <a href="../structure-remaining-page-luna/index.html">返回三页看板</a></p><small>本轮由主任务完成；便签版通过真实 invokeStructure 自定义构建调用，复用原便签曲线、标题与图标。属于 P1 实验适配，未冒充已登记 preserved-design 接口，也未改正式 Layout。</small><script>const plans=${JSON.stringify(plans).replaceAll('<','\u003c')};const old={short:'../structure-remaining-page-luna/revisions/P1/P1-attempt-2',normal:'../structure-remaining-page-luna/revisions/P1-normal/P1-normal-attempt-1'};function select(id,view){const a=document.getElementById(id),p=plans.find(p=>p.id===id);const stem=view==='old'?old[id]:'renders/'+id+'-'+view+'-attempt-2';a.querySelector('img').src=stem+'.png';a.querySelector('.stage').dataset.old=view==='old';a.querySelector('.links').innerHTML='<a href="'+stem+'.pptx">下载可编辑 PPTX</a> · <a href="'+stem+'.png">查看原图</a>';a.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));a.querySelector('svg').innerHTML=p.itemRegions.map(r=>'<rect x="'+(r.left+p.frame.left)+'" y="'+(r.top+p.frame.top)+'" width="'+r.width+'" height="'+r.height+'"/>').join('');}['short','normal'].forEach(id=>select(id,'folded'));document.querySelectorAll('button').forEach(b=>b.onclick=()=>select(b.dataset.id,b.dataset.view));document.getElementById('regions').onchange=e=>document.body.classList.toggle('regions',e.target.checked);</script></body></html>`);
console.log('Four PPTX checked; text geometry identical between appearances; fold size stable');
