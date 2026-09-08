import fs from 'node:fs/promises';
import path from 'node:path';
import {preparePage} from './prepare.mjs';
const dir=import.meta.dirname;
// Short manuscript stays unchanged; only semantic line breaks are inserted.
const p3=JSON.parse(await fs.readFile(path.join(dir,'revisions/P3/P3-attempt-1.json'),'utf8')).spec;
p3.content.levels.forEach((l,i)=>l.body=['故障后临时\n组织抢修','故障原因与\n处理过程可查','按周期检查\n并落实责任','用复盘减少\n重复故障'][i]);
const p3prep=await preparePage(p3,path.join(dir,'revisions/P3/prepare-2.json'));
console.log('P3',JSON.stringify(p3prep.textAnchors.filter(a=>a.name.includes('body'))));
const p1=JSON.parse(await fs.readFile(path.join(dir,'luna/P1/P1-attempt-1.json'),'utf8')).spec;
p1.content.items.forEach((item,i)=>item.body=[
 '关键文件集中归档，\n接手者能找到继续工作\n所需的资料。',
 '当前版本标记明确，\n接手者能辨认应使用\n哪一份文件。',
 '后续负责人可查，\n接手者能确认工作\n由谁继续负责。',
 '特殊处理附上依据，\n接手者能理解例外情况\n及其处理理由。'
][i]);
p1.frame={left:56,top:215,width:1168,height:430};
const rich=await preparePage(p1,path.join(dir,'revisions/P1-normal/prepare-1.json'));
await fs.writeFile(path.join(dir,'revisions/P1-normal/manuscript.json'),JSON.stringify({origin:'本轮新编的常规信息量测试稿；增加接手者视角的解释，不作为原短稿等量修订。',spec:p1},null,2));
console.log('P1-normal',JSON.stringify({frame:rich.frame,bounds:rich.occupancy.actualBounds,textAnchors:rich.textAnchors}));
