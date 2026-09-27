import fs from 'node:fs/promises';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const OUT = 'C:/PPagenT/experiments/university-skin-pilot/aesthetic-ab-01/evidence/round-01';
const W = 1280, H = 720;
const C = {
  blue: '#315F91', ink: '#252B33', muted: '#707780', bg: '#FFFFFF',
  pale: '#EEF4FA', pale2: '#DCE8F4', line: '#CBD3DC', soft: '#F5F7F9',
};
const FONT = 'Microsoft YaHei';

async function writeBlob(path, blob) { await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer())); }

function box(slide, x, y, w, h, fill = 'none', lineFill = 'none', radius = 0, name = '') {
  return slide.shapes.add({ geometry: radius ? 'roundRect' : 'rect', name, position: { left:x, top:y, width:w, height:h }, fill, line: { style:'solid', fill:lineFill, width: lineFill === 'none' ? 0 : 1 }, ...(radius ? { borderRadius: radius } : {}) });
}
function text(slide, x, y, w, h, value, size = 18, color = C.ink, opts = {}) {
  const s = slide.shapes.add({ geometry:'textbox', name: opts.name || '', position:{left:x,top:y,width:w,height:h}, fill:'none', line:{style:'solid',fill:'none',width:0} });
  s.text = value;
  s.text.style = { fontSize:size, color, typeface:FONT, bold:!!opts.bold, alignment:opts.align || 'left', verticalAlignment: opts.valign || 'middle', lineSpacing: opts.lineSpacing || 1.35 };
  return s;
}
function rule(slide, x, y, w, color = C.line, width = 1) {
  return slide.shapes.add({ geometry:'line', position:{left:x,top:y,width:w,height:0}, fill:'none', line:{style:'solid',fill:color,width} });
}
function footer(slide, n, label = 'PPagenT · 产品叙事') {
  rule(slide, 55, 676, 1170, C.line, 1);
  text(slide, 55, 685, 500, 26, label, 12, C.muted);
  text(slide, 1120, 685, 105, 26, String(n).padStart(2,'0') + ' / 11', 12, C.muted, {align:'right'});
}
function title(slide, n, headline, kicker = '') {
  if (kicker) text(slide, 55, 34, 600, 22, kicker.toUpperCase(), 12, C.blue, {bold:true});
  text(slide, 55, kicker ? 62 : 42, 1080, 84, headline, 30, C.ink, {bold:true, lineSpacing:1.18});
  rule(slide, 55, kicker ? 154 : 134, 1170, C.line, 1);
  footer(slide,n);
}
function bullet(slide, x, y, w, head, body, accent = C.blue, headSize=21, bodySize=18) {
  box(slide,x,y,5,Math.max(42,body.split('\n').length*28+30),accent,'none');
  text(slide,x+18,y,w-18,32,head,headSize,C.ink,{bold:true});
  text(slide,x+18,y+38,w-18,Math.max(42,body.split('\n').length*28+12),body,bodySize,C.ink,{lineSpacing:1.35});
}
function label(slide,x,y,w,h,value,fill=C.pale,color=C.blue) {
  const b=box(slide,x,y,w,h,fill,'none',8); text(slide,x+8,y+2,w-16,h-4,value,16,color,{bold:true,align:'center'}); return b;
}
function connector(slide, source, target, fromSide, toSide, dashed=false) {
  const c = slide.shapes.connect(source,target,{kind:'straight',fromSide,toSide,line:{style:dashed?'dashed':'solid',fill:C.blue,width:2},tail:{type:'arrow',width:'sm',length:'sm'}});
  return c;
}

async function main() {
  await fs.mkdir(OUT,{recursive:true});
  const p = Presentation.create({ slideSize:{width:W,height:H} });

  // 1 cover
  { const s=p.slides.add(); s.background.fill=C.bg;
    box(s,55,86,8,390,C.blue,'none');
    text(s,88,104,700,120,'把 PPT 生成\n变成可靠的生产过程',44,C.ink,{bold:true,lineSpacing:1.08});
    text(s,90,258,700,48,'PPagenT 产品叙事',21,C.blue,{bold:true});
    text(s,90,337,650,92,'让 AI 读稿，让规则判断，让代码完成重复劳动。',24,C.ink,{lineSpacing:1.3});
    box(s,820,118,360,360,C.pale,'none');
    text(s,860,160,280,35,'可靠交付',21,C.blue,{bold:true});
    text(s,860,222,280,150,'不一定惊艳，\n但靠谱；\n可以立刻拿去讲，\n也可以继续修改。',28,C.ink,{bold:true,lineSpacing:1.2});
    text(s,90,644,560,28,'面向学校、科研院所与组织工作型 PPT',14,C.muted);
    text(s,1120,644,105,28,'01 / 11',12,C.muted,{align:'right'});
  }

  // 2 cost of making PPT
  { const s=p.slides.add(); s.background.fill=C.bg; title(s,2,'PPT 真正昂贵的是反复判断，不是拖动文本框','问题');
    text(s,55,184,450,100,'高手已经知道怎样做得好，\n但每次仍要重新做一遍。',27,C.blue,{bold:true,lineSpacing:1.25});
    text(s,55,318,430,106,'成本集中在一连串决定：\n如何讲、如何拆、如何对应、何时突出。',19,C.ink,{lineSpacing:1.4});
    rule(s,520,183,0,C.line,1); // visual column axis marker
    const rows=[['叙事','这场汇报到底怎么讲'],['拆页','一篇长稿应该拆成多少页'],['关系','观点是并列、递进、因果还是流程'],['表达','哪里突出、何时用图、何时一句话更有力'],['复用','找旧页面、换内容、调结构、统一规范']];
    rows.forEach((r,i)=>{ const y=182+i*82; text(s,560,y,110,28,r[0],19,C.blue,{bold:true}); text(s,690,y,505,44,r[1],19,C.ink); if(i<rows.length-1) rule(s,560,y+59,630,C.line,1); });
  }

  // 3 target market and R
  { const s=p.slides.add(); s.background.fill=C.bg; title(s,3,'先服务最适合标准化的工作型 PPT，可靠度才有明确对象','选择');
    text(s,55,178,980,40,'需求两端都真实存在，但更大的密度位于中间。',20,C.ink);
    box(s,55,244,280,122,C.soft,'none'); text(s,78,266,230,30,'只要文字放上去',21,C.ink,{bold:true}); text(s,78,309,230,36,'几乎不在意版式',17,C.muted);
    box(s,945,244,280,122,C.soft,'none'); text(s,968,266,230,30,'高度定制创意',21,C.ink,{bold:true}); text(s,968,309,230,36,'发布会、路演、比赛',17,C.muted);
    box(s,416,225,430,162,C.pale,'none');
    text(s,446,247,370,32,'PPagenT 的起点',21,C.blue,{bold:true,align:'center'});
    text(s,446,292,370,54,'学校、科研院所、事业单位、\n央国企与普通企业',20,C.ink,{bold:true,align:'center',lineSpacing:1.25});
    text(s,55,430,550,34,'底线：不能乱、不能丑、不能掉价、不能无法修改。',20,C.ink,{bold:true});
    box(s,706,424,519,158,C.ink,'none');
    text(s,742,443,450,34,'可靠度 R',21,'#FFFFFF',{bold:true});
    text(s,742,482,450,45,'R = P(Q ≥ Q可用 | 目标工作场景)',26,'#FFFFFF',{bold:true});
    text(s,742,538,450,28,'目标：跨过可用线的概率',16,'#DCE8F4');
  }

  // 4 stable 80 vs random 95
  { const s=p.slides.add(); s.background.fill=C.bg; title(s,4,'工作场景更在意稳定跨过可用线，而不是偶然的 95 分','判断');
    box(s,55,184,530,300,C.pale,'none');
    text(s,88,216,450,50,'80 分',36,C.blue,{bold:true});
    text(s,88,278,430,150,'稳定可用状态的比喻：\n直接使用不失专业，\n继续修改有可靠基础，\n投入与收益相匹配。',22,C.ink,{bold:true,lineSpacing:1.25});
    box(s,640,184,585,300,C.soft,'none');
    text(s,675,216,490,50,'95 分',36,C.muted,{bold:true});
    text(s,675,278,490,100,'偶然惊艳的峰值，\n不等于工作交付的可靠性。',22,C.ink,{bold:true,lineSpacing:1.3});
    rule(s,55,535,1170,C.blue,2);
    text(s,55,552,1170,40,'明天上午九点要汇报：前一晚交稿，第二天仍能继续修改。',21,C.ink,{bold:true});
  }

  // 5 constraints
  { const s=p.slides.add(); s.background.fill=C.bg; title(s,5,'限制自由，是为了减少结果落入不可用区间的机会','取舍');
    text(s,55,178,560,65,'自由度越高，理论上限越高；\n状态空间与失败模式也会一起扩大。',21,C.ink,{lineSpacing:1.3});
    box(s,55,288,550,280,C.soft,'none');
    text(s,88,316,470,30,'主动保留的约束',21,C.blue,{bold:true});
    const keep=['组织视觉规范','经过验证的表达能力','明确的数量与容量边界','已经登记的退化方式'];
    keep.forEach((v,i)=>{ label(s,88,366+i*45,240,30,v,C.pale,C.ink); });
    box(s,675,288,550,280,C.pale,'none');
    text(s,708,316,470,30,'超出边界时的退路',21,C.blue,{bold:true});
    text(s,708,370,450,120,'换样式\n拆页\n退化为简单文字排版',28,C.ink,{bold:true,lineSpacing:1.35});
    text(s,708,520,450,28,'理论峰值可能降低，落入不可用区间的机会也降低。',16,C.muted);
  }

  // 6 controllers
  { const s=p.slides.add(); s.background.fill=C.bg; title(s,6,'AI 是控制器：理解与路由交给模型，稳定生成交给规则和代码','分工');
    box(s,55,190,360,330,C.pale,'none');
    text(s,85,222,300,36,'内容导演',24,C.blue,{bold:true});
    text(s,85,286,290,172,'理解稿件\n组织叙事\n拆页\n形成页面内容',25,C.ink,{bold:true,lineSpacing:1.35});
    box(s,460,190,360,330,C.soft,'none');
    text(s,490,222,300,36,'视觉导演',24,C.blue,{bold:true});
    text(s,490,286,290,172,'判断表达方式\n从已确认能力中\n选择合适结构\n必要时有限补充',25,C.ink,{bold:true,lineSpacing:1.35});
    box(s,865,190,360,330,C.ink,'none');
    text(s,895,222,300,36,'确定性执行',24,'#FFFFFF',{bold:true});
    text(s,895,286,290,172,'主题约束规范\n核心库提供能力\n代码绘制与检查\n编译原生可编辑 PPTX',23,'#FFFFFF',{bold:true,lineSpacing:1.35});
    text(s,55,575,1170,38,'AI 负责理解和路由 · 规则负责约束和选择 · 代码负责稳定生成',21,C.blue,{bold:true,align:'center'});
  }

  // 7 two routes architecture
  { const s=p.slides.add(); s.background.fill=C.bg; title(s,7,'建设视觉能力与使用视觉能力分成两条路线，核心库是唯一交汇点','架构');
    // connectors first
    const a1=box(s,90,230,230,76,C.pale,'none',6,'优秀参考');
    const a2=box(s,355,230,230,76,C.pale,'none',6,'提炼规律');
    const a3=box(s,620,230,230,76,C.pale,'none',6,'适应数量');
    const core=box(s,900,202,245,132,C.ink,'none',8,'核心资产库');
    const run1=box(s,90,446,230,76,C.soft,'none',6,'原始稿件');
    const run2=box(s,355,446,230,76,C.soft,'none',6,'理解与编排');
    const run3=box(s,620,446,230,76,C.soft,'none',6,'选择合法能力');
    const out=box(s,900,446,245,76,C.pale2,'none',6,'原生可编辑 PPTX');
    connector(s,a1,a2,'right','left'); connector(s,a2,a3,'right','left'); connector(s,a3,core,'right','left');
    connector(s,run1,run2,'right','left'); connector(s,run2,run3,'right','left'); connector(s,run3,out,'right','left');
    connector(s,core,run3,'bottom','right',true);
    [a1,a2,a3,run1,run2,run3,out].forEach((sh,i)=>text(s,sh.position.left+8,sh.position.top+22,sh.position.width-16,32,sh.name,18,i<3?C.blue:C.ink,{bold:true,align:'center',name:`node-label-${i+1}`}));
    text(s,908,210,229,32,'核心资产库',18,'#FFFFFF',{bold:true,align:'center',name:'core-label-title'});
    text(s,908,242,229,84,'用户确认后入库\n只读调用\n已验证能力',18,'#FFFFFF',{align:'center',lineSpacing:1.2,name:'core-label-desc'});
    text(s,90,184,760,30,'资产入库线：把经验变成能力',18,C.blue,{bold:true});
    text(s,90,398,760,30,'正式生成线：把能力稳定地用出来',18,C.blue,{bold:true});
    text(s,90,565,1050,32,'若缺少 Logic 或 Structure Group，只说明缺口及对应页面；是否启动入库由用户决定。',16,C.muted);
  }

  // 8 front-load cost
  { const s=p.slides.add(); s.background.fill=C.bg; title(s,8,'把昂贵的视觉理解前移到建设期，运行期才能重复调用','成本');
    text(s,55,180,520,34,'传统路线：每来一个用户，就重新理解、设计、绘制。',20,C.ink,{bold:true});
    text(s,55,232,520,150,'计算、审美判断和失败风险\n全部集中在运行时。',25,C.muted,{bold:true,lineSpacing:1.25});
    rule(s,640,178,0,C.line,1);
    text(s,690,180,520,34,'PPagenT：建设一次，多次复用。',20,C.blue,{bold:true});
    const steps=[['筛选','优秀页面'],['理解','为什么好看'],['参数化','内容、图片、数量'],['验证','不同状态'],['确认','进入正式资产库']];
    steps.forEach((st,i)=>{ const y=238+i*58; label(s,690,y,105,32,st[0],C.pale,C.blue); text(s,820,y+3,380,30,st[1],19,C.ink,{bold:true}); if(i<steps.length-1) rule(s,742,y+35,2,C.blue,2); });
    box(s,55,550,1170,90,C.pale,'none');
    text(s,90,568,1090,36,'运行期：模型理解、分类、路由、填参；确定性代码绘制与检查。',21,C.ink,{bold:true,align:'center'});
    text(s,90,610,1090,30,'视觉模型可用于建设期资产理解与审查，但不是每次交付的必要成本。',16,C.muted,{align:'center'});
  }

  // 9 capabilities over templates
  { const s=p.slides.add(); s.background.fill=C.bg; title(s,9,'真正积累的是表达规律与失败边界，不是一万个静态模板','壁垒');
    box(s,55,180,470,360,C.soft,'none');
    text(s,88,214,400,34,'静态模板会遇到变化',21,C.blue,{bold:true});
    text(s,88,280,390,132,'原页面：3 个观点\n新稿件：4 个观点\n原页面：每项 10 个字\n新内容：每项 60 个字',24,C.ink,{bold:true,lineSpacing:1.35});
    text(s,88,462,390,48,'数量与长度变化，不能靠复制页面解决。',17,C.muted);
    box(s,595,180,630,360,C.pale,'none');
    text(s,628,214,560,34,'能力包保存的经验',21,C.blue,{bold:true});
    const caps=['什么内容适合怎样表达','一个版式能处理多少内容','数量变化时怎样重新排布','超过边界：换样式、拆页或简单排版','哪些结构即使能画也不应该用'];
    caps.forEach((v,i)=>{ text(s,628,278+i*48,540,31,'—  '+v,19,C.ink,{bold:i===3}); });
    text(s,55,583,1170,32,'壁垒 = 有效能力 + 可靠路由 + 容量与失败边界 + 稳定可编辑交付',20,C.blue,{bold:true,align:'center'});
  }

  // 10 organizational expansion
  { const s=p.slides.add(); s.background.fill=C.bg; title(s,10,'东北大学是可检验的起点，主题替换让能力走向更多组织','扩展');
    const pilot=box(s,55,248,300,160,C.ink,'none',8,'东北大学');
    text(s,82,276,245,34,'东北大学',25,'#FFFFFF',{bold:true,align:'center',name:'pilot-label-title'});
    text(s,82,330,245,52,'视觉规范明确\n汇报需求持续、边界真实',18,'#FFFFFF',{align:'center',lineSpacing:1.25,name:'pilot-label-desc'});
    const theme=box(s,492,190,310,124,C.pale,'none',6,'主题配置');
    text(s,520,212,254,30,'主题配置可替换',21,C.blue,{bold:true,align:'center',name:'theme-label-title'});
    text(s,520,258,254,32,'颜色 · Logo · 字体 · 页眉页脚',16,C.ink,{align:'center',name:'theme-label-desc'});
    const rules=box(s,492,364,310,124,C.soft,'none',6,'理解规则');
    text(s,520,386,254,30,'继续复用',21,C.blue,{bold:true,align:'center',name:'rules-label-title'});
    text(s,520,432,254,32,'内容理解规则与表达能力',16,C.ink,{align:'center',name:'rules-label-desc'});
    const orgs=box(s,930,248,295,160,C.pale2,'none',8,'更多组织');
    text(s,958,274,240,34,'更多组织',24,C.blue,{bold:true,align:'center',name:'orgs-label-title'});
    text(s,958,328,240,58,'学校 · 科研院所 · 实验室\n企业 · 团队 · 个人风格',17,C.ink,{align:'center',lineSpacing:1.3,name:'orgs-label-desc'});
    // connectors first would have been before nodes, but this page nodes already exist; connectors remain behind by default
    connector(s,pilot,theme,'right','left'); connector(s,pilot,rules,'right','left'); connector(s,theme,orgs,'right','left'); connector(s,rules,orgs,'right','left');
    text(s,55,540,1170,48,'把少数人头脑和电脑里的能力，转成更多人低成本获得的生产能力。',21,C.ink,{bold:true,align:'center'});
  }

  // 11 close
  { const s=p.slides.add(); s.background.fill=C.bg; title(s,11,'把已经验证的经验留下来，交付概率上高度可预测的 PPT','收束');
    text(s,55,190,1170,62,'让一个原本不太会做 PPT 的人，也能很快得到一套真正好用的 PPT。',26,C.blue,{bold:true});
    const cols=[['AI','帮我们读稿子','理解与路由'],['规则','帮我们做判断','约束与选择'],['代码','完成重复劳动','稳定生成']];
    cols.forEach((c,i)=>{ const x=55+i*390; box(s,x,302,340,146,i===1?C.ink:C.pale,'none'); text(s,x+24,318,292,38,c[0],23,i===1?'#FFFFFF':C.blue,{bold:true}); text(s,x+24,360,292,36,c[1],20,i===1?'#FFFFFF':C.ink,{bold:true}); text(s,x+24,402,292,32,c[2],16,i===1?'#DCE8F4':C.muted); });
    rule(s,55,504,1170,C.blue,2);
    text(s,55,527,1170,78,'不一定惊艳，但靠谱；不一定独一无二，但真的好用；\n可以立刻拿去讲，也可以继续修改。',25,C.ink,{bold:true,align:'center',lineSpacing:1.25});
    text(s,55,625,1170,25,'如果能持续做到，这个普通问题就能成为可靠的产品能力，也有机会形成一门真正的生意。',16,C.muted,{align:'center'});
  }

  for (const [i,slide] of p.slides.items.entries()) {
    const n=i+1;
    await fs.writeFile(`${OUT}/slide-${n}.layout.json`, await (await slide.export({format:'layout'})).text());
  }
  const pptx = await PresentationFile.exportPptx(p);
  await pptx.save(`${OUT}/deck.pptx`);
}

main().catch(err => { console.error(err); process.exitCode=1; });
