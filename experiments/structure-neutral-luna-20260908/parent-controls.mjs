import fs from 'node:fs/promises';
import path from 'node:path';
import { renderCase } from './harness.mjs';
const out=path.join(import.meta.dirname,'parent');
async function read(group,key){return JSON.parse(await fs.readFile(path.join(import.meta.dirname,group,`${key}.json`),'utf8')).spec;}
const results=[];
for(const id of ['a4','c3','c4']){
 const spec=await read(id[0],`${id}-attempt-1`);
 spec.parentReplay=true;spec.auditNote='Parent exact-content control; only region and outside blocks changed';
 spec.frame={left:56,top:175,width:1168,height:480};
 spec.blocks=[{role:'body',text:id==='a4'?'发布前逐项确认，确保交付具备可执行条件。':'当前处于统一分类阶段，目标是根据使用反馈持续优化。',frame:{left:56,top:135,width:1168,height:30}}];
 results.push(await renderCase(spec,out,1));
}
const funnel=await read('b','b3-attempt-1');
funnel.parentReplay=true;funnel.auditNote='Parent corrected selection: screening is convergence, not maturity';
funnel.assetId='convergence-simple-funnel-001';
const levels=funnel.content.levels;
funnel.content={inputs:[{label:'访谈',iconQuery:'users'},{label:'记录',iconQuery:'file'},{label:'工单',iconQuery:'ticket'},{label:'复盘',iconQuery:'refresh'}],steps:levels.map(({key,title})=>({key,title}))};
funnel.frame={left:670,top:160,width:520,height:492};
funnel.blocks=[{role:'body',text:'入口：用户访谈、现场记录、客服工单、内部复盘。',frame:{left:56,top:150,width:560,height:52}},...levels.map((l,i)=>({role:'body',text:`${l.title}：${l.body}`,frame:{left:56,top:230+i*60,width:560,height:48}}))];
funnel.reason='六层筛选逐步收敛；保留全部原说明在左列，右侧漏斗保留六层短标题';
results.push(await renderCase(funnel,out,1));
await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(results.map(({key,status,error,auditNote})=>({key,status,error,auditNote})),null,2));
