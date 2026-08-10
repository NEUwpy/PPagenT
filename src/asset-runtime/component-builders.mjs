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
};

const EMBEDDED_SLIDES = new WeakMap();

function embeddedContext(slide) {
  return EMBEDDED_SLIDES.get(slide) ?? null;
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
  return Math.max(16, Math.round(fontSize * scale));
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
        text: step.emphasisLabel ?? "结论 / 结果", fontSize: 15, bold: true, color: "#FFFFFF",
      });
    } else {
      addCircle(slide, { left: x + 18, top: 250, width: 52, height: 52 }, {
        fill: "#FFFFFF", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
        text: String(index + 1).padStart(2, "0"), fontSize: 18, bold: true, color: index % 2 ? THEME.accentAlt : THEME.accent,
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      });
    }
    addText(slide, step.title, { left: x + 22, top: 326, width: width - 44, height: 52 }, {
      fontSize: 24, bold: true, color: "#FFFFFF", alignment: "center",
    });
    addText(slide, step.body, { left: x + 22, top: 394, width: width - 44, height: 76 }, {
      fontSize: 16, color: "#EAF6FF", alignment: "center", verticalAlignment: "top",
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
      position: {
        left: from.left + from.width * 0.82,
        top: to.top + to.height / 2,
        width: to.left - (from.left + from.width * 0.82),
        height: from.top - to.top,
        verticalFlip: true,
      },
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
      position: {
        left: from.left + from.width,
        top: Math.min(from.top, to.top) + 46,
        width: to.left - (from.left + from.width),
        height: Math.abs(to.top - from.top),
        verticalFlip: to.top < from.top,
      },
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

export function buildComparison(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "双向对比");
  const emphasis = resolveComparisonEmphasis(params.left, params.right);
  const leftFocused = emphasis === "left";
  const rightFocused = emphasis === "right";
  const leftNode = addCircle(slide, {
    left: leftFocused ? 310 : 340,
    top: leftFocused ? 205 : 240,
    width: leftFocused ? 290 : emphasis ? 210 : 250,
    height: leftFocused ? 290 : emphasis ? 210 : 250,
  }, {
    fill: emphasis && !leftFocused ? "#E9F1F8" : THEME.accent,
    line: leftFocused ? { style: "solid", fill: THEME.cyan, width: 5 } : { style: "solid", fill: "none", width: 0 },
    shadow: leftFocused ? "shadow-lg" : emphasis ? "shadow-sm" : "shadow-lg",
    text: params.left.title, fontSize: leftFocused ? 30 : 26, bold: true, color: emphasis && !leftFocused ? THEME.body : "#FFFFFF",
  });
  const rightNode = addCircle(slide, {
    left: rightFocused ? 680 : 730,
    top: rightFocused ? 205 : 240,
    width: rightFocused ? 290 : emphasis ? 210 : 250,
    height: rightFocused ? 290 : emphasis ? 210 : 250,
  }, {
    fill: emphasis && !rightFocused ? "#E9F1F8" : THEME.accentAlt,
    line: rightFocused ? { style: "solid", fill: THEME.cyan, width: 5 } : { style: "solid", fill: "none", width: 0 },
    shadow: rightFocused ? "shadow-lg" : emphasis ? "shadow-sm" : "shadow-lg",
    text: params.right.title, fontSize: rightFocused ? 30 : 26, bold: true, color: emphasis && !rightFocused ? THEME.body : "#FFFFFF",
  });
  slide.shapes.connect(leftNode, rightNode, {
    kind: "straight", fromSide: "right", toSide: "left",
    line: { style: "solid", fill: THEME.cyan, width: 4 },
    head: { type: "triangle", width: "med", length: "med" },
    tail: { type: "triangle", width: "med", length: "med" },
  });
  const renderBullets = (items, left, color, focused) => items.forEach((item, index) => addBox(slide, {
    left, top: 220 + index * 88, width: 275, height: 78,
  }, {
    fill: emphasis && !focused ? "#F4F7FA" : color,
    line: emphasis && !focused ? { style: "solid", fill: THEME.line, width: 1 } : { style: "solid", fill: "none", width: 0 },
    shadow: focused ? "shadow-md" : "shadow-sm",
    text: wrapChineseText(item, 17),
    fontSize: focused ? 17 : 15,
    bold: true,
    color: emphasis && !focused ? THEME.body : "#FFFFFF",
    alignment: "center",
  }));
  renderBullets(params.left.items, 55, THEME.accent, leftFocused);
  renderBullets(params.right.items, 950, THEME.accentAlt, rightFocused);
  if (emphasis) {
    addBox(slide, { left: emphasis === "left" ? 392 : 762, top: 186, width: 126, height: 34 }, {
      fill: THEME.cyan, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-sm",
      text: (emphasis === "left" ? params.left : params.right).emphasisLabel ?? "重点路线",
      fontSize: 15, bold: true, color: "#FFFFFF",
    });
  }
  addBox(slide, { left: 585, top: 325, width: 110, height: 50 }, {
    fill: "#FFFFFF", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
    text: params.centerLabel, fontSize: 18, bold: true, color: THEME.dark,
  });
  return slide;
}

export function buildRadialHub(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "中心辐射");
  const center = addCircle(slide, { left: 515, top: 260, width: 250, height: 250 }, {
    fill: THEME.accent, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-lg",
    text: params.center, fontSize: 30, bold: true, color: "#FFFFFF",
  });
  const cx = 640;
  const cy = 385;
  const radius = 220;
  const nodes = params.items.map((item, index) => {
    const angle = -Math.PI / 2 + index * (2 * Math.PI / params.items.length);
    return addCircle(slide, {
      left: cx + Math.cos(angle) * radius - 52,
      top: cy + Math.sin(angle) * radius - 52,
      width: 104, height: 104,
    }, { fill: index % 2 ? THEME.accentAlt : THEME.cyan, line: { style: "solid", fill: "#FFFFFF", width: 3 }, shadow: "shadow-md" });
  });
  nodes.forEach((node) => slide.shapes.connect(center, node, {
    kind: "straight", line: { style: "solid", fill: THEME.line, width: 2 },
  }));
  params.items.forEach((item, index) => {
    const angle = -Math.PI / 2 + index * (2 * Math.PI / params.items.length);
    addText(slide, item, {
      left: cx + Math.cos(angle) * radius - 44,
      top: cy + Math.sin(angle) * radius - 44,
      width: 88,
      height: 88,
    }, {
      fontSize: 16, bold: true, color: "#FFFFFF", alignment: "center",
    });
  });
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
  const slide = prepareSlide(presentation, params.title, "循环闭环");
  const center = addCircle(slide, { left: 520, top: 270, width: 240, height: 240 }, {
    fill: "#FFFFFF", line: { style: "solid", fill: THEME.accentSoft, width: 8 }, shadow: "shadow-md",
    text: params.center, fontSize: 28, bold: true, color: THEME.accent,
  });
  const positions = [
    { left: 520, top: 145 }, { left: 765, top: 300 }, { left: 520, top: 505 }, { left: 275, top: 300 },
  ];
  const nodes = params.steps.map((step, index) => addCircle(slide, { ...positions[index], width: 170, height: 110 }, {
    fill: [THEME.accent, THEME.accentAlt, THEME.cyan, "#4C8FD8"][index],
    line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-md",
    text: step, fontSize: 20, bold: true, color: "#FFFFFF",
  }));
  for (let index = 0; index < nodes.length; index += 1) {
    slide.shapes.connect(nodes[index], nodes[(index + 1) % nodes.length], {
      kind: "curved", line: { style: "solid", fill: THEME.accent, width: 3 },
      tail: { type: "triangle", width: "med", length: "med" },
    });
  }
  center.bringToFront();
  return slide;
}

export function buildTimelineRoadmap(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "时间轴 / 路线图");
  const points = params.milestones.map((_, index) => ({
    x: 90 + index * (1080 / (params.milestones.length - 1)),
    y: 570 - index * 105,
  }));
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    slide.shapes.add({
      geometry: "line",
      position: {
        left: from.x,
        top: Math.min(from.y, to.y),
        width: to.x - from.x,
        height: Math.abs(to.y - from.y),
        verticalFlip: to.y < from.y,
      },
      fill: "none", line: { style: "solid", fill: THEME.accent, width: 4 },
    });
  }
  points.forEach((point, index) => {
    addCircle(slide, { left: point.x - 12, top: point.y - 12, width: 24, height: 24 }, {
      fill: index % 2 ? THEME.accentAlt : THEME.accent, line: { style: "solid", fill: "#FFFFFF", width: 3 }, shadow: "shadow-none",
    });
    const cardTop = point.y - 230;
    addBox(slide, { left: Math.max(34, Math.min(1000, point.x - 110)), top: cardTop, width: 220, height: 180 }, {
      fill: "#FFFFFF", line: { style: "dashed", fill: THEME.line, width: 1 }, shadow: "shadow-sm",
    });
    addText(slide, params.milestones[index].period, { left: Math.max(50, Math.min(1016, point.x - 94)), top: cardTop + 18, width: 188, height: 28 }, {
      fontSize: 16, color: THEME.muted,
    });
    addText(slide, params.milestones[index].title, { left: Math.max(50, Math.min(1016, point.x - 94)), top: cardTop + 50, width: 188, height: 52 }, {
      fontSize: 22, bold: true, color: THEME.accent,
    });
    addText(slide, params.milestones[index].body, { left: Math.max(50, Math.min(1016, point.x - 94)), top: cardTop + 108, width: 188, height: 54 }, {
      fontSize: 16, color: THEME.body, verticalAlignment: "top",
    });
  });
  return slide;
}

export function buildFunnelConversion(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "转化漏斗");
  const widths = [500, 390, 285, 180];
  params.stages.forEach((stage, index) => {
    const width = widths[index];
    const left = 330 - width / 2 + 130;
    addBox(slide, { left, top: 150 + index * 116, width, height: 104 }, {
      geometry: "trapezoid", fill: [THEME.accent, THEME.accentAlt, THEME.cyan, "#4C8FD8"][index],
      line: { style: "solid", fill: "#FFFFFF", width: 2 }, shadow: "shadow-md",
      text: `${stage.rate}\n${stage.label}`, fontSize: 22, bold: true, color: "#FFFFFF",
    });
    addText(slide, stage.note, { left: 760, top: 164 + index * 116, width: 420, height: 76 }, {
      fontSize: 18, color: THEME.body,
    });
    slide.shapes.add({
      geometry: "line", position: { left: left + width + 16, top: 202 + index * 116, width: 120, height: 0 },
      fill: "none", line: { style: "dashed", fill: THEME.accentAlt, width: 1.5 },
    });
  });
  return slide;
}

export function buildHierarchyPyramid(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "层级金字塔");
  const widths = [210, 330, 450, 570];
  params.levels.forEach((level, index) => {
    const width = widths[index];
    addBox(slide, { left: 90 + (570 - width) / 2, top: 150 + index * 122, width, height: 110 }, {
      geometry: "trapezoid", fill: [THEME.cyan, THEME.accentAlt, THEME.accent, "#17406D"][index],
      line: { style: "solid", fill: "#FFFFFF", width: 2 }, shadow: "shadow-sm",
      text: `${level.title}\n${level.share}`, fontSize: 20, bold: true, color: "#FFFFFF",
    });
    addBox(slide, { left: 740, top: 164 + index * 122, width: 430, height: 80 }, {
      fill: "#FFFFFF", line: { style: "dashed", fill: THEME.line, width: 1 }, shadow: "shadow-none",
      text: level.body, fontSize: 17, color: THEME.body, alignment: "left",
    });
  });
  return slide;
}

export function buildSwimlaneProcess(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "多角色泳道流程");
  const left = 120;
  const top = 150;
  const hasConclusion = Boolean(params.conclusion);
  const laneHeight = Math.min(hasConclusion ? 118 : 150, (hasConclusion ? 360 : 450) / params.lanes.length);
  const stageWidth = 1040 / params.stages.length;
  params.stages.forEach((stage, index) => addText(slide, stage, {
    left: left + index * stageWidth, top: 120, width: stageWidth, height: 30,
  }, { fontSize: 18, bold: true, color: THEME.body, alignment: "center" }));
  params.lanes.forEach((lane, laneIndex) => {
    addBox(slide, { left: 36, top: top + laneIndex * laneHeight, width: 70, height: laneHeight - 8 }, {
      fill: [THEME.accent, THEME.accentAlt, THEME.cyan][laneIndex % 3], line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
      text: lane, fontSize: 18, bold: true, color: "#FFFFFF",
    });
    slide.shapes.add({
      geometry: "rect", position: { left, top: top + laneIndex * laneHeight, width: 1040, height: laneHeight - 8 },
      fill: laneIndex % 2 ? "#F1F7FB" : "#FFFFFF", line: { style: "dashed", fill: THEME.line, width: 1 },
    });
  });
  const taskWidth = Math.min(220, stageWidth - 36);
  const taskHeight = Math.min(86, laneHeight - 28);
  const taskShapes = params.tasks.map((task) => addBox(slide, {
    left: left + task.stage * stageWidth + (stageWidth - taskWidth) / 2,
    top: top + task.lane * laneHeight + (laneHeight - taskHeight) / 2,
    width: taskWidth,
    height: taskHeight,
  }, {
    fill: task.lane % 2 ? THEME.accentAlt : THEME.accent,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-sm",
    text: task.label,
    fontSize: 16,
    bold: true,
    color: "#FFFFFF",
  }));
  for (let index = 0; index < taskShapes.length - 1; index += 1) {
    slide.shapes.connect(taskShapes[index], taskShapes[index + 1], {
      kind: "elbow", line: { style: "dashed", fill: THEME.muted, width: 1.5 },
      tail: { type: "triangle", width: "sm", length: "sm" },
    });
  }
  taskShapes.forEach((shape) => shape.bringToFront());
  if (hasConclusion) {
    addBox(slide, { left, top: 532, width: 1040, height: 96 }, {
      fill: "#EAF2FD",
      line: { style: "solid", fill: THEME.accent, width: 1.5 },
      shadow: "shadow-none",
      text: `协同结论\n${params.conclusion}`,
      fontSize: 17,
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
  addText(slide, params.problemTitle, { left: 102, top: 178, width: 410, height: 44 }, { fontSize: 26, bold: true, color: THEME.accent, alignment: "center" });
  addText(slide, params.improvementTitle, { left: 768, top: 178, width: 410, height: 44 }, { fontSize: 26, bold: true, color: THEME.accentAlt, alignment: "center" });
  const itemText = (item) => typeof item === "string"
    ? item
    : [item.title, item.body].filter(Boolean).join("\n");
  const itemTop = (count, index) => (count === 2 ? 278 + index * 142 : 246 + index * 112);
  const itemHeight = (count) => (count === 2 ? 104 : 86);
  const addPanelItem = (item, position, palette) => {
    const objectItem = typeof item === "string" ? null : item;
    addBox(slide, position, {
      fill: palette.fill,
      line: { style: "solid", fill: palette.line, width: 1 },
      shadow: palette.shadow,
      ...(objectItem ? {} : { text: itemText(item), fontSize: 15, color: palette.text, alignment: "left" }),
    });
    if (!objectItem) return;
    addText(slide, objectItem.title, {
      left: position.left + 16, top: position.top + 12, width: position.width - 32, height: 26,
    }, { fontSize: 17, bold: true, color: palette.text, alignment: "left" });
    addText(slide, wrapChineseText(objectItem.body, 18), {
      left: position.left + 16, top: position.top + 42, width: position.width - 32, height: position.height - 50,
    }, { fontSize: 14, color: palette.text, alignment: "left", verticalAlignment: "top" });
  };
  params.problems.slice(0, 3).forEach((item, index, items) => addPanelItem(item, {
    left: 112, top: itemTop(items.length, index), width: 390, height: itemHeight(items.length),
  }, { fill: "#F1F7FB", line: THEME.line, shadow: "shadow-none", text: THEME.body }));
  params.improvements.slice(0, 3).forEach((item, index, items) => addPanelItem(item, {
    left: 778, top: itemTop(items.length, index), width: 390, height: itemHeight(items.length),
  }, {
    fill: item.emphasis ? THEME.accentAlt : "#ECFBFC",
    line: item.emphasis ? THEME.accentAlt : "#A8E7EA",
    shadow: item.emphasis ? "shadow-sm" : "shadow-none",
    text: item.emphasis ? "#FFFFFF" : THEME.body,
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
  const slide = prepareSlide(presentation, params.title, "目标与 KPI 映射");
  addCircle(slide, { left: 0, top: 190, width: 300, height: 360 }, {
    fill: THEME.accent, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-lg", text: params.goal, fontSize: 34, bold: true, color: "#FFFFFF",
  });
  params.rows.forEach((row, index) => {
    const top = 150 + index * 170;
    addCircle(slide, { left: 245, top: top + 26, width: 76, height: 76 }, {
      fill: index % 2 ? THEME.accentAlt : THEME.cyan, line: { style: "solid", fill: "#FFFFFF", width: 2 }, shadow: "shadow-sm", text: "✓", fontSize: 28, bold: true, color: "#FFFFFF",
    });
    addText(slide, row.title, { left: 350, top, width: 300, height: 40 }, { fontSize: 23, bold: true, color: index % 2 ? THEME.accentAlt : THEME.accent });
    addText(slide, row.body, { left: 350, top: top + 46, width: 300, height: 76 }, { fontSize: 16, color: THEME.body, verticalAlignment: "top" });
    row.metrics.forEach((metric, metricIndex) => addCircle(slide, { left: 680 + metricIndex * 126, top: top + 16, width: 104, height: 104 }, {
      fill: "#FFFFFF", line: { style: "solid", fill: index % 2 ? THEME.accentAlt : THEME.accent, width: 2 }, shadow: "shadow-sm", text: `${metric.value}\n${metric.label}`, fontSize: 17, bold: true, color: index % 2 ? THEME.accentAlt : THEME.accent,
    }));
  });
  addBox(slide, { left: 1050, top: 175, width: 180, height: 390 }, { geometry: "upArrow", fill: THEME.accent, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-lg", text: params.summary, fontSize: 21, bold: true, color: "#FFFFFF" });
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
