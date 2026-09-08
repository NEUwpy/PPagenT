import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
const dir=import.meta.dirname,read=async p=>JSON.parse(await fs.readFile(path.join(dir,p),'utf8'));
const {plans}=await read('layout-plan.json');
const checks=[];
for(const p of plans){
 const trees=[];
 for(const appearance of ['plain','designed']){
  const stem=`renders/${p.id}-${appearance}-attempt-3`;
  const r=await read(stem+'.json'),t=await read(stem+'.tree.json'),o=await read(stem+'.occupancy.json');
  assert.equal(r.status,'rendered-unreviewed');assert.deepEqual(r.measurements.overflow,[]);assert(r.measurements.fontReady);
  trees.push(t);
  const b=r.skin.bodyFrame,a=o.actualBounds;
  assert(a.left>=b.left-1&&a.top>=b.top-1&&a.left+a.width<=b.left+b.width+1&&a.top+a.height<=b.top+b.height+1);
  const zip=await JSZip.loadAsync(await fs.readFile(path.join(dir,stem+'.pptx'))),xml=await zip.file('ppt/slides/slide1.xml').async('string');
  const txt=[...xml.matchAll(/<a:t>(.*?)<\/a:t>/gs)].map(m=>m[1]).join('').replace(/\s/g,'');
  const expected=[p.title,...p.blocks.map(b=>b.text),...(p.content.steps??p.content.levels).flatMap(i=>[i.title,i.body??''])];
  assert(expected.every(s=>txt.includes(s.replace(/\s/g,''))));
  const fonts=[...new Set([...xml.matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)].map(m=>Number(m[1])/100))];
  assert(fonts.every(s=>[11.25,12.75,15.75,18.75].includes(s)));
  if(p.content.steps){
   p.layout.centers.forEach((y,i)=>{
    const node=t.nodes.find(n=>n.name===`simple-step-title-${i}`);
    assert(Math.abs(node.frame.top+node.frame.height/2-y)<.1);
    assert(Math.abs(node.frame.left+node.frame.width/2-p.layout.axis)<.1);
   });
  }else{
   p.layout.centers.forEach((c,i)=>{
    const node=t.nodes.find(n=>n.name===`maturity-level-index-${i+1}`);
    assert(Math.abs(node.frame.left+node.frame.width/2-c.x)<.1&&Math.abs(node.frame.top+node.frame.height/2-c.y)<.1);
    assert.equal(node.frame.width,node.frame.height);
   });
   const current=t.nodes.find(n=>n.name==='maturity-current-status'),target=t.nodes.find(n=>n.name==='maturity-target-status');
   assert(Math.abs(current.frame.left+current.frame.width/2-p.layout.centers[p.content.currentIndex].x)<.1);
   assert(Math.abs(target.frame.left+target.frame.width/2-p.layout.centers.at(-1).x)<.1);
  }
  checks.push({id:p.id,appearance,stem,fonts,contentIntact:true,plannedAnchorsMatched:true,actualBounds:a,structureInvocation:appearance==='plain'?'none':'invokeStructure layout-led-pilot',nativeShapes:(xml.match(/<p:sp>/g)??[]).length,images:(xml.match(/<p:pic>/g)??[]).length});
 }
 const texts=t=>t.nodes.filter(n=>n.text).map(n=>({name:n.name,text:n.text,frame:n.frame,style:n.style}));
 assert.deepEqual(texts(trees[0]),texts(trees[1]),p.id+' must keep text identical across appearances');
}
await fs.writeFile(path.join(dir,'checks.json'),JSON.stringify({pages:4,pptx:8,identicalTextGeometry:true,checks},null,2));
const labels={'funnel-wide':'漏斗 · 四层与对应依据','funnel-compact':'漏斗 · 五层与判断主张','ladder-wide':'阶梯 · 四级横向展开','ladder-compact':'阶梯 · 三级右下布局'};
const cards=plans.map(p=>`<article id="${p.id}"><h2>${labels[p.id]}</h2><p>${p.reason}</p><div class="tabs"><button data-id="${p.id}" data-view="plain">简洁表达 · 同一排版</button><button data-id="${p.id}" data-view="designed" aria-pressed="true">结构承接 · 修正版</button></div><div class="stage"><img width="1280" height="720" src="renders/${p.id}-designed-attempt-3.png"><svg viewBox="0 0 1280 720"></svg></div><p class="links"></p></article>`).join('');
await fs.writeFile(path.join(dir,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>排版先行 · 漏斗与阶梯</title><style>body{max-width:1280px;margin:32px auto;padding:0 24px;background:#F5F4EF;color:#20201D;font:16px/1.65 system-ui}h1{font-size:28px}h2{font-size:22px}a{color:#975443}article{border-top:1px solid #d8d5cc;margin:38px 0 55px;scroll-margin-top:85px}.tabs{display:flex;gap:12px;margin:18px 0}button{font:inherit;padding:8px 18px;background:transparent;border:1px solid #b9b4a9;cursor:pointer}button[aria-pressed=true]{background:#20201d;color:#f5f4ef}.stage{position:relative}.stage img{width:100%;height:auto;display:block}.stage svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:none}.anchors .stage svg{display:block}.stage svg circle{fill:none;stroke:#c25b45;stroke-width:1.5}.stage svg line{stroke:#c25b45;stroke-width:1;stroke-dasharray:5 5}nav{position:sticky;top:0;padding:12px;background:#f5f4eff5;z-index:5;border-bottom:1px solid #d8d5cc}nav a{margin-right:24px}small{color:#65635d}</style><body><h1>排版先行：漏斗与阶梯</h1><p>4 个页面、8 份可编辑 PPTX。简洁版与结构版共用稿件、文字位置、字号与阶段／等级位置。修订经过 3 轮实际渲染复核。</p><p>已保存的 P1 基线：main <code>cdcf6071</code>。本轮继续试验两个关系型结构。</p><nav><a href="#funnel-wide">四层漏斗</a><a href="#funnel-compact">五层漏斗</a><a href="#ladder-wide">四级阶梯</a><a href="#ladder-compact">三级阶梯</a><label><input type="checkbox" id="anchors">查看排版指定的位置</label></nav>${cards}<p><a href="checks.json">文字／字号／位置检查</a> · <a href="README.md">实验结论与范围</a> · <a href="../structure-layout-first-pilot/index.html">已认可的 P1 对照</a></p><small>父任务设计与执行，未冒充 Luna 独立通过；原造型的连续关系仍是适配约束。本轮自定义构建仅用于实验，未注册为全库通用能力。</small><script>const plans=${JSON.stringify(plans).replaceAll('<','\u003c')};function select(id,view){const p=plans.find(p=>p.id===id),a=document.getElementById(id),stem='renders/'+id+'-'+view+'-attempt-3';a.querySelector('img').src=stem+'.png';a.querySelector('.links').innerHTML='<a href="'+stem+'.pptx">下载可编辑 PPTX</a> · <a href="'+stem+'.png">查看原图</a>';a.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));a.querySelector('svg').innerHTML=p.content.steps?p.layout.centers.map(c=>'<line x1="'+p.frame.left+'" x2="'+(p.frame.left+p.frame.width)+'" y1="'+(p.frame.top+c)+'" y2="'+(p.frame.top+c)+'"/>').join(''):p.layout.centers.map(c=>'<circle cx="'+(p.frame.left+c.x)+'" cy="'+(p.frame.top+c.y)+'" r="25"/>').join('');}plans.forEach(p=>select(p.id,'designed'));document.querySelectorAll('button').forEach(b=>b.onclick=()=>select(b.dataset.id,b.dataset.view));document.getElementById('anchors').onchange=e=>document.body.classList.toggle('anchors',e.target.checked);</script></body></html>`);
console.log('8 PPTX: source content, fonts, bounds, anchors and identical text verified');
