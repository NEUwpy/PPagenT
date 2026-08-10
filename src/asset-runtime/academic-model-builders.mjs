import {
  THEME,
  addAnchoredLine,
  addBox,
  addCircle,
  addLine,
  addText,
  isEmbeddedSlide,
  qaElementName,
  runGenerator,
} from "./component-builders.mjs";

export { runGenerator };

function prepareSlide(presentation, title, subtitle) {
  const slide = presentation.slides.add();
  if (isEmbeddedSlide(slide)) return slide;
  slide.background.fill = THEME.background;
  addText(slide, title, { left: 72, top: 42, width: 1040, height: 48 }, {
    fontSize: 36, bold: true, color: THEME.accent,
  });
  addText(slide, subtitle, { left: 74, top: 92, width: 720, height: 26 }, {
    fontSize: 16, color: THEME.muted,
  });
  return slide;
}

export function buildResearchMethodSummary(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "研究方法摘要");
  const dimensions = params.dimensions;
  if (dimensions.length < 3 || dimensions.length > 5) throw new Error("研究方法摘要支持 3–5 个方法维度");
  addBox(slide, { left: 0, top: 128, width: 1280, height: 220 }, {
    geometry: "rect", fill: "#173F68", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
  });
  addText(slide, params.sectionTitle, { left: 70, top: 154, width: 520, height: 36 }, {
    fontSize: 24, bold: true, color: "#FFFFFF",
  });
  addText(slide, params.summary, { left: 70, top: 202, width: 600, height: 108 }, {
    fontSize: 17, color: "#E4EEF8", verticalAlignment: "top",
  });
  const sampleFrame = { left: 760, top: 168, width: 142, height: 142 };
  const responseFrame = { left: 992, top: 168, width: 142, height: 142 };
  addCircle(slide, sampleFrame, {
    name: qaElementName({ parent: "research-sample" }),
    fill: "#173F68", line: { style: "solid", fill: "#F0B78D", width: 7 }, shadow: "shadow-none",
    text: `${params.sample.value}\n${params.sample.label}`, fontSize: 21, bold: true, color: "#FFFFFF",
  });
  addAnchoredLine(slide,
    { frame: sampleFrame, side: "right", parent: "research-sample" },
    { frame: responseFrame, side: "left", parent: "research-response" },
    "#D7A57F", 16);
  addCircle(slide, responseFrame, {
    name: qaElementName({ parent: "research-response" }),
    fill: "#E0A379", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-md",
    text: `${params.response.value}\n${params.response.label}`, fontSize: 21, bold: true, color: "#5B3828",
  });

  const left = 68;
  const gap = 12;
  const width = (1144 - gap * (dimensions.length - 1)) / dimensions.length;
  dimensions.forEach((dimension, index) => {
    const x = left + index * (width + gap);
    addBox(slide, { left: x, top: 382, width, height: 266 }, {
      name: qaElementName({ parent: `research-dimension-${index}`, domains: ["research-dimension-cards"] }),
      fill: index % 2 ? "#E5B18C" : "#E9BE9E",
      line: { style: "solid", fill: "#FFFFFF", width: 1.5 }, shadow: "shadow-md",
    });
    addCircle(slide, { left: x + width / 2 - 30, top: 402, width: 60, height: 60 }, {
      fill: "#F6D8C0", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
      text: String(index + 1), fontSize: 20, bold: true, color: "#A5613B",
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    addText(slide, dimension.name, { left: x + 18, top: 476, width: width - 36, height: 42 }, {
      fontSize: 20, bold: true, color: "#6A3F2A", alignment: "center",
    });
    addText(slide, dimension.body, { left: x + 18, top: 530, width: width - 36, height: 94 }, {
      fontSize: 16, color: "#5B463A", verticalAlignment: "top",
    });
  });
  return slide;
}

export function buildTechnicalRouteFlow(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "技术路线流程");
  const branches = params.branches;
  const inputs = params.inputs;
  if (branches.length < 2 || branches.length > 4) throw new Error("技术路线流程支持 2–4 条研究分支");
  if (inputs.length < 1 || inputs.length > 3) throw new Error("技术路线流程支持 1–3 项输入条件");
  const centerX = 640;
  const branchXs = branches.map((_, index) => 330 + index * (620 / (branches.length - 1)));

  addBox(slide, { left: 190, top: 128, width: 900, height: 536 }, {
    fill: "#FFFFFF", line: { style: "solid", fill: "#D7E5F1", width: 1 }, shadow: "shadow-md",
  });
  addBox(slide, { left: 190, top: 128, width: 26, height: 536 }, {
    geometry: "parallelogram", fill: "#173F68", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
  });
  addLine(slide, { x: centerX, y: 180 }, { x: centerX, y: 602 }, "#77AEE3", 2.5);
  addLine(slide, { x: branchXs[0], y: 314 }, { x: branchXs.at(-1), y: 314 }, "#77AEE3", 2.5);
  branchXs.forEach((x) => addLine(slide, { x, y: 314 }, { x, y: 346 }, "#77AEE3", 2));
  const inputXs = inputs.map((_, index) => inputs.length === 1 ? centerX : 405 + index * (470 / (inputs.length - 1)));
  inputXs.forEach((x) => addLine(slide, { x, y: 500 }, { x: centerX, y: 544 }, "#77AEE3", 1.5));

  addBox(slide, { left: 565, top: 148, width: 150, height: 40 }, {
    geometry: "roundRect", fill: "#C9DFF3", line: { style: "solid", fill: "#6CA7DD", width: 1.5 }, shadow: "shadow-sm",
    text: params.startLabel, fontSize: 17, bold: true, color: "#205281",
  });
  addBox(slide, { left: 475, top: 206, width: 330, height: 44 }, {
    name: qaElementName({ parent: "technical-question", domains: ["technical-route-main"] }),
    fill: "#C9DFF3", line: { style: "solid", fill: "#6CA7DD", width: 1.5 }, shadow: "shadow-none",
    text: params.question, fontSize: 18, bold: true, color: "#205281",
  });
  addBox(slide, { left: 475, top: 268, width: 330, height: 44 }, {
    name: qaElementName({ parent: "technical-objective", domains: ["technical-route-main"] }),
    fill: "#C9DFF3", line: { style: "solid", fill: "#6CA7DD", width: 1.5 }, shadow: "shadow-none",
    text: params.objective, fontSize: 18, bold: true, color: "#205281",
  });
  branches.forEach((branch, index) => addBox(slide, { left: branchXs[index] - 92, top: 346, width: 184, height: 44 }, {
    name: qaElementName({ parent: `technical-branch-${index}`, domains: ["technical-route-branches"] }),
    fill: "#D6E7F6", line: { style: "solid", fill: "#6CA7DD", width: 1.5 }, shadow: "shadow-sm",
    text: branch, fontSize: 16, color: "#205281",
  }));
  addBox(slide, { left: 445, top: 416, width: 390, height: 48 }, {
    name: qaElementName({ parent: "technical-core", domains: ["technical-route-main"] }),
    fill: "#BFD9F1", line: { style: "solid", fill: "#6CA7DD", width: 1.5 }, shadow: "shadow-none",
    text: params.core, fontSize: 18, bold: true, color: "#205281",
  });
  inputs.forEach((input, index) => addBox(slide, { left: inputXs[index] - 88, top: 480, width: 176, height: 40 }, {
    name: qaElementName({ parent: `technical-input-${index}`, domains: ["technical-route-inputs"] }),
    geometry: "parallelogram", fill: "#E6F0F8", line: { style: "solid", fill: "#6CA7DD", width: 1.5 }, shadow: "shadow-none",
    text: input, fontSize: 16, color: "#205281",
  }));
  addBox(slide, { left: 430, top: 544, width: 420, height: 48 }, {
    name: qaElementName({ parent: "technical-analysis", domains: ["technical-route-main"] }),
    fill: "#BFD9F1", line: { style: "solid", fill: "#6CA7DD", width: 1.5 }, shadow: "shadow-none",
    text: params.analysis, fontSize: 18, bold: true, color: "#205281",
  });
  addBox(slide, { left: 545, top: 608, width: 190, height: 38 }, {
    geometry: "roundRect", fill: "#C9DFF3", line: { style: "solid", fill: "#6CA7DD", width: 1.5 }, shadow: "shadow-sm",
    text: params.result, fontSize: 17, bold: true, color: "#205281",
  });
  return slide;
}

export function buildConclusionBands(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "分层结论陈述");
  const sections = params.sections;
  if (sections.length < 2 || sections.length > 4) throw new Error("分层结论陈述支持 2–4 组结论");
  for (const section of sections) {
    if (section.points.length < 1 || section.points.length > 4) throw new Error("每组结论支持 1–4 个要点");
  }
  const gap = 16;
  const totalHeight = sections.length === 2 ? 360 : sections.length === 3 ? 430 : 500;
  const top = 142 + (500 - totalHeight) / 2;
  const height = (totalHeight - gap * (sections.length - 1)) / sections.length;
  sections.forEach((section, index) => {
    const y = top + index * (height + gap);
    const colors = ["#174A75", "#8A8078", "#D88952", "#4D7BA5"];
    const surfaces = ["#E5F0FA", "#EEEAE6", "#F7E8DD", "#E7EEF5"];
    addBox(slide, { left: 68, top: y, width: 1144, height }, {
      name: qaElementName({ parent: `conclusion-section-${index}`, domains: ["conclusion-sections"] }),
      geometry: "roundRect", fill: surfaces[index],
      line: { style: "solid", fill: "#FFFFFF", width: 1 }, shadow: "shadow-md",
    });
    addBox(slide, { left: 68, top: y, width: 210, height }, {
      geometry: "rightArrow",
      fill: colors[index], line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
      text: section.name, fontSize: 22, bold: true, color: "#FFFFFF",
      insets: { top: 4, right: 28, bottom: 4, left: 12 },
    });
    addText(slide, section.points.map((point) => `• ${point}`).join("\n"), {
      left: 304, top: y + 12, width: 862, height: height - 24,
    }, {
      fontSize: 16, color: THEME.body, verticalAlignment: "middle",
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });
  return slide;
}

export function buildConcentricCapabilitySystem(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "同心能力系统");
  const capabilities = params.capabilities;
  if (capabilities.length < 4 || capabilities.length > 8) throw new Error("同心能力系统支持 4–8 项外围能力");
  addBox(slide, { left: 100, top: 534, width: 1080, height: 92 }, {
    geometry: "ellipse", fill: "#123D63/18", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
  });
  addBox(slide, { left: 66, top: 186, width: 1148, height: 404 }, {
    geometry: "ellipse", fill: "linear(180deg, #1E5C92 0%, #397DB3 48%, #174A75 100%)",
    line: { style: "solid", fill: "#D8EAF7", width: 1.5 }, shadow: "shadow-lg",
  });
  addBox(slide, { left: 218, top: 248, width: 844, height: 282 }, {
    geometry: "ellipse", fill: "linear(180deg, #FFFFFF 0%, #F5EEE8 100%)",
    line: { style: "solid", fill: "#E0B18E", width: 1.5 }, shadow: "shadow-none",
  });
  addBox(slide, { left: 365, top: 286, width: 550, height: 222 }, {
    geometry: "ellipse", fill: "linear(180deg, #2E78B6 0%, #123F69 100%)",
    line: { style: "solid", fill: "#8CBCE4", width: 2 }, shadow: "shadow-lg",
  });
  addBox(slide, { left: 428, top: 324, width: 424, height: 154 }, {
    geometry: "ellipse", fill: "linear(180deg, #1A527E 0%, #0E3457 100%)",
    line: { style: "solid", fill: "#5B9FD2", width: 1 }, shadow: "shadow-md",
  });
  addText(slide, params.center, { left: 470, top: 346, width: 340, height: 100 }, {
    fontSize: 30, bold: true, color: "#FFFFFF", alignment: "center",
  });
  const cx = 640;
  const cy = 388;
  capabilities.forEach((capability, index) => {
    const angle = -Math.PI / 2 + index * (2 * Math.PI / capabilities.length);
    const x = cx + Math.cos(angle) * 505;
    const y = cy + Math.sin(angle) * 190;
    addCircle(slide, { left: x - 48, top: y - 42, width: 96, height: 84 }, {
      name: qaElementName({ parent: `capability-${index}`, domains: ["capability-nodes"] }),
      fill: "linear(135deg, #EAB58E 0%, #D88952 100%)", line: { style: "solid", fill: "#FFFFFF", width: 1.5 }, shadow: "shadow-md",
      text: capability, fontSize: 16, bold: true, color: "#FFFFFF",
      insets: { top: 4, right: 7, bottom: 4, left: 7 },
    });
  });
  return slide;
}

export function buildTheoryIntegrationFramework(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "文献与理论整合框架");
  const domains = params.domains;
  const criteria = params.criteria;
  if (domains.length < 3 || domains.length > 4) throw new Error("理论整合框架支持 3–4 个理论域");
  if (criteria.length < 3 || criteria.length > 5) throw new Error("理论整合框架支持 3–5 项整合准则");
  const positions = domains.length === 3
    ? [{ x: 245, y: 280 }, { x: 1035, y: 280 }, { x: 640, y: 592 }]
    : [{ x: 260, y: 250 }, { x: 1020, y: 250 }, { x: 1020, y: 574 }, { x: 260, y: 574 }];
  positions.forEach((position, index) => {
    addLine(slide, position, positions[(index + 1) % positions.length], index % 2 ? "#4D9BE0" : "#8FC2EF", 3);
  });
  addBox(slide, { left: 414, top: 300, width: 452, height: 184 }, {
    geometry: "ellipse", fill: "linear(180deg, #EFF6FC 0%, #D9E9F7 100%)",
    line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-md",
  });
  const chipWidth = criteria.length <= 3 ? 126 : 112;
  criteria.forEach((criterion, index) => {
    const row = index < 3 ? 0 : 1;
    const rowCount = row === 0 ? Math.min(3, criteria.length) : criteria.length - 3;
    const rowIndex = row === 0 ? index : index - 3;
    const startX = 640 - (rowCount * chipWidth + (rowCount - 1) * 12) / 2;
    addBox(slide, { left: startX + rowIndex * (chipWidth + 12), top: 330 + row * 64, width: chipWidth, height: 46 }, {
      name: qaElementName({ parent: `theory-criterion-${index}`, domains: ["theory-criteria"] }),
      geometry: "roundRect",
      fill: row ? "#174A75" : THEME.accent,
      line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-sm",
      text: criterion, fontSize: 16, bold: true, color: "#FFFFFF",
      insets: { top: 3, right: 5, bottom: 3, left: 5 },
    });
  });
  domains.forEach((domain, index) => {
    const position = positions[index];
    addBox(slide, { left: position.x - 136, top: position.y - 54, width: 272, height: 108 }, {
      name: qaElementName({ parent: `theory-domain-${index}`, domains: ["theory-domains"] }),
      geometry: "ellipse", fill: index % 2 ? "linear(180deg, #3C87C7 0%, #1D5D93 100%)" : "linear(180deg, #2F78B7 0%, #174A75 100%)",
      line: { style: "solid", fill: "#FFFFFF", width: 2 }, shadow: "shadow-lg",
    });
    addText(slide, domain.name, { left: position.x - 116, top: position.y - 38, width: 232, height: 32 }, {
      fontSize: 20, bold: true, color: "#FFFFFF", alignment: "center",
    });
    addText(slide, domain.body, { left: position.x - 112, top: position.y - 2, width: 224, height: 42 }, {
      fontSize: 16, color: "#E7F1FA", alignment: "center", verticalAlignment: "top",
    });
  });
  return slide;
}
