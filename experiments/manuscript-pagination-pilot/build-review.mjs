import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';
import { createNortheasternUniversityStarter } from '../../src/runtime/skins/northeastern-university.mjs';
import { universityMckinseySkin as skin } from '../../src/runtime/invoke-university-structure.mjs';
import { addText, addBox } from '../../src/asset-runtime/component-builders.mjs';
const here=import.meta.dirname, out=path.join(here,'ppt-review');
await fs.mkdir(out,{recursive:true});
const {compiled}=JSON.parse(await fs.readFile(path.join(here,'three-pages.json'),'utf8'));
const titles=['先核对履约与故障，再判断是否增容','选择提醒与故障登记试点，保留负荷回退','用实际记录决定扩围，三项门槛须同时满足'];
const sections=['观察与判断','方案与约束','复核与扩围'];
const specs=titles.map((title,i)=>({payload:{assetId:'northeastern-university-body-001',parameters:{}},content:{pageId:`P${i+1}`,title},meta:{sectionName:sections[i]},intent:{intentId:'manuscript-review'},decision:{selectedAssetId:'northeastern-university-body-001'}}));
const starter=await createNortheasternUniversityStarter({pages:specs,starterPptx:path.join(out,'starter.pptx'),manuscriptSource:'experiments/manuscript-pagination-pilot/manuscript.md'});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage();
const records=[];
async function text(slide,value,x,y,w,size=18,bold=false){
 const lines=await page.evaluate(({value,w,size})=>{const c=document.createElement('canvas').getContext('2d');c.font=`${size}px 'Microsoft YaHei'`; const result=[];for(const paragraph of value.split('\n')){let line='';for(const token of paragraph.match(/[A-Za-z0-9.%]+|./gu)||[]){if(line&&c.measureText(line+token).width>w*0.82&&!/^[，。；：！？、）]/u.test(token)){result.push(line);line='';}line+=token;}if(line)result.push(line);}return result;},{value,w,size});
 const h=lines.length*(size*1.5)+8;
 if(y+h>658)throw new Error(`正文超界 ${value.slice(0,20)}: ${y+h}`);
 for(let k=0;k<lines.length;k++)addText(slide,lines[k],{left:x,top:y+k*size*1.5,width:w+10,height:size*1.5},{fontSize:size,typeface:skin.fonts.body,color:skin.dark??'#2B2B2B',bold,verticalAlignment:'top',autoFit:'none',insets:{left:0,right:0,top:0,bottom:0}});
 records.push({slide:starter.slides.indexOf(slide)+1,text:value,x,y,w,h,size});return h;
}
try{
for(let i=0;i<3;i++){
 const slide=starter.slides[i], draft=compiled.pages[i].draft.grouping;
 await text(slide,draft.topic.sourceText.replace(/。(?=.)/gu,'。\n'),55,176,1170);
 const groups=draft.groups.filter(g=>g.id!=='g1');
 for(let j=0;j<groups.length;j++){
  const x=j===0?55:670,w=j===0?565:555,g=groups[j];
  await text(slide,g.title,x,292,w,21,true);
  addBox(slide,{left:x,top:331,width:w,height:1},{geometry:'rect',fill:'#CCD7E2',shadow:'shadow-none',line:{fill:'none',width:0}});
  // Preserve the full text, adding only paragraph breaks at sentence boundaries.
  await text(slide,g.sourceText.replace(/。(?=.)/gu,'。\n'),x,350,w);
 }
 slide.speakerNotes.textFrame.setText('审核候选：全文来源见 three-pages.json。模拟稿，不代表真实结果。此轮验证实文组织，不声明结构或图表 Skill 接入通过。\n'+compiled.pages[i].draft.sourceParagraphs.join('\n\n'));
}
}finally{await browser.close();}
const candidate=path.join(out,'页面编排-三页审核稿.pptx');
await(await PresentationFile.exportPptx(starter.presentation)).save(candidate);
const imported=await PresentationFile.importPptx(await FileBlob.load(candidate));
for(let i=0;i<3;i++){const png=await imported.export({slide:imported.slides.items[i],format:'png',scale:1});await fs.writeFile(path.join(out,`slide-${i+1}.png`),new Uint8Array(await png.arrayBuffer()));}
await fs.writeFile(path.join(out,'text-records.json'),JSON.stringify(records,null,2));
console.log(candidate);
