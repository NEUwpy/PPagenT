import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const workspaceDir = 'C:/PPagenT/harness/runs/20260910-magazine-regression/H-equivalent-loading/control';
const buildDir = path.join(workspaceDir, '.build');
const firstRenderDir = path.join(workspaceDir, 'renders-first');
const finalRenderDir = path.join(workspaceDir, 'renders-final');
const firstPptx = path.join(workspaceDir, 'first.pptx');
const finalOutputDir = path.join(workspaceDir, 'deliverables');
const finalPptx = path.join(finalOutputDir, 'final.pptx');
const rootFinalPptx = path.join(workspaceDir, 'final.pptx');
const SKILL_DIR = 'C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
const RUNTIME_NODE = 'C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe';
const RUNTIME_PYTHON = 'C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(firstRenderDir, { recursive: true });
await fs.mkdir(finalRenderDir, { recursive: true });
await fs.mkdir(finalOutputDir, { recursive: true });

const { finalizePresentation, resolvePresentationFont } = await import(pathToFileURL(path.join(SKILL_DIR, 'container_tools/artifact_tool_utils.mjs')).href);
process.env.RUNTIME_NODE_MODULES = 'C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
process.env.RUNTIME_NODE = RUNTIME_NODE;
const available = resolvePresentationFont({ availableFonts: ['Noto Serif SC', 'Noto Sans SC'] });
console.log('resolved font:', available);

const W = 1280, H = 720;
const C = {
  paper: '#F5F4EF', surface: '#EEECE5', ink: '#20201D', body: '#4B4A45', muted: '#85837B',
  rule: '#D8D5CC', brick: '#A35D4F', paleBrick: '#F0DFD9', white: '#FBFAF7', soft: '#E6E3DA'
};
const serif = 'Noto Serif SC';
const sans = 'Noto Sans SC';

const pres = Presentation.create({ slideSize: { width: W, height: H } });

function shape(slide, geometry, x, y, w, h, fill='none', lineFill='none', lineWidth=0, name='') {
  return slide.shapes.add({ geometry, name, position: { left:x, top:y, width:w, height:h }, fill, line: { style:'solid', fill:lineFill, width:lineWidth } });
}
function txt(slide, text, x, y, w, h, opts={}) {
  const s = shape(slide, 'textbox', x,y,w,h, 'none', 'none', 0, opts.name || 'text');
  s.text = text;
  s.text.style = {
    typeface: opts.typeface || sans,
    fontSize: opts.fontSize ?? 17,
    bold: opts.bold ?? false,
    color: opts.color || C.body,
    alignment: opts.align || 'left',
    verticalAlignment: opts.valign || 'top',
    lineSpacing: opts.lineSpacing ?? 1.25,
    autoFit: opts.autoFit || 'none',
    wrap: opts.wrap || 'square',
    insets: opts.insets || { top:0, right:0, bottom:0, left:0 },
  };
  return s;
}
function line(slide, x1,y1,x2,y2, color=C.rule, width=1) {
  const left = Math.min(x1,x2), top = Math.min(y1,y2);
  return shape(slide, 'line', left,top,Math.max(1,Math.abs(x2-x1)),Math.max(1,Math.abs(y2-y1)), 'none', color, width, 'rule');
}
function circle(slide, x,y,d, fill='none', stroke=C.rule, sw=1) { return shape(slide, 'ellipse', x,y,d,d,fill,stroke,sw,'circle'); }
function footer(slide, n) {
  txt(slide, String(n).padStart(2,'0'), 1160, 677, 64, 20, { typeface:sans, fontSize:13, color:C.muted, align:'right' });
}
function header(slide, chapter, title, n) {
  txt(slide, chapter, 56, 42, 36, 30, { typeface:serif, fontSize:25, bold:true, color:C.brick });
  txt(slide, title, 96, 42, 560, 32, { typeface:serif, fontSize:25, bold:true, color:C.ink, wrap:'none' });
  line(slide, 670, 58, 1224, 58, C.rule, 1);
  footer(slide,n);
}
function note(slide, text) { slide.speakerNotes.textFrame.setText(text); }
function addQuote(slide, quote, x, y, w, h, size=26) {
  txt(slide, '“', x, y-8, 34, 50, { typeface:serif, fontSize:42, color:C.brick, bold:true });
  txt(slide, quote, x+30, y, w-30, h, { typeface:serif, fontSize:size, color:C.ink, lineSpacing:1.2 });
}
function sectionTag(slide, text, x, y, color=C.brick) { txt(slide,text,x,y,220,24,{typeface:sans,fontSize:14,bold:true,color,wrap:'none'}); }

// 1 cover
{
  const s = pres.slides.add(); s.background.fill = C.paper;
  line(s, 56, 88, 1224, 88, C.rule, 1);
  txt(s, 'PPagenT', 56, 44, 180, 26, { typeface:sans, fontSize:15, bold:true, color:C.brick, wrap:'none' });
  txt(s, '把 PPT 生成\n变成可靠的\n生产过程', 56, 150, 650, 220, { typeface:serif, fontSize:58, bold:true, color:C.ink, lineSpacing:1.04 });
  line(s, 60, 408, 190, 408, C.brick, 3);
  txt(s, '产品叙事', 60, 430, 260, 32, { typeface:sans, fontSize:22, color:C.brick, bold:true, wrap:'none' });
  txt(s, '让 AI 读稿，让规则做判断，让代码完成重复劳动。', 60, 480, 600, 36, { typeface:sans, fontSize:18, color:C.body, lineSpacing:1.25 });
  // restrained typographic motif
  circle(s, 910, 160, 190, C.surface, C.rule, 1);
  circle(s, 955, 205, 100, C.paper, C.brick, 2);
  txt(s, 'Q', 980, 224, 50, 54, { typeface:serif, fontSize:48, bold:true, color:C.brick, align:'center' });
  line(s, 905, 390, 1115, 390, C.rule, 1);
  txt(s, '从偶然生成\n到稳定交付', 910, 408, 300, 90, { typeface:serif, fontSize:25, color:C.ink, lineSpacing:1.18 });
  note(s, '封面根据输入稿件制作，未添加外部事实。');
}

// 2 contents
{
  const s = pres.slides.add(); s.background.fill=C.paper; header(s,'00','目录',2);
  const rows = [
    ['01','为什么值得做','从昂贵判断到可靠度目标'],
    ['02','怎样把自由变成可靠','限制、控制器与能力调用'],
    ['03','能力如何形成复用','把计算前移，把经验留下'],
    ['04','从一个学校走向更多组织','主题可替换，能力可复用'],
  ];
  let y=170;
  rows.forEach((r,i)=>{ txt(s,r[0],78,y,50,28,{typeface:serif,fontSize:22,bold:true,color:C.brick}); txt(s,r[1],154,y-2,360,32,{typeface:serif,fontSize:22,bold:true,color:C.ink}); txt(s,r[2],650,y+3,430,25,{typeface:sans,fontSize:16,color:C.muted}); line(s,78,y+47,1160,y+47,C.rule,1); y+=100; });
  txt(s,'阅读路径',78,590,100,20,{typeface:sans,fontSize:14,bold:true,color:C.brick}); txt(s,'成本 → 目标 → 约束 → 架构 → 复用 → 规模',190,588,700,24,{typeface:serif,fontSize:18,color:C.body});
  note(s, '目录依据稿件章节归属建立，章节编号沿用到正文页。');
}

// 3 cost of PPT
{
  const s = pres.slides.add(); s.background.fill=C.paper; header(s,'01','做 PPT，真正昂贵的不是“画”',3);
  txt(s,'真正费时间的，是一连串判断。',78,128,650,42,{typeface:serif,fontSize:30,bold:true,color:C.ink});
  const items=[['讲什么','汇报到底怎么讲'],['怎么拆','长稿拆成多少页'],['怎么连','并列、递进、因果还是流程'],['怎么呈现','哪里突出，什么时候用图']];
  let x=78;
  items.forEach((it,i)=>{ circle(s,x,238,48,i===1?C.paleBrick:C.paper,C.brick,1.5); txt(s,String.fromCharCode(65+i),x,248,48,24,{typeface:serif,fontSize:20,bold:true,color:C.brick,align:'center'}); txt(s,it[0],x,310,180,30,{typeface:serif,fontSize:21,bold:true,color:C.ink}); txt(s,it[1],x,350,205,52,{typeface:sans,fontSize:17,color:C.body,lineSpacing:1.25}); if(i<3) line(s,x+220,262,x+270,262,C.rule,1); x+=280; });
  line(s,78,482,1160,482,C.rule,1);
  txt(s,'高手脑子里已经积累了大量答案。',78,515,600,40,{typeface:serif,fontSize:26,color:C.ink});
  addQuote(s,'既然一个高手已经知道怎样做是好的，为什么每次还要重新做一遍？',78,580,1040,58,23);
  note(s, '本页将稿件中“昂贵的判断”拆成四类，保留其论证顺序。');
}

// 4 target demand distribution
{
  const s = pres.slides.add(); s.background.fill=C.paper; header(s,'01','PPagenT 选择的是概率最大的需求',4);
  txt(s,'更多需求位于中间：工作型 PPT。',78,124,700,38,{typeface:serif,fontSize:29,bold:true,color:C.ink});
  // spectrum
  line(s,125,278,1130,278,C.ink,2); line(s,125,271,125,285,C.ink,2); line(s,1130,271,1130,285,C.ink,2);
  circle(s,110,263,30,C.surface,C.rule,1); circle(s,1080,263,30,C.surface,C.rule,1); circle(s,595,248,60,C.paleBrick,C.brick,2);
  txt(s,'只要文字放上去',64,318,180,30,{typeface:sans,fontSize:16,color:C.muted,align:'center'});
  txt(s,'发布会 / 路演 / 比赛',1010,318,210,30,{typeface:sans,fontSize:16,color:C.muted,align:'center'});
  txt(s,'学校、科研院所、事业单位、央国企与普通企业',420,322,390,44,{typeface:serif,fontSize:21,bold:true,color:C.brick,align:'center'});
  txt(s,'不能乱，不能丑，不能掉价，不能生成后无法修改。',330,420,620,32,{typeface:sans,fontSize:18,color:C.body,align:'center'});
  line(s,410,506,870,506,C.rule,1);
  txt(s,'综合质量',78,548,130,24,{typeface:sans,fontSize:16,color:C.muted});
  txt(s,'Q',220,535,46,42,{typeface:serif,fontSize:32,bold:true,color:C.ink});
  txt(s,'产品真正要提高的，是达到可用标准的概率。',328,540,700,32,{typeface:serif,fontSize:24,bold:true,color:C.ink});
  note(s, '需求两端与中间工作型场景来自稿件原文。中间圆点表示目标场景，不是市场测量。');
}

// 5 reliability equation
{
  const s = pres.slides.add(); s.background.fill=C.paper; header(s,'01','可靠度，是跨过可用线的概率',5);
  txt(s,'“80 分”代表稳定可用状态，不是质量上限。',78,126,800,36,{typeface:serif,fontSize:28,bold:true,color:C.ink});
  // threshold visual
  txt(s,'不可直接工作',150,250,180,24,{typeface:sans,fontSize:16,color:C.muted,align:'center'});
  txt(s,'可直接使用并继续修改',870,250,250,24,{typeface:sans,fontSize:16,color:C.brick,align:'center'});
  line(s,160,330,1120,330,C.ink,2); line(s,640,280,640,380,C.brick,3);
  txt(s,'Q可用',608,398,66,24,{typeface:serif,fontSize:18,bold:true,color:C.brick,align:'center'});
  txt(s,'随机工作稿',180,304,130,24,{typeface:sans,fontSize:15,color:C.muted,align:'center'});
  txt(s,'专业基础',930,304,130,24,{typeface:sans,fontSize:15,color:C.brick,align:'center'});
  addQuote(s,'对工作来说，稳定的 80 分，很多时候比随机的 95 分更值钱。',78,490,1020,64,28);
  txt(s,'R = P(Q ≥ Q可用 | 目标工作场景)',235,610,810,36,{typeface:serif,fontSize:30,bold:true,color:C.ink,align:'center'});
  note(s, '公式与“80 分”均按稿件中的概念表达保留。');
}

// 6 constraints
{
  const s = pres.slides.add(); s.background.fill=C.paper; header(s,'02','用限制自由换取可靠性',6);
  txt(s,'自由度越高，状态空间越大，失败模式也越多。',78,126,800,38,{typeface:serif,fontSize:28,bold:true,color:C.ink});
  const left=shape(s,'rect',92,240,420,240,C.surface,C.rule,1,'freedom');
  txt(s,'每次都重新决定',126,266,350,32,{typeface:serif,fontSize:24,bold:true,color:C.ink});
  txt(s,'颜色  字体  结构\n版式  元素  风格',126,330,300,92,{typeface:sans,fontSize:20,color:C.body,lineSpacing:1.35});
  txt(s,'理论上限更高',126,438,260,24,{typeface:sans,fontSize:16,color:C.muted});
  const right=shape(s,'rect',760,240,420,240,C.paleBrick,C.brick,1,'constraint');
  txt(s,'提前固定已验证的部分',794,266,360,32,{typeface:serif,fontSize:24,bold:true,color:C.ink});
  txt(s,'组织规范  能力边界\n数量容量  退化方式',794,330,300,92,{typeface:sans,fontSize:20,color:C.body,lineSpacing:1.35});
  txt(s,'结果更可预测',794,438,260,24,{typeface:sans,fontSize:16,color:C.brick,bold:true});
  line(s,550,360,710,360,C.brick,2); txt(s,'可靠性',585,323,90,24,{typeface:serif,fontSize:19,bold:true,color:C.brick,align:'center'});
  addQuote(s,'每次都不一样，有时候才是缺点。',78,570,980,48,26);
  note(s, '本页用左右对比解释限制自由的产品取舍，未添加新事实。');
}

// 7 AI controller
{
  const s = pres.slides.add(); s.background.fill=C.paper; header(s,'02','AI 是控制器，不是画师',7);
  txt(s,'把理解、路由与生成拆开，结果才可控。',78,124,760,36,{typeface:serif,fontSize:28,bold:true,color:C.ink});
  const a=shape(s,'rect',94,250,260,130,C.surface,C.rule,1,'director-content'); txt(s,'内容导演',114,274,220,28,{typeface:serif,fontSize:22,bold:true,color:C.ink}); txt(s,'理解稿件\n组织叙事、拆页',114,316,220,46,{typeface:sans,fontSize:17,color:C.body,lineSpacing:1.3});
  const b=shape(s,'rect',510,250,260,130,C.surface,C.rule,1,'director-visual'); txt(s,'视觉导演',530,274,220,28,{typeface:serif,fontSize:22,bold:true,color:C.ink}); txt(s,'判断表达方式\n选择合法结构',530,316,220,46,{typeface:sans,fontSize:17,color:C.body,lineSpacing:1.3});
  const c=shape(s,'rect',926,250,260,130,C.paleBrick,C.brick,1,'compiler'); txt(s,'确定性代码',946,274,220,28,{typeface:serif,fontSize:22,bold:true,color:C.ink}); txt(s,'稳定生成\n原生可编辑 PPTX',946,316,220,46,{typeface:sans,fontSize:17,color:C.body,lineSpacing:1.3});
  line(s,354,315,510,315,C.brick,2); line(s,770,315,926,315,C.brick,2);
  txt(s,'AI 负责理解和路由',132,466,310,30,{typeface:serif,fontSize:22,bold:true,color:C.brick});
  txt(s,'规则负责约束和选择',520,466,310,30,{typeface:serif,fontSize:22,bold:true,color:C.ink});
  txt(s,'代码负责稳定生成',910,466,270,30,{typeface:serif,fontSize:22,bold:true,color:C.ink});
  line(s,78,540,1160,540,C.rule,1);
  addQuote(s,'AI 读懂稿子，然后调用人已经提前做好的好东西。',78,580,1000,48,24);
  note(s, '页面关系图保留内容导演、视觉导演、确定性代码三者职责。连接线只连接节点。');
}

// 8 core architecture
{
  const s = pres.slides.add(); s.background.fill=C.paper; header(s,'02','核心架构：建设能力，再稳定调用',8);
  txt(s,'两条路线只在“经过确认的核心资产库”交汇。',78,124,860,36,{typeface:serif,fontSize:28,bold:true,color:C.ink});
  // swim lanes
  txt(s,'资产入库线',86,205,180,26,{typeface:serif,fontSize:20,bold:true,color:C.brick});
  txt(s,'正式生成线',86,442,180,26,{typeface:serif,fontSize:20,bold:true,color:C.brick});
  const topY=250, botY=485;
  const t1=shape(s,'rect',250,topY,160,62,C.surface,C.rule,1); txt(s,'优秀参考',270,269,120,24,{typeface:serif,fontSize:18,bold:true,color:C.ink,align:'center'});
  const t2=shape(s,'rect',450,topY,180,62,C.surface,C.rule,1); txt(s,'提炼规律',470,269,140,24,{typeface:serif,fontSize:18,bold:true,color:C.ink,align:'center'});
  const t3=shape(s,'rect',670,topY,180,62,C.paleBrick,C.brick,1); txt(s,'用户确认',690,269,140,24,{typeface:serif,fontSize:18,bold:true,color:C.brick,align:'center'});
  const t4=shape(s,'rect',890,topY,190,62,C.paleBrick,C.brick,1); txt(s,'核心资产库',910,269,150,24,{typeface:serif,fontSize:18,bold:true,color:C.brick,align:'center'});
  line(s,410,281,450,281,C.rule,1.5); line(s,630,281,670,281,C.rule,1.5); line(s,850,281,890,281,C.brick,1.5);
  const b1=shape(s,'rect',250,botY,180,62,C.surface,C.rule,1); txt(s,'稿件 + 主题',270,504,140,24,{typeface:serif,fontSize:18,bold:true,color:C.ink,align:'center'});
  const b2=shape(s,'rect',470,botY,180,62,C.surface,C.rule,1); txt(s,'理解与编排',490,504,140,24,{typeface:serif,fontSize:18,bold:true,color:C.ink,align:'center'});
  const b3=shape(s,'rect',690,botY,180,62,C.surface,C.rule,1); txt(s,'选择合法能力',710,504,140,24,{typeface:serif,fontSize:18,bold:true,color:C.ink,align:'center'});
  const b4=shape(s,'rect',910,botY,170,62,C.paleBrick,C.brick,1); txt(s,'编译 PPTX',930,504,130,24,{typeface:serif,fontSize:18,bold:true,color:C.brick,align:'center'});
  line(s,430,516,470,516,C.rule,1.5); line(s,650,516,690,516,C.rule,1.5); line(s,870,516,910,516,C.brick,1.5);
  line(s,985,312,985,485,C.brick,1.5); txt(s,'只读调用',1000,375,90,22,{typeface:sans,fontSize:15,color:C.brick});
  txt(s,'没有合适结构 → 简单排版 / 拆页',700,598,380,24,{typeface:sans,fontSize:15,color:C.muted,align:'right'});
  note(s, '架构关系按稿件 Mermaid 图重绘为原生可编辑形状，保留入库线、生成线与唯一交汇点。');
}

// 9 move cost forward
{
  const s = pres.slides.add(); s.background.fill=C.paper; header(s,'03','把昂贵的计算前移',9);
  txt(s,'建设期先理解、筛选、参数化并确认，交付期负责理解、选择和填参。',78,124,1000,38,{typeface:serif,fontSize:27,bold:true,color:C.ink});
  const stages=[['建设期','筛选优秀页面\n理解为什么好看\n验证数量变化'],['资产库','内容、图片、参数\n容量、退化方式\n用户确认'],['正式生成','理解稿件\n选择能力\n确定性绘制与检查']];
  const xs=[90,470,850];
  stages.forEach((st,i)=>{ const fill=i===1?C.paleBrick:C.surface; const stroke=i===1?C.brick:C.rule; shape(s,'rect',xs[i],250,300,190,fill,stroke,1); txt(s,st[0],xs[i]+26,276,240,30,{typeface:serif,fontSize:23,bold:true,color:i===1?C.brick:C.ink}); txt(s,st[1],xs[i]+26,328,240,88,{typeface:sans,fontSize:18,color:C.body,lineSpacing:1.35}); if(i<2) line(s,xs[i]+300,345,xs[i]+380,345,C.brick,2); });
  txt(s,'视觉理解从在线成本变成一次建设、多次复用的离线资产。',170,520,940,36,{typeface:serif,fontSize:25,bold:true,color:C.ink,align:'center'});
  line(s,250,590,1030,590,C.rule,1);
  txt(s,'模型继续变强，但每次交付不必重新设计每一页。',280,612,720,28,{typeface:sans,fontSize:17,color:C.body,align:'center'});
  note(s, '本页把稿件中的“建设期 / 正式生成阶段”流程做成三段可编辑关系图。');
}

// 10 capabilities not templates
{
  const s = pres.slides.add(); s.background.fill=C.paper; header(s,'03','真正积累的不是一万个模板',10);
  txt(s,'页面数量会变，表达规律才值得留下。',78,124,740,36,{typeface:serif,fontSize:28,bold:true,color:C.ink});
  const left=shape(s,'rect',90,224,430,286,C.surface,C.rule,1); txt(s,'一个漂亮页面',120,252,320,30,{typeface:serif,fontSize:24,bold:true,color:C.ink}); txt(s,'三个观点 → 四个观点\n十个字 → 六十个字',120,322,300,60,{typeface:sans,fontSize:21,color:C.body,lineSpacing:1.35}); txt(s,'静态模板难以穷尽内容变化',120,434,330,26,{typeface:sans,fontSize:16,color:C.muted});
  const right=shape(s,'rect',700,224,430,286,C.paleBrick,C.brick,1); txt(s,'一套表达能力',730,252,320,30,{typeface:serif,fontSize:24,bold:true,color:C.brick}); txt(s,'适合什么内容\n能处理多少内容\n超出边界怎么退化',730,322,300,92,{typeface:sans,fontSize:21,color:C.body,lineSpacing:1.35}); txt(s,'能力包可以反复调用',730,434,330,26,{typeface:sans,fontSize:16,color:C.brick,bold:true});
  line(s,520,366,700,366,C.brick,2);
  txt(s,'真正的壁垒',78,582,140,24,{typeface:sans,fontSize:15,bold:true,color:C.brick});
  txt(s,'有效表达能力 · 正确路由 · 容量边界 · 稳定生成',240,578,860,30,{typeface:serif,fontSize:22,bold:true,color:C.ink});
  note(s, '本页保留稿件列出的四项壁垒，使用平面双栏对比表达模板与能力的差异。');
}

// 11 scale organizations
{
  const s = pres.slides.add(); s.background.fill=C.paper; header(s,'04','从一个学校，走向更多组织',11);
  txt(s,'东北大学是第一个正式落地场景，但不是最终边界。',78,124,930,36,{typeface:serif,fontSize:28,bold:true,color:C.ink});
  const center=shape(s,'ellipse',515,256,250,170,C.paleBrick,C.brick,2); txt(s,'可复用的\n表达能力',545,304,190,70,{typeface:serif,fontSize:27,bold:true,color:C.brick,align:'center',lineSpacing:1.15});
  const nodes=[['东北大学',100,240],['科研院所',90,470],['实验室',930,232],['企业与团队',900,470]];
  nodes.forEach((n,i)=>{ const fill=i===0?C.surface:C.paper; const stroke=i===0?C.rule:C.rule; shape(s,'rect',n[1],n[2],200,70,fill,stroke,1); txt(s,n[0],n[1],n[2]+22,200,26,{typeface:serif,fontSize:21,bold:true,color:C.ink,align:'center'}); const cx=n[1]<500?n[1]+200:n[1]; const cy=n[2]+35; const tx=n[1]<500?515:765; const ty=341; line(s,cx,cy,tx,ty,C.rule,1.5); });
  txt(s,'主题配置',500,520,110,24,{typeface:sans,fontSize:15,bold:true,color:C.brick,align:'center'}); txt(s,'颜色、Logo、字体、页眉页脚可替换',650,518,420,25,{typeface:sans,fontSize:16,color:C.body});
  line(s,90,605,1190,605,C.rule,1); txt(s,'组织不用要求每名成员都成为设计师，也能稳定达到自己的基本标准。',90,626,1060,28,{typeface:serif,fontSize:20,color:C.ink,align:'center'});
  note(s, '组织扩展关系仅使用稿件列举的学校、科研院所、实验室、企业与团队，不添加市场判断。');
}

// 12 plain problem
{
  const s = pres.slides.add(); s.background.fill=C.paper; header(s,'04','最后，它仍然只想解决一件普通的事',12);
  txt(s,'做一套好 PPT 太费时间了。',78,142,700,44,{typeface:serif,fontSize:34,bold:true,color:C.ink});
  txt(s,'其中很多时间，花在以前已经有人解决过的问题上。',78,208,850,34,{typeface:sans,fontSize:20,color:C.body});
  const cols=[['AI','读稿子','理解内容与叙事'],['规则','做判断','约束结构与选择'],['代码','做重复劳动','稳定编译成 PPTX']];
  let x=100; cols.forEach((c,i)=>{ txt(s,c[0],x,330,120,42,{typeface:serif,fontSize:31,bold:true,color:i===0?C.brick:C.ink,align:'center'}); line(s,x+12,394,x+108,394,i===0?C.brick:C.rule,2); txt(s,c[1],x,416,120,30,{typeface:serif,fontSize:22,bold:true,color:C.ink,align:'center'}); txt(s,c[2],x-30,464,180,52,{typeface:sans,fontSize:16,color:C.body,align:'center',lineSpacing:1.2}); if(i<2) line(s,x+200,400,x+260,400,C.rule,1); x+=330; });
  line(s,80,570,1160,570,C.rule,1); txt(s,'让不太会做 PPT 的人，也能很快得到一套真正好用的 PPT。',120,604,1020,38,{typeface:serif,fontSize:25,bold:true,color:C.ink,align:'center'});
  note(s, '收束页保留稿件的三句动作表达，未加入产品外信息。');
}

// 13 close
{
  const s = pres.slides.add(); s.background.fill=C.paper; footer(s,13);
  line(s,78,112,1202,112,C.rule,1);
  txt(s,'可预测的交付',78,166,520,45,{typeface:serif,fontSize:38,bold:true,color:C.ink});
  txt(s,'是 PPagenT 想留下的产品能力。',78,224,620,44,{typeface:serif,fontSize:31,bold:true,color:C.brick});
  addQuote(s,'不一定惊艳，但靠谱；不一定独一无二，但真的好用。',78,352,950,68,30);
  addQuote(s,'可以立刻拿去讲，也可以继续修改。',78,445,900,62,30);
  line(s,78,566,370,566,C.brick,3);
  txt(s,'如果能持续做到这一点，普通问题就能成为可靠的产品能力。',78,592,980,32,{typeface:sans,fontSize:18,color:C.body});
  note(s, '结尾引用直接来自稿件末段，保持概念性表述。');
}

// Export first draft and per-slide previews
await (await PresentationFile.exportPptx(pres)).save(firstPptx);
for (let i=0;i<pres.slides.items.length;i++) {
  const png = await pres.export({ slide: pres.slides.items[i], format:'png', scale:1 });
  await fs.writeFile(path.join(firstRenderDir, `slide-${String(i+1).padStart(2,'0')}.png`), new Uint8Array(await png.arrayBuffer()));
}

const requirements = {
  explicitTotalSlideCount: 13,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  fontPolicy: { basis:'design', families:[serif, sans] },
};
const finalizerDir = path.join(workspaceDir, '.codex-finalizer');
await fs.mkdir(finalizerDir,{recursive:true});
const candidatePath = path.join(finalizerDir,'candidate.pptx');
await (await PresentationFile.exportPptx(pres)).save(candidatePath);
const result = await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath: finalPptx,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR,'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(SKILL_DIR,'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],
  fontPolicy: requirements.fontPolicy,
  verifyArtifactToolImport: true,
  receiptPath: path.join(finalizerDir,'final-validation.json'),
});
console.log(JSON.stringify(result,null,2));
await fs.copyFile(finalPptx, rootFinalPptx);

// Import final package and render again to confirm delivered-file readability.
const imported = await PresentationFile.importPptx(await (await import('@oai/artifact-tool')).FileBlob.load(rootFinalPptx));
for (let i=0;i<imported.slides.items.length;i++) {
  const png = await imported.export({ slide: imported.slides.items[i], format:'png', scale:1 });
  await fs.writeFile(path.join(finalRenderDir, `slide-${String(i+1).padStart(2,'0')}.png`), new Uint8Array(await png.arrayBuffer()));
}
console.log('slides', imported.slides.items.length, 'first', firstPptx, 'final', rootFinalPptx);
