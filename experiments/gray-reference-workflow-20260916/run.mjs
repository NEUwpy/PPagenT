import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildChatProviderFromEnv} from '../../src/runner/chat-provider.mjs';
import {runGrayDraft} from '../../src/runner/gray-draft.mjs';

const root=path.resolve(import.meta.dirname,'../..');
const [outputArg,...ids]=process.argv.slice(2);
if(!outputArg) throw new Error('run.mjs <new-output-directory> [reference|trial]');
const output=path.resolve(outputArg);
await fs.mkdir(output,{recursive:false});
const json=value=>JSON.stringify(value,null,2),sha=value=>createHash('sha256').update(value).digest('hex');
const files=['src/runner/gray-semantics.mjs','src/runner/gray-layout.mjs','src/runner/gray-draft.mjs','src/composition/content-stages.mjs','src/composition/resolve.mjs','rules/内容结构.md','rules/页面组合.md','rules/排版.md'];
await fs.mkdir(path.join(output,'snapshot'));
const hashes={};
for(const file of files){const data=await fs.readFile(path.join(root,file));hashes[file]=sha(data);await fs.writeFile(path.join(output,'snapshot',file.replaceAll('/','__')),data);}
const cases=[
  {id:'reference',source:path.join(import.meta.dirname,'source.txt'),area:{width:1330,height:600,label:'不足与感悟 · 范本原稿'}},
  {id:'trial',source:path.join(root,'experiments/gray-information-architecture-20260916/source.txt'),area:{width:1170,height:492,label:'八周试点 · 原退回案例迁移'}},
].filter(sample=>!ids.length||ids.includes(sample.id));
if(!cases.length) throw new Error('No matching cases');
const results=await Promise.all(cases.map(async sample=>{
  const provider=await buildChatProviderFromEnv({root,maxTokens:18000,observer:event=>fs.appendFile(path.join(output,`${sample.id}.events.ndjson`),json(event)+'\n')});
  await fs.writeFile(path.join(output,`${sample.id}.manifest.json`),json({case:sample.id,area:sample.area,model:provider.model,thinking:provider.extraBody?.thinking,maxTokens:provider.maxTokens,maxRevisions:0,hashes,scope:'One automatic planning pass; model output is not a visual acceptance result.'}));
  try{
    const state=await runGrayDraft({root,source:sample.source,output:path.join(output,sample.id),area:sample.area,provider,maxRevisions:0});
    return {id:sample.id,status:state.grayDraft.status,pages:state.pages.length,artifactDirectory:state.grayDraft.artifactDirectory};
  }catch(error){return {id:sample.id,status:'failed',error:error.message};}
}));
await fs.writeFile(path.join(output,'results.json'),json(results));
for(const file of files) if(sha(await fs.readFile(path.join(root,file)))!==hashes[file]) throw new Error(`Code changed during run: ${file}`);
console.log(json(results));
