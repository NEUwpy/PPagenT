// One frozen pass per case. No prompt tuning or candidate editing in this script.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildChatProviderFromEnv } from '../../src/runner/chat-provider.mjs';
import { runGrayDraft } from '../../src/runner/gray-draft.mjs';
import { SEMANTIC_REVIEW_CONTRACT, semanticReviewInput } from '../../src/runner/gray-semantics.mjs';

const root=path.resolve(import.meta.dirname,'../..');
const [mode,outputArg,...caseIds]=process.argv.slice(2);
if(!['reviews','generate'].includes(mode)||!outputArg) throw new Error('run.mjs reviews|generate <new-output-directory>');
const output=path.resolve(outputArg);
await fs.mkdir(output,{recursive:false});
const json=value=>JSON.stringify(value,null,2);
const sha=value=>createHash('sha256').update(value).digest('hex');
const files=['src/runner/gray-semantics.mjs','src/runner/gray-draft.mjs','src/runner/gray-layout.mjs','src/composition/resolve.mjs','src/composition/content-stages.mjs','rules/内容结构.md','rules/页面组合.md','rules/排版.md'];
await fs.mkdir(path.join(output,'snapshot'));
const hashes={};
for(const file of files) {
  const text=await fs.readFile(path.join(root,file),'utf8');hashes[file]=sha(text);
  await fs.writeFile(path.join(output,'snapshot',file.replaceAll('/','__')),text);
}
const provider=await buildChatProviderFromEnv({root,maxTokens:24000});
await fs.writeFile(path.join(output,'manifest.json'),json({mode,provider:provider.identity,providerSettings:provider.extraBody,maxTokens:provider.maxTokens,maxRevisions:0,hashes,scope:'Local diagnostic pass; not a success-rate estimate or user acceptance.'}));
const original=await fs.readFile(path.join(root,'experiments/gray-information-architecture-20260916/source.txt'),'utf8');
const parallel='模拟内容：资料发布安排。\n\n索引整理与条目校对同时开展；两项工作都完成后进行复核。复核通过才可发布，未通过则退回修订。';
const sequential='模拟内容：资料发布安排。\n\n先整理索引，完成后再校对条目；两项工作都完成后进行复核。复核通过才可发布，未通过则退回修订。';
const definitions='模拟内容：工具使用说明。\n\n离线工具适合无网络环境。在线工具需要网络连接。两种工具均支持按名称检索。';
const results=[];
if(mode==='generate') {
  const cases=[
    {id:'service-wide',source:original,width:1170,height:492},
    {id:'service-small',source:original,width:780,height:328},
    {id:'publish-parallel',source:parallel,width:1170,height:492},
    {id:'publish-sequential',source:sequential,width:1170,height:492},
    {id:'plain-text',source:definitions,width:1170,height:492},
  ];
  const queue=cases.filter(sample=>!caseIds.length || caseIds.includes(sample.id));
  if(!queue.length) throw new Error('No selected cases');
  const worker=async()=>{let sample;while((sample=queue.shift())) {
    const source=path.join(output,`${sample.id}.txt`);await fs.writeFile(source,sample.source);
    try {
      const state=await runGrayDraft({source,output:path.join(output,sample.id),root,provider,area:{width:sample.width,height:sample.height,label:sample.id},maxRevisions:0});
      results.push({id:sample.id,status:state.grayDraft.status,pages:state.pages.length,kinds:state.pages.flatMap(p=>p.items.map(i=>i.kind))});
    } catch(error) { results.push({id:sample.id,status:'failed',error:error.message}); }
    console.log(json(results.at(-1)));
  }};
  await Promise.all([worker(),worker()]);
  await fs.writeFile(path.join(output,'results.json'),json(results));
} else {
  const makePlan=({claim,narrative,blocks})=>({schemaVersion:'gray-plan-3',deckBrief:{title:'模拟材料',audience:'使用者',objective:'理解要求'},pages:[{
    pageId:'p1',title:'安排说明',claim,pagePurpose:'理解内容及必要限定',narrative,
    groups:[{id:'g1',role:'说明安排及其适用条件',importance:'primary',heading:'使用安排',kind:'text',blocks:blocks.map((text,i)=>({id:`b${i}`,text,sourceIds:['s1']}))}],
  }]});
  const rejected=JSON.parse(await fs.readFile(path.join(root,'outputs/gray-basic-layout-wide-20260916/revision-7/semantic-plan.json'),'utf8'));
  const cases=[
    {id:'rejected-wide',source:original,plan:rejected,expected:false},
    {id:'hidden-condition',source:'模拟内容：预检通过后才可开展测试，未通过则暂停。',expected:false,
      plan:makePlan({claim:'模拟：测试安排',narrative:'预检通过后才可开展测试，未通过则暂停',blocks:['开展测试。']})},
    {id:'parallel-to-sequence',source:parallel,expected:false,
      plan:makePlan({claim:'模拟：复核通过后发布',narrative:'索引整理与条目校对并行；全部完成后复核；未通过退回',blocks:['先整理索引，完成后再校对条目。','两项工作完成后复核，复核通过才可发布，未通过则退回修订。']})},
    {id:'legal-text',source:definitions,expected:true,
      plan:makePlan({claim:'模拟：按网络条件选工具',narrative:'两个工具的适用环境不同，检索功能相同',blocks:['离线工具适合无网络环境。','在线工具需要网络连接。','两种工具均支持按名称检索。']})},
  ];
  for(const sample of cases) {
    const input=semanticReviewInput({source:sample.source,area:{width:1170,height:492},plan:sample.plan});
    await fs.writeFile(path.join(output,`${sample.id}.input.json`),json(input));
    try {
      const response=await provider.complete({messages:[{role:'system',content:SEMANTIC_REVIEW_CONTRACT},{role:'user',content:json(input)}]});
      await fs.writeFile(path.join(output,`${sample.id}.response.json`),json(response));
      if(response.finishReason==='length') throw new Error('truncated');
      const review=JSON.parse(response.content.trim().replace(/^```(?:json)?\s*/u,'').replace(/\s*```$/u,''));
      const accepted=review.accepted===true && Array.isArray(review.issues) && !review.issues.length;
      results.push({id:sample.id,expected:sample.expected,accepted,matched:sample.expected===accepted,review});
    } catch(error) { results.push({id:sample.id,status:'failed',error:error.message}); }
    console.log(json(results.at(-1)));
    await fs.writeFile(path.join(output,'results.json'),json(results));
  }
}
for(const file of files) if(sha(await fs.readFile(path.join(root,file),'utf8'))!==hashes[file]) throw new Error(`Configuration changed during run: ${file}`);
