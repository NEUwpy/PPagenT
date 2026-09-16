import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {resolveGrayLayout} from '../../src/runner/gray-layout.mjs';
import {grayBodyLayout,fitGrayText,validateGrayPlan,renderGrayDraft,saveGrayState} from '../../src/runner/gray-draft.mjs';
const output=path.resolve('outputs/gray-rules-layout-replay-20260916');await fs.mkdir(output,{recursive:false});
const results=JSON.parse(await fs.readFile('outputs/gray-rules-layout-controls-20260916/results.json','utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
for(const r of results.filter(r=>r.name==='focused'&&r.repeat===2&&r.accepted)){
 const old=path.resolve('outputs/gray-diverse-20260916',r.id),dir=path.join(output,r.id);await fs.mkdir(dir);
 const text=await fs.readFile(path.join(old,'revision-0/semantic-plan.json'),'utf8'),plan=JSON.parse(text),base=JSON.parse(await fs.readFile(path.join(old,'state.json'),'utf8'));
 const area=base.grayDraft.area,built=resolveGrayLayout(plan,r.selection,area,{measureBody:grayBodyLayout,fitText:fitGrayText}),check=validateGrayPlan(base,built.plan,area);
 if(!check.accepted)throw new Error(JSON.stringify(check.issues));
 const state={...check.state,grayDraft:{...base.grayDraft,status:'rendering',humanReview:'pending',artifactDirectory:'.',planner:'historical-external-model-plan',scope:'Frozen original model content; second recorded focused layout selection replay. Not independent end-to-end success.',semanticPlan:plan}};
 await fs.writeFile(path.join(dir,'semantic-plan.json'),text);await fs.writeFile(path.join(dir,'layout-selection.json'),JSON.stringify(r.selection,null,2));
 await fs.writeFile(path.join(dir,'verification.json'),JSON.stringify({source:old,semanticPlanSha256:sha(text),contentUnchanged:true,selectedRepeat:2,selectionSource:'gray-rules-layout-controls-20260916',pages:state.pages.length,scope:state.grayDraft.scope},null,2));
 await renderGrayDraft(state,dir);state.grayDraft.status='awaiting-user-review';await saveGrayState(path.join(dir,'state.json'),state);console.log(r.id+' '+state.pages.length+' pages');
}
