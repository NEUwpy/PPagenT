import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

// Explicit runtime paths come from load_workspace_dependencies; no fallback lookup.
const [python,skillDir] = process.argv.slice(2);
if (!python || !skillDir) throw new Error('Provide bundled Python executable and presentation skill directory');
const out = path.dirname(fileURLToPath(import.meta.url));
const pilot = path.dirname(out);
const specs = [
  {id:'data',run:'reference-01/run-09',layout:'page-01.layout.json'},
  {id:'flow',run:'reference-01/run-08',layout:'page-01.layout.json',pairs:true},
  {id:'decision',run:'transfer-02/run-04',layout:'slide-01.layout.json'},
  {id:'parallel',run:'transfer-03/run-05',layout:'layoutJSON.json',pairs:true},
];
const hash = async p => crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex');
const results=[];
for(const spec of specs) {
  const run=path.join(pilot,spec.run), pptx=path.join(run,'deck.pptx');
  const before=await hash(pptx);
  const audit=JSON.parse(execFileSync(process.execPath,[path.join(pilot,'audit-text-overlaps.mjs'),path.join(run,spec.layout)],{encoding:'utf8'}))[0];
  await fs.writeFile(path.join(out,`${spec.id}-text-audit.json`),JSON.stringify(audit,null,2));
  if(['textCapacityWarningCount','intersectionCount','textRuleIntersectionCount','textRuleClearanceCount'].some(k=>audit[k]!==0)) throw new Error(`${spec.id}: unresolved text audit findings`);
  let nodeAudit=null;
  if(spec.pairs) {
    nodeAudit=JSON.parse(execFileSync(process.execPath,[path.join(pilot,'audit-node-labels.mjs'),path.join(run,spec.layout),path.join(run,'node-label-pairs.json')],{encoding:'utf8'}));
    await fs.writeFile(path.join(out,`${spec.id}-node-audit.json`),JSON.stringify(nodeAudit,null,2));
  }
  // Flow was already independently rendered and tested in this review. Verify its
  // unchanged source hash before reusing that exact render; all others render here.
  let testOutput;
  if(spec.id==='flow' && before==='b7d10c98d172525329d5ae920a89e21b8ec140bdc5f99aeba0010a2fca64b698') {
    await fs.access(path.join(out,'flow-render/slide-1.png'));
    testOutput='Previously checked unchanged source in this review: Test passed. No overflow detected.';
  } else {
    execFileSync(python,[path.join(skillDir,'container_tools/render_slides.py'),pptx,'--output_dir',path.join(out,`${spec.id}-render`)],{stdio:'pipe'});
    testOutput=execFileSync(python,[path.join(skillDir,'container_tools/slides_test.py'),pptx],{encoding:'utf8'}).trim();
  }
  const native=JSON.parse(execFileSync(python,['-c',
    'import sys,zipfile,json,xml.etree.ElementTree as E; z=zipfile.ZipFile(sys.argv[1]); ns={"p":"http://schemas.openxmlformats.org/presentationml/2006/main","a":"http://schemas.openxmlformats.org/drawingml/2006/main"}; names=[n for n in z.namelist() if n.startswith("ppt/slides/slide") and n.endswith(".xml")]; out=[]\nfor n in names:\n r=E.fromstring(z.read(n)); out.append({"slide":n,"shapes":len(r.findall(".//p:sp",ns)),"connectors":len(r.findall(".//p:cxnSp",ns)),"pictures":len(r.findall(".//p:pic",ns)),"textRuns":len(r.findall(".//a:t",ns))})\nprint(json.dumps(out))',pptx],{encoding:'utf8'}));
  if(native.length!==1 || native[0].textRuns===0 || native[0].pictures!==0) throw new Error(`${spec.id}: unexpected native-slide structure`);
  if(before!==await hash(pptx)) throw new Error(`${spec.id}: PPTX changed during review`);
  results.push({id:spec.id,pptx:path.relative(out,pptx).replaceAll('\\','/'),sha256:before,
    render:`${spec.id}-render/slide-1.png`,renderSha256:await hash(path.join(out,`${spec.id}-render/slide-1.png`)),
    textCapacityWarnings:audit.textCapacityWarningCount,textFrameIntersections:audit.intersectionCount,
    textRuleIntersections:audit.textRuleIntersectionCount,nodePairs:nodeAudit?.pairCount??0,nodeIssues:nodeAudit?.issueCount??0,
    native,testOutput,visualAcceptance:'separate manual review in review.txt'});
  console.log(`${spec.id}: native output, render and declared geometry checks verified`);
}
await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),results},null,2));
