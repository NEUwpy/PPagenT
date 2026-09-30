const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=process.cwd();
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const exists=p=>fs.existsSync(p);
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const rel=p=>path.relative(root,p).replaceAll('\\','/');
const tally=(rows,fn)=>rows.reduce((a,r)=>{const key=fn(r)??'missing';a[key]=(a[key]??0)+1;return a;},{});
const assets=walk('assets').filter(p=>path.basename(p)==='asset.json').map(p=>({path:rel(path.resolve(p)),data:read(p)}));
const structures=assets.filter(a=>a.data.status==='core'&&a.data.runtime?.logicId&&a.data.runtime.renderer!=='skin').map(({path:p,data:a})=>{
 const dir=path.dirname(p),gp=path.join(dir,'structure-skill.json'),g=exists(gp)?read(gp):{};
 return {id:a.id,path:p,logic:a.runtime.logicId,renderer:a.runtime.renderer,declaredCount:a.runtime.itemCount,
  runtimeEntry:exists(path.join(dir,a.runtime.entry??'runtime.mjs')),guide:exists(gp),guideValidation:g.validation?.status,
  implementation:g.implementation,reviewEntry:exists(path.join(dir,g.exampleImplementation??'review.mjs')),
  fields:Boolean(a.fieldContract),capacity:Boolean(a.capacity),semanticContract:Boolean(a.semanticContract),spatialContract:Boolean(a.spatialContract),
  examplePptx:exists(path.join(dir,a.showcase??'example.pptx')),
  examplePngs:exists(path.join(dir,'example'))?walk(path.join(dir,'example')).filter(p=>p.endsWith('.png')).length:0};
});
const logic=read('catalog/logic-map.json').logics;
const runsDir='.tmp/production-workbench/runs';
const runs=fs.readdirSync(runsDir).sort().reverse().slice(0,8).map(id=>{
 const dir=path.join(runsDir,id),sf=path.join(dir,'state.json');
 if(!exists(sf))return {id,state:false};
 const s=read(sf),files=walk(dir),r=files.filter(p=>p.endsWith('layout-selection-result.json')).map(p=>({path:rel(path.resolve(p)),...read(p)}));
 return {id,state:true,status:s.grayDraft?.status,layoutMode:s.grayDraft?.layoutMode,controlledOrganization:exists(path.join(dir,'input','initial-plan.json')),pages:s.pages?.length,
  pptx:files.filter(p=>p.endsWith('.pptx')).map(p=>rel(path.resolve(p))),pngCount:files.filter(p=>p.endsWith('.png')).length,
  selections:r.map(x=>({path:x.path,status:x.status,reason:x.reason,pages:x.selection?.pages?.map(p=>({relation:p.relation,candidateId:p.candidateId}))}))};
});
const out={date:'2026-09-28',baseCommit:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Read-only implementation and evidence inventory; declarations do not certify rendering or generalization',
 summary:{coreStructures:structures.length,registeredLogics:logic.length,nonemptyLogics:logic.filter(l=>l.assetIds.length).length,
 renderer:tally(structures,s=>s.renderer),guideValidation:tally(structures,s=>s.guideValidation),implementationStatus:tally(structures,s=>s.implementation?.status),implementationMode:tally(structures,s=>s.implementation?.mode),
 withFields:structures.filter(s=>s.fields).length,withCapacity:structures.filter(s=>s.capacity).length,withSemantic:structures.filter(s=>s.semanticContract).length,withSpatial:structures.filter(s=>s.spatialContract).length,withExamplePptx:structures.filter(s=>s.examplePptx).length,withExamplePngs:structures.filter(s=>s.examplePngs).length},
 logics:logic.map(l=>({id:l.id,assets:l.assetIds})),compositionLayouts:read('catalog/composition-layouts.json').layouts.map(l=>l.id),structures,recentWorkbenchRuns:runs};
const dir='experiments/capability-inventory-20260928';fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'inventory.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({summary:out.summary,compositionLayouts:out.compositionLayouts,runs:runs.map(({pptx,selections,...r})=>({...r,pptx:pptx?.length,selections:selections?.map(s=>({status:s.status,pages:s.pages,reason:s.reason}))}))},null,2));
