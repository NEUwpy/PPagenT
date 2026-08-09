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
  addText(slide, title, { left: 72, top: 42, width: 1030, height: 48 }, {
    fontSize: 36,
    bold: true,
    color: THEME.accent,
  });
  addText(slide, subtitle, { left: 74, top: 92, width: 680, height: 26 }, {
    fontSize: 16,
    color: THEME.muted,
  });
  return slide;
}

function bulletText(items) {
  return items.map((item) => `• ${item}`).join("\n");
}

function ring(slide, position, color, width = 22) {
  return addCircle(slide, position, {
    fill: "none",
    line: { style: "solid", fill: color, width },
    shadow: "shadow-none",
  });
}

export function buildEndToEndOperations(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "全链路运营框架");
  const stages = params.stages.slice(0, 4);
  const nodes = params.nodes.slice(0, 7);
  const pillars = params.pillars.slice(0, 5);
  if (stages.length < 3 || pillars.length < 3) throw new Error("全链路运营框架至少需要 3 个阶段和 3 个支柱");

  addBox(slide, { left: 60, top: 142, width: 1160, height: 286 }, {
    fill: "#FFFFFF",
    line: { style: "solid", fill: THEME.line, width: 1.5 },
    shadow: "shadow-sm",
  });
  slide.shapes.add({
    geometry: "line",
    position: { left: 145, top: 318, width: 990, height: 0 },
    fill: "none",
    line: { style: "solid", fill: THEME.accentSoft, width: 8 },
  });
  const stageWidth = 1030 / stages.length;
  stages.forEach((stage, index) => {
    addBox(slide, { left: 125 + index * stageWidth, top: 156, width: stageWidth - 8, height: 52 }, {
      geometry: index < stages.length - 1 ? "chevron" : "rect",
      fill: index % 2 ? "#315172" : THEME.accent,
      line: { style: "solid", fill: "#FFFFFF", width: 1 },
      shadow: "shadow-none",
      text: stage,
      fontSize: 18,
      bold: true,
      color: "#FFFFFF",
    });
  });
  addText(slide, params.centerLabel, { left: 340, top: 224, width: 600, height: 48 }, {
    fontSize: 28,
    bold: true,
    color: THEME.accent,
    alignment: "center",
  });
  const nodeWidth = 850 / nodes.length;
  nodes.forEach((node, index) => addCircle(slide, {
    left: 205 + index * nodeWidth,
    top: 286,
    width: 76,
    height: 76,
  }, {
    fill: index % 2 ? THEME.accentAlt : THEME.accent,
    line: { style: "solid", fill: "#FFFFFF", width: 2 },
    shadow: "shadow-sm",
    text: node,
    fontSize: 16,
    bold: true,
    color: "#FFFFFF",
  }));
  addBox(slide, { left: 76, top: 226, width: 80, height: 148 }, {
    fill: THEME.accent,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-none",
    text: params.leftFlow,
    fontSize: 18,
    bold: true,
    color: "#FFFFFF",
  });
  addBox(slide, { left: 1124, top: 226, width: 80, height: 148 }, {
    fill: THEME.accentAlt,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-none",
    text: params.rightFlow,
    fontSize: 18,
    bold: true,
    color: "#FFFFFF",
  });

  const gap = 14;
  const pillarWidth = (1160 - gap * (pillars.length - 1)) / pillars.length;
  pillars.forEach((pillar, index) => {
    const left = 60 + index * (pillarWidth + gap);
    addBox(slide, { left, top: 452, width: pillarWidth, height: 210 }, {
      fill: "#FFFFFF",
      line: { style: "solid", fill: index % 2 ? THEME.accentAlt : THEME.accent, width: 1.5 },
      shadow: "shadow-sm",
    });
    addBox(slide, { left, top: 452, width: pillarWidth, height: 48 }, {
      fill: index % 2 ? THEME.accentAlt : THEME.accent,
      line: { style: "solid", fill: "none", width: 0 },
      shadow: "shadow-none",
      text: pillar.title,
      fontSize: 18,
      bold: true,
      color: "#FFFFFF",
    });
    addText(slide, bulletText(pillar.items.slice(0, 4)), { left: left + 18, top: 516, width: pillarWidth - 36, height: 124 }, {
      fontSize: 16,
      color: THEME.body,
      verticalAlignment: "top",
    });
  });
  return slide;
}

export function buildInternalExternalEcosystem(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "内外部决策生态");
  const systems = [params.internal, params.external];
  const centers = [{ x: 360, y: 350 }, { x: 920, y: 350 }];

  centers.forEach((center, index) => {
    ring(slide, { left: center.x - 190, top: center.y - 190, width: 380, height: 380 }, index ? THEME.accentAlt : THEME.accent, 30);
  });
  slide.shapes.add({
    geometry: "line",
    position: { left: 550, top: 350, width: 180, height: 0 },
    fill: "none",
    line: { style: "dashed", fill: THEME.muted, width: 2 },
  });
  addText(slide, params.bridge, { left: 548, top: 316, width: 184, height: 32 }, {
    fontSize: 16,
    bold: true,
    color: THEME.muted,
    alignment: "center",
  });

  systems.forEach((system, systemIndex) => {
    const center = centers[systemIndex];
    const items = system.items.slice(0, 6);
    items.forEach((_, itemIndex) => {
      const angle = -Math.PI / 2 + itemIndex * (2 * Math.PI / items.length);
      slide.shapes.add({
        geometry: "line",
        position: {
          left: Math.min(center.x, center.x + Math.cos(angle) * 122),
          top: Math.min(center.y, center.y + Math.sin(angle) * 122),
          width: Math.abs(Math.cos(angle) * 122),
          height: Math.abs(Math.sin(angle) * 122),
          verticalFlip: Math.sin(angle) < 0 !== Math.cos(angle) < 0,
        },
        fill: "none",
        line: { style: "solid", fill: THEME.line, width: 1.5 },
      });
    });
    addCircle(slide, { left: center.x - 82, top: center.y - 82, width: 164, height: 164 }, {
      fill: "#315172",
      line: { style: "solid", fill: "#FFFFFF", width: 3 },
      shadow: "shadow-md",
      text: system.center,
      fontSize: 23,
      bold: true,
      color: "#FFFFFF",
    });
    items.forEach((item, itemIndex) => {
      const angle = -Math.PI / 2 + itemIndex * (2 * Math.PI / items.length);
      addCircle(slide, {
        left: center.x + Math.cos(angle) * 122 - 34,
        top: center.y + Math.sin(angle) * 122 - 34,
        width: 68,
        height: 68,
      }, {
        fill: "#FFFFFF",
        line: { style: "solid", fill: systemIndex ? THEME.accentAlt : THEME.accent, width: 2 },
        shadow: "shadow-sm",
        text: item,
        fontSize: 16,
        bold: true,
        color: systemIndex ? THEME.accentAlt : THEME.accent,
      });
    });
    addText(slide, system.ringLabel, { left: center.x - 150, top: 548, width: 300, height: 28 }, {
      fontSize: 17,
      bold: true,
      color: systemIndex ? THEME.accentAlt : THEME.accent,
      alignment: "center",
    });
  });
  params.insights.slice(0, 3).forEach((insight, index) => addBox(slide, {
    left: 70 + index * 390,
    top: 594,
    width: 360,
    height: 66,
  }, {
    fill: [THEME.accent, "#4B7FC0", THEME.accentAlt][index],
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-sm",
    text: insight,
    fontSize: 16,
    bold: true,
    color: "#FFFFFF",
  }));
  return slide;
}

export function buildOmnichannelDomainModel(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "全域运营双域模型");
  const leftNodes = params.publicChannels.slice(0, 4);
  const rightNodes = params.privateChannels.slice(0, 4);

  slide.shapes.add({
    geometry: "line",
    position: { left: 290, top: 350, width: 700, height: 0 },
    fill: "none",
    line: { style: "dashed", fill: THEME.line, width: 3 },
  });
  ring(slide, { left: 455, top: 170, width: 370, height: 370 }, THEME.accentSoft, 16);
  addBox(slide, { left: 270, top: 168, width: 116, height: 374 }, {
    fill: THEME.accent,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-md",
    text: params.publicGate,
    fontSize: 21,
    bold: true,
    color: "#FFFFFF",
  });
  addBox(slide, { left: 894, top: 168, width: 116, height: 374 }, {
    fill: THEME.accentAlt,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-md",
    text: params.privateGate,
    fontSize: 21,
    bold: true,
    color: "#FFFFFF",
  });
  addCircle(slide, { left: 520, top: 235, width: 240, height: 240 }, {
    fill: THEME.accent,
    line: { style: "solid", fill: "#FFFFFF", width: 4 },
    shadow: "shadow-lg",
    text: params.center,
    fontSize: 27,
    bold: true,
    color: "#FFFFFF",
  });
  addCircle(slide, { left: 420, top: 310, width: 104, height: 80 }, {
    fill: "#315172",
    line: { style: "solid", fill: "#FFFFFF", width: 2 },
    shadow: "shadow-sm",
    text: params.publicDomain,
    fontSize: 17,
    bold: true,
    color: "#FFFFFF",
  });
  addCircle(slide, { left: 756, top: 310, width: 104, height: 80 }, {
    fill: "#315172",
    line: { style: "solid", fill: "#FFFFFF", width: 2 },
    shadow: "shadow-sm",
    text: params.privateDomain,
    fontSize: 17,
    bold: true,
    color: "#FFFFFF",
  });
  leftNodes.forEach((item, index) => addCircle(slide, { left: 54, top: 160 + index * 106, width: 118, height: 78 }, {
    fill: THEME.accent,
    line: { style: "solid", fill: "#FFFFFF", width: 2 },
    shadow: "shadow-sm",
    text: item,
    fontSize: 16,
    bold: true,
    color: "#FFFFFF",
  }));
  rightNodes.forEach((item, index) => addCircle(slide, { left: 1108, top: 160 + index * 106, width: 118, height: 78 }, {
    fill: THEME.accentAlt,
    line: { style: "solid", fill: "#FFFFFF", width: 2 },
    shadow: "shadow-sm",
    text: item,
    fontSize: 16,
    bold: true,
    color: "#FFFFFF",
  }));
  params.metrics.slice(0, 3).forEach((metric, index) => addBox(slide, { left: 74 + index * 404, top: 584, width: 372, height: 72 }, {
    fill: "#FFFFFF",
    line: { style: "solid", fill: index % 2 ? THEME.accentAlt : THEME.accent, width: 1.5 },
    shadow: "shadow-sm",
    text: `${metric.label}  ${metric.value}`,
    fontSize: 18,
    bold: true,
    color: index % 2 ? THEME.accentAlt : THEME.accent,
  }));
  return slide;
}

export function buildExperienceLayerModel(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "体验三层模型");
  const domains = params.domains.slice(0, 3);
  if (domains.length !== 3) throw new Error("体验三层模型需要 3 个体验域");
  const positions = [
    { x: 332, y: 222 },
    { x: 212, y: 432 },
    { x: 452, y: 432 },
  ];
  positions.forEach((position) => {
    slide.shapes.add({
      geometry: "line",
      position: {
        left: Math.min(332, position.x),
        top: Math.min(355, position.y),
        width: Math.abs(332 - position.x),
        height: Math.abs(355 - position.y),
        verticalFlip: position.y < 355 !== position.x < 332,
      },
      fill: "none",
      line: { style: "solid", fill: THEME.line, width: 2 },
    });
  });
  ring(slide, { left: 110, top: 138, width: 444, height: 444 }, THEME.accentSoft, 18);
  addCircle(slide, { left: 258, top: 281, width: 148, height: 148 }, {
    fill: "#315172",
    line: { style: "solid", fill: "#FFFFFF", width: 3 },
    shadow: "shadow-lg",
    text: params.center,
    fontSize: 24,
    bold: true,
    color: "#FFFFFF",
  });
  domains.forEach((domain, index) => {
    const position = positions[index];
    addCircle(slide, { left: position.x - 74, top: position.y - 60, width: 148, height: 120 }, {
      fill: [THEME.accent, THEME.accentAlt, "#4B7FC0"][index],
      line: { style: "solid", fill: "#FFFFFF", width: 3 },
      shadow: "shadow-md",
      text: domain.name,
      fontSize: 21,
      bold: true,
      color: "#FFFFFF",
    });
  });
  domains.forEach((domain, index) => {
    const top = 154 + index * 164;
    addBox(slide, { left: 640, top, width: 570, height: 144 }, {
      fill: "#FFFFFF",
      line: { style: "solid", fill: [THEME.accent, THEME.accentAlt, "#4B7FC0"][index], width: 1.5 },
      shadow: "shadow-sm",
    });
    addBox(slide, { left: 640, top, width: 150, height: 144 }, {
      fill: [THEME.accent, THEME.accentAlt, "#4B7FC0"][index],
      line: { style: "solid", fill: "none", width: 0 },
      shadow: "shadow-none",
      text: domain.name,
      fontSize: 22,
      bold: true,
      color: "#FFFFFF",
    });
    addText(slide, domain.description, { left: 814, top: top + 14, width: 370, height: 50 }, {
      fontSize: 16,
      color: THEME.body,
      verticalAlignment: "top",
    });
    addText(slide, domain.items.slice(0, 4).join(" · "), { left: 814, top: top + 66, width: 370, height: 24 }, {
      fontSize: 16,
      color: THEME.muted,
    });
    addText(slide, domain.metric, { left: 814, top: top + 98, width: 370, height: 30 }, {
      fontSize: 20,
      bold: true,
      color: [THEME.accent, THEME.accentAlt, "#4B7FC0"][index],
    });
  });
  return slide;
}
