import fs from 'node:fs/promises';
import path from 'node:path';
import {buildChatProviderFromEnv} from '../../src/runner/chat-provider.mjs';
import {profiles} from './prompts.mjs';
const output=path.resolve(process.argv[2]);await fs.mkdir(output,{recursive:false});
const json=x=>JSON.stringify(x,null,2);
const make=(id,source,text,expected,blue=false)=>({id,expected,input:{source,area:{width:1170,height:492},requirements:[{pageId:'p1',pagePurpose:'读懂安排',narrative:source,groups:[{id:'g1',role:'安排',importance:'primary'}]}],visiblePages:[{pageId:'p1',claim:'模拟：安排说明',regions:[{id:'g1',kind:blue?'flow':'text',surface:blue?'浅蓝区：制作说明，四项均须上屏':'灰区：实际文案',heading:'安排',body:[{text:blue?'表达作用：说明行动与条件\n承载内容：'+text+'\n基本关系：按承载内容组织条件与动作\n制作要求：条件附着于对应动作，不增添节点':text,bold:false,gapBefore:0}]}]}]}});
const controls=[
 make('valid-blue','模拟：校对通过后才可发布，未通过退回修订。','校对通过后才可发布，未通过退回修订。',true,true),
 make('missing-condition','模拟：校对通过后才可发布，未通过退回修订。','完成校对后发布。',false,true),
 make('parallel-distorted','模拟：扫描与登记同时开展，复核通过才可入库。','先完成扫描，再登记；复核通过才可入库。',false),
 make('invented-gate','模拟：扫描与登记同时开展，贴标可以独立开始。','扫描和登记全部完成后，才可开始贴标。',false,true),
 make('false-evidence','模拟：设备故障可能导致延误，尚未核实。','设备故障已经确认造成延误。',false),
 make('valid-plain','模拟：离线工具可在无网络环境使用，在线工具需要网络连接。','离线工具可在无网络环境使用；在线工具需要网络连接。',true),
];
await fs.writeFile(path.join(output,'controls.json'),json(controls));
const missingScope=make('missing-scope','模拟：离线工具可无网络使用。','离线工具可无网络使用。',false);
missingScope.input.visiblePages[0].claim='离线工具使用条件';
controls.push(missingScope);
await fs.writeFile(path.join(output,'controls.json'),json(controls));
const results=[];
const names=(process.argv[3]||'original,positive,guarded').split(',');
for(const name of names){const p=profiles[name];
 const provider=await buildChatProviderFromEnv({root:process.cwd(),maxTokens:4000});
 for(const c of controls){const sent={messages:[{role:'system',content:p.review},{role:'user',content:json(c.input)}]};await fs.writeFile(path.join(output,name+'--'+c.id+'.messages.json'),json(sent));
 try{const response=await provider.complete(sent);await fs.writeFile(path.join(output,name+'--'+c.id+'.response.json'),json(response));const parsed=JSON.parse(response.content.trim().replace(/^```(?:json)?\s*/u,'').replace(/\s*```$/u,''));const accepted=parsed.accepted===true&&Array.isArray(parsed.issues)&&parsed.issues.length===0;results.push({profile:name,id:c.id,expected:c.expected,accepted,matched:accepted===c.expected});}
 catch(e){results.push({profile:name,id:c.id,error:e.message});}
 await fs.writeFile(path.join(output,'results.json'),json(results));console.log(JSON.stringify(results.at(-1)));
 }
}
