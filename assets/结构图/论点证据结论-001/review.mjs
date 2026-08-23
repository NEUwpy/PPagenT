const DESIGN_FRAME = Object.freeze({ width: 1170, height: 492 });
const LIMITS = Object.freeze({
  evidenceMin: 2,
  evidenceMax: 5,
  claimTitle: 24,
  claimTitleOnly: 40,
  claimBody: 36,
  evidenceTitle: 10,
  conclusionTitle: 24,
  conclusionTitleOnly: 40,
  conclusionBody: 36,
});
const STATE_LAYOUT = Object.freeze({
  2: Object.freeze({ left: 195, width: 870, gap: 34, body: 36 }),
  3: Object.freeze({ left: 145, width: 970, gap: 26, body: 30 }),
  4: Object.freeze({ left: 115, width: 1030, gap: 20, body: 24 }),
  5: Object.freeze({ left: 95, width: 1065, gap: 16, body: 18 }),
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
  if (!parameters?.claim || !parameters?.conclusion || !Array.isArray(parameters?.evidences)) {
    throw new TypeError("论点证据结论需要 claim、evidences 和 conclusion");
  }
  const evidenceCount = parameters.evidences.length;
  if (evidenceCount < LIMITS.evidenceMin || evidenceCount > LIMITS.evidenceMax) {
    throw new RangeError("论点证据结论支持 2–5 条证据");
  }
  const layout = STATE_LAYOUT[evidenceCount];
  const claimBody = optionalText(parameters.claim.body, LIMITS.claimBody, "claim.body");
  const conclusionBody = optionalText(parameters.conclusion.body, LIMITS.conclusionBody, "conclusion.body");
  return {
    evidenceCount,
    layout,
    claim: {
      title: requiredText(parameters.claim.title, claimBody ? LIMITS.claimTitle : LIMITS.claimTitleOnly, "claim.title"),
      body: claimBody,
    },
    evidences: parameters.evidences.map((item, index) => ({
      key: text(item?.key) || `evidence-${index + 1}`,
      title: requiredText(item?.title, LIMITS.evidenceTitle, `evidences[${index}].title`),
      body: requiredText(item?.body, layout.body, `evidences[${index}].body`),
    })),
    conclusion: {
      title: requiredText(parameters.conclusion.title, conclusionBody ? LIMITS.conclusionTitle : LIMITS.conclusionTitleOnly, "conclusion.title"),
      body: conclusionBody,
    },
  };
}

function slotAttributes({ id, role, field, itemId, maxChars, maxLines, required = true }) {
  return `data-slot-id="${id}" data-slot-role="${role}" data-slot-field="${field}" data-slot-item-id="${itemId}" data-slot-content-type="text" data-slot-required="${required}" data-slot-text-mode="flow" data-slot-list-policy="none" data-slot-max-chars="${maxChars}" data-slot-max-lines="${maxLines}"`;
}

function geometryMarkup(model) {
  const cardWidth = (model.layout.width - ((model.evidenceCount - 1) * model.layout.gap)) / model.evidenceCount;
  const centers = Array.from({ length: model.evidenceCount }, (_, index) => model.layout.left + (index * (cardWidth + model.layout.gap)) + (cardWidth / 2));
  const upper = centers.map((x, index) => `<line class="claim-link" x1="${x}" y1="106" x2="${x}" y2="145" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="claim-evidence-link-${index}"></line><circle class="link-anchor" cx="${x}" cy="126" r="4" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="claim-evidence-anchor-${index}"></circle>`).join("");
  const lower = centers.map((x, index) => `<line class="evidence-link" x1="${x}" y1="353" x2="${x}" y2="370" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="evidence-bus-link-${index}"></line><circle class="link-anchor" cx="${x}" cy="370" r="4" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="evidence-bus-anchor-${index}"></circle>`).join("");
  const first = centers[0];
  const last = centers.at(-1);
  const middle = (first + last) / 2;
  return `<svg class="proof-geometry" viewBox="0 0 1170 492" aria-hidden="true">
    ${upper}
    ${lower}
    <line class="proof-bus" x1="${first}" y1="370" x2="${last}" y2="370" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="evidence-proof-bus"></line>
    <line class="conclusion-link" x1="${middle}" y1="370" x2="${middle}" y2="389" data-ppt-kind="shape" data-ppt-shape="line" data-ppt-name="proof-conclusion-link"></line>
    <path class="conclusion-arrow" d="M ${middle} 389 L ${middle - 7} 380 L ${middle + 7} 380 Z" data-ppt-kind="path" data-ppt-name="proof-conclusion-arrow"></path>
  </svg>`;
}

function phaseRailMarkup(evidenceCount) {
  return `<aside class="phase-rail" aria-hidden="true">
    <span class="phase-line" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="phase-line"></span>
    <div class="phase phase-claim"><strong data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-name="phase-claim-count">1</strong><span data-ppt-kind="text" data-ppt-name="phase-claim-label">论点</span></div>
    <div class="phase phase-evidence"><strong data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-name="phase-evidence-count">${evidenceCount}</strong><span data-ppt-kind="text" data-ppt-name="phase-evidence-label">证据</span></div>
    <div class="phase phase-conclusion"><strong data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-name="phase-conclusion-count">1</strong><span data-ppt-kind="text" data-ppt-name="phase-conclusion-label">结论</span></div>
  </aside>`;
}

function claimMarkup(claim) {
  return `<article class="claim-wrap">
    <div class="claim-underlay" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="claim-underlay"></div>
    <section class="claim-card" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="claim-card">
      <span class="claim-label" data-ppt-kind="text" data-ppt-name="claim-label">论点</span>
      <span class="claim-divider" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="claim-divider"></span>
      <div class="claim-copy${claim.body ? "" : " is-title-only"}">
        <h2 ${slotAttributes({ id: "claim-title", role: "claim-title", field: "claim.title", itemId: "claim", maxChars: claim.body ? LIMITS.claimTitle : LIMITS.claimTitleOnly, maxLines: 2 })} data-ppt-kind="text" data-ppt-name="claim-title">${escapeHtml(claim.title)}</h2>
        ${claim.body ? `<p ${slotAttributes({ id: "claim-body", role: "claim-body", field: "claim.body", itemId: "claim", maxChars: LIMITS.claimBody, maxLines: 2, required: false })} data-ppt-kind="text" data-ppt-name="claim-body">${escapeHtml(claim.body)}</p>` : ""}
      </div>
    </section>
  </article>`;
}

function evidenceMarkup(item, index, bodyLimit) {
  const number = String(index + 1).padStart(2, "0");
  return `<article class="evidence-card" data-key="${escapeHtml(item.key)}" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="evidence-card-${index}">
    <span class="evidence-accent" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="evidence-accent-${index}"></span>
    <div class="evidence-meta">
      <strong data-ppt-kind="shape-text" data-ppt-shape="roundRect" data-ppt-name="evidence-number-${index}">${number}</strong>
      <h3 ${slotAttributes({ id: `${item.key}-title`, role: "evidence-title", field: `evidences[${index}].title`, itemId: item.key, maxChars: LIMITS.evidenceTitle, maxLines: 2 })} data-ppt-kind="text" data-ppt-name="evidence-title-${index}">${escapeHtml(item.title)}</h3>
    </div>
    <p ${slotAttributes({ id: `${item.key}-body`, role: "evidence-body", field: `evidences[${index}].body`, itemId: item.key, maxChars: bodyLimit, maxLines: 3 })} data-ppt-kind="text" data-ppt-name="evidence-body-${index}">${escapeHtml(item.body)}</p>
  </article>`;
}

function conclusionMarkup(conclusion) {
  return `<article class="conclusion-wrap">
    <span class="therefore-badge" data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-name="therefore-badge">因此</span>
    <section class="conclusion-card" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-shadow="shadow-sm" data-ppt-name="conclusion-card">
      <div class="conclusion-copy${conclusion.body ? "" : " is-title-only"}">
        <h2 ${slotAttributes({ id: "conclusion-title", role: "conclusion-title", field: "conclusion.title", itemId: "conclusion", maxChars: conclusion.body ? LIMITS.conclusionTitle : LIMITS.conclusionTitleOnly, maxLines: 2 })} data-ppt-kind="text" data-ppt-name="conclusion-title">${escapeHtml(conclusion.title)}</h2>
        ${conclusion.body ? `<p ${slotAttributes({ id: "conclusion-body", role: "conclusion-body", field: "conclusion.body", itemId: "conclusion", maxChars: LIMITS.conclusionBody, maxLines: 2, required: false })} data-ppt-kind="text" data-ppt-name="conclusion-body">${escapeHtml(conclusion.body)}</p>` : ""}
      </div>
    </section>
  </article>`;
}

export const argumentEvidenceVisualComponent = Object.freeze({
  id: "argument-evidence-proof-stack",
  schemaVersion: 1,
  designFrame: DESIGN_FRAME,
  cssFile: "component.css",
  textCapacity: Object.freeze({
    maxClaimTitleChars: LIMITS.claimTitleOnly,
    maxClaimTitleLines: 2,
    maxItemTitleChars: LIMITS.evidenceTitle,
    maxItemTitleLines: 2,
    maxItemBodyChars: STATE_LAYOUT[5].body,
    maxItemBodyLines: 3,
    maxConclusionTitleChars: LIMITS.conclusionTitleOnly,
    maxConclusionTitleLines: 2,
  }),
  renderMarkup(parameters) {
    const model = normalize(parameters);
    const cardWidth = (model.layout.width - ((model.evidenceCount - 1) * model.layout.gap)) / model.evidenceCount;
    return `<section class="argument-evidence-review" data-ppt-root data-evidence-count="${model.evidenceCount}" style="--evidence-left:${model.layout.left}px;--evidence-width:${model.layout.width}px;--evidence-gap:${model.layout.gap}px;--evidence-card-width:${cardWidth}px">
      ${geometryMarkup(model)}
      ${phaseRailMarkup(model.evidenceCount)}
      ${claimMarkup(model.claim)}
      <section class="evidence-grid">${model.evidences.map((item, index) => evidenceMarkup(item, index, model.layout.body)).join("")}</section>
      ${conclusionMarkup(model.conclusion)}
    </section>`;
  },
});

export const previewParameters = Object.freeze({
  claim: Object.freeze({
    title: "稳定交付来自可验证的能力积累",
    body: "可靠性不是一次生成的偶然结果，而是事先建设并确认的系统能力",
  }),
  evidences: Object.freeze([
    Object.freeze({ key: "task", title: "持续验证", body: "真实稿件持续校准能力边界" }),
    Object.freeze({ key: "runtime", title: "确定选择", body: "按逻辑、数量与容量合法匹配" }),
    Object.freeze({ key: "approval", title: "人工确认", body: "用户审核后才可正式调用" }),
    Object.freeze({ key: "engineering", title: "同源编译", body: "同一布局真源避免实现漂移" }),
    Object.freeze({ key: "cost", title: "计算前移", body: "设计前移，运行只做理解与填参" }),
  ]),
  conclusion: Object.freeze({
    title: "可靠性来自能力、规则与代码的共同作用",
    body: "系统不依赖模型临场发挥，也能稳定生成原生可编辑结果",
  }),
});

export function resolvePreviewParameters(base, selection) {
  const evidenceCount = Number(selection?.evidenceCount);
  if (!Number.isInteger(evidenceCount) || evidenceCount < LIMITS.evidenceMin || evidenceCount > LIMITS.evidenceMax) {
    throw new RangeError("论点证据结论支持 2–5 条证据");
  }
  const claimTextMode = text(selection?.claimTextMode) || "标题+说明";
  const conclusionTextMode = text(selection?.conclusionTextMode) || "标题+说明";
  if (!["标题+说明", "仅标题"].includes(claimTextMode)) throw new RangeError("不支持的论点文字模式");
  if (!["标题+说明", "仅标题"].includes(conclusionTextMode)) throw new RangeError("不支持的结论文字模式");
  const result = structuredClone(base);
  result.evidences = result.evidences.slice(0, evidenceCount);
  if (claimTextMode === "仅标题") {
    result.claim.body = "";
    result.claim.title = "稳定交付来自能力积累、明确规则、可靠工程实现与用户验收的共同保障并实现可持续迭代";
  }
  if (conclusionTextMode === "仅标题") {
    result.conclusion.body = "";
    result.conclusion.title = "系统通过能力、规则、代码与用户验收形成可持续的稳定交付能力并支持持续迭代优化";
  }
  return result;
}
