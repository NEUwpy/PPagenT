import { textFlowMarkup } from "../../../src/visual-runtime/text-flow.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const LIMITS = Object.freeze({ role: 4 });

function stateLimits(stageCount, roleCount) {
  return {
    stage: stageCount === 3 ? 8 : stageCount === 4 ? 7 : 6,
    taskTitle: stageCount === 5 ? 6 : 8,
    taskBody: roleCount === 4 ? 7 : stageCount === 5 ? 14 : 18,
    taskBodyLines: roleCount === 4 ? 1 : 2,
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function text(value) { return String(value ?? "").trim(); }
function chars(value) { return Array.from(value).length; }

function requireText(value, field, limit) {
  const normalized = text(value);
  if (!normalized) throw new Error(`${field} 不能为空`);
  if (chars(normalized) > limit) throw new Error(`${field} 超过 ${limit} 字`);
  return normalized;
}

function optionalText(value, field, limit) {
  const normalized = text(value);
  if (chars(normalized) > limit) throw new Error(`${field} 超过 ${limit} 字`);
  return normalized;
}

function normalize(parameters) {
  if (!Array.isArray(parameters?.stages) || parameters.stages.length < 3 || parameters.stages.length > 5) throw new Error("阶段角色协同支持 3–5 个阶段");
  if (!Array.isArray(parameters?.roles) || parameters.roles.length < 2 || parameters.roles.length > 4) throw new Error("阶段角色协同支持 2–4 个角色");
  if (!Array.isArray(parameters?.tasks) || parameters.tasks.length < 3 || parameters.tasks.length > 8) throw new Error("阶段角色协同支持 3–8 项任务");
  const limits = stateLimits(parameters.stages.length, parameters.roles.length);
  const stages = parameters.stages.map((stage, index) => ({ key: text(stage?.key) || `stage-${index + 1}`, title: requireText(stage?.title, `stages[${index}].title`, limits.stage) }));
  const roles = parameters.roles.map((role, index) => ({ key: text(role?.key) || `role-${index + 1}`, name: requireText(role?.name, `roles[${index}].name`, LIMITS.role) }));
  const stageIndex = new Map(stages.map((stage, index) => [stage.key, index]));
  const roleIndex = new Map(roles.map((role, index) => [role.key, index]));
  const occupied = new Set();
  const tasks = parameters.tasks.map((task, index) => {
    if (!stageIndex.has(task?.stageKey)) throw new Error(`tasks[${index}].stageKey 不在当前阶段中`);
    if (!roleIndex.has(task?.roleKey)) throw new Error(`tasks[${index}].roleKey 不在当前角色中`);
    const cell = `${task.stageKey}|${task.roleKey}`;
    if (occupied.has(cell)) throw new Error(`同一阶段与角色单元只能有一个主要任务：${cell}`);
    occupied.add(cell);
    return {
      key: text(task?.key) || `task-${index + 1}`,
      stageKey: task.stageKey,
      roleKey: task.roleKey,
      stageIndex: stageIndex.get(task.stageKey),
      roleIndex: roleIndex.get(task.roleKey),
      title: requireText(task?.title, `tasks[${index}].title`, limits.taskTitle),
      body: optionalText(task?.body, `tasks[${index}].body`, limits.taskBody),
    };
  });
  for (let index = 1; index < tasks.length; index += 1) {
    if (tasks[index].stageIndex < tasks[index - 1].stageIndex) throw new Error("tasks 必须按阶段从左到右排列");
  }
  return { stages, roles, tasks, limits };
}

function geometry(model) {
  const gridLeft = 166;
  const gridTop = 82;
  const gridWidth = 1004;
  const gridHeight = 410;
  const columnWidth = gridWidth / model.stages.length;
  const rowHeight = gridHeight / model.roles.length;
  const cardWidth = Math.min(214, columnWidth - 24);
  const cardHeight = model.roles.length === 4 ? 70 : model.roles.length === 3 ? 82 : 92;
  const cardByKey = new Map(model.tasks.map((task) => {
    const left = gridLeft + task.stageIndex * columnWidth + (columnWidth - cardWidth) / 2;
    const top = gridTop + task.roleIndex * rowHeight + (rowHeight - cardHeight) / 2;
    return [task.key, { left, top, width: cardWidth, height: cardHeight, centerX: left + cardWidth / 2, centerY: top + cardHeight / 2 }];
  }));
  return { gridLeft, gridTop, gridWidth, gridHeight, columnWidth, rowHeight, cardWidth, cardHeight, cardByKey };
}

function connectorMarkup(tasks, g) {
  const segments = [];
  const nodes = [];
  for (let index = 0; index < tasks.length - 1; index += 1) {
    const source = g.cardByKey.get(tasks[index].key);
    const target = g.cardByKey.get(tasks[index + 1].key);
    let points;
    if (tasks[index].stageIndex === tasks[index + 1].stageIndex) {
      const routeX = source.left + source.width + 7;
      points = `${source.left + source.width},${source.centerY} ${routeX},${source.centerY} ${routeX},${target.centerY} ${target.left + target.width},${target.centerY}`;
    } else if (tasks[index].roleIndex === tasks[index + 1].roleIndex) {
      points = `${source.left + source.width},${source.centerY} ${target.left},${target.centerY}`;
    } else {
      const midX = (source.left + source.width + target.left) / 2;
      points = `${source.left + source.width},${source.centerY} ${midX},${source.centerY} ${midX},${target.centerY} ${target.left},${target.centerY}`;
    }
    segments.push(`<polyline points="${points}" fill="none" stroke="#78a9df" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-ppt-kind="path" data-ppt-name="handoff-${index + 1}"></polyline>`);
    nodes.push(`<circle cx="${target.left}" cy="${target.centerY}" r="4.5" fill="#ffffff" stroke="#4b86c5" stroke-width="2" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="handoff-target-${index + 1}"></circle>`);
  }
  return `<svg class="handoff-layer" viewBox="0 0 1170 492" aria-hidden="true">${segments.join("")}${nodes.join("")}</svg>`;
}

function stageMarkup(stage, index, _stages, limits) {
  return `<div class="stage-cell">
    ${index > 0 ? `<div class="stage-divider" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="stage-divider-${index + 1}"></div>` : ""}
    <div class="stage-order" data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-name="stage-order-${index + 1}">${String(index + 1).padStart(2, "0")}</div>
    <div class="stage-title" data-slot-id="stage-${index + 1}-title" data-slot-role="label" data-slot-field="stages[${index}].title" data-slot-item-id="${escapeHtml(stage.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${limits.stage}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="stage-${index + 1}-title">${escapeHtml(stage.title)}</div>
  </div>`;
}

function laneMarkup(role, index) {
  return `<div class="lane" data-role-index="${index}">
    <div class="lane-surface" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="lane-${index + 1}-surface"></div>
    <div class="role-label-underlay" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="role-${index + 1}-underlay"></div>
    <div class="role-label" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="role-${index + 1}-label"></div>
    <div class="role-accent" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="role-${index + 1}-accent"></div>
    <div class="role-name" data-slot-id="role-${index + 1}-name" data-slot-role="label" data-slot-field="roles[${index}].name" data-slot-item-id="${escapeHtml(role.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-chars="${LIMITS.role}" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="role-${index + 1}-name">${escapeHtml(role.name)}</div>
  </div>`;
}

function taskMarkup(task, index, g, limits) {
  const frame = g.cardByKey.get(task.key);
  const style = `left:${frame.left}px;top:${frame.top}px;width:${frame.width}px;height:${frame.height}px;`;
  return `<article class="task-card" style="${style}">
    <div class="task-shadow" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="task-${index + 1}-shadow"></div>
    <div class="task-surface" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="task-${index + 1}-surface"></div>
    <div class="task-accent" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="task-${index + 1}-accent"></div>
    ${textFlowMarkup({ id: `task-${index + 1}-content`, field: `tasks[${index}]`, itemId: task.key, title: task.title, body: task.body, className: "task-content", align: "left", names: { title: `task-${index + 1}-title`, body: `task-${index + 1}-body` } })}
  </article>`;
}

export const visualComponent = Object.freeze({
  id: "role-stage-collaboration",
  schemaVersion: 1,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "standard", scope: "per-contiguous-region" }),
  textCapacity: Object.freeze({ stageCharsByCount: Object.freeze({ 3: 8, 4: 7, 5: 6 }), maxRoleChars: LIMITS.role, taskTitleCharsByCount: Object.freeze({ 3: 8, 4: 8, 5: 6 }), taskBodyCharsByState: "2–3 roles:18 (5 stages:14); 4 roles:7" }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const g = geometry(model);
    return `<section class="role-stage-review" data-ppt-root data-stage-count="${model.stages.length}" data-role-count="${model.roles.length}" style="--stage-count:${model.stages.length};--role-count:${model.roles.length};--row-height:${g.rowHeight}px;">
      <div class="corner-label" data-ppt-kind="shape-text" data-ppt-shape="roundRect" data-ppt-name="corner-label">角色 × 阶段</div>
      <div class="stage-band-underlay" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="stage-band-underlay"></div>
      <div class="stage-band" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="stage-band"></div>
      <div class="stage-grid">${model.stages.map((stage, index, stages) => stageMarkup(stage, index, stages, model.limits)).join("")}</div>
      <div class="column-grid">${model.stages.slice(1).map((_, index) => `<div class="column-divider" style="left:${g.gridLeft + (index + 1) * g.columnWidth}px" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="column-divider-${index + 1}"></div>`).join("")}</div>
      <div class="lanes">${model.roles.map(laneMarkup).join("")}</div>
      ${connectorMarkup(model.tasks, g)}
      <div class="tasks">${model.tasks.map((task, index) => taskMarkup(task, index, g, model.limits)).join("")}</div>
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  stages: [
    { key: "discover", title: "需求澄清" },
    { key: "design", title: "方案设计" },
    { key: "deliver", title: "联合执行" },
    { key: "accept", title: "验收复盘" },
    { key: "improve", title: "持续优化" }
  ],
  roles: [
    { key: "business", name: "业务团队" },
    { key: "technology", name: "技术团队" },
    { key: "management", name: "管理团队" },
    { key: "support", name: "支持团队" }
  ],
  tasks: [
    { key: "collect", stageKey: "discover", roleKey: "business", title: "收集真实需求", body: "梳理场景与核心问题" },
    { key: "scope", stageKey: "discover", roleKey: "management", title: "确认目标边界", body: "明确范围与验收标准" },
    { key: "plan", stageKey: "design", roleKey: "technology", title: "形成实施方案", body: "设计路径与关键机制" },
    { key: "review", stageKey: "design", roleKey: "support", title: "评估资源条件", body: "核对预算与支撑能力" },
    { key: "build", stageKey: "deliver", roleKey: "technology", title: "完成方案交付", body: "实现功能并联调验证" },
    { key: "pilot", stageKey: "deliver", roleKey: "business", title: "组织场景试用", body: "反馈问题与使用体验" },
    { key: "acceptance", stageKey: "accept", roleKey: "management", title: "联合验收复盘", body: "确认结果并沉淀经验" },
    { key: "operate", stageKey: "improve", roleKey: "business", title: "持续运营优化", body: "依据数据迭代流程" }
  ]
});

export function resolvePreviewParameters(base, selection) {
  const stageCount = Number(selection?.stageCount);
  const roleCount = Number(selection?.roleCount);
  if (![3, 4, 5].includes(stageCount)) throw new Error("阶段数必须为 3、4 或 5");
  if (![2, 3, 4].includes(roleCount)) throw new Error("角色数必须为 2、3 或 4");
  const result = structuredClone(base);
  result.stages = result.stages.slice(0, stageCount);
  result.roles = result.roles.slice(0, roleCount);
  const stageKeys = new Set(result.stages.map((stage) => stage.key));
  const roleKeys = new Set(result.roles.map((role) => role.key));
  result.tasks = result.tasks.filter((task) => stageKeys.has(task.stageKey) && roleKeys.has(task.roleKey));
  if (roleCount === 4) result.tasks = result.tasks.map((task) => ({ ...task, body: Array.from(task.body).slice(0, 7).join("") }));
  if (result.tasks.length < 3) throw new Error("当前 State 至少需要 3 项任务");
  return result;
}
