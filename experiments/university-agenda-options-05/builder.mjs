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
const grad={type:'gradient',gradientKind:'linear',angleDeg:0,stops:[{offset:0,color:'#305493'},{offset:100000,color:'#5796EE'}]};
function num(s,v,x,y,w,h,size,color){const q=text(s,v,x,y,w,h,size,color);q.text.style={typeface:'Georgia',fontSize:size,color,autoFit:'none',wrap:false,insets:{left:0,right:0,top:0,bottom:0},verticalAlignment:'middle'};return q;}
// A: open chapter columns with the university title-band language.
for(let i=0;i<3;i++){const s=slides[0],x=105+i*370;num(s,`0${i+1}`,x,251,240,87,66,blue);rect(s,x,365,320,54,grad);text(s,names[i],x+22,372,280,40,28,'#FFFFFF',true);text(s,desc[i],x+2,445,326,38,18,muted);rect(s,x,510,36,3,blue);if(i<2)rect(s,x+345,275,1,240,'#DCE4ED');}
// B: restrained academic index, one shared reading row per chapter.
for(let i=0;i<3;i++){const s=slides[1],y=225+i*123;num(s,`0${i+1}`,112,y+8,112,72,48,blue);rect(s,253,y+25,3,46,grad);text(s,names[i],288,y+15,302,59,30,ink,true);text(s,desc[i],684,y+23,460,45,20,muted);rect(s,112,y+106,1056,1,'#D7E1ED');}
// C: narrow gradient number ribbon instead of a heavy left panel.
rect(slides[2],105,221,113,367,grad);
for(let i=0;i<3;i++){const s=slides[2],y=239+i*113;num(s,`0${i+1}`,127,y+4,88,68,42,'#FFFFFF');text(s,names[i],263,y+4,346,61,30,ink,true);text(s,desc[i],671,y+12,500,46,20,muted);if(i<2){rect(s,125,y+94,72,1,'#A7C4EB');rect(s,262,y+94,900,1,'#D7E1ED');}}
// D: equal-weight light bands, compact blue chapter tabs.
for(let i=0;i<3;i++){const s=slides[3],y=224+i*125;rect(s,104,y,1072,94,'#F2F6FB');rect(s,104,y,108,94,grad);num(s,`0${i+1}`,126,y+13,86,66,43,'#FFFFFF');text(s,names[i],263,y+17,330,57,29,ink,true);text(s,desc[i],662,y+22,476,47,20,muted);rect(s,212,y+93,964,1,'#D5E0EF');}
await (await PresentationFile.exportPptx(presentation)).save(path.join(out,'agenda-options.pptx'));
const final=await PresentationFile.importPptx(await FileBlob.load(path.join(out,'agenda-options.pptx')));
for(const [i,s] of final.slides.items.entries()){await fs.writeFile(path.join(out,`option-${i+1}.png`),new Uint8Array(await (await final.export({slide:s,format:'png',scale:1})).arrayBuffer()));}
await fs.writeFile(path.join(out,'template-frame-map.json'),JSON.stringify(pages.map((_,i)=>({outputSlide:i+1,sourceSlide:2})),null,2));
