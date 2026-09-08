import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadStructureSkill } from '../../src/runtime/structure-skills.mjs';
import { preservedComponent } from '../../src/runtime/preserved-structure-build.mjs';
import { resolveHtmlComponent,closeHtmlComponentRuntime } from '../../src/visual-runtime/html-component-runtime.mjs';
import { occupancyFromTree,maturityGroups } from '../structure-occupancy-pilot/occupancy.mjs';
import { skin } from './harness.mjs';
import { scanRemainingPage } from './scan.mjs';
export async function preparePage({assetId,content,frame},file){
 try{
  const ref=await loadStructureSkill(assetId);
  const {visualComponent}=await import(pathToFileURL(path.join(ref.assetDir,ref.guide.exampleImplementation)).href);
  const tree=await resolveHtmlComponent({component:preservedComponent(visualComponent,frame,skin),parameters:content,assetDir:ref.assetDir,theme:skin,targetFrame:frame});
  const occupancy=occupancyFromTree(tree,frame,{groups:maturityGroups(tree)});
  const result={assetId,frame,occupancy,remainingPage:scanRemainingPage(occupancy,skin.bodyFrame),textAnchors:tree.nodes.filter(n=>n.kind==='text'||n.kind==='shape-text').map(n=>({name:n.name,text:n.text,frame:{...n.frame,left:n.frame.left+frame.left,top:n.frame.top+frame.top}}))};
  await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(result,null,2));return result;
 }finally{await closeHtmlComponentRuntime();}
}
