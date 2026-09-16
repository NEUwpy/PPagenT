import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildChatProviderFromEnv} from '../../src/runner/chat-provider.mjs';
import {runGrayDraft} from '../../src/runner/gray-draft.mjs';
import {original,profiles} from './prompts.mjs';
const root=path.resolve(import.meta.dirname,'../..'),json=x=>JSON.stringify(x,null,2),sha=x=>createHash('sha256').update(x).digest('hex');
const [outArg,casesArg='experiments/gray-diverse-20260916/cases.json',profileArg='original,positive,guarded']=process.argv.slice(2);
if(!outArg)throw new Error('run.mjs <new-output> [cases.json] [profiles]');
const output=path.resolve(outArg),names=profileArg.split(',');
if(names.some(n=>!profiles[n]))throw new Error('unknown profile');
await fs.mkdir(output,{recursive:false});
const cases=JSON.parse(await fs.readFile(path.resolve(casesArg),'utf8'));
await fs.writeFile(path.join(output,'cases.json'),json(cases));
const files=['src/runner/gray-draft.mjs','src/runner/gray-semantics.mjs','src/runner/gray-layout.mjs','src/composition/resolve.mjs','src/composition/content-stages.mjs','src/content/source-fidelity.mjs','rules/内容结构.md','rules/页面组合.md','rules/排版.md','experiments/gray-rules-20260916/prompts.mjs'];
const hashes={};await fs.mkdir(path.join(output,'snapshot'));
for(const f of files){const data=await fs.readFile(path.join(root,f));hashes[f]=sha(data);await fs.writeFile(path.join(output,'snapshot',f.replaceAll('/','__')),data);}
await fs.writeFile(path.join(output,'prompts.json'),json(Object.fromEntries(names.map(n=>[n,profiles[n]]))));
await fs.writeFile(path.join(output,'prompt-lengths.json'),json(Object.fromEntries(names.map(n=>[n,Object.fromEntries(Object.entries(profiles[n]).map(([k,v])=>[k,v.length]))]))));
const queue=cases.flatMap((c,i)=>names.map((_,j)=>({sample:c,name:names[(j+i)%names.length]}))),results=[];
async function worker(){for(let job;(job=queue.shift());){
 const {sample,name}=job,id=name+'--'+sample.id,dir=path.join(output,id);await fs.mkdir(dir);
 const source=path.join(dir,'source.txt');await fs.writeFile(source,sample.source);
 const provider=await buildChatProviderFromEnv({root,maxTokens:18000,observer:e=>fs.appendFile(path.join(dir,'events.ndjson'),JSON.stringify(e)+'\n')});
 const complete=provider.complete.bind(provider);let call=0;
 provider.complete=async args=>{
  const sent=structuredClone(args);let stage='unknown';
  for(const [k,v]of Object.entries(original))if(sent.messages[0]?.content.startsWith(v)){stage=k;sent.messages[0].content=profiles[name][k]+sent.messages[0].content.slice(v.length);break;}
  if(stage==='unknown')throw new Error('unknown prompt stage');
  const stem=String(++call).padStart(2,'0')+'-'+stage;
  await fs.writeFile(path.join(dir,stem+'.messages.json'),json(sent));
  const response=await complete(sent);await fs.writeFile(path.join(dir,stem+'.response.json'),json(response));return response;
 };
 const area={width:sample.width||1170,height:sample.height||492,label:sample.name};
 await fs.writeFile(path.join(dir,'manifest.json'),json({name,case:sample.id,model:provider.model,thinking:provider.extraBody?.thinking,maxTokens:provider.maxTokens,timeout:provider.requestTimeoutMs,maxAttempts:provider.maxAttempts,maxRevisions:0,area,hashes,effectivePrompts:'NN-stage.messages.json contains actual sent messages; runner prompt files retain original constants.',focusWithheld:true}));
 console.log('START '+id);const start=Date.now();let result;
 try{const state=await runGrayDraft({root,source,output:path.join(dir,'run'),provider,area,maxRevisions:0});result={id,case:sample.id,profile:name,status:state.grayDraft.status,pages:state.pages.length};}
 catch(e){result={id,case:sample.id,profile:name,status:'failed',error:e.message};}
 result.seconds=Math.round((Date.now()-start)/1000);await fs.writeFile(path.join(dir,'result.json'),json(result));results.push(result);console.log(JSON.stringify(result));
}}
await Promise.all([worker(),worker()]);
await fs.writeFile(path.join(output,'results.json'),json(results));
for(const f of files)if(sha(await fs.readFile(path.join(root,f)))!==hashes[f])throw new Error('changed during run: '+f);
