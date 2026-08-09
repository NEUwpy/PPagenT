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
    fontSize: 36,
    bold: true,
    color: THEME.accent,
  });
  addText(slide, subtitle, { left: 74, top: 92, width: 720, height: 26 }, {
    fontSize: 16,
    color: THEME.muted,
  });
  return slide;
}

function addLine(slide, from, to, color = THEME.line, width = 2) {
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
    line: { style: "solid", fill: color, width },
  });
}

function initials(name) {
  return String(name ?? "").trim().slice(0, 2) || "成员";
}

export function buildOrganizationTree(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "三层组织树");
  const departments = params.departments.slice(0, 4);
  if (departments.length < 2) throw new Error("三层组织树至少需要 2 个部门");
  const leaderCenter = { x: 640, y: 180 };
  const departmentY = 348;
  const memberY = 548;
  const departmentXs = departments.map((_, index) => 150 + index * (980 / (departments.length - 1)));

  addLine(slide, { x: leaderCenter.x, y: 230 }, { x: leaderCenter.x, y: 272 }, THEME.accent, 2.5);
  addLine(slide, { x: departmentXs[0], y: 272 }, { x: departmentXs.at(-1), y: 272 }, THEME.accent, 2.5);
  departmentXs.forEach((x) => addLine(slide, { x, y: 272 }, { x, y: departmentY - 48 }, THEME.accent, 2.5));

  departments.forEach((department, index) => {
    const members = department.members.slice(0, 3);
    const centerX = departmentXs[index];
    const span = Math.min(210, 76 * Math.max(1, members.length - 1));
    const memberXs = members.map((_, memberIndex) => members.length === 1
      ? centerX
      : centerX - span / 2 + memberIndex * (span / (members.length - 1)));
    addLine(slide, { x: centerX, y: departmentY + 48 }, { x: centerX, y: 462 }, THEME.accentAlt, 2);
    if (members.length > 1) addLine(slide, { x: memberXs[0], y: 462 }, { x: memberXs.at(-1), y: 462 }, THEME.accentAlt, 2);
    memberXs.forEach((x) => addLine(slide, { x, y: 462 }, { x, y: memberY - 34 }, THEME.accentAlt, 2));
  });

  addCircle(slide, { left: 588, top: 128, width: 104, height: 104 }, {
    fill: "#DCE6F2", line: { style: "solid", fill: THEME.accent, width: 3 }, shadow: "shadow-md",
    text: initials(params.leader.name), fontSize: 27, bold: true, color: THEME.accent,
  });
  addBox(slide, { left: 530, top: 238, width: 220, height: 38 }, {
    fill: THEME.accent, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
    text: `${params.leader.name}｜${params.leader.role}`, fontSize: 16, bold: true, color: "#FFFFFF",
    insets: { top: 3, right: 8, bottom: 3, left: 8 },
  });

  departments.forEach((department, index) => {
    const centerX = departmentXs[index];
    addCircle(slide, { left: centerX - 46, top: departmentY - 46, width: 92, height: 92 }, {
      fill: "#EAF2FA", line: { style: "solid", fill: THEME.accent, width: 2.5 }, shadow: "shadow-sm",
      text: initials(department.head), fontSize: 24, bold: true, color: THEME.accent,
    });
    addBox(slide, { left: centerX - 100, top: departmentY + 52, width: 200, height: 36 }, {
      fill: THEME.accent, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
      text: `${department.head}｜${department.name}`, fontSize: 14, bold: true, color: "#FFFFFF",
      insets: { top: 2, right: 5, bottom: 2, left: 5 },
    });
    const members = department.members.slice(0, 3);
    const span = Math.min(210, 76 * Math.max(1, members.length - 1));
    const labelWidth = members.length === 3 ? 70 : 108;
    members.forEach((member, memberIndex) => {
      const x = members.length === 1 ? centerX : centerX - span / 2 + memberIndex * (span / (members.length - 1));
      addCircle(slide, { left: x - 33, top: memberY - 33, width: 66, height: 66 }, {
        fill: "#FFFFFF", line: { style: "solid", fill: THEME.accentAlt, width: 2 }, shadow: "shadow-sm",
        text: initials(member.name), fontSize: 18, bold: true, color: THEME.accentAlt,
      });
      addBox(slide, { left: x - labelWidth / 2, top: memberY + 40, width: labelWidth, height: 34 }, {
        fill: "#EEF4FA", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
        text: `${member.name}\n${member.role}`, fontSize: 10, color: THEME.body,
        insets: { top: 2, right: 3, bottom: 2, left: 3 },
      });
    });
  });
  return slide;
}

export function buildEvolutionStaircase(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "阶段演进阶梯");
  const stages = params.stages.slice(0, 5);
  if (stages.length < 3) throw new Error("阶段演进阶梯至少需要 3 个阶段");
  const left = 58;
  const totalWidth = 1164;
  const stageWidth = totalWidth / stages.length;
  const bottom = 648;
  const minHeight = 260;
  const maxHeight = 500;
  const tops = stages.map((_, index) => bottom - minHeight - index * ((maxHeight - minHeight) / Math.max(1, stages.length - 1)));

  tops.forEach((top, index) => {
    const x = left + index * stageWidth;
    addBox(slide, { left: x + 3, top, width: stageWidth - 8, height: bottom - top }, {
      fill: index % 2 ? "#174A86" : "#103774",
      line: { style: "solid", fill: "#FFFFFF", width: 2 }, shadow: "shadow-none",
    });
    addText(slide, stages[index].period, { left: x + 28, top: top + 52, width: stageWidth - 56, height: 30 }, {
      fontSize: 18, bold: true, color: "#FFBF4A",
    });
    addText(slide, stages[index].name, { left: x + 28, top: top + 84, width: stageWidth - 56, height: 54 }, {
      fontSize: 24, bold: true, color: "#FFFFFF", verticalAlignment: "top",
    });
    addText(slide, stages[index].body, { left: x + 28, top: top + 150, width: stageWidth - 56, height: Math.max(82, bottom - top - 178) }, {
      fontSize: stages.length === 5 ? 14 : 16, color: "#DCE8F7", verticalAlignment: "top",
    });
    addCircle(slide, { left: x + stageWidth / 2 - 35, top: top - 58, width: 70, height: 70 }, {
      fill: "#FFFFFF", line: { style: "solid", fill: index ? THEME.accent : "#F2B84B", width: 3 }, shadow: "shadow-md",
      text: stages[index].marker, fontSize: 16, bold: true, color: index ? THEME.accent : "#E8A62A",
    });
    if (index < stages.length - 1) {
      addLine(slide, { x: x + stageWidth / 2, y: top - 23 }, {
        x: left + (index + 1) * stageWidth + stageWidth / 2,
        y: tops[index + 1] - 23,
      }, "#8CC4FF", 8);
    }
  });
  return slide;
}

export function buildDualTrackRoadmap(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "双轨演进路线图");
  const stages = params.stages.slice(0, 5);
  if (stages.length < 3) throw new Error("双轨演进路线图至少需要 3 个阶段");
  const xs = stages.map((_, index) => 120 + index * (1040 / (stages.length - 1)));
  const waveA = xs.map((x, index) => ({ x, y: index % 2 ? 390 : 300 }));
  const waveB = xs.map((x, index) => ({ x, y: index % 2 ? 300 : 390 }));
  for (let index = 0; index < stages.length - 1; index += 1) {
    addLine(slide, waveA[index], waveA[index + 1], THEME.accent, 18);
    addLine(slide, waveB[index], waveB[index + 1], THEME.accentAlt, 18);
  }
  addBox(slide, { left: 72, top: 274, width: 110, height: 34 }, {
    fill: THEME.accent, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
    text: params.trackA, fontSize: 15, bold: true, color: "#FFFFFF",
    insets: { top: 2, right: 6, bottom: 2, left: 6 },
  });
  addBox(slide, { left: 72, top: 407, width: 110, height: 34 }, {
    fill: THEME.accentAlt, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
    text: params.trackB, fontSize: 15, bold: true, color: "#FFFFFF",
    insets: { top: 2, right: 6, bottom: 2, left: 6 },
  });

  stages.forEach((stage, index) => {
    const cardWidth = stages.length === 5 ? 196 : 224;
    const cardLeft = Math.max(48, Math.min(1232 - cardWidth, xs[index] - cardWidth / 2));
    const cardTop = index % 2 ? 450 : 136;
    const anchor = index % 2 ? waveA[index] : waveB[index];
    addLine(slide, anchor, { x: xs[index], y: index % 2 ? cardTop : cardTop + 126 }, THEME.line, 1.5);
    addBox(slide, { left: cardLeft, top: cardTop, width: cardWidth, height: 126 }, {
      fill: "#FFFFFF", line: { style: "solid", fill: index % 2 ? THEME.accentAlt : THEME.accent, width: 1.5 }, shadow: "shadow-sm",
    });
    addText(slide, stage.period, { left: cardLeft + 14, top: cardTop + 12, width: cardWidth - 28, height: 24 }, {
      fontSize: 15, bold: true, color: "#E9A62E",
    });
    addText(slide, stage.name, { left: cardLeft + 14, top: cardTop + 38, width: cardWidth - 28, height: 32 }, {
      fontSize: 19, bold: true, color: THEME.accent,
    });
    addText(slide, stage.body, { left: cardLeft + 14, top: cardTop + 72, width: cardWidth - 28, height: 42 }, {
      fontSize: 13, color: THEME.body, verticalAlignment: "top",
    });
    addCircle(slide, { left: anchor.x - 8, top: anchor.y - 8, width: 16, height: 16 }, {
      fill: "#FFFFFF", line: { style: "solid", fill: index % 2 ? THEME.accent : THEME.accentAlt, width: 3 }, shadow: "shadow-none",
    });
  });
  return slide;
}
