import {
  THEME,
  addBox,
  addCircle,
  addText,
  createPresentation,
  runGenerator,
  saveSingleExample,
} from "./component-builders.mjs";

export { createPresentation, runGenerator, saveSingleExample };

function prepareSlide(presentation, title, subtitle) {
  const slide = presentation.slides.add();
  slide.background.fill = THEME.background;
  addText(slide, title, { left: 72, top: 42, width: 880, height: 48 }, {
    fontSize: 36,
    bold: true,
    color: THEME.accent,
  });
  addText(slide, subtitle, { left: 74, top: 92, width: 620, height: 26 }, {
    fontSize: 16,
    color: THEME.muted,
  });
  return slide;
}

function bulletText(items) {
  return items.map((item) => `• ${item}`).join("\n");
}

export function buildFishboneAnalysis(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "鱼骨原因分析");
  const branches = params.branches.slice(0, 6);
  if (branches.length < 4) throw new Error("鱼骨原因分析至少需要 4 类原因");

  slide.shapes.add({
    geometry: "line",
    position: { left: 126, top: 365, width: 866, height: 0 },
    fill: "none",
    line: { style: "solid", fill: THEME.accent, width: 5 },
  });
  addCircle(slide, { left: 104, top: 348, width: 34, height: 34 }, {
    fill: THEME.accent,
    line: { style: "solid", fill: "#FFFFFF", width: 3 },
    shadow: "shadow-none",
  });
  addBox(slide, { left: 970, top: 309, width: 248, height: 112 }, {
    geometry: "rightArrow",
    fill: THEME.accent,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-md",
    text: params.effect,
    fontSize: 22,
    bold: true,
    color: "#FFFFFF",
  });

  const upper = branches.filter((_, index) => index % 2 === 0);
  const lower = branches.filter((_, index) => index % 2 === 1);
  const branchPositions = (count) => {
    if (count === 1) return [615];
    if (count === 2) return [410, 820];
    return [330, 615, 900];
  };
  const renderBranch = (branch, displayIndex, isUpper, count) => {
    const baseX = branchPositions(count)[displayIndex];
    slide.shapes.add({
      geometry: "line",
      position: {
        left: baseX - 92,
        top: isUpper ? 286 : 365,
        width: 92,
        height: 79,
        verticalFlip: !isUpper,
      },
      fill: "none",
      line: { style: "solid", fill: THEME.accentAlt, width: 3 },
    });
    const cardTop = isUpper ? 140 : 442;
    addBox(slide, { left: baseX - 190, top: cardTop, width: 246, height: 150 }, {
      fill: "#FFFFFF",
      line: { style: "solid", fill: THEME.accentAlt, width: 1.5 },
      shadow: "shadow-sm",
    });
    addBox(slide, { left: baseX - 190, top: cardTop, width: 246, height: 44 }, {
      fill: isUpper ? THEME.accent : THEME.accentAlt,
      line: { style: "solid", fill: "none", width: 0 },
      shadow: "shadow-none",
      text: branch.category,
      fontSize: 18,
      bold: true,
      color: "#FFFFFF",
      alignment: "left",
    });
    addText(slide, bulletText(branch.items.slice(0, 4)), {
      left: baseX - 172,
      top: cardTop + 56,
      width: 210,
      height: 78,
    }, {
      fontSize: 15,
      color: THEME.body,
      verticalAlignment: "top",
    });
  };
  upper.forEach((branch, index) => renderBranch(branch, index, true, upper.length));
  lower.forEach((branch, index) => renderBranch(branch, index, false, lower.length));
  return slide;
}

export function buildBusinessModelCanvas(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "商业模式画布");
  const sections = [
    { key: "partners", label: "重要伙伴", left: 40, top: 146, width: 220, height: 390 },
    { key: "activities", label: "关键业务", left: 272, top: 146, width: 220, height: 188 },
    { key: "resources", label: "核心资源", left: 272, top: 346, width: 220, height: 190 },
    { key: "valuePropositions", label: "价值主张", left: 504, top: 146, width: 270, height: 390 },
    { key: "relationships", label: "客户关系", left: 786, top: 146, width: 220, height: 188 },
    { key: "channels", label: "渠道通路", left: 786, top: 346, width: 220, height: 190 },
    { key: "segments", label: "客户细分", left: 1018, top: 146, width: 220, height: 390 },
    { key: "costs", label: "成本结构", left: 40, top: 548, width: 593, height: 124 },
    { key: "revenue", label: "收入来源", left: 645, top: 548, width: 593, height: 124 },
  ];
  sections.forEach((section, index) => {
    addBox(slide, {
      left: section.left,
      top: section.top,
      width: section.width,
      height: section.height,
    }, {
      fill: "#FFFFFF",
      line: { style: "solid", fill: index === 2 || index === 4 ? THEME.accentAlt : THEME.accent, width: 1.5 },
      shadow: "shadow-none",
    });
    addBox(slide, {
      left: section.left,
      top: section.top,
      width: section.width,
      height: 44,
    }, {
      fill: index === 2 || index === 4 ? THEME.accentAlt : THEME.accent,
      line: { style: "solid", fill: "none", width: 0 },
      shadow: "shadow-none",
      text: section.label,
      fontSize: 17,
      bold: true,
      color: "#FFFFFF",
      alignment: "left",
    });
    addText(slide, bulletText(params[section.key].slice(0, section.height < 150 ? 4 : 7)), {
      left: section.left + 16,
      top: section.top + 56,
      width: section.width - 32,
      height: section.height - 68,
    }, {
      fontSize: section.height < 150 ? 14 : 15,
      color: THEME.body,
      verticalAlignment: "top",
    });
  });
  return slide;
}

export function buildCustomerJourneyMap(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "用户体验地图");
  const stages = params.stages.slice(0, 6);
  if (stages.length < 3) throw new Error("用户体验地图至少需要 3 个阶段");
  const left = 184;
  const tableWidth = 1046;
  const columnWidth = tableWidth / stages.length;
  const headerTop = 138;
  const rowDefs = [
    { key: "behaviors", label: "用户行为", top: 198, height: 78 },
    { key: "touchpoints", label: "接触点", top: 276, height: 68 },
    { key: "emotion", label: "情绪曲线", top: 344, height: 112 },
    { key: "pains", label: "痛点", top: 456, height: 76 },
    { key: "opportunities", label: "机会点", top: 532, height: 92 },
  ];

  addBox(slide, { left: 40, top: headerTop, width: 144, height: 60 }, {
    fill: THEME.accent,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-none",
    text: "阶段",
    fontSize: 18,
    bold: true,
    color: "#FFFFFF",
  });
  stages.forEach((stage, index) => {
    addBox(slide, { left: left + index * columnWidth, top: headerTop, width: columnWidth, height: 60 }, {
      fill: index % 2 ? THEME.accentAlt : THEME.accent,
      line: { style: "solid", fill: "#FFFFFF", width: 1 },
      shadow: "shadow-none",
      text: stage,
      fontSize: 17,
      bold: true,
      color: "#FFFFFF",
    });
  });

  rowDefs.forEach((row, rowIndex) => {
    addBox(slide, { left: 40, top: row.top, width: 144, height: row.height }, {
      fill: rowIndex % 2 ? "#E7F5FC" : "#E8F0FA",
      line: { style: "solid", fill: "#FFFFFF", width: 1 },
      shadow: "shadow-none",
      text: row.label,
      fontSize: 17,
      bold: true,
      color: rowIndex % 2 ? THEME.accentAlt : THEME.accent,
    });
    stages.forEach((_, stageIndex) => {
      addBox(slide, { left: left + stageIndex * columnWidth, top: row.top, width: columnWidth, height: row.height }, {
        fill: rowIndex % 2 ? "#FFFFFF" : "#F7FAFC",
        line: { style: "solid", fill: "#D5E0EB", width: 1 },
        shadow: "shadow-none",
      });
      if (row.key !== "emotion") {
        addText(slide, params[row.key][stageIndex] ?? "", {
          left: left + stageIndex * columnWidth + 10,
          top: row.top + 9,
          width: columnWidth - 20,
          height: row.height - 18,
        }, {
          fontSize: 13,
          color: THEME.body,
          alignment: "center",
          verticalAlignment: "middle",
        });
      }
    });
  });

  const emotionTop = rowDefs[2].top;
  const emotionHeight = rowDefs[2].height;
  const points = stages.map((_, index) => ({
    x: left + columnWidth * (index + 0.5),
    y: emotionTop + emotionHeight / 2 - Math.max(-1, Math.min(1, params.emotion[index] ?? 0)) * 38,
  }));
  slide.shapes.add({
    geometry: "line",
    position: { left, top: emotionTop + emotionHeight / 2, width: tableWidth, height: 0 },
    fill: "none",
    line: { style: "dashed", fill: THEME.line, width: 1 },
  });
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
      fill: "none",
      line: { style: "solid", fill: THEME.accentAlt, width: 4 },
    });
  }
  points.forEach((point, index) => addCircle(slide, {
    left: point.x - 10,
    top: point.y - 10,
    width: 20,
    height: 20,
  }, {
    fill: index === 0 || index === points.length - 1 ? THEME.accent : THEME.accentAlt,
    line: { style: "solid", fill: "#FFFFFF", width: 2 },
    shadow: "shadow-none",
  }));
  return slide;
}
