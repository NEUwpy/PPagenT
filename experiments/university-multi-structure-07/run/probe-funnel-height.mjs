import { Presentation } from '@oai/artifact-tool';
import { invokeUniversityStructure, closeStructureRuntime } from '../../../src/runtime/invoke-university-structure.mjs';
const root = 'C:/PPagenT'; const evidencePath = 'C:/PPagenT/experiments/university-multi-structure-07/run/probe-events.jsonl';
const content = { inputs: [], steps: [{ key: 'a', title: '记录完整' }, { key: 'b', title: '责任明确' }, { key: 'c', title: '复核通过' }] };
const out=[];
for (const height of [220,240,260,280,300]) {
  const presentation=Presentation.create({slideSize:{width:1280,height:720}}); const slide=presentation.slides.add(); const frame={left:55,top:658-height,width:1170,height};
  try { const result=await invokeUniversityStructure({root,slide,assetId:'convergence-simple-funnel-001',content,targetFrame:frame,evidencePath,pageId:`probe-funnel-height-${height}`,regionId:'probe',reason:`探测漏斗高度 ${height}px`}); out.push({height,ok:true,result}); }
  catch(error){out.push({height,ok:false,message:error.message});} finally{await closeStructureRuntime();}
}
console.log(JSON.stringify(out,null,2));
