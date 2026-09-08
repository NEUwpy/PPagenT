import fs from 'node:fs/promises';
import path from 'node:path';
import {preparePage} from './prepare.mjs';
const dir=import.meta.dirname;
const frames={P1:{left:470,top:170,width:710,height:430},P2:{left:180,top:205,width:510,height:420},P3:{left:100,top:190,width:1080,height:450}};
for(const id of Object.keys(frames)){
 const original=JSON.parse(await fs.readFile(path.join(dir,`luna/${id}/${id}-attempt-1.json`),'utf8')).spec;
 const input={assetId:original.assetId,content:original.content,frame:frames[id]};
 const prepared=await preparePage(input,path.join(dir,`revisions/${id}/prepare-1.json`));
 console.log(id,JSON.stringify({input,bounds:prepared.occupancy.actualBounds,areas:prepared.occupancy.areas.filter(a=>a.kind==='protected-group'),textAnchors:prepared.textAnchors,bands:prepared.remainingPage.bands.filter(b=>b.height>=12)},null,2));
}
