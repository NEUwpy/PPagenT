import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';
import JSZip from 'jszip';
const here=import.meta.dirname;
const skill='C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
process.env.RUNTIME_NODE_MODULES='C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
const finalPath=path.join(here,'final/页面编排-三页审核稿-v3.pptx');
await fs.mkdir(path.join(here,'final'),{recursive:true});
await finalizePresentation({candidatePath:path.join(here,'ppt-review/页面编排-三页审核稿.pptx'),finalPath,workspaceDir:here,explicitTotalSlideCount:3,
 pythonExecutable:'C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',
 integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),
 layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],verifyArtifactToolImport:true,receiptPath:path.join(here,'review-validation-v3.json')});
const {compiled}=JSON.parse(await fs.readFile(path.join(here,'three-pages.json'),'utf8'));
const zip=await JSZip.loadAsync(await fs.readFile(finalPath));
const checks=[];
for(let i=0;i<3;i++){
 const xml=await zip.file(`ppt/slides/slide${i+1}.xml`).async('string');
 const plain=[...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(m=>m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')).join('').replace(/\s/gu,'');
 const g=compiled.pages[i].draft.grouping;
 for(const entry of [g.topic,...g.groups.filter(x=>x.id!=='g1')]){const present=plain.includes(entry.sourceText.replace(/\s/gu,''));checks.push({page:i+1,id:entry.id??'topic',present});if(!present)throw new Error(`原文缺失 ${i+1} ${entry.id}`);}
}
await fs.writeFile(path.join(here,'review-content-check.json'),JSON.stringify({checks,exception:'文档总标题不重复放入正文；原文在备注中保留。'},null,2));
const imported=await PresentationFile.importPptx(await FileBlob.load(finalPath));
for(let i=0;i<3;i++){const png=await imported.export({slide:imported.slides.items[i],format:'png',scale:1});await fs.writeFile(path.join(here,'final',`slide-${i+1}.png`),new Uint8Array(await png.arrayBuffer()));}
console.log(finalPath);
