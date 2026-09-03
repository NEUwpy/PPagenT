import {
  pageExpressionPrototypeCss,
  renderPageExpressionPrototype,
} from "./page-expression-prototype.mjs";
import { resolveHtmlComponent } from "./html-component-runtime.mjs";
import { markdownTextCss, markdownTextRegionMarkup } from "./markdown-text.mjs";

function text(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function unique(values, limit = 6) {
  return [...new Set(values.map(text).filter(Boolean))].slice(0, limit);
}

function sourceFragments(page, values = []) {
  const fragments = unique([
    ...values,
    page.sourceText,
    ...page.items.flatMap((item) => [item.title, item.body, ...(item.points ?? [])]),
  ]);
  return fragments.length ? fragments : [page.title];
}

function itemMarkdown(item) {
  return [`### ${text(item.title) || "要点"}`, text(item.body)].filter(Boolean).join("\n\n");
}

function blockFromItem(page, item, index) {
  const points = unique(item.points ?? [], 6);
  const blockItems = points.length
    ? points.map((point, pointIndex) => ({
      id: `${item.id || `item-${index + 1}`}-point-${pointIndex + 1}`,
      // A point belongs to the item's heading; promoting every point to H3
      // creates a false hierarchy and forces heading typography into small
      // repeated cells. Keep the parent item as the heading and render its
      // points as body text.
      markdown: point,
      sourceFragments: sourceFragments(page, [point]),
      required: true,
    }))
    : [{
      id: item.id || `item-${index + 1}`,
      markdown: itemMarkdown(item),
      sourceFragments: sourceFragments(page, [item.title, item.body]),
      required: true,
    }];
  const logicId = item.logicIntent?.logicId ?? (points.length > 1
    ? (page.logicIntent?.logicId === "sequence" ? "sequence" : "parallel")
    : page.logicIntent?.logicId ?? "editorial");
  return {
    id: item.id || `block-${index + 1}`,
    role: index === 0 ? "component" : "evidence",
    required: true,
    markdown: `### ${text(item.title) || `内容块 ${index + 1}`}`,
    logicIntent: {
      logicId,
      reason: item.logicIntent?.reason
        ?? (points.length > 1 ? "该节点包含可独立呈现的内部要点" : "沿用本页内容导演确认的逻辑"),
      evidenceFragments: item.logicIntent?.evidenceFragments
        ?? sourceFragments(page, [item.title, ...points]).slice(0, 3),
    },
    items: blockItems,
    sourceFragments: sourceFragments(page, [item.title, item.body, ...points]),
  };
}

function mergeBlocks(page, blocks) {
  // Four first-level blocks still fit the two-level expression contract as a
  // 2x2 system. Merging the last two would turn their child points into one
  // dense half-page grid and destroy the hierarchy (notably 1+3+N pages).
  if (blocks.length <= 4) return blocks;
  const retained = blocks.slice(0, 2);
  const rest = blocks.slice(2);
  retained.push({
    id: "remaining-support",
    role: "evidence",
    required: true,
    markdown: "### 其他支撑",
    logicIntent: {
      logicId: "parallel",
      reason: "其余同级节点合并为一个支撑结构，避免结构嵌套超过两层",
      evidenceFragments: unique(rest.flatMap((block) => block.sourceFragments), 3),
    },
    items: rest.flatMap((block) => block.items).slice(0, 6),
    sourceFragments: unique(rest.flatMap((block) => block.sourceFragments), 6),
  });
  return retained;
}

export function projectFormalPageContentBlocks(page, narrativeJob = "") {
  const blocks = mergeBlocks(page, page.items.map((item, index) => blockFromItem(page, item, index)));
  const lead = text(narrativeJob)
    || text(page.notes)
    || text(page.items[0]?.body)
    || text(page.items[0]?.title)
    || page.title;
  return {
    schemaVersion: "0.1",
    pageId: page.pageId,
    title: page.title,
    coreMessage: {
      // The Skin already owns the page title. The Markdown quote is the
      // audience-facing page thesis and must not repeat the title inside the
      // content frame.
      markdown: lead,
      sourceFragments: sourceFragments(page, [page.title, lead]),
    },
    contentBlocks: blocks,
    blockRelations: blocks.slice(1).map((block) => ({
      from: blocks[0].id,
      to: block.id,
      type: "composes",
    })),
  };
}

function childStructure(block, index, requestedPatterns = new Map()) {
  const logicId = block.logicIntent?.logicId ?? "parallel";
  const requested = requestedPatterns.get(block.id) ?? "auto";
  const safeRequested = block.items.length === 3 ? requested : requested === "support-grid" ? requested : "auto";
  const groupId = safeRequested === "chain"
    ? "prototype-chain-levels"
    : safeRequested === "rail"
      ? "prototype-parallel-scenes"
      : safeRequested === "support-grid"
        ? "prototype-support-grid"
        : block.items.length !== 3
    ? "prototype-support-grid"
    : index === 0 && (logicId === "sequence" || logicId === "hierarchy")
      ? "prototype-chain-levels"
      : "prototype-parallel-scenes";
  return {
    expressionId: `structure-${block.id}`,
    type: "structure",
    regionKey: `block-${index + 1}`,
    contentBindings: [{ contentRef: `blocks.${block.id}`, mode: "full" }],
    structure: {
      logicId,
      structureGroupId: groupId,
      stateHint: `${block.items.length} items`,
      prototype: false,
    },
    children: [],
  };
}

export function buildFormalPageExpressionPlan(pageContentBlocks, blockStructureModes = []) {
  const requestedPatterns = new Map(blockStructureModes.map((choice) => [choice.sourceItemId, choice.pattern]));
  const children = pageContentBlocks.contentBlocks.map((block, index) => childStructure(block, index, requestedPatterns));
  const plan = {
    schemaVersion: "0.1",
    planId: `${pageContentBlocks.pageId}-expression-plan`,
    pageId: pageContentBlocks.pageId,
    compositionId: children.length === 1 ? "claim-support-split" : "lead-system-split",
    expressions: [{
      expressionId: "page-lead",
      type: "text",
      regionKey: "lead",
      contentBindings: [{ contentRef: "coreMessage", mode: "markdown" }],
      text: { rendererId: "markdown-flow", surfaceId: "field" },
      children: [],
    }],
    derivations: [],
  };
  if (children.length === 1) {
    plan.expressions.push({
      ...children[0],
      expressionId: "page-support",
      regionKey: "support",
      structure: { ...children[0].structure, structureGroupId: "prototype-support-grid" },
    });
  } else {
    plan.expressions.push({
      expressionId: "page-system",
      type: "structure",
      regionKey: "main",
      contentBindings: [],
      structure: {
        logicId: "composite",
        structureGroupId: "prototype-multi-structure-system",
        stateHint: `${children.length} child structures`,
        prototype: false,
      },
      children,
    });
  }
  return plan;
}

export function shouldUseFormalPageExpressions(page, visualPage = {}) {
  if (visualPage.expressionStrategy === "registered-structure") return false;
  if (visualPage.expressionStrategy === "text-plus-structure") return true;
  if (visualPage.expressionStrategy === "multi-structure") return true;
  return page.items.length >= 3 || page.items.some((item) => (item.points?.length ?? 0) >= 2);
}

/**
 * Resolve the Markdown thesis as an independent expression strip. This is
 * used by text-plus-structure pages: the selected registered Structure stays
 * intact below it instead of swallowing the page thesis.
 */
export async function resolveFormalPageLeadExpression({
  page,
  narrativeJob,
  targetFrame,
  theme,
  assetDir,
}) {
  const lead = text(narrativeJob)
    || text(page.content?.notes)
    || text(page.content?.items?.[0]?.body)
    || text(page.content?.title);
  const markup = markdownTextRegionMarkup({
    id: `${page.content.pageId}-thesis`,
    field: "deckPlan.pages[].narrativeJob",
    markdown: lead,
    mode: "flow",
    density: "compact",
    className: "ppagent-formal-thesis__markdown",
  });
  const css = `${markdownTextCss()}
    .ppagent-formal-thesis{position:relative;width:${targetFrame.width}px;height:${targetFrame.height}px;overflow:hidden;border-top:1px solid var(--ppagent-color-line,#AFC6E8);border-bottom:1px solid var(--ppagent-color-line,#AFC6E8);background:var(--ppagent-color-background,#fff);font-family:var(--ppagent-font-body,"Microsoft YaHei"),sans-serif}
    .ppagent-formal-thesis__surface{position:absolute;inset:0;background:linear-gradient(90deg,var(--ppagent-color-accent-soft,#DCE9FA),#fff 42%)}
    .ppagent-formal-thesis__accent{position:absolute;left:0;top:0;width:8px;height:100%;background:var(--ppagent-color-accent,#2F5EA8)}
    .ppagent-formal-thesis__label{position:absolute;left:24px;top:0;width:92px;height:100%;display:flex;align-items:center;color:var(--ppagent-color-accent,#2F5EA8);font-size:15pt;font-weight:700;letter-spacing:.08em;white-space:nowrap}
    .ppagent-formal-thesis__markdown{position:absolute;left:118px;right:20px;top:0;height:100%}
    .ppagent-formal-thesis__markdown .ppagent-markdown-layout{height:100%;padding:10px 0;justify-content:center;gap:0}
    .ppagent-formal-thesis__markdown .ppagent-markdown-block--paragraph{margin:0;padding:0;border:0;color:var(--ppagent-color-dark,#2B2B2B);font-size:18pt;font-weight:600;line-height:1.3}
  `;
  const tree = await resolveHtmlComponent({
    component: {
      id: "formal-page-thesis",
      designFrame: { width: targetFrame.width, height: targetFrame.height },
      cssText: css,
      renderMarkup: () => `<section class="ppagent-formal-thesis" data-ppt-root data-page-id="${escapeHtml(page.content.pageId)}">
        <div class="ppagent-formal-thesis__surface" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="PPAGENT_QA|parent=expression-thesis"></div>
        <div class="ppagent-formal-thesis__accent" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="expression-thesis-accent"></div>
        <div class="ppagent-formal-thesis__label" data-ppt-kind="text" data-ppt-name="expression-thesis-label" data-slot-text-mode="single-line">核心判断</div>
        ${markup}
      </section>`,
    },
    parameters: {},
    assetDir,
    targetFrame,
    theme,
  });
  return {
    renderer: "html-component",
    tree,
    targetFrame,
    pageContentBlocks: projectFormalPageContentBlocks(page.content, narrativeJob),
    expressionPlan: {
      schemaVersion: "0.1",
      planId: `${page.content.pageId}-thesis-plan`,
      pageId: page.content.pageId,
      compositionId: "thesis-plus-registered-structure",
      expressions: [{
        expressionId: "page-thesis",
        type: "text",
        regionKey: "thesis",
        contentBindings: [{ contentRef: "coreMessage", mode: "markdown" }],
        text: { rendererId: "markdown-flow", surfaceId: "plain" },
        children: [],
      }],
      derivations: [],
    },
  };
}

export async function resolveFormalPageExpression({
  page,
  narrativeJob,
  targetFrame,
  theme,
  assetDir,
}) {
  const pageContentBlocks = projectFormalPageContentBlocks(page.content, narrativeJob);
  const expressionPlan = buildFormalPageExpressionPlan(pageContentBlocks, page.visual?.blockStructureModes);
  const rendered = renderPageExpressionPrototype(pageContentBlocks, expressionPlan);
  const tree = await resolveHtmlComponent({
    component: {
      id: "formal-page-expression",
      designFrame: { width: 1170, height: 492 },
      cssText: pageExpressionPrototypeCss(),
      renderMarkup: () => rendered.markup,
    },
    parameters: {},
    assetDir,
    targetFrame,
    theme,
  });
  return {
    renderer: "html-component",
    tree,
    targetFrame,
    pageContentBlocks,
    expressionPlan,
    validation: rendered.validation,
  };
}
