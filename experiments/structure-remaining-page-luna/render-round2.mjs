import fs from 'node:fs/promises';
import path from 'node:path';
import {renderCase} from './harness.mjs';
const dir=import.meta.dirname;
const id=process.argv[2];
const read=async p=>JSON.parse(await fs.readFile(path.join(dir,p),'utf8'));
let spec,attempt=2;
if(id==='P1-normal'){
 spec=(await read('revisions/P1-normal/manuscript.json')).spec;
 const prep=await read('revisions/P1-normal/prepare-1.json');
 spec={...spec,caseId:id,title:'交接验收：从文件交付到工作接续',blocks:[
  {role:'module',text:'接手者能独立继续工作，才算交接完成',frame:{left:prep.occupancy.actualBounds.left,top:138,width:650,height:43}},
  {role:'body',text:'发送文件只是交接动作，验收还要核对以下四项。',frame:{left:prep.occupancy.actualBounds.left,top:185,width:650,height:38}}
 ],reason:'新编的常规信息量对照稿：每项增加接手者视角解释。主张和解释与便签实际左缘对齐，语义断行保持词组完整。'};
 attempt=1;
}else{
 spec=(await read(`revisions/${id}/${id}-attempt-1.json`)).spec;
 if(id==='P1'){
  spec.blocks=[
   {role:'module',text:'接手者能独立继续工作',frame:{left:200,top:284,width:350,height:46}},
   {role:'body',text:'交接是否完成，以这一结果为准。\n发送文件只是交接动作。',frame:{left:200,top:342,width:350,height:90}}
  ];
 }
 if(id==='P3'){
  spec.content.levels.forEach((l,i)=>l.body=['故障后临时\n组织抢修','故障原因与\n处理过程可查','按周期检查\n并落实责任','用复盘减少\n重复故障'][i]);
  spec.reason+=' 四级正文只插入语义换行，不删改原文；避免抢修、故障被拆成孤字。';
 }
 if(id==='P2'){
  const tree=await read('revisions/P2/P2-attempt-1.tree.json');
  const prep=await read('revisions/P2/prepare-1.json');
  spec.relationshipLines=prep.textAnchors.map((a,i)=>{
   const node=tree.nodes.find(n=>n.name===`simple-step-body-${i}`);
   const x=spec.frame.left+node.frame.left+node.frame.width+10;
   return {frame:{left:x,top:a.frame.top+a.frame.height/2,width:710-x,height:0},reason:`${a.text} 对应第 ${i+1} 条准入依据`};
  });
  spec.blocks.slice(2).forEach((b,i)=>b.frame.top=prep.textAnchors[i].frame.top+3);
  spec.reason+=' 依据与四层以细线逐一联系，减少跨区域推断。';
 }
}
spec.parentReplay=true;
const result=await renderCase(spec,path.join(dir,'revisions',id),attempt);
console.log(JSON.stringify({status:result.status,error:result.error}));
