import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { runGrayAgent } from '../../src/runner/gray-agent.mjs';
import { grayBodyLayout } from '../../src/runner/gray-draft.mjs';
import { plan,source } from './fixtures.mjs';

const directory=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(directory,'../..');
const output=path.join(directory,process.argv[2]??'run-01');
await fs.mkdir(directory,{recursive:true});
await fs.writeFile(path.join(directory,'source.md'),source);
await fs.writeFile(path.join(directory,'fixed-plan.json'),JSON.stringify(plan,null,2));
let turn=0;
const steps=[['check_plan',{}],['semantic_review',{}],['render_draft',{layouts:plan.pages.map(p=>({pageId:p.pageId}))}],['finish_draft',{review:'固定计划工程回放；脚本只验证调用和绑定，语义及像素由人工另行审阅，不声明模型能力。'}]];
const provider={model:'scripted-fixed-plan-construction',async complete({messages}) {
 const system=messages[0].content;
 let payload;
 if(system.includes('灰稿内容与表达审稿人')) {
  const input=JSON.parse(messages.at(-1).content), claims=[],claimed=new Set();
  // Each source sentence is retained verbatim. Only this exact synthetic
  // fixture is covered: a scripted audit is never an independent model review.
  for(const [index,s] of input.sourceSegments.entries()) {
   const b=plan.pages.flatMap(p=>p.groups.flatMap(g=>g.blocks)).find(b=>b.sourceIds.includes(s.id));
   const location=input.auditLocations.find(l=>l.field==='body' && l.text===b.text);
   assert(location,`missing fixture body for ${s.id}`);assert(s.text.includes(b.text));claimed.add(location.id);
   claims.push({id:`fixed-${index}`,sourceEvidence:[{sourceId:s.id,quote:b.text}],visibleEvidence:[{locationId:location.id,quote:b.text}],ruling:'equivalent',rationale:'人工固定工程样本逐字回填；此回执用于运行协议，不验证模型判断。'});
  }
  payload={notes:['脚本回执，不属于模型语义审阅证据。'],organization:{verdict:'pass',findings:[]},claimAudit:{schemaVersion:'gray-claim-audit-2',claims,unreferencedSources:[],unreferencedLocations:input.auditLocations.filter(l=>!claimed.has(l.id)).map(l=>({locationId:l.id,disposition:'non-claim',reason:'固定样本中的主题、分类或编号，不引入正文以外的结论。'}))}};
 } else if(system.includes('页面布局选择器')) {
  const input=JSON.parse(messages.at(-1).content);
  payload={pages:input.pages.map(p=>({pageId:p.pageId,relation:'independent',candidateId:p.candidates[0].id,reason:'固定工程样本只有一个语义组；组内方向与共同说明已绑定，不代表模型选型。'}))};
 } else {
  const step=steps[turn++];
  return {content:'固定计划工程回放。',toolCalls:step?[{id:`fixed-${turn}`,name:step[0],arguments:JSON.stringify(step[1])}]:[],usage:{},finishReason:'stop'};
 }
 return {content:JSON.stringify(payload),toolCalls:[],usage:{},finishReason:'stop'};
}};
await runGrayAgent({source:path.join(directory,'source.md'),output,root,area:{width:1170,height:492},provider,initialPlan:plan,useLayoutRules:true,maxTurns:6});
const state=JSON.parse(await fs.readFile(path.join(output,'state.json'),'utf8'));
assert.equal(state.grayDraft.status,'awaiting-user-review',JSON.stringify(state.runtimeFailure));
assert.equal(state.grayDraft.postRender.completed,true);
assert.deepEqual(state.deckBrief,plan.deckBrief);
const geometry=state.pages.map(p=>({pageId:p.pageId,regions:p.composition.regions.map(r=>({region:r,body:grayBodyLayout(p.items.find(i=>i.id===r.itemId),r.width-32,r.fontSize,r.height-70)}))}));
await fs.writeFile(path.join(output,'mapped-geometry.json'),JSON.stringify(geometry,null,2));
console.log(JSON.stringify({output,status:state.grayDraft.status,postRender:state.grayDraft.postRender.completed,pages:state.pages.length,model:provider.model}));
