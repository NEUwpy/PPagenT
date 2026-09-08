import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { Presentation, PresentationFile, FileBlob } from '@oai/artifact-tool';
import { invokeStructure, closeStructureRuntime } from '../../.codex/skills/ppagent-structure/scripts/invoke.mjs';
import { loadStructureSkill } from '../../src/runtime/structure-skills.mjs';
import { preservedComponent } from '../../src/runtime/preserved-structure-build.mjs';
import { resolveHtmlComponent } from '../../src/visual-runtime/html-component-runtime.mjs';
import { htmlComponentThemeCss, compileHtmlComponentTheme } from '../../src/visual-runtime/html-component-theme.mjs';
import { htmlTextFlowCss } from '../../src/visual-runtime/text-flow.mjs';
import { occupancyFromTree, maturityGroups, collisions } from '../structure-occupancy-pilot/occupancy.mjs';
import { scanRemainingPage } from '../structure-remaining-page-luna/scan.mjs';
import {layoutComponent} from './adapter.mjs';
import {compileResolvedVisualTree} from '../../src/visual-runtime/html-component-runtime.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const asset=JSON.parse(await fs.readFile(path.join(root,'assets/主题/中性编辑排版-001/asset.json'),'utf8'));
export const skin={id:asset.id,fonts:asset.fonts,font:asset.fonts.body,primaryColor:'#A35D4F',background:'#F5F4EF',surface:'#EEECE5',dark:'#20201D',body:'#4B4A45',muted:'#85837B',line:'#D8D5CC',bodyFrame:{left:56,top:135,width:1168,height:525},typography:{componentHeading:21*.75,componentTitle:21*.75,componentItemTitle:17*.75,componentLead:17*.75,componentBody:17*.75,componentLabel:17*.75,componentMeta:15*.75}};
const roles={module:{size:21,font:asset.fonts.display,bold:true,color:skin.dark},body:{size:17,font:asset.fonts.body,color:skin.body},aux:{size:15,font:asset.fonts.body,color:skin.muted}};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const lineNone={fill:'none',width:0};
function addText(slide,text,frame,style,name){const s=slide.shapes.add({geometry:'textbox',name,position:frame,fill:'none',line:lineNone});s.text=text;s.text.style={typeface:style.font,fontSize:style.size,bold:style.bold??false,color:style.color,autoFit:'none',wrap:true,verticalAlignment:'top',insets:{top:0,right:0,bottom:0,left:0},lineSpacing:style.lineSpacing??1.55};return s;}
function intersects(a,b){return a.left<b.left+b.width && b.left<a.left+a.width && a.top<b.top+b.height && b.top<a.top+a.height;}
function inside(f,b){return ['left','top','width','height'].every(k=>Number.isFinite(f[k]))&&f.width>0&&f.height>0&&f.left>=b.left&&f.top>=b.top&&f.left+f.width<=b.left+b.width+.01&&f.top+f.height<=b.top+b.height+.01;}
export async function renderCase(spec,outDir,attempt=1){
 await fs.mkdir(outDir,{recursive:true});
 const key=`${spec.caseId}-attempt-${attempt}`,prefix=path.join(outDir,key);
 try{await fs.access(`${prefix}.json`);throw new Error(`attempt exists: ${key}; use a new attempt number`);}catch(e){if(e.code!=='ENOENT')throw e;}
 const result={key,caseId:spec.caseId,attempt,execution:spec.parentReplay?'parent-revision':'luna-remaining-page-experiment',spec,skin,status:'pending'};
 await fs.writeFile(`${prefix}.json`,JSON.stringify(result,null,2));
 let browser;
 try{
  if(!inside(spec.frame,skin.bodyFrame))throw new Error('结构区域须位于正文区');
  const blocks=spec.blocks??[];
  const relationshipLines=spec.relationshipLines??[];
  for(const l of relationshipLines){if(!l.reason||!inside({...l.frame,height:Math.max(1,l.frame.height)},skin.bodyFrame))throw new Error('关系线须有明确用途且位于正文区');}
  for(const [i,b]of blocks.entries()){
   if(!roles[b.role??'body'])throw new Error(`未知文字角色 ${b.role}`);
   if(!inside(b.frame,skin.bodyFrame))throw new Error(`文字块 ${i} 超出正文区`);
   if(spec.occupancyMode==='rectangle'&&intersects(b.frame,spec.frame))throw new Error(`文字块 ${i} 与结构定位矩形重叠（旧规则）`);
   if(blocks.slice(0,i).some(p=>intersects(p.frame,b.frame)))throw new Error(`文字块 ${i} 与其他文字块重叠`);
  }
  const ref=await loadStructureSkill(spec.assetId,root);
  const {visualComponent}=await import(pathToFileURL(path.join(ref.assetDir,ref.guide.exampleImplementation)).href);
  const component=layoutComponent(visualComponent,spec.frame,skin,spec.layout,spec.appearance);
  const tree=await resolveHtmlComponent({component,parameters:spec.content,assetDir:ref.assetDir,theme:skin,targetFrame:spec.frame});
  const occupancy=occupancyFromTree(tree,spec.frame,{groups:maturityGroups(tree)});
  const actual=occupancy.actualBounds,bounds=skin.bodyFrame;
  if(actual.left<bounds.left-1||actual.top<bounds.top-1||actual.left+actual.width>bounds.left+bounds.width+1||actual.top+actual.height>bounds.top+bounds.height+1)throw new Error('结构实际轮廓超出正文区，需要调整布局锚点');
  await fs.writeFile(`${prefix}.occupancy.json`,JSON.stringify(occupancy,null,2));
  result.remainingPage=scanRemainingPage(occupancy,skin.bodyFrame);
  for(const [i,b]of blocks.entries()){
   const hits=collisions(b.frame,occupancy);
   if(hits.length)throw new Error(`文字块 ${i} 侵入实际占位及安全留白：${hits.join(', ')}`);
  }
  result.occupancy={mode:spec.occupancyMode??'measured',areas:occupancy.areas.length,collisions:0};
  const css=await fs.readFile(path.join(ref.assetDir,component.cssFile),'utf8');
  const compiled=compileHtmlComponentTheme({markup:component.renderMarkup(spec.content),css,theme:skin});
  const plain=blocks.map((b,i)=>{const r=roles[b.role??'body'];return `<div data-plain="${i}" style="position:absolute;left:${b.frame.left}px;top:${b.frame.top}px;width:${b.frame.width}px;height:${b.frame.height}px;font-family:'${r.font}';font-size:${r.size}px;font-weight:${r.bold?700:400};line-height:1.55;color:${r.color};white-space:pre-wrap">${esc(b.text)}</div>`;}).join('');
  const html=`<!doctype html><meta charset="utf-8"><style>${htmlComponentThemeCss(skin)}${htmlTextFlowCss()}${compiled.css}html,body{width:1280px;height:720px;margin:0;background:${skin.background}!important}#chapter,#title{position:absolute;top:49px;font:700 25px '${skin.fonts.display}';white-space:nowrap}#chapter{left:56px;color:${skin.primaryColor}}#title{left:112px;color:${skin.dark}}</style><div id="chapter">${esc(spec.chapter??'01')}</div><div id="title">${esc(spec.title)}</div>${plain}<div style="position:absolute;left:${spec.frame.left}px;top:${spec.frame.top}px">${compiled.markup}</div>`;
  const withLines=html+`<svg width="1280" height="720" style="position:absolute;inset:0;pointer-events:none">${relationshipLines.map(l=>`<line x1="${l.frame.left}" y1="${l.frame.top}" x2="${l.frame.left+l.frame.width}" y2="${l.frame.top+l.frame.height}" stroke="${skin.muted}" stroke-width="1"/>`).join('')}</svg>`;
  await fs.writeFile(`${prefix}.html`,withLines);
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const page=await browser.newPage({viewport:{width:1280,height:720}});await page.setContent(withLines);await page.evaluate(()=>document.fonts.ready);
  const measurements=await page.evaluate(()=>({titleRight:document.querySelector('#title').getBoundingClientRect().right,overflow:[...document.querySelectorAll('[data-plain]')].filter(e=>e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2).map(e=>e.dataset.plain),fontReady:document.fonts.check('17px "Noto Sans SC"')&&document.fonts.check('25px "Noto Serif SC"')}));
  if(measurements.overflow.length)throw new Error(`页外文字溢出：${measurements.overflow.join(',')}`);
  if(measurements.titleRight>1150)throw new Error('页标题过长，未留延伸线空间');
  const deck=Presentation.create({slideSize:{width:1280,height:720}}),slide=deck.slides.add();
  slide.shapes.add({geometry:'rect',name:'page-paper',position:{left:0,top:0,width:1280,height:720},fill:skin.background,line:lineNone});
  addText(slide,spec.chapter??'01',{left:56,top:49,width:46,height:40},{size:25,font:skin.fonts.display,bold:true,color:skin.primaryColor,lineSpacing:1},'chapter');
  addText(slide,spec.title,{left:112,top:49,width:measurements.titleRight-112+4,height:40},{size:25,font:skin.fonts.display,bold:true,color:skin.dark,lineSpacing:1},'page-title');
  slide.shapes.add({geometry:'line',name:'heading-rule',position:{left:measurements.titleRight+22,top:68,width:1224-measurements.titleRight-22,height:0},fill:'none',line:{fill:skin.line,width:1}});
  for(const [i,b]of blocks.entries())addText(slide,b.text,b.frame,roles[b.role??'body'],`plain-${i}-${b.role??'body'}`);
  addText(slide,String(spec.pageNumber??1).padStart(2,'0'),{left:1190,top:680,width:34,height:24},{size:15,font:skin.fonts.body,color:skin.muted,lineSpacing:1},'page-number');
  const invocation=spec.appearance==='plain'?(compileResolvedVisualTree(slide,tree,spec.frame),{mode:'plain-layout-control'}):await invokeStructure({root,slide,skin,targetFrame:spec.frame,content:spec.content,execution:'layout-led-pilot',build:async ({slide,frame})=>{compileResolvedVisualTree(slide,tree,frame);return {mode:'layout-led-pilot',appearance:spec.appearance,source:ref.guide.exampleImplementation};},references:[{assetId:spec.assetId,preservedFeatures:ref.guide.designBoundary.invariants}],evidencePath:path.join(outDir,'invocations.ndjson'),pageId:key,regionId:'main-structure',reason:spec.reason});
  relationshipLines.forEach((l,i)=>slide.shapes.add({geometry:'line',name:`relationship-line-${i}`,position:l.frame,fill:'none',line:{fill:skin.muted,width:1}}));
  await fs.writeFile(`${prefix}.tree.json`,JSON.stringify(tree,null,2));
  const pptx=await PresentationFile.exportPptx(deck);await pptx.save(`${prefix}.pptx`);
  const imported=await PresentationFile.importPptx(await FileBlob.load(`${prefix}.pptx`));
  const png=await imported.export({slide:imported.slides.items[0],format:'png',scale:1});await fs.writeFile(`${prefix}.png`,new Uint8Array(await png.arrayBuffer()));
  const layout=await imported.slides.items[0].export({format:'layout'});await fs.writeFile(`${prefix}.layout.json`,await layout.text());
  // Add the measured heading rule and page number to the source preview as well.
  await page.evaluate(({right,pageNumber})=>{const line=document.createElement('div');line.style.cssText=`position:absolute;left:${right+22}px;top:68px;width:${1224-right-22}px;border-top:1px solid #D8D5CC`;document.body.append(line);const n=document.createElement('div');n.textContent=String(pageNumber).padStart(2,'0');n.style.cssText='position:absolute;left:1190px;top:680px;font:15px "Noto Sans SC";color:#85837B';document.body.append(n);},{right:measurements.titleRight,pageNumber:spec.pageNumber??1});
  await fs.writeFile(`${prefix}.html`,await page.content());await page.screenshot({path:`${prefix}-html.png`});
  result.status='rendered-unreviewed';result.invocation=invocation;result.measurements=measurements;
  result.fonts=tree.nodes.filter(n=>n.style?.fontSize).map(n=>({name:n.name,sizePx:n.style.fontSize,typeface:n.style.typeface,text:n.text}));
 }catch(e){result.status='rejected';result.error=e.message;}
 finally{await browser?.close();await closeStructureRuntime();}
 await fs.writeFile(`${prefix}.json`,JSON.stringify(result,null,2));
 console.log(key,result.status,result.error??'');return result;
}


