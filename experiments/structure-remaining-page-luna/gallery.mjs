import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
const dir=import.meta.dirname;
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
async function walk(d){const found=[];for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())found.push(...await walk(p));else found.push(p);}return found;}
const files=await walk(path.join(dir,'luna'));
const records=[];
for(const f of files.filter(f=>/-attempt-\d+(?:-[^.]+)?\.json$/.test(f))){const r=JSON.parse(await fs.readFile(f,'utf8'));if(r.spec&&r.status)records.push({...r,file:f});}
records.sort((a,b)=>a.caseId.localeCompare(b.caseId)||a.attempt-b.attempt);
const checks=[];
for(const r of records.filter(r=>r.status==='rendered-unreviewed')){
 const zip=await JSZip.loadAsync(await fs.readFile(r.file.replace(/\.json$/,'.pptx')));
 const xml=await zip.file('ppt/slides/slide1.xml').async('string');
 const text=[...xml.matchAll(/<a:t>(.*?)<\/a:t>/gs)].map(m=>m[1].replaceAll('&amp;','&').replaceAll('&gt;','>').replaceAll('&lt;','<')).join('');
 const tree=JSON.parse(await fs.readFile(r.file.replace(/\.json$/,'.tree.json'),'utf8'));
 const expected=[r.spec.title,...r.spec.blocks.map(b=>b.text),...tree.nodes.filter(n=>n.text).map(n=>n.text)];
 const norm=s=>s.replace(/\s/g,'');
 const missing=expected.filter(t=>!norm(text).includes(norm(t)));
 const fontSizesPt=[...new Set([...xml.matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)].map(m=>Number(m[1])/100))];
 const typefaces=[...new Set([...xml.matchAll(/typeface="([^"]+)"/g)].map(m=>m[1]))];
 const overlapArea=(a,b)=>Math.max(0,Math.min(a.left+a.width,b.left+b.width)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.top+a.height,b.top+b.height)-Math.max(a.top,b.top));
 checks.push({key:r.key,missingText:missing,fontSizesPt,unexpectedFonts:fontSizesPt.filter(n=>![11.25,12.75,15.75,18.75].includes(n)),typefaces,nativeShapes:(xml.match(/<p:sp>/g)??[]).length,pictureObjects:(xml.match(/<p:pic>/g)??[]).length,htmlOverflow:r.measurements.overflow,fontReady:r.measurements.fontReady,textAreaInsidePositionFrame:r.spec.blocks.reduce((s,b)=>s+overlapArea(b.frame,r.spec.frame),0),scope:'Verifies rendered source text and allowed font tiers, not manuscript semantics or aesthetics. Text inside the position frame is diagnostic, not a requirement to fill whitespace.'});
}
await fs.writeFile(path.join(dir,'pptx-checks.json'),JSON.stringify(checks,null,2));
const rect=(f,c)=>`<rect class="${c}" x="${f.left}" y="${f.top}" width="${f.width}" height="${f.height}"/>`;
let cards='';
for(const r of records){
 const stem=path.relative(dir,r.file).replaceAll('\\','/').replace(/\.json$/,'');
 if(r.status!=='rendered-unreviewed'){cards+=`<details><summary>${esc(path.basename(stem))} · ${esc(r.status)}</summary><p>${esc(r.error)}</p><a href="${stem}.json">完整记录</a></details>`;continue;}
 const map=JSON.parse(await fs.readFile(r.file.replace(/\.json$/,'.occupancy.json'),'utf8'));
 const free=(r.remainingPage?.bands??[]).flatMap(b=>b.free.map(f=>({left:f.left,top:b.top,width:f.width,height:b.height})));
 cards+=`<article><h2>${esc(r.caseId)} · 第 ${r.attempt} 稿 · ${esc(r.spec.title)}</h2><div class="stage"><img src="${stem}.png" loading="lazy"><svg viewBox="0 0 1280 720">${free.map(f=>rect(f,'free')).join('')}${rect(r.spec.frame,'position')}${map.areas.map(a=>rect(a.frame,'occupied')).join('')}${r.spec.blocks.map(b=>rect(b.frame,'text')).join('')}</svg></div><p>${esc(r.spec.reason)}</p><p><a href="${stem}.pptx">可编辑 PPTX</a> · <a href="${stem}.png">原图</a> · <a href="${stem}.json">执行记录与剩余页面</a></p></article>`;
}
let review;try{review=JSON.parse(await fs.readFile(path.join(dir,'parent-review.json'),'utf8'));}catch{}
const summary=review?`<div class="review"><b>整页人工复核</b><p>${esc(review.summary)}</p>${(review.pages??[]).map(p=>`<p><b>${esc(p.page)}：</b>${esc(p.verdict)} — ${esc(p.notes)}</p>`).join('')}</div>`:'<p>整页复核尚未完成；生成成功不代表排版通过。</p>';
await fs.writeFile(path.join(dir,'luna-audit.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>剩余页面排版 · Luna high 实验</title><style>body{max-width:1280px;margin:28px auto;padding:0 20px;background:#F5F4EF;color:#20201D;font:16px/1.6 system-ui}h1{font-size:28px}h2{font-size:21px}a{color:#8e4e40}nav{position:sticky;top:0;z-index:5;padding:12px;background:#f5f4eff5;border:1px solid #D8D5CC}label{display:inline-block;margin-right:20px}article{border-top:1px solid #D8D5CC;margin:28px 0;padding-top:14px}.stage{position:relative}.stage img{display:block;width:100%}.stage svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.position{fill:none;stroke:#3477c4;stroke-width:2;stroke-dasharray:8 6}.occupied{fill:#c965502a;stroke:#bb6349;stroke-width:1}.free{fill:#38865320;stroke:#38865330;stroke-width:.6}.text{fill:#7253a218;stroke:#7253a2;stroke-width:2}body.hide-position .position,body.hide-occupied .occupied,body.hide-text .text,body.hide-free .free{display:none}.review{padding:14px 20px;border-left:3px solid #a35d4f}details{padding:10px;border:1px solid #d8d5cc}small{color:#65635d}</style><body class="hide-position hide-occupied hide-text hide-free"><h1>先放结构，再在剩余页面上编排文字</h1><p>Luna high · 同三页稿件 · 中性 Skin · 保留初稿与修订。预扫描仅描述自由区域，不预设文字框大小。</p>${summary}<nav>${[['position','蓝线：结构定位框'],['occupied','红色：实际占用与留白'],['free','绿色：扫描所得剩余页面'],['text','紫框：排版后文字块']].map(([k,v])=>`<label><input type="checkbox" data-layer="${k}">${v}</label>`).join('')}</nav>${cards}<p><a href="../structure-wholepage-luna-20260908/index.html">之前的整页实验</a> · <a href="../structure-occupancy-pilot/index.html">之前的 P3 占位实验</a> · <a href="pptx-checks.json">PPTX 检查</a> · <a href="README.md">实验说明</a></p><small>图像来自生成 PPTX 的重新导入渲染。扫描采用真实对象与语义组的保守占位；不是像素级任意轮廓识别。仅实验目录，未接入正式生产线。</small><script>document.querySelectorAll('[data-layer]').forEach(el=>el.addEventListener('change',()=>document.body.classList.toggle('hide-'+el.dataset.layer,!el.checked)));</script></body></html>`);
console.log(JSON.stringify({attempts:records.length,rendered:checks.length,checks},null,2));


