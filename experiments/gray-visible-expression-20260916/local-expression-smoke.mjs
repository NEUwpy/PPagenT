// Controlled renderer fixture, not model generation or evidence of planning quality.
import fs from 'node:fs/promises';
import path from 'node:path';
import { newRunState } from '../../src/runner/state.mjs';
import { validateSemanticPlan, semanticReviewInput } from '../../src/runner/gray-semantics.mjs';
import { resolveGrayLayout } from '../../src/runner/gray-layout.mjs';
import { fitGrayText, grayBodyLayout, validateGrayPlan, renderGrayDraft } from '../../src/runner/gray-draft.mjs';

if (!process.argv[2]) throw new Error('local-expression-smoke.mjs <new-output-directory>');
const output=path.resolve(process.argv[2]);
await fs.mkdir(output,{recursive:false});
const source='模拟：发布安排与复核要点。资料提交后进行复核，未通过则退回修订。复核通过后发布，并保存复核记录。复核时核对名称与原始记录是否一致，确认所用资料版本，检查引用是否能追溯来源，并登记复核责任人。';
const block=(id,label,text,extra={})=>({id,label,text,sourceIds:['s1'],...extra});
const semanticPlan={schemaVersion:'gray-plan-3',deckBrief:{title:'发布安排与复核要点',audience:'资料管理员',objective:'理解发布过程和复核职责'},pages:[{
  pageId:'p1',title:'发布安排与复核要点',claim:'模拟：明确发布安排与复核要点',pagePurpose:'说明发布安排及复核检查的内容',narrative:'左组含发布与记录两项安排，右组含复核的四项内容；复核未通过退回修订。',
  groups:[
    {id:'arrangement',role:'说明发布安排与记录要求',heading:'发布安排',importance:'primary',kind:'text',blocks:[
      block('review','复核后决定发布','资料提交后复核，未通过则退回修订，通过后发布。',{kind:'flow',expression:'呈现发布门槛',relationship:'提交后复核；通过才发布，未通过退回',production:'条件附着于复核，退回分支指向修订'}),
      block('records','保存复核记录','发布后保留本次复核记录。'),
    ]},
    {id:'checks',role:'展开复核时需要检查的内容',heading:'复核要点',importance:'primary',kind:'text',blocks:[
      block('name','名称一致','核对名称与原始记录是否一致。'),
      block('version','版本明确','确认所用资料版本。'),
      block('source','引用可追溯','检查引用是否能追溯来源。'),
      block('owner','责任明确','登记复核责任人。'),
    ]},
  ],
}]};
const area={width:1170,height:620,label:'局部表达承载验证（手写测试输入）'};
const base=newRunState(source,'controlled-fixture');
const semantics=validateSemanticPlan(base,semanticPlan);
if (!semantics.accepted) throw new Error(JSON.stringify(semantics));
const resolved=resolveGrayLayout(semanticPlan,{pages:[{pageId:'p1',layout:{type:'row',weights:[1.1,1]}}]},area,{measureBody:grayBodyLayout,fitText:fitGrayText});
const check=validateGrayPlan(base,resolved.plan,area);
if (!check.accepted) throw new Error(JSON.stringify({...check,state:undefined}));
const state={...check.state,grayDraft:{version:'gray-draft-3',area,status:'rendering',humanReview:'pending',scope:'Controlled renderer fixture; no model call, not automatic planning acceptance.'}};
const json=value=>JSON.stringify(value,null,2);
await fs.writeFile(path.join(output,'source.txt'),source);
await fs.writeFile(path.join(output,'semantic-plan.json'),json(semanticPlan));
await fs.writeFile(path.join(output,'visible-plan.json'),json(semanticReviewInput({source,area,plan:semanticPlan})));
await fs.writeFile(path.join(output,'layout-resolved.json'),json(resolved.receipts));
await fs.writeFile(path.join(output,'program-check.json'),json({...check,state:undefined}));
await renderGrayDraft(state,output);
state.grayDraft.status='rendered-unreviewed';
await fs.writeFile(path.join(output,'state.json'),json(state));
console.log(json({output,pages:state.pages.length,scope:state.grayDraft.scope}));
