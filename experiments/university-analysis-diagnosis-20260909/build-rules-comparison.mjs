import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const [firstDir, independentDir, finalDir] = process.argv.slice(2);
if (!firstDir || !independentDir || !finalDir) throw new Error('Supply first, independent final, and reviewed render directories');
const rel = p => path.relative(here, path.resolve(p)).replaceAll('\\','/');
const images = async dir => (await fs.readdir(dir)).filter(p=>/^slide[-_]\d+\.png$/.test(p)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(p=>rel(path.join(dir,p)));
const first = await images(firstDir), independent = await images(independentDir), final = await images(finalDir);
if ([first,independent,final].some(a=>a.length!==3)) throw new Error('Expected three slides per run');
const variants = [
 {label:'上一轮 · 原候选提示词首版', imgs:[1,2,3].map(i=>`first-render/slide-0${i}.png`)},
 {label:'上一轮 · 逐页指导后', imgs:[1,2,3].map(i=>`../university-analysis-luna-20260909/render-revised-04/slide-0${i}.png`)},
 {label:'现行麦肯锡排版 · 独立首版', imgs:first},
 {label:'新版麦肯锡排版 · 独立自检后（未通过）', imgs:independent},
 {label:'新版麦肯锡排版 · 缺陷反馈后修订', imgs:final},
];
await fs.writeFile(path.join(here,'rules-comparison.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>麦肯锡排版规则复测</title><style>
*{box-sizing:border-box}body{margin:0;background:#edf0f3;color:#223047;font:16px/1.65 'Microsoft YaHei',sans-serif}header{padding:24px 3vw;background:white}h1{font-size:26px;margin:0 0 8px}p{margin:4px 0;color:#526176}nav{display:flex;gap:22px;margin:12px 0}a{color:#315f9f}.controls{position:sticky;top:0;background:#f8fafceF;backdrop-filter:blur(8px);padding:14px 3vw;display:grid;grid-template-columns:1fr 1fr;gap:22px;z-index:1}select{font:inherit;padding:7px;width:100%;color:#223047;border:1px solid #b7c4d5;border-radius:4px}main{padding:0 3vw 35px}h2{font-size:22px;margin:24px 0 12px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}img{width:100%;display:block;border:1px solid #cbd4df;background:white}figure{margin:0}figcaption{font-size:14px;margin-bottom:8px;color:#56667a}@media(max-width:900px){.pair{grid-template-columns:1fr}.controls{position:static;grid-template-columns:1fr}}</style>
<header><h1>大学 Skin ＋ 麦肯锡排版：现行规则复测</h1><p>本轮优化的是独立的麦肯锡排版；学校身份、模板和同一原稿保持固定。比较提示词直接生成、逐页指导与独立自检的区别。</p><p>单次同稿结果用于判断改进，不代表其他 Skin、其他稿件或数据图表已通过。</p><nav><a href="规则复测结果.md">本轮审阅</a><a href="../../rules/排版体系/麦肯锡式.md">现行排版规则</a><a href="index.html">上一轮完整对照</a></nav></header>
<div class="controls"><label>左侧<select id="left"></select></label><label>右侧<select id="right"></select></label></div><main id="pages"></main>
<script>const variants=${JSON.stringify(variants)}; const titles=['准入与推进','记录与处置','能力与扩围'];const left=document.getElementById('left'),right=document.getElementById('right');for(const select of [left,right])variants.forEach((v,i)=>{const option=document.createElement('option');option.value=i;option.textContent=v.label;select.append(option)});left.value=1;right.value=4;function draw(){const main=document.getElementById('pages');main.replaceChildren();titles.forEach((title,i)=>{const section=document.createElement('section'),h=document.createElement('h2'),pair=document.createElement('div');h.textContent='P'+(i+1)+' · '+title;pair.className='pair';for(const select of [left,right]){const v=variants[select.value],figure=document.createElement('figure'),caption=document.createElement('figcaption'),link=document.createElement('a'),img=document.createElement('img');caption.textContent=v.label;link.href=v.imgs[i];link.target='_blank';img.src=v.imgs[i];img.alt=title+' '+v.label;link.append(img);figure.append(caption,link);pair.append(figure)}section.append(h,pair);main.append(section)})}left.onchange=right.onchange=draw;draw();</script></html>`);
console.log(path.join(here,'rules-comparison.html'));
