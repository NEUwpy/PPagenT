import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import JSZip from "jszip";

const OUT = "C:/PPagenT/experiments/consulting-positive-ab-01/run-a-r1";
const FONT = "Microsoft YaHei";
const C = {
  bg: "#F6F8FA",
  navy: "#315F91",
  deep: "#173A5E",
  blue: "#4E84B4",
  pale: "#EAF1F7",
  pale2: "#F0F5F8",
  ink: "#20364A",
  muted: "#63778B",
  line: "#D3E0EB",
  white: "#FFFFFF",
  teal: "#2D7C88",
  tealPale: "#E7F2F3",
  amber: "#C6892F",
  amberPale: "#FFF4DF",
  red: "#B75C55",
  redPale: "#FBECEC",
  grayPale: "#EFF2F5",
};

const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });

function addBox(slide, name, x, y, w, h, fill, stroke = C.line, radius = 12, shadow = "shadow-none") {
  return slide.shapes.add({
    geometry: "roundRect",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: stroke, width: stroke === "none" ? 0 : 1 },
    borderRadius: radius,
    shadow,
  });
}

function addText(slide, name, text, x, y, w, h, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: FONT,
    fontSize: style.fontSize ?? 16,
    color: style.color ?? C.ink,
    bold: style.bold ?? false,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "top",
    autoFit: "shrinkText",
    wrap: "square",
    lineSpacing: style.lineSpacing ?? 1.05,
    insets: style.insets ?? { left: 0, right: 0, top: 0, bottom: 0 },
  };
  return shape;
}

function addLine(slide, name, x, y, w, h, color = C.line, width = 1, dashed = false) {
  return slide.shapes.add({
    geometry: "line",
    name,
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: dashed ? "dashed" : "solid", fill: color, width },
  });
}

function pageChrome(slide, pageNo, section, title, subtitle) {
  slide.background.fill = C.bg;
  addText(slide, `s${pageNo}-eyebrow`, `实验归档  /  ${section}`, 62, 24, 420, 22, { fontSize: 13, color: C.navy, bold: true });
  addText(slide, `s${pageNo}-page`, `${String(pageNo).padStart(2, "0")}  /  04`, 1088, 24, 130, 22, { fontSize: 13, color: C.muted, bold: true, alignment: "right" });
  addLine(slide, `s${pageNo}-topline`, 62, 48, 1156, 0, C.line, 1);
  addText(slide, `s${pageNo}-title`, title, 62, 63, 1156, 48, { fontSize: 35, color: C.deep, bold: true, lineSpacing: 0.96 });
  addText(slide, `s${pageNo}-subtitle`, subtitle, 62, 116, 1156, 28, { fontSize: 16, color: C.muted });
  addLine(slide, `s${pageNo}-bottomline`, 62, 674, 1156, 0, C.line, 1);
  addText(slide, `s${pageNo}-footer`, "虚构讨论提案  ·  尚未实施  ·  供试点设计讨论", 62, 684, 700, 18, { fontSize: 11, color: C.muted });
}

function addNotes(slide) {
  slide.speakerNotes.textFrame.setText("[Sources]\n- User-provided source.md (fictional discussion proposal; no external sources).\n[/Sources]");
  slide.speakerNotes.setVisible(false);
}

// Slide 1 — record unit
{
  const slide = presentation.slides.add();
  pageChrome(slide, 1, "RECORD UNIT", "一次结果要完整解释，五类信息共同构成记录单元", "把结果、条件与边界放在同一条证据链中：它们共同解释一个结果，而不是五个先后步骤。");
  addBox(slide, "s1-unit-banner", 62, 160, 1156, 64, C.navy, C.navy, 12);
  addText(slide, "s1-unit-label", "记录单元", 84, 176, 120, 28, { fontSize: 21, color: C.white, bold: true });
  addText(slide, "s1-unit-main", "一次结果 = 5类相互依赖的信息", 236, 175, 510, 30, { fontSize: 24, color: C.white, bold: true });
  addText(slide, "s1-unit-note", "共同解释一个结果  ·  不是五个先后步骤", 770, 178, 418, 24, { fontSize: 16, color: "#DCEAF5", alignment: "right" });

  const fields = [
    ["01", "原始数据位置", "保留原貌，标注可定位位置"],
    ["02", "样本与采集条件", "说明样本范围与采集条件"],
    ["03", "处理脚本版本", "定位实际运行的代码版本"],
    ["04", "结果文件", "链接本次分析产出的结果文件"],
    ["05", "异常及排除说明", "记录异常；保留未纳入样本的排除依据"],
  ];
  const x0 = 62, gap = 14, w = 218, y = 246, h = 190;
  fields.forEach((f, i) => {
    const x = x0 + i * (w + gap);
    addBox(slide, `s1-field-${i + 1}`, x, y, w, h, i === 2 ? C.pale : C.white, i === 2 ? C.blue : C.line, 12, "shadow-sm");
    addText(slide, `s1-field-num-${i + 1}`, f[0], x + 16, y + 16, 42, 22, { fontSize: 13, color: C.blue, bold: true });
    addText(slide, `s1-field-title-${i + 1}`, f[1], x + 16, y + 48, w - 32, 52, { fontSize: 20, color: C.deep, bold: true, lineSpacing: 0.98 });
    addLine(slide, `s1-field-line-${i + 1}`, x + 16, y + 112, w - 32, 0, i === 2 ? "#B8CFE2" : C.line, 1);
    addText(slide, `s1-field-body-${i + 1}`, f[2], x + 16, y + 128, w - 32, 48, { fontSize: 15, color: C.muted, lineSpacing: 1.1 });
  });

  addBox(slide, "s1-principles", 62, 462, 560, 178, C.tealPale, "#BFDADC", 12);
  addText(slide, "s1-principles-title", "记录原则", 84, 480, 180, 26, { fontSize: 21, color: C.teal, bold: true });
  addText(slide, "s1-principles-body", [
    { bulletCharacter: "•", marginLeft: 20, indent: -10, runs: ["原始数据保持原貌"] },
    { bulletCharacter: "•", marginLeft: 20, indent: -10, runs: ["清洗处理另存，不覆盖原始数据"] },
    { bulletCharacter: "•", marginLeft: 20, indent: -10, runs: ["未纳入结果的样本保留排除依据"] },
  ], 84, 520, 510, 100, { fontSize: 16, color: C.ink, lineSpacing: 1.18 });
  addBox(slide, "s1-access", 648, 462, 570, 178, C.grayPale, C.line, 12);
  addText(slide, "s1-access-title", "开放边界", 670, 480, 180, 26, { fontSize: 21, color: C.deep, bold: true });
  addText(slide, "s1-access-body", [
    { bulletCharacter: "•", marginLeft: 20, indent: -10, runs: ["记录完整 ≠ 全部文件开放"] },
    { bulletCharacter: "•", marginLeft: 20, indent: -10, runs: ["讨论材料含结果图与可公开解释"] },
    { bulletCharacter: "•", marginLeft: 20, indent: -10, runs: ["受限数据保留原授权位置"] },
    { bulletCharacter: "•", marginLeft: 20, indent: -10, runs: ["记录只含受控引用与访问条件；路径不代表访问权"] },
  ], 670, 520, 520, 108, { fontSize: 15, color: C.ink, lineSpacing: 1.1 });
  addNotes(slide);
}

// Slide 2 — scope choice
{
  const slide = presentation.slides.add();
  pageChrome(slide, 2, "SCOPE CHOICE", "新增实验先行，历史结果按需补齐", "这是范围选择：先确保新增记录可复核，再把有限精力用于真正需要复核的历史结果。");
  addBox(slide, "s2-recommendation", 62, 160, 1156, 70, C.pale, "#B9CFE2", 12);
  addBox(slide, "s2-rec-tag", 82, 178, 88, 34, C.navy, C.navy, 17);
  addText(slide, "s2-rec-tag-text", "建议", 82, 185, 88, 18, { fontSize: 16, color: C.white, bold: true, alignment: "center" });
  addText(slide, "s2-rec-body", "先记录新增；对真正需要复核的历史结果逐项补充。", 194, 179, 990, 30, { fontSize: 23, color: C.deep, bold: true });

  addBox(slide, "s2-history", 62, 254, 560, 318, C.white, C.line, 12, "shadow-sm");
  addText(slide, "s2-history-kicker", "路径 A  ·  集中补历史", 86, 276, 320, 22, { fontSize: 14, color: C.muted, bold: true });
  addText(slide, "s2-history-title", "一次形成较大目录", 86, 307, 480, 34, { fontSize: 24, color: C.deep, bold: true });
  addLine(slide, "s2-history-rule", 86, 350, 510, 0, C.line, 1);
  addText(slide, "s2-history-body", [
    { bulletCharacter: "•", marginLeft: 22, indent: -12, runs: ["一次性补齐大量历史材料"] },
    { bulletCharacter: "•", marginLeft: 22, indent: -12, runs: ["追查遗失上下文耗时"] },
    { bulletCharacter: "•", marginLeft: 22, indent: -12, runs: ["不确定记忆可能被写成确定说明"] },
  ], 86, 374, 488, 126, { fontSize: 18, color: C.ink, lineSpacing: 1.18 });
  addText(slide, "s2-history-foot", "适合已有明确追溯需求的个别结果", 86, 526, 480, 22, { fontSize: 14, color: C.muted, italic: true });

  addBox(slide, "s2-new", 658, 254, 560, 318, C.tealPale, "#9FC8CC", 12, "shadow-sm");
  addText(slide, "s2-new-kicker", "路径 B  ·  先记新增 + 逐项补历史", 682, 276, 420, 22, { fontSize: 14, color: C.teal, bold: true });
  addText(slide, "s2-new-title", "优先捕捉清楚的上下文", 682, 307, 500, 34, { fontSize: 24, color: C.deep, bold: true });
  addLine(slide, "s2-new-rule", 682, 350, 510, 0, "#BFDADC", 1);
  addText(slide, "s2-new-body", [
    { bulletCharacter: "•", marginLeft: 22, indent: -12, runs: ["新增实验：上下文清楚时立即记录"] },
    { bulletCharacter: "•", marginLeft: 22, indent: -12, runs: ["历史结果：真正需要复核时逐项补充"] },
    { bulletCharacter: "•", marginLeft: 22, indent: -12, runs: ["短期无法解决全部历史材料追溯"] },
  ], 682, 374, 488, 126, { fontSize: 18, color: C.ink, lineSpacing: 1.18 });
  addText(slide, "s2-new-foot", "建议先保障新增记录的可复核性", 682, 526, 480, 22, { fontSize: 14, color: C.teal, italic: true });

  addBox(slide, "s2-scope-boundary", 62, 596, 1156, 48, C.amberPale, "#E5C889", 10);
  addText(slide, "s2-scope-boundary-text", "判断边界  ·  这是范围选择，不代表已经证明效率提升。", 84, 609, 1100, 22, { fontSize: 17, color: "#805A1E", bold: true });
  addNotes(slide);
}

// Slide 3 — review process
{
  const slide = presentation.slides.add();
  pageChrome(slide, 3, "REVIEW LOOP", "复核围绕“结果如何产生”，授权异常触发暂停", "记录先由执行者提交，再经定位、补充与负责人确认进入可讨论版本。");
  addText(slide, "s3-flow-label", "标准复核路径", 62, 163, 240, 22, { fontSize: 15, color: C.navy, bold: true });

  const stages = [
    ["01", "执行者提交", "结果记录\n受控引用"],
    ["02", "另一成员定位", "数据 · 脚本 · 条件\n提出缺项"],
    ["03", "执行者补充", "补齐记录缺项"],
    ["04", "负责人确认", "进入可讨论版本"],
  ];
  const stageShapes = [];
  const sx = 62, sy = 204, sw = 260, sh = 202, sg = 32;
  stages.forEach((s, i) => {
    const x = sx + i * (sw + sg);
    const card = addBox(slide, `s3-stage-${i + 1}`, x, sy, sw, sh, i === 3 ? C.pale : C.white, i === 3 ? C.blue : C.line, 12, "shadow-sm");
    stageShapes.push(card);
    addText(slide, `s3-stage-num-${i + 1}`, s[0], x + 18, sy + 18, 40, 22, { fontSize: 13, color: C.blue, bold: true });
    addText(slide, `s3-stage-title-${i + 1}`, s[1], x + 18, sy + 52, sw - 36, 42, { fontSize: 22, color: C.deep, bold: true, lineSpacing: 0.95 });
    addLine(slide, `s3-stage-line-${i + 1}`, x + 18, sy + 108, sw - 36, 0, i === 3 ? "#B8CFE2" : C.line, 1);
    addText(slide, `s3-stage-body-${i + 1}`, s[2], x + 18, sy + 128, sw - 36, 54, { fontSize: 18, color: C.ink, bold: i === 3, lineSpacing: 1.08 });
  });
  // Connectors are authored before the exception nodes so they remain behind labels.
  for (let i = 0; i < stageShapes.length - 1; i++) {
    slide.shapes.connect(stageShapes[i], stageShapes[i + 1], {
      kind: "straight",
      fromSide: "right",
      toSide: "left",
      line: { style: "solid", fill: C.blue, width: 2 },
      // Author the marker through `head` so artifact-tool emits an endpoint;
      // the post-export fix moves it from headEnd to the target-side tailEnd.
      head: { type: "triangle", width: "sm", length: "sm" },
    });
  }

  addText(slide, "s3-exception-label", "授权异常分支", 62, 438, 220, 22, { fontSize: 15, color: C.red, bold: true });
  const ex = [
    ["新增访问授权", C.redPale, "#E5B8B4", C.red],
    ["暂停共享", C.redPale, "#E5B8B4", C.red],
    ["负责人处理授权", C.amberPale, "#E5C889", "#805A1E"],
    ["继续", C.tealPale, "#BFDADC", C.teal],
  ];
  const exShapes = [];
  const exY = 466, exW = [244, 210, 288, 210], exGap = 30;
  let exX = 62;
  ex.forEach((e, i) => {
    const sh = addBox(slide, `s3-ex-${i + 1}`, exX, exY, exW[i], 74, e[1], e[2], 10);
    exShapes.push(sh);
    addText(slide, `s3-ex-text-${i + 1}`, e[0], exX + 12, exY + 24, exW[i] - 24, 24, { fontSize: 18, color: e[3], bold: true, alignment: "center" });
    exX += exW[i] + exGap;
  });
  for (let i = 0; i < exShapes.length - 1; i++) {
    slide.shapes.connect(exShapes[i], exShapes[i + 1], {
      kind: "straight",
      fromSide: "right",
      toSide: "left",
      line: { style: "solid", fill: i < 2 ? C.red : C.teal, width: 2 },
      head: { type: "triangle", width: "sm", length: "sm" },
    });
  }
  slide.shapes.connect(stageShapes[1], exShapes[0], {
    kind: "elbow",
    fromSide: "bottom",
    toSide: "top",
    line: { style: "dashed", fill: C.red, width: 2 },
    head: { type: "triangle", width: "sm", length: "sm" },
  });
  // Authorization resumes the review at the missing-item correction stage.
  slide.shapes.connect(exShapes[3], stageShapes[2], {
    kind: "elbow",
    fromSide: "top",
    toSide: "bottom",
    line: { style: "dashed", fill: C.teal, width: 2 },
    head: { type: "triangle", width: "sm", length: "sm" },
  });

  addBox(slide, "s3-boundary", 62, 574, 1156, 66, C.grayPale, C.line, 10);
  addText(slide, "s3-boundary-title", "复核边界", 84, 590, 110, 22, { fontSize: 17, color: C.deep, bold: true });
  addText(slide, "s3-boundary-body", "检查结果如何产生；不要求复做实验，也不代替科学结论审查。", 210, 589, 970, 24, { fontSize: 17, color: C.ink });
  addNotes(slide);
}

// Slide 4 — pilot decision
{
  const slide = presentation.slides.add();
  pageChrome(slide, 4, "FOUR-WEEK PILOT", "四周试点用真实复核过程决定去留", "小范围记录新增实验，以实际复核体验和成员反馈形成保留、修改或停止的判断。");
  addBox(slide, "s4-scope", 62, 158, 1156, 62, C.pale, "#B9CFE2", 12);
  addText(slide, "s4-scope-label", "试点范围", 84, 177, 110, 22, { fontSize: 17, color: C.navy, bold: true });
  const scopeItems = ["一个课题方向", "两名自愿成员", "记录新增实验"];
  scopeItems.forEach((t, i) => {
    const x = 236 + i * 300;
    addBox(slide, `s4-scope-${i + 1}`, x, 172, 246, 34, C.white, "#C8D9E7", 17);
    addText(slide, `s4-scope-text-${i + 1}`, t, x, 180, 246, 18, { fontSize: 15, color: C.deep, bold: true, alignment: "center" });
  });

  addText(slide, "s4-timeline-label", "试点节奏", 62, 244, 180, 22, { fontSize: 15, color: C.navy, bold: true });
  addLine(slide, "s4-timeline", 126, 322, 1030, 0, C.blue, 3);
  const marks = [126, 430, 734, 1156];
  marks.forEach((x, i) => {
    slide.shapes.add({ geometry: "ellipse", name: `s4-mark-${i + 1}`, position: { left: x - 10, top: 312, width: 20, height: 20 }, fill: C.white, line: { style: "solid", fill: C.blue, width: 3 } });
    addText(slide, `s4-week-${i + 1}`, `第${i + 1}周`, x - 38, 278, 76, 22, { fontSize: 14, color: C.blue, bold: true, alignment: "center" });
  });
  addText(slide, "s4-week-23", "第2–3周", 506, 278, 120, 22, { fontSize: 14, color: C.blue, bold: true, alignment: "center" });

  addBox(slide, "s4-week1-card", 62, 352, 300, 158, C.white, C.line, 12, "shadow-sm");
  addText(slide, "s4-week1-title", "确认并试填", 84, 376, 250, 28, { fontSize: 22, color: C.deep, bold: true });
  addText(slide, "s4-week1-body", "确认最少字段\n试填一个结果", 84, 420, 250, 54, { fontSize: 18, color: C.ink, lineSpacing: 1.15 });

  addBox(slide, "s4-week23-card", 390, 352, 470, 158, C.pale, "#B9CFE2", 12, "shadow-sm");
  addText(slide, "s4-week23-title", "观察记录负担", 414, 376, 390, 28, { fontSize: 22, color: C.deep, bold: true });
  addText(slide, "s4-week23-body", "记录缺项与填写负担，持续记录新增实验。", 414, 420, 410, 54, { fontSize: 18, color: C.ink, lineSpacing: 1.15 });

  addBox(slide, "s4-week4-card", 888, 352, 330, 158, C.tealPale, "#BFDADC", 12, "shadow-sm");
  addText(slide, "s4-week4-title", "决定去留", 912, 376, 280, 28, { fontSize: 22, color: C.teal, bold: true });
  addText(slide, "s4-week4-body", "保留、修改或停止", 912, 420, 280, 54, { fontSize: 18, color: C.ink, bold: true });

  addBox(slide, "s4-eval", 62, 532, 560, 108, C.white, C.line, 12);
  addText(slide, "s4-eval-title", "评估依据", 84, 550, 150, 22, { fontSize: 18, color: C.deep, bold: true });
  addText(slide, "s4-eval-body", "来源能否定位  ·  处理与排除依据能否理解  ·  负担是否愿意长期承担", 84, 584, 506, 38, { fontSize: 15, color: C.ink, lineSpacing: 1.1 });

  addBox(slide, "s4-stop", 648, 532, 570, 108, C.redPale, "#E5B8B4", 12);
  addText(slide, "s4-stop-title", "调整或停止触发", 670, 550, 220, 22, { fontSize: 18, color: C.red, bold: true });
  addText(slide, "s4-stop-body", "持续挤占实验时间、权限不明、只有重复抄写而不帮助解释结果 → 缩小要求或停止", 670, 582, 522, 40, { fontSize: 15, color: C.ink, lineSpacing: 1.06 });
  addText(slide, "s4-boundary", "依据具体复核过程及成员反馈，不设统一分数  ·  范围为拟定，没有实测效率或完成率。", 62, 651, 1156, 18, { fontSize: 12, color: C.muted, italic: true });
  addNotes(slide);
}

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

async function fixConnectorArrowEndpoints(path) {
  // artifact-tool's current PPTX writer omits a tail-only endpoint and maps a
  // head-only endpoint to <a:headEnd>. Move the authored target arrowheads to
  // DrawingML tailEnd after export so the editable connector still points from
  // the source node to the target node.
  const zip = await JSZip.loadAsync(await fs.readFile(path));
  const entry = zip.file("ppt/slides/slide3.xml");
  if (!entry) throw new Error("ppt/slides/slide3.xml not found");
  let xml = await entry.async("string");
  const count = (xml.match(/<a:headEnd\b/g) ?? []).length;
  if (count !== 8) throw new Error(`Expected 8 slide-3 connector arrowheads, found ${count}`);
  xml = xml.replace(/<a:headEnd\b([^>]*)\/>/g, "<a:tailEnd$1/>");
  zip.file("ppt/slides/slide3.xml", xml);
  await fs.writeFile(path, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  return count;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  for (const [idx, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(idx + 1).padStart(2, "0")}`;
    await fs.writeFile(`${OUT}/${stem}.layout.json`, await (await slide.export({ format: "layout" })).text());
    await writeBlob(`${OUT}/${stem}.preview.png`, await presentation.export({ slide, format: "png", scale: 1 }));
  }
  await writeBlob(`${OUT}/deck-montage.webp`, await presentation.export({ format: "webp", montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(`${OUT}/deck.pptx`);
  await fixConnectorArrowEndpoints(`${OUT}/deck.pptx`);
  const inspect = await presentation.inspect({ kind: "slide,textbox,shape,notes", maxChars: 30000 });
  await fs.writeFile(`${OUT}/inspect.ndjson`, inspect.ndjson ?? String(inspect));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
