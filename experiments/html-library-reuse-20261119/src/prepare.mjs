import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const E=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),R=path.resolve(E,'../..');
const hash=b=>createHash('sha256').update(b).digest('hex');
const files={
 'content.json':'experiments/layout-methods-20261116/content.json',
 'assets/previous-slidev.png':'experiments/layout-methods-20261116/outputs/slidev.png',
 'assets/previous-seaslides.png':'experiments/layout-methods-20261116/outputs/seaslides.png',
 'assets/previous-native.png':'experiments/layout-methods-20261116/assets/previous-native.png',
 'assets/generated-reference.png':'experiments/layout-methods-20261116/assets/generated-reference.png',
 'assets/neu-logo.png':'experiments/layout-methods-20261116/assets/neu-logo.png',
 'assets/source-convergence.png':'assets/结构图/多路汇聚结果-003/example/slide-1.png',
 'assets/source-folded-notes.png':'assets/结构图/双排折角便签-002/example/slide-1.png',
};
const manifest=[];
for(const [dest,src] of Object.entries(files)){
 const b=await fs.readFile(path.join(R,src));await fs.writeFile(path.join(E,dest),b);manifest.push({file:dest,source:src,sha256:hash(b)});
}
const sources=['assets/结构图/多路汇聚结果-003/review.mjs','assets/结构图/多路汇聚结果-003/component.css','assets/结构图/多路汇聚结果-003/compact.css','assets/结构图/多路汇聚结果-003/structure-skill.json','assets/结构图/双排折角便签-002/review.mjs','assets/结构图/双排折角便签-002/component.css','assets/结构图/等权并列卡片-001/review.mjs','assets/结构图/等权并列卡片-001/component.css','src/visual-runtime/preserved-size-component.mjs','src/visual-runtime/text-layout-library.mjs','src/visual-runtime/text-flow.mjs','src/visual-runtime/html-component-theme.mjs','src/runtime/skins/university-mckinsey.mjs','src/runtime/skins/northeastern-university-contract.mjs','src/runtime/skins/northeastern-university-theme.mjs','src/runtime/shells/academic-report.mjs'];
const sourceHashes=[];for(const file of sources)sourceHashes.push({file,sha256:hash(await fs.readFile(path.join(R,file)))});
const oldManifest=JSON.parse(await fs.readFile(path.join(R,'experiments/layout-methods-20261116/evidence/delivery-manifest.json'),'utf8'));
const frozen=[];for(const f of oldManifest.files){const b=await fs.readFile(path.join(R,'experiments/layout-methods-20261116',f.path));frozen.push({file:f.path,unchanged:b.length===f.bytes&&hash(b)===f.sha256});}
if(frozen.some(f=>!f.unchanged))throw new Error('Previous experiment has changed before this task');
await fs.writeFile(path.join(E,'evidence/input-manifest.json'),JSON.stringify({tip:execFileSync('git',['rev-parse','HEAD'],{cwd:R,encoding:'utf8'}).trim(),copies:manifest,sources:sourceHashes,oldFrozenFiles:frozen},null,2));
await fs.writeFile(path.join(E,'evidence/initial-git-status.txt'),execFileSync('git',['status','--short'],{cwd:R,encoding:'utf8'}));
console.log('Copied common content, references and original library previews; old 44 files unchanged.');
