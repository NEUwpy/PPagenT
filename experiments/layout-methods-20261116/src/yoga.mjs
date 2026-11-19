import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import Yoga from 'yoga-layout';
import {chromium} from 'playwright';
const E=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(await fs.readFile(path.join(E,'content.json'),'utf8'));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
await fs.mkdir(path.join(E,'src/yoga'),{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const innerWidth=1184, gap=20, pad=12;
// Actual Chromium paragraph measurement is performed before Yoga's synchronous
// measure callbacks. Fixed 2/4 column capacities are an author choice.
const measured=[];
for(const [gi,g] of data.groups.entries()){
 const width=(innerWidth-gap*(g.blocks.length-1))/g.blocks.length;
 for(const b of g.blocks){
   const metrics=await page.evaluate(({b,w})=>{
    const d=document.createElement('div');d.style.cssText=`position:absolute;width:${w}px;font-family:'Microsoft YaHei';`;
    const t=document.createElement('h3');t.textContent=b.label;t.style.cssText='font-size:22px;line-height:1.35;font-weight:700;margin:0;';
    const p=document.createElement('p');p.textContent=b.text;p.style.cssText='font-size:22px;line-height:1.42;margin:0;';
    d.append(t,p);document.body.append(d);const result={label:t.getBoundingClientRect().height,body:p.getBoundingClientRect().height};d.remove();return result;
   },{b,w:width-pad*2});
   measured.push({id:b.id,group:g.id,width,contentWidth:width-pad*2,...metrics});
 }
}
await browser.close();
const root=Yoga.Node.create();root.setWidth(1280);root.setHeight(720);root.setPadding(Yoga.EDGE_HORIZONTAL,48);root.setPadding(Yoga.EDGE_TOP,34);root.setPadding(Yoga.EDGE_BOTTOM,28);root.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);root.setGap(Yoga.GUTTER_ROW,18);
const header=Yoga.Node.create();header.setHeight(76);root.insertChild(header,0);
const groups=[];
for(const [gi,g] of data.groups.entries()){
 const group=Yoga.Node.create();group.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);group.setGap(Yoga.GUTTER_ROW,11);group.setFlexShrink(0);
 const heading=Yoga.Node.create();heading.setHeight(35);group.insertChild(heading,0);
 const row=Yoga.Node.create();row.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);row.setGap(Yoga.GUTTER_COLUMN,gap);row.setAlignItems(Yoga.ALIGN_STRETCH);group.insertChild(row,1);
 const items=[];
 for(const [bi,b] of g.blocks.entries()){
  const m=measured.find(x=>x.id===b.id);
  const card=Yoga.Node.create();card.setWidth(m.width);card.setPadding(Yoga.EDGE_ALL,pad);card.setGap(Yoga.GUTTER_ROW,10);card.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
  const label=Yoga.Node.create();label.setMeasureFunc(w=>({width:w,height:m.label}));card.insertChild(label,0);
  const body=Yoga.Node.create();body.setMeasureFunc(w=>({width:w,height:m.body}));card.insertChild(body,1);
  row.insertChild(card,bi);items.push({b,card,label,body});
 }
 root.insertChild(group,gi+1);groups.push({g,group,heading,row,items});
}
root.calculateLayout(1280,720,Yoga.DIRECTION_LTR);
const rect=(n,parent={x:0,y:0})=>{let r=n.getComputedLayout();return{x:parent.x+r.left,y:parent.y+r.top,width:r.width,height:r.height}};
const geom=[];
const position=r=>`left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px`;
let html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Yoga 内容测量与 Flexbox 排版</title><style>*{box-sizing:border-box}body{margin:0;background:white;font-family:'Microsoft YaHei',sans-serif;color:#24364c}.slide{position:relative;width:1280px;height:720px;overflow:hidden}.title{position:absolute;left:48px;top:43px;font-size:36px;line-height:1.2;font-weight:700;color:#1b3762}.neu-logo{position:absolute;right:48px;top:27px;width:240px;height:auto}.header-rule{position:absolute;top:106px;left:48px;width:1184px;height:4px;background:#3361ae}.group-heading{position:absolute;margin:0;font-size:25px;line-height:35px;color:#3361ae;font-weight:700}.card{position:absolute;background:#f0f4fa;border-top:3px solid #3361ae}.insights .card{background:white;border-top:2px solid #93acd2;border-right:1px solid #d6dfed}.label,.body{position:absolute;margin:0}.label{font-size:22px;line-height:1.35;font-weight:700;color:#1b3762}.body{font-size:22px;line-height:1.42;color:#344356}</style><div class="slide"><div class="title">${data.title}</div><img class="neu-logo" src="../../assets/neu-logo.png" alt="东北大学校标"><div class="header-rule"></div>`;
for(const {g,group,heading,row,items} of groups){
 const gr=rect(group),hr=rect(heading,gr),rr=rect(row,gr);geom.push({id:g.id,...gr});
 html+=`<div class="${g.id}"><h2 class="group-heading" style="${position(hr)}">${g.heading}</h2>`;
 for(const {b,card,label,body} of items){
  const cr=rect(card,rr),lr=rect(label,cr),br=rect(body,cr);geom.push({id:b.id,card:cr,label:lr,body:br});
  html+=`<div class="card" style="${position(cr)}" data-block="${b.id}"></div><h3 class="label" data-label="${b.id}" style="${position(lr)}">${esc(b.label)}</h3><p class="body" data-body="${b.id}" style="${position(br)}">${esc(b.text)}</p>`;
 }
 html+='</div>';
}
html+='</div></html>';
const bottom=Math.max(...geom.filter(x=>x.card).map(x=>x.card.y+x.card.height));
if(bottom>700)throw new Error(`Measured composition exceeds page: ${bottom}`);
await fs.writeFile(path.join(E,'src/yoga/index.html'),html);
await fs.writeFile(path.join(E,'evidence/yoga-measurements.json'),JSON.stringify({engine:'yoga-layout@3.2.1',browser:'Chrome',font:'Microsoft YaHei',baseCanvas:[1280,720],bodySize:22,measured,geometry:geom,bottom},null,2));
root.freeRecursive();
console.log(`Yoga layout written, content bottom=${bottom.toFixed(1)}.`);
