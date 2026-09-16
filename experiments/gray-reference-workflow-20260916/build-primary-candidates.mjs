// Plans authored by the active Codex agent from the user's sources.
// This uses the same binding, measurement, solver and native renderer as gray-draft.
// It does not impersonate an API response or an autonomous runGrayDraft success.
import fs from 'node:fs/promises';
import path from 'node:path';
import {newRunState} from '../../src/runner/state.mjs';
import {bindGrayExpressions,validateSemanticPlan,semanticReviewInput} from '../../src/runner/gray-semantics.mjs';
import {resolveGrayLayout} from '../../src/runner/gray-layout.mjs';
import {fitGrayText,grayBodyLayout,validateGrayPlan,renderGrayDraft,saveGrayState} from '../../src/runner/gray-draft.mjs';

const root=path.resolve(import.meta.dirname,'../..');
if(!process.argv[2]) throw new Error('build-primary-candidates.mjs <new-output>');
const output=path.resolve(process.argv[2]);await fs.mkdir(output,{recursive:false});
const block=(id,label,text,sourceIds,extra={})=>({id,...(label?{label}:{}),text,sourceIds,...extra});
const group=(id,role,heading,blocks,importance='primary')=>({id,role,heading,blocks,importance,kind:'text'});
const reference={schemaVersion:'gray-plan-3',deckBrief:{title:'存在的不足与感悟',audience:'人力资源与业务管理人员',objective:'梳理主要不足及推进变革的工作体会'},pages:[{
 pageId:'p1',title:'存在的不足与感悟',claim:'梳理两点不足，明确四点工作感悟',pagePurpose:'在同一页区分问题梳理与经验体会，并展开各自条目',narrative:'不足与感悟分为两类；两项问题和四点感悟各自归属，不添加逐一因果或解决关系。',groups:[
  group('issues','梳理当前问题','两点不足',[
   block('implementation','变革落地阻力重重','顶层设计已完成；公司内部人力资源变革氛围尚未完全形成，信息系统支撑能力仍有差距，缺乏市场化管理机制。',['s1','s2'],{kind:'diagram',expression:'梳理设计与落地间的障碍',relationship:'三方面不足造成落地阻力。',production:'区分已完成的设计、三项障碍和落地问题。'}),
   block('compliance','合规管理短板亟待提升','2017年巡视整改取得一定成效，也暴露人力条线基础管理薄弱：认识待提升、作风待转变、能力待增强、协同待深化。',['s2']),
  ]),
  group('insights','归纳工作体会与判断尺度','四点感悟',[
   block('language','统一语言，促进业务与人力协同','沿BLM管理模型统一语言、目标、策略，贯通业务战略、人力战略规划与落地方案，达成“三个市场化”转型目标。',['s3']),
   block('criterion','解决实际问题是唯一检验标准','以能否解决实际问题检验变革成效，力求落地有实效。',['s3']),
   block('iteration','顶层设计持续迭代','加速试点、小步快跑；对标行业优秀实践，结合落地成效持续优化体系。',['s3']),
   block('coordination','统筹变革、合规与作风','变革是硬道理，合规是硬要求，作风是硬标准；以规范管理的效率强化转型力度，以优良的思想、工作和战斗作风加快转型。',['s3']),
  ]),
 ],
}]};
const trial={schemaVersion:'gray-plan-3',deckBrief:{title:'共享服务试点建议',audience:'方案决策与实施人员',objective:'理解共同选择尺度、试点及并行准备和后续判断'},pages:[{
 pageId:'p1',title:'共享服务试点建议',claim:'模拟建议：先试点，再按记录决定后续建设',pagePurpose:'说明建议如何启动及后续决策，同时保留选择尺度',narrative:'启动试点与整理第二条路径的字段责任并行；八周后根据记录决定是否继续建设。三项准则是选择尺度，不是方案已满足准则的证据。',groups:[
  group('proposal','呈现建议的实施与后续判断','八周试点与并行准备',[
   block('arrangement',null,'统一服务窗口启动八周试点，同时整理第二条路径所需字段与责任；八周后按记录决定是否继续建设统一预约入口。',['s1','s3'],{kind:'flow',expression:'呈现并行工作与后续判断',relationship:'两项工作并行，八周后依据记录作继续与否的判断。',production:'两条并行工作线，八周处标出记录与判断。'}),
  ]),
  group('criteria','说明选择时共同采用的尺度','选择时共同采用三项准则',[
   block('safety',null,'能否保持安全责任清晰？',['s2']),
   block('staff',null,'能否在现有人力条件下持续运行？',['s2']),
   block('evidence',null,'能否用真实记录检查改进效果？',['s2']),
  ],'supporting'),
 ],
}]};
const cases=[
 {id:'reference',source:path.join(import.meta.dirname,'source.txt'),plan:reference,area:{width:1330,height:600,label:'不足与感悟 · 灰稿候选'},weights:[1,1.2]},
 {id:'trial',source:path.join(root,'experiments/gray-information-architecture-20260916/source.txt'),plan:trial,area:{width:1170,height:492,label:'八周试点 · 灰稿候选'},weights:[1.6,1]},
];
const json=value=>JSON.stringify(value,null,2),results=[];
const selected=process.argv.slice(3);
for(const sample of cases.filter(sample=>!selected.length||selected.includes(sample.id))){
 const dir=path.join(output,sample.id);await fs.mkdir(dir);
 const raw=await fs.readFile(sample.source,'utf8'),base=newRunState(raw,sample.source);
 const content=structuredClone(sample.plan);
 for(const page of content.pages) for(const item of page.groups) for(const b of item.blocks) for(const k of ['kind','expression','relationship','production']) delete b[k];
 const expression={pages:sample.plan.pages.map(page=>({pageId:page.pageId,expressions:page.groups.map(item=>({groupIds:[item.id],heading:item.heading,kind:item.kind,blocks:item.blocks}))}))};
 const semanticPlan=bindGrayExpressions(content,expression);
 const semantic=validateSemanticPlan(base,semanticPlan);if(!semantic.accepted) throw new Error(json(semantic));
 const layout={pages:[{pageId:'p1',layout:{type:'row',weights:sample.weights}}]};
 const resolved=resolveGrayLayout(semanticPlan,layout,sample.area,{measureBody:grayBodyLayout,fitText:fitGrayText});
 const check=validateGrayPlan(base,resolved.plan,sample.area);if(!check.accepted) throw new Error(json({...check,state:undefined}));
 const state={...check.state,grayDraft:{version:'gray-draft-3',area:sample.area,status:'rendering',humanReview:'pending',planner:'current-codex-agent',scope:'主Agent按原稿规划，通过现有表达绑定与几何入口；不是外部模型独立通过。',artifactDirectory:'.',semanticPlan,history:[]}};
 const artifacts={'source.txt':raw,'content-plan.json':json(content),'expression-selection.json':json(expression),'semantic-plan.json':json(semanticPlan),'visible-plan.json':json(semanticReviewInput({source:raw,area:sample.area,plan:semanticPlan})),'layout-selection.json':json(layout),'layout-resolved.json':json(resolved.receipts),'program-check.json':json({...check,state:undefined}),'authorship.txt':state.grayDraft.scope};
 for(const [name,text] of Object.entries(artifacts)) await fs.writeFile(path.join(dir,name),text);
 await saveGrayState(path.join(dir,'state.json'),state);
 await renderGrayDraft(state,dir);
 state.grayDraft.status='awaiting-user-review';
 await saveGrayState(path.join(dir,'state.json'),state);
 results.push({case:sample.id,pages:state.pages.length,output:dir,planner:state.grayDraft.planner});
}
await fs.writeFile(path.join(output,'results.json'),json(results));console.log(json(results));
