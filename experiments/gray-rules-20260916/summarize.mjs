import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const batches=['gray-diverse-20260916','gray-rules-discovery-20260916','gray-rules-refine-20260916','gray-rules-holdout-20260916','gray-rules-repeat-20260916'];
const read=async f=>{try{return JSON.parse(await fs.readFile(f,'utf8'));}catch{return null;}};
const records=[];
for(const batch of batches){const dir=path.join(root,'outputs',batch);const cases=await read(path.join(dir,'cases.json'));if(!cases)continue;
 const entries=await fs.readdir(dir,{withFileTypes:true});
 for(const ent of entries.filter(x=>x.isDirectory())){
  const historical=batch==='gray-diverse-20260916';
  const result=await read(historical?path.join(dir,ent.name+'.result.json'):path.join(dir,ent.name,'result.json'));if(!result)continue;
  const caseId=result.case||result.id;const sample=cases.find(c=>c.id===caseId);if(!sample)continue;
  const run=historical?path.join(dir,ent.name):path.join(dir,ent.name,'run');
  const state=await read(path.join(run,'state.json'));
  const check=await read(path.join(run,'revision-0','program-check.json'));
  const semantic=await read(path.join(run,'revision-0','semantic-check.json'));
  const visible=await read(path.join(run,'revision-0','visible-plan.json'));
  const visibleText=visible?.map(p=>[p.claim,...p.regions.flatMap(r=>[r.heading,...r.body.map(b=>b.text)])].join('\n')).join('\n');
  const content=await read(path.join(run,'revision-0','content-plan.json'));
  const urls=path.relative(path.join(root,'outputs','gray-rules-report-20260916'),run).replaceAll('\\','/');
  records.push({batch,case:caseId,name:sample.name,profile:historical?'historical':result.profile,pages:result.pages||0,plannedPages:content?.pages?.length||0,status:result.status,simulationVisible:visibleText===undefined?null:/模拟|假设/u.test(visibleText),programIssues:check?.issues||[],semanticIssues:semantic?.issues||[],semanticAccepted:semantic?.accepted??null,run:urls,source:sample.source,scope:'模拟性质仅做实际可见文本检索，不代表全面语义验收'});
 }
}
const report=path.join(root,'outputs','gray-rules-report-20260916');await fs.mkdir(report,{recursive:true});await fs.writeFile(path.join(report,'records.json'),JSON.stringify(records,null,2));
for(const r of records)console.log(JSON.stringify({batch:r.batch,case:r.case,profile:r.profile,pages:r.pages,plan:r.plannedPages,sim:r.simulationVisible,issues:r.programIssues.map(x=>x.code).join(','),semantic:r.semanticAccepted}));
