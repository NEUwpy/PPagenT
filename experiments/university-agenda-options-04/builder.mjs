import fs from 'node:fs/promises';
import path from 'node:path';
import { PresentationFile, FileBlob } from '@oai/artifact-tool';
import { createNortheasternUniversityStarter } from '../../src/runtime/skins/northeastern-university.mjs';
const out=import.meta.dirname;
const names=['记录规范','试点筛选','能力建设'];
const desc=['明确需要留下哪些基本信息','确定入选条件与试点边界','从可记录走向可追溯、可复用'];
const blue='#315F91', ink='#26384C', muted='#687D92', pale='#EDF3F9', line='#CCD9E7';
const pages=Array.from({length:4},(_,i)=>({payload:{assetId:'northeastern-university-agenda-001',parameters:{title:'目录',items:[]}},content:{pageId:`agenda-${i+1}`,title:'目录'},meta:{},intent:{intentId:'agenda'},decision:{selectedAssetId:'northeastern-university-agenda-001'}}));
const {presentation,slides}=await createNortheasternUniversityStarter({starterPptx:path.join(out,'template-starter.pptx'),pages});
function rect(s,x,y,w,h,fill){return s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:'none',width:0}});}
function text(s,v,x,y,w,h,size=24,color=ink,bold=false){const q=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});q.text=v;q.text.style={typeface:'Microsoft YaHei',fontSize:size,color,bold,autoFit:'none',wrap:false,insets:{left:0,right:0,top:0,bottom:0},verticalAlignment:'middle'};return q;}
// A: three open editorial columns.
for(let i=0;i<3;i++){const s=slides[0],x=90+i*390; text(s,`0${i+1}`,x,260,250,100,76,blue);rect(s,x,380,315,3,blue);text(s,names[i],x,407,330,52,30,ink,true);text(s,desc[i],x,478,335,38,18,muted);if(i<2)rect(s,x+351,266,1,278,line);}
// B: one clear horizontal reading line per chapter.
for(let i=0;i<3;i++){const s=slides[1],y=225+i*128;text(s,`0${i+1}`,105,y,105,76,54,blue);text(s,names[i],245,y+8,330,60,30,ink,true);text(s,desc[i],650,y+13,480,52,20,muted);rect(s,105,y+102,1070,1,line);}
// C: integrated blue index field and matching description rows.
rect(slides[2],80,224,360,367,blue);
for(let i=0;i<3;i++){const s=slides[2],y=243+i*112;text(s,`0${i+1}`,108,y,68,63,32,'#BED2E9');text(s,names[i],192,y,226,63,28,'#FFFFFF',true);text(s,desc[i],492,y+9,690,45,23,ink);if(i<2){rect(s,108,y+87,302,1,'#6688AD');rect(s,492,y+87,666,1,line);}}
// D: three continuous chapter bands, alternating blue/white field.
for(let i=0;i<3;i++){const s=slides[3],y=226+i*123;rect(s,85,y,1110,96,i===1?pale:blue);text(s,`0${i+1}`,111,y+13,110,66,46,i===1?blue:'#C5D8ED');text(s,names[i],263,y+17,315,58,29,i===1?ink:'#FFFFFF',true);text(s,desc[i],641,y+20,522,52,19,i===1?muted:'#E4EDF7');}
await (await PresentationFile.exportPptx(presentation)).save(path.join(out,'agenda-options.pptx'));
const final=await PresentationFile.importPptx(await FileBlob.load(path.join(out,'agenda-options.pptx')));
for(const [i,s] of final.slides.items.entries()){await fs.writeFile(path.join(out,`option-${i+1}.png`),new Uint8Array(await (await final.export({slide:s,format:'png',scale:1})).arrayBuffer()));}
await fs.writeFile(path.join(out,'template-frame-map.json'),JSON.stringify(pages.map((_,i)=>({outputSlide:i+1,sourceSlide:2})),null,2));
