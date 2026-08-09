import {
  THEME,
  addBox,
  addCircle,
  addText,
  runGenerator,
} from "./component-builders.mjs";

export { runGenerator };

function prepareSlide(presentation, title, subtitle) {
  const slide = presentation.slides.add();
  slide.background.fill = THEME.background;
  addText(slide, title, { left: 72, top: 42, width: 1040, height: 48 }, {
    fontSize: 36, bold: true, color: THEME.accent,
  });
  addText(slide, subtitle, { left: 74, top: 92, width: 720, height: 26 }, {
    fontSize: 16, color: THEME.muted,
  });
  return slide;
}

function addLine(slide, from, to, color = THEME.line, width = 2) {
  slide.shapes.add({
    geometry: "line",
    position: {
      left: Math.min(from.x, to.x), top: Math.min(from.y, to.y), width: Math.abs(to.x - from.x),
      height: Math.abs(to.y - from.y), horizontalFlip: to.x < from.x, verticalFlip: to.y < from.y,
    },
    fill: "none", line: { style: "solid", fill: color, width },
  });
}

export function buildResearchMethodSummary(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "研究方法摘要");
  const dimensions = params.dimensions.slice(0, 5);
  if (dimensions.length < 3) throw new Error("研究方法摘要至少需要 3 个方法维度");
  addBox(slide, { left: 0, top: 128, width: 1280, height: 220 }, {
    geometry: "rect", fill: "#173F68", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
  });
  addText(slide, params.sectionTitle, { left: 70, top: 154, width: 520, height: 36 }, {
    fontSize: 24, bold: true, color: "#FFFFFF",
  });
  addText(slide, params.summary, { left: 70, top: 202, width: 600, height: 108 }, {
    fontSize: 17, color: "#E4EEF8", verticalAlignment: "top",
  });
  addCircle(slide, { left: 760, top: 168, width: 142, height: 142 }, {
    fill: "#173F68", line: { style: "solid", fill: "#F0B78D", width: 7 }, shadow: "shadow-none",
    text: `${params.sample.value}\n${params.sample.label}`, fontSize: 21, bold: true, color: "#FFFFFF",
  });
  addLine(slide, { x: 902, y: 239 }, { x: 992, y: 239 }, "#D7A57F", 16);
  addCircle(slide, { left: 992, top: 168, width: 142, height: 142 }, {
    fill: "#E0A379", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-md",
    text: `${params.response.value}\n${params.response.label}`, fontSize: 21, bold: true, color: "#5B3828",
  });

  const left = 68;
  const gap = 12;
  const width = (1144 - gap * (dimensions.length - 1)) / dimensions.length;
  dimensions.forEach((dimension, index) => {
    const x = left + index * (width + gap);
    addBox(slide, { left: x, top: 382, width, height: 266 }, {
      fill: index % 2 ? "#E5B18C" : "#E9BE9E",
      line: { style: "solid", fill: "#FFFFFF", width: 1.5 }, shadow: "shadow-md",
    });
    addCircle(slide, { left: x + width / 2 - 30, top: 402, width: 60, height: 60 }, {
      fill: "#F6D8C0", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
      text: String(index + 1), fontSize: 20, bold: true, color: "#A5613B",
    });
    addText(slide, dimension.name, { left: x + 18, top: 476, width: width - 36, height: 42 }, {
      fontSize: 20, bold: true, color: "#6A3F2A", alignment: "center",
    });
    addText(slide, dimension.body, { left: x + 18, top: 530, width: width - 36, height: 94 }, {
      fontSize: dimensions.length === 5 ? 13 : 15, color: "#5B463A", verticalAlignment: "top",
    });
  });
  return slide;
}

export function buildTechnicalRouteFlow(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "技术路线流程");
  const branches = params.branches.slice(0, 4);
  const inputs = params.inputs.slice(0, 3);
  if (branches.length < 2) throw new Error("技术路线流程至少需要 2 条分支");
  const centerX = 640;
  const branchXs = branches.map((_, index) => 300 + index * (680 / (branches.length - 1)));

  addLine(slide, { x: centerX, y: 174 }, { x: centerX, y: 500 }, "#77AEE3", 2);
  addLine(slide, { x: branchXs[0], y: 310 }, { x: branchXs.at(-1), y: 310 }, "#77AEE3", 2);
  branchXs.forEach((x) => addLine(slide, { x, y: 310 }, { x, y: 344 }, "#77AEE3", 2));
  const inputXs = inputs.map((_, index) => 370 + index * (540 / Math.max(1, inputs.length - 1)));
  inputXs.forEach((x) => addLine(slide, { x, y: 474 }, { x: centerX, y: 520 }, "#77AEE3", 1.5));

  addBox(slide, { left: 565, top: 132, width: 150, height: 42 }, {
    fill: "#BFD9F1", line: { style: "solid", fill: "#6CA7DD", width: 1.5 }, shadow: "shadow-none",
    text: params.startLabel, fontSize: 17, bold: true, color: "#205281",
  });
  addBox(slide, { left: 475, top: 194, width: 330, height: 46 }, {
    fill: "#C9DFF3", line: { style: "solid", fill: "#6CA7DD", width: 1.5 }, shadow: "shadow-none",
    text: params.question, fontSize: 18, bold: true, color: "#205281",
  });
  addBox(slide, { left: 475, top: 256, width: 330, height: 46 }, {
    fill: "#C9DFF3", line: { style: "solid", fill: "#6CA7DD", width: 1.5 }, shadow: "shadow-none",
    text: params.objective, fontSize: 18, bold: true, color: "#205281",
  });
  branches.forEach((branch, index) => addBox(slide, { left: branchXs[index] - 105, top: 344, width: 210, height: 46 }, {
    fill: "#D6E7F6", line: { style: "solid", fill: "#6CA7DD", width: 1.5 }, shadow: "shadow-none",
    text: branch, fontSize: 16, color: "#205281",
  }));
  addBox(slide, { left: 445, top: 414, width: 390, height: 50 }, {
    fill: "#BFD9F1", line: { style: "solid", fill: "#6CA7DD", width: 1.5 }, shadow: "shadow-none",
    text: params.core, fontSize: 18, bold: true, color: "#205281",
  });
  inputs.forEach((input, index) => addBox(slide, { left: inputXs[index] - 100, top: 486, width: 200, height: 42 }, {
    geometry: "parallelogram", fill: "#E6F0F8", line: { style: "solid", fill: "#6CA7DD", width: 1.5 }, shadow: "shadow-none",
    text: input, fontSize: 15, color: "#205281",
  }));
  addBox(slide, { left: 430, top: 554, width: 420, height: 50 }, {
    fill: "#BFD9F1", line: { style: "solid", fill: "#6CA7DD", width: 1.5 }, shadow: "shadow-none",
    text: params.analysis, fontSize: 18, bold: true, color: "#205281",
  });
  addBox(slide, { left: 545, top: 626, width: 190, height: 40 }, {
    fill: "#BFD9F1", line: { style: "solid", fill: "#6CA7DD", width: 1.5 }, shadow: "shadow-none",
    text: params.result, fontSize: 17, bold: true, color: "#205281",
  });
  return slide;
}

export function buildConclusionBands(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "分层结论陈述");
  const sections = params.sections.slice(0, 4);
  if (sections.length < 2) throw new Error("分层结论陈述至少需要 2 组结论");
  const top = 142;
  const gap = 18;
  const height = (500 - gap * (sections.length - 1)) / sections.length;
  sections.forEach((section, index) => {
    const y = top + index * (height + gap);
    const colors = ["#174A75", "#9A8B80", "#D88952", "#4D7BA5"];
    addBox(slide, { left: 68, top: y, width: 1144, height }, {
      fill: index % 2 ? "#F0ECE8" : "#E6F0F8",
      line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-sm",
    });
    addBox(slide, { left: 68, top: y, width: 190, height }, {
      fill: colors[index], line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
      text: section.name, fontSize: 22, bold: true, color: "#FFFFFF",
    });
    addText(slide, section.points.slice(0, 4).map((point) => `• ${point}`).join("\n"), {
      left: 286, top: y + 14, width: 886, height: height - 28,
    }, {
      fontSize: sections.length === 4 ? 14 : 16, color: THEME.body, verticalAlignment: "top",
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });
  return slide;
}

export function buildConcentricCapabilitySystem(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "同心能力系统");
  const capabilities = params.capabilities.slice(0, 8);
  if (capabilities.length < 4) throw new Error("同心能力系统至少需要 4 项能力");
  addBox(slide, { left: 84, top: 190, width: 1112, height: 410 }, {
    geometry: "ellipse", fill: "#2B689D", line: { style: "solid", fill: "#D8EAF7", width: 2 }, shadow: "shadow-md",
  });
  addBox(slide, { left: 220, top: 250, width: 840, height: 290 }, {
    geometry: "ellipse", fill: "#F7FAFC", line: { style: "solid", fill: "#E0B18E", width: 2 }, shadow: "shadow-none",
  });
  addBox(slide, { left: 382, top: 292, width: 516, height: 206 }, {
    geometry: "ellipse", fill: "#174A75", line: { style: "solid", fill: "#8CBCE4", width: 2 }, shadow: "shadow-md",
  });
  addText(slide, params.center, { left: 470, top: 342, width: 340, height: 100 }, {
    fontSize: 30, bold: true, color: "#FFFFFF", alignment: "center",
  });
  const cx = 640;
  const cy = 395;
  capabilities.forEach((capability, index) => {
    const angle = -Math.PI / 2 + index * (2 * Math.PI / capabilities.length);
    const x = cx + Math.cos(angle) * 470;
    const y = cy + Math.sin(angle) * 185;
    addCircle(slide, { left: x - 52, top: y - 42, width: 104, height: 84 }, {
      fill: "#E1AA80", line: { style: "solid", fill: "#FFFFFF", width: 1.5 }, shadow: "shadow-md",
      text: capability, fontSize: 16, bold: true, color: "#FFFFFF",
    });
  });
  return slide;
}

export function buildTheoryIntegrationFramework(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "文献与理论整合框架");
  const domains = params.domains.slice(0, 4);
  const criteria = params.criteria.slice(0, 5);
  if (domains.length < 3 || criteria.length < 3) throw new Error("理论整合框架至少需要 3 个理论域和 3 项整合准则");
  const positions = domains.length === 3
    ? [{ x: 250, y: 300 }, { x: 1030, y: 300 }, { x: 640, y: 580 }]
    : [{ x: 250, y: 260 }, { x: 1030, y: 260 }, { x: 1030, y: 560 }, { x: 250, y: 560 }];
  positions.forEach((position, index) => {
    addLine(slide, position, positions[(index + 1) % positions.length], index % 2 ? THEME.accentAlt : THEME.accent, 3);
    addLine(slide, position, { x: 640, y: 385 }, "#C6D6E5", 1.5);
  });
  addBox(slide, { left: 430, top: 300, width: 420, height: 170 }, {
    geometry: "ellipse", fill: "#E8F1F9", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-sm",
  });
  const chipWidth = criteria.length <= 3 ? 116 : 104;
  criteria.forEach((criterion, index) => {
    const row = index < 3 ? 0 : 1;
    const rowCount = row === 0 ? Math.min(3, criteria.length) : criteria.length - 3;
    const rowIndex = row === 0 ? index : index - 3;
    const startX = 640 - (rowCount * chipWidth + (rowCount - 1) * 12) / 2;
    addBox(slide, { left: startX + rowIndex * (chipWidth + 12), top: 328 + row * 64, width: chipWidth, height: 46 }, {
      fill: row ? "#174A75" : THEME.accent,
      line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-sm",
      text: criterion, fontSize: 14, bold: true, color: "#FFFFFF",
      insets: { top: 3, right: 5, bottom: 3, left: 5 },
    });
  });
  domains.forEach((domain, index) => {
    const position = positions[index];
    addBox(slide, { left: position.x - 145, top: position.y - 64, width: 290, height: 128 }, {
      geometry: "ellipse", fill: index % 2 ? "#2F73B5" : "#1F5C91",
      line: { style: "solid", fill: "#FFFFFF", width: 2 }, shadow: "shadow-md",
    });
    addText(slide, domain.name, { left: position.x - 120, top: position.y - 42, width: 240, height: 34 }, {
      fontSize: 22, bold: true, color: "#FFFFFF", alignment: "center",
    });
    addText(slide, domain.body, { left: position.x - 116, top: position.y, width: 232, height: 48 }, {
      fontSize: 13, color: "#E7F1FA", alignment: "center", verticalAlignment: "top",
    });
  });
  return slide;
}
