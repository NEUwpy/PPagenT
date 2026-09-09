import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PresentationFile } from '@oai/artifact-tool';
import { createNortheasternUniversityStarter } from '../../src/runtime/skins/northeastern-university.mjs';
import { universityMckinseySkin } from '../../src/runtime/skins/university-mckinsey.mjs';
import { resolveStructureTheme } from '../../src/visual-runtime/html-component-theme.mjs';

const RUN = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(RUN, '../..');
const OUT = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : path.join(RUN, 'first');
const DRAFT = path.join(OUT, 'candidate.pptx');
const FINAL = path.join(OUT, 'deck.pptx');
const THEME = resolveStructureTheme(universityMckinseySkin);
const F = universityMckinseySkin.fonts;
const C = { blue: THEME.primaryColor, dark: THEME.primaryDark, pale: THEME.primaryPale, wash: THEME.primaryWash, ink: THEME.dark, body: THEME.body, muted: THEME.muted, line: THEME.line, white: '#FFFFFF' };

function text(slide, value, position, style = {}) {
  const s = slide.shapes.add({ geometry: 'textbox', name: style.name, position, fill: 'none', line: { style: 'solid', fill: 'none', width: 0 } });
  s.text = value;
  s.text.style = { typeface: style.typeface ?? F.body, fontSize: style.fontSize ?? 18, color: style.color ?? C.body, bold: style.bold ?? false, alignment: style.align ?? 'left', verticalAlignment: style.valign ?? 'top', autoFit: 'none', lineSpacing: style.lineSpacing ?? 1.1 };
  return s;
}
function rect(slide, position, fill = C.white, line = C.line, width = 0) { return slide.shapes.add({ geometry: 'rect', position, fill, line: { style: 'solid', fill: line, width } }); }
function line(slide, x1, y1, x2, y2, color = C.line, width = 1) { return slide.shapes.add({ geometry: 'line', position: { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }, fill: 'none', line: { style: 'solid', fill: color, width } }); }
function arrow(slide, geometry, position, color = C.dark) { return slide.shapes.add({ geometry, position, fill: color, line: { style: 'solid', fill: color, width: 0 } }); }
function meta(slide, value, x = 55, y = 194, w = 900) { text(slide, value, { left: x, top: y, width: w, height: 28 }, { fontSize: 14, color: C.muted }); }
function tag(slide, value, x = 1080, fill = C.pale, color = C.dark) { const s = rect(slide, { left: x, top: 174, width: 145, height: 28 }, fill, 'none', 0); s.text = value; s.text.style = { typeface: F.body, fontSize: 14, color, bold: true, alignment: 'center', verticalAlignment: 'middle', autoFit: 'none' }; return s; }
function notes(slide, p, extra) { slide.speakerNotes.textFrame.setText(`[Sources]\n- 内容：experiments/neu-mckinsey-fixed-rules-20260909/inputs/manuscript.txt\n- 规则：docs/工作流/正式生成/生成任务提示词.md；rules/页面组合.md；rules/排版体系/麦肯锡式.md；rules/skins/东北大学.md\n- Skin：northeastern-university-001，绑定 mckinsey\n[/Sources]\n${extra}`); slide.speakerNotes.setVisible(true); }

function page1(slide) {
  meta(slide, '口径：每月当月收到的请求，观察结案后是否在两个工作日内首次给出可执行答复。'); tag(slide, '模拟数据');
  rect(slide, { left: 55, top: 246, width: 790, height: 348 }, C.wash, C.line, 1);
  text(slide, '月度工作量与及时首次响应', { left: 82, top: 267, width: 420, height: 30 }, { fontSize: 21, bold: true, color: C.ink });
  text(slide, '收到请求数', { left: 145, top: 307, width: 220, height: 24 }, { fontSize: 18, bold: true, color: C.muted, align: 'center' });
  text(slide, '及时答复数', { left: 405, top: 307, width: 130, height: 24 }, { fontSize: 18, bold: true, color: C.muted, align: 'center' });
  text(slide, '及时比例', { left: 555, top: 307, width: 165, height: 24 }, { fontSize: 18, bold: true, color: C.muted, align: 'center' });
  const rows = [['1月',120,96,'80%'],['2月',150,114,'76%'],['3月',180,126,'70%'],['4月',240,144,'60%']];
  rows.forEach(([m,total,timely,pct], i) => { const y = 350 + i * 52; text(slide,m,{left:82,top:y+6,width:58,height:24},{fontSize:18,bold:i===3,color:C.ink}); rect(slide,{left:145,top:y+7,width:total*0.9,height:20},i===3?C.dark:C.blue,'none',0); text(slide,String(total),{left:372,top:y+3,width:54,height:26},{fontSize:18,bold:true,color:C.ink}); text(slide,String(timely),{left:445,top:y+3,width:60,height:26},{fontSize:18,bold:true,color:i===3?C.dark:C.body,align:'center'}); rect(slide,{left:555,top:y+7,width:Number.parseInt(pct,10)*1.7,height:20},i===3?C.dark:C.blue,'none',0); text(slide,pct,{left:740,top:y+3,width:60,height:26},{fontSize:18,bold:true,color:i===3?C.dark:C.ink,align:'right'}); if(i<3) line(slide,82,y+38,820,y+38,C.line,1); });
  rect(slide, { left: 875, top: 246, width: 350, height: 348 }, C.white, C.line, 1);
  text(slide, '中位首次响应时间', { left: 902, top: 268, width: 280, height: 28 }, { fontSize: 21, bold: true, color: C.dark });
  [['1月','1.3'],['2月','1.5'],['3月','1.8'],['4月','2.4']].forEach(([m,v],i)=>{const y=322+i*38;text(slide,m,{left:902,top:y,width:65,height:26},{fontSize:18,bold:i===3,color:C.ink});text(slide,`${v} 工作日`,{left:990,top:y,width:150,height:26},{fontSize:18,bold:i===3,color:i===3?C.dark:C.body});if(i<3)line(slide,902,y+30,1196,y+30,C.line,1);});
  line(slide,902,470,1198,470,C.line,1);
  text(slide, '人员数不变，工作量与响应压力\n同时上升；无对照实验\n无法断言工作量增长\n是响应变慢的唯一原因', { left: 902, top: 480, width: 300, height: 90 }, { fontSize: 18, color: C.body });
  meta(slide, '注：该指标不是结案时长；每月无缺失记录。', 55, 620, 600);
  notes(slide,1,'图内保留原始月度计数：1月120/96，2月150/114，3月180/126，4月240/144。');
}

function page2(slide) {
  meta(slide, '对象：4月未达到两个工作日响应标准的96个请求；每个请求只记一个主要阻塞原因。'); tag(slide, '模拟数据');
  rect(slide, { left: 55, top: 246, width: 1170, height: 190 }, C.wash, C.line, 1);
  text(slide, '主要阻塞原因构成（96个未达标请求）', { left: 82, top: 268, width: 650, height: 30 }, { fontSize: 21, bold: true, color: C.ink });
  text(slide, '材料与权限合计 72 个，占 75%', { left: 880, top: 270, width: 320, height: 28 }, { fontSize: 18, bold: true, color: C.dark, align: 'right' });
  const causes = [['材料不全',42],['权限确认',30],['需求反复',16],['其他',8]]; let x=82; const colors=[C.dark,C.blue,C.pale,'#BFCBD7'];
  causes.forEach(([label,n],i)=>{const w=n*10.2; rect(slide,{left:x,top:338,width:w,height:54},colors[i], 'none',0); x+=w;});
  [['材料不全 42（44%）',82,C.dark],['权限确认 30（31%）',350,C.blue],['需求反复 16（17%）',620,C.pale],['其他 8（8%）',890,'#BFCBD7']].forEach(([label,left,fill],i)=>{rect(slide,{left,top:402,width:16,height:16},fill,'none',0);text(slide,label,{left:left+24,top:398,width:240,height:26},{fontSize:18,bold:i<2,color:i<2?C.dark:C.body});});
  rect(slide,{left:55,top:460,width:560,height:126},C.white,C.line,1); text(slide,'总体背景', {left:82,top:480,width:180,height:28},{fontSize:21,bold:true,color:C.dark}); text(slide,'4月共收到240个请求：\n数据提取120，数据清洗72，权限开通48。', {left:82,top:520,width:470,height:52},{fontSize:18,color:C.body});
  rect(slide,{left:650,top:460,width:575,height:126},C.white,C.line,1); text(slide,'这组数据支持的判断', {left:678,top:480,width:280,height:28},{fontSize:21,bold:true,color:C.dark}); text(slide,'材料与权限是主要阻塞环节，统一入口与其有直接对应关系。分类不等于措施可消除的数量，也不能据此预测节省工时。', {left:678,top:520,width:510,height:52},{fontSize:18,color:C.body});
  meta(slide, '定义：材料不全含字段缺失或未附样本；权限确认含授权人不明确或授权范围未确认。', 55, 620, 980);
  notes(slide,2,'图内保留互斥完整分类：材料不全42、权限确认30、需求反复16、其他8；4月请求构成为120/72/48。');
}

function page3(slide) {
  meta(slide, '投入与周期为内部方案估计；B尚未实施，人日表示实施工作量，不能换算响应改善。'); tag(slide, '模拟估计');
  const cols=[{x:230,w:320,title:'A 临时增加值班',fill:C.wash},{x:550,w:320,title:'B 统一申请入口',fill:C.pale},{x:870,w:355,title:'C 批量自动预检',fill:C.wash}];
  text(slide,'比较项',{left:55,top:258,width:150,height:28},{fontSize:21,bold:true,color:C.dark}); cols.forEach(c=>{rect(slide,{left:c.x,top:246,width:c.w,height:48},c.fill,C.line,1);text(slide,c.title,{left:c.x+10,top:257,width:c.w-20,height:28},{fontSize:21,bold:true,color:C.dark,align:'center'});});
  const rows=[['直接作用环节','人工响应排队','提交时字段与授权校验','重复性材料格式检查'],['初期投入','8人日','12人日','30人日'],['预计上线周期','1周','2周','6周'],['持续维护','每周2人日值班','每周0.5人日规则维护','每周1人日规则维护'],['当前依赖','可调配值班人员','三类请求字段达成一致','稳定字段及可机器判断的规则'],['主要限制','不直接解决材料缺失','不消除复杂需求沟通','不替代人工授权判断']];
  rows.forEach((r,i)=>{const y=294+i*47;rect(slide,{left:55,top:y,width:1170,height:47},i%2?C.white:C.wash,C.line,1);text(slide,r[0],{left:67,top:y+10,width:150,height:28},{fontSize:18,bold:true,color:C.body});text(slide,r[1],{left:242,top:y+9,width:285,height:28},{fontSize:18,color:C.body});text(slide,r[2],{left:562,top:y+9,width:285,height:28},{fontSize:18,bold:i===0,color:C.dark});text(slide,r[3],{left:882,top:y+9,width:330,height:28},{fontSize:18,color:C.body});});
  rect(slide,{left:55,top:590,width:1170,height:40},C.pale,C.line,1); text(slide,'决策依据：B覆盖材料与权限校验；A保留为短期高峰应急，C待入口规则稳定后再评估。',{left:72,top:598,width:1120,height:26},{fontSize:18,color:C.dark});
  notes(slide,3,'B尚未实施；三种方案的投入、周期和维护均为内部估计。');
}

function page4(slide) {
  meta(slide, '六周试点按先统一字段、再单类试用、后负责人复核推进；每阶段都有进入条件。'); tag(slide, '模拟计划');
  const phases=[{x:55,w:355,week:'第1—2周',title:'统一字段与授权责任',body:'负责人联合三类请求经办人，形成字段字典、授权清单和统一入口。',gate:'进入条件：三类请求完成一轮实际样本检查；关键必填字段无缺失',fill:C.wash},{x:435,w:355,week:'第3—4周',title:'只在数据提取请求试用',body:'保存缺失字段、退回原因和首次响应记录，不同时覆盖其他两类。',gate:'扩大条件：记录完整，且无阻断提交的高频规则错误；否则回到字段和规则修订',fill:C.wash},{x:815,w:410,week:'第5—6周',title:'负责人复核后决定扩围',body:'复核试点数据，再决定是否扩大到数据清洗和权限开通。',gate:'评估指标：两个工作日内响应比例、材料退回比例、经办人维护时间；目标值根据试点基线确定',fill:C.wash}];
  phases.forEach((p,i)=>{rect(slide,{left:p.x,top:252,width:p.w,height:278},p.fill,C.line,1);text(slide,p.week,{left:p.x+22,top:272,width:p.w-44,height:28},{fontSize:21,bold:true,color:C.dark});text(slide,p.title,{left:p.x+22,top:316,width:p.w-44,height:32},{fontSize:21,bold:true,color:C.ink});text(slide,p.body,{left:p.x+22,top:362,width:p.w-44,height:52},{fontSize:18,color:C.body});line(slide,p.x+22,430,p.x+p.w-22,430,C.line,1);text(slide,p.gate,{left:p.x+22,top:446,width:p.w-44,height:72},{fontSize:18,color:C.body}); if(i<2){line(slide,p.x+p.w,392,p.x+p.w+25,392,C.dark,2);arrow(slide,'rightArrow',{left:p.x+p.w+8,top:386,width:12,height:12});}});
  text(slide,'高频规则错误时回到字段和规则修订',{left:430,top:550,width:330,height:26},{fontSize:18,bold:true,color:C.dark,align:'center'}); line(slide,612,530,612,542,C.dark,2); line(slide,612,542,790,542,C.dark,2); line(slide,790,542,790,600,C.dark,2); line(slide,790,600,230,600,C.dark,2); line(slide,230,600,230,530,C.dark,2); arrow(slide,'leftArrow',{left:224,top:524,width:12,height:12});
  meta(slide, '边界：B尚未实施，不能宣称已有改善，也不能承诺消除所有材料与权限阻塞。', 55, 620, 1100);
  notes(slide,4,'阶段推进和回退条件均来自原稿；目标值需根据试点基线确定。');
}

async function main() {
  const pages=[
    {intent:{intentId:'composition-p1'},decision:{selectedAssetId:'northeastern-university-body-001'},meta:{sectionName:'历史观察'},content:{pageId:'P1',title:'工作量翻倍，及时首次响应比例降至60%'},payload:{assetId:'northeastern-university-body-001',parameters:{}}},
    {intent:{intentId:'composition-p2'},decision:{selectedAssetId:'northeastern-university-body-001'},meta:{sectionName:'原因复核'},content:{pageId:'P2',title:'4月超时请求中，材料与权限阻塞占75%'},payload:{assetId:'northeastern-university-body-001',parameters:{}}},
    {intent:{intentId:'composition-p3'},decision:{selectedAssetId:'northeastern-university-body-001'},meta:{sectionName:'方案比较'},content:{pageId:'P3',title:'应对措施先选B，因其直接作用于主要阻塞环节'},payload:{assetId:'northeastern-university-body-001',parameters:{}}},
    {intent:{intentId:'composition-p4'},decision:{selectedAssetId:'northeastern-university-body-001'},meta:{sectionName:'有限试点'},content:{pageId:'P4',title:'先用6周验证统一入口，再决定是否扩大范围'},payload:{assetId:'northeastern-university-body-001',parameters:{}}}
  ];
  const starter=await createNortheasternUniversityStarter({pages,starterPptx:path.join(OUT,'.runtime','template-starter.pptx'),manuscriptSource:'experiments/neu-mckinsey-fixed-rules-20260909/inputs/manuscript.txt'});
  [page1,page2,page3,page4].forEach((fn,i)=>fn(starter.slides[i]));
  await fs.mkdir(OUT,{recursive:true}); await (await PresentationFile.exportPptx(starter.presentation)).save(DRAFT);
  const inspect=await starter.presentation.inspect({kind:'slide,textbox,shape,notes',maxChars:100000}); await fs.writeFile(path.join(OUT,'inspect.ndjson'),inspect.ndjson,'utf8');
  const skillDir='C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
  const { finalizePresentation }=await import(pathToFileURL(path.join(skillDir,'container_tools/artifact_tool_utils.mjs')).href);
  const staging=path.join(RUN,'.codex-finalizer'); await fs.mkdir(staging,{recursive:true}); await fs.rm(FINAL,{force:true}); await fs.rm(path.join(staging,`${path.basename(OUT)}-deck.pptx-validation.json`),{force:true});
  await finalizePresentation({explicitTotalSlideCount:4,sourceTemplatePath:path.join(ROOT,'assets/主题/东北大学-001/runtime-template.pptx'),requiredTemplateReferenceSlides:[1,2,3,4],minimumTemplateCoverageRatio:1,workspaceDir:RUN,candidatePath:DRAFT,finalPath:FINAL,pythonExecutable:'C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',integrityValidatorPath:path.join(skillDir,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skillDir,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],fontPolicy:{basis:'design',families:['HYWenRunSongYun U','Microsoft YaHei','汉仪粗宋简']},verifyArtifactToolImport:true,receiptPath:path.join(staging,'final-deck-v3.validation.json')});
  console.log(FINAL);
}
main().catch(err=>{console.error(err);process.exitCode=1;});
