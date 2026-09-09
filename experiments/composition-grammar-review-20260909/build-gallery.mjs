import fs from 'node:fs/promises';
import path from 'node:path';

const root = import.meta.dirname;
const experiments = path.dirname(root);
async function images(dir) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return []; }
  const result = [];
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await images(file));
    else if (/^slide[-_]\d+\.png$/i.test(entry.name)) result.push(file);
  }
  return result.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const sets = [];
for (const [label, directory] of [
  ['定量稿 · 修改前基线', 'neu-mckinsey-fixed-rules-20260909/run/rendered-final'],
  ['定量稿 · 新规则首版', 'composition-grammar-luna-20260909/first/rendered'],
  ['定量稿 · 新规则修订', 'composition-grammar-luna-20260909/final/rendered'],
  ['定性稿 · 新规则首版', 'composition-transfer-luna-20260909/first/renders'],
  ['定性稿 · 新规则修订', 'composition-transfer-luna-20260909/final/renders']
]) {
  let files = await images(path.join(experiments, directory));
  const byPage = new Map();
  for (const file of files) {
    const page = Number(path.basename(file).match(/\d+/)[0]);
    const current = byPage.get(page);
    if (!current || (await fs.stat(file)).mtimeMs > (await fs.stat(current)).mtimeMs) byPage.set(page, file);
  }
  files = [...byPage.entries()].sort(([a], [b]) => a - b).map(([, file]) => file);
  if (label.startsWith('定性稿') && files.length === 6) files = files.slice(2, 5);
  if (files.length) sets.push({ label, images: files.map(relative) });
}
const data = JSON.stringify(sets).replaceAll('<', '\\u003c');
await fs.writeFile(path.join(root, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>页面组合规则 · 同稿对比与迁移</title>
<style>*{box-sizing:border-box}body{margin:0;background:#eef1f5;color:#22364a;font:16px/1.6 'Microsoft YaHei',sans-serif}header,main{padding:24px 3vw}header{background:white}h1{font-size:26px;margin:0}p{margin:8px 0}a{color:#245e98}nav{display:flex;gap:24px}.controls{display:grid;grid-template-columns:1fr 1fr;gap:24px;position:sticky;top:0;background:#f7f9fcf5;padding:14px 3vw;z-index:2}select{width:100%;font:inherit;padding:7px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}figure{margin:0}img{width:100%;display:block;background:white;border:1px solid #c5d0db}figcaption{font-size:14px;margin-bottom:6px}.empty{padding:60px;background:white;color:#64748b}@media(max-width:950px){.pair{grid-template-columns:1fr}}</style>
<header><h1>页面组合规则：同稿对比与迁移</h1><p>大学 Skin＋麦肯锡排版。定量四页比较修改前基线与本轮结果；定性三页检查结构调用与图文整合。</p><p>本轮由无历史上下文的 Luna high 制作。首版、自行修订与主任务反馈分别记录；计划检查通过不代表视觉通过。</p><nav><a href="验证记录.md">修改与实际验收记录</a><a href="../../rules/页面组合.md">共享组合规则</a><a href="../../rules/排版体系/麦肯锡式.md">现行麦肯锡规则</a></nav></header>
<div class="controls"><label>左侧<select id="left"></select></label><label>右侧<select id="right"></select></label></div><main id="pages"></main>
<script>const sets=${data};const left=document.getElementById('left'),right=document.getElementById('right');for(const select of [left,right])sets.forEach((set,i)=>{const option=document.createElement('option');option.value=i;option.textContent=set.label;select.append(option)});right.value=Math.max(0,sets.findIndex(set=>set.label==='定量稿 · 新规则修订'));function render(){const target=document.getElementById('pages');target.replaceChildren();const a=sets[left.value],b=sets[right.value];if(!a||!b)return;for(let i=0;i<Math.max(a.images.length,b.images.length);i++){const pair=document.createElement('div');pair.className='pair';for(const set of [a,b]){const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=set.label+' · P'+(i+1);figure.append(caption);if(set.images[i]){const link=document.createElement('a'),image=document.createElement('img');link.href=set.images[i];link.target='_blank';image.src=set.images[i];image.alt=caption.textContent;link.append(image);figure.append(link)}else{const empty=document.createElement('div');empty.className='empty';empty.textContent='此组无对应页';figure.append(empty)}pair.append(figure)}target.append(pair)}}left.onchange=right.onchange=render;render();</script></html>`);
console.log(JSON.stringify({ file: path.join(root, 'index.html'), sets: sets.map(set => ({ label: set.label, pages: set.images.length })) }, null, 2));
