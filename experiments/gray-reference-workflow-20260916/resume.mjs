import fs from 'node:fs/promises';
import path from 'node:path';
import {buildChatProviderFromEnv} from '../../src/runner/chat-provider.mjs';
import {runGrayDraft} from '../../src/runner/gray-draft.mjs';
const root=path.resolve(import.meta.dirname,'../..'),output=path.resolve(process.argv[2]);
const ids=process.argv.slice(3);if(!ids.length) throw new Error('resume.mjs <existing-output> <case...>');
for(const id of ids){
 const dir=path.join(output,id),state=JSON.parse(await fs.readFile(path.join(dir,'state.json'),'utf8'));
 const feedback=await fs.readFile(path.join(import.meta.dirname,`${id}-review.txt`),'utf8');
 const provider=await buildChatProviderFromEnv({root,maxTokens:18000,observer:event=>fs.appendFile(path.join(output,`${id}.events.ndjson`),JSON.stringify(event)+'\n')});
 try{const result=await runGrayDraft({root,source:state.sourcePath,output:dir,area:state.grayDraft.area,provider,maxRevisions:0,resume:true,feedback});console.log(JSON.stringify({id,status:result.grayDraft.status,pages:result.pages.length}));}
 catch(error){console.log(JSON.stringify({id,status:'failed',error:error.message}));}
}
