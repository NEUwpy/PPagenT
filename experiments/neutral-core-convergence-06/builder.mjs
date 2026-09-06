import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { planConvergence } from "./adapter.mjs";

const runDir = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(runDir, "build");
const evidenceDir = path.join(runDir, "evidence");
const candidatePath = path.join(buildDir, "candidate.pptx");
const casesPath = path.join(runDir, "cases.json");

const C = Object.freeze({
  bg: "#F5F4EF",
  surface: "#EEECE5",
  ink: "#20201D",
  body: "#4B4A45",
  muted: "#85837B",
  line: "#D8D5CC",
  curves: ["#DCC1BA", "#C2948B", "#A35D4F"],
});
const SERIF = "Noto Serif SC";
const SANS = "Noto Sans SC";

function addText(slide, value, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: style.name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = String(value ?? "");
  shape.text.style = {
    typeface: style.typeface ?? SANS,
    fontSize: style.fontSize ?? 17,
    color: style.color ?? C.body,
    bold: style.bold ?? false,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "middle",
    lineSpacing: style.lineSpacing ?? 1,
    autoFit: "none",
    insets: style.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

function addRule(slide, x1, y1, x2, y2, name, color = C.line, width = 1) {
  return slide.shapes.add({
    geometry: "line",
    name,
    position: {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
      horizontalFlip: x2 < x1,
      verticalFlip: y2 < y1,
    },
    fill: "none",
    line: { style: "solid", fill: color, width },
  });
}

function addLane(slide, lane, slideIndex) {
  const points = lane.points ?? [];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(1, Math.max(...xs) - left);
  const height = Math.max(1, Math.max(...ys) - top);
  const commands = points.map((point, index) => (index === 0
    ? { moveTo: { x: point.x - left, y: point.y - top } }
    : { lineTo: { x: point.x - left, y: point.y - top } }));
  return slide.shapes.add({
    geometry: "custom",
    name: `convergence-${slideIndex}-lane-${lane.index + 1}`,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: C.curves[lane.index] ?? C.curves[2], width: 10 },
    customPaths: [{ id: `convergence-${slideIndex}-path-${lane.index + 1}`, width, height, commands }],
  });
}

function addNode(slide, node, kind, index, slideIndex) {
  const prefix = `convergence-${slideIndex}-${kind}-${index}`;
  slide.shapes.add({
    geometry: "roundRect",
    name: `${prefix}-box`,
    position: { left: node.left, top: node.top, width: node.width, height: node.height },
    fill: kind === "result" ? C.surface : C.bg,
    line: { style: "solid", fill: kind === "result" ? C.curves[2] : C.line, width: kind === "result" ? 2 : 1 },
    shadow: "shadow-none",
    borderRadius: kind === "result" ? 22 : 12,
  });
  addText(slide, node.title, {
    left: node.left + 18,
    top: node.top + 14,
    width: node.width - 36,
    height: 30,
  }, {
    name: `${prefix}-title`,
    typeface: SERIF,
    fontSize: 21,
    bold: true,
    color: C.ink,
    alignment: kind === "result" ? "center" : "left",
  });
  addText(slide, (node.bodyLines ?? [node.body]).join("\n"), {
    left: node.left + 18,
    top: node.top + 48,
    width: node.width - 36,
    height: Math.max(24, node.height - 60),
  }, {
    name: `${prefix}-body`,
    typeface: SANS,
    fontSize: 17,
    color: C.body,
    alignment: kind === "result" ? "center" : "left",
    verticalAlignment: "top",
    lineSpacing: 1,
  });
}

function drawConvergence(slide, model, slideIndex) {
  model.lanes.forEach((lane) => addLane(slide, lane, slideIndex));
  model.inputs.forEach((node, index) => addNode(slide, node, "input", index + 1, slideIndex));
  addNode(slide, model.result, "result", 1, slideIndex);
}

function drawHeader(slide, page, title, lead) {
  addText(slide, String(page).padStart(2, "0"), { left: 56, top: 50, width: 32, height: 24 }, {
    name: `page-${page}-chapter`, fontSize: 17, color: C.curves[2],
  });
  addText(slide, title, { left: 100, top: 43, width: 450, height: 40 }, {
    name: `page-${page}-title`, typeface: SERIF, fontSize: 25, bold: true, color: C.ink,
  });
  addRule(slide, 570, 63, 1222, 63, `page-${page}-title-rule`);
  addText(slide, lead, { left: 56, top: 112, width: 760, height: 28 }, {
    name: `page-${page}-lead`, fontSize: 17, color: C.body,
  });
  addText(slide, String(page).padStart(2, "0"), { left: 1185, top: 678, width: 38, height: 18 }, {
    name: `page-${page}-folio`, fontSize: 13, color: C.muted, alignment: "right",
  });
}

function drawNotes(slide, page, title, intro, notes, x = 930, width = 280) {
  addText(slide, title, { left: x, top: 168, width, height: 30 }, {
    name: `page-${page}-notes-title`, typeface: SERIF, fontSize: 21, bold: true, color: C.ink,
  });
  addText(slide, intro, { left: x, top: 210, width, height: 52 }, {
    name: `page-${page}-notes-intro`, fontSize: 17, color: C.body, verticalAlignment: "top",
  });
  addRule(slide, x, 277, x + width, 277, `page-${page}-notes-rule`);
  notes.forEach((note, index) => {
    const y = 298 + index * 104;
    addText(slide, String(index + 1).padStart(2, "0"), { left: x, top: y, width: 28, height: 22 }, {
      name: `page-${page}-note-${index + 1}-index`, fontSize: 15, color: C.curves[2],
    });
    addText(slide, note.title, { left: x + 38, top: y - 2, width: width - 38, height: 28 }, {
      name: `page-${page}-note-${index + 1}-title`, typeface: SERIF, fontSize: 21, bold: true, color: C.ink,
    });
    addText(slide, note.body, { left: x + 38, top: y + 31, width: width - 38, height: 48 }, {
      name: `page-${page}-note-${index + 1}-body`, fontSize: 17, color: C.body, verticalAlignment: "top",
    });
    if (index < notes.length - 1) addRule(slide, x, y + 88, x + width, y + 88, `page-${page}-note-${index + 1}-rule`);
  });
}

const CASE_DEFS = [
  {
    id: "full-width-short",
    title: "三路资料汇成一份维修交接单",
    lead: "交接质量取决于三路信息能否共同进入一份交接单",
    frame: { left: 62, top: 190, width: 1156, height: 410 }, inputWidth: 300, resultWidth: 280,
    inputs: [
      { title: "现场记录", body: "故障现象与发生时间" },
      { title: "检测记录", body: "测量读数与测试条件" },
      { title: "备件记录", body: "替换型号与领用数量" },
    ],
    result: { title: "维修交接单", body: "让接班人员追溯本次处理" },
    footer: "三路资料地位相同，独立准备后共同进入交接单。",
  },
  {
    id: "half-width-short-with-note",
    title: "信息先并行准备，再交给接班人",
    lead: "三路资料没有先后筛选，也没有中间归纳阶段",
    frame: { left: 62, top: 180, width: 700, height: 400 }, inputWidth: 210, resultWidth: 180,
    inputs: [
      { title: "现场记录", body: "故障现象、发生时间" },
      { title: "检测记录", body: "读数、测试条件" },
      { title: "备件记录", body: "型号、领用数量" },
    ],
    result: { title: "维修交接单", body: "交接双方共同确认" },
    notesTitle: "交接使用边界",
    notesIntro: "共同结果进入交接环节前，仍需保留确认动作与事实边界。",
    notes: [
      { title: "交接确认", body: "交接单仍需由交接双方确认。" },
      { title: "缺失待补", body: "材料缺失时，标注“待补”。" },
      { title: "事实边界", body: "待补内容不能当作已核实事实。" },
    ],
  },
  {
    id: "wide-long-with-note",
    title: "长文字也要保留在同一份交接单里",
    lead: "信息更完整时，结构仍保留三路并行与唯一结果",
    frame: { left: 56, top: 168, width: 820, height: 460 }, inputWidth: 280, resultWidth: 220,
    inputs: [
      { title: "现场记录", body: "记录故障现象、发生时间，以及当班人员观察到的异常表现" },
      { title: "检测记录", body: "保留测量读数、测试条件，以及无法复现时的检查范围" },
      { title: "备件记录", body: "写清替换型号、领用数量，并注明是否完成旧件回收" },
    ],
    result: { title: "维修交接单", body: "让接班人员知道\n发生了什么、怎样检查\n以及换过什么" },
    notesTitle: "交接后的复查",
    notesIntro: "接班人员根据记录复查，\n未确认的事项继续保留。",
    notes: [
      { title: "内容关系", body: "三路资料地位相同，均为交接单的输入。" },
      { title: "事实边界", body: "完整记录不等于故障已经排除。" },
    ],
  },
];

function cloneCase(def) {
  return {
    frame: { ...def.frame },
    inputs: def.inputs.map((item) => ({ ...item })),
    result: { ...def.result },
    inputWidth: def.inputWidth,
    resultWidth: def.resultWidth,
  };
}

function tryPlan(def) {
  const attempts = [];
  let params = cloneCase(def);
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const result = planConvergence(params);
    attempts.push({ attempt: attempt + 1, params: structuredClone(params), result: { ok: result.ok, reason: result.reason, requiredWidth: result.requiredWidth, requiredHeight: result.requiredHeight } });
    if (result.ok) return { model: result, params, attempts };
    if (result.reason === "title-needs-more-width") {
      params.inputWidth += 24;
      params.resultWidth += 24;
    } else if (result.reason === "insufficient-text-height") {
      params.frame.height = Math.max(params.frame.height + 48, result.requiredHeight ?? params.frame.height + 48);
    } else if (result.reason === "insufficient-convergence-space") {
      const needed = Math.max(48, (result.requiredWidth ?? params.frame.width + 48) - params.frame.width + 24);
      params.frame.width += needed;
    } else {
      throw new Error(`${def.id}: convergence planning failed: ${result.reason}`);
    }
  }
  throw new Error(`${def.id}: convergence planning did not fit after retries`);
}

async function writeBlob(blob, output) {
  await fs.writeFile(output, Buffer.from(await blob.arrayBuffer()));
}

function buildSlide(presentation, def, page, planned) {
  const slide = presentation.slides.add();
  slide.background.fill = C.bg;
  drawHeader(slide, page, def.title, def.lead);
  drawConvergence(slide, planned.model, page);
  if (def.notes) {
    addRule(slide, 900, 150, 900, 626, `page-${page}-column-divider`);
    drawNotes(slide, page, def.notesTitle, def.notesIntro, def.notes, 940, 278);
  } else {
    addText(slide, def.footer, { left: 62, top: 644, width: 1080, height: 22 }, {
      name: `page-${page}-footer`, fontSize: 15, color: C.muted,
    });
  }
  slide.speakerNotes.textFrame.setText(
    `来源：experiments/neutral-structure-luna-batch-04/inputs/01-convergence.md。\n`
      + `本页使用 experiments/neutral-core-convergence-06/adapter.mjs 的 planConvergence；仅绘制其返回的节点与曲线。\n`
      + `几何核心为本实验独立的 core.mjs，未调用正式结构库，也不将本页表达写入核心资产。\n`
      + `页面内容保留三路资料共同进入维修交接单的事实边界，不宣称故障已经排除，也没有时间节约或完成率数据。`,
  );
  return slide;
}

async function main() {
  await fs.mkdir(buildDir, { recursive: true });
  await fs.mkdir(evidenceDir, { recursive: true });
  const plannedCases = CASE_DEFS.map(tryPlan);
  await fs.writeFile(casesPath, JSON.stringify({
    source: "builder actual successful planConvergence parameters",
    cases: plannedCases.map((entry, index) => ({ id: CASE_DEFS[index].id, selected: entry.params, attempts: entry.attempts })),
  }, null, 2), "utf8");

  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slides = plannedCases.map((entry, index) => buildSlide(presentation, CASE_DEFS[index], index + 1, entry));
  await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    await writeBlob(await presentation.export({ slide, format: "png", scale: 1 }), path.join(buildDir, `slide-${String(index + 1).padStart(2, "0")}.png`));
    await fs.writeFile(path.join(buildDir, `slide-${String(index + 1).padStart(2, "0")}.layout.json`), await (await slide.export({ format: "layout" })).text(), "utf8");
  }
  const inspect = await presentation.inspect({ kind: "slide,textbox,shape,image,notes,layout", maxChars: 240000 });
  await fs.writeFile(path.join(evidenceDir, "candidate-inspect.ndjson"), inspect.ndjson, "utf8");
  await fs.writeFile(path.join(evidenceDir, "build-result.json"), JSON.stringify({ candidatePath, casesPath, slideCount: slides.length }, null, 2), "utf8");
  console.log(JSON.stringify({ candidatePath, casesPath, previews: slides.length }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
