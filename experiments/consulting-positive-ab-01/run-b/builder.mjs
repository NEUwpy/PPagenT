import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/consulting-positive-ab-01/run-b";
const W = 1280;
const H = 720;
const C = {
  navy: "#17324D",
  blue: "#315F91",
  blue2: "#4D78A5",
  blue3: "#9DB9D3",
  pale: "#EAF2F9",
  pale2: "#F4F8FB",
  ink: "#1D2A36",
  muted: "#5C6B78",
  line: "#B8C9D9",
  white: "#FFFFFF",
  warm: "#F1E8D6",
  warmInk: "#735A2C",
  redPale: "#F8E5E0",
  redInk: "#8A463A",
  greenPale: "#E5F0EA",
  greenInk: "#35634C",
};

const checks = {
  canvas: [],
  text: [],
  overlap: [],
  connectors: [],
};

function pos(left, top, width, height) {
  return { left, top, width, height };
}

function rectsOverlap(a, b) {
  return !(a.left + a.width <= b.left || b.left + b.width <= a.left || a.top + a.height <= b.top || b.top + b.height <= a.top);
}

function addShape(slide, geometry, name, position, fill, line = { style: "solid", fill: "none", width: 0 }, extra = {}) {
  const shape = slide.shapes.add({ geometry, name, position, fill, line, ...extra });
  checks.canvas.push({ slide: slide.name || "slide", name, position });
  return shape;
}

function addText(slide, name, text, position, style = {}, fill = "none", line = { style: "solid", fill: "none", width: 0 }) {
  const shape = addShape(slide, "textbox", name, position, fill, line);
  shape.text = text;
  shape.text.style = {
    typeface: "Microsoft YaHei",
    fontSize: 18,
    color: C.ink,
    alignment: "left",
    verticalAlignment: "top",
    wrap: "square",
    autoFit: "shrinkText",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    lineSpacing: 1.15,
    ...style,
  };
  checks.text.push({ name, text, position, fontSize: style.fontSize || 18 });
  return shape;
}

function addBox(slide, name, position, fill, line = { style: "solid", fill: C.line, width: 1 }, radius = 16, shadow = "shadow-none") {
  return addShape(slide, "roundRect", name, position, fill, line, { borderRadius: radius, shadow });
}

function addLine(slide, name, x1, y1, x2, y2, color = C.line, width = 2, dashed = false) {
  const line = addShape(slide, "line", name, pos(Math.min(x1, x2), Math.min(y1, y2), Math.max(1, Math.abs(x2 - x1)), Math.max(1, Math.abs(y2 - y1))), "none", { style: dashed ? "dashed" : "solid", fill: color, width });
  checks.connectors.push({ name, from: [x1, y1], to: [x2, y2], color, width, dashed });
  return line;
}

function addArrow(slide, name, x, y, width, height, fill = C.blue) {
  return addShape(slide, "rightArrow", name, pos(x, y, width, height), fill, { style: "solid", fill, width: 0 });
}

function addCircle(slide, name, x, y, diameter, fill, text, textStyle = {}) {
  const s = addShape(slide, "ellipse", name, pos(x, y, diameter, diameter), fill, { style: "solid", fill, width: 0 });
  s.text = text;
  s.text.style = { typeface: "Microsoft YaHei", fontSize: 18, bold: true, color: C.white, alignment: "center", verticalAlignment: "middle", wrap: "none", autoFit: "none", insets: { top: 0, right: 0, bottom: 0, left: 0 }, ...textStyle };
  checks.text.push({ name: `${name}.text`, text, position: pos(x, y, diameter, diameter), fontSize: textStyle.fontSize || 18 });
  return s;
}

function header(slide, page, kicker, title, subtitle) {
  slide.background.fill = C.pale2;
  addShape(slide, "rect", `slide-${page}-topbar`, pos(0, 0, W, 12), C.blue, { style: "solid", fill: C.blue, width: 0 });
  addText(slide, `slide-${page}-kicker`, kicker, pos(64, 34, 420, 24), { fontSize: 15, bold: true, color: C.blue, letterSpacing: 1.2 });
  addText(slide, `slide-${page}-title`, title, pos(64, 64, 1100, 58), { fontSize: 38, bold: true, color: C.navy, lineSpacing: 1.0 });
  addText(slide, `slide-${page}-subtitle`, subtitle, pos(66, 125, 1080, 28), { fontSize: 17, color: C.muted });
  addText(slide, `slide-${page}-page`, `0${page}`, pos(1180, 50, 48, 30), { fontSize: 17, bold: true, color: C.blue, alignment: "right" });
  addLine(slide, `slide-${page}-header-line`, 64, 158, 1216, 158, C.line, 1);
}

function note(slide, text) {
  slide.speakerNotes.textFrame.setText(`[Sources]\n- 用户提供的 source.md：${text}\n- 无外部图片或外部事实；图形均为原生可编辑形状。`);
  slide.speakerNotes.setVisible(true);
}

function addPill(slide, name, text, x, y, width, fill, ink) {
  const b = addBox(slide, name, pos(x, y, width, 30), fill, { style: "solid", fill, width: 0 }, 15);
  b.text = text;
  b.text.style = { typeface: "Microsoft YaHei", fontSize: 14, bold: true, color: ink, alignment: "center", verticalAlignment: "middle", autoFit: "shrinkText", insets: { top: 0, right: 8, bottom: 0, left: 8 } };
  checks.text.push({ name: `${name}.text`, text, position: pos(x, y, width, 30), fontSize: 14 });
  return b;
}

function buildSlide1(p) {
  const s = p.slides.add();
  header(s, 1, "问题 01  ·  结果记录", "一次结果应保存什么？", "记录单元要让结果可定位、可解释、可复核；五类材料共同承担解释责任。");

  addBox(s, "s1-thesis", pos(64, 190, 300, 122), C.navy, { style: "solid", fill: C.navy, width: 0 }, 16);
  addText(s, "s1-thesis-label", "核心判断", pos(86, 208, 110, 22), { fontSize: 15, bold: true, color: C.blue3 });
  addText(s, "s1-thesis-text", "完整记录 ≠\n全部文件开放", pos(86, 236, 248, 62), { fontSize: 29, bold: true, color: C.white, lineSpacing: 0.98 });
  addText(s, "s1-thesis-note", "路径只能定位，不能代表访问权。", pos(86, 326, 246, 34), { fontSize: 16, color: C.navy });

  // Relationship lines first: the five record elements jointly explain one result.
  addLine(s, "s1-link-data", 540, 277, 730, 386, C.blue3, 2);
  addLine(s, "s1-link-sample", 540, 376, 730, 410, C.blue3, 2);
  addLine(s, "s1-link-script", 540, 475, 730, 430, C.blue3, 2);
  addLine(s, "s1-link-result", 1000, 277, 836, 386, C.blue3, 2);
  addLine(s, "s1-link-exception", 1000, 475, 836, 430, C.blue3, 2);

  addBox(s, "s1-center", pos(730, 360, 106, 100), C.blue, { style: "solid", fill: C.blue, width: 0 }, 22, "shadow-sm");
  addText(s, "s1-center-label", "结果\n可解释", pos(744, 384, 78, 50), { fontSize: 22, bold: true, color: C.white, alignment: "center", verticalAlignment: "middle", lineSpacing: 0.95 });

  const nodes = [
    ["s1-data", "01", "原始数据位置", "原貌保留；清洗另存", 390, 215, C.pale],
    ["s1-sample", "02", "样本与采集条件", "说明结果成立的条件", 390, 354, C.pale],
    ["s1-script", "03", "处理脚本版本", "定位实际运行代码", 390, 493, C.pale],
    ["s1-result", "04", "结果文件", "与记录单元绑定", 920, 215, C.pale],
    ["s1-exception", "05", "异常与排除说明", "未纳入样本也留依据", 920, 493, C.pale],
  ];
  for (const [name, num, title, body, x, y, fill] of nodes) {
    addBox(s, name, pos(x, y, 260, 104), fill, { style: "solid", fill: C.blue3, width: 1 }, 14);
    addCircle(s, `${name}-num`, x + 14, y + 17, 34, C.blue, num, { fontSize: 14 });
    addText(s, `${name}-title`, title, pos(x + 60, y + 15, 180, 25), { fontSize: 19, bold: true, color: C.navy });
    addText(s, `${name}-body`, body, pos(x + 60, y + 49, 180, 42), { fontSize: 16, color: C.muted, lineSpacing: 1.05 });
  }

  addBox(s, "s1-access", pos(64, 392, 300, 206), C.white, { style: "solid", fill: C.line, width: 1 }, 16);
  addPill(s, "s1-access-pill", "访问边界", 84, 412, 92, C.warm, C.warmInk);
  addText(s, "s1-access-text", "讨论材料可含结果图与可公开解释；\n受限数据留在原授权位置。\n记录只写受控引用与访问条件。", pos(84, 455, 252, 96), { fontSize: 17, color: C.ink, lineSpacing: 1.16 });

  addText(s, "s1-foot", "五类材料是共同解释关系，不是五个先后步骤。", pos(390, 630, 700, 28), { fontSize: 17, bold: true, color: C.blue });
  note(s, "第1问：记录单元、开放边界、原始数据与排除依据。");
  return s;
}

function buildSlide2(p) {
  const s = p.slides.add();
  header(s, 2, "问题 02  ·  范围选择", "先记新增，再逐项补真正需要复核的历史结果", "集中补历史能快速形成目录，但不等于效率已经被证明提升。");

  addBox(s, "s2-left", pos(64, 192, 466, 318), C.white, { style: "solid", fill: C.line, width: 1 }, 18);
  addBox(s, "s2-left-head", pos(64, 192, 466, 66), C.redPale, { style: "solid", fill: C.redPale, width: 0 }, 18);
  addText(s, "s2-left-title", "集中补历史", pos(88, 210, 210, 32), { fontSize: 25, bold: true, color: C.redInk });
  addPill(s, "s2-left-tag", "短期可见", 408, 210, 96, C.white, C.redInk);
  addText(s, "s2-left-body", "一次形成较大目录，覆盖面看起来更完整。\n\n代价与风险\n• 追查遗失上下文耗时\n• 不确定记忆可能被写成确定说明", pos(88, 282, 390, 182), { fontSize: 18, color: C.ink, lineSpacing: 1.15 });
  addText(s, "s2-left-meaning", "意味着：目录变大，但证据未必更可靠。", pos(88, 474, 390, 25), { fontSize: 16, bold: true, color: C.redInk });

  addBox(s, "s2-right", pos(750, 192, 466, 318), C.white, { style: "solid", fill: C.line, width: 1 }, 18);
  addBox(s, "s2-right-head", pos(750, 192, 466, 66), C.greenPale, { style: "solid", fill: C.greenPale, width: 0 }, 18);
  addText(s, "s2-right-title", "先记新增", pos(774, 210, 210, 32), { fontSize: 25, bold: true, color: C.greenInk });
  addPill(s, "s2-right-tag", "推荐起点", 1098, 210, 96, C.white, C.greenInk);
  addText(s, "s2-right-body", "在上下文清楚时记录新增实验，先固定可追溯的样本。\n\n现实边界\n• 短期无法解决全部历史材料追溯\n• 历史结果仅对真正需要复核者逐项补充", pos(774, 282, 390, 182), { fontSize: 18, color: C.ink, lineSpacing: 1.15 });
  addText(s, "s2-right-meaning", "意味着：先建立清楚的新增基线，再按需回补。", pos(774, 474, 390, 25), { fontSize: 16, bold: true, color: C.greenInk });

  // The recommendation is a scope choice, not a measured efficiency claim.
  addLine(s, "s2-center-line", 530, 350, 750, 350, C.blue3, 2);
  addArrow(s, "s2-arrow-left", 584, 338, 42, 24, C.blue3);
  addArrow(s, "s2-arrow-right", 654, 338, 42, 24, C.blue3);
  addBox(s, "s2-recommend", pos(536, 288, 208, 124), C.navy, { style: "solid", fill: C.navy, width: 0 }, 18, "shadow-sm");
  addText(s, "s2-recommend-label", "建议顺序", pos(562, 306, 156, 22), { fontSize: 15, bold: true, color: C.blue3, alignment: "center" });
  addText(s, "s2-recommend-text", "新增先行\n历史按需", pos(562, 334, 156, 58), { fontSize: 24, bold: true, color: C.white, alignment: "center", lineSpacing: 0.98 });

  addBox(s, "s2-boundary", pos(64, 546, 1152, 90), C.pale, { style: "solid", fill: C.blue3, width: 1 }, 14);
  addText(s, "s2-boundary-label", "适用边界", pos(88, 566, 130, 22), { fontSize: 16, bold: true, color: C.blue });
  addText(s, "s2-boundary-text", "这是范围选择：原稿没有证明它会提高效率。判断依据是上下文清楚程度与复核需求，而不是目录大小。", pos(240, 562, 910, 34), { fontSize: 18, color: C.ink });
  note(s, "第2问：历史补录与新增记录的取舍、推荐顺序及无效率证明边界。");
  return s;
}

function buildSlide3(p) {
  const s = p.slides.add();
  header(s, 3, "问题 03  ·  受控复核", "复核围绕“结果如何产生”推进，并在授权变化时暂停共享", "记录定位、缺项补充、负责人确认组成主线；复核不要求重做实验。");

  const xs = [76, 338, 600, 862];
  const titles = ["提交记录", "定位缺项", "执行补充", "负责人确认"];
  const bodies = [
    "执行者提交结果记录\n及受控引用",
    "另一成员定位数据、\n脚本与采集条件",
    "执行者补充发现的\n缺项与说明",
    "确认后进入\n可讨论版本",
  ];
  // Rail lines and arrowheads are created before the phase nodes.
  addLine(s, "s3-rail-1", 276, 370, 338, 370, C.blue3, 3);
  addLine(s, "s3-rail-2", 538, 370, 600, 370, C.blue3, 3);
  addLine(s, "s3-rail-3", 800, 370, 862, 370, C.blue3, 3);
  addArrow(s, "s3-arrow-1", 303, 358, 30, 24, C.blue3);
  addArrow(s, "s3-arrow-2", 565, 358, 30, 24, C.blue3);
  addArrow(s, "s3-arrow-3", 827, 358, 30, 24, C.blue3);

  for (let i = 0; i < 4; i += 1) {
    addBox(s, `s3-step-${i + 1}`, pos(xs[i], 292, 200, 156), i === 3 ? C.navy : C.white, { style: "solid", fill: i === 3 ? C.navy : C.line, width: 1 }, 18, i === 3 ? "shadow-sm" : "shadow-none");
    addCircle(s, `s3-num-${i + 1}`, xs[i] + 18, 310, 38, i === 3 ? C.blue3 : C.blue, `0${i + 1}`, { fontSize: 14, color: i === 3 ? C.navy : C.white });
    addText(s, `s3-title-${i + 1}`, titles[i], pos(xs[i] + 68, 314, 116, 26), { fontSize: 20, bold: true, color: i === 3 ? C.white : C.navy });
    addText(s, `s3-body-${i + 1}`, bodies[i], pos(xs[i] + 20, 370, 160, 52), { fontSize: 17, color: i === 3 ? C.white : C.ink, lineSpacing: 1.1 });
  }

  // Branch/authorization gate.
  addLine(s, "s3-branch", 700, 448, 700, 500, C.warmInk, 2, true);
  addBox(s, "s3-gate", pos(530, 508, 340, 92), C.warm, { style: "solid", fill: C.warmInk, width: 1 }, 14);
  addPill(s, "s3-gate-pill", "授权变化时", 554, 524, 116, C.white, C.warmInk);
  addText(s, "s3-gate-text", "暂停共享 → 负责人处理 → 获授权后继续", pos(544, 560, 312, 24), { fontSize: 16, bold: true, color: C.warmInk });

  addBox(s, "s3-scope", pos(64, 622, 1152, 46), C.pale, { style: "solid", fill: C.blue3, width: 1 }, 12);
  addText(s, "s3-scope-text", "复核检查结果如何产生；不要求复做实验，也不代替科学结论审查。", pos(88, 635, 1120, 22), { fontSize: 17, bold: true, color: C.blue });
  note(s, "第3问：四步复核主线、授权变化门禁及复核范围边界。");
  return s;
}

function buildSlide4(p) {
  const s = p.slides.add();
  header(s, 4, "问题 04  ·  四周试点", "用具体复核过程和成员反馈决定去留，不设统一分数", "试点范围是拟定方案：一个方向、两名自愿成员、只记录新增实验。");

  addBox(s, "s4-scope", pos(64, 190, 1152, 58), C.navy, { style: "solid", fill: C.navy, width: 0 }, 14);
  addText(s, "s4-scope-text", "试点范围  ·  1 个课题方向  ·  2 名自愿成员  ·  记录新增实验", pos(92, 207, 1080, 26), { fontSize: 20, bold: true, color: C.white, alignment: "center" });

  const weekX = [86, 356, 626, 896];
  const weekTitle = ["第 1 周", "第 2–3 周", "第 4 周", "决定门"];
  const weekBody = [
    "确认最少字段\n试填一个结果",
    "记录缺项\n记录填写负担",
    "汇总复核过程\n听取成员反馈",
    "保留 / 修改 / 停止",
  ];
  // Timeline rail first.
  addLine(s, "s4-timeline", 130, 342, 1090, 342, C.blue3, 4);
  for (let i = 0; i < 4; i += 1) {
    addCircle(s, `s4-week-${i + 1}`, weekX[i], 315, 54, i === 3 ? C.navy : C.blue, `${i + 1}`, { fontSize: 20 });
  }
  for (let i = 0; i < 4; i += 1) {
    const fill = i === 3 ? C.navy : C.white;
    addBox(s, `s4-card-${i + 1}`, pos(weekX[i] - 34, 382, 200, 108), fill, { style: "solid", fill: i === 3 ? C.navy : C.line, width: 1 }, 14, i === 3 ? "shadow-sm" : "shadow-none");
    addText(s, `s4-title-${i + 1}`, weekTitle[i], pos(weekX[i] - 14, 400, 160, 26), { fontSize: 21, bold: true, color: i === 3 ? C.white : C.navy, alignment: "center" });
    addText(s, `s4-body-${i + 1}`, weekBody[i], pos(weekX[i] - 14, 438, 160, 42), { fontSize: 17, color: i === 3 ? C.white : C.ink, alignment: "center", lineSpacing: 1.08 });
  }

  addBox(s, "s4-criteria", pos(64, 526, 680, 126), C.pale, { style: "solid", fill: C.blue3, width: 1 }, 14);
  addText(s, "s4-criteria-title", "评估看什么", pos(88, 545, 160, 24), { fontSize: 18, bold: true, color: C.blue });
  addText(s, "s4-criteria-body", "来源能否定位  ·  处理与排除依据能否理解  ·  负担是否愿意长期承担", pos(88, 580, 610, 45), { fontSize: 18, color: C.ink, lineSpacing: 1.12 });

  addBox(s, "s4-stop", pos(770, 526, 446, 126), C.redPale, { style: "solid", fill: C.redInk, width: 1 }, 14);
  addText(s, "s4-stop-title", "缩小要求或停止", pos(794, 545, 220, 24), { fontSize: 18, bold: true, color: C.redInk });
  addText(s, "s4-stop-body", "持续挤占实验时间\n权限不明\n只有重复抄写，不能帮助解释结果", pos(794, 578, 380, 66), { fontSize: 17, color: C.ink, lineSpacing: 1.08 });

  addText(s, "s4-limit", "方案仍是拟定范围：没有实测效率或完成率。", pos(64, 674, 780, 22), { fontSize: 16, color: C.muted });
  note(s, "第4问：四周阶段、评估依据、停止触发条件与未实测边界。");
  return s;
}

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  const p = Presentation.create({ slideSize: { width: W, height: H } });
  buildSlide1(p);
  buildSlide2(p);
  buildSlide3(p);
  buildSlide4(p);

  for (let i = 0; i < p.slides.items.length; i += 1) {
    const slide = p.slides.items[i];
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(`${OUT}/slide-${String(i + 1).padStart(2, "0")}.layout.json`, await layout.text());
  }
  const inspect = await p.inspect({ kind: "slide,textbox,shape,notes", maxChars: 50000 });
  await fs.writeFile(`${OUT}/inspect.ndjson`, inspect.ndjson || "");

  const pptx = await PresentationFile.exportPptx(p);
  await pptx.save(`${OUT}/deck.pptx`);

  // Lightweight authoring checks: bounds, declared text sizes, and explicit line records.
  const bounds = checks.canvas.filter((x) => x.position.left < 0 || x.position.top < 0 || x.position.left + x.position.width > W || x.position.top + x.position.height > H);
  const bodyTooSmall = checks.text.filter((x) => x.fontSize < 16);
  const report = {
    slideCount: p.slides.items.length,
    canvas: { width: W, height: H, outOfBounds: bounds },
    text: { totalTextObjects: checks.text.length, below16px: bodyTooSmall },
    overlapCheck: { method: "Authoring ledger records each intended box; final PPTX is additionally checked with slides_test.py.", intentionallyOverlapping: ["s1-center with five radial connector lines", "s2-center-line and arrows around recommendation node", "s3-branch line leading to authorization gate", "s4-timeline rail behind numbered nodes"] },
    connectorCheck: { connectorObjects: checks.connectors.length, entries: checks.connectors },
  };
  await fs.writeFile(`${OUT}/authoring-checks.json`, JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
