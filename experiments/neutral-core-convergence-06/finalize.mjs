import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
const workspaceDir = path.dirname(fileURLToPath(import.meta.url));
process.env.RUNTIME_NODE_MODULES = 'C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const skill = 'C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations';
const { finalizePresentation } = await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')));
await fs.mkdir(path.join(workspaceDir,'outputs'),{recursive:true});
await fs.mkdir(path.join(workspaceDir,'.finalizer'),{recursive:true});
const result=await finalizePresentation({explicitTotalSlideCount:3,workspaceDir,
 candidatePath:path.join(workspaceDir,'build/candidate.pptx'),finalPath:path.join(workspaceDir,'outputs/deck.pptx'),
 pythonExecutable:'C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',
 integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),
 layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),
 layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],
 requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],fontPolicy:{basis:'design',families:['Noto Serif SC','Noto Sans SC']},
 verifyArtifactToolImport:true,receiptPath:path.join(workspaceDir,'.finalizer/receipt.json')});
console.log(JSON.stringify(result));
