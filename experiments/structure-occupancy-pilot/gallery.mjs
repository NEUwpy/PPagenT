import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
const out=import.meta.dirname;
const keys=['baseline-attempt-1','occupied-fit-attempt-1','layout-fit-attempt-2'];
const checks=[];
for(const key of [...keys,'layout-fit-attempt-1']){
 const record=JSON.parse(await fs.readFile(path.join(out,key+'.json'),'utf8'));
 const zip=await JSZip.loadAsync(await fs.readFile(path.join(out,key+'.pptx')));
 const xml=await zip.file('ppt/slides/slide1.xml').async('string');
 const text=[...xml.matchAll(/<a:t>(.*?)<\/a:t>/gs)].map(m=>m[1].replaceAll('&amp;','&').replaceAll('&gt;','>').replaceAll('&lt;','<')).join('');
 const norm=s=>s.replace(/\s/g,'');
 const expected=[record.spec.title,...record.spec.blocks.map(b=>b.text),...record.spec.content.levels.flatMap(l=>[l.title,l.body])];
 const missing=expected.filter(t=>!norm(text).includes(norm(t)));
 const sizes=[...new Set([...xml.matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)].map(m=>Number(m[1])/100))];
 if(missing.length||sizes.some(s=>![11.25,12.75,18.75].includes(s)))throw new Error(`${key}: text/font verification failed`);
 checks.push({key,missingText:missing,fontSizesPt:sizes,nativeShapes:(xml.match(/<p:sp>/g)??[]).length,contentIntact:true});
}
await fs.writeFile(path.join(out,'pptx-checks.json'),JSON.stringify(checks,null,2));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const rect=(f,cls)=>`<rect class="${cls}" x="${f.left}" y="${f.top}" width="${f.width}" height="${f.height}"/>`;
const titles=['A · 原规则：说明只能放在右侧','B · 同框同造型：说明进入矩形内部','C · 整页编排：按实际占位安排说明与阶梯'];
const notes=['整组800×390定位框被当成禁区，斜向阶梯左上侧的空白未被使用。','阶梯每个对象与原稿完全相同，仅移动同一段说明。旧规则拒绝，新规则允许；这是占位机制对照，尚不是整页排版结论。','原文与字号仍不变，阶梯区域改为1040×440；说明从测量可放区域中选择，整页形成左上行动重点与斜向全貌。'];
let cards='';
for(const [i,key]of keys.entries()){
 const map=JSON.parse(await fs.readFile(path.join(out,key+'.occupancy.json'),'utf8'));
 const spec=JSON.parse(await fs.readFile(path.join(out,key+'.json'),'utf8')).spec;
 cards+=`<article><h2>${titles[i]}</h2><p>${notes[i]}</p><div class="stage"><img src="${key}.png"><svg viewBox="0 0 1280 720">${rect(map.positionFrame,'position')}${map.areas.map(a=>rect(a.frame,'occupied')).join('')}${spec.blocks.map(b=>rect(b.frame,'text')).join('')}</svg></div><p><a href="${key}.pptx">可编辑 PPTX</a> · <a href="${key}.png">原尺寸图片</a> · <a href="${key}.occupancy.json">占位数据</a></p></article>`;
}
const rejected=JSON.parse(await fs.readFile(path.join(out,'collision-control-attempt-1.json'),'utf8'));
await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>P3 · 从矩形禁区到实际占位</title><style>body{max-width:1280px;margin:28px auto;padding:0 20px;background:#F5F4EF;color:#20201D;font:16px/1.6 system-ui}h1{font-size:28px}h2{font-size:21px}a{color:#8e4e40}nav{position:sticky;top:0;z-index:5;padding:14px;background:#f5f4eff5;border:1px solid #D8D5CC}label{margin-right:22px}article{border-top:1px solid #D8D5CC;margin:28px 0;padding-top:14px}.stage{position:relative}.stage img{display:block;width:100%}.stage svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.position{fill:none;stroke:#3477c4;stroke-width:2;stroke-dasharray:8 6}.occupied{fill:#c965502a;stroke:#bb6349;stroke-width:1.3}.text{fill:#38865318;stroke:#388653;stroke-width:2}body.hide-position .position,body.hide-occupied .occupied,body.hide-text .text{display:none}small{color:#65635d}</style><body class="hide-position hide-occupied hide-text"><h1>结构定位可以是矩形，排版禁区不必是矩形</h1><p>占位来自P3真实渲染对象，保护每一级的图形、文字、编号和必要留白；四组小区域形成沿阶梯分布的禁区。没有依赖视觉模型猜轮廓。</p><nav><label><input type="checkbox" data-layer="position">蓝线：定位矩形</label><label><input type="checkbox" data-layer="occupied">红色：实际占位＋14px留白</label><label><input type="checkbox" data-layer="text">绿色：外部文字块</label></nav>${cards}<h2>反向验证：真正压到阶梯仍会被拒绝</h2><p>${esc(rejected.error)}</p><p><a href="checks.json">同框对照检查</a> · <a href="pptx-checks.json">源文字与字号检查</a> · <a href="README.md">实现和范围</a></p><small>这是父任务完成的P3最小试验，未重新运行Luna，也未接入全库或正式Layout。占位通过并不自动代表整页排版完成。</small><script>document.querySelectorAll('[data-layer]').forEach(el=>el.addEventListener('change',()=>document.body.classList.toggle('hide-'+el.dataset.layer,!el.checked)));</script></body></html>`);
console.log('Verified 4 PPTX files and built occupancy gallery');
