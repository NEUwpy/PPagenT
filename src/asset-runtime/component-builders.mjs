import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { protectChineseLineBreaks, wrapChineseText } from "../render/chinese-typography.mjs";

export const THEME = {
  background: "#F7FAFC",
  surface: "#FFFFFF",
  accent: "#1677C8",
  accentAlt: "#00A8D8",
  accentSoft: "#DCEEFF",
  cyan: "#14CBD1",
  dark: "#0F172A",
  body: "#475569",
  muted: "#7C8A9A",
  line: "#C9D5E3",
  font: "Microsoft YaHei",
  typography: {
    componentHeading: 26,
    componentTitle: 24,
    componentItemTitle: 19,
    componentBody: 18,
    componentLabel: 17,
    componentMeta: 16,
  },
};

const EMBEDDED_SLIDES = new WeakMap();

function embeddedContext(slide) {
  return EMBEDDED_SLIDES.get(slide) ?? null;
}

export function isEmbeddedSlide(slide) {
  return EMBEDDED_SLIDES.has(slide);
}

export function computeContainedFrame(sourceFrame, targetFrame) {
  const scale = Math.min(
    targetFrame.width / sourceFrame.width,
    targetFrame.height / sourceFrame.height,
  );
  const width = sourceFrame.width * scale;
  const height = sourceFrame.height * scale;
  return {
    left: targetFrame.left + (targetFrame.width - width) / 2,
    top: targetFrame.top + (targetFrame.height - height) / 2,
    width,
    height,
    scale,
  };
}

export function transformPositionInContainedFrame(position, sourceFrame, targetFrame) {
  const fittedFrame = computeContainedFrame(sourceFrame, targetFrame);
  return {
    ...position,
    left: fittedFrame.left + (position.left - sourceFrame.left) * fittedFrame.scale,
    top: fittedFrame.top + (position.top - sourceFrame.top) * fittedFrame.scale,
    width: position.width * fittedFrame.scale,
    height: position.height * fittedFrame.scale,
  };
}

function transformPosition(slide, position) {
  const context = embeddedContext(slide);
  if (!context) return position;
  return transformPositionInContainedFrame(position, context.sourceFrame, context.targetFrame);
}

function transformFontSize(slide, fontSize) {
  const context = embeddedContext(slide);
  if (!context) return fontSize;
  const scale = context.fittedFrame.scale;
  // Artifact/PPTX text layout may resolve a requested size a few percent lower
  // when shrink-to-fit is active. Keep the embedded request at 17pt or above
  // so the rendered result still clears PPagenT's 16pt delivery floor.
  return Math.max(17, Math.round(fontSize * scale));
}

export function typographySize(role, fallback) {
  return THEME.typography?.[role] ?? fallback;
}

export function qaElementName({ parent = "", within = "", domains = [], role = "" }) {
  const fields = [
    parent ? `parent=${parent}` : "",
    within ? `within=${within}` : "",
    domains.length ? `domains=${domains.join(",")}` : "",
    role ? `role=${role}` : "",
  ].filter(Boolean);
  return `PPAGENT_QA|${fields.join("|")}`;
}

export function connectorElementName({ from = "", fromSide = "", to = "", toSide = "" }) {
  const fields = [
    from ? `from=${from}` : "",
    fromSide ? `fromSide=${fromSide}` : "",
    to ? `to=${to}` : "",
    toSide ? `toSide=${toSide}` : "",
  ].filter(Boolean);
  return `PPAGENT_CONNECTOR|${fields.join("|")}`;
}

export function frameAnchor(frame, side) {
  const centerX = frame.left + frame.width / 2;
  const centerY = frame.top + frame.height / 2;
  if (side === "top") return { x: centerX, y: frame.top };
  if (side === "right") return { x: frame.left + frame.width, y: centerY };
  if (side === "bottom") return { x: centerX, y: frame.top + frame.height };
  if (side === "left") return { x: frame.left, y: centerY };
  if (side === "center") return { x: centerX, y: centerY };
  throw new Error(`不支持的连接锚点：${side}`);
}

export function addLine(slide, from, to, color = THEME.line, width = 2, name, style = "solid") {
  return slide.shapes.add({
    geometry: "line",
    name,
    position: transformPosition(slide, {
      left: Math.min(from.x, to.x),
      top: Math.min(from.y, to.y),
      width: Math.abs(to.x - from.x),
      height: Math.abs(to.y - from.y),
      horizontalFlip: to.x < from.x,
      verticalFlip: to.y < from.y,
    }),
    fill: "none",
    line: { style, fill: color, width },
  });
}

export function addAnchoredLine(slide, from, to, color = THEME.line, width = 2) {
  return addLine(
    slide,
    frameAnchor(from.frame, from.side),
    frameAnchor(to.frame, to.side),
    color,
    width,
    connectorElementName({
      from: from.parent,
      fromSide: from.side,
      to: to.parent,
      toSide: to.side,
    }),
  );
}

/**
 * 把既有结构资产绘制到 Skin 已经准备好的正文安全区。
 * builder 仍按 1280×720 的原始坐标工作，运行时只负责确定性缩放和主题替换。
 */
export function renderComponentIntoSlide(builder, slide, params, options) {
  const sourceFrame = options.sourceFrame ?? { left: 40, top: 135, width: 1200, height: 520 };
  const context = {
    sourceFrame,
    targetFrame: options.targetFrame,
  };
  if (!context.targetFrame) throw new Error("嵌入结构资产时必须提供 targetFrame");
  context.fittedFrame = computeContainedFrame(sourceFrame, context.targetFrame);

  const previousTheme = { ...THEME };
  Object.assign(THEME, options.theme ?? {});
  EMBEDDED_SLIDES.set(slide, context);
  const adapter = { slides: { add: () => slide } };
  try {
    return builder(adapter, params);
  } finally {
    EMBEDDED_SLIDES.delete(slide);
    Object.assign(THEME, previousTheme);
  }
}

export function addText(slide, value, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: style.name,
    position: transformPosition(slide, position),
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = style.protectLineBreaks ? protectChineseLineBreaks(value) : String(value ?? "");
  shape.text.style = {
    fontSize: transformFontSize(slide, style.fontSize ?? 16),
    typeface: style.typeface ?? THEME.font,
    color: style.color ?? THEME.dark,
    bold: style.bold ?? false,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "middle",
    autoFit: style.autoFit ?? "shrinkText",
    insets: style.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

export function addBox(slide, position, options = {}) {
  const geometry = options.geometry ?? "roundRect";
  const config = {
    geometry,
    name: options.name,
    position: transformPosition(slide, position),
    fill: options.fill ?? THEME.surface,
    line: options.line ?? { style: "solid", fill: THEME.line, width: 1 },
    shadow: options.shadow ?? "shadow-sm",
  };
  if (["rect", "textbox", "roundRect"].includes(geometry)) {
    config.borderRadius = options.borderRadius ?? "rounded-xl";
  }
  const shape = slide.shapes.add(config);
  if (options.text !== undefined) {
    shape.text = options.protectLineBreaks ? protectChineseLineBreaks(options.text) : String(options.text);
    shape.text.style = {
      fontSize: transformFontSize(slide, options.fontSize ?? 18),
      typeface: options.typeface ?? THEME.font,
      color: options.color ?? THEME.dark,
      bold: options.bold ?? false,
      alignment: options.alignment ?? "center",
      verticalAlignment: options.verticalAlignment ?? "middle",
      autoFit: options.autoFit ?? "shrinkText",
      insets: options.insets ?? { top: 8, right: 12, bottom: 8, left: 12 },
    };
  }
  return shape;
}

export function addCircle(slide, position, options = {}) {
  return addBox(slide, position, { ...options, geometry: "ellipse", borderRadius: undefined });
}

export function addTitle(slide, title, subtitle = "STRUCTURE COMPONENT") {
  addText(slide, title, { left: 72, top: 42, width: 880, height: 48 }, {
    fontSize: 36,
    bold: true,
    color: THEME.accent,
  });
  addText(slide, subtitle, { left: 74, top: 92, width: 520, height: 26 }, {
    fontSize: 16,
    color: THEME.muted,
  });
}

export function createPresentation() {
  return Presentation.create({ slideSize: { width: 1280, height: 720 } });
}

export async function runGenerator(moduleUrl, builder, defaults) {
  if (!process.argv[1] || path.resolve(process.argv[1]) !== fileURLToPath(moduleUrl)) return;
  const args = process.argv.slice(2);
  const moduleDir = path.dirname(fileURLToPath(moduleUrl));
  const values = { output: path.join(moduleDir, "example.pptx"), config: null };
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith("--") || value === undefined) throw new Error(`参数格式错误：${name || "<empty>"}`);
    const key = name.slice(2);
    if (!(key in values)) throw new Error(`不支持的参数：--${key}`);
    values[key] = value;
  }
  const config = values.config
    ? { ...defaults, ...JSON.parse(await fs.readFile(path.resolve(values.config), "utf8")) }
    : defaults;
  const presentation = createPresentation();
  builder(presentation, config);
  await fs.mkdir(path.dirname(path.resolve(values.output)), { recursive: true });
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(path.resolve(values.output));
  console.log(path.resolve(values.output));
}

export async function saveSingleExample(builder, config, output) {
  const presentation = createPresentation();
  builder(presentation, config);
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(output);
}

function prepareSlide(presentation, title, subtitle) {
  const slide = presentation.slides.add();
  if (embeddedContext(slide)) return slide;
  slide.background.fill = THEME.background;
  addTitle(slide, title, subtitle);
  return slide;
}

function isEmphasisStep(step) {
  return step?.emphasis === true || ["conclusion", "result", "重点"].includes(step?.emphasis);
}

export function normalizeSequentialSteps(steps) {
  const emphasisSteps = steps.filter(isEmphasisStep);
  const emphasisStep = emphasisSteps.at(-1) ?? null;
  const regularSteps = steps.filter((step) => !isEmphasisStep(step));
  return {
    regularSteps,
    emphasisStep,
    displaySteps: emphasisStep ? [...regularSteps, emphasisStep] : [...regularSteps],
  };
}

export function buildSequentialProcess(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "顺序流程");
  const { displaySteps: steps } = normalizeSequentialSteps(params.steps);
  const left = 78;
  const gap = 28;
  const width = (1124 - gap * (steps.length - 1)) / steps.length;
  const nodes = steps.map((step, index) => addBox(slide, {
    left: left + index * (width + gap), top: 230, width, height: 270,
  }, {
    name: qaElementName({ parent: `sequential-step-${index}`, domains: ["sequential-steps"] }),
    fill: isEmphasisStep(step) ? "#17406D" : index % 2 ? THEME.accentAlt : THEME.accent,
    line: isEmphasisStep(step)
      ? { style: "solid", fill: THEME.cyan, width: 4 }
      : { style: "solid", fill: "none", width: 0 },
    shadow: isEmphasisStep(step) ? "shadow-lg" : "shadow-md",
  }));
  for (let index = 0; index < nodes.length - 1; index += 1) {
    slide.shapes.connect(nodes[index], nodes[index + 1], {
      kind: "straight", fromSide: "right", toSide: "left",
      line: { style: "solid", fill: THEME.accent, width: 3 },
      tail: { type: "triangle", width: "med", length: "med" },
    });
  }
  steps.forEach((step, index) => {
    const x = left + index * (width + gap);
    if (isEmphasisStep(step)) {
      addBox(slide, { left: x + 18, top: 250, width: Math.min(112, width - 36), height: 38 }, {
        fill: THEME.cyan, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
        text: step.emphasisLabel ?? "结论 / 结果", fontSize: typographySize("componentMeta", 16), bold: true, color: "#FFFFFF",
        autoFit: "none", insets: { top: 0, right: 4, bottom: 0, left: 4 },
      });
    } else {
      addCircle(slide, { left: x + 18, top: 250, width: 52, height: 52 }, {
        fill: "#FFFFFF", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
        text: String(index + 1).padStart(2, "0"), fontSize: typographySize("componentBody", 18), bold: true, color: index % 2 ? THEME.accentAlt : THEME.accent,
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      });
    }
    addText(slide, step.title, { left: x + 22, top: 326, width: width - 44, height: 52 }, {
      name: qaElementName({ within: `sequential-step-${index}`, role: "title" }),
      fontSize: typographySize("componentTitle", 22), bold: true, color: "#FFFFFF", alignment: "center",
    });
    addText(slide, step.body, { left: x + 22, top: 394, width: width - 44, height: 76 }, {
      name: qaElementName({ within: `sequential-step-${index}`, role: "body" }),
      fontSize: typographySize("componentBody", 18), color: "#EAF6FF", alignment: "center", verticalAlignment: "top",
    });
  });
  return slide;
}

export function buildSequentialProcessRibbon(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "顺序流程 · 带状推进");
  const { displaySteps: steps } = normalizeSequentialSteps(params.steps);
  const left = 72;
  const top = 270;
  const gap = 10;
  const width = (1136 - gap * (steps.length - 1)) / steps.length;

  steps.forEach((step, index) => {
    const x = left + index * (width + gap);
    const emphasized = isEmphasisStep(step);
    const fill = emphasized ? "#17406D" : index % 2 ? THEME.accentAlt : THEME.accent;
    addBox(slide, { left: x, top, width, height: 118 }, {
      geometry: emphasized || index === steps.length - 1 ? "roundRect" : "chevron",
      fill,
      line: emphasized ? { style: "solid", fill: THEME.cyan, width: 4 } : { style: "solid", fill: "none", width: 0 },
      shadow: emphasized ? "shadow-lg" : "shadow-sm",
    });
    addText(slide, emphasized ? (step.emphasisLabel ?? "结论 / 结果") : String(index + 1).padStart(2, "0"), {
      left: x + 18, top: top + 15, width: 46, height: 30,
    }, { fontSize: emphasized ? 14 : 17, bold: true, color: emphasized ? THEME.cyan : "#DFF6FF", alignment: "center" });
    addText(slide, step.title, {
      left: x + 18, top: top + 46, width: width - 42, height: 48,
    }, { fontSize: 22, bold: true, color: "#FFFFFF", alignment: "center" });
    addText(slide, step.body, {
      left: x + 10, top: index % 2 ? top + 145 : top - 105, width: width - 20, height: 82,
    }, {
      fontSize: 16,
      color: THEME.body,
      alignment: "center",
      verticalAlignment: index % 2 ? "top" : "bottom",
    });
  });
  return slide;
}

export function buildSequentialProcessStaircase(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "顺序流程 · 阶梯推进");
  const { displaySteps: steps } = normalizeSequentialSteps(params.steps);
  const cardWidth = Math.min(190, 930 / steps.length);
  const cardHeight = 132;
  const left = 72;
  const right = 1208 - cardWidth;
  const bottom = 480;
  const top = 190;
  const positions = steps.map((_, index) => ({
    left: steps.length === 1 ? (left + right) / 2 : left + index * ((right - left) / (steps.length - 1)),
    top: steps.length === 1 ? (top + bottom) / 2 : bottom - index * ((bottom - top) / (steps.length - 1)),
    width: cardWidth,
    height: cardHeight,
  }));

  for (let index = 0; index < positions.length - 1; index += 1) {
    const from = positions[index];
    const to = positions[index + 1];
    slide.shapes.add({
      geometry: "line",
      position: transformPosition(slide, {
        left: from.left + from.width * 0.82,
        top: to.top + to.height / 2,
        width: to.left - (from.left + from.width * 0.82),
        height: from.top - to.top,
        verticalFlip: true,
      }),
      fill: "none",
      line: { style: "solid", fill: THEME.line, width: 4 },
      tail: { type: "triangle", width: "med", length: "med" },
    });
  }

  positions.forEach((position, index) => {
    const emphasized = isEmphasisStep(steps[index]);
    const fill = emphasized ? "#17406D" : index % 2 ? THEME.accentAlt : THEME.accent;
    addBox(slide, position, {
      fill,
      line: { style: "solid", fill: emphasized ? THEME.cyan : "#FFFFFF", width: emphasized ? 4 : 2 },
      shadow: emphasized ? "shadow-lg" : "shadow-md",
    });
    if (emphasized) {
      addText(slide, steps[index].emphasisLabel ?? "结论 / 结果", {
        left: position.left + 12, top: position.top + 8, width: position.width - 24, height: 22,
      }, { fontSize: 14, bold: true, color: THEME.cyan, alignment: "center" });
    } else {
      addCircle(slide, {
        left: position.left + 14,
        top: position.top + 14,
        width: 38,
        height: 38,
      }, {
        fill: "#FFFFFF",
        line: { style: "solid", fill: "none", width: 0 },
        shadow: "shadow-none",
        text: String(index + 1),
        fontSize: 16,
        bold: true,
        color: fill,
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      });
    }
    addText(slide, steps[index].title, {
      left: position.left + (emphasized ? 18 : 58),
      top: position.top + (emphasized ? 34 : 12),
      width: position.width - (emphasized ? 36 : 70),
      height: emphasized ? 34 : 42,
    }, { fontSize: 20, bold: true, color: "#FFFFFF", alignment: "center" });
    addText(slide, wrapChineseText(steps[index].body, 10), {
      left: position.left + 16,
      top: position.top + (emphasized ? 72 : 58),
      width: position.width - 32,
      height: emphasized ? 50 : 58,
    }, {
      fontSize: 15,
      color: "#EAF6FF",
      alignment: "center",
      verticalAlignment: "top",
    });
  });
  return slide;
}

export function buildRoleHandoff(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "角色接力 · 职责交接");
  const steps = params.steps.filter((step) => !isEmphasisStep(step));
  const conclusion = params.steps.find((step) => isEmphasisStep(step));
  const nodeWidth = Math.min(164, 900 / steps.length);
  const left = 82;
  const right = 1198 - nodeWidth;
  const positions = steps.map((_, index) => ({
    left: left + index * ((right - left) / Math.max(1, steps.length - 1)),
    top: index % 2 ? 366 : 214,
    width: nodeWidth,
    height: 92,
  }));

  for (let index = 0; index < positions.length - 1; index += 1) {
    const from = positions[index];
    const to = positions[index + 1];
    slide.shapes.add({
      geometry: "line",
      position: transformPosition(slide, {
        left: from.left + from.width,
        top: Math.min(from.top, to.top) + 46,
        width: to.left - (from.left + from.width),
        height: Math.abs(to.top - from.top),
        verticalFlip: to.top < from.top,
      }),
      fill: "none",
      line: { style: "solid", fill: THEME.cyan, width: 4 },
      tail: { type: "triangle", width: "med", length: "med" },
    });
  }

  positions.forEach((position, index) => {
    const step = steps[index];
    const role = step.role ?? step.owner ?? step.title;
    const responsibility = step.role || step.owner ? step.title : step.body;
    addCircle(slide, position, {
      fill: index % 2 ? THEME.accentAlt : THEME.accent,
      line: { style: "solid", fill: "#FFFFFF", width: 3 },
      shadow: "shadow-md",
      text: role,
      fontSize: 20,
      bold: true,
      color: "#FFFFFF",
    });
    addBox(slide, {
      left: position.left - 12,
      top: index % 2 ? position.top - 94 : position.top + 112,
      width: position.width + 24,
      height: 68,
    }, {
      fill: "#FFFFFF",
      line: { style: "solid", fill: index % 2 ? THEME.accentAlt : THEME.accent, width: 2 },
      shadow: "shadow-sm",
      text: responsibility,
      fontSize: 16,
      bold: true,
      color: THEME.body,
    });
  });
  if (conclusion) {
    addBox(slide, { left: 300, top: 540, width: 680, height: 86 }, {
      fill: "#17406D",
      line: { style: "solid", fill: THEME.cyan, width: 3 },
      shadow: "shadow-lg",
      text: conclusion.body || conclusion.title,
      fontSize: 20,
      bold: true,
      color: "#FFFFFF",
    });
    addText(slide, conclusion.emphasisLabel ?? "协同结论", {
      left: 570, top: 514, width: 140, height: 28,
    }, { fontSize: 14, bold: true, color: THEME.accent, alignment: "center" });
  }
  return slide;
}

function causalStageLabels(count) {
  if (count === 3) return ["条件", "介入", "结果"];
  if (count === 4) return ["条件", "缺口", "介入", "结果"];
  return ["条件", "缺口", ...Array.from({ length: count - 4 }, () => "机制"), "介入", "结果"];
}

export function buildCausalChain(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "因果链 · 从条件到结果");
  const steps = params.steps;
  const labels = causalStageLabels(steps.length);
  const gap = 24;
  const left = 72;
  const width = (1136 - gap * (steps.length - 1)) / steps.length;
  const top = 245;
  const nodes = steps.map((step, index) => addBox(slide, {
    left: left + index * (width + gap), top, width, height: index === steps.length - 1 ? 194 : 180,
  }, {
    geometry: index === 0 || index === steps.length - 1 ? "ellipse" : "roundRect",
    fill: index === steps.length - 1 ? "#17406D" : index === 1 ? "#E9F1F8" : index % 2 ? THEME.accentAlt : THEME.accent,
    line: index === steps.length - 1
      ? { style: "solid", fill: THEME.cyan, width: 4 }
      : { style: "solid", fill: index === 1 ? THEME.line : "#FFFFFF", width: 2 },
    shadow: index === steps.length - 1 ? "shadow-lg" : "shadow-sm",
  }));
  for (let index = 0; index < nodes.length - 1; index += 1) {
    slide.shapes.connect(nodes[index], nodes[index + 1], {
      kind: "straight", fromSide: "right", toSide: "left",
      line: { style: "solid", fill: THEME.cyan, width: 4 },
      tail: { type: "triangle", width: "med", length: "med" },
    });
  }
  steps.forEach((step, index) => {
    const x = left + index * (width + gap);
    const darkText = index === 1;
    addText(slide, labels[index], { left: x + 14, top: top + 16, width: width - 28, height: 28 }, {
      fontSize: 16,
      bold: true,
      color: index === steps.length - 1 ? THEME.cyan : darkText ? THEME.accent : "#DFF6FF",
      alignment: "center",
    });
    addText(slide, step.title, { left: x + 14, top: top + 52, width: width - 28, height: 46 }, {
      fontSize: 21, bold: true, color: darkText ? THEME.dark : "#FFFFFF", alignment: "center",
    });
    addText(slide, step.body, { left: x + 16, top: top + 102, width: width - 32, height: 70 }, {
      fontSize: 14, color: darkText ? THEME.body : "#EAF6FF", alignment: "center", verticalAlignment: "top",
    });
  });
  return slide;
}

export function buildFlowMap(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "多阶段流向");
  const columns = params.columns;
  const xPositions = [92, 566, 1040];
  const nodeWidth = 150;
  const nodeHeight = 90;
  const nodes = columns.map((column, columnIndex) => column.items.map((item, itemIndex) => addBox(slide, {
    left: xPositions[columnIndex], top: 160 + itemIndex * 150, width: nodeWidth, height: nodeHeight,
  }, { fill: [THEME.accent, THEME.accentAlt, THEME.cyan][columnIndex], line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-md" })));
  for (const flow of params.flows) {
    slide.shapes.connect(nodes[flow.fromColumn][flow.fromIndex], nodes[flow.toColumn][flow.toIndex], {
      kind: "curved", fromSide: "right", toSide: "left",
      line: { style: "solid", fill: flow.color ?? THEME.accent, width: Math.max(3, flow.weight ?? 8) },
    });
  }
  columns.forEach((column, columnIndex) => {
    addText(slide, column.label, { left: xPositions[columnIndex] - 10, top: 126, width: nodeWidth + 20, height: 28 }, {
      fontSize: 18, bold: true, color: THEME.body, alignment: "center",
    });
    column.items.forEach((item, itemIndex) => {
      addText(slide, item.title, { left: xPositions[columnIndex] + 12, top: 176 + itemIndex * 150, width: nodeWidth - 24, height: 34 }, {
        fontSize: 20, bold: true, color: "#FFFFFF", alignment: "center",
      });
      addText(slide, item.value, { left: xPositions[columnIndex] + 12, top: 210 + itemIndex * 150, width: nodeWidth - 24, height: 28 }, {
        fontSize: 16, color: "#EAF6FF", alignment: "center",
      });
    });
  });
  return slide;
}

export function resolveComparisonEmphasis(left, right) {
  if (left?.emphasis && !right?.emphasis) return "left";
  if (right?.emphasis && !left?.emphasis) return "right";
  return null;
}

export function comparisonPalette({ focused = false, deEmphasized = false, side = "left" } = {}) {
  if (deEmphasized) {
    return {
      nodeFill: "#8C98A8",
      cardFill: "linear(0deg, #7E8A9A 0%, #9BA6B4 100%)",
      lineFill: "#6B7684",
      textColor: "#FFFFFF",
    };
  }
  return {
    nodeFill: side === "left" ? THEME.accent : THEME.accentAlt,
    cardFill: side === "left"
      ? `linear(0deg, ${THEME.accent} 0%, #3F7FD6 100%)`
      : `linear(0deg, ${THEME.accentAlt} 0%, #379BEF 100%)`,
    lineFill: focused ? THEME.cyan : "#FFFFFF/18",
    textColor: "#FFFFFF",
  };
}

export function computeComparisonColumnRows(itemCount) {
  if (!Number.isInteger(itemCount) || itemCount < 1 || itemCount > 5) {
    throw new Error("双栏对照每侧需要 1–5 个要点");
  }
  const presets = {
    1: { top: 310, height: 132, gap: 0, wrapAt: 15 },
    2: { top: 270, height: 92, gap: 70, wrapAt: 15 },
    3: { top: 252, height: 70, gap: 45, wrapAt: 16 },
    4: { top: 246, height: 54, gap: 34, wrapAt: 17 },
    5: { top: 242, height: 45, gap: 25, wrapAt: 18 },
  };
  const preset = presets[itemCount];
  return Array.from({ length: itemCount }, (_, index) => ({
    top: preset.top + index * (preset.height + preset.gap),
    height: preset.height,
    wrapAt: preset.wrapAt,
  }));
}

function renderComparisonColumn(slide, side, group, palette, hasEmphasis) {
  const isLeft = side === "left";
  const panelId = `comparison-${side}-panel`;
  const panelLeft = isLeft ? 90 : 750;
  addBox(slide, { left: panelLeft, top: 156, width: 440, height: 462 }, {
    name: qaElementName({ parent: panelId, domains: ["comparison-panels"] }),
    fill: "#FFFFFF/96",
    line: { style: "dashed", fill: "#A7B4C4", width: 1.5 },
    shadow: "shadow-md",
    borderRadius: "rounded-xl",
  });
  addBox(slide, { left: panelLeft, top: 156, width: 440, height: 72 }, {
    name: qaElementName({ within: panelId, role: "header-surface" }),
    fill: palette.cardFill,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-md",
    borderRadius: "rounded-xl",
  });
  addText(slide, group.title, { left: panelLeft + 34, top: 166, width: 372, height: 52 }, {
    name: qaElementName({ within: panelId, role: "header-title" }),
    fontSize: typographySize("componentTitle", 26),
    bold: true,
    color: "#FFFFFF",
    alignment: "center",
    autoFit: "shrinkText",
  });

  const rows = computeComparisonColumnRows(group.items.length);
  group.items.forEach((item, index) => {
    const row = rows[index];
    const rowId = `comparison-${side}-row-${index}`;
    addBox(slide, { left: panelLeft + 38, top: row.top, width: 364, height: row.height }, {
      name: qaElementName({ parent: rowId, domains: [`comparison-${side}-rows`] }),
      fill: palette.cardFill,
      line: { style: "solid", fill: palette.lineFill, width: 1 },
      shadow: "shadow-md",
      borderRadius: "rounded-full",
    });
    addCircle(slide, {
      left: panelLeft + 52,
      top: row.top + (row.height - 30) / 2,
      width: 30,
      height: 30,
    }, {
      name: qaElementName({ within: rowId, role: "status-marker" }),
      fill: hasEmphasis && group.emphasis !== true ? "#5E6977" : isLeft ? THEME.accent : THEME.accentAlt,
      line: { style: "solid", fill: "none", width: 0 },
      shadow: "shadow-none",
      text: hasEmphasis ? group.emphasis === true ? "✓" : "×" : "•",
      fontSize: typographySize("componentMeta", 16),
      bold: true,
      color: "#FFFFFF",
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    addText(slide, wrapChineseText(item, row.wrapAt), {
      left: panelLeft + 92,
      top: row.top + 6,
      width: 286,
      height: row.height - 12,
    }, {
      name: qaElementName({ within: rowId, role: "item-text" }),
      fontSize: typographySize("componentBody", 18),
      color: palette.textColor,
      alignment: "center",
      autoFit: "shrinkText",
    });
  });
}

export function buildComparison(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "双向对比");
  const emphasis = resolveComparisonEmphasis(params.left, params.right);
  const leftFocused = emphasis === "left";
  const rightFocused = emphasis === "right";
  const leftPalette = comparisonPalette({ focused: leftFocused, deEmphasized: Boolean(emphasis && !leftFocused), side: "left" });
  const rightPalette = comparisonPalette({ focused: rightFocused, deEmphasized: Boolean(emphasis && !rightFocused), side: "right" });

  addBox(slide, { left: 40, top: 135, width: 1200, height: 520 }, {
    fill: "linear(90deg, #FFFFFF 0%, #EEF6FC 52%, #FFFFFF 100%)",
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-none",
    borderRadius: 0,
  });
  renderComparisonColumn(slide, "left", params.left, leftPalette, Boolean(emphasis));
  renderComparisonColumn(slide, "right", params.right, rightPalette, Boolean(emphasis));

  const centerId = "comparison-center";
  addCircle(slide, { left: 570, top: 300, width: 140, height: 140 }, {
    name: qaElementName({ parent: centerId, domains: ["comparison-panels"] }),
    fill: "none",
    line: { style: "dashed", fill: "#AAB8C7", width: 1.5 },
    shadow: "shadow-none",
  });
  addCircle(slide, { left: 586, top: 316, width: 108, height: 108 }, {
    name: qaElementName({ within: centerId, role: "center-disc" }),
    fill: `linear(135deg, ${THEME.accent} 0%, ${THEME.accentAlt} 100%)`,
    line: { style: "solid", fill: "#FFFFFF", width: 2 },
    shadow: "shadow-lg",
    text: params.centerLabel || "VS",
    fontSize: typographySize("componentHeading", 28),
    bold: true,
    color: "#FFFFFF",
    insets: { top: 4, right: 4, bottom: 4, left: 4 },
  });
  addCircle(slide, { left: 62, top: 605, width: 1156, height: 42 }, {
    fill: "none",
    line: { style: "dashed", fill: THEME.cyan, width: 1.5 },
    shadow: "shadow-none",
  });
  addCircle(slide, { left: 92, top: 611, width: 1096, height: 32 }, {
    fill: "none",
    line: { style: "solid", fill: THEME.accent, width: 3 },
    shadow: "shadow-none",
  });
  return slide;
}

function renderDualCoreWing(slide, side) {
  const isLeft = side === "left";
  const outer = addCircle(slide, {
    left: isLeft ? -160 : 740,
    top: 158,
    width: 700,
    height: 430,
  }, {
    fill: isLeft
      ? "linear(0deg, #FFFFFF/0 0%, #D4E8FA/92 100%)"
      : "linear(180deg, #D5F2F8/92 0%, #FFFFFF/0 100%)",
    line: { style: "solid", fill: isLeft ? "#75B5E9" : "#77D8E7", width: 1.5 },
    shadow: "shadow-none",
  });
  outer.sendToBack();
  const inner = addCircle(slide, {
    left: isLeft ? -85 : 805,
    top: 192,
    width: 610,
    height: 360,
  }, {
    fill: "none",
    line: { style: "solid", fill: isLeft ? "#B5DAF6" : "#B9ECF2", width: 1.2 },
    shadow: "shadow-none",
  });
  inner.sendToBack();
}

function renderDualCorePills(slide, items, side) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 6) {
    throw new Error("双核心协同每侧需要 1–6 个能力项");
  }
  const isLeft = side === "left";
  const xs = isLeft ? [46, 190] : [966, 1110];
  const rows = Math.ceil(items.length / 2);
  const startTop = 344 - (rows - 1) * 31;
  items.forEach((item, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    addBox(slide, {
      left: xs[column],
      top: startTop + row * 62,
      width: 124,
      height: 34,
    }, {
      fill: isLeft ? THEME.accent : THEME.accentAlt,
      line: { style: "solid", fill: "none", width: 0 },
      shadow: "shadow-sm",
      borderRadius: "rounded-full",
      text: item,
      fontSize: typographySize("componentMeta", 16),
      color: "#FFFFFF",
      bold: true,
      insets: { top: 2, right: 5, bottom: 2, left: 5 },
    });
  });
}

/**
 * 候选结构：两项核心目标由共同输入和共同目标驱动，并分别带有侧向能力项。
 * 来源于狗哥蓝色模板第 31 页；它不是普通的优劣对比，因此暂不注册到正式运行时。
 */
export function buildDualCoreEnablement(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "双核心协同");
  renderDualCoreWing(slide, "left");
  renderDualCoreWing(slide, "right");

  addCircle(slide, { left: 324, top: 130, width: 632, height: 510 }, {
    fill: "#FFFFFF",
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-none",
  });
  addCircle(slide, { left: 385, top: 140, width: 510, height: 510 }, {
    fill: "none",
    line: { style: "dashed", fill: "#D2D2D2", width: 2 },
    shadow: "shadow-none",
  });
  addCircle(slide, { left: 464, top: 219, width: 352, height: 352 }, {
    fill: "none",
    line: { style: "dashed", fill: "#BEBEBE", width: 2 },
    shadow: "shadow-none",
  });

  const renderCore = (group, side) => {
    const isLeft = side === "left";
    const left = isLeft ? 340 : 710;
    addCircle(slide, { left, top: 284, width: 230, height: 230 }, {
      fill: isLeft
        ? `linear(135deg, #1778D0 0%, ${THEME.accent} 100%)`
        : `linear(135deg, ${THEME.accentAlt} 0%, #009DD9 100%)`,
      line: { style: "solid", fill: "#FFFFFF/20", width: 1 },
      shadow: "shadow-lg",
    });
    addText(slide, group.title, { left: left + 30, top: 338, width: 170, height: 44 }, {
      fontSize: typographySize("componentHeading", 26),
      color: "#FFFFFF",
      bold: true,
      alignment: "center",
    });
    addText(slide, wrapChineseText(group.body, 11), { left: left + 28, top: 386, width: 174, height: 78 }, {
      fontSize: typographySize("componentMeta", 16),
      color: "#FFFFFF",
      alignment: "center",
      verticalAlignment: "top",
    });
    renderDualCorePills(slide, group.items, side);
  };
  renderCore(params.left, "left");
  renderCore(params.right, "right");

  addText(slide, params.center, { left: 586, top: 350, width: 108, height: 70 }, {
    fontSize: typographySize("componentTitle", 24),
    bold: true,
    alignment: "center",
    color: THEME.dark,
  });
  addBox(slide, { left: 603, top: 210, width: 74, height: 102 }, {
    geometry: "downArrow",
    fill: THEME.cyan,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-md",
  });
  addBox(slide, { left: 603, top: 486, width: 74, height: 102 }, {
    geometry: "upArrow",
    fill: THEME.cyan,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-md",
  });
  addText(slide, params.topDriver, { left: 536, top: 148, width: 208, height: 52 }, {
    fontSize: typographySize("componentItemTitle", 19),
    bold: true,
    alignment: "center",
    color: THEME.dark,
  });
  addText(slide, params.bottomDriver, { left: 536, top: 590, width: 208, height: 52 }, {
    fontSize: typographySize("componentItemTitle", 19),
    bold: true,
    alignment: "center",
    color: THEME.dark,
  });
  return slide;
}

export function buildRadialHub(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "中心主题 · 多向展开");
  const items = params.items.map((item) => (
    typeof item === "string" ? { title: item, body: "" } : { title: item.title, body: item.body ?? "" }
  ));
  if (items.length < 3 || items.length > 8) throw new Error("中心辐射关系支持 3–8 个外围节点");

  const halo = addCircle(slide, { left: 462, top: 207, width: 356, height: 356 }, {
    fill: THEME.accentSoft,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-none",
  });
  addCircle(slide, { left: 486, top: 231, width: 308, height: 308 }, {
    fill: THEME.surface,
    line: { style: "solid", fill: "#B7D8F3", width: 2 },
    shadow: "shadow-md",
  });
  const center = addCircle(slide, { left: 510, top: 255, width: 260, height: 260 }, {
    fill: THEME.accent,
    line: { style: "solid", fill: "#FFFFFF", width: 4 },
    shadow: "shadow-lg",
    text: wrapChineseText(params.center, 6),
    fontSize: 29,
    bold: true,
    color: "#FFFFFF",
  });
  halo.sendToBack();

  const leftItems = items.slice(0, Math.ceil(items.length / 2));
  const rightItems = items.slice(leftItems.length);
  const renderSide = (sideItems, side, startIndex) => {
    const count = sideItems.length;
    const gap = count === 1 ? 0 : Math.min(118, 350 / (count - 1));
    const startTop = 350 - ((count - 1) * gap) / 2;
    sideItems.forEach((item, localIndex) => {
      const index = startIndex + localIndex;
      const top = startTop + localIndex * gap;
      const isLeft = side === "left";
      const node = addCircle(slide, {
        left: isLeft ? 382 : 846,
        top: top - 23,
        width: 46,
        height: 46,
      }, {
        fill: index % 2 ? THEME.accentAlt : THEME.cyan,
        line: { style: "solid", fill: "#FFFFFF", width: 3 },
        shadow: "shadow-sm",
        text: String(index + 1).padStart(2, "0"),
        fontSize: 16,
        bold: true,
        color: "#FFFFFF",
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      const cardLeft = isLeft ? 68 : 912;
      const alignment = isLeft ? "right" : "left";
      addText(slide, item.title, { left: cardLeft, top: top - 31, width: 300, height: 30 }, {
        fontSize: typographySize("componentItemTitle", 19),
        bold: true,
        color: THEME.accent,
        alignment,
      });
      if (item.body) addText(slide, wrapChineseText(item.body, 17), { left: cardLeft, top: top + 2, width: 300, height: 47 }, {
        fontSize: typographySize("componentMeta", 16),
        color: THEME.body,
        alignment,
        verticalAlignment: "top",
      });
      slide.shapes.connect(center, node, {
        kind: "straight",
        fromSide: side,
        toSide: isLeft ? "right" : "left",
        line: { style: "solid", fill: "#B7CCE0", width: 1.5 },
      });
      node.bringToFront();
    });
  };
  renderSide(leftItems, "left", 0);
  renderSide(rightItems, "right", leftItems.length);
  center.bringToFront();
  return slide;
}

export function buildRadialHubSplitWing(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "中心主题 · 双翼展开");
  const items = params.items;
  const midpoint = Math.ceil(items.length / 2);
  const columns = [items.slice(0, midpoint), items.slice(midpoint)];
  const center = addCircle(slide, { left: 520, top: 270, width: 240, height: 240 }, {
    fill: THEME.accent,
    line: { style: "solid", fill: "#FFFFFF", width: 3 },
    shadow: "shadow-lg",
    text: params.center,
    fontSize: 28,
    bold: true,
    color: "#FFFFFF",
  });
  const nodes = [];

  columns.forEach((column, sideIndex) => {
    const x = sideIndex === 0 ? 96 : 964;
    const side = sideIndex === 0 ? "left" : "right";
    const count = column.length;
    const gap = Math.min(112, 370 / Math.max(1, count - 1));
    const startTop = 335 - ((count - 1) * gap) / 2;
    column.forEach((item, index) => {
      const node = addBox(slide, { left: x, top: startTop + index * gap, width: 220, height: 74 }, {
        fill: sideIndex ? THEME.accentAlt : THEME.cyan,
        line: { style: "solid", fill: "#FFFFFF", width: 2 },
        shadow: "shadow-sm",
        text: item,
        fontSize: 17,
        bold: true,
        color: "#FFFFFF",
      });
      nodes.push({ node, side });
    });
  });

  nodes.forEach(({ node, side }) => slide.shapes.connect(center, node, {
    kind: "straight",
    fromSide: side,
    toSide: side === "left" ? "right" : "left",
    line: { style: "solid", fill: THEME.line, width: 2 },
  }));
  center.bringToFront();
  nodes.forEach(({ node }) => node.bringToFront());
  return slide;
}

export function buildCycleLoop(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "循环主题 · 反馈闭环");
  const steps = params.steps.map((step) => (
    typeof step === "string" ? { title: step, body: "" } : { title: step.title, body: step.body ?? "" }
  ));
  if (steps.length < 3 || steps.length > 6) throw new Error("循环闭环支持 3–6 个步骤");

  addCircle(slide, { left: 438, top: 183, width: 404, height: 404 }, {
    fill: "none",
    line: { style: "solid", fill: "#D9EAF8", width: 14 },
    shadow: "shadow-none",
  });
  addCircle(slide, { left: 478, top: 223, width: 324, height: 324 }, {
    fill: THEME.surface,
    line: { style: "solid", fill: "#B8DAF4", width: 2 },
    shadow: "shadow-sm",
  });
  [
    { geometry: "rightArrow", left: 585, top: 181, width: 110, height: 28 },
    { geometry: "downArrow", left: 812, top: 330, width: 28, height: 110 },
    { geometry: "leftArrow", left: 585, top: 561, width: 110, height: 28 },
    { geometry: "upArrow", left: 440, top: 330, width: 28, height: 110 },
  ].forEach(({ geometry, ...position }) => addBox(slide, position, {
    geometry,
    fill: THEME.accent,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-none",
  }));
  const center = addCircle(slide, { left: 525, top: 270, width: 230, height: 230 }, {
    fill: THEME.accent,
    line: { style: "solid", fill: "#FFFFFF", width: 4 },
    shadow: "shadow-lg",
    text: wrapChineseText(params.center, 6),
    fontSize: 28,
    bold: true,
    color: "#FFFFFF",
  });

  const orbitAnchors = [
    addCircle(slide, { left: 615, top: 164, width: 50, height: 50 }, { fill: THEME.cyan, line: { style: "solid", fill: "#FFFFFF", width: 3 }, shadow: "shadow-sm" }),
    addCircle(slide, { left: 816, top: 360, width: 50, height: 50 }, { fill: THEME.accentAlt, line: { style: "solid", fill: "#FFFFFF", width: 3 }, shadow: "shadow-sm" }),
    addCircle(slide, { left: 615, top: 556, width: 50, height: 50 }, { fill: THEME.cyan, line: { style: "solid", fill: "#FFFFFF", width: 3 }, shadow: "shadow-sm" }),
    addCircle(slide, { left: 414, top: 360, width: 50, height: 50 }, { fill: THEME.accentAlt, line: { style: "solid", fill: "#FFFFFF", width: 3 }, shadow: "shadow-sm" }),
  ];

  const rightSteps = steps.slice(0, Math.ceil(steps.length / 2));
  const leftSteps = steps.slice(rightSteps.length).reverse();
  const renderColumn = (column, side, startIndex) => {
    const gap = column.length === 1 ? 0 : 300 / (column.length - 1);
    const startTop = 206;
    column.forEach((step, localIndex) => {
      const index = side === "right" ? startIndex + localIndex : steps.length - localIndex - 1;
      const top = startTop + localIndex * gap;
      const left = side === "right" ? 914 : 66;
      const numberLeft = side === "right" ? left : left + 228;
      addBox(slide, { left, top, width: 274, height: 84 }, {
        name: qaElementName({ parent: `cycle-step-${index}`, domains: ["cycle-card", "cycle-content"] }),
        fill: THEME.surface,
        line: { style: "solid", fill: "#D7E4EF", width: 1 },
        shadow: "shadow-sm",
      });
      addCircle(slide, { left: numberLeft, top: top + 17, width: 50, height: 50 }, {
        fill: index % 2 ? THEME.accentAlt : THEME.accent,
        line: { style: "solid", fill: "#FFFFFF", width: 2 },
        shadow: "shadow-none",
        text: String(index + 1).padStart(2, "0"),
        fontSize: 16,
        bold: true,
        color: "#FFFFFF",
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      const textLeft = side === "right" ? left + 66 : left + 18;
      const textWidth = 188;
      addText(slide, step.title, { left: textLeft, top: top + 12, width: textWidth, height: 28 }, {
        fontSize: typographySize("componentItemTitle", 19),
        bold: true,
        color: THEME.accent,
        alignment: side === "right" ? "left" : "right",
      });
      if (step.body) addText(slide, wrapChineseText(step.body, 11), { left: textLeft, top: top + 42, width: textWidth, height: 34 }, {
        fontSize: typographySize("componentMeta", 16),
        color: THEME.body,
        alignment: side === "right" ? "left" : "right",
      });
    });
  };
  renderColumn(rightSteps, "right", 0);
  renderColumn(leftSteps, "left", rightSteps.length);
  orbitAnchors.forEach((anchor) => anchor.bringToFront());
  center.bringToFront();
  return slide;
}

export function buildTimelineRoadmap(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "阶段节点 · 发展历程");
  const milestones = params.milestones;
  if (milestones.length < 3 || milestones.length > 6) throw new Error("时间轴支持 3–6 个里程碑");
  const left = 64;
  const width = 1152;
  const columnWidth = width / milestones.length;
  const lineTop = 337;
  slide.shapes.add({
    geometry: "line",
    position: transformPosition(slide, { left, top: lineTop, width, height: 0 }),
    fill: "none",
    line: { style: "solid", fill: THEME.accent, width: 3 },
    tail: { type: "triangle", width: "med", length: "med" },
  });
  milestones.forEach((milestone, index) => {
    const columnLeft = left + index * columnWidth;
    const innerLeft = columnLeft + 12;
    const innerWidth = columnWidth - 24;
    if (index % 2 === 0) addBox(slide, { left: columnLeft + 3, top: 155, width: columnWidth - 6, height: 472 }, {
      fill: "#F0F7FC",
      line: { style: "solid", fill: "none", width: 0 },
      shadow: "shadow-none",
      borderRadius: "rounded-sm",
    });
    addText(slide, milestone.period, { left: innerLeft, top: 170, width: innerWidth, height: 105 }, {
      fontSize: milestones.length <= 4 ? 58 : 44,
      bold: true,
      color: index === milestones.length - 1 ? THEME.accent : "#AFC4D8",
      alignment: "center",
      autoFit: "shrinkText",
    });
    addText(slide, `阶段 ${String(index + 1).padStart(2, "0")}`, { left: innerLeft, top: 286, width: innerWidth, height: 26 }, {
      fontSize: 16,
      bold: true,
      color: index === milestones.length - 1 ? THEME.accentAlt : THEME.muted,
      alignment: "center",
    });
    addCircle(slide, { left: columnLeft + columnWidth / 2 - 13, top: lineTop - 13, width: 26, height: 26 }, {
      fill: index === milestones.length - 1 ? THEME.cyan : THEME.accent,
      line: { style: "solid", fill: "#FFFFFF", width: 3 },
      shadow: "shadow-sm",
    });
    addText(slide, milestone.title, { left: innerLeft, top: 376, width: innerWidth, height: 58 }, {
      fontSize: milestones.length <= 4 ? 22 : 19,
      bold: true,
      color: THEME.accent,
      alignment: "center",
    });
    addText(slide, wrapChineseText(milestone.body ?? "", milestones.length <= 4 ? 13 : 10), { left: innerLeft + 4, top: 442, width: innerWidth - 8, height: 104 }, {
      fontSize: typographySize("componentMeta", 16),
      color: THEME.body,
      alignment: "center",
      verticalAlignment: "top",
    });
    addBox(slide, { left: columnLeft + columnWidth / 2 - 24, top: 566, width: 48, height: 5 }, {
      fill: index === milestones.length - 1 ? THEME.cyan : THEME.accentSoft,
      line: { style: "solid", fill: "none", width: 0 },
      shadow: "shadow-none",
      borderRadius: "rounded-full",
    });
  });
  return slide;
}

export function buildFunnelConversion(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "递减转化 · 阶段拆解");
  const stages = params.stages;
  if (stages.length < 3 || stages.length > 6) throw new Error("转化漏斗支持 3–6 个阶段");
  const maxWidth = 560;
  const minWidth = stages.length >= 5 ? 205 : 230;
  const top = 160;
  const totalHeight = 452;
  const segmentHeight = totalHeight / stages.length;
  const palette = ["#174B82", "#1767A5", "#167FC1", "#16A0C4", "#19B7C4", "#32C7C7"];
  stages.forEach((stage, index) => {
    const compact = stages.length >= 5;
    const ratio = stages.length === 1 ? 0 : index / (stages.length - 1);
    const segmentWidth = maxWidth - ratio * (maxWidth - minWidth);
    const segmentLeft = 72 + (maxWidth - segmentWidth) / 2;
    const segmentTop = top + index * segmentHeight;
    const color = palette[index];
    addBox(slide, { left: segmentLeft, top: segmentTop, width: segmentWidth, height: segmentHeight - 8 }, {
      name: qaElementName({ parent: `funnel-stage-${index}`, domains: ["funnel-shape", "funnel-content"] }),
      geometry: "trapezoid",
      fill: color,
      line: { style: "solid", fill: "#FFFFFF", width: 2 },
      shadow: "shadow-sm",
    });
    addCircle(slide, { left: segmentLeft + 4, top: segmentTop - 5, width: segmentWidth - 8, height: 22 }, {
      fill: color,
      line: { style: "solid", fill: "#FFFFFF", width: 1 },
      shadow: "shadow-none",
    });
    addText(slide, stage.rate ?? "", { left: segmentLeft + 16, top: segmentTop + 10, width: segmentWidth - 32, height: 29 }, {
      fontSize: stages.length <= 4 ? 24 : 20,
      bold: true,
      color: "#F6C96A",
      alignment: "center",
    });
    addText(slide, stage.label, { left: segmentLeft + 16, top: segmentTop + 38, width: segmentWidth - 32, height: 31 }, {
      fontSize: stages.length <= 4 ? 20 : 17,
      bold: true,
      color: "#FFFFFF",
      alignment: "center",
    });
    const cardTop = segmentTop + 1;
    addBox(slide, { left: 726, top: cardTop, width: 478, height: segmentHeight - 10 }, {
      name: qaElementName({ parent: `funnel-note-${index}`, domains: ["funnel-note", "funnel-content"] }),
      fill: index % 2 ? "#F7FAFC" : THEME.surface,
      line: { style: "solid", fill: "#D8E5EF", width: 1 },
      shadow: "shadow-none",
    });
    addBox(slide, { left: 726, top: cardTop, width: 6, height: segmentHeight - 10 }, {
      fill: color,
      line: { style: "solid", fill: "none", width: 0 },
      shadow: "shadow-none",
      borderRadius: "rounded-sm",
    });
    addText(slide, `${String(index + 1).padStart(2, "0")}  ${stage.label}`, { left: 752, top: cardTop + (compact ? 6 : 10), width: 420, height: compact ? 23 : 27 }, {
      fontSize: stages.length <= 4 ? 18 : 16,
      bold: true,
      color: THEME.accent,
    });
    addText(slide, wrapChineseText(stage.note ?? "", compact ? 16 : 22), { left: 752, top: cardTop + (compact ? 30 : 38), width: 420, height: compact ? segmentHeight - 36 : segmentHeight - 52 }, {
      fontSize: typographySize("componentMeta", 16),
      color: THEME.body,
      verticalAlignment: "top",
    });
    slide.shapes.add({
      geometry: "line",
      position: transformPosition(slide, { left: segmentLeft + segmentWidth + 10, top: segmentTop + (segmentHeight - 8) / 2, width: 82, height: 0 }),
      fill: "none",
      line: { style: "dashed", fill: "#91B8D7", width: 1.3 },
    });
  });
  return slide;
}

export function buildHierarchyPyramid(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "战略层级 · 能力递进");
  const levels = params.levels;
  if (levels.length < 3 || levels.length > 5) throw new Error("层级金字塔支持 3–5 层");
  const maxWidth = 552;
  const minWidth = 180;
  const top = 158;
  const totalHeight = 458;
  const levelHeight = totalHeight / levels.length;
  const palette = ["#2AC7CE", "#1BA7CE", "#187FC3", "#185F9C", "#153F6B"];
  levels.forEach((level, index) => {
    const ratio = levels.length === 1 ? 0 : index / (levels.length - 1);
    const levelWidth = minWidth + ratio * (maxWidth - minWidth);
    const levelLeft = 74 + (maxWidth - levelWidth) / 2;
    const levelTop = top + index * levelHeight;
    addBox(slide, { left: levelLeft, top: levelTop, width: levelWidth, height: levelHeight - 5 }, {
      name: qaElementName({ parent: `hierarchy-level-${index}`, domains: ["hierarchy-shape", "hierarchy-content"] }),
      geometry: "trapezoid",
      fill: palette[index],
      line: { style: "solid", fill: "#FFFFFF", width: 2 },
      shadow: "shadow-sm",
    });
    addText(slide, level.title, { left: levelLeft + 16, top: levelTop + 13, width: levelWidth - 32, height: 30 }, {
      fontSize: levels.length <= 4 ? 20 : 17,
      bold: true,
      color: "#FFFFFF",
      alignment: "center",
    });
    if (level.share) addText(slide, level.share, { left: levelLeft + 16, top: levelTop + 43, width: levelWidth - 32, height: 25 }, {
      fontSize: levels.length <= 4 ? 18 : 15,
      bold: true,
      color: "#DFF9FB",
      alignment: "center",
    });
    if (index < levels.length - 1) addCircle(slide, { left: levelLeft - 18, top: levelTop + levelHeight - 15, width: levelWidth + 36, height: 28 }, {
      fill: "none",
      line: { style: "solid", fill: "#A9D5F3", width: 1.5 },
      shadow: "shadow-none",
    });

    addBox(slide, { left: 718, top: levelTop + 2, width: 486, height: levelHeight - 10 }, {
      name: qaElementName({ parent: `hierarchy-note-${index}`, domains: ["hierarchy-note", "hierarchy-content"] }),
      fill: index % 2 ? "#F2F7FB" : THEME.surface,
      line: { style: "solid", fill: "#D8E5EF", width: 1 },
      shadow: "shadow-none",
    });
    addCircle(slide, { left: 740, top: levelTop + levelHeight / 2 - 20, width: 40, height: 40 }, {
      fill: palette[index],
      line: { style: "solid", fill: "#FFFFFF", width: 2 },
      shadow: "shadow-sm",
      text: String(index + 1).padStart(2, "0"),
      fontSize: 16,
      bold: true,
      color: "#FFFFFF",
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    addText(slide, wrapChineseText(level.body ?? "", levels.length <= 4 ? 25 : 20), { left: 800, top: levelTop + 13, width: 374, height: levelHeight - 32 }, {
      fontSize: typographySize("componentMeta", 16),
      color: THEME.body,
      verticalAlignment: "middle",
    });
    slide.shapes.add({
      geometry: "line",
      position: transformPosition(slide, { left: levelLeft + levelWidth + 12, top: levelTop + (levelHeight - 5) / 2, width: 78, height: 0 }),
      fill: "none",
      line: { style: "dashed", fill: "#9DBBD3", width: 1.2 },
    });
  });
  return slide;
}

export function computeSwimlaneLayout({ laneCount, stageCount, hasConclusion }) {
  const left = 145;
  const top = 155;
  const laneLabelLeft = 44;
  const laneLabelWidth = 82;
  const laneWidth = 1015;
  const laneHeight = Math.min(hasConclusion ? 112 : 150, (hasConclusion ? 336 : 450) / laneCount);
  return {
    left,
    top,
    laneLabelLeft,
    laneLabelWidth,
    laneWidth,
    laneHeight,
    stageWidth: laneWidth / stageCount,
    conclusionTop: 520,
    conclusionHeight: 108,
  };
}

export function buildSwimlaneProcess(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "多角色泳道流程");
  const hasConclusion = Boolean(params.conclusion);
  const {
    left, top, laneLabelLeft, laneLabelWidth, laneWidth, laneHeight, stageWidth, conclusionTop, conclusionHeight,
  } = computeSwimlaneLayout({ laneCount: params.lanes.length, stageCount: params.stages.length, hasConclusion });
  params.stages.forEach((stage, index) => addText(slide, stage, {
    left: left + index * stageWidth, top: 121, width: stageWidth, height: 30,
  }, { fontSize: typographySize("componentBody", 18), bold: true, color: THEME.body, alignment: "center" }));
  params.lanes.forEach((lane, laneIndex) => {
    addBox(slide, { left: laneLabelLeft, top: top + laneIndex * laneHeight, width: laneLabelWidth, height: laneHeight - 10 }, {
      name: qaElementName({ parent: `swimlane-label-${laneIndex}`, domains: ["swimlane-frame", "swimlane-content"] }),
      fill: [THEME.accent, THEME.accentAlt, THEME.cyan][laneIndex % 3], line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
      text: lane, fontSize: typographySize("componentBody", 18), bold: true, color: "#FFFFFF",
    });
    slide.shapes.add({
      geometry: "rect",
      name: qaElementName({ parent: `swimlane-background-${laneIndex}`, domains: ["swimlane-frame"] }),
      position: transformPosition(slide, { left, top: top + laneIndex * laneHeight, width: laneWidth, height: laneHeight - 10 }),
      fill: laneIndex % 2 ? "#EEF4FC" : "#F8FBFF", line: { style: "solid", fill: THEME.line, width: 1 },
    });
  });
  const taskWidth = Math.min(252, stageWidth - 42);
  const taskHeight = Math.min(82, laneHeight - 24);
  const taskPositions = params.tasks.map((task) => ({
    left: left + task.stage * stageWidth + (stageWidth - taskWidth) / 2,
    top: top + task.lane * laneHeight + (laneHeight - taskHeight) / 2,
    width: taskWidth,
    height: taskHeight,
  }));
  for (let index = 0; index < taskPositions.length - 1; index += 1) {
    const from = taskPositions[index];
    const to = taskPositions[index + 1];
    const x1 = from.left + from.width;
    const y1 = from.top + from.height / 2;
    const x2 = to.left;
    const y2 = to.top + to.height / 2;
    slide.shapes.add({
      geometry: "line",
      position: transformPosition(slide, {
        left: x1,
        top: Math.min(y1, y2),
        width: x2 - x1,
        height: Math.abs(y2 - y1),
        verticalFlip: y2 < y1,
      }),
      fill: "none",
      line: { style: "solid", fill: THEME.muted, width: 2.5 },
      tail: { type: "triangle", width: "med", length: "med" },
    });
  }
  const taskShapes = params.tasks.map((task, index) => addBox(slide, taskPositions[index], {
    name: qaElementName({ parent: `swimlane-task-${index}`, domains: ["swimlane-content"] }),
    fill: task.lane % 2 ? THEME.accentAlt : THEME.accent,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-sm",
    text: task.label,
    fontSize: typographySize("componentBody", 18),
    bold: true,
    color: "#FFFFFF",
  }));
  if (hasConclusion) {
    addBox(slide, { left, top: conclusionTop, width: laneWidth, height: conclusionHeight }, {
      name: qaElementName({ parent: "swimlane-conclusion", domains: ["swimlane-content"] }),
      fill: "#EAF2FD",
      line: { style: "solid", fill: THEME.accent, width: 1.5 },
      shadow: "shadow-none",
      text: `协同结论\n${params.conclusion}`,
      fontSize: typographySize("componentBody", 18),
      bold: true,
      color: THEME.accent,
    });
  }
  return slide;
}

export function buildFrameworkMatrix(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "四象限分析框架");
  const positions = [
    { left: 120, top: 150 }, { left: 650, top: 150 }, { left: 120, top: 405 }, { left: 650, top: 405 },
  ];
  params.quadrants.forEach((quadrant, index) => {
    addBox(slide, { ...positions[index], width: 510, height: 220 }, {
      fill: "#FFFFFF", line: { style: "solid", fill: index % 2 ? THEME.accentAlt : THEME.accent, width: 2 }, shadow: "shadow-sm",
    });
    addBox(slide, { left: positions[index].left, top: positions[index].top, width: 510, height: 58 }, {
      fill: index % 2 ? THEME.accentAlt : THEME.accent, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
      text: quadrant.title, fontSize: 21, bold: true, color: "#FFFFFF", alignment: "left",
    });
    addText(slide, quadrant.body, { left: positions[index].left + 24, top: positions[index].top + 80, width: 462, height: 108 }, {
      fontSize: 17, color: THEME.body, verticalAlignment: "top",
    });
  });
  return slide;
}

export function buildDataSummary(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "数据摘要面板");
  params.metrics.forEach((metric, index) => addBox(slide, {
    left: 70 + index * 286, top: 145, width: 260, height: 126,
  }, { fill: index % 2 ? THEME.accentAlt : THEME.accent, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-md", text: `${metric.label}\n${metric.value}`, fontSize: 24, bold: true, color: "#FFFFFF" }));
  addBox(slide, { left: 70, top: 302, width: 760, height: 340 }, {
    fill: "#FFFFFF", line: { style: "solid", fill: THEME.line, width: 1 }, shadow: "shadow-sm",
  });
  addText(slide, params.chartTitle, { left: 102, top: 326, width: 420, height: 32 }, { fontSize: 22, bold: true, color: THEME.accent });
  slide.charts.add("bar", {
    position: { left: 102, top: 372, width: 690, height: 230 },
    categories: params.categories,
    series: [{ name: params.seriesName, values: params.values, fill: THEME.accent }],
    hasLegend: false,
    dataLabels: { showValue: true, position: "outEnd" },
  });
  addBox(slide, { left: 860, top: 302, width: 350, height: 340 }, {
    fill: "#FFFFFF", line: { style: "solid", fill: THEME.line, width: 1 }, shadow: "shadow-sm",
  });
  addText(slide, params.summaryTitle, { left: 892, top: 334, width: 286, height: 34 }, { fontSize: 22, bold: true, color: THEME.accent });
  addText(slide, params.summary, { left: 892, top: 390, width: 286, height: 210 }, { fontSize: 17, color: THEME.body, verticalAlignment: "top" });
  return slide;
}

export function buildPersonaProfile(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "双人群画像");
  params.personas.forEach((persona, index) => {
    const left = 78 + index * 610;
    addBox(slide, { left, top: 170, width: 560, height: 470 }, { fill: "#FFFFFF", line: { style: "dashed", fill: THEME.line, width: 1 }, shadow: "shadow-sm" });
    addBox(slide, { left: left + 48, top: 142, width: 464, height: 72 }, {
      fill: index ? THEME.accentAlt : THEME.accent, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-md",
      text: persona.name, fontSize: 25, bold: true, color: "#FFFFFF",
    });
    addCircle(slide, { left: left + 22, top: 132, width: 92, height: 92 }, {
      fill: "#FFFFFF", line: { style: "solid", fill: THEME.line, width: 1 }, shadow: "shadow-sm",
      text: persona.initial, fontSize: 34, bold: true, color: index ? THEME.accentAlt : THEME.accent,
    });
    addText(slide, persona.meta, { left: left + 38, top: 246, width: 484, height: 36 }, { fontSize: 17, color: THEME.body, alignment: "center" });
    persona.tags.forEach((tag, tagIndex) => addBox(slide, { left: left + 38 + tagIndex * 166, top: 304, width: 148, height: 40 }, {
      fill: "#F1F7FB", line: { style: "dashed", fill: THEME.line, width: 1 }, shadow: "shadow-none", text: tag, fontSize: 16, color: THEME.body,
    }));
    persona.scores.forEach((score, scoreIndex) => {
      addText(slide, score.label, { left: left + 48, top: 380 + scoreIndex * 45, width: 120, height: 28 }, { fontSize: 16, color: THEME.body });
      slide.shapes.add({ geometry: "rect", position: { left: left + 178, top: 389 + scoreIndex * 45, width: 310, height: 12 }, fill: "#E7EEF5", line: { style: "solid", fill: "none", width: 0 } });
      slide.shapes.add({ geometry: "rect", position: { left: left + 178, top: 389 + scoreIndex * 45, width: 310 * score.value, height: 12 }, fill: index ? THEME.accentAlt : THEME.accent, line: { style: "solid", fill: "none", width: 0 } });
    });
  });
  return slide;
}

export function buildProblemImprovement(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "问题—改进");
  addBox(slide, { left: 72, top: 150, width: 470, height: 480 }, {
    fill: "#FFFFFF", line: { style: "solid", fill: THEME.accent, width: 2 }, shadow: "shadow-sm",
  });
  addBox(slide, { left: 738, top: 150, width: 470, height: 480 }, {
    fill: "#FFFFFF", line: { style: "solid", fill: THEME.accentAlt, width: 2 }, shadow: "shadow-sm",
  });
  addText(slide, params.problemTitle, { left: 102, top: 178, width: 410, height: 44 }, { fontSize: typographySize("componentHeading", 26), bold: true, color: THEME.accent, alignment: "center" });
  addText(slide, params.improvementTitle, { left: 768, top: 178, width: 410, height: 44 }, { fontSize: typographySize("componentHeading", 26), bold: true, color: THEME.accentAlt, alignment: "center" });
  const itemText = (item) => typeof item === "string"
    ? item
    : [item.title, item.body].filter(Boolean).join("\n");
  const itemTop = (count, index) => (count === 2 ? 278 + index * 142 : 246 + index * 112);
  const itemHeight = (count) => (count === 2 ? 104 : 86);
  const addPanelItem = (item, position, palette) => {
    const objectItem = typeof item === "string" ? null : item;
    addBox(slide, position, {
      name: qaElementName({ parent: palette.qaParent, domains: [palette.qaDomain] }),
      fill: palette.fill,
      line: { style: "solid", fill: palette.line, width: 1 },
      shadow: palette.shadow,
      ...(objectItem ? {} : { text: itemText(item), fontSize: typographySize("componentBody", 18), color: palette.text, alignment: "left" }),
    });
    if (!objectItem) return;
    addText(slide, objectItem.title, {
      left: position.left + 16, top: position.top + 12, width: position.width - 32, height: 26,
    }, {
      name: qaElementName({ within: palette.qaParent, role: "title" }),
      fontSize: typographySize("componentItemTitle", 19), bold: true, color: palette.text, alignment: "left",
    });
    addText(slide, wrapChineseText(objectItem.body, 18), {
      left: position.left + 16, top: position.top + 42, width: position.width - 32, height: position.height - 50,
    }, {
      name: qaElementName({ within: palette.qaParent, role: "body" }),
      fontSize: typographySize("componentBody", 18), color: palette.text, alignment: "left", verticalAlignment: "top",
    });
  };
  params.problems.slice(0, 3).forEach((item, index, items) => addPanelItem(item, {
    left: 112, top: itemTop(items.length, index), width: 390, height: itemHeight(items.length),
  }, {
    fill: "#F1F7FB", line: THEME.line, shadow: "shadow-none", text: THEME.body,
    qaParent: `problem-item-${index}`, qaDomain: "problem-items",
  }));
  params.improvements.slice(0, 3).forEach((item, index, items) => addPanelItem(item, {
    left: 778, top: itemTop(items.length, index), width: 390, height: itemHeight(items.length),
  }, {
    fill: item.emphasis ? THEME.accentAlt : "#ECFBFC",
    line: item.emphasis ? THEME.accentAlt : "#A8E7EA",
    shadow: item.emphasis ? "shadow-sm" : "shadow-none",
    text: item.emphasis ? "#FFFFFF" : THEME.body,
    qaParent: `improvement-item-${index}`,
    qaDomain: "improvement-items",
  }));
  addBox(slide, { left: 582, top: 328, width: 116, height: 116 }, {
    geometry: "rightArrow", fill: THEME.cyan, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-md",
  });
  return slide;
}

export function buildImageCaseGallery(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "图片案例展示");
  params.cases.forEach((item, index) => {
    const left = 56 + index * 408;
    addBox(slide, { left, top: 148, width: 380, height: 500 }, { fill: "#FFFFFF", line: { style: "solid", fill: THEME.line, width: 1 }, shadow: "shadow-sm" });
    addBox(slide, { left: left + 22, top: 168, width: 336, height: 62 }, {
      fill: index % 2 ? THEME.accentAlt : THEME.accent, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none", text: `${item.label}  ${item.metric}`, fontSize: 22, bold: true, color: "#FFFFFF",
    });
    addBox(slide, { left: left + 22, top: 250, width: 336, height: 270 }, {
      fill: "#E7EEF5", line: { style: "solid", fill: "#D0DAE5", width: 1 }, shadow: "shadow-none", text: item.imageLabel, fontSize: 24, bold: true, color: THEME.muted,
    });
    addText(slide, item.caption, { left: left + 34, top: 544, width: 312, height: 72 }, { fontSize: 17, color: THEME.body, alignment: "center" });
  });
  return slide;
}

export function buildGoalKpiMap(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "总目标 · 单元指标 · 结果贡献");
  const rows = params.rows;
  if (rows.length < 3 || rows.length > 5) throw new Error("目标与 KPI 映射支持 3–5 个责任单元");
  for (const row of rows) {
    if (row.metrics.length < 1 || row.metrics.length > 3) throw new Error("每个责任单元支持 1–3 项 KPI");
  }

  const goalFrame = { left: 48, top: 140, width: 1184, height: 54 };
  addBox(slide, goalFrame, {
    name: qaElementName({ parent: "goal-kpi-goal" }),
    fill: "#315AA7", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-sm",
    text: params.goal, fontSize: 22, bold: true, color: "#FFFFFF",
  });
  const left = 48;
  const gap = 12;
  const totalWidth = 1184;
  const columnWidth = (totalWidth - gap * (rows.length - 1)) / rows.length;
  const columnTop = 230;
  const columnHeight = 360;

  rows.forEach((row, index) => {
    const columnLeft = left + index * (columnWidth + gap);
    const columnFrame = { left: columnLeft, top: columnTop, width: columnWidth, height: columnHeight };
    addAnchoredLine(slide,
      { frame: goalFrame, side: "bottom", parent: "goal-kpi-goal" },
      { frame: columnFrame, side: "top", parent: `goal-kpi-column-${index}` },
      "#6483BB", 2);
    addBox(slide, columnFrame, {
      name: qaElementName({ parent: `goal-kpi-column-${index}`, domains: ["goal-kpi-columns"] }),
      fill: index % 2 ? "#F1F5F9" : "#F7FAFC",
      line: { style: "solid", fill: "#D8E3ED", width: 1 }, shadow: "shadow-sm",
    });
    addBox(slide, { left: columnLeft, top: columnTop, width: columnWidth, height: 52 }, {
      fill: index === rows.length - 1 ? THEME.accentAlt : "#567AB8",
      line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
      text: row.title, fontSize: 18, bold: true, color: "#FFFFFF",
    });
    addText(slide, wrapChineseText(row.body, rows.length === 5 ? 11 : 15), {
      left: columnLeft + 16, top: columnTop + 66, width: columnWidth - 32, height: 62,
    }, {
      fontSize: 16, color: THEME.body, alignment: "center", verticalAlignment: "top",
    });
    const metricTop = columnTop + 142;
    const metricHeight = rows.length === 5 ? 50 : 56;
    row.metrics.forEach((metric, metricIndex) => {
      const top = metricTop + metricIndex * (metricHeight + 8);
      addBox(slide, { left: columnLeft + 16, top, width: columnWidth - 32, height: metricHeight }, {
        fill: "#FFFFFF", line: { style: "solid", fill: "#C7D8E7", width: 1 }, shadow: "shadow-none",
      });
      addText(slide, metric.value, { left: columnLeft + 26, top: top + 7, width: (columnWidth - 52) * 0.46, height: metricHeight - 14 }, {
        fontSize: 20, bold: true, color: THEME.accent, alignment: "center",
      });
      addText(slide, metric.label, { left: columnLeft + 30 + (columnWidth - 52) * 0.46, top: top + 7, width: (columnWidth - 52) * 0.54 - 4, height: metricHeight - 14 }, {
        fontSize: 16, color: THEME.body, alignment: "center",
      });
    });
    addBox(slide, { left: columnLeft, top: 546, width: columnWidth, height: 44 }, {
      geometry: "chevron", fill: index === rows.length - 1 ? THEME.accentAlt : "#567AB8",
      line: { style: "solid", fill: "#FFFFFF", width: 1 }, shadow: "shadow-none",
      text: row.outcome ?? row.title, fontSize: 16, bold: true, color: "#FFFFFF",
      insets: { top: 2, right: 14, bottom: 2, left: 10 },
    });
  });
  addBox(slide, { left: 48, top: 606, width: 1184, height: 44 }, {
    fill: "#173F68", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
    text: params.summary, fontSize: 17, bold: true, color: "#FFFFFF", autoFit: "none",
  });
  return slide;
}

export function buildLayeredArchitecture(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "分层架构 / 生态关系");
  const sourceNodes = params.sources.map((item, index) => addCircle(slide, { left: 90 + index * 180, top: 520, width: 110, height: 80 }, {
    fill: THEME.accent, line: { style: "solid", fill: "#FFFFFF", width: 2 }, shadow: "shadow-sm", text: item, fontSize: 16, bold: true, color: "#FFFFFF",
  }));
  const platform = addBox(slide, { left: 250, top: 320, width: 780, height: 120 }, {
    fill: THEME.accentAlt, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-lg", text: params.platform, fontSize: 30, bold: true, color: "#FFFFFF",
  });
  const appNodes = params.apps.map((item, index) => addCircle(slide, { left: 280 + index * 190, top: 160, width: 130, height: 92 }, {
    fill: THEME.cyan, line: { style: "solid", fill: "#FFFFFF", width: 2 }, shadow: "shadow-sm", text: item, fontSize: 17, bold: true, color: "#FFFFFF",
  }));
  sourceNodes.forEach((node) => slide.shapes.connect(node, platform, { kind: "straight", fromSide: "top", toSide: "bottom", line: { style: "solid", fill: THEME.line, width: 2 }, tail: { type: "triangle", width: "sm", length: "sm" } }));
  appNodes.forEach((node) => slide.shapes.connect(platform, node, { kind: "straight", fromSide: "top", toSide: "bottom", line: { style: "solid", fill: THEME.line, width: 2 }, tail: { type: "triangle", width: "sm", length: "sm" } }));
  platform.bringToFront();
  sourceNodes.forEach((node) => node.bringToFront());
  appNodes.forEach((node) => node.bringToFront());
  return slide;
}
