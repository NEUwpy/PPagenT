import fs from 'node:fs/promises';
import path from 'node:path';
const dir=import.meta.dirname;
const block=(role,text,left,top,width,height)=>({role,text,frame:{left,top,width,height}});
const source=[{key:'interview',label:'访谈',iconQuery:'message-circle'},{key:'ticket',label:'工单',iconQuery:'ticket'},{key:'record',label:'使用记录',iconQuery:'clipboard-text'}];
const plans=[
 {id:'funnel-wide',title:'反馈筛选：每一层都有准入依据',assetId:'convergence-simple-funnel-001',
  content:{inputs:source,steps:['收集线索','核对问题','验证方案','纳入发布'].map((title,i)=>({key:'s'+i,title}))},
  frame:{left:56,top:190,width:560,height:450},layout:{axis:280,topWidth:300,centers:[145,223,301,379]},
  blocks:[block('body','反馈来源：访谈、工单、使用记录',120,138,580,44),block('module','准入依据',692,236,420,40),...['保留原始反馈','问题可重复观察','小样验证有效','责任人与交付范围明确'].map((s,i)=>block('body',s,692,322+i*78,490,46))],
  reason:'布局先确定入口说明、左侧四层收敛、右侧四行依据。层级位置由页面行节奏决定，结构保持共同轴和渐窄轮廓。'},
 {id:'funnel-compact',title:'需求收敛：先验证，再承诺交付',assetId:'convergence-simple-funnel-001',
  content:{inputs:source,steps:['收集反馈','确认问题','验证价值','核对投入','明确交付'].map((title,i)=>({key:'s'+i,title}))},
  frame:{left:370,top:190,width:500,height:470},layout:{axis:250,topWidth:260,centers:[125,188,251,314,377]},
  blocks:[block('module','交付承诺应建立在\n验证与投入确认之后',56,212,300,90),block('body','来自访谈、工单和使用记录的反馈，\n先说明问题，再逐层核对。',56,320,310,110),block('module','进入下一层的条件',908,210,300,42),...['原始反馈可追溯','问题能够复现','试验支持预期价值','人员与时间可落实','责任人与范围明确'].map((s,i)=>block('body',s,908,312+i*63,300,43))],
  reason:'新编五层稿：页面左侧讲判断原则，中间用窄区域表达收敛，右侧逐行列准入条件。层数增多时仍使用既定行距与文字档位。'},
 {id:'ladder-wide',title:'设备维护：从形成记录走向计划维护',assetId:'progression-maturity-steps-002',
  content:{levels:[['被动处理','故障后临时\n组织抢修'],['形成记录','故障原因与\n处理过程可查'],['计划维护','按周期检查\n并落实责任'],['持续改善','用复盘减少\n重复故障']].map(([title,body],i)=>({key:'level-'+(i+1),title,body})),showStatus:true,currentIndex:1},
  frame:{left:56,top:180,width:1168,height:460},layout:{centers:[{x:195,y:390},{x:445,y:335},{x:695,y:280},{x:945,y:225}],copyWidth:180},
  blocks:[block('module','下一步：按周期检查，落实责任',56,183,540,46),block('body','在故障原因与处理过程可查的基础上，\n将维护工作推进到计划维护。',56,247,500,85)],
  reason:'先确定上升阅读路线与左上行动主张。阶梯将同一组等级锚点连成有共同透视的形状，文本与状态不随图形拉伸。'},
 {id:'ladder-compact',title:'交付能力：从个人经验走向团队复用',assetId:'progression-maturity-steps-002',
  content:{levels:[['个人完成','依靠个人经验\n完成交付'],['过程可查','记录关键步骤\n与交付依据'],['团队复用','共享方法与案例\n支持团队协作']].map(([title,body],i)=>({key:'level-'+(i+1),title,body})),showStatus:true,currentIndex:0},
  frame:{left:390,top:280,width:800,height:350},layout:{centers:[{x:190,y:290},{x:420,y:245},{x:650,y:200}],copyWidth:184},
  blocks:[block('module','先把个人经验\n变成可查的过程',56,196,325,90),block('body','记录关键步骤与交付依据，\n让团队能够理解并复用。',56,305,295,95)],
  reason:'新编三等级稿：左侧展开行动解释，右下安排三等级递进。结构服从右下区域与等级位置，保留可见的上升关系和透视。'}
];
for(const p of plans.filter(p=>p.id.startsWith('funnel')))p.blocks.slice(-p.content.steps.length).forEach((b,i)=>b.frame.top=p.frame.top+p.layout.centers[i]-21);
await fs.writeFile(path.join(dir,'layout-plan.json'),JSON.stringify({origin:'Parent-planned tests; not an independent Luna run',order:['页面语义分工','等级/阶段锚点','同位置简洁版','结构承接锚点','整页复核'],plans},null,2));
console.log('Four semantic page plans saved before rendering');
