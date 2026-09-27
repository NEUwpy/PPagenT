import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { listStructureSkills, loadStructureSkill } from '../../src/runtime/structure-skills.mjs';
import { loadPreservedComponent, resolveStructureSizeFrame } from '../../src/runtime/preserved-structure-build.mjs';
import { resolveHtmlComponent, closeHtmlComponentRuntime } from '../../src/visual-runtime/html-component-runtime.mjs';
import { structureSizeFrames } from '../../src/visual-runtime/preserved-size-component.mjs';
import { northeasternUniversityTheme as theme } from '../../src/runtime/skins/northeastern-university-theme.mjs';
import { neutralEditorialTheme } from '../../src/runtime/skins/neutral-editorial-theme.mjs';

const out=process.argv.includes('--neutral')?path.join(import.meta.dirname,'neutral'):import.meta.dirname;
await fs.mkdir(out,{recursive:true});
const reports=[];
const only=process.argv[2];
const compact=process.argv.includes('--compact');
const golden=process.argv.includes('--golden');
const selectedTheme=process.argv.includes('--neutral')?neutralEditorialTheme:theme;
function compactFixture(value,key='') {
 if(Array.isArray(value)) return value.map(v=>compactFixture(v,key));
 if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,compactFixture(v,k)]));
 if(typeof value==='string' && [...value].length>3) {
  if(['body','description','explanation','support','detail','trigger','outcome','verdict','assumption','benefit','risk','conclusion','feedback'].includes(key)) return '依据明确';
  if(['title','label','name','text','factors','points','items','metric','metrics'].includes(key)) return key==='body'?'说明':'要点';
 }
 return value;
}
try {
 for (const descriptor of await listStructureSkills()) {
  if(only && !only.startsWith('--') && !only.split(',').some(id=>descriptor.assetId.includes(id))) continue;
  const ref=await loadStructureSkill(descriptor.assetId);
  const source=await import(pathToFileURL(path.join(ref.assetDir,'review.mjs')));
  const selection={...ref.asset.runtime.review?.goldenState?.selection};
  for(const control of ref.asset.runtime.review?.controls ?? []) {
   if(golden) selection[control.key]=control.default ?? control.values[0];
   if(!golden && control.values?.every(v=>typeof v==='number')) selection[control.key]=Math.min(...control.values);
  }
  const preview=source.resolvePreviewParameters ? source.resolvePreviewParameters(structuredClone(source.previewParameters),selection) : structuredClone(source.previewParameters);
  const content=compact ? compactFixture(preview) : preview;
  for(const [size,dimensions] of Object.entries(structureSizeFrames)) {
   const frame=await resolveStructureSizeFrame(ref,size,content,selectedTheme);
   const row={assetId:ref.assetId,size,frame,selection,fixture:compact?'synthetic-compact':'source-preview'};
   try {
    const component=await loadPreservedComponent(ref,frame,selectedTheme,content);
    const screenshotPath=path.join(out,`${ref.assetId}-${size}.png`);
    const tree=await resolveHtmlComponent({component,parameters:content,assetDir:ref.assetDir,targetFrame:frame,theme:selectedTheme,screenshotPath});
    await fs.writeFile(path.join(out,`${ref.assetId}-${size}.tree.json`),JSON.stringify(tree));
    row.status='passed';row.nodes=tree.nodes.length;
    row.fontMin=Math.min(...tree.nodes.filter(n=>n.style?.fontSize).map(n=>n.style.fontSize*.75));
   } catch(error) {row.status='failed';row.error=error.message;}
   reports.push(row);
   console.log(row.assetId,size,row.status,row.error?.slice(0,160)??'');
   await fs.writeFile(path.join(out,only && !only.startsWith('--')?'filtered-report.json':golden?'golden-report.json':compact?'compact-report.json':'report.json'),JSON.stringify(reports,null,2));
  }
 }
} finally {await closeHtmlComponentRuntime();}
await fs.writeFile(path.join(out,'index.html'),`<!doctype html><meta charset="utf-8"><style>body{font:16px system-ui;background:#eee}article{display:inline-block;background:white;margin:10px;padding:12px;vertical-align:top}img{max-width:100%}</style><h1>结构大中小检查</h1><p>${compact?'紧凑合成内容':golden?'看板默认完整样例':'较少节点的完整样例'}；原生排版边界与字体检查，用户视觉验收仍待确认。</p>${reports.map(r=>`<article><p>${r.assetId} · ${r.size} · ${r.status} · ${Math.round(r.frame.width)}×${Math.round(r.frame.height)}</p><img src="${r.assetId}-${r.size}.png"></article>`).join('')}`);
