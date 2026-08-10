import {
  THEME,
  addBox,
  addCircle,
  addLine,
  addText,
  isEmbeddedSlide,
  runGenerator,
} from "./component-builders.mjs";

export { runGenerator };

function prepareSlide(presentation, title, subtitle) {
  const slide = presentation.slides.add();
  if (isEmbeddedSlide(slide)) return slide;
  slide.background.fill = THEME.background;
  addText(slide, title, { left: 72, top: 42, width: 1040, height: 48 }, {
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

export function buildPhaseStrategyTimeline(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "阶段策略时间表");
  const periods = params.periods.slice(0, 12);
  const phases = params.phases.slice(0, 4);
  const lanes = params.actionLanes.slice(0, 3);
  if (periods.length < 6 || phases.length < 2) throw new Error("阶段策略时间表至少需要 6 个时间点和 2 个阶段");
  const left = 150;
  const width = 1070;
  const periodWidth = width / periods.length;

  periods.forEach((period, index) => addBox(slide, { left: left + index * periodWidth, top: 138, width: periodWidth, height: 36 }, {
    fill: index % 2 ? "#EEF4FA" : "#FFFFFF",
    line: { style: "solid", fill: THEME.line, width: 1 },
    shadow: "shadow-none",
    text: period,
    fontSize: 16,
    color: THEME.body,
  }));
  addBox(slide, { left: 40, top: 138, width: 110, height: 36 }, {
    fill: "#315172", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
    text: "时间", fontSize: 17, bold: true, color: "#FFFFFF",
  });

  phases.forEach((phase, index) => {
    const start = Math.max(0, Math.min(periods.length - 1, phase.start));
    const end = Math.max(start + 1, Math.min(periods.length, phase.end));
    const phaseLeft = left + start * periodWidth;
    const phaseWidth = (end - start) * periodWidth;
    addBox(slide, { left: phaseLeft, top: 182, width: phaseWidth, height: 46 }, {
      fill: index % 2 ? THEME.accentAlt : THEME.accent,
      line: { style: "solid", fill: "#FFFFFF", width: 1 },
      shadow: "shadow-none", text: phase.name, fontSize: 18, bold: true, color: "#FFFFFF",
    });
    addText(slide, phase.objective, { left: phaseLeft + 10, top: 240, width: phaseWidth - 20, height: 44 }, {
      fontSize: 16, bold: true, color: THEME.accent, alignment: "center",
    });
    addText(slide, bulletText(phase.tasks.slice(0, 3)), { left: phaseLeft + 12, top: 288, width: phaseWidth - 24, height: 86 }, {
      fontSize: 16, color: THEME.body, verticalAlignment: "top",
    });
  });
  addBox(slide, { left: 40, top: 182, width: 110, height: 192 }, {
    fill: "#315172", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
    text: "阶段策略", fontSize: 18, bold: true, color: "#FFFFFF",
  });

  lanes.forEach((lane, laneIndex) => {
    const laneTop = 402 + laneIndex * 84;
    addBox(slide, { left: 40, top: laneTop, width: 110, height: 70 }, {
      fill: laneIndex % 2 ? THEME.accentAlt : THEME.accent,
      line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
      text: lane.name, fontSize: 17, bold: true, color: "#FFFFFF",
    });
    addBox(slide, { left, top: laneTop, width, height: 70 }, {
      fill: laneIndex % 2 ? "#F4FAFC" : "#F7FAFC",
      line: { style: "solid", fill: THEME.line, width: 1 }, shadow: "shadow-none",
    });
    lane.actions.slice(0, 5).forEach((action, actionIndex) => {
      const start = Math.max(0, Math.min(periods.length - 1, action.start));
      const end = Math.max(start + 1, Math.min(periods.length, action.end));
      addBox(slide, {
        left: left + start * periodWidth + 5,
        top: laneTop + 6 + (actionIndex % 2) * 31,
        width: (end - start) * periodWidth - 10,
        height: 28,
      }, {
        fill: laneIndex % 2 ? THEME.accentAlt : THEME.accent,
        line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
        text: action.label, fontSize: 14, bold: true, color: "#FFFFFF",
        insets: { top: 1, right: 4, bottom: 1, left: 4 },
      });
    });
  });
  return slide;
}

export function buildAudienceSegmentationFunnel(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "人群分层漏斗");
  const upper = params.upper.slice(0, 3);
  const lower = params.lower.slice(0, 3);
  if (upper.length < 2 || lower.length < 2) throw new Error("人群分层漏斗上下两侧各至少需要 2 层");
  const centerX = 320;
  const upperWidths = upper.length === 2 ? [430, 220] : [470, 330, 190];
  const lowerWidths = lower.length === 2 ? [220, 430] : [190, 330, 470];

  upper.forEach((segment, index) => {
    const width = upperWidths[index];
    addBox(slide, { left: centerX - width / 2, top: 150 + index * 82, width, height: 76 }, {
      geometry: "trapezoid", fill: ["#244A92", "#3566B6", "#5B8DD1"][index],
      line: { style: "solid", fill: "#FFFFFF", width: 2 }, shadow: "shadow-sm",
      text: `${segment.name}\n${segment.value}`, fontSize: 17, bold: true, color: "#FFFFFF",
    });
  });
  lower.forEach((segment, index) => {
    const width = lowerWidths[index];
    addBox(slide, { left: centerX - width / 2, top: 406 + index * 82, width, height: 76 }, {
      geometry: "trapezoid", fill: ["#5B8DD1", "#3566B6", "#244A92"][index],
      line: { style: "solid", fill: "#FFFFFF", width: 2 }, shadow: "shadow-sm",
      text: `${segment.name}\n${segment.value}`, fontSize: 17, bold: true, color: "#FFFFFF",
    });
  });
  addBox(slide, { left: 270, top: 354, width: 100, height: 52 }, {
    fill: "#315172", line: { style: "solid", fill: "#FFFFFF", width: 2 }, shadow: "shadow-md",
    text: params.pivot, fontSize: 18, bold: true, color: "#FFFFFF",
  });

  const renderStrategy = (top, title, items, accent) => {
    addBox(slide, { left: 610, top, width: 600, height: 220 }, {
      fill: "#FFFFFF", line: { style: "solid", fill: accent, width: 1.5 }, shadow: "shadow-sm",
    });
    addBox(slide, { left: 610, top, width: 600, height: 48 }, {
      fill: accent, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
      text: title, fontSize: 20, bold: true, color: "#FFFFFF", alignment: "left",
    });
    items.slice(0, 3).forEach((item, index) => {
      addCircle(slide, { left: 636, top: top + 70 + index * 45, width: 30, height: 30 }, {
        fill: accent, line: { style: "solid", fill: "#FFFFFF", width: 1 }, shadow: "shadow-none",
        text: String(index + 1), fontSize: 15, bold: true, color: "#FFFFFF",
      });
      addText(slide, item, { left: 680, top: top + 66 + index * 45, width: 500, height: 38 }, {
        fontSize: 16, color: THEME.body,
      });
    });
  };
  renderStrategy(150, params.upperStrategy.title, params.upperStrategy.items, THEME.accent);
  renderStrategy(406, params.lowerStrategy.title, params.lowerStrategy.items, THEME.accentAlt);
  return slide;
}

export function buildLifecycleCurve(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "用户生命周期曲线");
  const phases = params.phases.slice(0, 6);
  if (phases.length < 4) throw new Error("用户生命周期曲线至少需要 4 个阶段");
  const left = 54;
  const width = 1172;
  const phaseWidth = width / phases.length;
  const chartTop = 306;
  const chartHeight = 280;

  phases.forEach((phase, index) => {
    addBox(slide, { left: left + index * phaseWidth, top: 142, width: phaseWidth, height: 154 }, {
      fill: index % 2 ? "#4F7EC1" : "#3659A1",
      line: { style: "solid", fill: "#FFFFFF", width: 1 }, shadow: "shadow-none",
    });
    addText(slide, phase.name, { left: left + index * phaseWidth + 18, top: 156, width: phaseWidth - 36, height: 36 }, {
      fontSize: 20, bold: true, color: "#FFFFFF",
    });
    addText(slide, phase.duration, { left: left + index * phaseWidth + 18, top: 194, width: phaseWidth - 36, height: 24 }, {
      fontSize: 16, color: "#DCEEFF",
    });
    addText(slide, phase.description, { left: left + index * phaseWidth + 18, top: 224, width: phaseWidth - 36, height: 56 }, {
      fontSize: 15, color: "#FFFFFF", verticalAlignment: "top",
    });
    addBox(slide, { left: left + index * phaseWidth, top: chartTop, width: phaseWidth, height: chartHeight }, {
      fill: index % 2 ? "#F3F7FB" : "#FFFFFF",
      line: { style: "solid", fill: THEME.line, width: 1 }, shadow: "shadow-none",
    });
  });
  const values = phases.map((phase) => Math.max(0, Math.min(1, phase.level)));
  const points = values.map((value, index) => ({
    x: left + phaseWidth * (index + 0.5),
    y: chartTop + chartHeight - 36 - value * (chartHeight - 92),
  }));
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    addLine(slide, from, to, THEME.accent, 4);
  }
  phases.forEach((phase, index) => {
    const point = points[index];
    addCircle(slide, { left: point.x - 9, top: point.y - 9, width: 18, height: 18 }, {
      fill: "#FFFFFF", line: { style: "solid", fill: THEME.accent, width: 3 }, shadow: "shadow-none",
    });
    addText(slide, bulletText(phase.signals.slice(0, 3)), {
      left: left + index * phaseWidth + 20,
      top: Math.min(chartTop + chartHeight - 88, point.y + 24),
      width: phaseWidth - 40,
      height: 66,
    }, { fontSize: 14, color: THEME.body, verticalAlignment: "top" });
  });
  addText(slide, params.footer, { left: 130, top: 612, width: 1020, height: 42 }, {
    fontSize: 18, bold: true, color: THEME.accent, alignment: "center",
  });
  return slide;
}

export function buildProblemSolutionBowtie(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "问题—解决方案蝴蝶结");
  const problems = params.problems.slice(0, 4);
  const solutions = params.solutions.slice(0, 4);
  const actions = params.futureActions.slice(0, 4);

  slide.shapes.add({
    geometry: "chevron", position: { left: 248, top: 200, width: 330, height: 250 },
    rotation: 180, fill: "#8A8F96", line: { style: "solid", fill: "#FFFFFF", width: 2 },
  });
  slide.shapes.add({
    geometry: "chevron", position: { left: 702, top: 200, width: 330, height: 250 },
    fill: "#4268B3", line: { style: "solid", fill: "#FFFFFF", width: 2 },
  });
  addBox(slide, { left: 490, top: 254, width: 150, height: 142 }, {
    fill: "#FFFFFF", line: { style: "solid", fill: "#D6DEE8", width: 1.5 }, shadow: "shadow-md",
    text: params.problemLabel, fontSize: 25, bold: true, color: "#555A62",
  });
  addBox(slide, { left: 640, top: 254, width: 150, height: 142 }, {
    fill: "#FFFFFF", line: { style: "solid", fill: "#D6DEE8", width: 1.5 }, shadow: "shadow-md",
    text: params.solutionLabel, fontSize: 25, bold: true, color: THEME.accent,
  });
  problems.forEach((problem, index) => addBox(slide, { left: 46, top: 154 + index * 84, width: 300, height: 68 }, {
    fill: index % 2 ? "#F1F3F5" : "#FFFFFF", line: { style: "solid", fill: "#D7DBE0", width: 1 }, shadow: "shadow-none",
    text: problem, fontSize: 16, color: THEME.body, alignment: "left",
  }));
  solutions.forEach((solution, index) => addBox(slide, { left: 934, top: 154 + index * 84, width: 300, height: 68 }, {
    fill: index % 2 ? "#F1F7FD" : "#FFFFFF", line: { style: "solid", fill: "#C5D7EC", width: 1 }, shadow: "shadow-none",
    text: solution, fontSize: 16, color: THEME.body, alignment: "left",
  }));
  const actionWidth = 1172 / actions.length;
  actions.forEach((action, index) => addBox(slide, { left: 54 + index * actionWidth, top: 540, width: actionWidth - 12, height: 104 }, {
    fill: index % 2 ? THEME.accentAlt : THEME.accent,
    line: { style: "solid", fill: "#FFFFFF", width: 1 }, shadow: "shadow-sm",
    text: action, fontSize: 17, bold: true, color: "#FFFFFF",
  }));
  addText(slide, params.footerLabel, { left: 500, top: 494, width: 280, height: 32 }, {
    fontSize: 18, bold: true, color: THEME.muted, alignment: "center",
  });
  return slide;
}
