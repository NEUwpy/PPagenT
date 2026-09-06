import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

// Explicit runtime paths only. This reviewer never changes a submitted deck.
const [runArg, reviewArg, python, skill] = process.argv.slice(2);
if (!runArg || !reviewArg || !python || !skill) throw new Error('Usage: verify-run.mjs RUN REVIEW PYTHON PRESENTATIONS_SKILL');
const here = path.dirname(fileURLToPath(import.meta.url));
const pilot = path.dirname(here);
const run = path.resolve(runArg), review = path.resolve(reviewArg);
await fs.mkdir(review, {recursive:true});
const hash = async p => crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex');
function execute(bin, args) {
  const result = spawnSync(bin, args, {encoding:'utf8', env:{...process.env, PYTHONIOENCODING:'utf-8'}, maxBuffer:32*1024*1024, windowsHide:true});
  return {exitCode:result.status, stdout:result.stdout??'', stderr:result.stderr??'', error:result.error?.message};
}
const deck = path.join(run, 'deck.pptx'), sha256 = await hash(deck);
const inventory = execute(python,[path.join(here,'inspect-native.py'),deck]);
if (inventory.exitCode !== 0) throw new Error(inventory.stderr || inventory.error);
const native = JSON.parse(inventory.stdout);
const files = await fs.readdir(run);
const layouts = files.filter(n=>/^slide-\d+\.layout\.json$/.test(n)).sort((a,b)=>parseInt(a.match(/\d+/)[0])-parseInt(b.match(/\d+/)[0]));
const audits=[];
for (const layout of layouts) {
  const page = Number(layout.match(/\d+/)[0]);
  const textProcess=execute(process.execPath,[path.join(pilot,'audit-text-overlaps.mjs'),path.join(run,layout)]);
  let text;
  try { text=JSON.parse(textProcess.stdout)[0]; } catch {text={parseError:true,...textProcess};}
  const pair=files.find(n=>new RegExp(`^slide-0*${page}\\.node-label-pairs\\.json$`).test(n));
  let nodes={status:'not-declared', requiresManualApplicabilityReview:true};
  if(pair) {
    const check=execute(process.execPath,[path.join(pilot,'audit-node-labels.mjs'),path.join(run,layout),path.join(run,pair)]);
    try {nodes={...JSON.parse(check.stdout),exitCode:check.exitCode};} catch {nodes={parseError:true,...check};}
  }
  audits.push({page,layout,layoutSha256:await hash(path.join(run,layout)),text,nodes});
}
await fs.writeFile(path.join(review,'native-text.json'),JSON.stringify(native,null,2));
await fs.writeFile(path.join(review,'geometry.json'),JSON.stringify(audits,null,2));
const render=execute(python,[path.join(skill,'container_tools/render_slides.py'),deck,'--output_dir',path.join(review,'render')]);
await fs.writeFile(path.join(review,'render-log.txt'),JSON.stringify(render,null,2));
const overflow=execute(python,[path.join(skill,'container_tools/slides_test.py'),deck]);
await fs.writeFile(path.join(review,'canvas-test.txt'),JSON.stringify(overflow,null,2));
const renders=[];
for(const slide of native) {
  const img=path.join(review,'render',`slide-${slide.page}.png`);
  try { renders.push({page:slide.page,path:path.relative(here,img).replaceAll('\\','/'),sha256:await hash(img)}); }
  catch {renders.push({page:slide.page,missing:true});}
}
if(await hash(deck)!==sha256) throw new Error('Submitted PPTX changed during review');
const result={verifiedAt:new Date().toISOString(),run:path.relative(here,run).replaceAll('\\','/'),sha256,
  pageCount:native.length,layoutCount:layouts.length,layoutCoverageComplete:native.every(s=>audits.some(a=>a.page===s.page)),
  native:native.map(({text,...rest})=>({...rest,textRuns:text.length})),
  auditSummary:audits.map(a=>({page:a.page,capacity:a.text.textCapacityWarningCount,intersections:a.text.intersectionCount,
    ruleIntersections:a.text.textRuleIntersectionCount,ruleClearance:a.text.textRuleClearanceCount,
    nodePairs:a.nodes.pairCount,nodeIssues:a.nodes.issueCount,nodeStatus:a.nodes.status})),
  renderExitCode:render.exitCode,canvasTestExitCode:overflow.exitCode,renders,
  visualAcceptance:'Pending independent per-page review; numeric checks do not imply style acceptance.'};
await fs.writeFile(path.join(review,'verification.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
