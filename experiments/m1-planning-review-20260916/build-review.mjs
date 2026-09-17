import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import MarkdownIt from 'markdown-it';
const root=path.resolve(import.meta.dirname,'../..'), out=import.meta.dirname;
const archive=await fs.readFile(path.join(root,'experiments/gray-rules-20260916/continuation-evidence.zip'));
const zip=await JSZip.loadAsync(archive);
const prefix='gray-rules-layoutonly-20260916/layoutOnly--hierarchy/';
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=[];
for(const entry of Object.values(zip.files)){
  if(entry.dir || !entry.name.startsWith(prefix))continue;
  const rel=entry.name.slice(prefix.length);
  assert.ok(!rel.split('/').includes('..'));
  const data=await entry.async('nodebuffer'), target=path.join(out,'evidence',rel);
  await fs.mkdir(path.dirname(target),{recursive:true});
  try{assert.equal(sha(await fs.readFile(target)),sha(data),'Existing evidence differs');}
  catch(e){if(e.code!=='ENOENT')throw e; await fs.writeFile(target,data,{flag:'wx'});}
  files.push({path:'evidence/'+rel,bytes:data.length,sha256:sha(data)});
}
assert.ok(files.length>0);
const read=async p=>JSON.parse(await fs.readFile(path.join(out,'evidence',p),'utf8'));
const content=await read('run/revision-0/content-plan.json'),semantic=await read('run/revision-0/semantic-plan.json');
const layout=await read('run/revision-0/layout-resolved-0.json'),state=await read('run/state.json');
const manifest=await read('manifest.json'), codeHashes=[];
for(const [file,expected]of Object.entries(manifest.hashes)){
 const archived=await zip.file('gray-rules-layoutonly-20260916/snapshot/'+file.replaceAll('/','__')).async('nodebuffer');
 assert.equal(sha(archived),expected);
 const bytes=await fs.readFile(path.join(root,file)),actual=sha(bytes);
 const normalize=b=>b.toString('utf8').replaceAll('\r\n','\n');
 codeHashes.push({file,expected,actual,matches:expected===actual,normalizedTextMatches:normalize(bytes)===normalize(archived)});
}
assert.deepEqual(content.pages.map(p=>p.groups.flatMap(g=>g.blocks)),semantic.pages.map(p=>p.groups.flatMap(g=>g.blocks)));
assert.deepEqual(content.pages.map(p=>p.claim),semantic.pages.map(p=>p.claim));
const visible=await read('run/revision-0/visible-plan.json');
const visiblePages=Array.isArray(visible)?visible:visible.visiblePages;
assert.equal(visiblePages.length,3);
const visibleText=JSON.stringify(visiblePages);
assert.equal(/模拟/.test(visibleText),false);
const verification={scope:'Retrospective single-case review; no model call, no new PPT, no M1 acceptance',archiveSha256:sha(archive),codeHashes,
 pages:content.pages.map((p,i)=>({pageId:p.pageId,blocks:p.groups.flatMap(g=>g.blocks).length,claim:p.claim,groupHeadingsBefore:p.groups.map(g=>g.heading),groupHeadingsAfter:semantic.pages[i].groups.map(g=>g.heading),layout:layout[i].layout,minimum:layout[i].contentMinimums,allocated:layout[i].occupiedRegions})),
 contentBlocksAndClaimsUnchanged:true,simulationInVisibleText:false,simulationInBackstage:/模拟/.test(content.planningNotes),
 originalReview:await read('run/revision-0/semantic-check.json'),originalEditable:await read('run/editable-check.json'),originalStatus:state.grayDraft.status,originalHumanReview:state.grayDraft.humanReview,files};
await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(verification,null,2));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const md=await fs.readFile(path.join(out,'README.md'),'utf8');
const report=new MarkdownIt().render(md);
const evidenceLinks=['content-plan.json','expression-response.json','semantic-plan.json','visible-plan.json','semantic-check.json','layout-response-0.json','layout-resolved-0.json','program-check.json'];
const pageCards=content.pages.map((p,i)=>`<section id="p${i+1}"><h2>实际灰稿 · 第${i+1}页</h2><p>${esc(p.pagePurpose)}</p><img src="evidence/run/preview/slide-0${i+1}.png" alt="原PPTX重导入第${i+1}页"><details><summary>查看本页冻结前后的规划</summary><pre>${esc(JSON.stringify({content:p,expressionBound:semantic.pages[i]},null,2))}</pre></details></section>`).join('');
await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>M1单案例对照 · 图书馆服务复盘</title><style>body{max-width:1360px;margin:28px auto;padding:0 24px;background:#f5f6f8;color:#202b35;font:17px/1.7 system-ui}nav{position:sticky;top:0;background:#fff;padding:12px;border-bottom:1px solid #ccd5dd}nav a{margin-right:18px}section,main{background:white;padding:26px;margin:22px 0;border:1px solid #dce1e6}img{width:100%;height:auto;border:1px solid #dce1e6}table{border-collapse:collapse;width:100%;font-size:15px}th,td{padding:10px;border:1px solid #dce1e6;text-align:left;vertical-align:top}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:600px;overflow:auto;font:14px/1.6 monospace}a{color:#17638a}h1{font-size:29px}h2{font-size:23px}summary{cursor:pointer}@media(max-width:800px){main,section{padding:12px}table{display:block;overflow:auto}}</style><nav><a href="#report">核对与归因</a><a href="#p1">第1页</a><a href="#p2">第2页</a><a href="#p3">第3页</a><a href="evidence/run/gray-draft.pptx">原PPTX</a></nav><main id="report">${report}</main>${pageCards}<section><h2>原始证据</h2><p>以下为旧运行原字节副本，不是人工重写的模型答案。</p><ul>${evidenceLinks.map(f=>`<li><a href="evidence/run/revision-0/${f}">${f}</a></li>`).join('')}<li><a href="evidence/03-review.messages.json">实际审稿输入</a></li><li><a href="evidence/04-layout.messages.json">实际排版输入</a></li><li><a href="verification.json">本次只读核对与哈希</a></li></ul></section></html>`);
// Validate every local HTML link/image and read back copied evidence; no external resources.
const html=await fs.readFile(path.join(out,'index.html'),'utf8');
let links=0;
for(const [,href]of html.matchAll(/(?:href|src)="([^"]+)"/g)){
 if(href.startsWith('#'))continue;
 assert.ok(!/^(https?:|\/\/)/.test(href));
 await fs.access(path.resolve(out,decodeURIComponent(href.split('#')[0])));links++;
}
for(const f of files)assert.equal(sha(await fs.readFile(path.join(out,f.path))),f.sha256);
console.log(JSON.stringify({copiedFiles:files.length,linksVerified:links,pages:verification.pages.length,codeHashMatches:codeHashes.every(x=>x.matches),codeTextMatchesAfterNewlineNormalization:codeHashes.every(x=>x.normalizedTextMatches),blocksAndClaimsUnchanged:true,simulationInVisibleText:false}));
