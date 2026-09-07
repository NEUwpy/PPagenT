import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url));
const exists=async p=>fs.access(path.join(base,p)).then(()=>true,()=>false);
const revised=process.argv.includes('--revised');
const columns=revised?[['run-a-r1','A-r1 · 仅修正连接'],['run-b-r1','B-r1 · 加入正向编排方法']]:[['run-a','A · 用户短提示整理版'],['run-b','B · 正向设计指南']];
let pages='';
for(let page=1;page<=4;page++){
 let cells='';
 for(const [run,label] of columns){
  let src;
  for(const dir of ['render','render/slides','deck','']){
   const candidate=`${run}/${dir ? dir+'/' : ''}slide-${page}.png`;
   if(await exists(candidate)){src=candidate;break;}
  }
  cells+=`<figure><figcaption>${label} · 第 ${page} 页</figcaption>${src?`<a href="${src}" target="_blank"><img src="${src}" loading="lazy" alt="${label} 第${page}页"></a>`:'<p>本页尚未生成</p>'}</figure>`;
 }
 pages+=`<section>${cells}</section>`;
}
await fs.writeFile(path.join(base,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>咨询报告正向提示对照</title><style>body{margin:0;background:#edf0f4;color:#202c3b;font:16px/1.6 'Microsoft YaHei',sans-serif}header,main{padding:24px;max-width:1800px;margin:auto}header{background:#fff}h1{font-size:26px;margin:0}a{color:#315f91}section{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px}figure{margin:0}figcaption{padding:10px 0}img{width:100%;display:block;background:white}nav a{margin-right:24px}@media(max-width:900px){section{grid-template-columns:1fr}}</style><header><h1>同稿、同主题、同模型：两种提示词</h1><p>四页原生可编辑 PPTX。两次独立生成是案例对照，不能据此推断稳定成功率。点击页面查看原图。</p><nav><a href="run-a/deck.pptx">A 可编辑 PPTX</a><a href="run-b/deck.pptx">B 可编辑 PPTX</a><a href="REVIEW.md">父任务审查</a></nav></header><main>${pages}</main></html>`);
let html=await fs.readFile(path.join(base,'index.html'),'utf8');
if(revised) html=html.replaceAll('href="run-a/deck.pptx"','href="run-a-r1/deck.pptx"').replaceAll('href="run-b/deck.pptx"','href="run-b-r1/deck.pptx"').replace('两次独立生成是案例对照，不能据此推断稳定成功率。','本页是反馈后修订：A 仅修连接，B 调整编排。不是独立重复实验，也不能据此推断稳定成功率。').replace('<nav>','<nav><a href="first-pass.html">首轮独立生成</a>');
await fs.writeFile(path.join(base,'index.html'),html);
console.log(path.join(base,'index.html'));
