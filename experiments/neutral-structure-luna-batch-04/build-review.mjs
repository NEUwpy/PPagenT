import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const cases=[['01','三路资料汇成维修交接单'],['02','临时协调与统一预约'],['03','每周小改进闭环']];
const cards=await Promise.all(cases.map(async([id,title])=>{
  let ready=true;try{await fs.access(path.join(root,`run-${id}/parent-final/slide-01.png`));}catch{ready=false;}
  return `<section><h2>${id} · ${title}</h2>${ready?`<a href="run-${id}/parent-final/slide-01.png"><img src="run-${id}/parent-final/slide-01.png" alt="${title}最终PPT独立渲染"></a><p><a href="run-${id}/deck.pptx">下载可编辑单页 PPT</a></p>`:'<p>尚无最终页面，查看报告中的阻塞原因。</p>'}</section>`;
}));
await fs.writeFile(path.join(root,'review.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Luna high · 三类结构调用与排版</title><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#f5f4ef;color:#20201d;font-family:"Microsoft YaHei",sans-serif}main{max-width:1280px;margin:auto}h1,h2{font-family:"Noto Serif SC",serif}h1{font-size:28px}h2{font-size:20px;margin-top:40px}p{line-height:1.8;color:#4b4a45}a{color:#a35d4f}img{width:100%;height:auto;display:block;border:1px solid #d8d5cc}nav{border-bottom:1px solid #d8d5cc;padding:0 0 16px}</style><main><h1>Luna high · 三类结构调用与排版</h1><p>三份虚构短稿，三个独立执行者。以下图片由父任务从最终 PPTX 独立渲染，点击可查看原尺寸。调用成功与排版验收分开记录。</p><nav><a href="REPORT.md">查看调用结果、问题与修正建议</a> · <a href="README.md">试验范围</a></nav>${cards.join('')}<p>本次为适配稿件的定向试验，不代表任意稿件成功率。已认可旧稿保持不变。</p></main></html>`,'utf8');
console.log('review.html written');
