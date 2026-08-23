const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const LIMITS = Object.freeze({ methodMin: 2, methodMax: 5, problemTitle: 24, problemTitleOnly: 40, problemBody: 36, methodTitle: 10, resultTitle: 24, resultTitleOnly: 40, resultBody: 36 });
const STATE_LAYOUT = Object.freeze({
  2: Object.freeze({ left: 195, width: 870, gap: 34, body: 36 }),
  3: Object.freeze({ left: 145, width: 970, gap: 26, body: 30 }),
  4: Object.freeze({ left: 115, width: 1030, gap: 20, body: 24 }),
  5: Object.freeze({ left: 95, width: 1065, gap: 16, body: 18 }),
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function text(value) { return String(value ?? "").trim(); }
function charCount(value) { return Array.from(String(value ?? "")).length; }
function requiredText(value, limit, field) {
  const result = text(value);
  if (!result || charCount(result) > limit) throw new RangeError(`${field} 必须为 1–${limit} 字`);
  return result;
}
function optionalText(value, limit, field) {
  const result = text(value);
  if (charCount(result) > limit) throw new RangeError(`${field} 不得超过 ${limit} 字`);
  return result;
}

function normalize(parameters) {
  if (!parameters?.problem || !parameters?.result || !Array.isArray(parameters?.methods)) {
    throw new TypeError("问题方法结果需要 problem、methods 和 result");
  }
  const methodCount = parameters.methods.length;
  if (methodCount < LIMITS.methodMin || methodCount > LIMITS.methodMax) throw new RangeError("问题方法结果支持 2–5 项方法");
  const layout = STATE_LAYOUT[methodCount];
  const problemBody = optionalText(parameters.problem.body, LIMITS.problemBody, "problem.body");
  const resultBody = optionalText(parameters.result.body, LIMITS.resultBody, "result.body");
  return {
    methodCount,
    layout,
    problem: {
      title: requiredText(parameters.problem.title, problemBody ? LIMITS.problemTitle : LIMITS.problemTitleOnly, "problem.title"),
      body: problemBody,
    },
    methods: parameters.methods.map((item, index) => ({
      key: text(item?.key) || `method-${index + 1}`,
      title: requiredText(item?.title, LIMITS.methodTitle, `methods[${index}].title`),
      body: requiredText(item?.body, layout.body, `methods[${index}].body`),
    })),
    result: {
      title: requiredText(parameters.result.title, resultBody ? LIMITS.resultTitle : LIMITS.resultTitleOnly, "result.title"),
      body: resultBody,
    },
  };
}

function slotAttributes({ id, role, field, itemId, maxChars, maxLines, required = true }) {
  return `data-slot-id="${id}" data-slot-role="${role}" data-slot-field="${field}" data-slot-item-id="${itemId}" data-slot-content-type="text" data-slot-required="${required}" data-slot-text-mode="flow" data-slot-list-policy="none" data-slot-max-chars="${maxChars}" data-slot-max-lines="${maxLines}"`;
}

function geometryMarkup(model) {
  const cardWidth = (model.layout.width - ((model.methodCount - 1) * model.layout.gap)) / model.methodCount;
  const centers = Array.from({ length: model.methodCount }, (_, index) => model.layout.left + (index * (cardWidth + model.layout.gap)) + (cardWidth / 2));
  const upper = centers.map((x, index) => `<line class="problem-link" x1="${x}" y1="106" x2="${x}" y2="145" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="problem-method-link-${index}"></line><circle class="link-anchor" cx="${x}" cy="126" r="4" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="problem-method-anchor-${index}"></circle>`).join("");
  const lower = centers.map((x, index) => `<line class="method-link" x1="${x}" y1="353" x2="${x}" y2="370" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="method-bus-link-${index}"></line><circle class="link-anchor" cx="${x}" cy="370" r="4" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="method-bus-anchor-${index}"></circle>`).join("");
  const first = centers[0];
  const last = centers.at(-1);
  const middle = (first + last) / 2;
  return `<svg class="proof-geometry" viewBox="0 0 1170 492" aria-hidden="true">${upper}${lower}<line class="proof-bus" x1="${first}" y1="370" x2="${last}" y2="370" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="method-result-bus"></line><line class="result-link" x1="${middle}" y1="370" x2="${middle}" y2="389" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="result-link"></line><path class="result-arrow" d="M ${middle} 389 L ${middle - 7} 380 L ${middle + 7} 380 Z" data-ppt-kind="path" data-ppt-name="result-arrow"></path></svg>`;
}

function phaseRailMarkup(methodCount) {
  return `<aside class="phase-rail" aria-hidden="true"><span class="phase-line" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="phase-line"></span><div class="phase phase-problem"><strong data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-name="phase-problem-count">1</strong><span data-ppt-kind="text" data-ppt-name="phase-problem-label">问题</span></div><div class="phase phase-method"><strong data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-name="phase-method-count">${methodCount}</strong><span data-ppt-kind="text" data-ppt-name="phase-method-label">方法</span></div><div class="phase phase-result"><strong data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-name="phase-result-count">1</strong><span data-ppt-kind="text" data-ppt-name="phase-result-label">结果</span></div></aside>`;
}

function problemMarkup(problem) {
  return `<article class="problem-wrap"><div class="problem-underlay" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="problem-underlay"></div><section class="problem-card" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="problem-card"><span class="problem-label" data-ppt-kind="text" data-ppt-name="problem-label">问题</span><span class="problem-divider" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="problem-divider"></span><div class="problem-copy${problem.body ? "" : " is-title-only"}"><h2 ${slotAttributes({ id: "problem-title", role: "problem-title", field: "problem.title", itemId: "problem", maxChars: problem.body ? LIMITS.problemTitle : LIMITS.problemTitleOnly, maxLines: 2 })} data-ppt-kind="text" data-ppt-name="problem-title">${escapeHtml(problem.title)}</h2>${problem.body ? `<p ${slotAttributes({ id: "problem-body", role: "problem-body", field: "problem.body", itemId: "problem", maxChars: LIMITS.problemBody, maxLines: 2, required: false })} data-ppt-kind="text" data-ppt-name="problem-body">${escapeHtml(problem.body)}</p>` : ""}</div></section></article>`;
}

function methodMarkup(item, index, bodyLimit) {
  const number = String(index + 1).padStart(2, "0");
  return `<article class="method-card" data-key="${escapeHtml(item.key)}" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="method-card-${index}"><span class="method-accent" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="method-accent-${index}"></span><div class="method-meta"><strong data-ppt-kind="shape-text" data-ppt-shape="roundRect" data-ppt-name="method-number-${index}">${number}</strong><h3 ${slotAttributes({ id: `${item.key}-title`, role: "method-title", field: `methods[${index}].title`, itemId: item.key, maxChars: LIMITS.methodTitle, maxLines: 2 })} data-ppt-kind="text" data-ppt-name="method-title-${index}">${escapeHtml(item.title)}</h3></div><p ${slotAttributes({ id: `${item.key}-body`, role: "method-body", field: `methods[${index}].body`, itemId: item.key, maxChars: bodyLimit, maxLines: 3 })} data-ppt-kind="text" data-ppt-name="method-body-${index}">${escapeHtml(item.body)}</p></article>`;
}

function resultMarkup(result) {
  return `<article class="result-wrap"><span class="result-badge" data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-name="result-badge">得到</span><section class="result-card" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="result-card"><div class="result-copy${result.body ? "" : " is-title-only"}"><h2 ${slotAttributes({ id: "result-title", role: "result-title", field: "result.title", itemId: "result", maxChars: result.body ? LIMITS.resultTitle : LIMITS.resultTitleOnly, maxLines: 2 })} data-ppt-kind="text" data-ppt-name="result-title">${escapeHtml(result.title)}</h2>${result.body ? `<p ${slotAttributes({ id: "result-body", role: "result-body", field: "result.body", itemId: "result", maxChars: LIMITS.resultBody, maxLines: 2, required: false })} data-ppt-kind="text" data-ppt-name="result-body">${escapeHtml(result.body)}</p>` : ""}</div></section></article>`;
}

export const problemMethodVisualComponent = Object.freeze({
  id: "problem-method-result-stack",
  schemaVersion: 1,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textCapacity: Object.freeze({ maxProblemTitleChars: LIMITS.problemTitleOnly, maxProblemTitleLines: 2, maxItemTitleChars: LIMITS.methodTitle, maxItemTitleLines: 2, maxItemBodyChars: STATE_LAYOUT[5].body, maxItemBodyLines: 3, maxResultTitleChars: LIMITS.resultTitleOnly, maxResultTitleLines: 2 }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const cardWidth = (model.layout.width - ((model.methodCount - 1) * model.layout.gap)) / model.methodCount;
    return `<section class="problem-method-review" data-ppt-root data-method-count="${model.methodCount}" style="--method-count:${model.methodCount};--method-left:${model.layout.left}px;--method-width:${model.layout.width}px;--method-gap:${model.layout.gap}px;--method-card-width:${cardWidth}px">${geometryMarkup(model)}${phaseRailMarkup(model.methodCount)}${problemMarkup(model.problem)}<section class="method-grid">${model.methods.map((item, index) => methodMarkup(item, index, model.layout.body)).join("")}</section>${resultMarkup(model.result)}</section>`;
  },
});

export const previewParameters = Object.freeze({
  problem: Object.freeze({ title: "复杂工况下模型预测精度不足", body: "现有方法难以同时处理多源数据差异与小样本约束" }),
  methods: Object.freeze([
    Object.freeze({ key: "mechanism", title: "机理建模", body: "建立关键变量间的物理约束" }),
    Object.freeze({ key: "fusion", title: "数据融合", body: "统一处理实验仿真与现场数据" }),
    Object.freeze({ key: "identification", title: "参数辨识", body: "基于小样本更新模型参数" }),
    Object.freeze({ key: "validation", title: "对比验证", body: "与基准方法开展交叉验证" }),
    Object.freeze({ key: "robustness", title: "敏感分析", body: "识别影响预测的关键因素" })
  ]),
  result: Object.freeze({ title: "模型在复杂工况下保持稳定预测能力", body: "验证结果支持所提方法能够提升精度与泛化性" })
});

export function resolvePreviewParameters(base, selection) {
  const methodCount = Number(selection?.methodCount);
  if (!Number.isInteger(methodCount) || methodCount < LIMITS.methodMin || methodCount > LIMITS.methodMax) throw new RangeError("问题方法结果支持 2–5 项方法");
  const problemTextMode = text(selection?.problemTextMode) || "标题+说明";
  const resultTextMode = text(selection?.resultTextMode) || "标题+说明";
  if (!["标题+说明", "仅标题"].includes(problemTextMode)) throw new RangeError("不支持的问题文字模式");
  if (!["标题+说明", "仅标题"].includes(resultTextMode)) throw new RangeError("不支持的结果文字模式");
  const result = structuredClone(base);
  result.methods = result.methods.slice(0, methodCount);
  if (problemTextMode === "仅标题") {
    result.problem.body = "";
    result.problem.title = "复杂工况下多源数据差异与小样本约束共同导致模型预测精度和泛化稳定性不足";
  }
  if (resultTextMode === "仅标题") {
    result.result.body = "";
    result.result.title = "所提方法在复杂工况和小样本条件下保持稳定、准确且可泛化的预测能力并支持实际应用";
  }
  return result;
}
