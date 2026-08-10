import {
  THEME,
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
  const stages = params.stages;
  const nodes = params.nodes;
  const pillars = params.pillars;
  if (stages.length < 3 || stages.length > 4) throw new Error("全链路运营框架支持 3–4 个链路阶段");
  if (nodes.length < 4 || nodes.length > 7) throw new Error("全链路运营框架支持 4–7 个平台节点");
  if (pillars.length < 3 || pillars.length > 5) throw new Error("全链路运营框架支持 3–5 个能力支柱");
  for (const pillar of pillars) {
    if (pillar.items.length < 2 || pillar.items.length > 4) throw new Error("每个能力支柱支持 2–4 个标签");
  }

  addBox(slide, { left: 70, top: 140, width: 1140, height: 286 }, {
    name: qaElementName({ parent: "operations-platform", domains: ["operations-platform"] }),
    geometry: "roundRect",
    fill: "#FFFFFF",
    line: { style: "solid", fill: "#C9D8E6", width: 1.5 },
    shadow: "shadow-md",
  });
  const stageWidth = 1040 / stages.length;
  stages.forEach((stage, index) => {
    addBox(slide, { left: 120 + index * stageWidth, top: 154, width: stageWidth + (index < stages.length - 1 ? 6 : 0), height: 50 }, {
      geometry: index < stages.length - 1 ? "chevron" : "roundRect",
      fill: ["#33488C", "#3E3E3E", "#5D9BD3", "#10A8CE"][index],
      line: { style: "solid", fill: "#FFFFFF", width: 1 },
      shadow: "shadow-none",
      text: stage,
      fontSize: 18,
      bold: true,
      color: "#FFFFFF",
    });
  });
  addText(slide, params.centerLabel, { left: 300, top: 220, width: 680, height: 48 }, {
    fontSize: 26,
    bold: true,
    color: THEME.accent,
    alignment: "center",
  });
  const nodeStart = 220;
  const nodeEnd = 1060;
  const nodeXs = nodes.map((_, index) => nodes.length === 1 ? 640 : nodeStart + index * ((nodeEnd - nodeStart) / (nodes.length - 1)));
  addLine(slide, { x: nodeStart, y: 330 }, { x: nodeEnd, y: 330 }, "#C8D7E5", 3);
  nodes.forEach((node, index) => addCircle(slide, {
    left: nodeXs[index] - 40,
    top: 290,
    width: 80,
    height: 80,
  }, {
    name: qaElementName({ parent: `operations-node-${index}`, domains: ["operations-nodes"] }),
    fill: "linear(180deg, #FFFFFF 0%, #EEF2F6 100%)",
    line: { style: "solid", fill: "#D1DBE5", width: 1.5 },
    shadow: "shadow-sm",
    text: node,
    fontSize: 16,
    bold: true,
    color: index % 2 ? THEME.accentAlt : THEME.accent,
    insets: { top: 4, right: 5, bottom: 4, left: 5 },
  }));
  addBox(slide, { left: 72, top: 218, width: 78, height: 172 }, {
    geometry: "downArrow", fill: THEME.accent,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-none",
    text: params.leftFlow,
    fontSize: 18,
    bold: true,
    color: "#FFFFFF",
  });
  addBox(slide, { left: 1130, top: 218, width: 78, height: 172 }, {
    geometry: "upArrow", fill: THEME.accentAlt,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-none",
    text: params.rightFlow,
    fontSize: 18,
    bold: true,
    color: "#FFFFFF",
  });

  const gap = 12;
  const pillarWidth = (1140 - gap * (pillars.length - 1)) / pillars.length;
  pillars.forEach((pillar, index) => {
    const left = 70 + index * (pillarWidth + gap);
    const color = ["#315AA7", "#4C79B7", "#2F73B5", "#5D91CD", "#10A8CE"][index];
    addBox(slide, { left, top: 448, width: pillarWidth, height: 214 }, {
      name: qaElementName({ parent: `operations-pillar-${index}`, domains: ["operations-pillars"] }),
      fill: index % 2 ? "#F3F6F9" : "#F7F9FB",
      line: { style: "solid", fill: "#D6E0E8", width: 1 },
      shadow: "shadow-md",
    });
    addBox(slide, { left, top: 452, width: pillarWidth, height: 48 }, {
      fill: color,
      line: { style: "solid", fill: "none", width: 0 },
      shadow: "shadow-none",
      text: pillar.title,
      fontSize: 18,
      bold: true,
      color: "#FFFFFF",
    });
    if (pillar.body) addText(slide, pillar.body, { left: left + 14, top: 510, width: pillarWidth - 28, height: 50 }, {
      fontSize: 16, color: THEME.body, alignment: "center", verticalAlignment: "top",
    });
    const tagTop = pillar.body ? 570 : 520;
    const tagGap = 6;
    const tagHeight = 30;
    const tagColumns = pillar.items.length > 2 ? 2 : 1;
    const tagWidth = (pillarWidth - 28 - tagGap * (tagColumns - 1)) / tagColumns;
    pillar.items.forEach((item, itemIndex) => addBox(slide, {
      left: left + 14 + (itemIndex % tagColumns) * (tagWidth + tagGap),
      top: tagTop + Math.floor(itemIndex / tagColumns) * (tagHeight + tagGap),
      width: tagWidth,
      height: tagHeight,
    }, {
      geometry: "roundRect", fill: "#FFFFFF", line: { style: "solid", fill: color, width: 1 }, shadow: "shadow-none",
      text: item, fontSize: 16, color, insets: { top: 1, right: 5, bottom: 1, left: 5 },
    }));
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
  addLine(slide, { x: 550, y: 350 }, { x: 730, y: 350 }, THEME.muted, 2, undefined, "dashed");
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
      addLine(slide, center, {
        x: center.x + Math.cos(angle) * 122,
        y: center.y + Math.sin(angle) * 122,
      }, THEME.line, 1.5);
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

  addLine(slide, { x: 290, y: 350 }, { x: 990, y: 350 }, THEME.line, 3, undefined, "dashed");
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
  positions.forEach((position) => addLine(slide, { x: 332, y: 355 }, position, THEME.line, 2));
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
