import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Presentation, PresentationFile } from "@oai/artifact-tool";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "../../..");

const PAPER = "#F5F4EF";
const PAPER_2 = "#EEECE5";
const INK = "#20201D";
const BODY = "#4B4A45";
const MUTED = "#85837B";
const LINE = "#D8D5CC";
const ACCENT = "#A35D4F";
const SERIF = "Noto Serif SC";
const SANS = "Noto Sans SC";
const SOURCE_URL = "https://www.xiaohongshu.com/explore/6a17a37800000000070255dd";

function noLine() {
  return { style: "solid", fill: "none", width: 0 };
}

function addRect(slide, position, { fill = "none", line = noLine(), name } = {}) {
  return slide.shapes.add({
    geometry: "rect",
    name,
    position,
    fill,
    line,
    shadow: "shadow-none",
  });
}

function addLine(slide, x1, y1, x2, y2, color = LINE, width = 1, name) {
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

function addText(slide, text, position, {
  name,
  typeface = SANS,
  fontSize = 17,
  color = INK,
  bold = false,
  alignment = "left",
  verticalAlignment = "top",
  lineSpacing = 1,
  insets = { top: 0, right: 0, bottom: 0, left: 0 },
  runs,
} = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: noLine(),
  });
  if (runs) shape.text.set([runs]);
  else shape.text = String(text ?? "");
  shape.text.style = {
    typeface,
    fontSize,
    color,
    bold,
    alignment,
    verticalAlignment,
    lineSpacing,
    autoFit: "none",
    insets,
  };
  return shape;
}

function addCircle(slide, text, position, {
  fill = "none",
  lineColor = "#C5C2B9",
  lineWidth = 1,
  typeface = SERIF,
  fontSize = 19,
  color = INK,
  bold = false,
  name,
} = {}) {
  const shape = slide.shapes.add({
    geometry: "ellipse",
    name,
    position,
    fill,
    line: { style: "solid", fill: lineColor, width: lineWidth },
    shadow: "shadow-none",
  });
  shape.text = String(text ?? "");
  shape.text.style = {
    typeface,
    fontSize,
    color,
    bold,
    alignment: "center",
    verticalAlignment: "middle",
    lineSpacing: 1,
    autoFit: "none",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

function addFolio(slide, value) {
  addText(slide, String(value).padStart(2, "0"), { left: 1198, top: 683, width: 26, height: 15 }, {
    name: `folio-${value}`,
    typeface: SANS,
    fontSize: 11,
    color: MUTED,
    alignment: "right",
    verticalAlignment: "middle",
  });
}

function addPageTitle(slide, section, title, titleWidth) {
  addText(slide, section, { left: 56, top: 48, width: 22, height: 24 }, {
    name: `section-${section}`,
    typeface: SANS,
    fontSize: 18,
    color: ACCENT,
    verticalAlignment: "middle",
  });
  addText(slide, title, { left: 91.6, top: 44, width: titleWidth, height: 36 }, {
    name: `title-${section}`,
    typeface: SERIF,
    fontSize: 25,
    bold: true,
    verticalAlignment: "middle",
  });
  const ruleLeft = 91.6 + titleWidth + 18;
  addLine(slide, ruleLeft, 60.5, 1220, 60.5, LINE, 1, `title-rule-${section}`);
}

function addSourceNotes(slide, label) {
  slide.speakerNotes.textFrame.setText([
    "[Sources]",
    `- 视觉参考：${SOURCE_URL}`,
    `- 页面：${label}`,
    "[/Sources]",
  ].join("\n"));
}

function addSlide(presentation, label) {
  const slide = presentation.slides.add();
  slide.background.fill = PAPER;
  addSourceNotes(slide, label);
  return slide;
}

function buildCover(presentation) {
  const slide = addSlide(presentation, "封面");
  addText(slide, "让复杂内容\n更容易理解", { left: 56, top: 126, width: 734, height: 142 }, {
    name: "cover-title",
    typeface: SERIF,
    fontSize: 58,
    bold: true,
    lineSpacing: 1.12,
  });
  addText(slide, "结构先于装饰，层级先于风格", { left: 56, top: 272, width: 734, height: 40 }, {
    name: "cover-subtitle",
    typeface: SERIF,
    fontSize: 25,
    color: ACCENT,
    verticalAlignment: "middle",
  });
  addText(slide, "一套不依赖组织标识的编辑式演示系统，用清晰的标题层级、连续编号和克制留白组织知识。", { left: 56, top: 330, width: 650, height: 68 }, {
    name: "cover-summary",
    typeface: SANS,
    fontSize: 17,
    color: BODY,
    lineSpacing: 1.75,
  });
  addText(slide, "“", { left: 857.33, top: 136, width: 367, height: 48 }, {
    name: "cover-quote-mark",
    typeface: SERIF,
    fontSize: 48,
    color: ACCENT,
    bold: true,
  });
  addText(slide, "好的教学页面，不是展示更多信息，而是让读者更快找到下一步。", { left: 857.33, top: 190, width: 367, height: 70 }, {
    name: "cover-quote",
    typeface: SERIF,
    fontSize: 19,
    color: BODY,
    lineSpacing: 1.65,
  });
  addText(slide, "设计原则 01", { left: 857.33, top: 270, width: 367, height: 22 }, {
    name: "cover-quote-source",
    typeface: SANS,
    fontSize: 15,
    color: MUTED,
  });
  addFolio(slide, 1);
}

function buildAgenda(presentation) {
  const slide = addSlide(presentation, "内容地图");
  addPageTitle(slide, "00", "内容地图", 101);
  const rows = [
    ["01", "核心原则", "建立共同判断标准"],
    ["02", "方法拆解", "从原则进入操作步骤"],
    ["03", "对比示范", "观察组织方式的差异"],
    ["04", "结论收束", "留下可复用的行动准则"],
  ];
  for (let index = 0; index <= rows.length; index += 1) {
    const y = 201 + index * 88;
    addLine(slide, 102, y, 1224, y, LINE, 1, `agenda-rule-${index}`);
  }
  rows.forEach(([number, label, hint], index) => {
    const y = 201 + index * 88;
    addText(slide, number, { left: 102, top: y + 27, width: 74, height: 34 }, {
      name: `agenda-number-${number}`,
      typeface: SERIF,
      fontSize: 22,
      color: ACCENT,
      verticalAlignment: "middle",
    });
    addText(slide, label, { left: 176, top: y + 24, width: 868, height: 40 }, {
      name: `agenda-label-${number}`,
      typeface: SERIF,
      fontSize: 21,
      bold: true,
      verticalAlignment: "middle",
    });
    addText(slide, hint, { left: 1044, top: y + 25, width: 180, height: 38 }, {
      name: `agenda-hint-${number}`,
      typeface: SANS,
      fontSize: 15,
      color: MUTED,
      alignment: "right",
      verticalAlignment: "middle",
    });
  });
  addFolio(slide, 2);
}

function buildPrinciples(presentation) {
  const slide = addSlide(presentation, "核心美学原则");
  addPageTitle(slide, "01", "核心美学原则", 151.5);
  addLine(slide, 56, 212, 1224, 212, LINE, 1, "principles-top-rule");
  addLine(slide, 56, 542, 1224, 542, LINE, 1, "principles-bottom-rule");
  addLine(slide, 445.33, 213, 445.33, 541, LINE, 1, "principles-divider-1");
  addLine(slide, 834.66, 213, 834.66, 541, LINE, 1, "principles-divider-2");

  const items = [
    { symbol: "A", x: 68, y: 274.2, titleY: 352.2, bodyY: 390.55, title: "字重对比", body: "标题足够明确，正文足够安静。层级来自对比，而不是给每一段都增加装饰。" },
    { symbol: "≈", x: 479.33, y: 289.08, titleY: 367.08, bodyY: 405.42, title: "极致留白", body: "让模块之间拥有明显停顿，使视线能够聚焦，也让复杂信息保持可读。" },
    { symbol: "◐", x: 868.66, y: 289.08, titleY: 367.08, bodyY: 405.42, title: "克制色彩", body: "大部分页面由中性色构成，只用一种低饱和强调色标记真正关键的信息。" },
  ];
  items.forEach((item, index) => {
    addCircle(slide, item.symbol, { left: item.x, top: item.y, width: 48, height: 48 }, { name: `principle-symbol-${index + 1}` });
    addText(slide, item.title, { left: item.x, top: item.titleY - 3, width: index === 1 ? 320.34 : 343.34, height: 36 }, {
      name: `principle-title-${index + 1}`,
      typeface: SERIF,
      fontSize: 21,
      bold: true,
      verticalAlignment: "middle",
    });
    addText(slide, item.body, { left: item.x, top: item.bodyY - 3, width: 285, height: index === 0 ? 98 : 68 }, {
      name: `principle-body-${index + 1}`,
      typeface: SANS,
      fontSize: 17,
      color: BODY,
      lineSpacing: 1.75,
    });
  });
  addFolio(slide, 3);
}

function buildMethod(presentation) {
  const slide = addSlide(presentation, "方法拆解");
  addPageTitle(slide, "02", "方法拆解", 101);
  const rows = [
    ["01", "□", "先确定阅读入口", "用一句结论或问题建立页面中心，其他内容都围绕它展开。"],
    ["02", "T", "建立字体层级", "标题、引导语、正文、注释各自只承担一种角色。"],
    ["03", "↔", "放大模块间距", "先用空白分组，再用细线辅助；不让边框代替真正的层级。"],
    ["04", "●", "最后加入强调", "只选择一个强调色，并把它留给编号、关键词或最终行动点。"],
  ];
  for (let index = 0; index <= rows.length; index += 1) {
    const y = 177 + index * 100;
    addLine(slide, 56, y, 1224, y, LINE, 1, `method-rule-${index}`);
  }
  rows.forEach(([number, symbol, title, body], index) => {
    const rowTop = 177 + index * 100;
    addText(slide, number, { left: 56, top: rowTop + 28, width: 72, height: 44 }, {
      name: `method-number-${number}`,
      typeface: SERIF,
      fontSize: 30,
      color: "#B9B6AE",
      verticalAlignment: "middle",
    });
    addCircle(slide, symbol, { left: 148, top: rowTop + 28.5, width: 44, height: 44 }, {
      name: `method-symbol-${number}`,
      fontSize: 16,
    });
    addText(slide, title, { left: 232, top: rowTop + 26, width: 240, height: 48 }, {
      name: `method-title-${number}`,
      typeface: SERIF,
      fontSize: 21,
      bold: true,
      verticalAlignment: "middle",
    });
    if (index === 1) {
      addText(slide, "标题、引导语、正文、注释", { left: 492, top: rowTop + 26, width: 204, height: 48 }, {
        name: `method-body-${number}-emphasis`,
        typeface: SANS,
        fontSize: 17,
        color: ACCENT,
        bold: true,
        verticalAlignment: "middle",
      });
      addText(slide, "各自只承担一种角色。", { left: 696, top: rowTop + 26, width: 528, height: 48 }, {
        name: `method-body-${number}-remainder`,
        typeface: SANS,
        fontSize: 17,
        color: BODY,
        verticalAlignment: "middle",
      });
    } else {
      addText(slide, body, { left: 492, top: rowTop + 26, width: 732, height: 48 }, {
        name: `method-body-${number}`,
        typeface: SANS,
        fontSize: 17,
        color: BODY,
        verticalAlignment: "middle",
      });
    }
  });
  addFolio(slide, 4);
}

function buildComparison(presentation) {
  const slide = addSlide(presentation, "实战案例");
  addPageTitle(slide, "03", "实战案例", 101);

  const cards = [
    { x: 56, state: "×", label: "信息被平均对待", good: false, paragraph: "多个模块同时争夺注意力，标题、正文和卡片缺少明确的先后关系。" },
    { x: 654, state: "✓", label: "信息沿单一路径展开", good: true, paragraph: "先建立标题和编号轴，再让正文依次进入；读者不需要猜测从哪里开始。" },
  ];

  cards.forEach((card, index) => {
    addRect(slide, { left: card.x, top: 182, width: 570, height: 390 }, {
      name: `comparison-card-${index + 1}`,
      fill: "none",
      line: { style: "solid", fill: LINE, width: 1 },
    });
    const contentX = card.x + 27;
    addCircle(slide, card.state, { left: contentX, top: 208.13, width: 24, height: 24 }, {
      name: `comparison-state-${index + 1}`,
      fill: card.good ? INK : "none",
      lineColor: card.good ? INK : "#BDBAB1",
      typeface: SERIF,
      fontSize: 12,
      color: card.good ? "#FFFFFF" : INK,
      bold: true,
    });
    addText(slide, card.label, { left: contentX + 34, top: 202, width: 482, height: 36 }, {
      name: `comparison-label-${index + 1}`,
      typeface: SERIF,
      fontSize: 21,
      bold: true,
      verticalAlignment: "middle",
    });

    const wireX = contentX;
    addRect(slide, { left: wireX, top: 255.25, width: 516, height: 206 }, {
      name: `comparison-wireframe-${index + 1}`,
      fill: card.good ? "#F8F7F3" : PAPER_2,
    });
    addLine(slide, wireX, 255.25, wireX + 516, 255.25, LINE, 1, `comparison-wireframe-top-${index + 1}`);
    if (!card.good) {
      addRect(slide, { left: wireX + 22, top: 278.25, width: 179.36, height: 10 }, { fill: "#C9C6BD", name: "comparison-bad-title-bar" });
      addRect(slide, { left: wireX + 22, top: 300.25, width: 472, height: 5 }, { fill: LINE, name: "comparison-bad-line-1" });
      addRect(slide, { left: wireX + 22, top: 317.25, width: 292.63, height: 5 }, { fill: LINE, name: "comparison-bad-line-2" });
      [0, 1, 2].forEach((boxIndex) => {
        addRect(slide, { left: wireX + 22 + boxIndex * 160, top: 348.25, width: 152, height: 74 }, {
          fill: "#DFDDD7",
          line: { style: "solid", fill: "#D1CEC6", width: 1 },
          name: `comparison-bad-box-${boxIndex + 1}`,
        });
      });
    } else {
      addRect(slide, { left: wireX + 22, top: 278.25, width: 245.44, height: 13 }, { fill: INK, name: "comparison-good-title-bar" });
      [0, 1, 2].forEach((stepIndex) => {
        const y = 319.25 + stepIndex * 24;
        addText(slide, String(stepIndex + 1).padStart(2, "0"), { left: wireX + 22, top: y - 4, width: 54, height: 24 }, {
          name: `comparison-good-step-${stepIndex + 1}`,
          typeface: SERIF,
          fontSize: 16,
          color: ACCENT,
          verticalAlignment: "middle",
        });
        addRect(slide, { left: wireX + 94, top: y, width: 400, height: 5 }, { fill: "#D4D1C9", name: `comparison-good-step-line-${stepIndex + 1}` });
      });
      addLine(slide, wireX + 22, 426.25, wireX + 494, 426.25, "#C7C4BB", 1, "comparison-good-axis");
    }
    addText(slide, card.paragraph, { left: contentX, top: 476, width: 516, height: card.good ? 68 : 42 }, {
      name: `comparison-paragraph-${index + 1}`,
      typeface: SANS,
      fontSize: 17,
      color: BODY,
      lineSpacing: 1.65,
    });
  });
  addFolio(slide, 5);
}

function buildClosing(presentation) {
  const slide = addSlide(presentation, "收束页");
  addText(slide, "少一点装饰，", { left: 56, top: 184, width: 739, height: 78 }, {
    name: "closing-title-line-1",
    typeface: SERIF,
    fontSize: 58,
    bold: true,
    verticalAlignment: "middle",
  });
  addText(slide, "多一点秩序。", { left: 56, top: 253.5, width: 739, height: 78 }, {
    name: "closing-title-line-2",
    typeface: SERIF,
    fontSize: 58,
    color: ACCENT,
    verticalAlignment: "middle",
  });
  addText(slide, "当标题、编号、间距和阅读路径都准确时，页面自然会呈现高级感。", { left: 854.66, top: 267, width: 369.34, height: 68 }, {
    name: "closing-takeaway",
    typeface: SANS,
    fontSize: 17,
    color: BODY,
    lineSpacing: 1.7,
    verticalAlignment: "bottom",
  });
  addLine(slide, 56, 381.19, 1224, 381.19, LINE, 1, "closing-keyword-rule");
  [["层级", 56], ["留白", 108.09], ["节奏", 160.17]].forEach(([word, x], index) => {
    addText(slide, word, { left: x, top: 394, width: 36, height: 26 }, {
      name: `closing-keyword-${index + 1}`,
      typeface: SANS,
      fontSize: 13,
      color: MUTED,
      bold: true,
      verticalAlignment: "middle",
    });
  });
  addFolio(slide, 6);
}

export function buildNeutralEditorialPresentation() {
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  buildCover(presentation);
  buildAgenda(presentation);
  buildPrinciples(presentation);
  buildMethod(presentation);
  buildComparison(presentation);
  buildClosing(presentation);
  return presentation;
}

function parseOutputArgument() {
  const args = process.argv.slice(2);
  let output = path.join(here, "native-review", "neutral-editorial-001-v2.pptx");
  for (let index = 0; index < args.length; index += 2) {
    if (args[index] !== "--output" || !args[index + 1]) throw new Error("usage: node generate.mjs [--output <new-file.pptx>]");
    output = path.resolve(args[index + 1]);
  }
  return output;
}

async function main() {
  const skillDir = process.env.SKILL_DIR;
  const pythonExecutable = process.env.RUNTIME_PYTHON;
  const tempDir = process.env.TMP_DIR;
  if (![skillDir, pythonExecutable, tempDir].every((value) => value && path.isAbsolute(value))) {
    throw new Error("SKILL_DIR, RUNTIME_PYTHON and TMP_DIR must be absolute paths");
  }
  const finalPath = parseOutputArgument();
  try {
    await fs.access(finalPath);
    throw new Error(`Final output already exists: ${finalPath}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const presentation = buildNeutralEditorialPresentation();
  await fs.mkdir(tempDir, { recursive: true });
  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  const stagingDir = path.join(tempDir, ".codex-finalizer");
  await fs.mkdir(stagingDir, { recursive: true });
  const candidatePath = path.join(stagingDir, "candidate.pptx");
  await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

  const { finalizePresentation } = await import(pathToFileURL(
    path.join(skillDir, "container_tools", "artifact_tool_utils.mjs"),
  ).href);
  const result = await finalizePresentation({
    explicitTotalSlideCount: 6,
    requiredNativeTableOwnerSlides: [],
    requiredNativeChartOwnerSlides: [],
    workspaceDir: projectRoot,
    candidatePath,
    finalPath,
    pythonExecutable,
    integrityValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_package_integrity.py"),
    layoutValidatorPath: path.join(skillDir, "container_tools", "inspect_presentation_layout_geometry.py"),
    layoutArgs: [
      "--expected-slide-size-emu", "12192000,6858000",
      "--validate-heading-fit",
    ],
    fontPolicy: { basis: "design", families: [SERIF, SANS] },
    verifyArtifactToolImport: true,
    receiptPath: path.join(stagingDir, `${path.basename(finalPath)}.validation.json`),
  });
  console.log(JSON.stringify({ finalPath, result }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
