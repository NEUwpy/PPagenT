import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import assert from 'node:assert/strict';
const dir=import.meta.dirname;
const read=async f=>JSON.parse(await fs.readFile(path.join(dir,f),'utf8'));
const groups=[
 {id:'P1',title:'P1 · 交接验收',note:'原稿每项说明只有 7–8 字。默认展示新编的常规稿，可切换原短稿修正版和 Luna 旧稿。',variants:[
  {label:'常规稿 · 新编对照',stem:'revisions/P1-normal/P1-normal-attempt-1',note:'每项增加接手者视角的解释，说明共 98 字（含标点）。主张、解释和便签实际左缘对齐；这是新增稿件，不是原短稿等量修订。'},
  {label:'原短稿 · 修正版',stem:'revisions/P1/P1-attempt-2',note:'保持四项说明原文，合并散落的主张与辅助句，形成左侧验收主张、右侧并列条件。'},
  {label:'Luna 旧稿',stem:'luna/P1/P1-attempt-1',note:'此前旧稿。主张、可见便签与底部说明缺少共同对齐关系。'}]},
 {id:'P2',title:'P2 · 反馈筛选',note:'将依据与漏斗逐层对齐，并以细线标明对应关系。',variants:[
  {label:'修正版',stem:'revisions/P2/P2-attempt-2',note:'来源放到漏斗入口附近，依据按实际标签中心逐行对齐。内容与四层关系保留。'},
  {label:'Luna 旧稿',stem:'luna/P2/P2-attempt-1',note:'此前旧稿。文字从页面左边排起，漏斗在右边，阅读者需要自行跨区域匹配。'}]},
 {id:'P3',title:'P3 · 维护能力',note:'行动重点放进阶梯左上方空白，保留四级全貌。',variants:[
  {label:'修正版',stem:'revisions/P3/P3-attempt-2',note:'模块标题与解释组成阅读单元。四级正文只增加语义换行，修正“抢修”“故障”等孤字，当前第 2 级和目标第 4 级均保留。'},
  {label:'Luna 旧稿',stem:'luna/P3/P3-attempt-1',note:'此前旧稿。顶部与右侧重复说明，阶梯被缩到左侧。'}]}
];
const norm=s=>s.replace(/\s/g,'');
const checks=[];
for(const group of groups)for(const v of group.variants){
 const record=await read(v.stem+'.json');
 const occ=await read(v.stem+'.occupancy.json');
 v.spec=record.spec;v.areas=occ.areas;v.free=record.remainingPage.bands.flatMap(b=>b.free.map(f=>({...f,top:b.top,height:b.height})));
 if(!v.stem.startsWith('revisions/'))continue;
 const zip=await JSZip.loadAsync(await fs.readFile(path.join(dir,v.stem+'.pptx')));
 const xml=await zip.file('ppt/slides/slide1.xml').async('string');
 const txt=[...xml.matchAll(/<a:t>(.*?)<\/a:t>/gs)].map(m=>m[1].replaceAll('&amp;','&').replaceAll('&gt;','>').replaceAll('&lt;','<')).join('');
 const tree=await read(v.stem+'.tree.json');
 const expected=[record.spec.title,...record.spec.blocks.map(b=>b.text),...tree.nodes.filter(n=>n.text).map(n=>n.text)];
 const missing=expected.filter(t=>!norm(txt).includes(norm(t)));
 const sizes=[...new Set([...xml.matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)].map(m=>Number(m[1])/100))];
 assert.deepEqual(missing,[]);assert(sizes.every(s=>[11.25,12.75,15.75,18.75].includes(s)));assert.deepEqual(record.measurements.overflow,[]);
 const old=(await read(`luna/${group.id}/${group.id}-attempt-1.json`)).spec;
 if(group.id==='P1'&&record.caseId==='P1')assert.deepEqual(record.spec.content,old.content);
 if(group.id==='P2')assert.deepEqual(record.spec.content,old.content);
 if(group.id==='P3'){
  assert.equal(record.spec.content.currentIndex,1);
  record.spec.content.levels.forEach((l,i)=>assert.equal(norm(l.body),norm(old.content.levels[i].body)));
  assert(tree.nodes.filter(n=>n.name.endsWith('text-body')).every(n=>!n.text.split('\n').some(line=>line.length===1)));
 }
 checks.push({stem:v.stem,missingText:missing,fontSizesPt:sizes,nativeShapes:(xml.match(/<p:sp>/g)??[]).length,pictureObjects:(xml.match(/<p:pic>/g)??[]).length,relationshipLines:(record.spec.relationshipLines??[]).length,sourceContent:record.caseId==='P1-normal'?'new-expanded-manuscript':'original-facts-preserved',visualReview:'Parent reviewed actual reimported PPTX PNG; accepted for this revision preview, not evidence of independent Luna stability.'});
}
await fs.writeFile(path.join(dir,'revisions/checks.json'),JSON.stringify(checks,null,2));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const cards=groups.map(g=>`<article id="${g.id}"><h2>${g.title}</h2><p>${g.note}</p><div class="tabs">${g.variants.map((v,i)=>`<button data-page="${g.id}" data-variant="${i}" aria-pressed="${i===0}">${v.label}</button>`).join('')}</div><div class="stage"><img alt="${g.title}" width="1280" height="720" src="${g.variants[0].stem}.png"><svg viewBox="0 0 1280 720"></svg></div><p class="note"></p><p class="links"></p></article>`).join('');
await fs.writeFile(path.join(dir,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>结构与整页排版 · 修正版</title><style>body{max-width:1280px;margin:30px auto;padding:0 24px;background:#F5F4EF;color:#20201D;font:16px/1.65 system-ui}h1{font-size:28px}h2{font-size:22px}a{color:#975443}nav{position:sticky;top:0;background:#f5f4eff5;border-bottom:1px solid #d8d5cc;padding:14px 0;z-index:4}nav a,nav label{margin-right:24px}article{margin:35px 0 55px;padding-top:12px;border-top:1px solid #d8d5cc}.tabs{display:flex;gap:10px;margin:16px 0}button{font:inherit;cursor:pointer;border:1px solid #b9b4a9;background:transparent;padding:7px 18px;color:#4b4a45}button[aria-pressed=true]{background:#20201d;color:#f5f4ef;border-color:#20201d}.stage{position:relative}.stage img{display:block;width:100%;height:auto}.stage svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.position{fill:none;stroke:#3477c4;stroke-width:2;stroke-dasharray:8 6}.occupied{fill:#c9655020;stroke:#bb6349;stroke-width:1}.free{fill:#38865318;stroke:none}.text{fill:none;stroke:#7253a2;stroke-width:1.5}body:not(.overlays) svg{display:none}.note{color:#4b4a45}small{color:#65635d}</style><body><h1>结构与整页排版 · 修正版</h1><p><a href="../structure-layout-first-pilot/index.html">查看最新 P1：先排版，再适配结构（普通色块／便签对照）</a></p><p>本轮由主任务接手修正并检查实际 PPT 渲染。默认展示修正版；旧稿可切换对比。</p><nav><a href="#P1">P1 交接验收</a><a href="#P2">P2 反馈筛选</a><a href="#P3">P3 维护能力</a><label><input id="overlay" type="checkbox">查看占位与文字区域</label></nav>${cards}<p><a href="luna-audit.html">Luna 原始实验和全部失败记录</a> · <a href="revisions/checks.json">修正版文字与字号检查</a> · <a href="README.md">实验说明</a></p><small>修正版已由主任务目视复核；这是纠正后的成稿展示，不把它计为 Luna 独立首轮通过。</small><script>const groups=${JSON.stringify(groups).replaceAll('<','\u003c')};const rect=(f,c)=>'<rect class="'+c+'" x="'+f.left+'" y="'+f.top+'" width="'+f.width+'" height="'+f.height+'"/>';function select(id,i){const g=groups.find(g=>g.id===id),v=g.variants[i],a=document.getElementById(id);a.querySelector('img').src=v.stem+'.png';a.querySelector('.note').textContent=v.note;a.querySelector('.links').innerHTML='<a href="'+v.stem+'.pptx">下载可编辑 PPTX</a> · <a href="'+v.stem+'.png">查看原图</a>';a.querySelectorAll('button').forEach((b,j)=>b.setAttribute('aria-pressed',j===i));a.querySelector('svg').innerHTML=v.free.map(f=>rect(f,'free')).join('')+rect(v.spec.frame,'position')+v.areas.map(x=>rect(x.frame,'occupied')).join('')+v.spec.blocks.map(x=>rect(x.frame,'text')).join('');}groups.forEach(g=>select(g.id,0));document.querySelectorAll('button').forEach(b=>b.onclick=()=>select(b.dataset.page,Number(b.dataset.variant)));document.getElementById('overlay').onchange=e=>document.body.classList.toggle('overlays',e.target.checked);</script></body></html>`);
console.log('Revision gallery and four PPTX checks complete');

