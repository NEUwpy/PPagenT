import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';
import { invokeStructure } from '../../.codex/skills/ppagent-structure/scripts/invoke.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const out = path.join(root, '.tmp/structure-skill-native');
await fs.mkdir(out, {recursive:true});
const presentation = Presentation.create({slideSize:{width:1280,height:720}});
const skin={bodyFrame:{left:60,top:140,width:1160,height:510}};
function text(slide, value, position, size, color='#243650') {
  const shape=slide.shapes.add({geometry:'textbox',position,fill:'none',line:{fill:'none',width:0}});
  shape.text=value;shape.text.style={fontSize:size,typeface:'Microsoft YaHei',color,autoFit:'none',verticalAlignment:'top'};
  return shape;
}
// Sample the original cubic paths into editable polygon geometry, retaining the fold silhouette.
function commands(d) {
  const tokens=d.match(/[MLCZ]|-?\d+(?:\.\d+)?/g);let i=0, current={x:0,y:0};const result=[];
  const point=()=>({x:Number(tokens[i++]),y:Number(tokens[i++])});
  while(i<tokens.length){const op=tokens[i++];
    if(op==='M'||op==='L'){current=point();result.push({[op==='M'?'moveTo':'lineTo']:current});}
    else if(op==='C'){const a=point(),b=point(),c=point(),s=current;for(let j=1;j<=24;j++){const t=j/24,u=1-t;result.push({lineTo:{x:u*u*u*s.x+3*u*u*t*a.x+3*u*t*t*b.x+t*t*t*c.x,y:u*u*u*s.y+3*u*u*t*a.y+3*u*t*t*b.y+t*t*t*c.y}});}current=c;}
    else if(op==='Z')result.push({close:{}});else throw new Error(`Unexpected path command ${op}`);
  }return result;
}
const paths=[
 ['shadow','#D4DEE4','M 1000 735 C 1000 735 1019 980 761 998 C 727 1001 47 1003 2 997 L 0 846 C 261 824 876 917 868 812 C 868 812 932 795 1000 735 Z'],
 ['paper','#FFFFFF','M 0 1000 L 664 1000 L 788 978 L 1000 758 L 1000 0 L 0 0 Z'],
 ['fold','#EEF2F4','M 1000 758 C 1000 758 982 1008 630 1000 C 630 1000 855 1001 842 835 C 842 835 933 818 1000 758 Z'],
];
const receipts=[];
for(const count of [3,6,9]){
  const slide=presentation.slides.add();slide.background.fill='#F4F6F7';
  text(slide,`${count} 项同级要点 · 原生适配验证`,{left:60,top:40,width:1100,height:55},38);
  text(slide,'保留纸面、底影、独立卷页和通栏标题；数量与正文位置由当前内容求解。',{left:60,top:96,width:1150,height:34},21);
  const content=Array.from({length:count},(_,i)=>({title:`要点 ${i+1}`,body:count===3?'较长的解释直接排版，不需要填入历史文字模板。':'说明按本页空间排放。'}));
  const receipt=await invokeStructure({root,slide,skin,targetFrame:skin.bodyFrame,content,
    references:[{assetId:'parallel-folded-notes-grid-002',preservedFeatures:['纸面与底影','独立卷页','通栏标题','两排等权居中'],changes:[`${count} 项，普通原生文字，自适应卡宽`]}],
    evidencePath:path.join(out,'invocations.ndjson'),pageId:`count-${count}`,regionId:'body',reason:'验证新构建不依赖原 4–8 项或文字框契约',
    build({slide,frame,content}){
      const cols=Math.ceil(content.length/2), gap=24,w=(frame.width-(cols-1)*gap)/cols,h=210;
      content.forEach((item,i)=>{const row=Math.floor(i/cols),n=row===0?cols:content.length-cols,col=i%cols;
        const x=frame.left+(frame.width-(n*w+(n-1)*gap))/2+col*(w+gap), y=frame.top+20+row*(h+36);
        for(const [name,fill,d] of paths){slide.shapes.add({name:`${name}-${i}`,geometry:'custom',position:{left:x,top:y,width:w,height:h},fill,line:{fill:'none',width:0},customPaths:[{width:1000,height:1000,commands:commands(d)}]});}
        slide.shapes.add({geometry:'rect',name:`header-${i}`,position:{left:x,top:y,width:w,height:40},fill:'#2E6A68',line:{fill:'none',width:0}});
        text(slide,item.title,{left:x+14,top:y+5,width:w-28,height:32},24,'#FFFFFF');
        const perLine=Math.floor((w-60)/25);
        const rows=Array.from(item.body).reduce((a,c,j)=>{if(j%perLine===0)a.push('');a[a.length-1]+=c;return a;},[]);
        text(slide,rows.join('\n'),{left:x+18,top:y+60,width:w-36,height:rows.length*30+10},23);
      });
    }});
  receipts.push({count,...receipt});
}
await (await PresentationFile.exportPptx(presentation)).save(path.join(out,'candidate.pptx'));
await fs.writeFile(path.join(out,'receipts.json'),JSON.stringify(receipts,null,2));
console.log(JSON.stringify({out,slides:presentation.slides.items.length,receipts},null,2));
