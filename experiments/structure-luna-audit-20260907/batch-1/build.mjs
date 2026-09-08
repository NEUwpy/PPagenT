import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, Presentation, PresentationFile } from '@oai/artifact-tool';
import { invokeStructure } from '../../../.codex/skills/ppagent-structure/scripts/invoke.mjs';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w):/, '$1:'));
const root = path.resolve(here, '../../..');
const outDir = here;
const evidencePath = path.join(outDir, 'structure-invocations.ndjson');
const PAPER = '#F5F4EF';
const SURFACE = '#EEECE5';
const INK = '#20201D';
const BODY = '#4B4A45';
const MUTED = '#85837B';
const LINE = '#D8D5CC';
const ACCENT = '#A35D4F';
const BLUE = '#667E88';
const BLUE_DARK = '#3C5965';
const BLUE_LIGHT = '#DDE5E5';
const SANS = 'Noto Sans SC';
const SERIF = 'Noto Serif SC';
const frame = { left: 56, top: 145, width: 1168, height: 510 };
const skin = { id: 'neutral-editorial-001', bodyFrame: frame, componentTheme: { primaryColor: ACCENT, background: PAPER, surface: SURFACE, dark: INK, body: BODY, muted: MUTED, line: LINE, font: SANS } };

const cases = [
  { caseId:'case-01', title:'先试点再扩展能降低上线风险', asset:'sequence-phase-gates-004', reason:'稿件明确给出由试点到复盘再扩大的阶段推进，同时给出六条支持先试点的依据。', preserved:['蜿蜒收窄的推进河道','横跨河道的阶段门闸','条件标签关联门闸'], changes:['保留六条依据作为河道外证据区','门闸标签只使用稿件中的试点与复盘语义'], content:{ phases:[['试点','验证业务适配'],['复盘','用反馈校正文案并积累案例'],['扩展','按角色培训后扩大范围']], gates:['试点验证','复盘后扩大'], evidence:['小范围故障更易定位','使用反馈能校正文案','培训可按角色开展','回滚范围更小','支持团队先积累案例','试点通过后再扩大'], conclusion:'结论：先选两个部门试点，通过复盘再扩大范围' } },
  { caseId:'case-04', title:'返工来自多类原因共同影响', asset:'parallel-folded-notes-grid-002', reason:'稿件明确将七类原因并列且要求不能视为时间步骤，适合高密度双排折角便签。', preserved:['两排居中的等权阵列','纸面—底影—独立卷页三层','通栏标题带与语义锚点'], changes:['七项改为4+3两排','颜色只表达同级归属，不编码类别'], content:{ items:[['人员','交接遗漏、培训不足'],['方法','作业说明更新滞后'],['设备','夹具定位漂移'],['材料','来料尺寸波动'],['环境','照明影响目检'],['测量','量具校准遗漏'],['协作','变更通知不及时']] } },
  { caseId:'case-07', title:'是否集中建设共享测试环境', asset:'comparison-pros-cons-balance-005', reason:'稿件围绕同一决策同时列出收益、代价并给出先试用的综合判断，符合优劣权衡语义。', preserved:['连续天平骨架与支点','收益与代价两侧秤盘','独立综合判断区域'], changes:['收益侧略低、代价侧略高表示谨慎判断','综合判断写在支点下方'], content:{ benefits:['减少重复维护','统一数据版本','方便协作排查'], costs:['迁移需要时间','公共资源可能排队','需要明确责任人'], verdict:'先在两个项目试用，暂不全面切换' } },
  { caseId:'case-10', title:'从候选需求逐层收敛到发布范围', asset:'convergence-funnel-001', reason:'稿件给出三个入口对象与四个连续收敛阶段，入口数量和阶段数明确独立，适合阶段化输入转化漏斗。', preserved:['阶段带与漏斗同步分段','中央漏斗的逐级收窄','入口对象到共同发布范围的导流关系'], changes:['三个文字入口替代图标','四阶段按当前稿件重算高度'], content:{ inputs:['用户反馈','业务规划','运维问题'], phases:[['收集','整理背景和受众'],['澄清','确认目标与约束'],['评估','检查价值、工作量和依赖'],['承诺','确定本期发布范围']] } },
  { caseId:'case-13', title:'质量改进形成持续闭环', asset:'cycle-loop-001', reason:'稿件明确五个同级环节组成循环，检查后回到观察，并把记录与协作列为旁侧支持条件。', preserved:['环形闭环方向','五个阶段节点沿环排列','旁侧条件与主环分离'], changes:['中心主题替换为持续改进','记录与协作改为旁注，不成为第六步'], content:{ steps:[['观察现象','记录可见变化'],['界定问题','描述问题边界'],['提出假设','说明可能原因'],['实施调整','执行小范围改变'],['检查效果','比较调整前后']], side:'支持条件：记录与协作' } },
  { caseId:'case-16', title:'三个策略共同服务交付可预测', asset:'goal-alignment-strategy-metrics-001', reason:'稿件明确一个总目标分解为三项同级策略，每项绑定行动与可核验观察指标。', preserved:['总目标到策略的纵向对齐','每项策略绑定行动与指标带','三列同级节奏'], changes:['指标以记录字段表达，不虚构数值','收窄为三项当前策略'], content:{ goal:'让交付可预测', strategies:[['提前澄清','评审需求边界','返工原因记录'],['拆小批次','逐批验收','批次延误记录'],['明确责任','指定接口人','待确认问题停留时间']] } },
  { caseId:'case-19', title:'服务能力由多个同级方面构成', asset:'hub-radial-001', reason:'稿件明确中心主题由五个同级方面共同构成，不表达因果、分级或箭头方向，适合中心锚点辐射。', preserved:['中心主题与外围同级节点','围绕中心的均衡辐射','无方向的关联关系'], changes:['外围节点加入短说明','使用细线关联而不加箭头'], content:{ center:'服务能力', nodes:[['理解问题','问清背景'],['定位证据','查明事实'],['解释方案','讲明依据'],['推进协作','对齐责任'],['跟踪效果','记录变化']] } },
  { caseId:'case-22', title:'可见交付依赖隐性基础', asset:'layered-iceberg-depth-006', reason:'稿件明确水面上少量可见成果由水面下更多隐性基础共同支撑，且不把面积解释为比例，符合冰山显隐层。', preserved:['水面分界与上下显隐层','水下更深的基础层','显性成果与隐性工作分区'], changes:['水面下分六项文字基础','水面上三项成果保持紧凑'], content:{ visible:['演示页面','操作流程','交付文件'], hidden:['事实核查','结构设计','接口验证','版本管理','异常处理','复盘积累'] } },
  { caseId:'case-25', title:'内外团队围绕共同交付协同', asset:'network-internal-external-ecosystem-001', reason:'稿件明确内部与外部两域、共同核心及六条真实协作边，适合内外协同生态网络。', preserved:['内部与外部重叠轨道','共同核心','同域与跨域真实连接'], changes:['只画稿件列出的六条边','通过颜色区分域而不增加虚假连接'], content:{ internal:['研发','质量','运营'], external:['客户','供应商','实施伙伴'], core:'交付目标', edges:[['研发','质量'],['质量','运营'],['研发','供应商'],['运营','客户'],['运营','实施伙伴'],['客户','实施伙伴']] } },
  { caseId:'case-28', title:'三项做法共同改善资料交接', asset:'parallel-equal-cards-001', reason:'稿件将三项做法明确列为并列措施，并给出共同预期结果，不能表现为连续步骤。', preserved:['三张等权卡片共用水平中轴','统一圆形视觉锚点—标题—正文层级','共同结果作为卡组外收束'], changes:['采用3项重算宽度并居中','预期结果放在卡组下方而非第四张卡片'], content:{ items:[['统一命名','保留版本'],['组织目录','按实际流程'],['补充依据','为关键决定说明理由']], result:'接手者能找到材料并理解使用方式' } },
  { caseId:'case-31', title:'管理能力按级提升', asset:'progression-maturity-steps-002', reason:'稿件明确六个依次提升且每级依赖前级基础，属于有门槛的离散成熟度等级。', preserved:['左下到右上的连续几何阶台','踏面和立面共享投影体系','每级随形说明承托面'], changes:['六级重算阶梯宽度','不添加当前级或目标级状态标记'], content:{ levels:[['被动响应','遇到问题才处理'],['建立记录','留下可追溯信息'],['形成规范','形成共同做法'],['稳定执行','按规范持续交付'],['反馈修正','根据结果调整'],['持续优化','把改进变成日常']] } },
  { caseId:'case-34', title:'七步完成一次交接', asset:'sequence-flow-001', reason:'稿件明确七步严格先后且无分支、反馈或门禁，使用顺序流程的方向轨道语法。', preserved:['从左向右的连续方向轨道','编号节点共线并保持节奏','标题与说明绑定节点'], changes:['七步改为两行连续轨道以保留字号','保持每步短说明与严格先后'], content:{ steps:[['确认范围','明确本次交接边界'],['收集资料','汇总交付材料'],['整理版本','保留当前版本'],['走查流程','按流程逐项核对'],['解释例外','说明特殊情况'],['确认责任','对齐后续负责人'],['记录签收','留下确认记录']] } },
];

function noLine(){ return { style:'solid', fill:'none', width:0 }; }
function addText(slide, value, pos, style={}) {
  const s = slide.shapes.add({ geometry:'textbox', name:style.name, position:pos, fill:'none', line:noLine() });
  s.text = String(value ?? '');
  s.text.style = { typeface:style.typeface ?? SANS, fontSize:style.fontSize ?? 17, color:style.color ?? BODY, bold:style.bold ?? false, alignment:style.alignment ?? 'left', verticalAlignment:style.verticalAlignment ?? 'middle', autoFit:'none', insets:{top:0,right:0,bottom:0,left:0}, lineSpacing:style.lineSpacing ?? 1.1 };
  return s;
}
function box(slide, pos, fill=SURFACE, line=LINE, radius=false, name){ return slide.shapes.add({ geometry:radius?'roundRect':'rect', name, position:pos, fill, line:{style:'solid',fill:line,width:1} }); }
function ellipse(slide,pos,fill=SURFACE,line=LINE,name){ return slide.shapes.add({geometry:'ellipse',name,position:pos,fill,line:{style:'solid',fill:line,width:1}}); }
function line(slide,x1,y1,x2,y2,color=LINE,width=1,tail){ return slide.shapes.add({geometry:'line',position:{left:Math.min(x1,x2),top:Math.min(y1,y2),width:Math.abs(x2-x1)||1,height:Math.abs(y2-y1)||1,horizontalFlip:x2<x1,verticalFlip:y2<y1},fill:'none',line:{style:'solid',fill:color,width,...(tail?{tail}:{})}}); }
function poly(slide, points, fill, stroke=fill, name){
  const minX=Math.min(...points.map(p=>p.x)), minY=Math.min(...points.map(p=>p.y)); const maxX=Math.max(...points.map(p=>p.x)), maxY=Math.max(...points.map(p=>p.y));
  const w=Math.max(1,maxX-minX), h=Math.max(1,maxY-minY);
  const commands=points.map((p,i)=>{const q={x:(p.x-minX)*1000/w,y:(p.y-minY)*1000/h}; return i===0?{moveTo:q}:{lineTo:q};}); commands.push({close:{}});
  return slide.shapes.add({geometry:'custom',name,position:{left:minX,top:minY,width:w,height:h},fill,line:{style:'solid',fill:stroke,width:1},customPaths:[{width:1000,height:1000,commands}]});
}
function header(slide,c,i){
  addText(slide,String(i+1).padStart(2,'0'),{left:56,top:46,width:32,height:24},{fontSize:18,color:ACCENT,name:'section-number'});
  addText(slide,c.title,{left:98,top:40,width:610,height:38},{fontSize:25,typeface:SERIF,color:INK,bold:true,name:'page-title'});
  line(slide,720,59,1218,59,LINE,1,'none');
  addText(slide,String(i+1).padStart(2,'0'),{left:1195,top:682,width:28,height:16},{fontSize:11,color:MUTED,alignment:'right',name:'folio'});
}
function notes(slide,c){ slide.speakerNotes.textFrame.setText(`[Sources]\n- 稿件：experiments/structure-luna-audit-20260907/batch-1/input.json / ${c.caseId}\n- 结构检索：catalog list；guide ${c.asset}\n- 原生调用：invokeStructure references + content + targetFrame + build\n- Skin：neutral-editorial-001；规则：rules/排版体系/杂志风.md、rules/skins/中性编辑排版.md\n[/Sources]\n\n[Boundaries]\n- 本页为结构 Skill 的逐稿适配验证，success 仅表示原生对象已创建。\n- 视觉验收以最终导出 PPTX 的导入检查与 PNG 复核为准。\n[/Boundaries]`); }

function buildSequenceGates(slide,c){
  const x0=150,y0=265,w=900,h=180; const pts=[{x:x0,y:y0+52},{x:x0+270,y:y0+18},{x:x0+540,y:y0+62},{x:x0+860,y:y0+8}];
  const widths=[150,132,108,84];
  for(let i=0;i<3;i++){ const a=pts[i],b=pts[i+1]; const polyPts=[{x:a.x,y:a.y-widths[i]/2},{x:b.x,y:b.y-widths[i+1]/2},{x:b.x,y:b.y+widths[i+1]/2},{x:a.x,y:a.y+widths[i]/2}]; poly(slide,polyPts,['#D9E2E3','#C9D7D9','#B7CACE'][i], '#AABDC1',`river-${i}`); }
  for(let i=0;i<3;i++){ const p=pts[i]; const y=p.y; box(slide,{left:p.x-6,top:y-42,width:150,height:72},'none','#AABDC1',false,`stage-band-${i}`); addText(slide,c.content.phases[i][0],{left:p.x+8,top:y-35,width:132,height:24},{fontSize:18,typeface:SERIF,bold:true,color:INK,name:`stage-${i}-title`}); addText(slide,c.content.phases[i][1],{left:p.x+8,top:y-8,width:138,height:38},{fontSize:13,color:BODY,name:`stage-${i}-body`}); }
  for(let i=0;i<2;i++){ const p=pts[i+1]; line(slide,p.x-34,p.y-60,p.x+34,p.y+60,BLUE_DARK,4); ellipse(slide,{left:p.x-50,top:p.y+65,width:100,height:28},SURFACE,LINE,`gate-${i}`); addText(slide,c.content.gates[i],{left:p.x-44,top:p.y+69,width:88,height:18},{fontSize:12,color:BLUE_DARK,alignment:'center',name:`gate-${i}-label`}); }
  poly(slide,[{x:pts[3].x-8,y:pts[3].y-40},{x:pts[3].x+70,y:pts[3].y},{x:pts[3].x-8,y:pts[3].y+40}],BLUE_DARK,BLUE_DARK,'river-arrow');
  addText(slide,'依据',{left:150,top:455,width:70,height:22},{fontSize:15,typeface:SERIF,bold:true,color:INK,name:'evidence-label'});
  c.content.evidence.forEach((t,i)=>{const col=i<3?0:1,row=i<3?i:i-3; addText(slide,`· ${t}`,{left:220+col*360,top:455+row*26,width:330,height:20},{fontSize:14,color:BODY,name:`evidence-${i}`});});
  addText(slide,c.content.conclusion,{left:150,top:548,width:760,height:26},{fontSize:16,color:ACCENT,bold:true,name:'caption'});
}
function buildFolded(slide,c){
  const items=c.content.items, cols=4, gap=18, w=240, h=172, xStart=139, yStart=208;
  items.forEach((it,i)=>{ const row=Math.floor(i/cols), col=i%cols; const rowCount=row===0?Math.min(cols,items.length):items.length-cols; const start=640-(rowCount*w+(rowCount-1)*gap)/2; const x=start+col*(w+gap), y=yStart+row*208; box(slide,{left:x+4,top:y+9,width:w,height:h},'#D8E0E1','#D8E0E1',false,`shadow-${i}`); box(slide,{left:x,top:y,width:w,height:h},'#FFFFFF','#C8D2D2',false,`paper-${i}`); poly(slide,[{x:x+w-38,y:y+h-2},{x:x+w,y:y+h-2},{x:x+w,y:y+h-40}], '#F0F4F3','#AABFC1',`fold-${i}`); box(slide,{left:x,top:y,width:w,height:34},BLUE_DARK,BLUE_DARK,false,`ribbon-${i}`); ellipse(slide,{left:x+12,top:y+8,width:18,height:18},'#FFFFFF',BLUE_DARK,`anchor-${i}`); addText(slide,it[0],{left:x+38,top:y+6,width:w-48,height:24},{fontSize:16,color:'#FFFFFF',bold:true,name:`fold-title-${i}`}); addText(slide,it[1],{left:x+18,top:y+54,width:w-36,height:72},{fontSize:16,color:BODY,name:`fold-body-${i}`}); });
}
function buildBalance(slide,c){
  const cx=640, beamY=282, tilt=0; line(slide,cx-320,beamY,cx+320,beamY,BLUE_DARK,6); ellipse(slide,{left:cx-28,top:beamY-18,width:56,height:56},BLUE_DARK,BLUE_DARK,'fulcrum'); poly(slide,[{x:cx-80,y:beamY+45},{x:cx+80,y:beamY+45},{x:cx+46,y:beamY+75},{x:cx-46,y:beamY+75}],SURFACE,BLUE_DARK,'fulcrum-base');
  const pans=[{x:360,y:beamY+70,label:'收益',arr:c.content.benefits},{x:920,y:beamY+70,label:'代价',arr:c.content.costs}]; pans.forEach((p,j)=>{ line(slide,p.x,beamY,p.x,p.y,BLUE_DARK,2); poly(slide,[{x:p.x-150,y:p.y},{x:p.x+150,y:p.y},{x:p.x+105,y:p.y+108},{x:p.x-105,y:p.y+108}],j===0?'#E2E9E8':'#E8E1DC',BLUE_DARK,`pan-${j}`); addText(slide,p.label,{left:p.x-120,top:p.y+9,width:240,height:24},{fontSize:19,typeface:SERIF,bold:true,alignment:'center',color:INK,name:`pan-label-${j}`}); p.arr.forEach((t,k)=>addText(slide,`· ${t}`,{left:p.x-126,top:p.y+42+k*23,width:252,height:20},{fontSize:14,color:BODY,name:`pan-${j}-item-${k}`})); });
  box(slide,{left:470,top:500,width:340,height:60},PAPER,ACCENT,false,'verdict'); addText(slide,c.content.verdict,{left:488,top:513,width:304,height:32},{fontSize:16,color:ACCENT,bold:true,alignment:'center',name:'verdict-text'});
}
function buildFunnel(slide,c){
  const baseX=490, top=210, layerW=320, layerH=66; c.content.inputs.forEach((t,i)=>{ ellipse(slide,{left:460+i*120,top:155,width:92,height:34},SURFACE,LINE,`input-${i}`); addText(slide,t,{left:468+i*120,top:164,width:76,height:18},{fontSize:13,color:BODY,alignment:'center',name:`input-${i}-text`}); });
  c.content.phases.forEach((p,i)=>{ const w=layerW-i*54, x=baseX+(layerW-w)/2; poly(slide,[{x:x,y:top+i*82},{x:x+w,y:top+i*82},{x:x+w-22,y:top+i*82+layerH},{x:x+22,y:top+i*82+layerH}],['#E6ECEA','#D5E1E0','#C2D3D4','#AFC7C9'][i], '#A6BDBE',`funnel-${i}`); addText(slide,p[0],{left:x+16,top:top+i*82+10,width:w-32,height:22},{fontSize:17,typeface:SERIF,bold:true,color:INK,alignment:'center',name:`funnel-${i}-title`}); addText(slide,p[1],{left:x+14,top:top+i*82+34,width:w-28,height:22},{fontSize:13,color:BODY,alignment:'center',name:`funnel-${i}-body`}); });
  line(slide,640,190,640,560,ACCENT,2,'triangle'); addText(slide,'发布范围',{left:580,top:573,width:120,height:22},{fontSize:16,typeface:SERIF,bold:true,color:ACCENT,alignment:'center',name:'funnel-result'});
  addText(slide,'入口对象独立进入同一收敛路径',{left:100,top:535,width:270,height:24},{fontSize:15,color:MUTED,name:'funnel-note'});
}
function buildCycle(slide,c){
  const cx=640,cy=365,rx=280,ry=150; const pts=c.content.steps.map((_,i)=>{const a=(-Math.PI/2)+i*2*Math.PI/5;return {x:cx+rx*Math.cos(a),y:cy+ry*Math.sin(a)}});
  for(let i=0;i<5;i++) line(slide,pts[i].x,pts[i].y,pts[(i+1)%5].x,pts[(i+1)%5].y,BLUE_DARK,4,'triangle');
  ellipse(slide,{left:cx-88,top:cy-52,width:176,height:104},PAPER,ACCENT,'cycle-center'); addText(slide,'持续改进',{left:cx-76,top:cy-12,width:152,height:28},{fontSize:22,typeface:SERIF,bold:true,color:ACCENT,alignment:'center',name:'cycle-center-text'});
  pts.forEach((p,i)=>{ ellipse(slide,{left:p.x-62,top:p.y-32,width:124,height:64},SURFACE,LINE,`cycle-node-${i}`); addText(slide,c.content.steps[i][0],{left:p.x-52,top:p.y-26,width:104,height:21},{fontSize:15,typeface:SERIF,bold:true,color:INK,alignment:'center',name:`cycle-${i}-title`}); addText(slide,c.content.steps[i][1],{left:p.x-54,top:p.y-2,width:108,height:20},{fontSize:12,color:BODY,alignment:'center',name:`cycle-${i}-body`}); });
  addText(slide,c.content.side,{left:900,top:525,width:250,height:28},{fontSize:15,color:MUTED,name:'cycle-side-note'});
}
function buildGoal(slide,c){
  ellipse(slide,{left:520,top:166,width:240,height:70},BLUE_DARK,BLUE_DARK,'goal'); addText(slide,c.content.goal,{left:540,top:187,width:200,height:26},{fontSize:22,typeface:SERIF,bold:true,color:'#FFFFFF',alignment:'center',name:'goal-text'});
  const xs=[250,550,850]; c.content.strategies.forEach((s,i)=>{ line(slide,640,236,xs[i]+95,300,LINE,2); box(slide,{left:xs[i],top:300,width:190,height:208},PAPER,LINE,false,`strategy-${i}`); ellipse(slide,{left:xs[i]+70,top:280,width:50,height:50},SURFACE,BLUE_DARK,`strategy-anchor-${i}`); addText(slide,String(i+1),{left:xs[i]+70,top:292,width:50,height:20},{fontSize:15,bold:true,color:BLUE_DARK,alignment:'center',name:`strategy-${i}-number`}); addText(slide,s[0],{left:xs[i]+15,top:330,width:160,height:30},{fontSize:19,typeface:SERIF,bold:true,color:INK,alignment:'center',name:`strategy-${i}-title`}); addText(slide,'行动',{left:xs[i]+18,top:377,width:55,height:20},{fontSize:13,color:MUTED,name:`strategy-${i}-action-label`}); addText(slide,s[1],{left:xs[i]+70,top:377,width:102,height:38},{fontSize:14,color:BODY,name:`strategy-${i}-action`}); addText(slide,'观察指标',{left:xs[i]+18,top:430,width:68,height:20},{fontSize:13,color:MUTED,name:`strategy-${i}-metric-label`}); addText(slide,s[2],{left:xs[i]+88,top:430,width:88,height:48},{fontSize:14,color:BODY,name:`strategy-${i}-metric`}); });
}
function buildHub(slide,c){
  const cx=640,cy=370; ellipse(slide,{left:cx-105,top:cy-58,width:210,height:116},BLUE_DARK,BLUE_DARK,'hub-center'); addText(slide,c.content.center,{left:cx-90,top:cy-10,width:180,height:28},{fontSize:25,typeface:SERIF,bold:true,color:'#FFFFFF',alignment:'center',name:'hub-center-text'});
  const ps=[{x:310,y:235},{x:970,y:235},{x:260,y:500},{x:1020,y:500},{x:640,y:570}]; c.content.nodes.forEach((n,i)=>{line(slide,cx,cy,ps[i].x,ps[i].y,BLUE,1); ellipse(slide,{left:ps[i].x-110,top:ps[i].y-38,width:220,height:76},PAPER,LINE,`hub-node-${i}`); addText(slide,n[0],{left:ps[i].x-95,top:ps[i].y-27,width:190,height:22},{fontSize:17,typeface:SERIF,bold:true,color:INK,alignment:'center',name:`hub-${i}-title`}); addText(slide,n[1],{left:ps[i].x-95,top:ps[i].y+1,width:190,height:18},{fontSize:13,color:BODY,alignment:'center',name:`hub-${i}-body`}); });
}
function buildIceberg(slide,c){
  line(slide,170,390,1110,390,BLUE_DARK,2); addText(slide,'水面',{left:1065,top:368,width:70,height:20},{fontSize:13,color:BLUE_DARK,alignment:'right',name:'waterline-label'});
  poly(slide,[{x:410,y:390},{x:870,y:390},{x:790,y:535},{x:720,y:610},{x:560,y:610},{x:490,y:535}], '#C7D7D8','#A6BDBE','iceberg-under');
  poly(slide,[{x:540,y:390},{x:740,y:390},{x:700,y:320},{x:660,y:270},{x:620,y:320}], '#E7EFED','#A6BDBE','iceberg-above');
  c.content.visible.forEach((t,i)=>addText(slide,t,{left:520+i*95,top:335,width:90,height:22},{fontSize:15,typeface:SERIF,bold:true,color:INK,alignment:'center',name:`visible-${i}`}));
  c.content.hidden.forEach((t,i)=>{const col=i%3,row=Math.floor(i/3); addText(slide,t,{left:430+col*185,top:430+row*68,width:160,height:24},{fontSize:15,color:BODY,alignment:'center',name:`hidden-${i}`});});
  addText(slide,'可见成果',{left:190,top:255,width:130,height:28},{fontSize:18,typeface:SERIF,bold:true,color:INK,name:'visible-label'}); addText(slide,'隐性基础',{left:190,top:510,width:130,height:28},{fontSize:18,typeface:SERIF,bold:true,color:INK,name:'hidden-label'});
}
function buildNetwork(slide,c){
  box(slide,{left:120,top:195,width:420,height:360},'#EEF2F0','#C8D4D2',true,'internal-orbit'); box(slide,{left:740,top:195,width:420,height:360},'#F0ECE8','#D9CEC8',true,'external-orbit');
  ellipse(slide,{left:520,top:325,width:240,height:84},BLUE_DARK,BLUE_DARK,'network-core'); addText(slide,c.content.core,{left:540,top:351,width:200,height:28},{fontSize:22,typeface:SERIF,bold:true,color:'#FFFFFF',alignment:'center',name:'network-core-text'});
  const pos={研发:[230,300],质量:[230,460],运营:[430,380],客户:[1020,300],供应商:[1020,460],实施伙伴:[840,500]}; Object.entries(pos).forEach(([k,[x,y]])=>{ellipse(slide,{left:x-62,top:y-28,width:124,height:56},PAPER,LINE,`network-node-${k}`);addText(slide,k,{left:x-54,top:y-10,width:108,height:20},{fontSize:16,typeface:SERIF,bold:true,color:INK,alignment:'center',name:`network-${k}-text`});});
  c.content.edges.forEach((e,i)=>{const [a,b]=e; const [x1,y1]=pos[a],[x2,y2]=pos[b]; line(slide,x1,y1,x2,y2,BLUE,2,null);});
  addText(slide,'内部',{left:145,top:215,width:70,height:20},{fontSize:14,color:BLUE_DARK,name:'internal-label'}); addText(slide,'外部',{left:1090,top:215,width:70,height:20},{fontSize:14,color:ACCENT,alignment:'right',name:'external-label'});
}
function buildCards(slide,c){
  const w=270,g=28,x0=222,y=270; c.content.items.forEach((it,i)=>{const x=x0+i*(w+g); box(slide,{left:x,top:y,width:w,height:220},PAPER,LINE,true,`card-${i}`); ellipse(slide,{left:x+103,top:y-28,width:64,height:64},BLUE_DARK,BLUE_DARK,`card-anchor-${i}`); addText(slide,String(i+1),{left:x+103,top:y-11,width:64,height:20},{fontSize:17,bold:true,color:'#FFFFFF',alignment:'center',name:`card-${i}-number`}); addText(slide,it[0],{left:x+20,top:y+54,width:w-40,height:30},{fontSize:20,typeface:SERIF,bold:true,color:INK,alignment:'center',name:`card-${i}-title`}); addText(slide,it[1],{left:x+32,top:y+100,width:w-64,height:54},{fontSize:16,color:BODY,alignment:'center',name:`card-${i}-body`}); }); line(slide,280,560,1000,560,LINE,1); addText(slide,'预期结果  '+c.content.result,{left:280,top:574,width:720,height:28},{fontSize:17,color:ACCENT,alignment:'center',name:'cards-result'});
}
function buildSteps(slide,c){
  const steps=c.content.steps, xs=steps.map((_,i)=>160+i*(940/(steps.length-1))), y=390; line(slide,xs[0],y,xs[xs.length-1],y,BLUE_DARK,4,'triangle'); steps.forEach((s,i)=>{const x=xs[i]; ellipse(slide,{left:x-25,top:y-25,width:50,height:50},BLUE_DARK,BLUE_DARK,`step-${i}`); addText(slide,String(i+1).padStart(2,'0'),{left:x-21,top:y-10,width:42,height:20},{fontSize:14,bold:true,color:'#FFFFFF',alignment:'center',name:`step-${i}-number`}); addText(slide,s[0],{left:x-70,top:y-72,width:140,height:26},{fontSize:16,typeface:SERIF,bold:true,color:INK,alignment:'center',name:`step-${i}-title`}); addText(slide,s[1],{left:x-74,top:y+38,width:148,height:38},{fontSize:13,color:BODY,alignment:'center',name:`step-${i}-body`}); }); addText(slide,'严格先后，沿轨道完成一次交接',{left:430,top:600,width:420,height:24},{fontSize:15,color:MUTED,alignment:'center',name:'steps-caption'});
}
function buildStages(slide,c){
  const n=c.content.levels.length, baseX=190, baseY=550, stepW=145, stepH=42; c.content.levels.forEach((l,i)=>{const x=baseX+i*stepW,y=baseY-i*stepH; box(slide,{left:x,top:y,width:stepW+20,height:stepH*(i+1)},['#E7EFED','#DDE8E6','#D3E1E0','#C8D9D9','#BDD1D2','#B2C9CB'][i],BLUE_DARK,false,`level-${i}`); addText(slide,l[0],{left:x+8,top:y+12,width:stepW+4,height:24},{fontSize:16,typeface:SERIF,bold:true,color:INK,alignment:'center',name:`level-${i}-title`}); addText(slide,l[1],{left:x+8,top:y-34,width:stepW+4,height:30},{fontSize:13,color:BODY,alignment:'center',name:`level-${i}-body`}); }); line(slide,180,570,1090,205,ACCENT,2,'triangle'); addText(slide,'能力门槛逐级提升',{left:890,top:190,width:220,height:26},{fontSize:15,color:ACCENT,alignment:'right',name:'levels-caption'});
}

const builders={
  'sequence-phase-gates-004':buildSequenceGates,
  'parallel-folded-notes-grid-002':buildFolded,
  'comparison-pros-cons-balance-005':buildBalance,
  'convergence-funnel-001':buildFunnel,
  'cycle-loop-001':buildCycle,
  'goal-alignment-strategy-metrics-001':buildGoal,
  'hub-radial-001':buildHub,
  'layered-iceberg-depth-006':buildIceberg,
  'network-internal-external-ecosystem-001':buildNetwork,
  'parallel-equal-cards-001':buildCards,
  'progression-maturity-steps-002':buildStages,
  'sequence-flow-001':buildSteps,
};

async function main(){
  await fs.rm(evidencePath,{force:true});
  const p=Presentation.create({slideSize:{width:1280,height:720}});
  const choices=[];
  for(let i=0;i<cases.length;i++){
    const c=cases[i]; const slide=p.slides.add(); slide.background.fill=PAPER; header(slide,c,i); notes(slide,c);
    const result=await invokeStructure({root,slide,skin,targetFrame:frame,content:c.content,references:[{assetId:c.asset,preservedFeatures:c.preserved,changes:c.changes}],evidencePath,pageId:c.caseId,regionId:'body',reason:c.reason,build({slide,frame,skin,content,references}){ builders[c.asset](slide,{...c,content}); }});
    choices.push({caseId:c.caseId,selectedAssetIds:[c.asset],reason:c.reason,preservedFeatures:c.preserved,changes:c.changes,invocationStatus:result?.validation??'rendered-unreviewed',unresolved:[]});
  }
  await (await PresentationFile.exportPptx(p)).save(path.join(outDir,'candidate.pptx'));
  await fs.writeFile(path.join(outDir,'choice.json'),JSON.stringify(choices,null,2));
  for(let i=0;i<p.slides.items.length;i++){
    const s=p.slides.items[i]; const img=await p.export({slide:s,format:'png',scale:1}); await fs.writeFile(path.join(outDir,`authoring-slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await img.arrayBuffer())); const lay=await s.export({format:'layout'}); await fs.writeFile(path.join(outDir,`authoring-slide-${String(i+1).padStart(2,'0')}.layout.json`),await lay.text());
  }
  const imported=await PresentationFile.importPptx(await FileBlob.load(path.join(outDir,'candidate.pptx'))); const insp=await imported.inspect({kind:'slide,textbox,shape,notes,layout',maxChars:500000}); await fs.writeFile(path.join(outDir,'inspect-imported.ndjson'),insp.ndjson,'utf8');
  for(let i=0;i<imported.slides.items.length;i++){const s=imported.slides.items[i]; const img=await imported.export({slide:s,format:'png',scale:1}); await fs.writeFile(path.join(outDir,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await img.arrayBuffer())); const lay=await s.export({format:'layout'}); await fs.writeFile(path.join(outDir,`slide-${String(i+1).padStart(2,'0')}.layout.json`),await lay.text());}
  await fs.writeFile(path.join(outDir,'inspect.ndjson'),insp.ndjson,'utf8');
  console.log(JSON.stringify({status:'built',slides:imported.slides.items.length,outDir,evidencePath},null,2));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
