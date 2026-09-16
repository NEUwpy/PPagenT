import fs from 'node:fs/promises';
import path from 'node:path';
import {profiles} from './prompts.mjs';
import {buildChatProviderFromEnv} from '../../src/runner/chat-provider.mjs';
import {resolveGrayLayout} from '../../src/runner/gray-layout.mjs';
import {grayBodyLayout,fitGrayText} from '../../src/runner/gray-draft.mjs';
const output=path.resolve(process.argv[2]);await fs.mkdir(output,{recursive:false});
const json=x=>JSON.stringify(x,null,2),results=[];
// Identical historical semantic plans, no regeneration, one selection per repeat.
for(const id of ['evidence','uneven','hierarchy','long-deck']){
 const dir=path.resolve('outputs/gray-diverse-20260916',id);
 const plan=JSON.parse(await fs.readFile(path.join(dir,'revision-0/semantic-plan.json'),'utf8'));
 const state=JSON.parse(await fs.readFile(path.join(dir,'state.json'),'utf8'));
 const area={width:state.grayDraft.area.width,height:state.grayDraft.area.height};
 for(let repeat=1;repeat<=2;repeat++)for(const name of (repeat===1?['original','focused']:['focused','original'])){
  const key=`${id}--${name}--${repeat}`,provider=await buildChatProviderFromEnv({root:process.cwd(),maxTokens:4000});
  const sent={messages:[{role:'system',content:profiles[name].layout},{role:'user',content:json({area,plan})}]};
  await fs.writeFile(path.join(output,key+'.messages.json'),json(sent));let result;
  try{const response=await provider.complete(sent);await fs.writeFile(path.join(output,key+'.response.json'),json(response));const selection=JSON.parse(response.content.trim().replace(/^```(?:json)?\s*/u,'').replace(/\s*```$/u,''));
   try{const built=resolveGrayLayout(plan,selection,area,{measureBody:grayBodyLayout,fitText:fitGrayText});result={id,name,repeat,accepted:true,pages:built.plan.pages.length,selection};}
   catch(e){result={id,name,repeat,accepted:false,code:e.code||'layout-binding',error:e.message,selection};}
  }catch(e){result={id,name,repeat,accepted:false,code:'response',error:e.message};}
  results.push(result);await fs.writeFile(path.join(output,'results.json'),json(results));console.log(JSON.stringify(result));
 }
}
