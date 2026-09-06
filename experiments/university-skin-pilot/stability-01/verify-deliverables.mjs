import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url));
const read=async p=>JSON.parse((await fs.readFile(path.resolve(base,p),'utf8')).replace(/^\uFEFF/,''));
const hash=async p=>crypto.createHash('sha256').update(await fs.readFile(path.resolve(base,p))).digest('hex');
const selections=await read('selected-deliverables.json');
const outcomes=await read('review-outcomes.json');
let pages=0;
for(const s of selections){
  const o=outcomes.runs.find(r=>r.run===s.run);
  if(!o?.wholeDeckAccepted)throw Error(`Selection lacks parent acceptance: ${s.run}`);
  const v=await read(`reviews/${s.run.replace('/','-')}/verification.json`);
  if(await hash(s.file)!==v.sha256||await hash(`${s.run}/deck.pptx`)!==v.sha256)throw Error(`Deck changed: ${s.run}`);
  for(const r of v.renders)if(await hash(r.path)!==r.sha256)throw Error(`Render changed: ${r.path}`);
  pages+=v.pageCount;
}
for(const f of await read('input-v9-execution-02-hashes.json')){
  // Resolve by filename so this frozen input can be checked from another checkout.
  if(await hash(`inputs-v9-execution-02/${path.win32.basename(f.file)}`)!==f.sha256.toLowerCase())throw Error(`Frozen input changed: ${f.file}`);
}
const m=await read('review-manifest.json');
for(const r of m.runs)for(const v of r.rounds){
  await fs.access(path.resolve(base,v.deck)); await fs.access(path.resolve(base,v.verification));
  for(const p of v.pages)await fs.access(path.resolve(base,p.image));
}
const html=await fs.readFile(path.join(base,'index.html'),'utf8');
for(const [,link]of html.matchAll(/href="([^"]+)"/g))await fs.access(path.resolve(base,link));
console.log(JSON.stringify({selectedDecks:selections.length,selectedPages:pages,hashes:'match',galleryLinks:'exist',frozenInputs:'match'},null,2));
