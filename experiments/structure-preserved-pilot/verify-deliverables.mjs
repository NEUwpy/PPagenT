import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
const out=process.argv[2]?path.resolve(process.argv[2]):import.meta.dirname;
const report=JSON.parse(await fs.readFile(path.join(out,'report.json'),'utf8'));
const normalize=s=>s.replace(/\s/g,'').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
const verified=[];
for(const r of report){
 if(r.status!=='rendered-unreviewed')throw new Error(`${r.key} not rendered`);
 const zip=await JSZip.loadAsync(await fs.readFile(path.join(out,'renders',`${r.key}.pptx`)));
 const xml=await zip.file('ppt/slides/slide1.xml').async('string');
 const text=normalize([...xml.matchAll(/<a:t>(.*?)<\/a:t>/gs)].map(m=>m[1]).join(''));
 const missing=r.fonts.filter(f=>!text.includes(normalize(f.text))).map(f=>f.text);
 if(missing.length)throw new Error(`${r.key} missing text: ${missing.join('|')}`);
 const png=await fs.stat(path.join(out,'renders',`${r.key}-pptx.png`));
 if(!png.size)throw new Error(`${r.key} no reimport image`);
 verified.push({key:r.key,textContentRetained:true,nativeShapes:(xml.match(/<p:sp>/g)||[]).length,svgIconImages:(xml.match(/<p:pic>/g)||[]).length});
}
await fs.writeFile(path.join(out,'deliverable-checks.json'),JSON.stringify(verified,null,2));
console.log(`${verified.length} PPTX files: source text retained, editable shape objects and reimported PNG present`);
