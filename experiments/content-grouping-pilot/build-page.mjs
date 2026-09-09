import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';
import { createNortheasternUniversityStarter } from '../../src/runtime/skins/northeastern-university.mjs';
import { universityMckinseySkin as skin } from '../../src/runtime/invoke-university-structure.mjs';
import { addText, addBox } from '../../src/asset-runtime/component-builders.mjs';
import { resolveComposition, buildComposition } from '../../src/composition/resolve.mjs';
const here=import.meta.dirname;
const bound=JSON.parse(await fs.readFile(path.join(here,'bound-expressions.json'),'utf8'));
const headings={
 'evidence-demand-fact':'需求集中','evidence-record-fact':'记录缺口集中','evidence-capacity-fact':'管理员容量受限',
 'synthesis-trial-case':'三类证据共同支持限量试点','boundary-evidence':'证据边界','validation-plan':'用运行记录验证',
};
const leaf=groupId=>({groupId});
const groupById=new Map(bound.expressions.map(e=>[e.groupId,e.group]));
const composition={op:'column',gap:18,children:[
 {op:'row',gap:28,children:['demand','record','capacity'].map(key=>({op:'column',gap:12,children:[leaf(`evidence-${key}-fact`),leaf(`evidence-${key}-interpretation`)]}))},
 leaf('synthesis-trial-case'),
 {op:'row',gap:28,children:[leaf('boundary-evidence'),{op:'column',gap:10,children:[leaf('validation-plan'),leaf('conditional-action')]}]},
]};
const widths=Object.fromEntries(bound.expressions.map(e=>[e.groupId,e.groupId==='synthesis-trial-case'?1170:['validation-plan','conditional-action'].includes(e.groupId)?770:371.333]));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
let heights, wrapped;
try{
 const page=await browser.newPage();
 const measured=await page.evaluate(({expressions,widths,headings})=>{
  const ctx=document.createElement('canvas').getContext('2d');ctx.font="18px 'Microsoft YaHei'";
  return expressions.map(e=>{
   const lines=[];let line='';
   for(const token of e.group.sourceText.match(/[A-Za-z0-9.%]+|./gu)){
    if(line&&ctx.measureText(line+token).width>widths[e.groupId]-20&&!/^[，。；：！？、”’）】》]/u.test(token)){lines.push(line.trim());line='';}line+=token;
   }if(line)lines.push(line.trim());
   return{id:e.groupId,text:lines.join('\n'),height:lines.length*24+(headings[e.groupId]?33:0)};
  });
 },{expressions:bound.expressions,widths,headings});
 heights=Object.fromEntries(measured.map(x=>[x.id,x.height]));wrapped=Object.fromEntries(measured.map(x=>[x.id,x.text]));
}finally{await browser.close();}
const factMax=Math.max(...['demand','record','capacity'].map(k=>heights[`evidence-${k}-fact`]));
for(const k of ['demand','record','capacity'])heights[`evidence-${k}-fact`]=factMax;
const interpretationMax=Math.max(...['demand','record','capacity'].map(k=>heights[`evidence-${k}-interpretation`]));
for(const k of ['demand','record','capacity'])heights[`evidence-${k}-interpretation`]=interpretationMax;
const roles={ 'evidence-fact':'analysis','interpretation-limit':'interpretation',synthesis:'interpretation',boundary:'context',validation:'annotation','conditional-action':'annotation'};
const intent={topic:'三类模拟证据支持先做限量试点，改善结果仍需验证',topicPlacement:'Skin 主题条',
 groups:bound.expressions.map(e=>({id:e.groupId,role:roles[e.group.role],message:e.group.sourceText,sourceRefs:[`content-draft.json#${e.groupId}`],emphasis:e.group.role==='evidence-fact'?'primary':'secondary',medium:e.medium,...(e.group.role==='interpretation-limit'?{relatesTo:[e.groupId.replace('interpretation','fact')]}:e.group.role==='synthesis'?{relatesTo:['evidence-demand-fact','evidence-record-fact','evidence-capacity-fact']}:{})})),
 relations:bound.relations.map(r=>({...r,type:r.type==='conditions'?'condition':'support'})),composition,
 readingOrder:bound.expressions.map(e=>e.groupId),alignment:'三份事实共享标题起线，三份解读共享起线；下部边界与验证沿上部列轴承接。',fitStrategy:'按完整原文字号18、行距24测量容量；事实按最长项等高，解读不重复增加标签；若超正文区则失败。'};
const contracts=Object.fromEntries(Object.keys(widths).map(id=>[id,{minWidth:widths[id],minHeight:heights[id]}]));
const resolved=resolveComposition({pageId:'P3',intent,bodyFrame:skin.bodyFrame,contracts,style:{gap:18,innerGap:12}});
await fs.writeFile(path.join(here,'resolved-page.json'),JSON.stringify(resolved,null,2));
const pageSpec={payload:{assetId:'northeastern-university-body-001',parameters:{}},content:{pageId:'P3',title:intent.topic},meta:{sectionName:'多证据论证'},intent:{intentId:'content-grouping-pilot'},decision:{selectedAssetId:'northeastern-university-body-001'}};
const starter=await createNortheasternUniversityStarter({pages:[pageSpec],starterPptx:path.join(here,'starter.pptx'),manuscriptSource:'experiments/visual-balance-cold-run/manuscript.md'});
const slide=starter.slides[0];
const blue=skin.primaryColor??'#315F91';
const builders=Object.fromEntries(bound.expressions.map(e=>[e.groupId,({frame})=>{
 const group=groupById.get(e.groupId), heading=headings[e.groupId];
 if(heading)addText(slide,heading,{...frame,height:27},{fontSize:21,typeface:skin.fonts.body,color:blue,bold:true,verticalAlignment:'top',autoFit:'none',insets:{left:0,right:0,top:0,bottom:0}});
 addText(slide,wrapped[e.groupId],{...frame,top:frame.top+(heading?33:0),height:frame.height-(heading?33:0)},{fontSize:18,typeface:skin.fonts.body,color:'#292929',verticalAlignment:'top',autoFit:'none',insets:{left:0,right:0,top:0,bottom:0}});
 if(e.groupId.endsWith('interpretation'))addBox(slide,{left:frame.left,top:frame.top-7,width:frame.width,height:1},{geometry:'rect',fill:'#CCD7E2',shadow:'shadow-none',line:{fill:'none',width:0}});
 return{groupId:e.groupId,sourceText:group.sourceText,medium:e.medium,contentHash:bound.contentHash};
}]));
const receipt=await buildComposition({resolved,builders});
await fs.writeFile(path.join(here,'build-receipt.json'),JSON.stringify(receipt,null,2));
slide.speakerNotes.textFrame.setText(`完整主题原文：${bound.topic.sourceText}\n所有正文组均从 bound-expressions.json 原样读取。主题条使用简要主题句，原文主题及全文另见实文草稿。全部数据为模拟材料。`);
await(await PresentationFile.exportPptx(starter.presentation)).save(path.join(here,'P3-staged-candidate.pptx'));
const imported=await PresentationFile.importPptx(await FileBlob.load(path.join(here,'P3-staged-candidate.pptx')));
const png=await imported.export({slide:imported.slides.items[0],format:'png',scale:1});
await fs.writeFile(path.join(here,'P3-staged-candidate.png'),new Uint8Array(await png.arrayBuffer()));
console.log(JSON.stringify({groups:bound.expressions.length,heights,artifact:'P3-staged-candidate.pptx'}));
