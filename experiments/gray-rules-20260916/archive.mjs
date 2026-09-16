import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
const root=process.cwd(),folder=path.resolve(import.meta.dirname),zip=new JSZip(),entries=[];
const roots=['outputs/gray-diverse-20260916','outputs/gray-rules-discovery-20260916','outputs/gray-rules-refine-20260916','outputs/gray-rules-holdout-20260916','outputs/gray-rules-controls-20260916','outputs/gray-rules-controls-v2-20260916','outputs/gray-rules-layout-controls-20260916','outputs/gray-rules-layout-replay-20260916','outputs/gray-rules-report-20260916','experiments/gray-diverse-20260916','experiments/gray-rules-20260916'];
const sha=b=>createHash('sha256').update(b).digest('hex');
async function walk(relative){for(const ent of await fs.readdir(path.join(root,relative),{withFileTypes:true})){if(ent.isSymbolicLink())throw new Error('Unexpected link');const rel=relative+'/'+ent.name;if(ent.isDirectory())await walk(rel);else if(ent.isFile()&&!['evidence.zip','archive-manifest.json'].includes(ent.name)){const data=await fs.readFile(path.join(root,rel));zip.file(rel,data);entries.push({path:rel,bytes:data.length,sha256:sha(data)});}}}
for(const r of roots)await walk(r);
const data=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}),file=path.join(folder,'evidence.zip');await fs.writeFile(file,data);
const back=await JSZip.loadAsync(data);for(const e of entries)if(sha(await back.file(e.path).async('nodebuffer'))!==e.sha256)throw new Error('Archive mismatch: '+e.path);
await fs.writeFile(path.join(folder,'archive-manifest.json'),JSON.stringify({archive:'evidence.zip',bytes:data.length,sha256:sha(data),entries},null,2));console.log(JSON.stringify({files:entries.length,bytes:data.length,verified:true}));
