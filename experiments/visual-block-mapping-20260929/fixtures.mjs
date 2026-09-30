// Synthetic construction samples. These are fixed plans, not model predictions.
const group=(id,heading,blocks)=>({id,heading,kind:'text',role:'主体',importance:'primary',blocks});
const block=(id,label,text,sourceId,extra={})=>({id,label,text,sourceIds:[sourceId],...extra});
export const plan={schemaVersion:'gray-plan-3',deckBrief:{title:'组内视觉分区建设样本',audience:'开发与评审',objective:'核对内容绑定、组内分区和共同说明'},pages:[
 {pageId:'services',title:'模拟服务安排',claim:'模拟：工作日按需提供服务',pagePurpose:'说明两项独立服务及共同适用时间',narrative:'咨询和资料借阅为独立服务；预约条件仅限定咨询，工作日限定二者',
  groups:[group('service','服务项目',[
   block('advice','咨询','工作人员回答资料检索与使用方面的问题。','s1'),
   block('appointment','','咨询需要提前预约。','s2',{kind:'note'}),
   block('borrow','资料借阅','登记资料名称和使用人后办理借阅，归还时核对登记记录。','s3'),
   block('hours','','两项服务均在工作日提供。','s4',{scope:'group'}),
  ])],
  visualMapping:{groups:[{groupId:'service',direction:'horizontal',relation:'independent'}],blocks:[
   {id:'advice-area',groupId:'service',blockIds:['advice','appointment']},
   {id:'borrow-area',groupId:'service',blockIds:['borrow']},
   {id:'hours-band',groupId:'service',blockIds:['hours'],role:'shared',scopeGroupIds:['service']},
  ]}},
 {pageId:'records',title:'模拟记录要求',claim:'模拟：两类记录分别维护',pagePurpose:'明确两类记录的用途及共同条件',narrative:'版本记录和问题记录独立，不构成办理顺序；共用访问约束',
  groups:[group('record','记录管理',[
   block('scope','','两类记录均供项目成员查阅，外发前需负责人确认。','s5',{scope:'group'}),
   block('version','版本记录','记录文档版本、修改内容和修改人，保留此前版本供追溯。','s6'),
   block('issue','问题记录','记录问题现象、处理意见和处理状态。尚未核实的问题应标为待核实。','s7'),
  ])],
  visualMapping:{groups:[{groupId:'record',direction:'vertical',relation:'independent'}],blocks:[
   {id:'scope-band',groupId:'record',blockIds:['scope'],role:'shared',scopeGroupIds:['record']},
   {id:'version-area',groupId:'record',blockIds:['version']},
   {id:'issue-area',groupId:'record',blockIds:['issue']},
  ]}},
]};
export const source=plan.pages.map(p=>`# ${p.title}\n\n${p.groups.flatMap(g=>g.blocks).map(b=>[b.label,b.text].filter(Boolean).join('：')).join('\n\n')}`).join('\n\n');
