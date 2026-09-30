// No page-specific coordinates, font choices or copied content in the request.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {loadGrayState} from '../../src/runner/run.mjs';
import {createCommitter} from '../../src/runner/tools/generation.mjs';
import {createToolRegistry} from '../../src/runner/tools/index.mjs';
import {buildTools} from '../../src/runner/tools/build-tools.mjs';
import {writeState} from '../../src/runner/state.mjs';
import {resolveTextProgram,TEXT_PROGRAM} from '../../src/render/gray-text-program.mjs';
import {PresentationFile,FileBlob} from '../../src/ppt-engine/index.mjs';
const directory=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(directory,'../..');
const runDir=path.join(directory,process.argv[2]??'program-01'),statePath=path.join(runDir,'state.json');
await fs.mkdir(runDir,{recursive:false});
const state=await loadGrayState({grayStatePath:path.join(directory,'run-03/state.json'),rootDir:root,skinId:'neutral-editorial-001'});
await writeState(statePath,state);
const committer=createCommitter({statePath}),registry=createToolRegistry({tools:buildTools({root,runDir,committer,statePath}),runDir});
const catalog=await registry.dispatch('read_catalog',{});
assert(catalog.result.grayVisualDesign.programs.some(p=>p.id===TEXT_PROGRAM));
const pages=state.pages.map(p=>({pageId:p.pageId,compositionId:'component-gray-regions',textSlots:[],regionVisuals:p.items.map(i=>({itemId:i.id,reason:'以已登记文字程序消费原区域和绑定',program:TEXT_PROGRAM}))}));
await fs.writeFile(path.join(runDir,'program-request.json'),JSON.stringify(pages,null,2));
const written=await registry.dispatch('upsert_page_plan',{pages});
assert.equal(written.result.accepted,true,JSON.stringify(written));
const check=await registry.dispatch('check_pages',{});
await fs.writeFile(path.join(runDir,'check-result.json'),JSON.stringify(check,null,2));
if(!check.result.accepted) {
 const issues=[...(check.result.pages??[]).flatMap(p=>p.issues??[]),...(check.result.deck?.issues??[]).flatMap(p=>p.issues??[p])];
 assert(issues.length && issues.every(i=>['missing-rendered-font-evidence','missing-rendered-line-evidence'].includes(i.code)),JSON.stringify(check.result));
}
const geometry=state.pages.map((p,i)=>resolveTextProgram(p,pages[i],state.grayDraft.area,{left:55,top:166,width:1170,height:492}));
await fs.writeFile(path.join(runDir,'program-geometry.json'),JSON.stringify(geometry,null,2));
const deck=await PresentationFile.importPptx(await FileBlob.load(path.join(runDir,'deck.pptx')));
const preview=path.join(runDir,'reimport-preview');await fs.mkdir(preview);
for(const [i,slide] of deck.slides.items.entries()) {
 const stem=`slide-${String(i+1).padStart(2,'0')}`;
 const png=await deck.export({slide,format:'png',scale:1});
 await fs.writeFile(path.join(preview,`${stem}.png`),Buffer.from(await png.arrayBuffer()));
 await fs.writeFile(path.join(preview,`${stem}.layout.json`),await (await slide.export({format:'layout'})).text());
}
const JSZip=(await import('jszip')).default,zip=await JSZip.loadAsync(await fs.readFile(path.join(runDir,'deck.pptx')));
for(const [index,page] of state.pages.entries()) {
 const xml=await zip.file(`ppt/slides/slide${index+2}.xml`).async('string');
 const text=[...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(m=>m[1]).join('').replace(/\s/gu,'');
 for(const b of page.items.flatMap(i=>i.blocks))for(const value of [b.label,b.text].filter(Boolean))assert(text.includes(value.replace(/\s/gu,'')),`${page.pageId} lost ${value}`);
}
const verification={runDir,accepted:check.result.accepted,sourceTextPreserved:true,review:'awaiting-human-review',productionModelInvoked:false,
 limitations:check.result.accepted?[]:['当前引擎 layout/v5 缺少实际字号与行盒证据；自动交付保持失败，不以输入样式代替渲染验证。']};
await fs.writeFile(path.join(runDir,'verification.json'),JSON.stringify(verification,null,2));
console.log(JSON.stringify(verification));
