import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
import MarkdownIt from 'markdown-it';
const out=import.meta.dirname,root=path.resolve(out,'../..'),run=path.join(root,'outputs/m1-reading-units-ab-20260917');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8')),sha=x=>createHash('sha256').update(x).digest('hex');
const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const cases=await read(path.join(run,'cases.json')),results=await read(path.join(run,'results.json'));
const latest=path.join(out,'latest');await fs.mkdir(latest,{recursive:true});
const cards=[],checks=[],units=[];
const paragraphs=p=>p.pages.map(page=>`<h4>${esc(page.pageId)} · ${esc(page.claim)}</h4>${page.groups.map(g=>`<h5>${esc(g.heading)}</h5>${g.blocks.map(b=>`<div class="unit">${b.label?`<b>${esc(b.label)}</b><br>`:''}${esc(b.text)}</div>`).join('')}`).join('')}`).join('');
for(const c of cases){
 const pair=[];
 const manifests=[];
 for(const profile of ['A','B']){
  const id=profile+'--'+c.id,dir=path.join(run,id),r=results.find(r=>r.id===id),manifest=await read(path.join(dir,'manifest.json'));
  manifests.push(manifest);
  const plan=await read(path.join(dir,'run/revision-0/semantic-plan.json'));
  const initial=await read(path.join(dir,'run/revision-0/content-plan.json'));
  const visible=await read(path.join(dir,'run/revision-0/visible-plan.json'));
  const review=await read(path.join(dir,'run/revision-0/semantic-check.json'));
  for(const [stage,p]of [['content',initial],['expression',plan]])for(const page of p.pages)for(const g of page.groups)for(const b of g.blocks)units.push({case:c.id,profile,stage,pageId:page.pageId,group:g.heading,blockId:b.id,label:b.label??null,text:b.text,sourceIds:b.sourceIds});
  await fs.writeFile(path.join(latest,id+'-plan.json'),JSON.stringify({source:c.source,content:initial,expression:plan,visible,review},null,2));
  let images='',artifact=null;
  if(r.status==='awaiting-user-review'){
   const state=await read(path.join(dir,'run/state.json'));artifact=path.resolve(dir,'run',state.grayDraft.artifactDirectory);
   const editable=await read(path.join(artifact,'editable-check.json'));assert.equal(editable.accepted,true);
   await fs.copyFile(path.join(artifact,'gray-draft.pptx'),path.join(latest,id+'.pptx'));
   for(let i=1;i<=state.pages.length;i++){
    const name=id+'-'+i+'.png';await fs.copyFile(path.join(artifact,'preview',`slide-${String(i).padStart(2,'0')}.png`),path.join(latest,name));
    images+=`<figure><figcaption>实际 PPTX 重导入 · 第 ${i} 页</figcaption><a href="latest/${name}"><img src="latest/${name}" alt="${id} 第${i}页"></a></figure>`;
   }
   checks.push({id,pages:state.pages.length,artifactDirectory:state.grayDraft.artifactDirectory,editable:true,pptxSha256:sha(await fs.readFile(path.join(latest,id+'.pptx')))});
  }
  pair.push(`<article><h3>${profile} · ${plan.pages.length} 页规划${artifact?' / 已导出':' / 未导出'}</h3><p>${artifact?`<a href="latest/${id}.pptx">下载原生 PPTX</a>`:'流程停止，保留规划实文；以下文字排版不是 PPT 预览。'}</p><a href="latest/${id}-plan.json">原稿、两阶段计划及审稿原始记录</a><details ${artifact?'':'open'}><summary>内容阶段：如何形成单元</summary>${paragraphs(initial)}</details><details ${artifact?'':'open'}><summary>表达阶段：最终阅读单元</summary>${paragraphs(plan)}</details>${images}</article>`);
 }
 for(const k of ['model','thinking','maxTokens','timeout','maxAttempts','maxRevisions','area','hashes'])assert.deepEqual(manifests[0][k],manifests[1][k]);
 for(const stage of ['review','layout']){
  const systems=[];
  for(const profile of ['A','B']){
   const dir=path.join(run,profile+'--'+c.id),names=(await fs.readdir(dir)).filter(f=>f.endsWith(`-${stage}.messages.json`)).sort();
   if(names.length)systems.push((await read(path.join(dir,names[0]))).messages[0].content);
  }
  if(systems.length===2)assert.equal(systems[0],systems[1]);
 }
 cards.push(`<section id="${c.id}"><h2>${esc(c.name)}</h2><details><summary>原稿</summary><pre>${esc(c.source)}</pre></details><div class="pair">${pair.join('')}</div></section>`);
}
// Read-only evidence inventory, not a semantic score or automatic verdict.
await fs.writeFile(path.join(out,'reading-units.json'),JSON.stringify({purpose:'逐项比较内容与表达阶段的标签/实文；不自动判定独立阅读价值',units},null,2));
const manifest=await read(path.join(run,'A--hierarchy/manifest.json'));
for(const[f,h]of Object.entries(manifest.hashes))assert.equal(sha(await fs.readFile(path.join(root,f))),h);
const zip=new JSZip(),files=[];
async function walk(dir,rel=''){for(const e of await fs.readdir(dir,{withFileTypes:true})){const r=rel?rel+'/'+e.name:e.name,p=path.join(dir,e.name);if(e.isDirectory())await walk(p,r);else{const d=await fs.readFile(p);zip.file(r,d);files.push({path:r,bytes:d.length,sha256:sha(d)});}}}
await walk(run);const packed=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});await fs.writeFile(path.join(out,'run-evidence.zip'),packed);
const back=await JSZip.loadAsync(packed);for(const f of files)assert.equal(sha(await back.file(f.path).async('nodebuffer')),f.sha256);
await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({scope:'single paired exploratory run; B not promoted; M1 not passed',configMatched:true,unchangedSnapshots:true,results,artifacts:checks,archiveSha256:sha(packed),files},null,2));
const report=new MarkdownIt().render(await fs.readFile(path.join(out,'README.md'),'utf8'));
await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>阅读单元 A/B：缺口未补上</title><style>body{font:17px/1.7 system-ui;color:#24313a;background:#f4f6f8;max-width:1700px;margin:24px auto;padding:0 22px}nav,section,main{background:white;padding:22px;margin:18px 0;border:1px solid #d4dce2}nav{position:sticky;top:0}a{color:#17638a}nav a{margin-right:20px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{min-width:0}img{width:100%;border:1px solid #ccd4dc}figure{margin:22px 0}.unit{padding:10px;border-left:3px solid #ccd5dd;margin:8px 0;background:#f4f5f6}pre{white-space:pre-wrap}h4{margin-bottom:8px}h5{font-size:17px;margin:10px 0}table{border-collapse:collapse}td,th{padding:9px;border:1px solid #ccd4dc;vertical-align:top;text-align:left}@media(max-width:950px){.pair{grid-template-columns:1fr}}</style><nav><a href="#report">结论与缺口</a>${cases.map(c=>`<a href="#${c.id}">${esc(c.name)}</a>`).join('')}</nav><main id="report">${report}</main>${cards.join('')}</html>`);
const html=await fs.readFile(path.join(out,'index.html'),'utf8');for(const[,href]of html.matchAll(/(?:src|href)="([^"]+)"/g)){if(href.startsWith('#'))continue;await fs.access(path.resolve(out,decodeURIComponent(href.split('#')[0])));}
console.log(JSON.stringify({runs:results.length,pptx:checks.length,archiveFiles:files.length,configMatched:true,output:out}));
