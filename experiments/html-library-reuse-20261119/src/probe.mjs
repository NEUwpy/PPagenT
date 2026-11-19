import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import * as merge from '../../../assets/结构图/多路汇聚结果-003/review.mjs';
import * as notes from '../../../assets/结构图/双排折角便签-002/review.mjs';
import * as cards from '../../../assets/结构图/等权并列卡片-001/review.mjs';
import {sharedPreservedComponent} from '../../../src/visual-runtime/preserved-size-component.mjs';
import {compileHtmlComponentTheme,htmlComponentThemeCss} from '../../../src/visual-runtime/html-component-theme.mjs';
import {htmlTextFlowCss} from '../../../src/visual-runtime/text-flow.mjs';
import {closeHtmlComponentRuntime} from '../../../src/visual-runtime/html-component-runtime.mjs';
import {universityMckinseySkin} from '../../../src/runtime/skins/university-mckinsey.mjs';
const E=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),R=path.resolve(E,'../..');
const D=JSON.parse(await fs.readFile(path.join(E,'content.json'),'utf8'));
const theme={...universityMckinseySkin,font:'Microsoft YaHei',typography:{...universityMckinseySkin.typography,componentBody:13.5,componentItemTitle:15.75,componentHeading:15.75}};
export const mergeParameters={inputs:[{key:'atmosphere',title:'公司内部人力资源',body:'变革氛围尚未完全形成，'},{key:'system',title:'信息系统支撑',body:'能力仍有差距，'},{key:'mechanism',title:'缺乏市场化',body:'管理机制。'}],result:{title:'变革落地阻力重重',body:''}};
const params={items:D.groups[1].blocks.map((b,i)=>({key:b.id,title:b.label,body:b.text,iconKey:['messages','target-arrow','refresh','adjustments'][i]}))};
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const records=[];
async function record(name,component,parameters,dir,frame){
 const page=await browser.newPage({viewport:{width:frame.width,height:frame.height},deviceScaleFactor:2});
 try{
  const css=component.cssText??await fs.readFile(path.join(dir,component.cssFile),'utf8');
  const c=compileHtmlComponentTheme({markup:component.renderMarkup(parameters),css,theme});
  const html=`<!doctype html><meta charset="utf-8"><style>${htmlComponentThemeCss(theme)}${htmlTextFlowCss()}${c.css}</style>${c.markup}`;
  await fs.writeFile(path.join(E,`evidence/${name}.html`),html);await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
  const audit=await page.evaluate(()=>{
   const r=document.querySelector('[data-ppt-root]').getBoundingClientRect();
   const text=[...document.querySelectorAll('[data-ppt-kind="text"]')].map(el=>{const b=el.getBoundingClientRect(),c=getComputedStyle(el),range=document.createRange();range.selectNodeContents(el);const ink=range.getBoundingClientRect();return{text:el.textContent,box:{x:b.x,y:b.y,width:b.width,height:b.height},fontSize:c.fontSize,inkHeight:ink.height,scrollHeight:el.scrollHeight,clipped:el.scrollHeight>el.clientHeight+1||ink.height>b.height+2,outside:b.right>innerWidth+1||b.bottom>innerHeight+1}});
   const shapes=[...document.querySelectorAll('.input,.result')].map(el=>{const b=el.getBoundingClientRect();return{class:el.className,x:b.x,y:b.y,width:b.width,height:b.height}});
   return{viewport:[innerWidth,innerHeight],root:{width:r.width,height:r.height},text,shapes,paths:[...document.querySelectorAll('path[data-ppt-kind="path"]')].map(el=>({d:el.getAttribute('d'),width:getComputedStyle(el).strokeWidth})),clipping:text.filter(t=>t.clipped||t.outside).length};
  });
  await page.screenshot({path:path.join(E,`evidence/${name}.png`)});records.push({name,status:'rendered',...audit});
 }catch(error){records.push({name,status:'error',message:error.message,code:error.code??null});}finally{await page.close();}
}
try{
 const dir=path.join(R,'assets/结构图/多路汇聚结果-003');
 const frame={width:624,height:240,size:'small'};
 const shared=await sharedPreservedComponent(merge.visualComponent,dir,frame,theme,mergeParameters);
 await record('convergence-shared-adapter',shared,mergeParameters,dir,frame);
 await record('convergence-adaptive-original-css',{...merge.visualComponent,renderMarkup:p=>merge.renderAdaptiveMarkup(p,{frame})},mergeParameters,dir,frame);
 const nd=path.join(R,'assets/结构图/双排折角便签-002');
 try{notes.visualComponent.renderMarkup(params);records.push({name:'folded-notes-natural-contract',status:'accepted'});}catch(e){records.push({name:'folded-notes-natural-contract',status:'rejected',message:e.message});}
 const nf={width:514,height:430,size:'small'};
 await record('folded-notes-adaptive-514x430',{...notes.visualComponent,renderMarkup:p=>notes.renderAdaptiveMarkup(p,{frame:nf,theme})},params,nd,nf);
 const cf={width:1170,height:230,size:'medium'};
 const cardShared=await sharedPreservedComponent(cards.visualComponent,path.join(R,'assets/结构图/等权并列卡片-001'),cf,theme,params);
 await record('equal-cards-shared-1170x230',cardShared,params,path.join(R,'assets/结构图/等权并列卡片-001'),cf);
}finally{await browser.close();await closeHtmlComponentRuntime();await fs.writeFile(path.join(E,'evidence/library-probes.json'),JSON.stringify(records,null,2));}
console.log(JSON.stringify(records.map(r=>({name:r.name,status:r.status,clipping:r.clipping,message:r.message}))));
