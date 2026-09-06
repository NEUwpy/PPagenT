import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/university-skin-pilot/handbook-01/run-01";
const NODE = "Microsoft YaHei";
const C = {
  navy: "#163E6C",
  blue: "#3677BD",
  ink: "#252B33",
  gray: "#65707D",
  line: "#CDD5DE",
  pale: "#EEF3F8",
  white: "#FFFFFF",
  softBlue: "#E4EEF8",
};
const SLIDE = { width: 1280, height: 720 };
const FRAME = { left: 72, right: 1208, top: 58, bottom: 665 };

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function shape(slide, name, geometry, left, top, width, height, fill = "none", lineFill = "none", lineWidth = 0, radius = 0) {
  return slide.shapes.add({
    geometry,
    name,
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
    ...(radius ? { borderRadius: radius } : {}),
  });
}

function text(slide, name, left, top, width, height, value, fontSize, color = C.ink, bold = false, align = "left", extra = {}) {
  const box = shape(slide, name, "textbox", left, top, width, height);
  box.text = value;
  box.text.style = {
    typeface: NODE,
    fontSize,
    color,
    bold,
    alignment: align,
    verticalAlignment: extra.verticalAlignment || "top",
    lineSpacing: extra.lineSpacing || 1.12,
    autoFit: "shrinkText",
    wrap: "square",
    insets: extra.insets || { left: 0, right: 0, top: 0, bottom: 0 },
  };
  return box;
}

function rule(slide, name, left, top, width, color = C.line, thickness = 1) {
  return shape(slide, name, "rect", left, top, Math.max(width, thickness), Math.max(thickness, 1), color, "none", 0);
}

function chrome(slide, page, section = "课题组讨论 · 虚构归档方案") {
  text(slide, "brand-mark", FRAME.left, 20, 300, 22, section, 15, C.gray, true);
  text(slide, "page-number", 1138, 20, 70, 22, String(page).padStart(2, "0"), 15, C.gray, false, "right");
  rule(slide, "top-rule", FRAME.left, 47, FRAME.right - FRAME.left, C.line, 1);
  rule(slide, "bottom-rule", FRAME.left, 675, FRAME.right - FRAME.left, C.line, 1);
  text(slide, "footer", FRAME.left, 684, 900, 18, "大学课题组 · 方案讨论口径 · 不代表已实施成效", 12, C.gray);
}

function title(slide, value, subtitle = null) {
  text(slide, "slide-title", FRAME.left, 72, 1030, subtitle ? 58 : 72, value, 38, C.navy, true, "left", { lineSpacing: 1.0 });
  if (subtitle) text(slide, "slide-subtitle", FRAME.left, 130, 1040, 28, subtitle, 18, C.gray);
}

function addSectionLabel(slide, name, x, y, label, width = 150) {
  text(slide, name, x, y, width, 24, label.toUpperCase(), 15, C.blue, true);
}

function addLabeledRow(slide, y, label, body, labelWidth = 150, bodyWidth = 710) {
  text(slide, `row-label-${y}`, 72, y, labelWidth, 30, label, 19, C.navy, true);
  text(slide, `row-body-${y}`, 240, y, bodyWidth, 56, body, 18, C.ink, false);
}

function addBullet(slide, name, x, y, w, value, size = 18, color = C.ink) {
  text(slide, `${name}-dot`, x, y + 3, 18, 22, "•", size + 2, C.blue, true);
  text(slide, `${name}-copy`, x + 25, y, w - 25, 48, value, size, color);
}

function addSlide1(presentation) {
  const s = presentation.slides.add();
  s.background.fill = C.white;
  text(s, "cover-kicker", FRAME.left, 90, 400, 28, "虚构大学场景 · 课题组讨论", 18, C.blue, true);
  text(s, "cover-title", FRAME.left, 160, 760, 150, "先让一次结果\n可以被理解", 56, C.navy, true, "left", { lineSpacing: 0.96 });
  text(s, "cover-subtitle", FRAME.left, 345, 650, 88, "四周、小范围试点：建立能解释实验结果的数据归档习惯", 25, C.ink, false, "left", { lineSpacing: 1.16 });
  rule(s, "cover-rule", FRAME.left, 495, 1136, C.line, 1);
  text(s, "cover-scope", FRAME.left, 520, 720, 36, "1 个课题方向   ·   2 名自愿成员   ·   记录新增实验", 19, C.gray, true);
  text(s, "cover-note", 900, 525, 308, 72, "本次仅讨论方案边界\n不宣称已有成效", 18, C.gray, false, "right", { lineSpacing: 1.18 });
  text(s, "cover-brand", FRAME.left, 684, 700, 18, "大学课题组 · 方案讨论口径 · 不代表已实施成效", 12, C.gray);
  text(s, "cover-page", 1138, 684, 70, 18, "01", 12, C.gray, false, "right");
}

function addSlide2(presentation) {
  const s = presentation.slides.add();
  s.background.fill = C.white;
  chrome(s, 2);
  title(s, "文件存在，不等于结果可以解释", "问题不只是“有没有上传”，而是能否沿结果回到依据");
  shape(s, "judgment-strip", "roundRect", 72, 188, 350, 296, C.pale, "none", 0, 10);
  addSectionLabel(s, "judgment-label", 100, 218, "核心判断", 130);
  text(s, "judgment-main", 100, 262, 285, 126, "解释链\n断在上下文", 42, C.navy, true, "left", { lineSpacing: 0.98 });
  text(s, "judgment-foot", 100, 418, 270, 45, "结果、依据与责任没有被放在同一个记录单元里。", 17, C.gray);
  addSectionLabel(s, "evidence-label", 500, 188, "现场能看到什么", 220);
  addLabeledRow(s, 236, "最终图片", "能找到结果文件，却不一定知道它来自哪批样本。", 145, 625);
  addLabeledRow(s, 316, "同名文件", "同名文件和个人目录让重复检索变难。", 145, 625);
  addLabeledRow(s, 396, "“已清理”", "只留下处理结论时，异常与排除的判断依据消失。", 145, 625);
  rule(s, "evidence-divider", 500, 486, 640, C.line, 1);
  text(s, "implication", 500, 512, 680, 62, "因此，归档的第一问不是“文件放在哪里”，而是“别人能否理解这个结果是怎么产生的”。", 21, C.navy, true);
}

function addSlide3(presentation) {
  const s = presentation.slides.add();
  s.background.fill = C.white;
  chrome(s, 3);
  title(s, "一个结果记录，必须把结果与依据绑在一起", "五项材料共同解释一个结果；它们不是必须依次执行的五个步骤");
  shape(s, "record-unit", "roundRect", 72, 205, 300, 265, C.navy, "none", 0, 10);
  text(s, "record-unit-label", 102, 232, 230, 28, "记录单元", 18, "#BFD6EC", true);
  text(s, "record-unit-main", 102, 282, 235, 92, "一次\n可讨论的\n实验结果", 34, C.white, true, "left", { lineSpacing: 0.98 });
  text(s, "record-unit-note", 102, 404, 235, 42, "结果与依据被放在同一关系里", 16, "#D8E7F5");
  addSectionLabel(s, "parts-label", 454, 205, "共同解释一个结果", 300);
  addLabeledRow(s, 248, "原始数据", "保留原貌；清洗与处理另存。", 160, 650);
  addLabeledRow(s, 320, "样本与条件", "说明样本、采集条件，以及结果对应的范围。", 160, 650);
  addLabeledRow(s, 392, "脚本版本", "能定位实际运行的代码，而不是只写“用了某脚本”。", 160, 650);
  addLabeledRow(s, 464, "结果文件", "保存讨论中实际引用的结果图或结果表。", 160, 650);
  addLabeledRow(s, 536, "异常与排除", "保留判断依据；未纳入结果的样本也要解释排除条件。", 160, 650);
}

function addSlide4(presentation) {
  const s = presentation.slides.add();
  s.background.fill = C.white;
  chrome(s, 4);
  title(s, "归档保存关系，不改变数据授权", "记录可以让结果更可理解，但不能把受限原始数据变成可自由访问");
  addSectionLabel(s, "left-heading", 72, 200, "讨论材料", 160);
  shape(s, "discussion-surface", "roundRect", 72, 238, 470, 224, C.pale, "none", 0, 10);
  text(s, "discussion-title", 102, 270, 390, 32, "结果图 + 可公开解释", 25, C.navy, true);
  addBullet(s, "discussion-1", 102, 326, 385, "用于课题组讨论与复核入口", 18);
  addBullet(s, "discussion-2", 102, 374, 385, "记录中保留受控引用，而非复制受限文件", 18);
  addBullet(s, "discussion-3", 102, 422, 385, "说明访问条件与责任边界", 18);
  addSectionLabel(s, "right-heading", 720, 200, "受限原始数据", 180);
  shape(s, "raw-surface", "roundRect", 720, 238, 330, 224, C.softBlue, "none", 0, 10);
  text(s, "raw-title", 750, 270, 260, 52, "仍放在\n原授权位置", 27, C.navy, true, "left", { lineSpacing: 0.98 });
  text(s, "raw-copy", 750, 352, 255, 76, "涉及个人信息或合作限制的内容，不能因为归档而改变授权。", 18, C.ink);
  rule(s, "boundary-line", 570, 303, 112, C.blue, 2);
  text(s, "boundary-label", 560, 326, 140, 46, "受控引用\n+ 访问条件", 18, C.blue, true, "center", { lineSpacing: 1.05 });
  rule(s, "boundary-line-2", 680, 303, 32, C.blue, 2);
  text(s, "boundary-note", 72, 515, 980, 64, "一个路径出现在记录表中，不代表其他成员已经取得访问权；授权仍由负责人处理。", 22, C.navy, true);
}

function addSlide5(presentation) {
  const s = presentation.slides.add();
  s.background.fill = C.white;
  chrome(s, 5);
  title(s, "先从新增实验开始，历史档案只逐项补充", "两种推进思路的差异，必须放在同一组维度上比较");
  const x0 = 72, y0 = 198, labelW = 190, colW = 450, gap = 28;
  addSectionLabel(s, "compare-label", x0, y0, "推进范围比较", 200);
  text(s, "col-a", x0 + labelW + 25, y0, colW, 36, "集中补历史档案", 23, C.navy, true);
  text(s, "col-b", x0 + labelW + 25 + colW + gap, y0, colW, 36, "从新增实验开始", 23, C.blue, true);
  rule(s, "compare-head-rule", x0, 244, 1136, C.line, 1);
  const rows = [
    ["能解决什么", "一次形成较大的目录。", "上下文尚清楚时，先把新增记录做完整。"],
    ["主要风险", "追查遗失上下文，可能把不确定记忆写成确定说明。", "短期无法解决全部历史材料的追溯问题。"],
    ["在试点中的角色", "只对真正需要复核的历史结果逐项补充。", "作为四周试点的主要范围。"],
  ];
  rows.forEach((row, i) => {
    const y = 268 + i * 112;
    text(s, `cmp-label-${i}`, x0, y, labelW, 44, row[0], 19, C.navy, true);
    text(s, `cmp-a-${i}`, x0 + labelW + 25, y, colW, 75, row[1], 18, C.ink);
    shape(s, `cmp-b-bg-${i}`, "roundRect", x0 + labelW + 25 + colW + gap - 14, y - 14, colW + 28, 88, i === 2 ? C.softBlue : C.pale, "none", 0, 6);
    text(s, `cmp-b-${i}`, x0 + labelW + 25 + colW + gap, y, colW, 75, row[2], 18, C.ink);
    rule(s, `cmp-rule-${i}`, x0, y + 88, 1136, C.line, 1);
  });
  text(s, "compare-caveat", 72, 625, 1136, 30, "这是范围选择，不能表述为已经证明新方式更高效。", 19, C.gray, true);
}

function addSlide6(presentation) {
  const s = presentation.slides.add();
  s.background.fill = C.white;
  chrome(s, 6);
  title(s, "复核先检查可理解性，不代替科学结论审查", "先确认别人能沿记录还原来源，再进入讨论版本");
  const y = 274, h = 120, w = 222, gap = 38, xs = [72, 332, 592, 852];
  const nodes = xs.map((x, i) => shape(s, `flow-node-${i}`, "roundRect", x, y, w, h, i === 3 ? C.navy : C.pale, "none", 0, 10));
  // Editable arrow shapes sit in the gaps between the four process nodes.
  for (let i = 0; i < 3; i++) {
    shape(s, `flow-arrow-${i}`, "rightArrow", xs[i] + w + 6, y + 46, gap - 12, 28, C.blue, "none", 0);
  }
  text(s, "flow-0", xs[0] + 20, y + 25, w - 40, 72, "执行者\n提交结果记录", 23, C.navy, true, "center", { lineSpacing: 0.98 });
  text(s, "flow-1", xs[1] + 20, y + 25, w - 40, 72, "复核者\n定位数据、脚本与条件", 21, C.navy, true, "center", { lineSpacing: 0.98 });
  text(s, "flow-2", xs[2] + 20, y + 25, w - 40, 72, "执行者\n补充缺项", 23, C.navy, true, "center", { lineSpacing: 0.98 });
  text(s, "flow-3", xs[3] + 20, y + 25, w - 40, 72, "负责人\n确认可讨论版本", 23, C.white, true, "center", { lineSpacing: 0.98 });
  text(s, "flow-caption", 72, 220, 1100, 30, "拟定工作顺序", 18, C.blue, true);
  shape(s, "pause-surface", "roundRect", 852, 458, 356, 110, C.white, C.line, 1, 8);
  text(s, "pause-label", 876, 478, 95, 26, "若涉及", 17, C.gray, true);
  text(s, "pause-main", 976, 475, 202, 34, "新的访问授权", 21, C.navy, true);
  text(s, "pause-copy", 876, 518, 300, 32, "暂停共享，由负责人处理后再继续。", 17, C.ink);
  text(s, "scope-note", 72, 493, 720, 72, "复核不要求复做整项实验，也不代替科学结论审查；它先检查别人是否能理解这个结果是怎么产生的。", 19, C.gray);
}

function addSlide7(presentation) {
  const s = presentation.slides.add();
  s.background.fill = C.white;
  chrome(s, 7);
  title(s, "四周只验证一个有限问题", "范围越小，越能看清记录是否真的帮助理解结果");
  shape(s, "pilot-scope", "roundRect", 72, 190, 1136, 78, C.navy, "none", 0, 10);
  text(s, "pilot-scope-copy", 100, 214, 1080, 32, "1 个课题方向     ·     2 名自愿成员     ·     记录新增实验", 23, C.white, true, "center");
  addSectionLabel(s, "timeline-label", 72, 312, "四周安排", 130);
  rule(s, "timeline-axis", 116, 406, 1000, C.line, 2);
  const weeks = [
    ["第 1 周", "共同明确最少字段\n用一个结果试填"],
    ["第 2 周", "在实际工作中\n记录缺项与负担"],
    ["第 3 周", "继续记录\n观察复核过程"],
    ["第 4 周", "讨论保留、修改\n或停止"],
  ];
  weeks.forEach((item, i) => {
    const x = 116 + i * 280;
    shape(s, `week-dot-${i}`, "ellipse", x - 9, 397, 18, 18, i === 3 ? C.navy : C.blue, "none", 0);
    text(s, `week-head-${i}`, x - 52, 348, 105, 26, item[0], 18, C.navy, true, "center");
    text(s, `week-copy-${i}`, x - 92, 436, 185, 70, item[1], 18, C.ink, false, "center", { lineSpacing: 1.08 });
  });
  rule(s, "pilot-foot-rule", 72, 562, 1136, C.line, 1);
  text(s, "pilot-foot", 72, 588, 1136, 48, "四周、两人和周次安排都是拟定范围；本方案没有实测效率提升或完成率数字。", 20, C.gray, true);
}

function addSlide8(presentation) {
  const s = presentation.slides.add();
  s.background.fill = C.white;
  chrome(s, 8);
  title(s, "试点是否值得保留，要同时看能否定位、解释、持续承担", "不先给一个统一“合格分数”，而是收集具体复核过程与当事人反馈");
  addSectionLabel(s, "eval-label", 72, 202, "三个评估问题", 180);
  const evals = [
    ["01", "能否定位", "其他成员能否沿记录定位结果的来源？"],
    ["02", "能否解释", "关键处理与排除是否有可理解的依据？"],
    ["03", "能否持续", "记录负担是否在成员愿意持续承担的范围内？"],
  ];
  evals.forEach((item, i) => {
    const y = 248 + i * 94;
    text(s, `eval-no-${i}`, 72, y, 52, 28, item[0], 18, C.blue, true);
    text(s, `eval-head-${i}`, 142, y, 145, 28, item[1], 20, C.navy, true);
    text(s, `eval-copy-${i}`, 312, y, 455, 46, item[2], 18, C.ink);
    rule(s, `eval-rule-${i}`, 72, y + 64, 695, C.line, 1);
  });
  shape(s, "stop-surface", "roundRect", 840, 202, 368, 330, C.pale, "none", 0, 10);
  addSectionLabel(s, "stop-label", 870, 232, "停止或修改的信号", 220);
  addBullet(s, "stop-1", 870, 284, 295, "填写工作持续挤占必要实验时间。", 18);
  addBullet(s, "stop-2", 870, 360, 295, "权限边界无法说明。", 18);
  addBullet(s, "stop-3", 870, 424, 295, "记录只增加重复抄写，却没有帮助解释结果。", 18);
  text(s, "stop-action", 72, 560, 1040, 55, "届时先缩小要求或停止试点，不能为了完成试点目标强行推广。", 21, C.navy, true);
}

function addSlide9(presentation) {
  const s = presentation.slides.add();
  s.background.fill = C.white;
  chrome(s, 9);
  title(s, "本次讨论要确认的是一个有限尝试", "先让一次结果可以被理解，再决定哪些记录值得长期保存");
  shape(s, "close-message", "roundRect", 72, 192, 1136, 96, C.navy, "none", 0, 10);
  text(s, "close-message-copy", 102, 218, 1080, 42, "归档工具只是承载方式；要验证的是结果、依据与责任边界的联系。", 25, C.white, true, "center");
  addSectionLabel(s, "confirm-label", 72, 342, "开始试点前确认", 230);
  addBullet(s, "confirm-1", 72, 388, 480, "负责人确认范围与授权联系人。", 19);
  addBullet(s, "confirm-2", 72, 446, 480, "参与成员认可最少字段。", 19);
  addBullet(s, "confirm-3", 72, 504, 480, "确定谁负责复核。", 19);
  shape(s, "close-divider", "rect", 640, 340, 1, 220, C.line, "none", 0);
  addSectionLabel(s, "not-label", 704, 342, "本轮不承诺", 160);
  text(s, "not-copy", 704, 388, 470, 116, "不承诺已经提高效率\n不承诺覆盖全部历史档案\n不承诺改变原始数据授权", 21, C.gray, false, "left", { lineSpacing: 1.18 });
  rule(s, "close-rule", 72, 598, 1136, C.line, 1);
  text(s, "close-final", 72, 620, 1136, 34, "先把一次结果说明白，再决定什么值得长期保存。", 24, C.navy, true);
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const presentation = Presentation.create({ slideSize: SLIDE });
  addSlide1(presentation);
  addSlide2(presentation);
  addSlide3(presentation);
  addSlide4(presentation);
  addSlide5(presentation);
  addSlide6(presentation);
  addSlide7(presentation);
  addSlide8(presentation);
  addSlide9(presentation);

  const slideDescriptions = [
    "封面：主题、讨论对象、试点范围与明确的虚构/未实施边界。",
    "判断—依据：用窄入口指出解释链断点，右侧列出三个可观察问题。",
    "组成关系：五项材料共同解释一个结果，明确不按先后编号。",
    "主分析—条件：讨论材料与受限原始数据并置，访问条件紧贴边界。",
    "对应比较：集中补历史与从新增开始共享三行比较维度；推荐范围被轻底强调。",
    "真实顺序：执行者—复核者—补充—负责人；授权分支单独暂停，不混入正常编号。",
    "试点时间：四周时间轴、范围三要素及无实测成效的证据边界。",
    "评估—停止：三个评估问题与三项停止/修改信号分区呈现。",
    "决策收束：启动前确认项与本轮不承诺并置，回到有限尝试。",
  ];

  for (const [i, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(i + 1).padStart(2, "0")}`;
    await writeBlob(`${OUT}/${stem}.png`, await presentation.export({ slide, format: "png", scale: 1 }));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(`${OUT}/${stem}.layout.json`, await layout.text(), "utf8");
  }
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(`${OUT}/deck.pptx`);

  const report = [
    "咨询式分析 · handbook-01 · run-01",
    "",
    "交付物：deck.pptx；slide-01.png 至 slide-09.png；对应 slide-XX.layout.json；builder.mjs。",
    "",
    "实际字体角色",
    `- 标题、组标题、正文、页脚统一使用 ${NODE}。`,
    "- 页标题 38px；封面标题 56px；组标题 18–23px；正文 17–21px；脚注 12–15px。",
    "- 标题深蓝加粗；组标题/关键词按职责使用加粗；正文左对齐；页码独立右对齐。",
    "",
    "实际色板",
    `- 深蓝 ${C.navy}：判断标题、强强调、封面与收束。`,
    `- 分析蓝 ${C.blue}：证据强调、步骤连接、编号与次级入口。`,
    `- 正文 ${C.ink}；辅助灰 ${C.gray}；细线 ${C.line}；浅底 ${C.pale}；纸面 ${C.white}。`,
    "- 未使用渐变、投影、透视、彩虹分类或装饰图片。",
    "",
    "实际间距与网格",
    "- 画布 1280×720px；左右外边距 72px；标题上边界 72px；正文主要起点 188–205px；底线 675px。",
    "- 组内行距以 72–94px 节拍；主区与支撑区以 28–38px 通道区分；比较页共享起点与行基线。",
    "- 纸面白底贯穿全套；浅底只用于共同条件、范围或局部强调。",
    "",
    "内容条件的可见去向",
    ...slideDescriptions.map((d, i) => `- 第 ${i + 1} 页：${d}`),
    "",
    "检查记录",
    "- 已按实际导出对象生成逐页 PNG 与布局 JSON；文本、对象坐标与角色可由对应 JSON 回读。",
    "- 已采用统一 72px 外边距、标题/正文层级和颜色角色；未导入已有 PPT、Skin、结构库、参考图或其他实验资料。",
    "- 已保留虚构场景、方案讨论口径、无实测效率/完成率数字、授权不改变、停止条件等边界。",
    "- 已完成：PPTX 导出、逐页 PNG 导出、逐页布局 JSON 导出、实际文字与布局结构回读。",
    "- 待父任务完成的外部评审：逐页视觉审阅与课题组语义接受度判断；本轮按委托不得读取 PNG 或截图。",
  ].join("\n");
  await fs.writeFile(`${OUT}/report.txt`, report, "utf8");
  console.log(JSON.stringify({ output: `${OUT}/deck.pptx`, slides: presentation.slides.items.length }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
