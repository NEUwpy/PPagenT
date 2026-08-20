const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const LIMITS = Object.freeze({
  pairMin: 2,
  pairMax: 4,
  title: 10,
  body: 22,
  outcomeTitle: 12,
  outcomeHighlight: 12,
  outcomeBody: 22,
});
const ROW_GEOMETRY = Object.freeze({
  2: Object.freeze({ top: 112, height: 118, gap: 32 }),
  3: Object.freeze({ top: 72, height: 104, gap: 18 }),
  4: Object.freeze({ top: 52, height: 88, gap: 12 }),
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function text(value) {
  return String(value ?? "").trim();
}

function charCount(value) {
  return Array.from(String(value ?? "")).length;
}

function requireText(value, limit, field) {
  const result = text(value);
  if (!result || charCount(result) > limit) throw new RangeError(`${field} 必须为 1–${limit} 字`);
  return result;
}

function optionalText(value, limit, field) {
  const result = text(value);
  if (charCount(result) > limit) throw new RangeError(`${field} 不得超过 ${limit} 字`);
  return result;
}

function normalizeParameters(parameters) {
  if (!Array.isArray(parameters?.pairs)) throw new TypeError("问题方案结果需要 pairs");
  const pairCount = parameters.pairs.length;
  if (!Number.isInteger(pairCount) || pairCount < LIMITS.pairMin || pairCount > LIMITS.pairMax) {
    throw new RangeError("问题方案结果支持 2–4 组问题方案");
  }
  const pairs = parameters.pairs.map((pair, index) => ({
    key: text(pair?.key) || `pair-${index + 1}`,
    problem: {
      title: requireText(pair?.problem?.title, LIMITS.title, `pairs[${index}].problem.title`),
      body: optionalText(pair?.problem?.body, LIMITS.body, `pairs[${index}].problem.body`),
    },
    solution: {
      title: requireText(pair?.solution?.title, LIMITS.title, `pairs[${index}].solution.title`),
      body: optionalText(pair?.solution?.body, LIMITS.body, `pairs[${index}].solution.body`),
    },
  }));
  if (!parameters?.outcome) throw new TypeError("问题方案结果需要 outcome");
  const outcome = {
    title: requireText(parameters.outcome.title, LIMITS.outcomeTitle, "outcome.title"),
    highlight: optionalText(parameters.outcome.highlight, LIMITS.outcomeHighlight, "outcome.highlight"),
    body: optionalText(parameters.outcome.body, LIMITS.outcomeBody, "outcome.body"),
  };
  return { pairCount, pairs, outcome };
}

function geometryFor(pairCount) {
  const row = ROW_GEOMETRY[pairCount];
  const centers = Array.from({ length: pairCount }, (_, index) => row.top + (index * (row.height + row.gap)) + (row.height / 2));
  return { ...row, centers };
}

function connectorMarkup(centers) {
  const pairLinks = centers.map((y, index) => `<line class="pair-arrow-line" x1="270" y1="${y}" x2="344" y2="${y}" data-pair="${index}" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="problem-solution-link-${index}"></line>
    <path class="pair-arrow-head" d="M 344 ${y} L 334 ${y - 6} L 334 ${y + 6} Z" data-ppt-kind="path" data-ppt-name="problem-solution-arrow-${index}"></path>
    <line class="solution-result-line" x1="750" y1="${y}" x2="835" y2="${y}" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="solution-outcome-link-${index}"></line>
    <circle class="solution-result-dot" cx="835" cy="${y}" r="5" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="solution-outcome-dot-${index}"></circle>`).join("");
  return `<svg class="flow-geometry" viewBox="0 0 1170 492" aria-hidden="true">
    ${pairLinks}
    <line class="result-bus" x1="835" y1="${centers[0]}" x2="835" y2="${centers.at(-1)}" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="outcome-bus"></line>
    <line class="result-arrow-line" x1="835" y1="246" x2="895" y2="246" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="outcome-link"></line>
    <path class="result-arrow-head" d="M 895 246 L 883 238 L 883 254 Z" data-ppt-kind="path" data-ppt-name="outcome-arrow"></path>
  </svg>`;
}

function slotAttributes({ id, role, field, itemId, maxChars, maxLines, required = true }) {
  return `data-slot-id="${id}" data-slot-role="${role}" data-slot-field="${field}" data-slot-item-id="${itemId}" data-slot-content-type="text" data-slot-required="${required}" data-slot-text-mode="flow" data-slot-list-policy="none" data-slot-max-chars="${maxChars}" data-slot-max-lines="${maxLines}"`;
}

function pairMarkup(pair, index, geometry) {
  const top = geometry.top + (index * (geometry.height + geometry.gap));
  const number = String(index + 1).padStart(2, "0");
  return `<article class="pair-row" data-key="${escapeHtml(pair.key)}" style="top:${top}px;height:${geometry.height}px">
    <section class="problem-card" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="problem-card-${index}">
      <div class="card-heading">
        <span class="problem-tag" data-ppt-kind="text" data-ppt-name="problem-label-${index}">问题 ${number}</span>
        <h3 ${slotAttributes({ id: `${pair.key}-problem-title`, role: "item-title", field: `pairs[${index}].problem.title`, itemId: pair.key, maxChars: LIMITS.title, maxLines: 1 })} data-ppt-kind="text" data-ppt-name="problem-title-${index}">${escapeHtml(pair.problem.title)}</h3>
      </div>
      <p ${slotAttributes({ id: `${pair.key}-problem-body`, role: "item-body", field: `pairs[${index}].problem.body`, itemId: pair.key, maxChars: LIMITS.body, maxLines: 2, required: false })} data-ppt-kind="text" data-ppt-name="problem-body-${index}">${escapeHtml(pair.problem.body)}</p>
    </section>
    <div class="solution-card-underlay" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="solution-card-underlay-${index}"></div>
    <section class="solution-card" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="solution-card-${index}">
      <span class="solution-stripe" aria-hidden="true"></span>
      <div class="card-heading">
        <span class="solution-tag" data-ppt-kind="text" data-ppt-name="solution-label-${index}">方案 ${number}</span>
        <h3 ${slotAttributes({ id: `${pair.key}-solution-title`, role: "solution-title", field: `pairs[${index}].solution.title`, itemId: `${pair.key}-solution`, maxChars: LIMITS.title, maxLines: 1 })} data-ppt-kind="text" data-ppt-name="solution-title-${index}">${escapeHtml(pair.solution.title)}</h3>
      </div>
      <p ${slotAttributes({ id: `${pair.key}-solution-body`, role: "solution-body", field: `pairs[${index}].solution.body`, itemId: `${pair.key}-solution`, maxChars: LIMITS.body, maxLines: 2, required: false })} data-ppt-kind="text" data-ppt-name="solution-body-${index}">${escapeHtml(pair.solution.body)}</p>
    </section>
  </article>`;
}

function outcomeMarkup(outcome) {
  const mode = outcome.highlight && outcome.body ? "full"
    : outcome.highlight ? "highlight"
      : outcome.body ? "conclusion"
        : "title-only";
  return `<article class="outcome-wrap" data-outcome-mode="${mode}">
    <div class="outcome-halo" aria-hidden="true" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="outcome-halo"></div>
    <div class="outcome-ring" aria-hidden="true" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="outcome-ring"></div>
    <section class="outcome-card" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-shadow="shadow-sm" data-ppt-name="outcome-card">
      <span class="outcome-label" data-ppt-kind="text" data-ppt-name="outcome-label">结果</span>
      <h2 ${slotAttributes({ id: "outcome-title", role: "center-title", field: "outcome.title", itemId: "outcome", maxChars: LIMITS.outcomeTitle, maxLines: 2 })} data-ppt-kind="text" data-ppt-name="outcome-title">${escapeHtml(outcome.title)}</h2>
      ${outcome.highlight ? `<strong ${slotAttributes({ id: "outcome-highlight", role: "center-highlight", field: "outcome.highlight", itemId: "outcome", maxChars: LIMITS.outcomeHighlight, maxLines: 2, required: false })} data-ppt-kind="text" data-ppt-name="outcome-highlight">${escapeHtml(outcome.highlight)}</strong>` : ""}
      ${outcome.body ? `<p ${slotAttributes({ id: "outcome-body", role: "center-body", field: "outcome.body", itemId: "outcome", maxChars: LIMITS.outcomeBody, maxLines: 2, required: false })} data-ppt-kind="text" data-ppt-preserve-lines="true" data-ppt-name="outcome-body">${escapeHtml(outcome.body)}</p>` : ""}
    </section>
  </article>`;
}

export const visualComponent = Object.freeze({
  id: "problem-solution-outcome",
  schemaVersion: 1,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textCapacity: Object.freeze({
    maxItemTitleChars: LIMITS.title,
    maxItemTitleLines: 1,
    maxItemBodyChars: LIMITS.body,
    maxItemBodyLines: 2,
    maxCenterChars: LIMITS.outcomeTitle,
    maxCenterLines: 2,
    maxHighlightChars: LIMITS.outcomeHighlight,
    maxHighlightLines: 2,
  }),
  renderMarkup(parameters) {
    const model = normalizeParameters(parameters);
    const geometry = geometryFor(model.pairCount);
    const outcomeMode = model.outcome.highlight && model.outcome.body ? "full"
      : model.outcome.highlight ? "highlight"
        : model.outcome.body ? "conclusion"
          : "title-only";
    return `<section class="problem-solution-review" data-ppt-root data-pair-count="${model.pairCount}" data-outcome-mode="${outcomeMode}">
      ${connectorMarkup(geometry.centers)}
      <div class="pair-layer">${model.pairs.map((pair, index) => pairMarkup(pair, index, geometry)).join("")}</div>
      ${outcomeMarkup(model.outcome)}
    </section>`;
  },
});

export const problemSolutionVisualComponent = visualComponent;

export const previewParameters = Object.freeze({
  pairs: Object.freeze([
    Object.freeze({ key: "handoff", problem: Object.freeze({ title: "交接依赖人工", body: "信息同步慢，责任边界模糊" }), solution: Object.freeze({ title: "统一协同入口", body: "任务、责任人与节点同步可见" }) }),
    Object.freeze({ key: "exception", problem: Object.freeze({ title: "异常发现滞后", body: "依靠事后反馈，定位耗时" }), solution: Object.freeze({ title: "实时监测预警", body: "关键异常自动触发分级提醒" }) }),
    Object.freeze({ key: "standard", problem: Object.freeze({ title: "执行口径不一", body: "不同团队采用不同标准" }), solution: Object.freeze({ title: "固化标准流程", body: "规则模板与验收口径统一" }) }),
    Object.freeze({ key: "feedback", problem: Object.freeze({ title: "改善闭环缓慢", body: "经验分散，复盘难以复用" }), solution: Object.freeze({ title: "建立反馈闭环", body: "问题、措施与复盘持续沉淀" }) }),
  ]),
  outcome: Object.freeze({ title: "协同过程更清晰", highlight: "", body: "异常提前暴露\n交付节奏更稳定" }),
});

export function resolvePreviewParameters(base, selection) {
  const pairCount = Number(selection?.pairCount);
  if (!Number.isInteger(pairCount) || pairCount < LIMITS.pairMin || pairCount > LIMITS.pairMax) {
    throw new RangeError("问题方案结果支持 2–4 组问题方案");
  }
  const result = structuredClone(base);
  result.pairs = result.pairs.slice(0, pairCount);
  const resultMode = text(selection?.resultMode) || "结论型";
  if (resultMode === "标题型") {
    result.outcome = { title: "风险得到前置控制", highlight: "", body: "" };
  } else if (resultMode === "重点型") {
    result.outcome = { title: "客户体验", highlight: "持续改善", body: "响应更及时\n问题闭环更完整" };
  } else if (resultMode === "指标型") {
    result.outcome = { title: "响应周期", highlight: "缩短 40%", body: "关键异常更早暴露" };
  } else if (resultMode !== "结论型") {
    throw new RangeError("结果表达支持标题型、结论型、重点型或指标型");
  }
  return result;
}
