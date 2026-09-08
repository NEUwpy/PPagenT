import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
const out=import.meta.dirname,dir=path.join(out,'luna');
const normalize=s=>String(s).replace(/\s/g,'');
const records=[];
async function files(base,prefix=''){const result=[];for(const e of await fs.readdir(base,{withFileTypes:true})){const relative=path.join(prefix,e.name);if(e.isDirectory())result.push(...await files(path.join(base,e.name),relative));else result.push(relative);}return result;}
for(const file of await files(dir)){
 if(!file.endsWith('.pptx'))continue;
 const zip=await JSZip.loadAsync(await fs.readFile(path.join(dir,file)));
 const slides=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n));
 for(const slidePath of slides){
  const xml=await zip.file(slidePath).async('string');
  const text=[...xml.matchAll(/<a:t>(.*?)<\/a:t>/gs)].map(m=>m[1].replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>')).join('');
  const sizes=[...new Set([...xml.matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)].map(m=>Number(m[1])/100))];
  const record=JSON.parse(await fs.readFile(path.join(dir,file.replace(/\.pptx$/,'.json')),'utf8'));
  const s=record.spec,c=s.content;
  const expected=[s.title,...(s.blocks??[]).map(b=>b.text),...(c.items??[]).flatMap(n=>[n.title,n.body]),...(c.levels??[]).flatMap(n=>[n.title,n.body]),...(c.steps??[]).map(n=>n.title)].filter(Boolean);
  const missing=expected.filter(t=>!normalize(text).includes(normalize(t)));
  if(missing.length)throw new Error(`${file}: missing ${missing.join('|')}`);
  records.push({file,slidePath,text,missingSubmittedText:missing,fontSizesPt:sizes,unexpectedSizes:sizes.filter(s=>![11.25,12.75,15.75,18.75,36,43.5].includes(s)),nativeShapes:(xml.match(/<p:sp>/g)??[]).length,icons:(xml.match(/<p:pic>/g)??[]).length});
 }
}
await fs.writeFile(path.join(out,'technical-checks.json'),JSON.stringify(records,null,2));
console.log(JSON.stringify({slides:records.length,unexpectedFontRecords:records.filter(r=>r.unexpectedSizes.length).length}));
// Content coverage and whole-page quality are independently reviewed in parent-review.json.
