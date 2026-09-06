import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(await fs.readFile(path.join(base,'review-manifest.json'),'utf8'));
const safeData=JSON.stringify(manifest).replaceAll('<','\\u003c');
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Luna high · 整稿编排验证</title><style>
*{box-sizing:border-box}body{margin:0;background:#edf1f5;color:#252b33;font:16px/1.6 'Microsoft YaHei',sans-serif}main{max-width:1480px;margin:auto;padding:28px 32px}h1{font-size:27px;margin:0 0 8px}p{margin:8px 0;color:#536171}nav,.toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:18px 0}button,select{font:inherit;padding:8px 14px;color:#315f91;background:#fff;border:1px solid #bcc9d7;cursor:pointer}button[aria-pressed=true]{background:#315f91;color:#fff}a{color:#315f91}.toolbar{justify-content:space-between}#note{padding:14px 18px;background:#e0e8f0;border-left:4px solid #315f91}figure{margin:0;background:white}img{display:block;width:100%;height:auto}figcaption{padding:10px 18px}#pages{gap:6px}#pages button{min-width:40px;padding:5px 10px}details{margin-top:24px}#empty{padding:30px} @media(max-width:700px){main{padding:18px}}
</style><main><h1>Luna / high · 整稿编排验证</h1>
<p id="summary"></p><p>原稿 + 冻结设计指南 + 单一蓝色主题；执行模型只使用文字与几何工具。这里展示最终 PPTX 的独立渲染。首轮与反馈修订分开留档。</p>
<nav id="runs"></nav><div class="toolbar"><span><label>提交版本 <select id="round"></select></label></span><span><a id="deck">可编辑 PPTX</a> · <a id="verification">程序复核</a> · <a href="RESULTS.md">测试结论</a></span></div>
<p id="note"></p><nav id="pages"></nav><figure><img id="slide" alt="PPT 页面预览"><figcaption id="caption"></figcaption></figure>
<details><summary>测试边界与输入</summary><p>这些有限样本用于发现提示词的具体失效模式，不能保证生产成功率。父任务视觉判断与几何检查独立记录；最终修订通过不计为首轮成功。</p><a href="inputs/layout-guide.txt">冻结设计指南</a> · <a href="inputs/task-prompt.txt">完整通用任务提示</a> · <a href="input-hashes.json">输入指纹</a> · <a href="../v8-review/index.html">已认可的 v8 四页基线</a></details>
</main><script>const data=${safeData};const $=id=>document.getElementById(id);let ri=0,vi=0,pi=0;
$('summary').textContent=data.summary;
data.runs.forEach((r,i)=>{const b=document.createElement('button');b.textContent=r.title;b.onclick=()=>selectRun(i);$('runs').append(b)});
function selectRun(i){ri=i;const r=data.runs[i];$('round').replaceChildren();r.rounds.forEach((v,j)=>{const o=document.createElement('option');o.value=j;o.textContent=v.label;$('round').append(o)});vi=r.rounds.length-1;$('round').value=vi;[...$('runs').children].forEach((b,j)=>b.setAttribute('aria-pressed',i===j));selectVersion(vi)}
function selectVersion(i){vi=Number(i);pi=0;const v=data.runs[ri].rounds[vi];$('deck').href=v.deck;$('verification').href=v.verification;$('pages').replaceChildren();v.pages.forEach((p,j)=>{const b=document.createElement('button');b.textContent=j+1;b.onclick=()=>show(j);$('pages').append(b)});show(0)}
function show(i){pi=i;const r=data.runs[ri],v=r.rounds[vi],p=v.pages[i];$('slide').src=p.image;$('slide').alt=r.title+' 第 '+(i+1)+' 页';$('note').textContent=p.review;$('caption').textContent=r.title+' · '+v.label+' · '+(i+1)+' / '+v.pages.length;[...$('pages').children].forEach((b,j)=>b.setAttribute('aria-pressed',i===j))}
$('round').onchange=()=>selectVersion($('round').value);document.addEventListener('keydown',e=>{const n=data.runs[ri].rounds[vi].pages.length;if(e.key==='ArrowRight')show((pi+1)%n);if(e.key==='ArrowLeft')show((pi+n-1)%n)});selectRun(0);
</script></html>`;
await fs.writeFile(path.join(base,'index.html'),html);
console.log(`Gallery: ${manifest.runs.length} manuscripts/runs`);
