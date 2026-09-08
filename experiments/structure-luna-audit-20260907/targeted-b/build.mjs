import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile, FileBlob } from "@oai/artifact-tool";

const ROOT = "C:/PPagenT";
const DIR = path.join(ROOT, "experiments/structure-luna-audit-20260907/targeted-b");
const BUILD = path.join(DIR, "build");
const EVIDENCE = path.join(DIR, "evidence");
const INPUT = path.join(DIR, "input.json");
const OUT = path.join(DIR, "candidate.pptx");
const { invokeStructure } = await import(pathToFileURL(path.join(ROOT, ".codex/skills/ppagent-structure/scripts/invoke.mjs")).href);

const BODY = { left: 56, top: 150, width: 1168, height: 500 };
const FRAME = { left: 56, top: 150, width: 1168, height: 500 };
const C = {
  bg: "#F5F4EF", ink: "#20201D", body: "#4B4A45", muted: "#85837B", line: "#D8D5CC",
  blue: "#355C7D", blue2: "#6F97B5", pale: "#DCE8EF", white: "#FBFAF6", brick: "#A35D4F",
  deep: "#244979", gold: "#E4A35A",
};
const F = { display: "Noto Serif SC", body: "Noto Sans SC" };

function addText(slide, value, frame, style = {}) {
  const s = slide.shapes.add({ geometry: "textbox", name: style.name, position: frame, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
  s.text = String(value ?? "");
  s.text.style = {
    typeface: style.typeface ?? F.body, fontSize: style.fontSize ?? 17, color: style.color ?? C.body,
    bold: style.bold ?? false, alignment: style.alignment ?? "left", verticalAlignment: style.verticalAlignment ?? "top",
    autoFit: "none", lineSpacing: style.lineSpacing ?? 1, insets: style.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return s;
}
function shape(slide, geometry, frame, style = {}) {
  return slide.shapes.add({ geometry, name: style.name, position: frame, fill: style.fill ?? "none", line: style.line ?? { style: "solid", fill: "none", width: 0 }, shadow: style.shadow, borderRadius: style.borderRadius, customPaths: style.customPaths });
}
function panel(slide, frame, fill = C.white, stroke = C.line, radius = 12, name) {
  return shape(slide, "roundRect", frame, { name, fill, borderRadius: radius, line: { style: "solid", fill: stroke, width: 1 } });
}
function ellipse(slide, frame, fill = C.white, stroke = C.blue, width = 1.5, name) {
  return shape(slide, "ellipse", frame, { name, fill, line: { style: "solid", fill: stroke, width } });
}
function diamond(slide, frame, fill = C.blue, stroke = C.blue, name) {
  return shape(slide, "diamond", frame, { name, fill, line: { style: "solid", fill: stroke, width: 1.5 } });
}
function line(slide, x1, y1, x2, y2, color = C.line, width = 1.5, name, dashed = false) {
  return shape(slide, "line", { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.max(Math.abs(x2 - x1), 1), height: Math.max(Math.abs(y2 - y1), 1), horizontalFlip: x2 < x1, verticalFlip: y2 < y1 }, { name, line: { style: dashed ? "dashed" : "solid", fill: color, width } });
}
function label(slide, text, x, y, w, h, opts = {}) {
  return addText(slide, text, { left: x, top: y, width: w, height: h }, {
    fontSize: opts.size ?? 15, color: opts.color ?? C.body, bold: opts.bold ?? false,
    alignment: opts.align ?? "left", verticalAlignment: opts.valign ?? "middle", typeface: opts.serif ? F.display : F.body,
    name: opts.name,
  });
}
function addHeader(slide, index, title, lead) {
  slide.background.fill = C.bg;
  label(slide, String(index).padStart(2, "0"), 56, 35, 32, 24, { serif: true, size: 16, color: C.brick, name: `page-${index}-index` });
  label(slide, title, 100, 28, 820, 38, { serif: true, size: 25, color: C.ink, bold: true, name: `page-${index}-title` });
  line(slide, 920, 48, 1222, 48, C.line, 1, `page-${index}-rule`);
  label(slide, lead, 56, 94, 1110, 26, { size: 16, color: C.body, name: `page-${index}-lead` });
  label(slide, String(index).padStart(2, "0"), 1182, 678, 40, 18, { size: 13, color: C.muted, align: "right", name: `page-${index}-folio` });
}
function note(slide, text) { slide.speakerNotes.textFrame.setText(text); }

function buildBranching(slide, frame) {
  // The authored guide caps the review component at four paths. This targeted case
  // has five explicit mutually exclusive states, so the same single-decision grammar
  // is recomputed at five columns to preserve every condition without inventing a merge.
  const items = [
    { condition: "齐全且有效", title: "进入评审", body: "材料满足评审要求", outcome: "评审" },
    { condition: "缺证明", title: "通知补交", body: "列明缺失证明文件", outcome: "补交" },
    { condition: "文件过期", title: "要求更新", body: "更新后重新核验有效期", outcome: "更新" },
    { condition: "特殊权限", title: "转专人确认", body: "由授权人员核对权限", outcome: "专人确认" },
    { condition: "主动撤回", title: "终止处理", body: "保留撤回记录并结束", outcome: "终止" },
  ];
  const cx = frame.left + frame.width / 2;
  const top = frame.top;
  const context = panel(slide, { left: cx - 365, top, width: 730, height: 70 }, C.deep, C.deep, 18, "decision-context-card");
  label(slide, "申请进入材料检查", cx - 335, top + 10, 670, 26, { size: 21, color: C.white, bold: true, align: "center", name: "decision-context-title" });
  label(slide, "依据当前材料状态路由下一步", cx - 335, top + 39, 670, 20, { size: 14, color: C.pale, align: "center", name: "decision-context-body" });
  const diamondFrame = { left: cx - 110, top: top + 104, width: 220, height: 110 };
  const decision = diamond(slide, diamondFrame, C.blue, C.blue, "decision-node");
  label(slide, "材料状态\n是否满足", cx - 70, top + 138, 140, 42, { size: 17, color: C.white, bold: true, align: "center", valign: "middle", name: "decision-title" });
  line(slide, cx, top + 70, cx, top + 104, C.blue2, 2, "context-decision-link", true);
  const branchY = top + 238;
  line(slide, cx, top + 214, cx, branchY, C.blue2, 2, "decision-bus-link", true);
  const groupWidth = 1060;
  const gap = 18;
  const cardWidth = (groupWidth - gap * (items.length - 1)) / items.length;
  const left = cx - groupWidth / 2;
  const centers = items.map((_, i) => left + i * (cardWidth + gap) + cardWidth / 2);
  line(slide, centers[0], branchY, centers.at(-1), branchY, C.blue2, 2.5, "decision-branch-bus");
  items.forEach((item, i) => {
    const x = centers[i];
    line(slide, x, branchY, x, top + 272, C.blue2, 2, `decision-branch-link-${i}`);
    ellipse(slide, { left: x - 4, top: branchY - 4, width: 8, height: 8 }, C.white, C.blue2, 2, `decision-branch-anchor-${i}`);
    panel(slide, { left: x - Math.min(60, cardWidth / 2 - 8), top: top + 250, width: Math.min(120, cardWidth - 16), height: 30 }, C.white, C.blue2, 15, `branch-condition-${i}`);
    label(slide, item.condition, x - Math.min(56, cardWidth / 2 - 12), top + 256, Math.min(112, cardWidth - 24), 18, { size: 12.5, color: C.blue, bold: true, align: "center", name: `branch-condition-${i}-text` });
    panel(slide, { left: x - cardWidth / 2, top: top + 288, width: cardWidth, height: 132 }, i === 0 ? "#E3EDF3" : C.white, C.line, 14, `branch-route-card-${i}`);
    shape(slide, "roundRect", { left: x - cardWidth / 2, top: top + 288, width: cardWidth, height: 9 }, { name: `branch-route-accent-${i}`, fill: i === 0 ? C.blue : C.blue2, line: { style: "solid", fill: i === 0 ? C.blue : C.blue2, width: 0 }, borderRadius: 4 });
    label(slide, item.title, x - cardWidth / 2 + 8, top + 314, cardWidth - 16, 26, { size: 16, color: C.deep, bold: true, align: "center", name: `branch-title-${i}` });
    label(slide, item.body, x - cardWidth / 2 + 8, top + 349, cardWidth - 16, 34, { size: 12.5, color: C.body, align: "center", valign: "top", name: `branch-body-${i}` });
    line(slide, x, top + 420, x, top + 442, C.blue2, 1.5, `branch-outcome-link-${i}`, true);
    panel(slide, { left: x - Math.min(70, cardWidth / 2 - 8), top: top + 442, width: Math.min(140, cardWidth - 16), height: 32 }, "#E8F2FC", "#C5DBF1", 16, `branch-outcome-${i}`);
    label(slide, item.outcome, x - Math.min(66, cardWidth / 2 - 12), top + 449, Math.min(132, cardWidth - 24), 18, { size: 12, color: C.blue, bold: true, align: "center", name: `branch-outcome-${i}-text` });
  });
}

function projectPoint(angle, scene) {
  const r = angle * Math.PI / 180;
  const depth = Math.sin(r);
  const scale = 1 + depth * scene.perspectiveScale;
  return { x: scene.centerX + Math.cos(r) * scene.radiusX, y: scene.centerY + depth * scene.radiusY, depth, scale };
}
function buildConsensus(slide, frame) {
  const scene = { centerX: frame.left + 530, centerY: frame.top + 232, radiusX: 430, radiusY: 150, perspectiveScale: 0.12 };
  const field = { left: scene.centerX - 190, top: scene.centerY - 74, width: 380, height: 148 };
  const back = shape(slide, "ellipse", { left: field.left + 3, top: field.top + 10, width: field.width, height: field.height }, { name: "consensus-field-base", fill: "#B9CDE4", line: { style: "solid", fill: "#B9CDE4", width: 0 } });
  shape(slide, "ellipse", field, { name: "consensus-field-outer", fill: "#D7E5F5", line: { style: "solid", fill: "#B8CEE7", width: 1 } });
  shape(slide, "ellipse", { left: field.left + 15, top: field.top + 14, width: field.width - 30, height: field.height - 28 }, { name: "consensus-field-inner", fill: C.white, line: { style: "solid", fill: C.white, width: 1 } });
  label(slide, "共同交付约定", field.left + 45, field.top + 25, field.width - 90, 28, { size: 19, color: C.deep, bold: true, serif: true, align: "center", name: "shared-consensus-title" });
  ["明确验收依据", "保留问题记录", "约定反馈责任"].forEach((t, i) => {
    panel(slide, { left: field.left + 42 + i * 100, top: field.top + 78, width: 92, height: 30 }, "#E8F1FB", "#C8D9EC", 15, `shared-consensus-item-${i}-surface`);
    label(slide, t, field.left + 45 + i * 100, field.top + 85, 86, 16, { size: 11.5, color: "#416489", align: "center", name: `shared-consensus-item-${i}` });
  });
  // Orbit is intentionally split into front and back arcs, with no arrows.
  const orbit = [];
  for (let i = 0; i < 48; i += 1) {
    const a = 180 + 180 * i / 47; const p = projectPoint(a, scene); orbit.push(p);
  }
  const orbitBack = [];
  for (let i = 0; i < 48; i += 1) {
    const a = 0 + 180 * i / 47; const p = projectPoint(a, scene); orbitBack.push(p);
  }
  const orbitPath = (points, name, color, width, dashed) => {
    const cmds = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
    // A custom path is a native editable shape in artifact-tool and preserves the real review geometry.
    return shape(slide, "custom", { left: frame.left, top: frame.top, width: frame.width, height: frame.height }, { name, fill: "none", line: { style: dashed ? "dashed" : "solid", fill: color, width }, customPaths: [{ id: name, width: frame.width, height: frame.height, commands: [{ moveTo: { x: points[0].x - frame.left, y: points[0].y - frame.top } }, ...points.slice(1).map((p) => ({ lineTo: { x: p.x - frame.left, y: p.y - frame.top } }))] }] });
  };
  orbitPath(orbit, "consensus-orbit-back-5", "#D8E4F0", 1.4, true);
  orbitPath(orbitBack, "consensus-orbit-front-5", "#9FB9D6", 2.6, true);
  const actors = [
    { title: "研发", body: "可实现 · 可维护", icon: "R" },
    { title: "业务", body: "流程适用", icon: "B" },
    { title: "运营", body: "可接管", icon: "O" },
    { title: "质量", body: "可追溯", icon: "Q" },
    { title: "客户", body: "使用结果", icon: "C" },
  ];
  const start = -114;
  actors.forEach((item, i) => {
    const p = projectPoint(start + i * 360 / actors.length, scene);
    const w = 205 * p.scale; const h = 58 * p.scale; const x = p.x - w / 2; const y = p.y - h / 2;
    const tone = ["#315B96", "#38649F", "#426DA8", "#4F78B0", "#5B82B8"][i];
    ellipse(slide, { left: x + 3, top: y + 11, width: w, height: h }, "#244979", "#244979", 0, `actor-base-${i}`);
    ellipse(slide, { left: x, top: y, width: w, height: h }, tone, C.white, 2, `actor-surface-${i}`);
    ellipse(slide, { left: x + 9, top: y + 7, width: Math.max(20, w - 18), height: Math.max(20, h - 14) }, "none", "#DCE8EF", 1, `actor-surface-ring-${i}`);
    ellipse(slide, { left: p.x - 29, top: y + 15, width: 58, height: 18 }, "#88532E", "#88532E", 0, `actor-icon-foot-${i}`);
    ellipse(slide, { left: p.x - 27, top: y - 40, width: 54, height: 54 }, "#E4A35A", "#F6D08D", 1.2, `actor-icon-${i}`);
    label(slide, item.icon, p.x - 27, y - 31, 54, 34, { size: 20, color: C.white, bold: true, align: "center", name: `actor-icon-label-${i}` });
    label(slide, item.title, p.x - 105, y + h + 10, 210, 22, { size: 17, color: C.deep, bold: true, align: "center", name: `set-${i}-title` });
    label(slide, item.body, p.x - 110, y + h + 34, 220, 22, { size: 13, color: C.muted, align: "center", name: `set-${i}-body` });
  });
}

const definitions = [
  {
    caseId: "case-02", title: "材料完整性决定下一步处理", lead: "五种材料状态各自对应一条互斥路径", assetId: "branching-decision-routes-001",
    preservedFeatures: ["单入口连接菱形判断，再由共同总线扇出", "条件标签贴近各自分支线，动作分支等权", "可选结果与所属动作直接相连"],
    changes: ["按真实稿件重算为五路并保留全部互斥条件", "沿用真实 review.mjs 的 1170×492 几何锚点并用中性杂志 Skin 适配"],
    build: buildBranching,
    content: { type: "branching-decision", context: { title: "申请进入材料检查" }, decision: { title: "材料状态是否满足" }, branches: ["齐全且有效", "缺证明", "文件过期", "涉及特殊权限", "主动撤回"] },
    manuscript: "申请统一进入材料检查。齐全且有效：进入评审；缺证明：通知补交；文件过期：要求更新；涉及特殊权限：转专人确认；主动撤回：终止处理。各路径互斥，判断依据是当前材料状态，不虚构完成结果。",
    boundary: "该稿件有 5 个互斥条件，超过资产 authored guide 的 2–4 路范围；本次按同一单判断拓扑扩展为 5 路，确保五个条件均可见并独立连至动作。",
  },
  {
    caseId: "case-08", title: "不同参与方形成共同交付约定", lead: "五方保留独立关注，共同汇入三条交付约定", assetId: "containment-consensus-field-005",
    preservedFeatures: ["独立主体围绕中央共识场分布", "共同内容位于中央，外围图标立于圆台", "椭圆轨道无方向，名称位于圆台之外"],
    changes: ["将五方关注点完整放入外围圆台与外侧文字", "中央共识场保留三条共同约定并适配中性杂志 Skin"],
    build: buildConsensus,
    content: { type: "multi-set-common-intersection", setIds: ["研发", "业务", "运营", "质量", "客户"], shared: { title: "共同交付约定", points: ["明确验收依据", "保留问题记录", "约定反馈责任"] } },
    manuscript: "研发关注可实现与可维护；业务关注流程适用；运营关注可接管；质量关注可追溯；客户关注使用结果。五方保持独立，共同约定只有三条：明确验收依据、保留问题记录、约定反馈责任。此图表达共识，不表达进度或汇报关系。",
    boundary: "五方在资产支持的 2–5 个主体范围内；轨道不加箭头，不表达进度或汇报关系。",
  },
];

async function main() {
  await fs.mkdir(BUILD, { recursive: true });
  await fs.mkdir(EVIDENCE, { recursive: true });
  await fs.writeFile(INPUT, JSON.stringify(definitions.map(({ caseId, title, manuscript }) => ({ caseId, title, manuscript })), null, 2), "utf8");
  const evidencePath = path.join(EVIDENCE, "structure-invocations.ndjson");
  await fs.writeFile(evidencePath, "", "utf8");
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const choices = [];
  for (let i = 0; i < definitions.length; i += 1) {
    const d = definitions[i];
    const slide = presentation.slides.add();
    addHeader(slide, i + 1, d.title, d.lead);
    const result = await invokeStructure({
      root: ROOT, slide,
      skin: { id: "neutral-editorial-001", bodyFrame: BODY, componentTheme: { font: F.body, background: C.bg, surface: C.white, dark: C.ink, body: C.body, muted: C.muted, line: C.line, primaryColor: C.blue } },
      targetFrame: FRAME, content: { caseId: d.caseId, title: d.title, manuscript: d.manuscript, structuredData: d.content },
      references: [{ assetId: d.assetId, preservedFeatures: d.preservedFeatures, changes: d.changes }],
      evidencePath, pageId: d.caseId, regionId: "native-structure", reason: `定向实测指定使用 ${d.assetId}，稿件语义要求保留互斥条件或共同共识场。`,
      build: ({ slide: nativeSlide, frame }) => d.build(nativeSlide, frame),
    });
    note(slide, `[Sources]\n内容：experiments/structure-luna-audit-20260907/batch-2/input.json · ${d.caseId}\n结构参考：${d.assetId}\n保留特征：${d.preservedFeatures.join("；")}\n适配变化：${d.changes.join("；")}\n执行边界：${d.boundary}\n本页由 invokeStructure 新接口执行，图形与文字均为原生可编辑对象。`);
    choices.push({ caseId: d.caseId, selectionMode: "targeted-manual", selectedAssetIds: [d.assetId], reason: `用户指定定向实测 ${d.assetId}，不是自然候选选择。`, preservedFeatures: d.preservedFeatures, changes: d.changes, invocationStatus: result.validation, boundary: d.boundary });
  }
  await fs.writeFile(path.join(DIR, "choice.json"), JSON.stringify(choices, null, 2), "utf8");
  const exported = await PresentationFile.exportPptx(presentation);
  await exported.save(OUT);
  const imported = await PresentationFile.importPptx(await FileBlob.load(OUT));
  const layoutDir = path.join(DIR, "layout"); const renderDir = path.join(DIR, "rendered");
  await fs.mkdir(layoutDir, { recursive: true }); await fs.mkdir(renderDir, { recursive: true });
  const slides = imported.slides.items;
  for (let i = 0; i < slides.length; i += 1) {
    const s = slides[i];
    await fs.writeFile(path.join(layoutDir, `slide-${String(i + 1).padStart(2, "0")}.layout.json`), await (await s.export({ format: "layout" })).text(), "utf8");
    const png = await imported.export({ slide: s, format: "png", scale: 1 });
    await fs.writeFile(path.join(renderDir, `slide-${String(i + 1).padStart(2, "0")}.png`), Buffer.from(await png.arrayBuffer()));
  }
  const inspect = await imported.inspect({ kind: "slide,textbox,shape,notes,layout", maxChars: 500000 });
  await fs.writeFile(path.join(EVIDENCE, "reimport-inspect.ndjson"), inspect.ndjson, "utf8");
  await fs.writeFile(path.join(DIR, "progress.md"), "# Targeted B progress\n\n- Scope: case-02 + case-08 only, both selected manually as specified.\n- Native invocation: completed through `invokeStructure({ references, content, targetFrame, build })`.\n- Outputs: candidate PPTX, reimported layout JSON, per-slide PNG, invocation and inspect NDJSON.\n- Boundary: case-02 has five mutually exclusive conditions while the authored decision guide documents 2–4; the targeted build recomputes the same single-diamond grammar to five equal routes so no condition is omitted.\n", "utf8");
  console.log(JSON.stringify({ out: OUT, slides: slides.length, evidencePath, renderDir, layoutDir }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
