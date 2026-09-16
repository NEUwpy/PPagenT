import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildChatProviderFromEnv} from '../../src/runner/chat-provider.mjs';
import {runGrayDraft} from '../../src/runner/gray-draft.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const output=path.resolve(process.argv[2]||'outputs/gray-diverse-20260916');
await fs.mkdir(output,{recursive:false});
const cases=JSON.parse(await fs.readFile(new URL('./cases.json',import.meta.url),'utf8'));
const json=x=>JSON.stringify(x,null,2),sha=x=>createHash('sha256').update(x).digest('hex');
const files=['src/runner/gray-draft.mjs','src/runner/gray-semantics.mjs','src/runner/gray-layout.mjs','src/composition/resolve.mjs','src/composition/content-stages.mjs','rules/内容结构.md','rules/页面组合.md','rules/排版.md'];
const hashes={};await fs.mkdir(path.join(output,'snapshot'));
for(const file of files){const data=await fs.readFile(path.join(root,file));hashes[file]=sha(data);await fs.writeFile(path.join(output,'snapshot',file.replaceAll('/','__')),data);}
await fs.writeFile(path.join(output,'cases.json'),json(cases));
const results=[],queue=[...cases];
// Two API workers; each case has one planning pass and the runner's existing layout retries.
async function worker(){for(let sample;(sample=queue.shift());){
 const source=path.join(output,sample.id+'.txt');await fs.writeFile(source,sample.source);
 const provider=await buildChatProviderFromEnv({root,maxTokens:18000,observer:e=>fs.appendFile(path.join(output,sample.id+'.events.ndjson'),JSON.stringify(e)+'\n')});
 const area={width:sample.width||1170,height:sample.height||492,label:sample.name};
 await fs.writeFile(path.join(output,sample.id+'.manifest.json'),json({model:provider.model,thinking:provider.extraBody?.thinking,maxTokens:provider.maxTokens,timeout:provider.requestTimeoutMs,maxAttempts:provider.maxAttempts,maxRevisions:0,area,hashes,scope:'Synthetic manuscript diagnostic; case focus is withheld from model. No manual plans or mid-run tuning.'}));
 console.log('START '+sample.id);let result;const start=Date.now();
 try{const state=await runGrayDraft({root,source,output:path.join(output,sample.id),provider,area,maxRevisions:0});result={id:sample.id,status:state.grayDraft.status,pages:state.pages.length,artifactDirectory:state.grayDraft.artifactDirectory};}
 catch(e){result={id:sample.id,status:'failed',error:e.message};}
 result.seconds=Math.round((Date.now()-start)/1000);results.push(result);
 await fs.writeFile(path.join(output,sample.id+'.result.json'),json(result));console.log(JSON.stringify(result));
}}
await Promise.all([worker(),worker()]);
await fs.writeFile(path.join(output,'results.json'),json(results));
for(const file of files)if(sha(await fs.readFile(path.join(root,file)))!==hashes[file])throw new Error('Code changed during run: '+file);
