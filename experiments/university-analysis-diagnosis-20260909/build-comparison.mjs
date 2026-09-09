import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const finalDir = process.argv[2];
if (!finalDir) throw new Error('Supply reviewed final render directory');
const relative = p => path.relative(here, path.resolve(p)).replaceAll('\\', '/');
const esc = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const pages = ['准入与推进','记录与处置','能力与扩围'];
const variants = [
  { label:'旧实验 · 每页两次结构调用', image:i=>`../university-multi-structure-07/run/renders/slide-${i+3}.png` },
  { label:'新提示词 · Luna 首版', image:i=>`first-render/slide-0${i+1}.png` },
  { label:'视觉反馈后 · Luna 修订版', image:i=>`${relative(finalDir)}/slide-0${i+1}.png` },
];
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>大学分析报告 · Luna 同稿测试</title><style>
*{box-sizing:border-box}body{margin:0;background:#edf0f3;color:#223047;font:16px/1.6 'Microsoft YaHei',sans-serif}header{padding:26px 4vw;background:white;border-bottom:1px solid #d2dae5}h1{font-size:26px;margin:0 0 8px}header p{margin:0;color:#526176;max-width:1000px}nav{margin-top:15px;display:flex;gap:20px}a{color:#315f9f}main{padding:16px 3vw 40px}section{margin:20px 0 45px}h2{font-size:22px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}figure{margin:0}figcaption{font-size:15px;margin-bottom:8px;font-weight:600}img{display:block;width:100%;background:white;border:1px solid #cbd4df;box-shadow:0 3px 12px #22304712}.hint{font-size:13px;color:#617087} @media(max-width:1100px){.grid{grid-template-columns:1fr}} </style><header><h1>大学 Skin × 分析报告：同稿三页对照</h1><p>固定原稿、大学模板和 Luna high。保留首版，区分提示词直接生成与人工视觉反馈后的修订；修订结果不代表一次成功。点击页面可查看原尺寸。</p><nav><a href="测试结果.md">测试记录</a><a href="Luna测试提示词.md">候选提示词</a></nav></header><main>${pages.map((p,i)=>`<section><h2>P${i+1} · ${p}</h2><div class="grid">${variants.map(v=>`<figure><figcaption>${v.label}</figcaption><a target="_blank" href="${esc(v.image(i))}"><img src="${esc(v.image(i))}" alt="${p} ${v.label}"></a></figure>`).join('')}</div></section>`).join('')}<p class="hint">预览来自 PPTX 渲染；此测试没有定量数据，未验证数值图表技能。保留学校原有标题字体与渐变蓝带。</p></main></html>`;
await fs.writeFile(path.join(here,'index.html'), html);
console.log(path.join(here,'index.html'));
