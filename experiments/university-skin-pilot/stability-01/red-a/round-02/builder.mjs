import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/university-skin-pilot/stability-01/red-a/round-02";
const W = 1280;
const H = 720;
const FONT = "Microsoft YaHei";
const C = {
  primary: "#315F91",
  ink: "#252B33",
  muted: "#707780",
  bg: "#FFFFFF",
  pale: "#F2F6FA",
  pale2: "#E6EEF6",
  line: "#C9D6E3",
  deep: "#21456B",
};

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function addBox(slide, name, x, y, w, h, fill = C.bg, line = C.line, radius = "rounded-lg") {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line || "none", width: line ? 1 : 0 },
    ...(radius ? { borderRadius: radius } : {}),
  });
}

function addText(slide, name, text, x, y, w, h, size = 18, color = C.ink, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontSize: size,
    color,
    fontFamily: FONT,
    bold: !!opts.bold,
    alignment: opts.align || "left",
    verticalAlignment: opts.valign || "middle",
    ...(opts.italic ? { italic: true } : {}),
  };
  return shape;
}

function addRule(slide, name, x, y, w, color = C.primary, width = 3) {
  return slide.shapes.add({
    geometry: "rect",
    name,
    position: { left: x, top: y, width: w, height: width },
    fill: color,
    line: { style: "solid", fill: color, width: 0 },
  });
}

function chrome(slide, title, kicker = "辽宁“六地”红色文化标识融入党员教育") {
  slide.background.fill = C.bg;
  addText(slide, "kicker", kicker, 55, 22, 500, 24, 14, C.muted, { bold: true });
  addRule(slide, "title-rule", 55, 120, 1170, C.primary, 2);
  addText(slide, "slide-title", title, 55, 68, 1170, 52, 32, C.ink, { bold: true });
  addText(slide, "page-mark", String(slide.index + 1).padStart(2, "0"), 1168, 26, 55, 24, 14, C.muted, { align: "right", bold: true });
  addText(slide, "footer", "来源：案例《让“六地”红，成为理工青年最鲜亮的青春底色》｜数据据来稿", 55, 680, 1050, 26, 12, C.muted);
}

function notes(slide) {
  slide.speakerNotes.textFrame.setText(["[Sources]", "- 分配原稿：red.txt（本页全部事实与表述依据）"]);
  slide.speakerNotes.setVisible(true);
}

function node(slide, name, label, x, y, w, h, fill = C.primary, fs = 19) {
  const s = addBox(slide, name, x, y, w, h, fill, fill, "rounded-lg");
  // Keep the exported label frame inside the node's declared safe inset.
  addText(slide, `${name}-label`, label, x + 18, y + 14, w - 36, h - 28, fs, C.bg, { bold: true, align: "center", valign: "middle" });
  return s;
}

function arrow(slide, source, target, color = C.primary) {
  return slide.shapes.connect(source, target, {
    kind: "straight",
    fromSide: "right",
    toSide: "left",
    line: { style: "solid", fill: color, width: 3 },
    tail: { type: "triangle", width: "med", length: "med" },
  });
}

function addMetric(slide, x, y, value, label, sub = "") {
  addText(slide, `metric-value-${x}-${y}`, value, x, y, 180, 44, 34, C.primary, { bold: true });
  addText(slide, `metric-label-${x}-${y}`, label, x, y + 43, 190, 48, 18, C.ink, { bold: true });
  if (sub) addText(slide, `metric-sub-${x}-${y}`, sub, x, y + 91, 210, 30, 16, C.muted);
}

function slideTitleOnly(p, title) {
  const s = p.slides.add();
  chrome(s, title);
  notes(s);
  return s;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const p = Presentation.create({ slideSize: { width: W, height: H } });

  // 1. Cover
  {
    const s = p.slides.add();
    s.background.fill = C.primary;
    addRule(s, "cover-accent", 70, 90, 120, "#FFFFFF", 6);
    addText(s, "cover-kicker", "创新案例分享｜党员教育", "70", 116, 470, 30, 18, "#DDE9F4", { bold: true });
    addText(s, "cover-title", "让“六地”红，成为\n理工青年最鲜亮的青春底色", 70, 175, 760, 170, 42, C.bg, { bold: true });
    addText(s, "cover-subtitle", "辽宁“六地”红色文化标识融入党员教育的创新实践", 74, 366, 760, 40, 20, "#E8F0F7");
    addBox(s, "cover-quote", 830, 176, 330, 280, "#21456B", "#6E91B2", "rounded-xl");
    addText(s, "cover-quote-text", "让辽宁故事\n成为离理工青年\n最近、最燃、最硬核的\n党员教育现场", 860, 215, 270, 170, 22, C.bg, { bold: true, valign: "middle" });
    addText(s, "cover-bottom", "十年探路｜五年深耕｜从校园“小盆景”到区域“大风景”", 70, 618, 820, 28, 15, "#DDE9F4");
    addText(s, "cover-no", "01", 1150, 650, 60, 24, 14, "#DDE9F4", { align: "right", bold: true });
    notes(s);
  }

  // 2. Problem and thesis
  {
    const s = slideTitleOnly(p, "理工学生的优势很突出，党员教育的情感转化仍要补上");
    addText(s, "problem-lead", "十年前，学院党委面对的是一组并存矛盾：能力优势没有自动转化为身份认同与行动担当。", 55, 128, 1050, 34, 20, C.ink);
    const highZone = addBox(s, "high-zone", 55, 195, 385, 255, C.pale, C.line, "rounded-xl");
    addText(s, "high-title", "三高", 86, 225, 120, 58, 42, C.primary, { bold: true });
    addText(s, "high-body", "高学分\n高竞赛\n高科研", 88, 296, 260, 118, 26, C.ink, { bold: true });
    const lowZone = addBox(s, "low-zone", 840, 195, 385, 255, "#F7F8F9", C.line, "rounded-xl");
    addText(s, "low-title", "三低", 872, 225, 120, 58, 42, C.deep, { bold: true });
    addText(s, "low-body", "理论情感浓度低\n身份认同声量低\n知行合一燃值低", 872, 296, 290, 118, 24, C.ink, { bold: true });
    const coexist = addBox(s, "coexist-zone", 480, 248, 290, 160, C.pale2, C.line, "rounded-xl");
    addText(s, "coexist-head", "并存矛盾", 520, 275, 210, 48, 30, C.primary, { bold: true, align: "center" });
    addText(s, "coexist-note", "能力优势与情感转化\n需要党建实践承接", 520, 335, 210, 55, 19, C.ink, { align: "center" });
    s.shapes.connect(highZone, coexist, { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.primary, width: 2 } });
    s.shapes.connect(lowZone, coexist, { kind: "straight", fromSide: "left", toSide: "right", line: { style: "solid", fill: C.primary, width: 2 } });
    addText(s, "bridge-note", "红色梦想实践团走遍全国九省，形成“理论＋实践”立体化红色矩阵", 466, 418, 320, 46, 17, C.muted, { align: "center" });
    addRule(s, "bottom-rule", 55, 500, 1170, C.primary, 2);
    addText(s, "thesis", "今天的选择：把“走遍全国”进一步收束为“深耕辽宁”，让六块红色标识成为离青年最近的教育现场。", 55, 530, 1140, 74, 24, C.primary, { bold: true });
  }

  // 3. 1+3+N architecture
  {
    const s = slideTitleOnly(p, "新矩阵把一条红色研学链，接入三类课堂与 N 个真实场景");
    addText(s, "arch-lead", "双轮驱动：深挖“六地”文化内涵 + 实践研学赋能，重塑“五位一体”红色育人生态。", 55, 127, 1100, 32, 19, C.ink);
    const matrix = addBox(s, "matrix-zone", 55, 185, 560, 405, C.pale, C.line, "rounded-xl");
    addText(s, "matrix-head", "1 + 3 + N 新矩阵", 90, 215, 420, 50, 30, C.primary, { bold: true });
    addRule(s, "matrix-rule-1", 90, 286, 480, C.line, 1);
    addText(s, "matrix-one", "1 条研学链", 90, 306, 190, 34, 23, C.ink, { bold: true });
    addText(s, "matrix-one-detail", "对接 22 处“六地”示范教学点", 300, 308, 270, 30, 18, C.muted);
    addRule(s, "matrix-rule-2", 90, 360, 480, C.line, 1);
    addText(s, "matrix-three", "3 类青春课堂", 90, 380, 210, 34, 23, C.ink, { bold: true });
    addText(s, "matrix-three-detail", "行走 / 沉浸(VR) / 互动", 300, 382, 270, 30, 18, C.muted);
    addRule(s, "matrix-rule-3", 90, 434, 480, C.line, 1);
    addText(s, "matrix-n", "N 个教育场景", 90, 454, 210, 34, 23, C.ink, { bold: true });
    addText(s, "matrix-n-detail", "校地 · 校企 · 校校联建", 300, 456, 270, 30, 18, C.muted);
    const ecosystem = addBox(s, "ecosystem-zone", 675, 185, 550, 405, "#F7F8F9", C.line, "rounded-xl");
    addRule(s, "ecosystem-accent", 710, 226, 5, C.primary, 250);
    addText(s, "ecosystem-head", "双轮驱动", 750, 226, 360, 44, 26, C.primary, { bold: true });
    addText(s, "ecosystem-body", "深挖“六地”文化内涵\n实践研学赋能", 750, 292, 360, 110, 24, C.ink, { bold: true });
    addText(s, "ecosystem-result", "五位一体\n红色育人生态", 750, 442, 360, 92, 30, C.primary, { bold: true });
    s.shapes.connect(matrix, ecosystem, { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.primary, width: 3 }, tail: { type: "triangle", width: "med", length: "med" } });
  }

  // 4. Route sequence (reference recompose)
  {
    const s = slideTitleOnly(p, "研学路线先立根基，再穿行六地，最后把现场扩展到 N 个教学点");
    addText(s, "route-lead", "“红色足迹地图”组织 22 处示范教学点，路线由校本基地、六地文化身份与配套教学点共同构成。", 55, 127, 1100, 32, 19, C.ink);
    const routeStart = node(s, "route-1", "1\n校史馆", 90, 315, 190, 92, C.primary, 21);
    const routeCluster = addBox(s, "route-cluster", 355, 205, 560, 315, C.pale, C.line, "rounded-xl");
    addText(s, "route-cluster-title", "6 处核心“六地”场馆", 395, 226, 460, 40, 25, C.primary, { bold: true, align: "center" });
    const identities = ["抗日战争起始地", "解放战争转折地", "新中国国歌素材地", "抗美援朝出征地", "共和国工业奠基地", "雷锋精神发祥地"];
    const idNodes=[];
    for(let i=0;i<6;i++){
      const x=395+(i%2)*250, y=292+Math.floor(i/2)*68;
      idNodes.push(node(s,`route-id-${i+1}`,identities[i],x,y,220,64,i%2===0?C.deep:C.primary,16));
    }
    const routeEnd = node(s, "route-5", "N\n配套教学点", 990, 315, 180, 92, C.primary, 19);
    s.shapes.connect(routeStart, routeCluster, { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.primary, width: 3 }, tail: { type: "triangle", width: "med", length: "med" } });
    s.shapes.connect(routeCluster, routeEnd, { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.primary, width: 3 }, tail: { type: "triangle", width: "med", length: "med" } });
    addText(s, "route-cap-1", "路线入口", 90, 430, 190, 28, 17, C.muted, { align: "center" });
    addText(s, "route-cap-2", "六个文化身份共同构成核心场馆层", 395, 525, 480, 28, 17, C.muted, { align: "center" });
    addText(s, "route-cap-3", "N 个配套教学点", 990, 430, 180, 28, 17, C.muted, { align: "center" });
    addText(s, "route-foot", "研学链口径：1 + 6 + N；整体矩阵口径：1 + 3 + N。", 55, 570, 1170, 40, 20, C.primary, { bold: true });
  }

  // 5. Five practice handles overview
  {
    const s = slideTitleOnly(p, "五类实践抓手，把红色教育从“听过”推进到“做过、共享、长效”");
    addText(s, "handles-lead", "每个抓手承担一个具体转化任务，共同支撑“红色先锋”的成长结果。", 55, 127, 900, 32, 19, C.ink);
    const supportCore = node(s,"handle-core","五类抓手\n共同支撑",505,205,270,100,C.primary,22);
    addBox(s, "handle-bg", 55, 355, 1170, 205, C.pale, "none", "rounded-xl");
    const xs = [92, 300, 508, 716, 924];
    const labels = ["红色任务单", "VR 示范基地", "青春有理", "红色朋友圈", "红色育人机制"];
    const subs = ["把任务做实", "把现场做深", "把理论讲活", "把资源共享", "把培养做长"];
    const nodes = [];
    for (let i = 0; i < 5; i++) {
      nodes.push(node(s, `handle-${i + 1}`, labels[i], xs[i], 400, 180, 70, i === 4 ? C.deep : C.primary, 18));
      addText(s, `handle-sub-${i + 1}`, subs[i], xs[i], 488, 180, 30, 16, C.muted, { align: "center" });
      s.shapes.connect(nodes[i], supportCore, { kind: "straight", fromSide: "top", toSide: "bottom", line: { style: "solid", fill: C.primary, width: 2 } });
    }
    addText(s, "handle-note", "任务、场景、表达、协同与机制，共同支撑红色育人生态。", 55, 600, 1170, 34, 20, C.primary, { bold: true });
  }

  // 6. Task sheet
  {
    const s = slideTitleOnly(p, "一张“红色任务单”，让学生在专业问题里读懂振兴担当");
    addText(s, "task-lead", "任务单不是打卡清单，而是“三摆三写”的军令状：把自己、工作、职责都放进地方问题。", 55, 127, 1130, 34, 19, C.ink);
    addBox(s, "task-main", 55, 190, 500, 390, C.pale, C.line, "rounded-xl");
    addText(s, "task-title", "三摆三写", 90, 220, 250, 50, 32, C.primary, { bold: true });
    addText(s, "task-caption", "对应关系：把对象摆进去，再写对应答卷", 90, 270, 390, 28, 17, C.muted);
    const t1 = node(s, "task-1", "把自己摆进去", 90, 330, 190, 64, C.primary, 19);
    const t2 = node(s, "task-2", "把工作摆进去", 90, 420, 190, 64, C.deep, 19);
    const t3 = node(s, "task-3", "把职责摆进去", 90, 510, 190, 64, C.primary, 19);
    const tw1 = node(s, "task-write-1", "写青春誓言", 325, 330, 180, 64, C.deep, 19);
    const tw2 = node(s, "task-write-2", "写专业方案", 325, 420, 180, 64, C.primary, 19);
    const tw3 = node(s, "task-write-3", "写振兴答卷", 325, 510, 180, 64, C.deep, 19);
    for (const [a,b] of [[t1,tw1],[t2,tw2],[t3,tw3]]) s.shapes.connect(a,b,{kind:"straight",fromSide:"right",toSide:"left",line:{style:"solid",fill:C.primary,width:2}});
    addBox(s, "task-evidence", 590, 190, 635, 390, "#F7F8F9", C.line, "rounded-xl");
    addText(s, "task-evidence-title", "五年沉淀：26 项微课题被“揭榜挂帅”", 625, 220, 560, 44, 24, C.ink, { bold: true });
    addText(s, "task-actions", "拍一段“青声说史”短视频\n解决一个场馆或教学点“微难题”\n带回一个“振兴微课题”", 625, 292, 510, 120, 21, C.primary, { bold: true });
    addRule(s, "task-sep", 625, 437, 520, C.primary, 2);
    addText(s, "task-examples", "抗美援朝纪念馆：升级“声景”展项\n抚顺雷锋纪念馆：解决“志愿时间银行”互认\n专业调研：形成场馆沉浸式讲解词年轻化报告", 625, 462, 550, 94, 17, C.ink);
  }

  // 7. VR base
  {
    const s = slideTitleOnly(p, "VR 示范基地把 22 处旧址做成“一屏百年”的沉浸课堂");
    addText(s, "vr-lead", "重走总书记辽宁考察路线与六地经典路线，把红色现场采集为全景数据，再开发为可预约的党员教育产品。", 55, 127, 1120, 36, 19, C.ink);
    addBox(s, "vr-evidence", 55, 196, 800, 350, C.pale, C.line, "rounded-xl");
    const vr1=node(s,"vr-node-1","22 处旧址\n全景数据",115,286,260,120,C.primary,27);
    const vr2=node(s,"vr-node-2","7 门\n红色 VR 党课",500,286,260,120,C.deep,25);
    arrow(s,vr1,vr2);
    addText(s,"vr-meaning","采集红色现场 → 形成沉浸课程",185,440,500,30,19,C.primary,{bold:true,align:"center"});
    addBox(s, "vr-facts", 900, 196, 325, 350, "#F7F8F9", C.line, "rounded-xl");
    addText(s,"vr-use-head","实际使用",930,226,240,32,23,C.primary,{bold:true});
    addText(s,"vr-use","170 个省内外支部\n2400 余名党员预约体验",930,282,255,78,22,C.ink,{bold:true});
    addRule(s,"vr-use-rule",930,386,240,C.primary,2);
    addText(s,"vr-awards","获评辽宁省党员教育培训示范基地\n相关案例获省高校基层党建创新一等奖",930,414,260,86,17,C.muted);
    addText(s, "vr-proof", "建设获中组部组织二局、教育部教师工作司负责同志充分肯定。", 55, 590, 1170, 46, 19, C.primary, { bold: true });
  }

  // 8. Youth speaking
  {
    const s = slideTitleOnly(p, "“青春有理”用青年语态重构理论传播，让青年讲、青年听、青年信");
    addText(s, "speak-lead", "博士、硕士、本科生组成 32 人混编梯队，把“六地”精神改写成互动课堂。", 55, 127, 1100, 34, 19, C.ink);
    addBox(s, "speak-path", 55, 194, 1170, 195, C.pale, "none", "rounded-xl");
    const s1=node(s,"speak-1","32 人\n混编梯队",108,246,180,88,C.primary,21);
    const s2=node(s,"speak-2","10 类\n互动课件",395,246,180,88,C.deep,21);
    const s3=node(s,"speak-3","36 场\n宣讲",682,246,210,88,C.primary,21);
    const s4=node(s,"speak-4","3800+\n覆盖",1000,246,170,88,C.deep,21);
    arrow(s,s1,s2); arrow(s,s2,s3); arrow(s,s3,s4);
    addBox(s, "speak-detail", 55, 430, 1170, 135, "#F7F8F9", C.line, "rounded-xl");
    addText(s, "speak-detail-text", "沉浸式故事 · 情景短剧 · 红色闯关\n进校园、社区、企业。", 90, 458, 1050, 72, 22, C.ink, { bold: true });
    addText(s, "speak-award", "获评：辽宁省大学生红色理论宣讲团", 55, 606, 700, 34, 19, C.primary, { bold: true });
  }

  // 9. Shared network
  {
    const s = slideTitleOnly(p, "“红色朋友圈”把一地实践变成多方共学的共享循环");
    addText(s, "network-lead", "组织互联、资源互通、经验互鉴，形成“东北故事西部讲、西部经验东北学”的双向共享。", 55, 127, 1100, 34, 19, C.ink);
    addBox(s, "network-bg", 55, 190, 1170, 380, C.pale, C.line, "rounded-xl");
    const center = node(s, "network-center", "共享的党课", 470, 220, 340, 110, C.primary, 28);
    const n1=node(s,"network-left","东北合作网络\n41 家单位",90,365,260,92,C.deep,20);
    const n2=node(s,"network-right","西部合作网络\n“六地精神西部行”",930,365,260,92,C.deep,18);
    s.shapes.connect(n1, n2, { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: C.primary, width: 3 }, head: { type: "triangle", width: "med", length: "med" }, tail: { type: "triangle", width: "med", length: "med" } });
    s.shapes.connect(center, n1, { kind: "elbow", fromSide: "bottom", toSide: "top", line: { style: "solid", fill: C.primary, width: 2 } });
    s.shapes.connect(center, n2, { kind: "elbow", fromSide: "bottom", toSide: "top", line: { style: "solid", fill: C.primary, width: 2 } });
    addText(s, "network-center-s", "VR 共享 · 主题党日联办 · 资源联用 · 志愿联动", 350, 333, 580, 30, 17, C.primary, { align: "center" });
    addText(s, "network-west-detail", "新疆农业大学 · 西北师范大学 · 兰州工业学院", 865, 478, 330, 28, 16, C.muted, { align: "center" });
    addText(s, "network-exchange", "一年互派党员 2000 余人次", 85, 505, 300, 28, 18, C.primary, { bold: true });
    addText(s, "network-foot", "共享循环的方向：东北故事西部讲，也把西部经验带回东北。", 55, 620, 1170, 34, 20, C.primary, { bold: true });
  }

  // 10. Mechanism
  {
    const s = slideTitleOnly(p, "红色育人机制把教育嵌入党员成长全周期，确保年年有人抓、届届有人传");
    addText(s, "mech-lead", "把红色实践计入学分、把 VR 党课写进“三会一课”，让一次活动沉淀为持续培养链。", 55, 127, 1100, 34, 19, C.ink);
    addBox(s, "mech-bg", 55, 202, 1170, 275, C.pale, "none", "rounded-xl");
    addRule(s, "mech-track", 125, 330, 1010, C.pale2, 10);
    const ms=[]; const mx=[115,370,625,880]; const ml=["入学","入党","转正","毕业"];
    for(let i=0;i<4;i++){
      ms.push(node(s,`mech-${i+1}`,ml[i],mx[i],286,170,88,i===3?C.deep:C.primary,22));
      addText(s,`mech-sub-${i+1}`,i===0?"建立红色认知":i===1?"进入培养主线":i===2?"接受实践检验":"带着信仰走向岗位",mx[i]-12,399,195,42,17,C.muted,{align:"center"});
      if(i>0) arrow(s,ms[i-1],ms[i]);
    }
    addBox(s,"mech-mentor",55,520,1170,100,"#F7F8F9",C.line,"rounded-xl");
    addText(s,"mech-mentor-t","36 位纪念馆专家、抗美援朝老战士担任“红色导师”",90,548,690,38,22,C.ink,{bold:true});
    addText(s,"mech-mentor-s","红色育人进入制度、课堂与成长节点",845,548,315,38,18,C.primary,{bold:true,align:"right"});
  }

  // 11. Outcomes
  {
    const s = slideTitleOnly(p, "五年深耕后，学生党员获得了“红色先锋”的新标签");
    addText(s, "outcome-lead", "四类变化共同指向“红色先锋”，其中最直接的变化是毕业后留辽意愿。", 55, 127, 1100, 34, 19, C.ink);
    addBox(s,"outcome-main",55,190,500,390,C.pale,C.line,"rounded-xl");
    addText(s,"outcome-main-kicker","信仰更强",90,225,180,35,23,C.primary,{bold:true});
    addText(s,"outcome-main-value","58% → 87%",90,285,420,80,52,C.primary,{bold:true});
    addText(s,"outcome-main-label","答辩现场举手率",92,383,350,36,24,C.ink,{bold:true});
    addText(s,"outcome-main-sub","毕业后留辽意愿\n“我的青春也要从这里鸣枪”",92,442,370,76,20,C.muted);
    const rows=[
      ["本领更硬","26 份振兴微课题；8 家企业收货","公式进高炉、代码进小区、图纸进车间"],
      ["声音更响","36 场宣讲；覆盖师生群众 3800+","进入校园、社区、企业"],
      ["脚步更稳","党员考取辽宁选调生、投身重大装备研发比例提升 40%","据来稿，未补充基线"],
    ];
    rows.forEach((r,i)=>{
      const y=190+i*130;
      addBox(s,`outcome-row-${i}`,610,y,615,106,i%2===0?"#F7F8F9":C.pale,"none","rounded-lg");
      addText(s,`outcome-head-${i}`,r[0],640,y+17,130,30,21,C.primary,{bold:true});
      addText(s,`outcome-label-${i}`,r[1],790,y+14,400,52,18,C.ink,{bold:true});
      addText(s,`outcome-sub-${i}`,r[2],790,y+70,400,26,16,C.muted);
    });
    addText(s,"outcome-foot","学生党员把所学写进振兴辽宁的下一行代码。",610,590,615,34,20,C.primary,{bold:true});
  }

  // 12. Close
  {
    const s = p.slides.add();
    s.background.fill = C.primary;
    addText(s,"close-kicker","收束｜把红色基因传承下去",70,70,500,30,18,"#DDE9F4",{bold:true});
    addText(s,"close-title","五类实践，\n共同托起青年成长",70,150,560,150,40,C.bg,{bold:true});
    addText(s,"close-list","研学链 · 任务单 · VR 基地\n宣讲团 · 育人机制",72,340,520,66,22,"#E8F0F7");
    addRule(s,"close-rule",690,140,4, "#AFC8DE", 360);
    addText(s,"close-quote","“红色江山来之不易，守好江山责任重大。”",760,170,400,60,25,C.bg,{bold:true});
    addText(s,"close-attrib","——习近平总书记（引自本案例原稿）",760,232,400,28,16,"#DDE9F4");
    addText(s,"close-body","十年探路，五年深耕。\n让坚定信念熔铸进学生生涯的每一段青春年轮。",760,300,390,108,22,"#E8F0F7");
    addText(s,"close-final","“六地”红，成为理工青年投身东北全面振兴的鲜亮底色。",760,480,390,82,24,C.bg,{bold:true});
    addText(s,"close-thanks","我的汇报完毕，谢谢大家！",70,635,480,28,18,"#DDE9F4",{bold:true});
    addText(s,"close-no","12",1150,650,60,24,14,"#DDE9F4",{align:"right",bold:true});
    notes(s);
  }

  // Export deterministic artifacts.
  for (const [i, slide] of p.slides.items.entries()) {
    const stem = `slide-${i + 1}`;
    await writeBlob(`${OUT}/${stem}.png`, await p.export({ slide, format: "png", scale: 1 }));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(`${OUT}/${stem}.layout.json`, await layout.text());
  }
  const pptx = await PresentationFile.exportPptx(p);
  await pptx.save(`${OUT}/deck.pptx`);
}

function slideShapes(slide, x, y, w, h, fill) {
  return addBox(slide, "bridge-box", x, y, w, h, fill, fill, "rounded-lg");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
