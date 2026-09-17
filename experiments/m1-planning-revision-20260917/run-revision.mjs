import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {buildChatProviderFromEnv} from '../../src/runner/chat-provider.mjs';
import {runGrayDraft} from '../../src/runner/gray-draft.mjs';
import {original} from '../gray-rules-20260916/prompts.mjs';
const root=path.resolve(import.meta.dirname,'../..'), output=path.join(root,'outputs/m1-planning-revision-20260917');
const a=path.join(root,'experiments/m1-planning-review-20260916/evidence');
const sha=b=>createHash('sha256').update(b).digest('hex'),json=x=>JSON.stringify(x,null,2);
await fs.mkdir(output,{recursive:false});
await fs.cp(path.join(a,'run'),path.join(output,'run'),{recursive:true,errorOnExist:true,force:false});
const feedback=await fs.readFile(path.join(import.meta.dirname,'feedback.md'),'utf8');
const fixed={};
for(const [i,stage]of ['content','expression','review','layout'].entries()){
 const m=JSON.parse(await fs.readFile(path.join(a,`${String(i+1).padStart(2,'0')}-${stage}.messages.json`),'utf8'));
 fixed[stage]=m.messages[0].content;
}
const before={};
for(const file of ['src/runner/gray-draft.mjs','src/runner/gray-semantics.mjs','src/runner/gray-layout.mjs','src/composition/resolve.mjs','src/composition/content-stages.mjs','rules/内容结构.md','rules/页面组合.md','rules/排版.md'])before[file]=sha(await fs.readFile(path.join(root,file)));
const provider=await buildChatProviderFromEnv({root,maxTokens:18000,observer:e=>fs.appendFile(path.join(output,'events.ndjson'),json(e)+'\n')});
assert.equal(provider.model,'deepseek-v4-flash');
assert.equal(provider.extraBody?.thinking?.type,'disabled');
const complete=provider.complete.bind(provider);let call=0;
provider.complete=async args=>{
 const sent=structuredClone(args),stage=Object.entries(original).find(([,v])=>sent.messages[0].content.startsWith(v))?.[0];
 assert.ok(stage,'Unknown stage');sent.messages[0].content=fixed[stage];
 const stem=String(++call).padStart(2,'0')+'-'+stage;
 await fs.writeFile(path.join(output,stem+'.messages.json'),json(sent));
 const response=await complete(sent);await fs.writeFile(path.join(output,stem+'.response.json'),json(response));return response;
};
await fs.writeFile(path.join(output,'manifest.json'),json({type:'supervised-revision',baseline:'layoutOnly--hierarchy',model:provider.model,thinking:provider.extraBody.thinking,maxTokens:provider.maxTokens,maxRevisions:0,hashes:before,systemMessages:'Exact baseline sent system messages reused',referenceStudyIncluded:false,feedbackSha256:sha(feedback),inheritedArtifacts:'run/revision-0 and root PPT are A; resolve B from state.grayDraft.artifactDirectory'}));
let result;
try{const state=await runGrayDraft({root,source:path.join(a,'source.txt'),output:path.join(output,'run'),area:{width:1170,height:492,label:'分类与不等长条目'},provider,resume:true,maxRevisions:0,feedback});result={status:state.grayDraft.status,pages:state.pages.length,artifactDirectory:state.grayDraft.artifactDirectory};}
catch(e){result={status:'failed',message:e.message};}
for(const [f,h]of Object.entries(before))assert.equal(sha(await fs.readFile(path.join(root,f))),h);
await fs.writeFile(path.join(output,'result.json'),json(result));console.log(json({output,...result}));
