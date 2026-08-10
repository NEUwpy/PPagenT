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
import { wrapChineseText } from "../render/chinese-typography.mjs";

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
  addText(slide, subtitle, { left: 74, top: 92, width: 720, height: 26 }, {
    fontSize: 16,
    color: THEME.muted,
  });
  return slide;
}

function initials(name) {
  return String(name ?? "").trim().slice(0, 2) || "成员";
}

export function buildOrganizationTree(presentation, params) {
  const slide = prepareSlide(presentation, params.title, "组织层级 · 角色分工");
  const departments = params.departments;
  if (departments.length < 2 || departments.length > 4) throw new Error("三层组织树支持 2–4 个部门");
  for (const department of departments) {
    if (department.members.length < 1 || department.members.length > 3) {
      throw new Error("三层组织树每个部门支持 1–3 名成员");
    }
  }

  const departmentY = 350;
  const memberY = 535;
  const departmentXs = departments.map((_, index) => 150 + index * (980 / (departments.length - 1)));
  addLine(slide, { x: 640, y: 228 }, { x: 640, y: 276 }, THEME.accent, 2.5);
  addLine(slide, { x: departmentXs[0], y: 276 }, { x: departmentXs.at(-1), y: 276 }, THEME.accent, 2.5);
  departmentXs.forEach((x) => addLine(slide, { x, y: 276 }, { x, y: departmentY - 44 }, THEME.accent, 2.5));

  addCircle(slide, { left: 584, top: 126, width: 112, height: 112 }, {
    fill: "#DCE8F4", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
  });
  addCircle(slide, { left: 596, top: 138, width: 88, height: 88 }, {
    fill: "#FFFFFF", line: { style: "solid", fill: THEME.accent, width: 3 }, shadow: "shadow-md",
    text: initials(params.leader.name), fontSize: 24, bold: true, color: THEME.accent,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  addBox(slide, { left: 526, top: 228, width: 228, height: 40 }, {
    name: qaElementName({ parent: "org-leader", domains: ["organization-leaders"] }),
    fill: THEME.accent, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-sm",
    text: `${params.leader.name}｜${params.leader.role}`, fontSize: 16, bold: true, color: "#FFFFFF",
    insets: { top: 2, right: 8, bottom: 2, left: 8 },
  });

  departments.forEach((department, index) => {
    const centerX = departmentXs[index];
    const members = department.members;
    const span = members.length === 1 ? 0 : Math.min(204, 82 * (members.length - 1));
    const memberXs = members.map((_, memberIndex) => members.length === 1
      ? centerX
      : centerX - span / 2 + memberIndex * (span / (members.length - 1)));
    addLine(slide, { x: centerX, y: departmentY + 46 }, { x: centerX, y: 470 }, "#E3AF45", 2);
    if (members.length > 1) addLine(slide, { x: memberXs[0], y: 470 }, { x: memberXs.at(-1), y: 470 }, "#E3AF45", 2);
    memberXs.forEach((x) => addLine(slide, { x, y: 470 }, { x, y: memberY - 30 }, "#E3AF45", 2));

    addCircle(slide, { left: centerX - 50, top: departmentY - 50, width: 100, height: 100 }, {
      fill: "#E4EDF6", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
    });
    addCircle(slide, { left: centerX - 40, top: departmentY - 40, width: 80, height: 80 }, {
      fill: "#FFFFFF", line: { style: "solid", fill: THEME.accent, width: 2.5 }, shadow: "shadow-md",
      text: initials(department.head), fontSize: 21, bold: true, color: THEME.accent,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    addBox(slide, { left: centerX - 108, top: departmentY + 50, width: 216, height: 38 }, {
      name: qaElementName({ parent: `org-department-${index}`, domains: ["organization-departments"] }),
      fill: THEME.accent, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-sm",
      text: `${department.head}｜${department.name}`, fontSize: 16, bold: true, color: "#FFFFFF",
      insets: { top: 2, right: 6, bottom: 2, left: 6 },
    });
    members.forEach((member, memberIndex) => {
      const x = memberXs[memberIndex];
      addCircle(slide, { left: x - 30, top: memberY - 30, width: 60, height: 60 }, {
        fill: "#FFFFFF", line: { style: "solid", fill: "#E3AF45", width: 2.5 }, shadow: "shadow-sm",
        text: initials(member.name), fontSize: 17, bold: true, color: THEME.accent,
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      addBox(slide, { left: x - 39, top: memberY + 36, width: 78, height: 48 }, {
        name: qaElementName({ parent: `org-member-${index}-${memberIndex}`, domains: ["organization-members"] }),
        fill: "#F1F5F9", line: { style: "solid", fill: "#E1E8EF", width: 1 }, shadow: "shadow-none",
        text: member.role, fontSize: 16, color: THEME.body,
        autoFit: "none",
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
  const slide = prepareSlide(presentation, params.title, "共同起点 · 双轨并行演进");
  const stages = params.stages;
  if (stages.length < 3 || stages.length > 5) throw new Error("双轨演进路线图支持 3–5 个阶段");
  for (const stage of stages) {
    if (!stage.trackA?.title || !stage.trackB?.title) throw new Error("双轨路线的每个阶段必须同时提供两条主线内容");
  }

  const laneLeft = 260;
  const laneWidth = 950;
  const topLane = 276;
  const bottomLane = 466;
  const startFrame = { left: 92, top: 356, width: 110, height: 110 };
  const topLaneFrame = { left: laneLeft, top: topLane, width: laneWidth, height: 80 };
  const bottomLaneFrame = { left: laneLeft, top: bottomLane, width: laneWidth, height: 80 };
  addCircle(slide, { left: 72, top: 336, width: 150, height: 150 }, {
    fill: "#E2EAF4", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
  });
  addCircle(slide, startFrame, {
    name: qaElementName({ parent: "dual-track-start" }),
    fill: THEME.surface, line: { style: "solid", fill: THEME.accent, width: 5 }, shadow: "shadow-md",
    text: params.start ?? "共同起点", fontSize: 19, bold: true, color: THEME.accent,
  });
  addAnchoredLine(slide,
    { frame: startFrame, side: "right", parent: "dual-track-start" },
    { frame: topLaneFrame, side: "left", parent: "dual-track-lane-a" },
    THEME.accent, 3);
  addAnchoredLine(slide,
    { frame: startFrame, side: "right", parent: "dual-track-start" },
    { frame: bottomLaneFrame, side: "left", parent: "dual-track-lane-b" },
    THEME.accentAlt, 3);
  addBox(slide, topLaneFrame, {
    name: qaElementName({ parent: "dual-track-lane-a" }),
    geometry: "rightArrow", fill: THEME.accent, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
  });
  addBox(slide, bottomLaneFrame, {
    name: qaElementName({ parent: "dual-track-lane-b" }),
    geometry: "rightArrow", fill: "#5D91CD", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
  });
  addText(slide, params.trackA, { left: 278, top: topLane + 20, width: 120, height: 40 }, {
    fontSize: 18, bold: true, color: "#FFFFFF", alignment: "center",
  });
  addText(slide, params.trackB, { left: 278, top: bottomLane + 20, width: 120, height: 40 }, {
    fontSize: 18, bold: true, color: "#FFFFFF", alignment: "center",
  });

  const stageStart = 448;
  const stageEnd = 1110;
  const xs = stages.map((_, index) => stageStart + index * ((stageEnd - stageStart) / (stages.length - 1)));
  const cardWidth = stages.length === 5 ? 150 : 180;
  stages.forEach((stage, index) => {
    const x = xs[index];
    const cardLeft = x - cardWidth / 2;
    addLine(slide, { x, y: topLane - 8 }, { x, y: bottomLane + 88 }, "#C2CEDB", 1);
    addCircle(slide, { left: x - 22, top: topLane + 18, width: 44, height: 44 }, {
      fill: "#FFFFFF", line: { style: "solid", fill: THEME.accent, width: 3 }, shadow: "shadow-sm",
      text: String(index + 1).padStart(2, "0"), fontSize: 16, bold: true, color: THEME.accent,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    addCircle(slide, { left: x - 22, top: bottomLane + 18, width: 44, height: 44 }, {
      fill: "#FFFFFF", line: { style: "solid", fill: THEME.accentAlt, width: 3 }, shadow: "shadow-sm",
      text: String(index + 1).padStart(2, "0"), fontSize: 16, bold: true, color: THEME.accentAlt,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    addBox(slide, { left: x - 46, top: 374, width: 92, height: 36 }, {
      fill: "#FFFFFF", line: { style: "solid", fill: "#D6E1EC", width: 1 }, shadow: "shadow-sm",
      text: stage.period, fontSize: 16, bold: true, color: "#D99923",
      insets: { top: 1, right: 4, bottom: 1, left: 4 },
    });
    addBox(slide, { left: cardLeft, top: 146, width: cardWidth, height: 112 }, {
      name: qaElementName({ parent: `dual-track-a-${index}`, domains: ["dual-track-a-cards"] }),
      fill: "#FFFFFF", line: { style: "solid", fill: "#BFD4E7", width: 1 }, shadow: "shadow-sm",
    });
    addText(slide, stage.trackA.title, { left: cardLeft + 12, top: 158, width: cardWidth - 24, height: 34 }, {
      fontSize: 18, bold: true, color: THEME.accent, alignment: "center",
    });
    addText(slide, wrapChineseText(stage.trackA.body ?? "", stages.length === 5 ? 6 : 9), { left: cardLeft + 12, top: 198, width: cardWidth - 24, height: 48 }, {
      fontSize: 16, color: THEME.body, alignment: "center", verticalAlignment: "top", autoFit: "none",
    });
    addBox(slide, { left: cardLeft, top: 562, width: cardWidth, height: 96 }, {
      name: qaElementName({ parent: `dual-track-b-${index}`, domains: ["dual-track-b-cards"] }),
      fill: "#FFFFFF", line: { style: "solid", fill: "#BFD4E7", width: 1 }, shadow: "shadow-sm",
    });
    addText(slide, stage.trackB.title, { left: cardLeft + 12, top: 572, width: cardWidth - 24, height: 32 }, {
      fontSize: 18, bold: true, color: THEME.accentAlt, alignment: "center",
    });
    addText(slide, wrapChineseText(stage.trackB.body ?? "", stages.length === 5 ? 6 : 9), { left: cardLeft + 12, top: 608, width: cardWidth - 24, height: 40 }, {
      fontSize: 16, color: THEME.body, alignment: "center", verticalAlignment: "top", autoFit: "none",
    });
  });
  return slide;
}
