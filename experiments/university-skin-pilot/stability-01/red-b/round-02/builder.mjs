import fs from 'node:fs/promises';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const OUT = 'C:/PPagenT/experiments/university-skin-pilot/stability-01/red-b/round-02';
const FONT = 'Microsoft YaHei';
const C = {
  primary: '#315F91',
  deep: '#243F63',
  ink: '#252B33',
  muted: '#707780',
  bg: '#FFFFFF',
  pale: '#EEF3F8',
  pale2: '#F6F8FB',
  line: '#D5DDE7',
  mid: '#6F8FB1',
  white: '#FFFFFF',
};
const W = 1280;
const H = 720;
const M = 55;
const FOOT = 688;

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}
function tx(slide, name, text, x, y, w, h, size=20, color=C.ink, opts={}) {
  const s = slide.shapes.add({
    geometry: 'textbox', name, position: {left:x, top:y, width:w, height:h},
    fill: 'none', line: {style:'solid', fill:'none', width:0},
  });
  s.text = text;
  s.text.style = {
    fontSize:size, color, typeface:FONT,
    bold: !!opts.bold, alignment: opts.align || 'left',
    verticalAlignment: opts.valign || 'top', lineSpacing: opts.lineSpacing || 1.08,
    autoFit: opts.autoFit || 'none',
    insets: opts.insets || {top:0,right:0,bottom:0,left:0},
  };
  return s;
}
function box(slide, name, x, y, w, h, fill=C.pale2, radius=0, stroke=C.line) {
  return slide.shapes.add({
    geometry: radius ? 'roundRect' : 'rect', name,
    position:{left:x,top:y,width:w,height:h}, fill,
    line:{style:'solid',fill:stroke,width:stroke==='none'?0:1},
    ...(radius ? {borderRadius:radius} : {}),
  });
}
function rule(slide, name, x, y, w, color=C.primary, height=3) {
  return slide.shapes.add({geometry:'rect', name, position:{left:x,top:y,width:w,height:height}, fill:color, line:{style:'solid',fill:color,width:0}});
}
function circle(slide, name, x, y, d, fill=C.primary) {
  return slide.shapes.add({geometry:'ellipse', name, position:{left:x,top:y,width:d,height:d}, fill, line:{style:'solid',fill:'none',width:0}});
}
function arrow(slide, from, to, opts={}) {
  return slide.shapes.connect(from, to, {
    kind: opts.kind || 'straight', fromSide: opts.fromSide, toSide: opts.toSide,
    line:{style:opts.dashed?'dashed':'solid',fill:opts.color || C.mid,width:opts.width || 2},
    tail:{type:'arrow',width:opts.arrowWidth || 'sm',length:opts.arrowLength || 'sm'},
  });
}
function pageChrome(slide, title, kicker='辽宁“六地”红色文化标识融入党员教育') {
  slide.background.fill = C.bg;
  tx(slide, 'kicker', kicker, M, 22, 500, 18, 14, C.primary, {bold:true});
  tx(slide, 'title', title, M, 48, 1120, 42, 32, C.ink, {bold:true, lineSpacing:1});
  rule(slide, 'title-rule', M, 101, 1170, C.primary, 3);
  tx(slide, 'footer-source', '数据来自来稿《让“六地”红》', M, FOOT, 420, 16, 14, C.muted);
  tx(slide, 'footer-page', String(slide.index + 1).padStart(2,'0'), 1180, FOOT, 45, 16, 14, C.muted, {align:'right'});
}
function tag(slide, name, label, x, y, w, fill=C.pale, color=C.primary) {
  box(slide, name+'-bg', x, y, w, 30, fill, 14, 'none');
  tx(slide, name, label, x+10, y+5, w-20, 20, 16, color, {bold:true,align:'center',valign:'middle'});
}
function metric(slide, name, value, label, x, y, w, h, fill=C.pale) {
  box(slide, name+'-surface', x,y,w,h,fill,10,C.line);
  tx(slide, name+'-value', value, x+14,y+13,w-28,40,34,C.primary,{bold:true,align:'center',valign:'middle'});
  tx(slide, name+'-label', label, x+14,y+59,w-28,h-67,17,C.ink,{lineSpacing:1.05,align:'center',valign:'middle'});
}
function notes(slide, text) {
  slide.speakerNotes.textFrame.setText(text);
  slide.speakerNotes.setVisible(true);
}

function slide1(p) {
  const s=p.slides.add(); s.background.fill=C.primary;
  box(s,'cover-band',0,0,W,14,C.deep,0,'none');
  tx(s,'cover-kicker','辽宁“六地”红色文化标识融入党员教育的创新实践',M,78,800,28,18,C.white,{bold:true});
  tx(s,'cover-title','让“六地”红，\n成为理工青年最鲜亮的青春底色',M,148,900,180,46,C.white,{bold:true,lineSpacing:0.98});
  tx(s,'cover-sub','十年探路 · 五年深耕 · 把红色资源变成离青年最近的党员教育现场',M,356,860,38,20,'#DDE8F4');
  rule(s,'cover-rule',M,432,300,C.white,4);
  tx(s,'cover-foot','创新案例分享',M,474,280,28,18,C.white,{bold:true});
  tx(s,'cover-note','红色研学链  /  青春课堂  /  育人机制',M,514,600,28,18,'#DDE8F4');
  tx(s,'cover-page','01',1180,660,45,18,14,'#DDE8F4',{align:'right'});
  notes(s,'开场：用“六地红”作为全稿中心判断，接着说明困境、路径和结果。');
}

function slide2(p) {
  const s=p.slides.add(); pageChrome(s,'理工学生的高优势，曾与低认同并存');
  tx(s,'lead','学院先识别“三高三低”的结构性困境，再把优势导入党建实践。',M,119,940,30,20,C.deep,{bold:true});
  const left=box(s,'high-group',M,188,330,270,C.pale,14,C.line);
  tx(s,'high-title','学生优势',M+24,225,282,28,22,C.primary,{bold:true,align:'center',valign:'middle'});
  tx(s,'high-copy','高学分\n高竞赛\n高科研',M+24,273,282,148,28,C.ink,{bold:true,lineSpacing:1.18,align:'center',valign:'middle'});
  const right=box(s,'low-group',430,188,330,270,C.pale2,14,C.line);
  tx(s,'low-title','教育难题',454,225,282,28,22,C.primary,{bold:true,align:'center',valign:'middle'});
  tx(s,'low-copy','理论情感浓度低\n身份认同声量低\n知行合一燃值低',454,273,282,148,23,C.ink,{lineSpacing:1.25,align:'center',valign:'middle'});
  const pivot=box(s,'pivot',840,188,375,270,C.deep,14,'none');
  tx(s,'pivot-title','党建实践转向',870,228,315,34,24,C.white,{bold:true,align:'center',valign:'middle'});
  tx(s,'pivot-copy','组建红色梦想实践团\n走遍全国九省\n在社会课堂锻造“理论＋实践”立体化红色矩阵',870,286,315,132,20,'#E3EDF7',{lineSpacing:1.2,align:'center',valign:'middle'});
  arrow(s,left,pivot,{fromSide:'bottom',toSide:'bottom',kind:'elbow',color:C.mid,width:3});
  arrow(s,right,pivot,{fromSide:'bottom',toSide:'bottom',kind:'elbow',color:C.mid,width:3});
  tx(s,'bottom-note','今天的选择：把目光从“走遍全国”转向“深耕辽宁”。',M,515,1100,32,22,C.primary,{bold:true});
  notes(s,'原稿依据：从“三高三低”到深耕辽宁。左、右两组是并列诊断，分别由箭头汇入实践转向。');
}

function slide3(p) {
  const s=p.slides.add(); pageChrome(s,'深耕辽宁，让“六地”成为最近的教育现场');
  tx(s,'lead','六个红色标识共同构成辽宁故事的“最近、最燃、最硬核”现场。',M,119,1000,30,20,C.deep,{bold:true});
  box(s,'six-container',M,180,760,360,C.pale2,16,C.line);
  tx(s,'six-title','辽宁“六地”红色文化标识',M+28,205,680,28,22,C.primary,{bold:true});
  const labels=[
    ['抗日战争','起始地'],['解放战争','转折地'],['新中国国歌','素材地'],
    ['抗美援朝','出征地'],['共和国工业','奠基地'],['雷锋精神','发祥地'],
  ];
  labels.forEach((a,i)=>{
    const x=M+28+(i%3)*232, y=260+Math.floor(i/3)*112;
    box(s,'six-'+i,x,y,204,78,C.white,10,C.line);
    tx(s,'six-'+i+'a',a[0],x+14,y+15,176,25,20,C.ink,{bold:true,align:'center',valign:'middle'});
    tx(s,'six-'+i+'b',a[1],x+14,y+44,176,20,17,C.primary,{align:'center',valign:'middle'});
  });
  const site=box(s,'young-site',860,220,350,230,C.primary,16,'none');
  tx(s,'site-title','党员教育现场',890,257,290,40,28,C.white,{bold:true,align:'center',valign:'middle'});
  tx(s,'site-copy','热爱辽宁\n扎根辽宁\n服务辽宁',890,323,290,90,22,'#E2EDF7',{align:'center',valign:'middle',lineSpacing:1.2});
  tx(s,'bottom-note','把红色资源从“远方的故事”变成青年可以走近、走进、走完的教育路径。',M,575,1120,30,19,C.muted);
  notes(s,'原稿依据：六个红色标识与“离理工青年最近、最燃、最硬核”的目标。六地共享一个辽宁红色资源容器。');
}

function slide4(p) {
  const s=p.slides.add(); pageChrome(s,'1+3+N 新矩阵，把教育拓展到全时全域');
  tx(s,'lead','双轮驱动先明确方向，再由 1+3+N 把教育落到链、课堂与场景。',M,119,1120,30,20,C.deep,{bold:true});
  const driverA=box(s,'driver-red',M,170,560,102,C.pale,12,C.line);
  tx(s,'driver-red-title','红色基因传承',M+24,188,512,28,22,C.primary,{bold:true,align:'center',valign:'middle'});
  tx(s,'driver-red-copy','深挖“六地”文化内涵，绘制“红色足迹地图”',M+24,228,512,24,18,C.ink,{align:'center',valign:'middle'});
  const driverB=box(s,'driver-practice',665,170,550,102,C.pale2,12,C.line);
  tx(s,'driver-practice-title','实践研学赋能',689,188,502,28,22,C.primary,{bold:true,align:'center',valign:'middle'});
  tx(s,'driver-practice-copy','把红色资源变成可走近、可进入、可协作的现场',689,228,502,24,18,C.ink,{align:'center',valign:'middle'});
  const frame=box(s,'matrix-frame',M,314,1160,258,C.pale2,0,C.line);
  tx(s,'matrix-frame-title','1 + 3 + N 新矩阵  ·  五位一体红色育人生态',M+24,338,1112,30,25,C.deep,{bold:true,align:'center',valign:'middle'});
  const chain=box(s,'matrix-chain',M+30,390,335,142,C.white,12,C.line);
  tx(s,'chain-title','1 条研学链',M+50,406,295,26,22,C.primary,{bold:true,align:'center',valign:'middle'});
  tx(s,'chain-copy','对接 22 处“六地”示范教学点\n1 个校本基地 + 6 处核心场馆\n+ N 个配套教学点',M+50,445,295,72,17,C.ink,{lineSpacing:1.15,align:'center',valign:'middle'});
  const classes=box(s,'matrix-classes',472,390,335,142,C.white,12,C.line);
  tx(s,'classes-title','3 类青春课堂',492,406,295,26,22,C.primary,{bold:true,align:'center',valign:'middle'});
  tx(s,'classes-copy','行走课堂：红色研学\n沉浸课堂：VR 党课\n互动课堂：青春宣讲',492,445,295,72,18,C.ink,{lineSpacing:1.15,align:'center',valign:'middle'});
  const scenes=box(s,'matrix-scenes',844,390,335,142,C.white,12,C.line);
  tx(s,'scenes-title','N 个教育场景',864,406,295,26,22,C.primary,{bold:true,align:'center',valign:'middle'});
  tx(s,'scenes-copy','校地 · 校企 · 校校党建联建\n从“一时一地”到“全时全域”',864,445,295,72,18,C.ink,{lineSpacing:1.15,align:'center',valign:'middle'});
  tx(s,'bottom-note','1+6+N 是研学链内部路线；1+3+N 是全稿矩阵层级，二者口径分明。',M,600,1120,24,16,C.muted);
  notes(s,'原稿依据：1+3+N 括注。严格区分矩阵层级与研学链内部“1+6+N”路线。');
}

function slide5(p) {
  const s=p.slides.add(); pageChrome(s,'红色任务单，把行走党课变成专业担当');
  tx(s,'lead','任务单不是打卡清单，而是“把自己、工作、职责摆进去”的三摆三写军令状。',M,119,1120,30,20,C.deep,{bold:true});
  const taskFrame=box(s,'task-frame',M,196,1160,178,C.pale2,0,C.line);
  tx(s,'task-frame-title','三项共同任务',M+26,214,1108,28,22,C.primary,{bold:true,align:'center',valign:'middle'});
  const a=box(s,'task-a',M+30,260,320,82,C.white,12,C.line);
  const b=box(s,'task-b',430,260,320,82,C.white,12,C.line);
  const c=box(s,'task-c',810,260,350,82,C.white,12,C.line);
  tx(s,'task-a-t','拍一段“青声说史”',M+50,279,280,38,20,C.ink,{bold:true,align:'center',valign:'middle'});
  tx(s,'task-b-t','解决一个“微难题”',450,279,280,38,20,C.ink,{bold:true,align:'center',valign:'middle'});
  tx(s,'task-c-t','带回一个“振兴微课题”',830,279,310,38,20,C.ink,{bold:true,align:'center',valign:'middle'});
  tx(s,'triad-title','三摆三写：任务单的机制重心',M,414,510,28,22,C.primary,{bold:true});
  const triad=box(s,'triad',M,454,700,116,C.deep,12,'none');
  tx(s,'triad-copy','把自己摆进去 → 写青春誓言\n把工作摆进去 → 写专业方案\n把职责摆进去 → 写振兴答卷',M+28,471,644,82,20,C.white,{lineSpacing:1.28,align:'center',valign:'middle'});
  const evidence=box(s,'task-evidence',810,414,405,156,C.pale,0,C.line);
  tx(s,'task-evidence-title','两组不同口径的证据',834,434,357,24,18,C.primary,{bold:true,align:'center',valign:'middle'});
  tx(s,'task-evidence-copy','五年累计 26 项微课题被“揭榜挂帅”\n成效报告：26 份“三摆三写”课题，8 家企业“收货”',834,475,357,70,17,C.ink,{lineSpacing:1.15,align:'center',valign:'middle'});
  tx(s,'task-note','算法、图纸、代码，都是青年党员可以扛起的时代订单。',M,600,1120,24,19,C.deep,{bold:true});
  notes(s,'原稿依据：五类抓手第一段；三项任务是并列，不人为补出执行顺序；三摆三写为机制重心；26项与26份/8家明确分开。');
}

function slide6(p) {
  const s=p.slides.add(); pageChrome(s,'VR 基地，把 22 处旧址变成可进入的沉浸课堂');
  tx(s,'lead','全景数据、VR 党课与示范基地，让“一屏百年”成为可预约、可复用的教育体验。',M,119,1120,30,20,C.deep,{bold:true});
  const src=box(s,'vr-source',M,224,250,176,C.pale,14,C.line);
  tx(s,'vr-source-num','22',M+25,251,200,54,42,C.primary,{bold:true,align:'center',valign:'middle'});
  tx(s,'vr-source-label','处“六地”旧址\n全景数据',M+25,320,200,54,20,C.ink,{align:'center',valign:'middle',lineSpacing:1.1});
  const core=box(s,'vr-core',390,202,340,220,C.deep,16,'none');
  tx(s,'vr-core-title','沉浸课堂',420,244,280,36,28,C.white,{bold:true,align:'center',valign:'middle'});
  tx(s,'vr-core-copy','7 门红色 VR 党课\n一键穿越 · 一屏百年',420,310,280,70,22,'#E0EBF7',{align:'center',valign:'middle',lineSpacing:1.2});
  const use=box(s,'vr-use',820,224,390,176,C.pale2,14,C.line);
  tx(s,'vr-use-title','被真实使用的基地',850,252,330,28,21,C.primary,{bold:true,align:'center',valign:'middle'});
  tx(s,'vr-use-copy','170 个省内外支部预约\n2400 余名党员体验',850,306,330,66,24,C.ink,{bold:true,lineSpacing:1.22,align:'center',valign:'middle'});
  arrow(s,src,core,{fromSide:'right',toSide:'left',color:C.mid,width:3}); arrow(s,core,use,{fromSide:'right',toSide:'left',color:C.mid,width:3});
  box(s,'vr-awards',M,473,1160,80,C.pale,10,C.line);
  tx(s,'vr-awards-copy','省党员教育培训示范基地  ·  省高校基层党建创新一等奖  ·  获中组部组织二局、教育部教师工作司负责同志肯定',M+22,495,1116,30,17,C.ink,{align:'center',valign:'middle'});
  tx(s,'vr-note','技术在这里承担的是“进入现场”的教育职责。',M,590,1120,24,19,C.deep,{bold:true});
  notes(s,'原稿依据：VR 党员教育示范基地抓手。22→7 是转化关系，7→预约体验是使用结果，奖项与肯定是支持证据。');
}

function slide7(p) {
  const s=p.slides.add(); pageChrome(s,'青年讲、青年听、青年信，让理论走出校园');
  tx(s,'lead','博士、硕士、本科混编，把“六地”精神改写为青年愿意进入的互动课堂。',M,119,1120,30,20,C.deep,{bold:true});
  const team=box(s,'speak-team',M,224,270,180,C.pale,14,C.line);
  tx(s,'speak-team-num','32 人',M+22,261,226,44,34,C.primary,{bold:true,align:'center',valign:'middle'});
  tx(s,'speak-team-label','博士 · 硕士 · 本科\n混编梯队',M+22,322,226,45,20,C.ink,{align:'center',valign:'middle',lineSpacing:1.15});
  const course=box(s,'speak-course',392,202,350,224,C.deep,16,'none');
  tx(s,'speak-course-title','10 类互动课件',424,250,286,36,28,C.white,{bold:true,align:'center',valign:'middle'});
  tx(s,'speak-course-copy','沉浸式故事 · 情景短剧\n红色闯关 · 青春语态重构',424,319,286,60,21,'#E0EBF7',{align:'center',valign:'middle',lineSpacing:1.18});
  const reach=box(s,'speak-reach',830,224,380,180,C.pale2,14,C.line);
  tx(s,'speak-reach-num','36 场',860,259,160,42,34,C.primary,{bold:true,align:'center',valign:'middle'});
  tx(s,'speak-reach-label','进校园 · 进社区 · 进企业\n覆盖师生群众 3800 多人',855,321,330,48,19,C.ink,{lineSpacing:1.18,align:'center',valign:'middle'});
  arrow(s,team,course,{fromSide:'right',toSide:'left',color:C.mid,width:3}); arrow(s,course,reach,{fromSide:'right',toSide:'left',color:C.mid,width:3});
  box(s,'speak-award',M,476,1160,72,C.pale,10,C.line);
  tx(s,'speak-award-copy','获评“辽宁省大学生红色理论宣讲团”',M+22,497,1116,28,20,C.primary,{bold:true,align:'center',valign:'middle'});
  tx(s,'speak-note','同一套理论，经过青年讲述，进入社区、课堂、生产一线和百姓心坎。',M,590,1120,24,19,C.deep,{bold:true});
  notes(s,'原稿依据：青春有理青年宣讲团。32→10→36 是执行链，3800多人和省级认定是结果证据。');
}

function slide8(p) {
  const s=p.slides.add(); pageChrome(s,'红色朋友圈，把资源共享成振兴同心圆');
  tx(s,'lead','组织互联、资源互通、经验互鉴，让校园“小盆景”成为区域“大风景”。',M,119,1120,30,20,C.deep,{bold:true});
  const frame=box(s,'network-frame',M,190,1160,342,C.pale2,0,C.line);
  const overall=box(s,'network-overall',M+30,224,520,242,C.white,12,C.line);
  tx(s,'overall-title','整体共学联建',M+54,252,472,30,23,C.primary,{bold:true,align:'center',valign:'middle'});
  tx(s,'overall-scale','41 家单位  ·  2000 余人次/年',M+54,306,472,36,30,C.ink,{bold:true,align:'center',valign:'middle'});
  tx(s,'overall-copy','VR 党课共享 · 主题党日联办\n红色资源联用 · 志愿服务联动',M+54,376,472,62,19,C.ink,{lineSpacing:1.2,align:'center',valign:'middle'});
  const mutual=box(s,'network-mutual',685,224,495,242,C.white,12,C.line);
  tx(s,'mutual-title','东北 ↔ 西部双向互学',709,244,447,30,23,C.primary,{bold:true,align:'center',valign:'middle'});
  const north=box(s,'north-node',724,310,175,62,C.pale,12,C.line);
  const west=box(s,'west-node',966,310,175,62,C.pale,12,C.line);
  tx(s,'north-label','辽宁合作网络',739,329,145,24,18,C.ink,{bold:true,align:'center',valign:'middle'});
  tx(s,'west-label','西部三校联学',981,329,145,24,18,C.ink,{bold:true,align:'center',valign:'middle'});
  arrow(s,north,west,{fromSide:'right',toSide:'left',color:C.primary,width:2});
  arrow(s,west,north,{fromSide:'left',toSide:'right',color:C.primary,width:2});
  tx(s,'mutual-copy','东北故事西部讲\n西部经验东北学',748,399,370,48,18,C.ink,{lineSpacing:1.15,align:'center',valign:'middle'});
  tx(s,'net-note','整体合作提供规模，东西互学提供方向；两种关系各自清楚。',M,560,1120,32,21,C.deep,{bold:true});
  notes(s,'原稿依据：红色朋友圈。41家单位与2000余人次/年归属于整体共学联建；西部三校只作为互学合作方，两端用地区/合作方节点与双向箭头表达。');
}

function slide9(p) {
  const s=p.slides.add(); pageChrome(s,'四阶培养链，把红色育人嵌入成长全周期');
  tx(s,'lead','红色实践进入学分与组织生活，靠四阶链条和红色导师年年有人抓、届届有人传。',M,119,1120,30,20,C.deep,{bold:true});
  const stages=[['入学','认识辽宁'],['入党','走进六地'],['转正','承担任务'],['毕业','扎根振兴']];
  const nodes=[];
  stages.forEach((a,i)=>{
    const x=M+i*290; const n=box(s,'stage-'+i,x,252,220,132,i===3?C.deep:C.pale,18,i===3?'none':C.line);
    tx(s,'stage-'+i+'-num','0'+(i+1),x+18,268,184,28,18,i===3?'#DDE8F4':C.primary,{bold:true,align:'center',valign:'middle'});
    tx(s,'stage-'+i+'-title',a[0],x+22,307,176,32,25,i===3?C.white:C.ink,{bold:true,align:'center',valign:'middle'});
    tx(s,'stage-'+i+'-label',a[1],x+22,349,176,24,17,i===3?'#DDE8F4':C.primary,{align:'center',valign:'middle'});
    nodes.push(n);
  });
  for(let i=0;i<3;i++) arrow(s,nodes[i],nodes[i+1],{fromSide:'right',toSide:'left',color:C.mid,width:3});
  box(s,'stage-support',M,455,1160,94,C.pale2,12,C.line);
  tx(s,'stage-support-title','跨阶段支撑',M+24,476,170,26,20,C.primary,{bold:true});
  tx(s,'stage-support-copy','红色实践计入学分   ·   VR 党课写进“三会一课”   ·   聘请 36 位纪念馆专家、抗美援朝老战士担任“红色导师”',M+218,477,890,46,18,C.ink,{valign:'middle'});
  tx(s,'stage-note','机制的作用，是让一次活动变成可持续的成长路径。',M,590,1120,24,19,C.deep,{bold:true});
  notes(s,'原稿依据：红色育人机制。四阶段是明确顺序；学分、三会一课、36位导师是跨阶段支撑。');
}

function slide10(p) {
  const s=p.slides.add(); pageChrome(s,'五年深耕，理工学生有了“红色先锋”新标签');
  tx(s,'lead','五类抓手最终汇到四类青年变化；先看最直接的信仰变化，再看本领、声音与脚步。',M,119,1120,30,20,C.deep,{bold:true});
  const main=box(s,'result-main',M,198,650,342,C.deep,14,'none');
  tx(s,'result-main-title','信仰更强',M+42,255,566,34,26,'#DDE8F4',{bold:true,align:'center',valign:'middle'});
  tx(s,'result-main-num','58% → 87%',M+42,315,566,82,52,C.white,{bold:true,align:'center',valign:'middle'});
  tx(s,'result-main-copy','发展对象答辩现场\n“毕业后留辽意愿”举手率',M+42,429,566,54,21,'#E0EBF7',{lineSpacing:1.2,align:'center',valign:'middle'});
  const support=box(s,'result-support',755,198,460,342,C.pale2,0,C.line);
  tx(s,'result-support-title','其余成效作为支持证据',779,222,412,28,21,C.primary,{bold:true,align:'center',valign:'middle'});
  rule(s,'support-rule-1',779,268,412,C.line,1);
  tx(s,'support-1','本领更硬',779,287,120,24,19,C.primary,{bold:true});
  tx(s,'support-1-copy','26 份振兴微课题 · 8 家企业当场“收货”',915,287,276,48,17,C.ink,{lineSpacing:1.12});
  rule(s,'support-rule-2',779,353,412,C.line,1);
  tx(s,'support-2','声音更响',779,372,120,24,19,C.primary,{bold:true});
  tx(s,'support-2-copy','理论飞出校园，进入社区、课堂与生产一线',915,372,276,48,17,C.ink,{lineSpacing:1.12});
  rule(s,'support-rule-3',779,438,412,C.line,1);
  tx(s,'support-3','脚步更稳',779,457,120,24,19,C.primary,{bold:true});
  tx(s,'support-3-copy','党员考取辽宁选调生、投身重大装备研发比例提升 40%',915,457,276,58,17,C.ink,{lineSpacing:1.12});
  tx(s,'result-note','从“学霸”到“红色先锋”：把论文写在大地，把青春植根黑土。',M,570,1120,32,22,C.deep,{bold:true});
  notes(s,'原稿依据：五年成效。58%→87%为主证据；26份与8家单独标注；声音更响保留文字结果；40%保留完整指标，不把26/8写成比值。');
}

function slide11(p) {
  const s=p.slides.add(); s.background.fill=C.primary;
  box(s,'close-band',0,0,W,14,C.deep,0,'none');
  tx(s,'close-kicker','收束',M,70,250,24,18,'#DDE8F4',{bold:true});
  tx(s,'close-title','六地红，成为青年投身振兴的青春底色',M,126,1030,72,42,C.white,{bold:true,lineSpacing:1});
  rule(s,'close-rule',M,220,280,C.white,4);
  tx(s,'close-quote','“要讲好党的故事、革命的故事、英雄的故事，\n把红色基因传承下去，确保红色江山后继有人、代代相传。”',M,274,920,90,24,C.white,{lineSpacing:1.25});
  tx(s,'close-attrib','——习近平总书记关于用好红色资源的重要嘱托',M,380,720,24,17,'#DDE8F4');
  const strip=box(s,'close-strip',M,458,1160,104,'#3E6FA5',14,'none');
  tx(s,'close-strip-copy','研学链贯通红色血脉  ·  任务单激发实干担当  ·  VR 基地跨越时空  ·  宣讲团传递信仰  ·  育人机制夯实成长',M+25,488,1110,48,18,C.white,{align:'center',valign:'middle'});
  tx(s,'close-final','将“听党话、跟党走”的坚定信念，熔铸进每一段青春年轮。',M,610,1120,34,22,C.white,{bold:true});
  tx(s,'close-page','11',1180,660,45,18,14,'#DDE8F4',{align:'right'});
  notes(s,'收束：回到中心判断，引用与五类抓手降级为支持，结束于青年投身振兴的行动指向。');
}

async function main() {
  const p=Presentation.create({slideSize:{width:W,height:H}});
  slide1(p); slide2(p); slide3(p); slide4(p); slide5(p); slide6(p); slide7(p); slide8(p); slide9(p); slide10(p); slide11(p);
  for (let i=0;i<p.slides.items.length;i++) {
    const s=p.slides.items[i];
    const layout=await s.export({format:'layout'});
    await fs.writeFile(`${OUT}/slide-${i+1}.layout.json`, await layout.text());
  }
  const pptx=await PresentationFile.exportPptx(p);
  await pptx.save(`${OUT}/deck.pptx`);
  const inspect=await p.inspect({kind:'slide,textbox,shape',maxChars:10000});
  await fs.writeFile(`${OUT}/inspect.ndjson`, inspect.ndjson || String(inspect));
}
main().catch((e)=>{ console.error(e); process.exitCode=1; });
