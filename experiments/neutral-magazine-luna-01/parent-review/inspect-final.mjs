import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';

// Read final imported layout and PPTX; never infer semantic role from a name.
const [pptx, layoutDir, output] = process.argv.slice(2);
if (!pptx || !layoutDir || !output) throw new Error('Usage: inspect-final.mjs <pptx> <render-directory> <output.json>');
const bytes = await fs.readFile(pptx);
const zip = await JSZip.loadAsync(bytes);
const files = (await fs.readdir(layoutDir)).filter(n => n.endsWith('.layout.json')).sort();
const pages = [];
for (const name of files) {
  const layout = JSON.parse(await fs.readFile(path.join(layoutDir, name), 'utf8'));
  const text = (layout.elements ?? []).filter(e => e.text);
  const styles = text.flatMap(e => (e.paragraphs ?? []).flatMap(p => (p.runs ?? []).map(r => ({
    objectId:e.id, objectName:e.name, text:r.text, font:r.typeface ?? p.resolvedTextStyle?.typeface,
    px:r.fontSize ?? p.resolvedTextStyle?.fontSize,
    bold:r.bold ?? p.resolvedTextStyle?.bold ?? false,
  }))));
  pages.push({page:layout.slide.slide, texts:text.map(e=>({id:e.id,name:e.name,text:e.text,lineCount:e.textLayout?.lineCount,lines:e.textLayout?.lines,bbox:e.bbox})),styles});
}
const xmlNames = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n));
const xmls = await Promise.all(xmlNames.map(n => zip.file(n).async('string')));
const report={pptx:path.resolve(pptx),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),slideCount:xmls.length,
  counts:{shapes:xmls.reduce((n,s)=>n+(s.match(/<p:sp>/g)??[]).length,0),connectors:xmls.reduce((n,s)=>n+(s.match(/<p:cxnSp>/g)??[]).length,0),pictures:xmls.reduce((n,s)=>n+(s.match(/<p:pic>/g)??[]).length,0)},
  limits:['Actual text runs and line layout inventory; no automatic semantic-role, content-completeness or aesthetic verdict','Object-level default resolvedTextStyle is intentionally not treated as actual run formatting'],pages};
await fs.writeFile(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({sha256:report.sha256,slideCount:report.slideCount,counts:report.counts}));
