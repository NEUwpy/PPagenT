import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
const root=import.meta.dirname;
const expected=JSON.parse(await fs.readFile(path.join(root,'expected.json'),'utf8'));
async function files(dir){const out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()&&e.name!=='node_modules')out.push(...await files(p));else if(e.isFile())out.push(p);}return out;}
const batches=[];
const parentReview=JSON.parse(await fs.readFile(path.join(root,'parent-round-1.json'),'utf8'));
for(let n=1;n<=3;n++){
 const dir=path.join(root,`batch-${n}`), all=await files(dir);
 const input=JSON.parse(await fs.readFile(path.join(dir,'input.json'),'utf8'));
 const logs=[];
 for(const file of all.filter(p=>/\.(?:ndjson|jsonl)$/.test(p)&&!p.includes('.inspect.'))){
  for(const line of (await fs.readFile(file,'utf8')).split(/\r?\n/).filter(Boolean)){
   try{const item=JSON.parse(line);if(['attempt','success','failure'].includes(item.event))logs.push({...item,file:path.relative(root,file)});}catch{}
  }
 }
 const decks=[];
 for(const file of all.filter(p=>p.endsWith('.pptx'))){
  const zip=await JSZip.loadAsync(await fs.readFile(file));const slides=Object.keys(zip.files).filter(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a,b)=>Number(a.match(/slide(\d+)/)[1])-Number(b.match(/slide(\d+)/)[1]));
  const summary=[];for(const name of slides){const xml=await zip.file(name).async('string');summary.push({slide:Number(name.match(/slide(\d+)/)[1]),shapes:(xml.match(/<p:sp>/g)||[]).length,pictures:(xml.match(/<p:pic>/g)||[]).length,connectors:(xml.match(/<p:cxnSp>/g)||[]).length,texts:[...xml.matchAll(/<a:t>(.*?)<\/a:t>/gs)].map(m=>m[1])});}
  decks.push({file:path.relative(root,file),slides:summary});
 }
 const choicePath=all.find(p=>p===path.join(dir,'choice.json'));
 let choices=choicePath?JSON.parse(await fs.readFile(choicePath,'utf8')):[];
 if(!Array.isArray(choices))choices=choices.cases??choices.choices??[];
 const cases=input.map((c,i)=>{const choice=choices.find(x=>x.caseId===c.caseId);const selected=choice?.selectedAssetIds??[];return{caseId:c.caseId,title:c.title,expectedAssetId:expected.find(x=>x.caseId===c.caseId).assetId,selectedAssetIds:selected,expectedSelected:selected.includes(expected.find(x=>x.caseId===c.caseId).assetId),choicePresent:!!choice,visualReview:parentReview.batches[n]?.[i]??'parent-pending'};});
 const uniqueLogs=[...new Map(logs.map(l=>{const {file,...event}=l;return [JSON.stringify(event),l];})).values()];
 batches.push({batch:n,cases,logs:uniqueLogs,decks,pngs:all.filter(p=>p.endsWith('.png')).map(p=>path.relative(root,p))});
}
const targeted=[];
for(const group of ['a','b','c']){
 const dir=path.join(root,`targeted-${group}`),all=await files(dir);
 const choices=JSON.parse(await fs.readFile(path.join(dir,'choice.json'),'utf8'));
 const logs=[];
 for(const file of all.filter(p=>/\.(?:ndjson|jsonl)$/.test(p)&&!p.includes('round-'))){
  for(const line of (await fs.readFile(file,'utf8')).split(/\r?\n/).filter(Boolean)){
   try{const item=JSON.parse(line);if(['attempt','success','failure'].includes(item.event))logs.push({...item,file:path.relative(root,file)});}catch{}
  }
 }
 targeted.push({group,choices,logs,deck:`targeted-${group}/candidate.pptx`,visualReview:'See parent-targeted.json; self-review is not parent acceptance.'});
}
const naturalAssets=[...new Set(batches.flatMap(b=>b.cases.flatMap(c=>c.selectedAssetIds)))];
const targetedAssets=[...new Set(targeted.flatMap(b=>b.choices.flatMap(c=>c.selectedAssetIds)))];
const result={generatedAt:new Date().toISOString(),coverage:{natural:naturalAssets.length,combined:new Set([...naturalAssets,...targetedAssets]).size,total:expected.length},batches,targeted,notice:'Invocation success, candidate existence and native shape counts are not visual acceptance.'};
await fs.writeFile(path.join(root,'evidence-summary.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(batches.map(b=>({batch:b.batch,cases:b.cases.length,chosen:b.cases.filter(c=>c.choicePresent).length,attempts:b.logs.filter(l=>l.event==='attempt').length,successes:b.logs.filter(l=>l.event==='success').length,failures:b.logs.filter(l=>l.event==='failure').length,decks:b.decks.map(d=>({file:d.file,slides:d.slides.length})),pngs:b.pngs.length})),null,2));
