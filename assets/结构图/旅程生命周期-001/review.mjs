import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const PANEL = Object.freeze({ left: 144, top: 202, width: 1002, height: 270 });
const START = Object.freeze({ x: 78, y: 131, radius: 17 });
const NODE_Y = Object.freeze({
  3: Object.freeze([112, 82, 112]),
  4: Object.freeze([116, 82, 82, 116]),
  5: Object.freeze([118, 91, 74, 91, 118]),
  6: Object.freeze([120, 98, 78, 78, 98, 120]),
});

function text(value) { return String(value ?? "").trim(); }

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function normalizeContent(content, index) {
  if (!content || typeof content !== "object") throw new Error(`stages[${index}].content 必须是文字内容对象`);
  const result = structuredClone(content);
  const hasVisible = [result.title, result.heading, result.body, result.text, result.value, result.label, result.emphasis]
    .some((value) => text(value)) || (Array.isArray(result.points) && result.points.some((item) => text(item?.text ?? item)));
  if (!hasVisible) throw new Error(`stages[${index}].content 不能为空`);
  return result;
}

function normalize(parameters) {
  const subject = {
    title: text(parameters?.subject?.title),
    body: text(parameters?.subject?.body),
  };
  if (!subject.title) throw new Error("subject.title 不能为空");
  if (!Array.isArray(parameters?.stages) || parameters.stages.length < 3 || parameters.stages.length > 6) {
    throw new Error("阶段体验旅程支持 3–6 个阶段");
  }
  const stages = parameters.stages.map((stage, index) => ({
    key: text(stage?.key) || `stage-${index + 1}`,
    title: text(stage?.title),
    content: normalizeContent(stage?.content, index),
  }));
  if (stages.some((stage) => !stage.title)) throw new Error("每个阶段都必须有阶段名称");
  return {
    subject,
    stages,
    textLayoutBindings: parameters?.textLayoutBindings && typeof parameters.textLayoutBindings === "object"
      ? { ...parameters.textLayoutBindings }
      : {},
  };
}

function geometry(count) {
  const columnWidth = PANEL.width / count;
  const nodes = NODE_Y[count].map((y, index) => ({
    x: PANEL.left + columnWidth * (index + 0.5),
    y,
  }));
  return { columnWidth, nodes };
}

function smoothPath(nodes) {
  const commands = [`M ${nodes[0].x.toFixed(2)} ${nodes[0].y.toFixed(2)}`];
  for (let index = 1; index < nodes.length; index += 1) {
    const previous = nodes[index - 1];
    const current = nodes[index];
    const dx = current.x - previous.x;
    commands.push(`C ${(previous.x + dx * 0.44).toFixed(2)} ${previous.y.toFixed(2)}, ${(current.x - dx * 0.44).toFixed(2)} ${current.y.toFixed(2)}, ${current.x.toFixed(2)} ${current.y.toFixed(2)}`);
  }
  return commands.join(" ");
}

function pathMarkup(nodes) {
  const d = smoothPath(nodes);
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  const endX = Math.min(1144, last.x + 54);
  const fullPath = `M ${START.x} ${START.y} C ${START.x + 34} ${START.y}, ${first.x - 42} ${first.y}, ${first.x.toFixed(2)} ${first.y.toFixed(2)} ${d.slice(d.indexOf("C"))} L ${(endX - 13).toFixed(2)} ${last.y.toFixed(2)}`;
  return `<svg class="journey-path-layer" viewBox="0 0 1170 492" aria-hidden="true">
    <defs>
      <linearGradient id="journey-line-gradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#78aeef"></stop>
        <stop offset="0.56" stop-color="#4c88e8"></stop>
        <stop offset="1" stop-color="#2f5ea8"></stop>
      </linearGradient>
    </defs>
    <path d="${fullPath}" class="journey-path-underlay" data-ppt-kind="path" data-ppt-name="journey-path-underlay"></path>
    <path d="${fullPath}" class="journey-path-main" data-ppt-kind="path" data-ppt-name="journey-path-main"></path>
    <path d="M ${endX - 14} ${last.y - 10} L ${endX} ${last.y} L ${endX - 14} ${last.y + 10} Z" class="journey-arrow-underlay" data-ppt-kind="path" data-ppt-name="journey-path-arrow-underlay"></path>
    <path d="M ${endX - 13} ${last.y - 8} L ${endX - 1} ${last.y} L ${endX - 13} ${last.y + 8} Z" class="journey-arrow" data-ppt-kind="path" data-ppt-name="journey-path-arrow"></path>
  </svg>`;
}

function subjectMarkup(subject, textLayoutBindings) {
  const slotId = "journey-subject-region";
  return `<aside class="journey-subject">
    <div class="journey-subject-label" data-ppt-kind="text" data-ppt-name="journey-subject-label">旅程对象</div>
    ${textRegionMarkup({
      id: slotId,
      field: "subject",
      itemId: "subject",
      regionId: "subject",
      layoutId: text(textLayoutBindings?.[slotId]) || "heading-content-flow",
      compatibleLayoutIds: ["heading-content-flow", "statement-flow"],
      content: subject,
      className: "journey-subject-content",
      align: "left",
      valign: "middle",
      density: "compact",
      required: true,
      names: { heading: "journey-subject-title", body: "journey-subject-body" },
    })}
  </aside>`;
}

function stageMarkup(stage, index, g, textLayoutBindings) {
  const node = g.nodes[index];
  const columnLeft = PANEL.left + index * g.columnWidth;
  const slotId = `${stage.key}-experience-region`;
  const stageLabelTop = node.y < 90 ? node.y + 31 : node.y - 59;
  return `<div class="journey-column" style="left:${columnLeft}px;width:${g.columnWidth}px" data-stage-index="${index}">
    ${index > 0 ? `<div class="journey-divider" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="journey-divider-${index + 1}"></div>` : ""}
    <div class="journey-column-accent" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="journey-stage-accent-${index + 1}"></div>
    ${textRegionMarkup({
      id: slotId,
      field: `stages[${index}].content`,
      itemId: stage.key,
      regionId: "experience",
      layoutId: text(textLayoutBindings?.[slotId]) || "heading-content-flow",
      compatibleLayoutIds: ["heading-content-flow", "statement-flow", "structured-list-flow", "metric-content-flow"],
      content: stage.content,
      className: "journey-stage-content",
      align: "left",
      valign: "top",
      density: "compact",
      required: true,
      names: { heading: `journey-stage-${index + 1}-heading`, body: `journey-stage-${index + 1}-body`, list: `journey-stage-${index + 1}-point` },
    })}
  </div>
  <div class="journey-node-connector" style="left:${node.x - 1}px;top:${node.y + 18}px;height:${PANEL.top - node.y - 18}px" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="journey-node-connector-${index + 1}"></div>
  <div class="journey-node-halo" style="left:${node.x - 25}px;top:${node.y - 25}px" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="journey-node-halo-${index + 1}"></div>
  <div class="journey-node" style="left:${node.x - 17}px;top:${node.y - 17}px" data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="journey-node-${index + 1}">${String(index + 1).padStart(2, "0")}</div>
  <div class="journey-stage-label" style="left:${node.x - Math.min(72, g.columnWidth / 2 - 7)}px;top:${stageLabelTop}px;width:${Math.min(144, g.columnWidth - 14)}px" data-slot-id="journey-stage-${index + 1}-title" data-slot-role="label" data-slot-field="stages[${index}].title" data-slot-item-id="${escapeHtml(stage.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="journey-stage-${index + 1}-title">${escapeHtml(stage.title)}</div>`;
}

export const visualComponent = Object.freeze({
  id: "journey-stage-experience",
  schemaVersion: 1,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const g = geometry(model.stages.length);
    return `<section class="journey-review" data-ppt-root data-stage-count="${model.stages.length}" style="--stage-count:${model.stages.length};--column-width:${g.columnWidth}px">
      <div class="journey-canvas-underlay" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="journey-canvas-underlay"></div>
      <div class="journey-canvas" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="journey-canvas"></div>
      <div class="journey-canvas-label" data-ppt-kind="text" data-ppt-name="journey-canvas-label">阶段体验</div>
      ${subjectMarkup(model.subject, model.textLayoutBindings)}
      ${pathMarkup(g.nodes)}
      <div class="journey-start-connector" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="journey-start-connector"></div>
      <div class="journey-start-halo" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="journey-start-halo"></div>
      <div class="journey-start-node" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="journey-start-node"></div>
      ${model.stages.map((stage, index) => stageMarkup(stage, index, g, model.textLayoutBindings)).join("")}
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  subject: Object.freeze({ title: "目标用户", body: "从首次接触到持续认同" }),
  stages: Object.freeze([
    Object.freeze({ key: "discover", title: "发现", content: Object.freeze({ title: "产生关注", body: "在真实场景中第一次接触并形成基础认知" }) }),
    Object.freeze({ key: "consider", title: "考虑", content: Object.freeze({ title: "主动了解", body: "比较信息、判断价值并逐步建立信任" }) }),
    Object.freeze({ key: "act", title: "行动", content: Object.freeze({ title: "完成选择", body: "在关键触点获得支持并转化为实际行动" }) }),
    Object.freeze({ key: "experience", title: "体验", content: Object.freeze({ title: "验证价值", body: "通过持续使用感知效果并形成稳定评价" }) }),
    Object.freeze({ key: "retain", title: "留存", content: Object.freeze({ title: "形成习惯", body: "在连续服务中提高活跃度与长期黏性" }) }),
    Object.freeze({ key: "advocate", title: "认同", content: Object.freeze({ title: "主动传播", body: "由忠实使用者转变为口碑推荐者" }) })
  ]),
});

export function resolvePreviewParameters(base, selection) {
  const stageCount = Number(selection?.stageCount ?? 4);
  if (![3, 4, 5, 6].includes(stageCount)) throw new Error("旅程阶段数必须为 3、4、5 或 6");
  const result = structuredClone(base);
  result.stages = result.stages.slice(0, stageCount);
  return result;
}
