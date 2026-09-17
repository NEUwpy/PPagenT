import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
import MarkdownIt from 'markdown-it';
const root=path.resolve(import.meta.dirname,'../..'),out=import.meta.dirname,run=path.join(root,'outputs/m1-planning-revision-20260917');
const a=path.join(root,'experiments/m1-planning-review-20260916/evidence');
const read=async f=>JSON.parse(await fs.readFile(f,'utf8')),sha=x=>createHash('sha256').update(x).digest('hex');
const state=await read(path.join(run,'run/state.json'));assert.equal(state.grayDraft.status,'awaiting-user-review');
const b=path.resolve(run,'run',state.grayDraft.artifactDirectory);
assert.ok(b.startsWith(path.join(run,'run/revision-1')+path.sep));
const latest=path.join(out,'latest');await fs.mkdir(latest,{recursive:true});
const copy=async(src,dst)=>{const data=await fs.readFile(src);await fs.writeFile(dst,data);assert.equal(sha(data),sha(await fs.readFile(dst)));};
await copy(path.join(b,'gray-draft.pptx'),path.join(latest,'B-图书馆服务复盘.pptx'));
for(let i=1;i<=state.pages.length;i++)await copy(path.join(b,'preview',`slide-${String(i).padStart(2,'0')}.png`),path.join(latest,`B-${i}.png`));
const systems=[];
for(const [i,stage]of ['content','expression','review','layout'].entries()){
const name=String(i+1).padStart(2,'0')+'-'+stage+'.messages.json';
const old=await read(path.join(a,name)),next=await read(path.join(run,name));assert.equal(old.messages[0].content,next.messages[0].content);systems.push({stage,systemSha256:sha(next.messages[0].content),identical:true});}
const manifest=await read(path.join(run,'manifest.json'));for(const[f,h]of Object.entries(manifest.hashes))assert.equal(sha(await fs.readFile(path.join(root,f))),h);
const visible=await read(path.join(run,'run/revision-1/visible-plan.json'));
const oldVisible=await read(path.join(a,'run/revision-0/visible-plan.json'));
const zip=new JSZip(),files=[];
async function walk(dir,rel=''){for(const e of await fs.readdir(dir,{withFileTypes:true})){const r=rel?rel+'/'+e.name:e.name,p=path.join(dir,e.name);if(e.isDirectory())await walk(p,r);else{const d=await fs.readFile(p);zip.file(r,d);files.push({path:r,bytes:d.length,sha256:sha(d)});}}}
await walk(run);const packed=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});await fs.writeFile(path.join(out,'run-evidence.zip'),packed);
const back=await JSZip.loadAsync(packed);for(const f of files)assert.equal(sha(await back.file(f.path).async('nodebuffer')),f.sha256);
await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({scope:'supervised revision; target not achieved; user review pending',systems,coreAndRulesUnchanged:true,A:{pages:oldVisible.length,simulationVisible:/模拟/.test(JSON.stringify(oldVisible))},B:{pages:visible.length,simulationVisible:/模拟/.test(JSON.stringify(visible)),artifactDirectory:state.grayDraft.artifactDirectory,editable:await read(path.join(b,'editable-check.json')),pptxSha256:sha(await fs.readFile(path.join(b,'gray-draft.pptx')))},archiveSha256:sha(packed),files},null,2));
const report=new MarkdownIt().render(await fs.readFile(path.join(out,'README.md'),'utf8'));
const cards=visible.map((p,i)=>`<section id="p${i+1}"><h2>第${i+1}页</h2><div class="pair"><figure><figcaption>A · 原候选</figcaption><img src="../m1-planning-review-20260916/evidence/run/preview/slide-0${i+1}.png" alt="A第${i+1}页"></figure><figure><figcaption>B · 一次受监督修订</figcaption><img src="latest/B-${i+1}.png" alt="B第${i+1}页"></figure></div></section>`).join('');
await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>图书馆案例 A/B · 目标未达成</title><style>body{max-width:1700px;margin:24px auto;padding:0 22px;background:#f5f6f8;color:#26313b;font:17px/1.7 system-ui}nav{position:sticky;top:0;background:white;padding:12px;border-bottom:1px solid #ccd5dd}nav a{margin-right:20px}section,main{background:#fff;padding:24px;margin:22px 0;border:1px solid #dce1e6}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0}img{width:100%;border:1px solid #dce1e6}table{border-collapse:collapse;width:100%;font-size:15px}th,td{border:1px solid #dce1e6;text-align:left;vertical-align:top;padding:9px}a{color:#17638a}h1{font-size:29px}h2{font-size:23px}@media(max-width:950px){.pair{grid-template-columns:1fr}table{display:block;overflow:auto}}</style><nav><a href="#comparison">看A/B图</a><a href="#report">结论与证据</a><a href="latest/B-图书馆服务复盘.pptx">下载B版</a></nav><section><h1>一次修订后：仍为三页，模拟性质仍未上屏</h1><p>页面存在理由增多，实际组织未改善。保留失败，不将导出或模型审稿通过记为M1通过。</p></section><div id="comparison">${cards}</div><main id="report">${report}</main></html>`);
const html=await fs.readFile(path.join(out,'index.html'),'utf8');for(const[,href]of html.matchAll(/(?:src|href)="([^"]+)"/g)){if(href.startsWith('#'))continue;await fs.access(path.resolve(out,decodeURIComponent(href.split('#')[0])));}
console.log(JSON.stringify({pages:visible.length,systemsIdentical:true,archiveFiles:files.length,simulationVisible:false,output:out}));
