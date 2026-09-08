import fs from 'node:fs/promises';
import path from 'node:path';
import {renderCase} from './harness.mjs';
const dir=import.meta.dirname;
const {plans}=JSON.parse(await fs.readFile(path.join(dir,'layout-plan.json'),'utf8'));
for(const plan of plans)for(const appearance of ['plain','folded']){
 await renderCase({...plan,caseId:`${plan.id}-${appearance}`,assetId:'parallel-folded-notes-grid-002',appearance,chapter:'01',pageNumber:1,parentReplay:true,reason:plan.intention+' 两版共用布局和文字，只更换普通色块与便签表面。'},path.join(dir,'renders'),Number(process.argv[2]??1));
}
