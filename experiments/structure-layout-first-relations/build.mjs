import fs from 'node:fs/promises';
import path from 'node:path';
import {renderCase} from './harness.mjs';
const dir=import.meta.dirname;
const {plans}=JSON.parse(await fs.readFile(path.join(dir,'layout-plan.json'),'utf8'));
for(const p of plans.filter(p=>!process.argv[3]||p.id===process.argv[3]))for(const appearance of ['plain','designed']){
 const spec={...p,caseId:p.id+'-'+appearance,appearance,parentReplay:true,chapter:p.id.startsWith('funnel')?'02':'03',pageNumber:plans.indexOf(p)+1};
 if(p.id.startsWith('funnel'))spec.relationshipLines=p.layout.centers.map((cy,i)=>{
  const w=(740-282*(Math.pow(i/p.content.steps.length,.82)+Math.pow((i+1)/p.content.steps.length,.82)))/2*p.layout.topWidth/370;
  const start=p.frame.left+p.layout.axis+w/2+7;
  const end=p.blocks.at(-p.content.steps.length+i).frame.left-14;
  return {frame:{left:start,top:p.frame.top+cy,width:end-start,height:0},reason:`${p.content.steps[i].title} 对应的准入依据`};
 });
 await renderCase(spec,path.join(dir,'renders'),Number(process.argv[2]??1));
}
