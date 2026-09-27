import fs from 'node:fs/promises';
import path from 'node:path';
import {renderMckinsey} from './render-mckinsey.mjs';

const base=import.meta.dirname;
const out=path.join(base,'theme-blue-01');
await fs.mkdir(out,{recursive:true});
const source=JSON.parse(await fs.readFile(path.join(base,'../home-gray-magazine-20260919/input/gray-state.json'),'utf8'));
const blueprint=JSON.parse(await fs.readFile(path.join(base,'run-02/candidate-1/blueprint.json'),'utf8'));
const candidate=await renderMckinsey(source.grayDraft.semanticPlan,blueprint,out);
await fs.copyFile(candidate.pptx,path.join(out,'gray-to-mckinsey-blue.pptx'));
const previous=JSON.parse(await fs.readFile(path.join(base,'run-02/candidate-1/build-check.json'),'utf8'));
const current=JSON.parse(await fs.readFile(path.join(out,'build-check.json'),'utf8'));
const primaryColor=current.primaryColor;
for(const key of ['coverage','textBoxes','geometry']) {
  if(JSON.stringify(previous[key])!==JSON.stringify(current[key])) throw new Error(`Color trial unexpectedly changed ${key}`);
}
await fs.writeFile(path.join(out,'color-trial.json'),JSON.stringify({previousPrimaryColor:'#315F91',primaryColor,reason:'Match the left-middle blue of the inherited university banner',sampledBanner:{left:'#2F5598',atX300:'#3361AE',middle:'#3871CA'},sameContentAndGeometry:true,newModelCalls:0,universityDefaultChanged:true,templateArtworkParametric:false,humanReview:'pending',candidate},null,2));
console.log(JSON.stringify(candidate));
