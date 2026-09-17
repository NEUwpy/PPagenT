import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import MarkdownIt from 'markdown-it';
const dir=import.meta.dirname,md=new MarkdownIt(),source=await fs.readFile(path.join(dir,'原文逐字稿.md'),'utf8');
const chunks=source.split(/(?=^## 第 \d+ 张$)/m),intro=chunks.shift();
assert.equal(chunks.length,11);
const body=chunks.map((c,i)=>`<section id="p${i+1}"><div class="original"><a href="原图/${String(i+1).padStart(2,'0')}.png"><img src="原图/${String(i+1).padStart(2,'0')}.png" alt="用户提供第${i+1}张完整原图"></a></div><article>${md.render(c)}</article></section>`).join('');
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>内容提取及可视化 · 用户十一图原文对照</title><style>body{margin:0;background:#f4f5f7;color:#20242a;font:17px/1.85 system-ui}header,nav,section{max-width:1640px;margin:20px auto;padding:20px;background:white}nav{position:sticky;top:0;z-index:2;border-bottom:1px solid #ccd5df}nav a{margin-right:22px}section{display:grid;grid-template-columns:1fr 1fr;gap:30px;align-items:start}img{max-width:100%;height:auto}article{min-width:0}a{color:#165d9e}h1{font-size:27px}h2{font-size:23px}table{border-collapse:collapse}td,th{border:1px solid #ccd5df;padding:6px 12px}section{scroll-margin-top:90px}.original{position:sticky;top:95px}@media(max-width:1000px){section{display:block}.original{position:static}nav{position:static}}</style><header>${md.render(intro)}</header><nav>${chunks.map((_,i)=>`<a href="#p${i+1}">第${i+1}张</a>`).join('')}<a href="原文逐字稿.md">Markdown 原文稿</a></nav>${body}</html>`;
for(const[,url]of html.matchAll(/(?:src|href)="([^"]+)"/g)){if(url.startsWith('#'))continue;await fs.access(path.resolve(dir,decodeURIComponent(url)));}
const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
for(const f of manifest){const data=await fs.readFile(path.join(dir,f.path));assert.equal(createHash('sha256').update(data).digest('hex'),f.sha256);}
await fs.writeFile(path.join(dir,'index.html'),html);
console.log('11 source screenshots, 10 crops: hashes and links verified; 11 transcription sections rendered.');
