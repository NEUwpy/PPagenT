import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
const out=process.argv[2]?path.resolve(process.argv[2]):import.meta.dirname;
const report=JSON.parse(await fs.readFile(path.join(out,'report.json'),'utf8'));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 for(const slug of ['notes','funnel','stairs']){
  const rows=report.filter(r=>r.key.startsWith(slug));
  const html=`<!doctype html><meta charset="utf-8"><style>body{margin:0;font:18px system-ui;background:#eee}main{display:grid;grid-template-columns:1fr 1fr;gap:8px}article{background:white;padding:10px}img{width:100%;height:300px;object-fit:contain}p{margin:0}</style><main>${rows.map(r=>`<article><p>${r.key} ${r.width}×${r.height}</p><img src="renders/${r.key}-pptx.png"></article>`).join('')}</main>`;
  const file=path.join(out,`${slug}-contact.html`);await fs.writeFile(file,html);
  const page=await browser.newPage({viewport:{width:1500,height:1400}});
  await page.goto(pathToFileURL(file).href);await page.screenshot({path:path.join(out,`${slug}-contact.png`),fullPage:true});await page.close();
 }
}finally{await browser.close();}
