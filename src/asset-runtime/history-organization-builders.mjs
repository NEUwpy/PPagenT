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
  return Array.from(String(name ?? "").trim()).slice(0, 2).join("") || "成员";
}

export const ORGANIZATION_TREE_SOURCE_FRAME = Object.freeze({ left: 40, top: 135, width: 1200, height: 520 });

export const ORGANIZATION_TREE_TEXT_LIMITS = Object.freeze({
  title: 24,
  leaderName: 4,
  leaderRole: 5,
  departmentName: 4,
  departmentHead: 4,
  memberName: 4,
  memberRole: 6,
});

export class OrganizationTreeValidationError extends Error {
  constructor(code, field, message) {
    super(message);
    this.name = "OrganizationTreeValidationError";
    this.code = code;
    this.field = field;
  }
}

function validationError(code, field, message) {
  throw new OrganizationTreeValidationError(code, field, message);
}

function validateText(value, field, maximum) {
  if (typeof value !== "string" || value.trim().length === 0) {
    validationError("ORG_TREE_TEXT_REQUIRED", field, `${field} 必须是非空字符串`);
  }
  if (value !== value.trim()) {
    validationError("ORG_TREE_TEXT_SURROUNDING_WHITESPACE", field, `${field} 不允许包含首尾空白`);
  }
  if (/[\u0000-\u001F\u007F]/u.test(value)) {
    validationError("ORG_TREE_TEXT_CONTROL_CHARACTER", field, `${field} 不允许包含换行或控制字符`);
  }
  if (Array.from(value).length > maximum) {
    validationError("ORG_TREE_TEXT_TOO_LONG", field, `${field} 最多支持 ${maximum} 个字符`);
  }
}

export function validateOrganizationTreeParams(params) {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    validationError("ORG_TREE_PARAMS_REQUIRED", "params", "三层组织树参数必须是对象");
  }
  validateText(params.title, "title", ORGANIZATION_TREE_TEXT_LIMITS.title);
  if (!params.leader || typeof params.leader !== "object" || Array.isArray(params.leader)) {
    validationError("ORG_TREE_LEADER_REQUIRED", "leader", "三层组织树必须提供总负责人");
  }
  validateText(params.leader.name, "leader.name", ORGANIZATION_TREE_TEXT_LIMITS.leaderName);
  validateText(params.leader.role, "leader.role", ORGANIZATION_TREE_TEXT_LIMITS.leaderRole);
  if (!Array.isArray(params.departments)) {
    validationError("ORG_TREE_DEPARTMENTS_REQUIRED", "departments", "departments 必须是数组");
  }
  if (params.departments.length < 2 || params.departments.length > 4) {
    validationError("ORG_TREE_DEPARTMENT_COUNT", "departments", "三层组织树支持 2–4 个部门");
  }
  params.departments.forEach((department, departmentIndex) => {
    const departmentField = `departments[${departmentIndex}]`;
    if (!department || typeof department !== "object" || Array.isArray(department)) {
      validationError("ORG_TREE_DEPARTMENT_REQUIRED", departmentField, `${departmentField} 必须是对象`);
    }
    validateText(department.name, `${departmentField}.name`, ORGANIZATION_TREE_TEXT_LIMITS.departmentName);
    validateText(department.head, `${departmentField}.head`, ORGANIZATION_TREE_TEXT_LIMITS.departmentHead);
    if (!Array.isArray(department.members)) {
      validationError("ORG_TREE_MEMBERS_REQUIRED", `${departmentField}.members`, `${departmentField}.members 必须是数组`);
    }
    if (department.members.length < 1 || department.members.length > 3) {
      validationError("ORG_TREE_MEMBER_COUNT", `${departmentField}.members`, "三层组织树每个部门支持 1–3 名成员");
    }
    department.members.forEach((member, memberIndex) => {
      const memberField = `${departmentField}.members[${memberIndex}]`;
      if (!member || typeof member !== "object" || Array.isArray(member)) {
        validationError("ORG_TREE_MEMBER_REQUIRED", memberField, `${memberField} 必须是对象`);
      }
      validateText(member.name, `${memberField}.name`, ORGANIZATION_TREE_TEXT_LIMITS.memberName);
      validateText(member.role, `${memberField}.role`, ORGANIZATION_TREE_TEXT_LIMITS.memberRole);
    });
  });
  return params;
}

function centeredFrame(x, y, width, height) {
  return { left: x - width / 2, top: y - height / 2, width, height };
}

function pointFrame(x, y) {
  return centeredFrame(x, y, 1, 1);
}

function departmentCenters(count) {
  const spans = { 2: 640, 3: 800, 4: 950 };
  const span = spans[count];
  return Array.from({ length: count }, (_, index) => 640 - span / 2 + index * (span / (count - 1)));
}

export function computeOrganizationTreeLayout(params) {
  validateOrganizationTreeParams(params);
  const departmentXs = departmentCenters(params.departments.length);
  const departmentBusY = 285;
  const departmentY = 350;
  const memberBusY = 470;
  const memberY = 535;
  const departments = params.departments.map((department, departmentIndex) => {
    const centerX = departmentXs[departmentIndex];
    const memberSpan = department.members.length === 1 ? 0 : 82 * (department.members.length - 1);
    const memberXs = department.members.map((_, memberIndex) => department.members.length === 1
      ? centerX
      : centerX - memberSpan / 2 + memberIndex * (memberSpan / (department.members.length - 1)));
    return {
      centerX,
      nodeFrame: centeredFrame(centerX, departmentY, 100, 100),
      innerFrame: centeredFrame(centerX, departmentY, 80, 80),
      labelFrame: { left: centerX - 108, top: 400, width: 216, height: 38 },
      branchJunction: pointFrame(centerX, departmentBusY),
      memberBusRoot: pointFrame(centerX, memberBusY),
      members: department.members.map((member, memberIndex) => ({
        ...member,
        centerX: memberXs[memberIndex],
        branchJunction: pointFrame(memberXs[memberIndex], memberBusY),
        nodeFrame: centeredFrame(memberXs[memberIndex], memberY, 60, 60),
        labelFrame: { left: memberXs[memberIndex] - 39, top: 571, width: 78, height: 48 },
      })),
    };
  });
  return {
    sourceFrame: { ...ORGANIZATION_TREE_SOURCE_FRAME },
    leader: {
      nodeFrame: centeredFrame(640, 191, 112, 112),
      innerFrame: centeredFrame(640, 191, 88, 88),
      labelFrame: { left: 526, top: 235, width: 228, height: 40 },
    },
    departmentBusRoot: pointFrame(640, departmentBusY),
    departments,
  };
}

function addJunction(slide, id, frame) {
  return addBox(slide, frame, {
    name: qaElementName({ parent: id, role: "junction" }),
    geometry: "rect",
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-none",
  });
}

function connect(slide, fromId, fromFrame, fromSide, toId, toFrame, toSide, color, width) {
  return addAnchoredLine(slide,
    { frame: fromFrame, side: fromSide, parent: fromId },
    { frame: toFrame, side: toSide, parent: toId },
    color,
    width);
}

export function buildOrganizationTree(presentation, params) {
  const layout = computeOrganizationTreeLayout(params);
  const slide = prepareSlide(presentation, params.title, "组织层级 · 角色分工");
  const rootId = "org-department-bus-root";
  addJunction(slide, rootId, layout.departmentBusRoot);
  layout.departments.forEach((department, departmentIndex) => {
    addJunction(slide, `org-department-branch-${departmentIndex}`, department.branchJunction);
    addJunction(slide, `org-member-bus-root-${departmentIndex}`, department.memberBusRoot);
    department.members.forEach((member, memberIndex) => {
      addJunction(slide, `org-member-branch-${departmentIndex}-${memberIndex}`, member.branchJunction);
    });
  });

  connect(slide, "org-leader-label", layout.leader.labelFrame, "bottom", rootId, layout.departmentBusRoot, "center", THEME.accent, 2.5);
  const firstDepartment = layout.departments[0];
  const lastDepartment = layout.departments.at(-1);
  connect(slide, "org-department-branch-0", firstDepartment.branchJunction, "center", rootId, layout.departmentBusRoot, "center", THEME.accent, 2.5);
  connect(slide, rootId, layout.departmentBusRoot, "center", `org-department-branch-${layout.departments.length - 1}`, lastDepartment.branchJunction, "center", THEME.accent, 2.5);
  layout.departments.forEach((department, departmentIndex) => {
    const departmentNodeId = `org-department-node-${departmentIndex}`;
    const departmentLabelId = `org-department-label-${departmentIndex}`;
    const memberRootId = `org-member-bus-root-${departmentIndex}`;
    connect(slide, `org-department-branch-${departmentIndex}`, department.branchJunction, "center", departmentNodeId, department.nodeFrame, "top", THEME.accent, 2.5);
    connect(slide, departmentLabelId, department.labelFrame, "bottom", memberRootId, department.memberBusRoot, "center", "#E3AF45", 2);
    if (department.members.length > 1) {
      connect(slide, `org-member-branch-${departmentIndex}-0`, department.members[0].branchJunction, "center", memberRootId, department.memberBusRoot, "center", "#E3AF45", 2);
      connect(slide, memberRootId, department.memberBusRoot, "center", `org-member-branch-${departmentIndex}-${department.members.length - 1}`, department.members.at(-1).branchJunction, "center", "#E3AF45", 2);
    }
    department.members.forEach((member, memberIndex) => {
      connect(slide, `org-member-branch-${departmentIndex}-${memberIndex}`, member.branchJunction, "center", `org-member-node-${departmentIndex}-${memberIndex}`, member.nodeFrame, "top", "#E3AF45", 2);
    });
  });

  addCircle(slide, layout.leader.nodeFrame, {
    name: qaElementName({ parent: "org-leader-node", domains: ["organization-node-circles"] }),
    fill: "#DCE8F4", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
  });
  addCircle(slide, layout.leader.innerFrame, {
    name: qaElementName({ within: "org-leader-node", role: "portrait" }),
    fill: "#FFFFFF", line: { style: "solid", fill: THEME.accent, width: 3 }, shadow: "shadow-md",
    text: initials(params.leader.name), fontSize: 24, bold: true, color: THEME.accent,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  addBox(slide, layout.leader.labelFrame, {
    name: qaElementName({ parent: "org-leader-label", domains: ["organization-leader-labels"] }),
    fill: THEME.accent, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-sm",
    text: `${params.leader.name}｜${params.leader.role}`, fontSize: 16, bold: true, color: "#FFFFFF",
    autoFit: "none",
    insets: { top: 2, right: 8, bottom: 2, left: 8 },
  });

  layout.departments.forEach((departmentLayout, departmentIndex) => {
    const department = params.departments[departmentIndex];
    const departmentNodeId = `org-department-node-${departmentIndex}`;
    addCircle(slide, departmentLayout.nodeFrame, {
      name: qaElementName({ parent: departmentNodeId, domains: ["organization-node-circles"] }),
      fill: "#E4EDF6", line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none",
    });
    addCircle(slide, departmentLayout.innerFrame, {
      name: qaElementName({ within: departmentNodeId, role: "portrait" }),
      fill: "#FFFFFF", line: { style: "solid", fill: THEME.accent, width: 2.5 }, shadow: "shadow-md",
      text: initials(department.head), fontSize: 21, bold: true, color: THEME.accent,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    addBox(slide, departmentLayout.labelFrame, {
      name: qaElementName({ parent: `org-department-label-${departmentIndex}`, domains: ["organization-department-labels"] }),
      fill: THEME.accent, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-sm",
      text: `${department.head}｜${department.name}`, fontSize: 16, bold: true, color: "#FFFFFF",
      autoFit: "none",
      insets: { top: 2, right: 6, bottom: 2, left: 6 },
    });
    departmentLayout.members.forEach((memberLayout, memberIndex) => {
      const member = department.members[memberIndex];
      const memberNodeId = `org-member-node-${departmentIndex}-${memberIndex}`;
      addCircle(slide, memberLayout.nodeFrame, {
        name: qaElementName({ parent: memberNodeId, domains: ["organization-node-circles"] }),
        fill: "#FFFFFF", line: { style: "solid", fill: "#E3AF45", width: 2.5 }, shadow: "shadow-sm",
        text: initials(member.name), fontSize: 17, bold: true, color: THEME.accent,
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      addBox(slide, memberLayout.labelFrame, {
        name: qaElementName({ parent: `org-member-label-${departmentIndex}-${memberIndex}`, domains: ["organization-member-labels"] }),
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
