import fs from 'node:fs/promises';
import path from 'node:path';
const root = import.meta.dirname;
const args = process.argv.slice(2);
if (args.length !== 2) throw new Error('用法: node build-preview.mjs <首版渲染目录> <最终渲染目录>');
const relative = absolute => path.relative(root, absolute).split(path.sep).join('/');
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
async function pictures(dir) {
  return (await fs.readdir(path.resolve(root, dir))).filter(n => /^slide[-_]\d+\.png$/.test(n)).sort((a,b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])).map(n => relative(path.resolve(root, dir, n)));
}
const first = await pictures(args[0]), final = await pictures(args[1]);
if (first.length !== 5 || final.length !== 5) throw new Error('首版和最终版均须为五张真实渲染');
const titles = ['P2 · 过程与门槛重新生成','P3 · 多证据页重新生成','N1 · 教学环境比较决策','N2 · 预约拥堵分析','N3 · 数据开放并列条件'];
const old = ['../semantic-composition-pilot/alignment-revision/renders-alignment-revision-validated-20260909-r2/slide-2.png','../semantic-composition-pilot/renders-validated-20260909/slide-3.png'];
const sections = titles.map((t,i) => `<section><h2>${t}</h2>${i<2?`<details><summary>查看原版（未提供给生成模型）</summary><img src="${old[i]}" alt="原版"></details>`:''}<div class="pair"><figure><figcaption>新规则独立首版</figcaption><a href="${escape(first[i])}"><img src="${escape(first[i])}" alt="首版"></a></figure><figure><figcaption>模型自主复核后</figcaption><a href="${escape(final[i])}"><img src="${escape(final[i])}" alt="最终版"></a></figure></div></section>`).join('');
await fs.writeFile(path.join(root,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>新规则五页独立测试</title><style>body{margin:28px;background:#f3f5f8;color:#293746;font:16px system-ui}h1{font-size:28px}h2{font-size:21px}p{max-width:1100px;line-height:1.7}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0}img{width:100%;display:block;background:white}figcaption,summary{padding:12px 0}section{margin:38px 0}details img{max-width:1000px}a{color:#285dab}@media(max-width:900px){.pair{grid-template-columns:1fr}}</style><h1>视觉重心与文字留白：五页独立测试</h1><p>无历史 Luna high 仅读取稿件、新规则与公共构建接口。P2/P3重新生成，另三页使用新稿；主任务没有提供逐页排版修复指令。首版与自主修订结果均保留，效果判定见复核记录。</p><p><a href="实验协议.md">实验边界</a> · <a href="主任务复核.md">主任务复核</a> · <a href="manuscript.md">五页稿件</a></p>${sections}</html>`);
