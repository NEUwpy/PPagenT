import fs from 'node:fs/promises';
import path from 'node:path';
import {renderCase} from './harness.mjs';
const dir=import.meta.dirname;
const id=process.argv[2];
const prep=JSON.parse(await fs.readFile(path.join(dir,`revisions/${id}/prepare-1.json`),'utf8'));
const original=JSON.parse(await fs.readFile(path.join(dir,`luna/${id}/${id}-attempt-1.json`),'utf8')).spec;
const layouts={
 P1:{title:'交接验收的四项条件',blocks:[
  {role:'module',text:'接手者能够\n独立继续工作',frame:{left:200,top:252,width:330,height:88}},
  {role:'body',text:'这是交接完成的验收标准。\n发送文件只是交接动作。',frame:{left:200,top:353,width:330,height:85}}
 ],reason:'同一份短稿：左侧表达验收主张，右侧四项并列条件支撑主张。说明并回主张，不在底部另挂孤句；模块首行与可见便签标题共享水平起点。'},
 P2:{title:'反馈筛选：按准入依据逐层收敛',blocks:[
  {role:'body',text:'反馈来源：访谈、工单、使用记录',frame:{left:274,top:154,width:500,height:46}},
  {role:'module',text:'每一层的准入依据',frame:{left:724,top:244,width:350,height:42}},
  ...['保留原始反馈','问题可重复观察','小样验证有效','责任人与交付范围明确'].map((text,i)=>({role:'body',text,frame:{left:724,top:prep.textAnchors[i].frame.top+10,width:350,height:44}}))
 ],reason:'反馈来源紧邻漏斗入口，四条依据按照实际四层标签的垂直中心逐项对齐，形成图左文右的四行阅读关系。'},
 P3:{title:'设备维护：从形成记录走向计划维护',blocks:[
  {role:'module',text:'下一步：按周期检查，落实责任',frame:{left:160,top:208,width:510,height:45}},
  {role:'body',text:'在故障原因与处理过程可查的基础上，\n将维护工作推进到计划维护。',frame:{left:160,top:268,width:420,height:85}}
 ],reason:'行动主张与解释组成一个阅读单元，放在阶梯斜线左上方自由区域；四级全貌和当前、目标状态保留，不再右置重复状态清单。'}
};
const spec={...original,...layouts[id],frame:prep.frame,parentReplay:true};
const result=await renderCase(spec,path.join(dir,'revisions',id),1);
console.log(JSON.stringify({status:result.status,error:result.error}));
