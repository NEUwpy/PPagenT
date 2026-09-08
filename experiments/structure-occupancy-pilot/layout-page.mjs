import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderCase,skin } from './harness.mjs';
import { loadStructureSkill } from '../../src/runtime/structure-skills.mjs';
import { preservedComponent } from '../../src/runtime/preserved-structure-build.mjs';
import { resolveHtmlComponent,closeHtmlComponentRuntime } from '../../src/visual-runtime/html-component-runtime.mjs';
import { occupancyFromTree,maturityGroups,freePlacements } from './occupancy.mjs';
const out=import.meta.dirname;
const original=JSON.parse(await fs.readFile(path.join(out,'../structure-wholepage-luna-20260908/luna/P3/P3-attempt-3.json'),'utf8')).spec;
const attempt=Number(process.argv[2]??1);
const frame=attempt===1?{left:56,top:175,width:1168,height:480}:{left:120,top:190,width:1040,height:440};
let tree;
try{
 const ref=await loadStructureSkill(original.assetId);
 const {visualComponent}=await import(pathToFileURL(path.join(ref.assetDir,ref.guide.exampleImplementation)).href);
 tree=await resolveHtmlComponent({component:preservedComponent(visualComponent,frame,skin),parameters:original.content,assetDir:ref.assetDir,theme:skin,targetFrame:frame});
}finally{await closeHtmlComponentRuntime();}
const map=occupancyFromTree(tree,frame,{groups:maturityGroups(tree)});
const candidates=freePlacements(map,frame,{width:320,height:140});
const preferred={left:112,top:195};
const selected=candidates.sort((a,b)=>Math.hypot(a.left-preferred.left,a.top-preferred.top)-Math.hypot(b.left-preferred.left,b.top-preferred.top))[0];
if(!selected)throw new Error('No measured free block');
await fs.writeFile(path.join(out,'layout-plan.json'),JSON.stringify({purpose:original.purpose,readingOrder:['左上行动重点','斜向四级全貌及当前/目标'],positionFrame:frame,selected,availableCandidates:candidates.length,changes:'结构扩大占区，正文原文不变；位置由测量空区候选中选取，不改核心造型'},null,2));
await renderCase({...original,caseId:'layout-fit',frame,blocks:[{...original.blocks[0],frame:selected}],reason:'布局试验：在上升阶梯左上方的测量空区放行动说明，完整保留四级关系、状态、原文和Skin字号'},out,attempt);
