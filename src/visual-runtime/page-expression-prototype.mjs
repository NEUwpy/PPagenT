import { markdownTextCss, markdownTextRegionMarkup } from "./markdown-text.mjs";
import {
  resolveContentReference,
  validatePageExpressionPlan,
} from "./page-expression-plan.mjs";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function bindingValue(pageContent, expression) {
  const binding = expression.contentBindings?.[0];
  return binding ? resolveContentReference(pageContent, binding.contentRef) : null;
}

function markdownRegion({ expression, markdown, field, className = "" }) {
  const rendererId = expression.text?.rendererId ?? "markdown-flow";
  return markdownTextRegionMarkup({
    id: expression.expressionId,
    field,
    markdown,
    mode: rendererId === "markdown-zoned" ? "zoned" : "flow",
    zoneTemplate: expression.text?.zoneTemplateId ?? "lead-body",
    density: "compact",
    className,
  });
}

function blockItemRegion(block, item, expression, index, className = "") {
  return markdownTextRegionMarkup({
    id: `${expression.expressionId}-${item.id}`,
    field: `contentBlocks.${block.id}.items.${index}.markdown`,
    itemId: item.id,
    regionId: "content",
    markdown: item.markdown,
    mode: "flow",
    density: "compact",
    className,
  });
}

function renderChain(block, expression, depth) {
  return `<section class="ppe-structure ppe-chain" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="${escapeHtml(expression.expressionId)}-surface" data-expression-id="${escapeHtml(expression.expressionId)}" data-expression-type="structure" data-structure-depth="${depth}">
    ${block.markdown ? markdownTextRegionMarkup({ id: `${expression.expressionId}-heading`, field: `contentBlocks.${block.id}.markdown`, markdown: block.markdown, mode: "flow", density: "compact", className: "ppe-structure-heading" }) : ""}
    <div class="ppe-chain-track" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="${escapeHtml(expression.expressionId)}-track"></div>
    <div class="ppe-chain-items">${block.items.map((item, index) => `<article class="ppe-chain-item" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="${escapeHtml(expression.expressionId)}-item-${index}" data-expression-item="${escapeHtml(item.id)}">
      <div class="ppe-chain-node" data-ppt-kind="shape" data-ppt-shape="ellipse" data-ppt-name="${escapeHtml(expression.expressionId)}-node-${index}"></div>
      ${blockItemRegion(block, item, expression, index, "ppe-chain-item-text")}
    </article>`).join("")}</div>
  </section>`;
}

function renderParallel(block, expression, depth, variant) {
  return `<section class="ppe-structure ppe-parallel ppe-parallel--${escapeHtml(variant)}" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="${escapeHtml(expression.expressionId)}-surface" data-expression-id="${escapeHtml(expression.expressionId)}" data-expression-type="structure" data-structure-depth="${depth}">
    ${block.markdown ? markdownTextRegionMarkup({ id: `${expression.expressionId}-heading`, field: `contentBlocks.${block.id}.markdown`, markdown: block.markdown, mode: "flow", density: "compact", className: "ppe-structure-heading" }) : ""}
    <div class="ppe-parallel-items">${block.items.map((item, index) => `<article class="ppe-parallel-item" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="${escapeHtml(expression.expressionId)}-item-${index}" data-expression-item="${escapeHtml(item.id)}">
      <span class="ppe-item-index" data-ppt-kind="shape-text" data-ppt-shape="ellipse" data-ppt-name="${escapeHtml(expression.expressionId)}-index-${index}">${String(index + 1).padStart(2, "0")}</span>
      ${blockItemRegion(block, item, expression, index, "ppe-parallel-item-text")}
    </article>`).join("")}</div>
  </section>`;
}

function renderSupportGrid(block, expression, depth) {
  return `<section class="ppe-structure ppe-support-grid ppe-support-grid--${Math.min(6, block.items.length)}" data-expression-id="${escapeHtml(expression.expressionId)}" data-expression-type="structure" data-structure-depth="${depth}">
    <div class="ppe-support-grid-items">${block.items.map((item, index) => `<article class="ppe-support-item" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="${escapeHtml(expression.expressionId)}-item-${index}" data-expression-item="${escapeHtml(item.id)}">
      <div class="ppe-support-accent" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="${escapeHtml(expression.expressionId)}-accent-${index}"></div>
      <span class="ppe-support-index" data-ppt-kind="text" data-ppt-name="${escapeHtml(expression.expressionId)}-index-${index}">${String(index + 1).padStart(2, "0")}</span>
      ${blockItemRegion(block, item, expression, index, "ppe-support-item-text")}
    </article>`).join("")}</div>
  </section>`;
}

function renderExpression(pageContent, expression, depth = 0) {
  if (expression.type === "text") {
    const resolved = bindingValue(pageContent, expression);
    const markdown = resolved?.value?.markdown ?? "";
    const surfaceId = expression.text?.surfaceId ?? "plain";
    return `<section class="ppe-expression ppe-expression--text ppe-surface--${escapeHtml(surfaceId)}" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="PPAGENT_QA|parent=expression-lead" data-expression-id="${escapeHtml(expression.expressionId)}" data-expression-type="text" data-region-key="${escapeHtml(expression.regionKey)}" data-surface-id="${escapeHtml(surfaceId)}">
      <div class="ppe-text-accent" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="${escapeHtml(expression.expressionId)}-accent"></div>
      ${markdownRegion({ expression, markdown, field: expression.contentBindings[0].contentRef, className: "ppe-direct-text" })}
    </section>`;
  }
  if (expression.type === "media") {
    return `<section class="ppe-expression ppe-expression--media" data-expression-id="${escapeHtml(expression.expressionId)}" data-expression-type="media" data-region-key="${escapeHtml(expression.regionKey)}">Media 当前未建设</section>`;
  }

  const structureDepth = depth + 1;
  const groupId = expression.structure.structureGroupId;
  const resolved = bindingValue(pageContent, expression);
  const block = resolved?.kind === "block" ? resolved.value : null;
  if (groupId === "prototype-multi-structure-system") {
    return `<section class="ppe-expression ppe-expression--structure ppe-multi-system ppe-multi-system--${expression.children.length}" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="${escapeHtml(expression.expressionId)}-surface" data-expression-id="${escapeHtml(expression.expressionId)}" data-expression-type="structure" data-structure-depth="${structureDepth}" data-region-key="${escapeHtml(expression.regionKey)}">
      ${expression.children.map((child) => `<div class="ppe-multi-system-child" data-expression-child="${escapeHtml(child.expressionId)}">${renderExpression(pageContent, child, structureDepth)}</div>`).join("")}
    </section>`;
  }
  if (groupId === "prototype-1-3-n-system") {
    const children = Object.fromEntries(expression.children.map((child) => [child.regionKey, child]));
    return `<section class="ppe-expression ppe-expression--structure ppe-system" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="${escapeHtml(expression.expressionId)}-surface" data-expression-id="${escapeHtml(expression.expressionId)}" data-expression-type="structure" data-structure-depth="${structureDepth}" data-region-key="${escapeHtml(expression.regionKey)}">
      <div class="ppe-system-axis" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="${escapeHtml(expression.expressionId)}-axis"></div>
      <div class="ppe-system-chain">${renderExpression(pageContent, children.chain, structureDepth)}</div>
      <div class="ppe-system-lower">
        <div class="ppe-system-classes">${renderExpression(pageContent, children.classes, structureDepth)}</div>
        <div class="ppe-system-scenes">${renderExpression(pageContent, children.scenes, structureDepth)}</div>
      </div>
    </section>`;
  }
  if (!block) throw new Error(`${expression.expressionId} 需要一个内容块绑定`);
  if (groupId === "prototype-chain-levels") return renderChain(block, expression, structureDepth);
  if (groupId === "prototype-parallel-classrooms") return renderParallel(block, expression, structureDepth, "cards");
  if (groupId === "prototype-parallel-scenes") return renderParallel(block, expression, structureDepth, "rail");
  if (groupId === "prototype-support-grid") return renderSupportGrid(block, expression, structureDepth);
  throw new Error(`未登记的原型 Structure Group：${groupId}`);
}

export function renderPageExpressionPrototype(pageContent, plan) {
  const validation = validatePageExpressionPlan(pageContent, plan);
  return {
    validation,
    markup: `<article class="ppagent-expression-page ppagent-expression-page--${escapeHtml(plan.compositionId)}" data-ppt-root data-page-id="${escapeHtml(pageContent.pageId)}" data-plan-id="${escapeHtml(plan.planId)}" data-composition-id="${escapeHtml(plan.compositionId)}">
      ${plan.expressions.map((expression) => renderExpression(pageContent, expression)).join("")}
    </article>`,
  };
}

const systemMatrixContent = Object.freeze({
  schemaVersion: "0.1",
  pageId: "prototype-1-3-n",
  title: "“1+3+N”新矩阵",
  coreMessage: {
    markdown: "## 双轮驱动\n\n以**红色基因传承**深化文化内涵，以**实践研学赋能**连接真实教育现场。",
    sourceFragments: ["构建“红色基因传承+实践研学赋能”双轮驱动模式"],
  },
  contentBlocks: [
    {
      id: "chain", role: "component", required: true,
      markdown: "### 1条“六地”红色研学链",
      logicIntent: { logicId: "hierarchy", reason: "研学链内部明确包含校本基地、核心场馆和配套教学点三个层次。", evidenceFragments: ["按“1+6+N”设计路线"] },
      sourceFragments: ["打造1条“六地”红色研学链", "按“1+6+N”设计路线"],
      items: [
        { id: "base", markdown: "### 1\n\n校本基地", sourceFragments: ["1个校本基地（校史馆）"], required: true },
        { id: "venues", markdown: "### 6\n\n核心“六地”场馆", sourceFragments: ["6处核心“六地”场馆"], required: true },
        { id: "points", markdown: "### N\n\n配套教学点", sourceFragments: ["N个配套教学点"], required: true }
      ]
    },
    {
      id: "classes", role: "component", required: true,
      markdown: "### 3类青春课堂",
      logicIntent: { logicId: "parallel", reason: "三类课堂是同级教育形态。", evidenceFragments: ["升级“3”类青春课堂"] },
      sourceFragments: ["红色研学“行走课堂”、VR党课“沉浸课堂”、青春宣讲“互动课堂”"],
      items: [
        { id: "walking", markdown: "### 行走课堂\n\n红色研学", sourceFragments: ["红色研学“行走课堂”"], required: true },
        { id: "immersive", markdown: "### 沉浸课堂\n\nVR党课", sourceFragments: ["VR党课“沉浸课堂”"], required: true },
        { id: "interactive", markdown: "### 互动课堂\n\n青春宣讲", sourceFragments: ["青春宣讲“互动课堂”"], required: true }
      ]
    },
    {
      id: "scenes", role: "component", required: true,
      markdown: "### N个党员教育场景",
      logicIntent: { logicId: "parallel", reason: "校地、校企、校校是同级联建场景。", evidenceFragments: ["校地、校企、校校党建联建场景"] },
      sourceFragments: ["链接“N”个党员教育场景", "校地、校企、校校党建联建场景"],
      items: [
        { id: "local", markdown: "### 校地\n\n联建场景", sourceFragments: ["校地"], required: true },
        { id: "enterprise", markdown: "### 校企\n\n联建场景", sourceFragments: ["校企"], required: true },
        { id: "school", markdown: "### 校校\n\n联建场景", sourceFragments: ["校校党建联建场景"], required: true }
      ]
    }
  ],
  blockRelations: [
    { from: "chain", to: "classes", type: "composes" },
    { from: "classes", to: "scenes", type: "composes" }
  ]
});

const systemMatrixPlan = Object.freeze({
  schemaVersion: "0.1",
  planId: "prototype-1-3-n-plan",
  pageId: "prototype-1-3-n",
  compositionId: "lead-system-split",
  expressions: [
    {
      expressionId: "matrix-lead", type: "text", regionKey: "lead",
      contentBindings: [{ contentRef: "coreMessage", mode: "markdown" }],
      text: { rendererId: "markdown-flow", surfaceId: "field" }, children: []
    },
    {
      expressionId: "matrix-system", type: "structure", regionKey: "main",
      contentBindings: [],
      structure: { logicId: "parallel", structureGroupId: "prototype-1-3-n-system", stateHint: "1+3+N", prototype: true },
      children: [
        {
          expressionId: "matrix-chain", type: "structure", regionKey: "chain",
          contentBindings: [{ contentRef: "blocks.chain", mode: "full" }],
          structure: { logicId: "hierarchy", structureGroupId: "prototype-chain-levels", stateHint: "1+6+N", prototype: true }, children: []
        },
        {
          expressionId: "matrix-classes", type: "structure", regionKey: "classes",
          contentBindings: [{ contentRef: "blocks.classes", mode: "full" }],
          structure: { logicId: "parallel", structureGroupId: "prototype-parallel-classrooms", stateHint: "3", prototype: true }, children: []
        },
        {
          expressionId: "matrix-scenes", type: "structure", regionKey: "scenes",
          contentBindings: [{ contentRef: "blocks.scenes", mode: "full" }],
          structure: { logicId: "parallel", structureGroupId: "prototype-parallel-scenes", stateHint: "N examples=3", prototype: true }, children: []
        }
      ]
    }
  ],
  derivations: []
});

const claimSupportContent = Object.freeze({
  schemaVersion: "0.1",
  pageId: "prototype-claim-support",
  title: "五年成效",
  coreMessage: {
    markdown: "## 从“三高三低”到红色先锋\n\n五年深耕，让理工青年在**信仰、本领、声音与行动**上形成可见改变。",
    sourceFragments: ["经过5年深耕，“三高三低”的“学霸”们，如今有了新标签——红色先锋"],
  },
  contentBlocks: [
    {
      id: "outcomes", role: "evidence", required: true, markdown: "",
      logicIntent: { logicId: "parallel", reason: "四项成效是共同支撑核心结论的同级证据。", evidenceFragments: ["信仰更强", "本领更硬", "声音更响"] },
      sourceFragments: ["信仰更强", "本领更硬", "声音更响", "脚步更稳"],
      items: [
        { id: "faith", markdown: "### 信仰更强\n\n留辽意愿从 **58%** 升至 **87%**", sourceFragments: ["从58%飙到87%"], required: true },
        { id: "skill", markdown: "### 本领更硬\n\n**26份**振兴微课题落地", sourceFragments: ["26份“三摆三写”振兴微课题"], required: true },
        { id: "voice", markdown: "### 声音更响\n\n理论走进社区、课堂与生产一线", sourceFragments: ["飞入社区、飞入课堂、飞入生产一线"], required: true },
        { id: "action", markdown: "### 脚步更稳\n\n选调与重大装备研发比例提升 **40%**", sourceFragments: ["比例提升40%"], required: true }
      ]
    }
  ],
  blockRelations: []
});

const claimSupportPlan = Object.freeze({
  schemaVersion: "0.1",
  planId: "prototype-claim-support-plan",
  pageId: "prototype-claim-support",
  compositionId: "claim-support-split",
  expressions: [
    {
      expressionId: "claim-lead", type: "text", regionKey: "lead",
      contentBindings: [{ contentRef: "coreMessage", mode: "markdown" }],
      text: { rendererId: "markdown-flow", surfaceId: "rule" }, children: []
    },
    {
      expressionId: "claim-evidence", type: "structure", regionKey: "support",
      contentBindings: [{ contentRef: "blocks.outcomes", mode: "items" }],
      structure: { logicId: "parallel", structureGroupId: "prototype-support-grid", stateHint: "4", prototype: true }, children: []
    }
  ],
  derivations: []
});

const PROTOTYPES = Object.freeze([
  { id: "one-three-n", name: "1+3+N 复合系统", description: "页面直接文字 + 一级系统 Structure + 三个二级 Structure；验证多 Logic 不再压成单一并列卡片。", pageContent: systemMatrixContent, plan: systemMatrixPlan },
  { id: "claim-support", name: "核心观点 + 多项支撑", description: "页面直接 Markdown 与并列证据 Structure 同级组合；验证文字不再被迫塞进结构内部。", pageContent: claimSupportContent, plan: claimSupportPlan }
]);

export function listPageExpressionPrototypes() {
  return PROTOTYPES.map((prototype) => {
    const rendered = renderPageExpressionPrototype(prototype.pageContent, prototype.plan);
    return structuredClone({
      ...prototype,
      markup: rendered.markup,
      validation: rendered.validation,
      reviewStatus: "awaiting-user-review",
      nativeGenerated: false,
      formalPipelineConnected: false,
    });
  });
}

export function pageExpressionPrototypeCss() {
  return `${markdownTextCss()}
    .ppagent-expression-page{box-sizing:border-box;position:relative;width:1170px;height:492px;overflow:hidden;background:var(--ppagent-color-background,#fff);font-family:var(--ppagent-font-body,"Microsoft YaHei"),sans-serif;line-height:normal;color:var(--ppagent-color-body,#404040)}
    .ppagent-expression-page *{box-sizing:border-box}
    .ppagent-expression-page--lead-system-split{display:grid;grid-template-columns:265px minmax(0,1fr);gap:18px}
    .ppagent-expression-page--claim-support-split{display:grid;grid-template-columns:365px minmax(0,1fr);gap:22px}
    .ppe-expression{position:relative;min-width:0;min-height:0;overflow:hidden}
    .ppe-expression--text{height:100%;border:1px solid var(--ppagent-color-line,#AFC6E8);background:linear-gradient(180deg,var(--ppagent-color-accent-soft,#DCE9FA),#fff)}
    .ppe-text-accent{position:absolute;left:0;top:0;bottom:0;width:7px;background:var(--ppagent-color-accent,#2F5EA8)}
    .ppe-direct-text{height:100%}
    .ppe-direct-text .ppagent-markdown-layout{padding:34px 28px 28px 32px;justify-content:center}
    .ppe-direct-text .ppagent-markdown-block--paragraph{color:var(--ppagent-color-dark,#2B2B2B);font-size:19pt;font-weight:600;line-height:1.35}
    .ppe-system{display:grid;grid-template-rows:150px minmax(0,1fr);gap:14px;padding:14px;border:1px solid #d8e3f0;background:#f8fafc}
    .ppe-system-axis{position:absolute;left:26px;top:161px;width:calc(100% - 52px);height:3px;background:var(--ppagent-color-accent,#2F5EA8);opacity:.48}
    .ppe-system-chain,.ppe-system-classes,.ppe-system-scenes,.ppe-system-lower{min-width:0;min-height:0}
    .ppe-system-lower{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .ppe-multi-system{display:grid;gap:14px;padding:14px;border:1px solid #d8e3f0;background:#f8fafc}
    .ppe-multi-system--2{grid-template-rows:repeat(2,minmax(0,1fr))}
    .ppe-multi-system--3{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr))}
    .ppe-multi-system--3 .ppe-multi-system-child:first-child{grid-column:1/-1}
    .ppe-multi-system--4{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr))}
    .ppe-multi-system-child{min-width:0;min-height:0;overflow:hidden}
    .ppe-multi-system-child>.ppe-structure{height:100%}
    .ppe-structure{position:relative;width:100%;height:100%;overflow:hidden;border:1px solid #d9e3ef;background:#fff}
    .ppe-structure-heading{position:absolute;left:14px;right:14px;top:8px;height:38px;z-index:2}
    .ppe-structure-heading .ppagent-markdown-layout{padding:0;justify-content:center}
    .ppe-structure-heading .ppagent-markdown-block--heading{font-size:19pt;color:var(--ppagent-color-accent,#2F5EA8)}
    .ppe-chain{padding:48px 18px 12px}
    .ppe-chain-track{position:absolute;left:15%;right:15%;top:92px;height:5px;border-radius:99px;background:var(--ppagent-color-line,#AFC6E8)}
    .ppe-chain-items{position:relative;z-index:1;display:grid;grid-template-columns:repeat(3,1fr);gap:18px;height:100%}
    .ppe-chain-item{position:relative;display:flex;align-items:center;min-width:0;padding:0 10px 0 54px;border:1px solid #d9e4f2;background:#f8fbff}
    .ppe-chain-node{position:absolute;left:15px;top:50%;width:28px;height:28px;margin-top:-14px;border:3px solid var(--ppagent-color-line,#AFC6E8);border-radius:50%;background:var(--ppagent-color-accent,#2F5EA8)}
    .ppe-chain-item-text{width:100%;height:100%}
    .ppe-chain-item-text .ppagent-markdown-layout{padding:4px;justify-content:center;gap:3px}
    .ppe-chain-item-text .ppagent-markdown-block--heading{font-size:21pt;color:var(--ppagent-color-accent,#2F5EA8)}
    .ppe-chain-item-text .ppagent-markdown-block{font-size:15pt;line-height:1.2}
    .ppe-parallel{padding:54px 12px 12px}
    .ppe-parallel-items{display:grid;height:100%;min-height:0;gap:8px}
    .ppe-parallel--cards .ppe-parallel-items{grid-template-columns:repeat(3,1fr)}
    .ppe-parallel--rail .ppe-parallel-items{grid-template-rows:repeat(3,1fr)}
    .ppe-parallel-item{position:relative;min-width:0;min-height:0;overflow:hidden;border:1px solid #dce6f2;background:#f7faff}
    .ppe-parallel--cards .ppe-parallel-item{padding-top:38px;border-top:5px solid var(--ppagent-color-accent,#2F5EA8)}
    .ppe-parallel--rail .ppe-parallel-item{padding-left:38px;border-left:5px solid var(--ppagent-color-accent,#2F5EA8)}
    .ppe-item-index{position:absolute;z-index:2;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--ppagent-color-accent,#2F5EA8);color:#fff;font-size:15pt;font-weight:700}
    .ppe-parallel--cards .ppe-item-index{left:50%;top:7px;margin-left:-14px}
    .ppe-parallel--rail .ppe-item-index{left:6px;top:50%;margin-top:-14px}
    .ppe-parallel-item-text{width:100%;height:100%}
    .ppe-parallel-item-text .ppagent-markdown-layout{padding:8px;justify-content:center;gap:4px;text-align:center}
    .ppe-parallel--rail .ppe-parallel-item-text .ppagent-markdown-layout{padding:0 8px;text-align:left}
    .ppe-parallel-item-text .ppagent-markdown-block--heading{font-size:17pt;color:var(--ppagent-color-dark,#2B2B2B)}
    .ppe-parallel-item-text .ppagent-markdown-block{font-size:15pt;line-height:1.08}
    .ppe-support-grid{border:0;background:transparent}
    .ppe-support-grid-items{display:grid;gap:14px;height:100%}
    .ppe-support-grid--1 .ppe-support-grid-items{grid-template-columns:1fr;grid-template-rows:1fr}
    .ppe-support-grid--2 .ppe-support-grid-items{grid-template-columns:repeat(2,1fr);grid-template-rows:1fr}
    .ppe-support-grid--3 .ppe-support-grid-items,.ppe-support-grid--4 .ppe-support-grid-items{grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(2,1fr)}
    .ppe-support-grid--5 .ppe-support-grid-items,.ppe-support-grid--6 .ppe-support-grid-items{grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr)}
    .ppe-support-item{position:relative;min-width:0;min-height:0;overflow:hidden;padding:20px 18px 14px 24px;border:1px solid #d7e3f0;background:#f8fafc}
    .ppe-support-accent{position:absolute;left:0;top:0;bottom:0;width:7px;background:var(--ppagent-color-accent,#2F5EA8)}
    .ppe-support-index{position:absolute;right:13px;top:10px;color:#9ab2cf;font-size:17pt;font-weight:700}
    .ppe-support-item-text{width:100%;height:100%}
    .ppe-support-item-text .ppagent-markdown-layout{padding:8px 32px 8px 6px;justify-content:center;gap:8px}
    .ppe-support-item-text .ppagent-markdown-block--heading{font-size:19pt;color:var(--ppagent-color-accent,#2F5EA8)}
    .ppe-support-item-text .ppagent-markdown-block{font-size:15pt;line-height:1.08}
  `;
}
