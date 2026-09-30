// Fixed legacy visual plans test the repaired 0-diagram handoff. The positions
// below are fixture inputs, NOT a new production styling program or asset.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { loadGrayState } from '../../src/runner/run.mjs';
import { createCommitter } from '../../src/runner/tools/generation.mjs';
import { createToolRegistry } from '../../src/runner/tools/index.mjs';
import { buildTools,compileDeck } from '../../src/runner/tools/build-tools.mjs';
import { writeState } from '../../src/runner/state.mjs';
const directory=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(directory,'../..');
const runDir=path.join(directory,process.argv[2]??'handoff-01'),statePath=path.join(runDir,'state.json');
await fs.mkdir(runDir,{recursive:false});
const state=await loadGrayState({grayStatePath:path.join(directory,'run-01/state.json'),rootDir:root,skinId:'neutral-editorial-001'});
await writeState(statePath,state);
const committer=createCommitter({statePath});
const registry=createToolRegistry({tools:buildTools({root,runDir,committer,statePath}),runDir});
const t=(x,y,width,height)=>({frame:{x,y,width,height},fontRole:'body',fontSize:22,colorRole:'ink'});
const frames={services:{advice:t(.02,.20,.46,.3),appointment:{...t(.02,.53,.46,.1),fontSize:16},borrow:t(.52,.20,.46,.43),hours:t(.02,.72,.96,.18)},
 records:{scope:t(.02,.16,.96,.13),version:t(.02,.35,.96,.22),issue:t(.02,.63,.96,.28)}};
const catalog=(await registry.dispatch('read_catalog',{})).result;
await fs.writeFile(path.join(runDir,'catalog.json'),JSON.stringify(catalog,null,2));
assert(catalog.pages.every(p=>p.expressionRequirements.length===0));
const pages=state.pages.map(p=>({pageId:p.pageId,compositionId:'component-gray-regions',textSlots:[],regionVisuals:p.items.map(i=>({itemId:i.id,reason:'固定工程方案核对纯文字、标签、附注交接；不验证自动美化。',layout:{heading:{...t(.02,.02,.96,.1),fontSize:26,fontRole:'heading'},blocks:i.blocks.map(b=>({sourceLocation:`${i.id}/${b.id}`,...frames[p.pageId][b.id]})),decorations:[]}}))}));
const written=await registry.dispatch('upsert_page_plan',{pages});
await fs.writeFile(path.join(runDir,'binding-result.json'),JSON.stringify(written,null,2));
assert.equal(written.result.accepted,true,JSON.stringify(written.result));
try {
 const result=await compileDeck({root,runDir,state:await committer.read()});
 await fs.writeFile(path.join(runDir,'verification.json'),JSON.stringify({outputPptx:result.outputPptx,qualityAudit:result.qualityAudit},null,2));
 const JSZip=(await import('jszip')).default,zip=await JSZip.loadAsync(await fs.readFile(result.outputPptx));
 const texts=[];
 for(const f of Object.values(zip.files).filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f.name)))texts.push(await f.async('string'));
 const visible=texts.flatMap(xml=>[...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(m=>m[1])).join('').replace(/\s/gu,'');
 for(const b of state.pages.flatMap(p=>p.items.flatMap(i=>i.blocks)))for(const text of [b.label,b.text].filter(Boolean)) assert(visible.includes(text.replace(/\s/gu,'')),`missing ${text}`);
 console.log(JSON.stringify({outputPptx:result.outputPptx,audit:result.qualityAudit.status,sourceTextPreserved:true}));
}catch(error){await fs.writeFile(path.join(runDir,'failure.json'),JSON.stringify({message:error.message,stack:error.stack},null,2));throw error;}
