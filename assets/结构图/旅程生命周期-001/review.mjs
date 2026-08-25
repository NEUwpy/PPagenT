import { textRegionMarkup } from "../../../src/visual-runtime/text-layout-library.mjs";

const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });

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
  const firstX = 190;
  const lastX = 1030;
  const firstY = 392;
  const lastY = 82;
  const noteWidth = ({ 3: 252, 4: 222, 5: 190, 6: 164 })[count];
  const noteHeight = ({ 3: 146, 4: 140, 5: 136, 6: 132 })[count];
  const nodes = Array.from({ length: count }, (_, index) => {
    const progress = index / (count - 1);
    const x = firstX + (lastX - firstX) * progress;
    const y = firstY + (lastY - firstY) * progress;
    const side = y > 310 ? "above" : y < 110 ? "below" : y < 180 ? "above" : index % 2 ? "below" : "above";
    const idealTop = side === "above" ? y - noteHeight - 32 : y + 32;
    return {
      x,
      y,
      side,
      note: {
        left: Math.max(12, Math.min(1158 - noteWidth, x - noteWidth / 2)),
        top: Math.max(10, Math.min(482 - noteHeight, idealTop)),
        width: noteWidth,
        height: noteHeight,
      },
    };
  });
  return { nodes, noteWidth, noteHeight };
}

function smoothPath(nodes) {
  const points = [{ x: 160, y: 430 }, ...nodes, { x: 1122, y: 42 }];
  const commands = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const dx = current.x - previous.x;
    commands.push(`C ${(previous.x + dx * 0.44).toFixed(2)} ${previous.y.toFixed(2)}, ${(current.x - dx * 0.44).toFixed(2)} ${current.y.toFixed(2)}, ${current.x.toFixed(2)} ${current.y.toFixed(2)}`);
  }
  return commands.join(" ");
}

function pathMarkup(nodes) {
  const d = smoothPath(nodes);
  return `<svg class="journey-path-layer" viewBox="0 0 1170 492" aria-hidden="true">
    <defs>
      <linearGradient id="journey-line-gradient" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="#9fc3df"></stop>
        <stop offset="0.52" stop-color="#5b91bf"></stop>
        <stop offset="1" stop-color="#2f5ea8"></stop>
      </linearGradient>
    </defs>
    <path d="${d}" class="journey-path-underlay" data-ppt-kind="path" data-ppt-name="journey-rise-underlay"></path>
    <path d="${d}" class="journey-path-main" data-ppt-kind="path" data-ppt-name="journey-rise-main"></path>
    <path d="M 1103 37 L 1127 42 L 1114 63 Z" class="journey-arrow-underlay" data-ppt-kind="path" data-ppt-name="journey-rise-arrow-underlay"></path>
    <path d="M 1105 39 L 1124 42 L 1114 59 Z" class="journey-arrow" data-ppt-kind="path" data-ppt-name="journey-rise-arrow"></path>
  </svg>`;
}

function subjectMarkup(subject, textLayoutBindings) {
  const slotId = "journey-subject-region";
  return `<aside class="journey-subject" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="journey-subject-card">
    <span class="journey-subject-label" data-ppt-kind="text" data-ppt-name="journey-subject-label">旅程对象</span>
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

function connectorMarkup(node, index) {
  const edgeY = node.side === "above" ? node.note.top + node.note.height : node.note.top;
  const startY = Math.min(edgeY, node.y);
  const height = Math.abs(edgeY - node.y);
  return `<div class="journey-note-connector" style="left:${(node.x - 1).toFixed(2)}px;top:${startY.toFixed(2)}px;height:${height.toFixed(2)}px" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="journey-note-connector-${index + 1}"></div>`;
}

function stageMarkup(stage, index, node, textLayoutBindings) {
  const slotId = `${stage.key}-experience-region`;
  return `${connectorMarkup(node, index)}
  <article class="journey-note" data-side="${node.side}" style="left:${node.note.left.toFixed(2)}px;top:${node.note.top.toFixed(2)}px;width:${node.note.width}px;height:${node.note.height}px" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="journey-note-${index + 1}">
    <div class="journey-stage-tag" data-slot-id="journey-stage-${index + 1}-title" data-slot-role="label" data-slot-field="stages[${index}].title" data-slot-item-id="${escapeHtml(stage.key)}" data-slot-content-type="text" data-slot-required="true" data-slot-text-mode="single-line" data-slot-list-policy="none" data-slot-max-lines="1" data-ppt-kind="text" data-ppt-name="journey-stage-${index + 1}-title"><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(stage.title)}</div>
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
  </article>
  <div class="journey-node-halo" style="left:${(node.x - 24).toFixed(2)}px;top:${(node.y - 24).toFixed(2)}px" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="journey-node-halo-${index + 1}"></div>
  <div class="journey-node" style="left:${(node.x - 13).toFixed(2)}px;top:${(node.y - 13).toFixed(2)}px" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="journey-node-${index + 1}"></div>`;
}

export const visualComponent = Object.freeze({
  id: "journey-stage-experience",
  schemaVersion: 2,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textFlow: Object.freeze({ profile: "text-region-layout-library", scope: "per-contiguous-region" }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const g = geometry(model.stages.length);
    return `<section class="journey-review" data-ppt-root data-stage-count="${model.stages.length}">
      <div class="journey-grid" aria-hidden="true"></div>
      ${pathMarkup(g.nodes)}
      ${subjectMarkup(model.subject, model.textLayoutBindings)}
      ${model.stages.map((stage, index) => stageMarkup(stage, index, g.nodes[index], model.textLayoutBindings)).join("")}
      <div class="journey-end-label" data-ppt-kind="text" data-ppt-name="journey-end-label">持续认同</div>
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
