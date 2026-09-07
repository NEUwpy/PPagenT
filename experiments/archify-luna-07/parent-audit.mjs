import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../..');
const candidate=JSON.parse(await fs.readFile(path.join(dir,'candidate-v3.json'),'utf8'));
const previous=JSON.parse(await fs.readFile(path.join(dir,'candidate-v2.json'),'utf8'));
const links=s=>s.edges.map(e=>`${e.from}|${e.to}|${e.label}`).sort();
const unchangedRelations=JSON.stringify(links(candidate))===JSON.stringify(links(previous));
const validated=spawnSync(process.execPath,['skills/vendor/archify/bin/archify.mjs','validate','workflow','experiments/archify-luna-07/candidate-v3.json','--quality','showcase','--json'],{cwd:root,encoding:'utf8'});
await fs.writeFile(path.join(dir,'parent-validation.json'),validated.stdout);
const visual=JSON.parse(await fs.readFile(path.join(dir,'archify-luna-07.visual-check.json'),'utf8'));
const hash=createHash('sha256').update(await fs.readFile(path.join(dir,'archify-luna-07.html'))).digest('hex');
const report={validationExitCode:validated.status,unchangedRelations,nodes:candidate.nodes.length,edges:candidate.edges.length,
  artifactHash:hash,browserReceiptMatchesArtifact:hash===visual.artifact.sha256,browserAutomatedStatus:visual.status,
  parentVisualReview:'revise',issues:['1440 light screenshot appears to clip the heading at the top; cause not verified','node icons and Chinese titles are crowded','body text is too small for direct slide use'],
  additionalBrowserReview:'in-app file URL blocked by browser security policy; no alternate browser attempted',
  nativeEditablePptx:false};
await fs.writeFile(path.join(dir,'parent-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(validated.status!==0||!unchangedRelations||!report.browserReceiptMatchesArtifact)process.exitCode=1;
