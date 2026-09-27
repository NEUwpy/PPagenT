import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const base=path.dirname(fileURLToPath(import.meta.url));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const dirs=(await fs.readdir(path.join(base,'reviews'),{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name);
let sections=[];
for(const name of dirs){
  const folder=path.join(base,'reviews',name);
  let v;try{v=JSON.parse(await fs.readFile(path.join(folder,'verification.json'),'utf8'));}catch{continue;}
  let review='父任务视觉评审待完成。';try{review=await fs.readFile(path.join(folder,'visual-review.md'),'utf8');}catch{}
  const pages=[];
  for(const r of v.renders){
    if(r.missing)continue;
    const rel=`reviews/${name}/render/slide-${r.page}.png`;
    pages.push(`<figure><a href="${esc(rel)}" target="_blank"><img loading="lazy" src="${esc(rel)}" alt="${esc(name)} 第 ${r.page} 页"></a><figcaption>第 ${r.page} 页</figcaption></figure>`);
  }
  sections.push(`<section id="${esc(name)}"><h2>${esc(name)}</h2><p>${v.pageCount} 页 · 最终文件 SHA-256 ${esc(v.sha256.slice(0,16))}…</p><details open><summary>评审记录</summary><pre>${esc(review)}</pre></details><div class="pages">${pages.join('')}</div></section>`);
}
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>咨询排版提示对照</title><style>body{margin:0;background:#e8eaed;color:#252b33;font:16px/1.6 'Microsoft YaHei',sans-serif}header,section{max-width:1600px;margin:auto;padding:24px}header{background:#fff}h1{margin:0;font-size:28px}h2{margin:0}nav a{margin-right:20px}a{color:#315f91}pre{white-space:pre-wrap;font:14px/1.7 'Microsoft YaHei',sans-serif;padding:16px;background:#fff}.pages{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}figure{margin:0}img{width:100%;display:block;background:#fff;box-shadow:0 2px 8px #0002}figcaption{font-size:13px;padding:4px}section{border-top:1px solid #bbc1c8;margin-top:20px}@media(max-width:900px){.pages{grid-template-columns:1fr}}</style><header><h1>咨询排版提示对照</h1><p>同稿、同主题、同页数的 Luna High 独立首稿。反馈轮和迁移测试分别列出。点击页面查看原图；图片来自对应最终 PPTX。</p><nav>${dirs.map(n=>`<a href="#${esc(n)}">${esc(n)}</a>`).join('')}</nav></header>${sections.join('')}</html>`;
await fs.writeFile(path.join(base,'index.html'),html);
console.log(`Built gallery with ${sections.length} reviewed runs.`);
