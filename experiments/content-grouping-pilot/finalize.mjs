import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';
import JSZip from 'jszip';
const here=import.meta.dirname;
const skill='C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
process.env.RUNTIME_NODE_MODULES='C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
const finalPath=path.join(here,'final/P3-staged.pptx');
await fs.mkdir(path.join(here,'final'),{recursive:true});
await fs.mkdir(path.join(here,'.validation'),{recursive:true});
await finalizePresentation({candidatePath:path.join(here,'P3-staged-candidate.pptx'),finalPath,workspaceDir:here,explicitTotalSlideCount:1,
 sourceTemplatePath:path.resolve(here,'../../assets/主题/东北大学-001/runtime-template.pptx'),requiredTemplateReferenceSlides:[1,2,3],minimumTemplateCoverageRatio:.8,
 pythonExecutable:'C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',
 integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),
 layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],verifyArtifactToolImport:true,receiptPath:path.join(here,'.validation/package-review.json')});
const zip=await JSZip.loadAsync(await fs.readFile(finalPath));
const xml=await zip.file('ppt/slides/slide1.xml').async('string');
const plain=[...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(m=>m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')).join('').replace(/\s/gu,'');
const bound=JSON.parse(await fs.readFile(path.join(here,'bound-expressions.json'),'utf8'));
const coverage=bound.expressions.map(e=>({groupId:e.groupId,present:plain.includes(e.group.sourceText.replace(/\s/gu,''))}));
if(coverage.some(g=>!g.present))throw new Error(`PPTX 缺组正文: ${JSON.stringify(coverage)}`);
await fs.writeFile(path.join(here,'export-content-review.json'),JSON.stringify({coverage,topic:'主题条使用简要主题句；完整主题段保存在实文草稿和演讲者备注。'},null,2));
const p=await PresentationFile.importPptx(await FileBlob.load(finalPath));
const png=await p.export({slide:p.slides.items[0],format:'png',scale:1});
await fs.writeFile(path.join(here,'P3-staged.png'),new Uint8Array(await png.arrayBuffer()));
console.log(JSON.stringify({finalPath,coveredGroups:coverage.length}));
