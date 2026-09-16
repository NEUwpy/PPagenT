// 视觉阶段的工具：真实构建 + 真实审计。**重依赖都在这里**（PPT 引擎、渲染器、审计器），
// state.mjs 因此保持纯核、可离线测——分层照抄 experiments/penguin-harness-v2 的 grid-project/grid-native 分工。
//
// 边界（写死在这里，防止半年后长成第二个 workflow.mjs）：
//   本文件只做四件事——① 把 state 确定性组装成渲染器要的 pages；② 调既有渲染器；
//   ③ 调既有审计器；④ 把审计结果按页映射回 state。
//   它**不**决定"这页该怎么排"（那是模型在 upsert_page_plan 里的判断），
//   **不**自建字号/几何门禁（一律用 auditRenderedDeck），**不**画任何元素，
//   **不**替模型补内容（正文一律从 state 的 sourceText 回填）。
//
// 已知的桥接层：真实渲染器要的 `pages` 结构在仓库里没有生成器（它原来由 workflow.mjs 自己的
// 解析管线产出）。这个计划里预告过的"已知需新写的两处"之一，就落在这里的 buildDeckPages()。
// 它是**确定性**的：同一份 state 永远组装出同一份 pages，--replay 因此可零模型重编译。

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadCompositionLayouts } from "../../composition/layouts.mjs";
import { validatePageCompositionTextFit, planStructureIssues } from "../../render/page-composition.mjs";
import {
  renderNortheasternUniversityDeck,
  northeasternUniversitySkin,
} from "../../runtime/skins/northeastern-university.mjs";
import { auditRenderedDeck } from "../../tools/audit-rendered-typography.mjs";
import { MINIMUM_READABLE_FONT_SIZE_PT } from "../../runtime/typography-standards.mjs";
import {
  readState, writeText, artifactReusable, recordArtifact, recordRuntimeFailure,
  looksLikeRuntimeFailure, upsertComposition, finishVisual, recordDeckAudit,
} from "../state.mjs";
import { defineTool } from "./index.mjs";

export const COVER_ASSET_ID = "northeastern-university-cover-001";
export const BODY_ASSET_ID = "northeastern-university-body-001";

/** 与 skin 内部的"是否算封面/议程/尾页"判定保持一致（northeastern-university.mjs:254-258）。 */
const HEADER_ASSET_IDS = new Set([
  COVER_ASSET_ID,
  "northeastern-university-agenda-001",
  "northeastern-university-closing-001",
]);

/** 仅文本的整页编排版式。component-* 需要浏览器渲染组件，image-* 需要媒体，本轮一律不碰。 */
const TEXT_ONLY_LAYOUT_PREFIX = "editorial-";

/**
 * read_catalog 给模型看的版式说明。**不是新规则层**：每条都只是把渲染器自己的槽位算术
 * （page-composition.mjs 的 renderEditorial* 系列）用一句话讲出来，让模型知道选哪个版式会得到什么形状。
 */
// 每个版式说清两件事：它长什么样，以及**每个区吃得下几条**。
// 后半句是硬约束：只画一条的区绑多了，多出来的条目会被静默丢掉（不在页面上，也没人报错）。
// 方案结构闸门会拒绝这种方案（`planStructureIssues`），所以这里先说清楚，别让模型白撞一次。
const LAYOUT_NOTES = Object.freeze({
  "editorial-list": "左窄栏一个要点（大标题+正文），右侧一整列条目；适合一个主张带若干并列说明。"
    + "lead 区只放 1 条，body 区可以放多条。",
  "editorial-focus": "左半幅一个主张（最大字号），右侧一列支撑条目；适合先立论再给依据。"
    + "primary 区只放 1 条，support 区可以放多条。",
  "editorial-focus-reverse": "左侧一列支撑条目，右半幅一个主张；节奏与 editorial-focus 相反，用于换气。"
    + "primary 区只放 1 条，support 区可以放多条。",
  "editorial-single-focus": "整页只有一个焦点（首项），其余条目压缩成底部一行小字补充。"
    + "primary 区可以放多条（首项是焦点，其余自动压到底部一行）。",
  "editorial-dual-statement": "左右两个对等声明，各一个大标题+正文；适合两项对照。"
    + "left 与 right **各只放 1 条**——两边一共只画得下两个条目，不要往同一侧塞第二条；"
    + "若还需要辅助依据，可用 editorial-grid：比较对象留在主区，把辅助依据的 ID 写入 bandItemIds。",
  "editorial-grid": "整块区域均分为网格，每格一个标题+正文；适合 2~6 条等权条目。"
    + "body 区可以放多条。",
});

/** 内容语义与本页位置独立：新方案由视觉导演显式选择辅助项。 */
const BAND_NOTE = "role 只描述语义，不决定位置。先根据页面目的判断主体及辅助内容：准则清单里的准则是主区主体，比较页的判断依据可能是辅助。"
  + "在 grid/body、list/body、focus/support 区域，用 bandItemIds 指定本区域进入底部辅助带的内容项；空数组表示全部留在主区。不能把本区全部内容放进辅助带。"
  + "其他区域不支持 bandItemIds 非空；single-focus 自身按首项焦点、其余补充安排。抬头短标签（leadLabel）与条目短标签都必须取自原稿的说法，"
  + "不要用原稿没有的词（如「核心能力」）充当标签。"
  + "同一个区不要在 textSlots 里写两遍，多写的那一遍不会生效。";

const SECTION_NAME_BY_RELATION = Object.freeze({
  none: "观点",
  parallel: "要点",
  comparison: "对比",
  sequence: "流程",
});

function padSlideNumber(index) {
  return `slide-${String(index + 1).padStart(2, "0")}`;
}

/**
 * state → 渲染器要的 pages。**确定性**，无 IO，可离线测。
 *
 * 只出封面 + 正文页，不出议程页与尾页：这两个版式的文案在 state 里没有真源，
 * 硬编一份就是往交付物里编造内容。要补它们必须先有承载其文案的状态字段，那是另一件事。
 */
export function buildDeckPages(state) {
  const cover = {
    meta: { sectionName: "封面" },
    content: { pageId: "cover", title: state.deckBrief.title, items: [] },
    intent: { intentId: "cover" },
    decision: { selectedAssetId: COVER_ASSET_ID },
    // 只给 title：subtitle/presenter/organization/date 在 state 里没有真源，留空好过编造。
    payload: { assetId: COVER_ASSET_ID, parameters: { title: state.deckBrief.title } },
    composition: null,
  };
  const body = state.pages.map((page) => ({
    meta: { sectionName: SECTION_NAME_BY_RELATION[page.relation] ?? "观点" },
    content: {
      pageId: page.pageId,
      title: page.title,
      // 上屏正文优先取模型提炼的 item.text，没写就回退到逐字来源 sourceText——
      // 历史 state 没有 text 字段，回退后它们的蓝图逐字不变（--replay 因此不受影响）。
      // sourceText 不会被顶掉：它仍是保真检查的比对基准，也在 content.md 里作为证据留档。
      items: page.items.map((item) => ({
        id: item.id,
        title: page.composition?.itemLabels?.[item.id] ?? "",
        body: item.text ?? item.sourceText,
        // 层级角色要交给渲染器，否则它无从知道哪条是准则、哪条作用于全程。
        // 逐字照条件展开：历史 state 没有 role，它们的 blueprint 因此一个字节都不变。
        ...(item.role ? { role: item.role } : {}),
      })),
    },
    intent: { intentId: page.pageId },
    decision: { selectedAssetId: BODY_ASSET_ID },
    payload: { assetId: BODY_ASSET_ID, parameters: {} },
    composition: page.composition
      ? {
        compositionId: page.composition.compositionId,
        textSlots: page.composition.textSlots,
        // 条件展开：没给 leadLabel 时连键都不存在，历史 blueprint 因此逐字不变。
        ...(page.composition.leadLabel ? { leadLabel: page.composition.leadLabel } : {}),
      }
      : null,
  }));
  return [cover, ...body];
}

/** 模板与来源说明。模板路径取自 skin 自己的默认值（northeastern-university.mjs:226）。 */
function templatePath(root) {
  return path.join(root, "assets", "主题", "东北大学-001", "runtime-template.pptx");
}

async function renderDeck({ root, pages, outputPptx, qaDir, manuscriptSource }) {
  await renderNortheasternUniversityDeck({
    root,
    pages,
    sourcePptx: templatePath(root),
    outputPptx,
    qaDir,
    manuscriptSource,
    templateSourceKind: "bundled-runtime",
  });
}

/**
 * 构建并审计。**check_pages 与 --replay 共用这一条路径**，否则两条路径会漂移，
 * "--replay 重编译出的就是交付物"这句话就不成立了。
 */
export async function compileDeck({ root, runDir, state }) {
  const pages = buildDeckPages(state);
  const outputPptx = path.join(runDir, "deck.pptx");
  const qaDir = path.join(runDir, "qa");
  await renderDeck({ root, pages, outputPptx, qaDir, manuscriptSource: state.sourcePath });
  // requiredQaSlides 的算法照抄 neu-renderer.mjs:78-84：封面类页不要求 QA 几何契约。
  const requiredQaSlides = pages
    .map((page, index) => (HEADER_ASSET_IDS.has(page.payload.assetId) ? null : padSlideNumber(index)))
    .filter(Boolean);
  const qualityAudit = await auditRenderedDeck(qaDir, {
    minimumFontSize: MINIMUM_READABLE_FONT_SIZE_PT,
    tolerance: 0.5,
    requiredQaSlides,
  });
  // blueprint.json 落的是**实际被构建的那份蓝图**，不是模型的意图——两者不一致时以这份为准。
  await writeText(path.join(runDir, "blueprint.json"), `${JSON.stringify(pages, null, 2)}\n`);
  return { pages, outputPptx, qaDir, qualityAudit };
}

/**
 * 审计违规 → 按页归集。typography 违规无 type 字段（audit-rendered-typography.mjs:93-99），补一个语义 code。
 *
 * 三路审计都要归集。**漏掉断行这一路曾经真出过事**：auditRenderedDeck 把 lineBreaks 计进总状态，
 * 这里却只读 typography 与 geometry，于是断行违规永远变不成逐页 issues → 页面记 passed →
 * finishVisual 放行 → ready/delivered。三路的违规对象同形（都带 slide），归集方式也必须一样。
 */
export function groupViolations(qualityAudit) {
  const bySlide = new Map();
  const push = (slide, issue) => {
    if (!bySlide.has(slide)) bySlide.set(slide, []);
    bySlide.get(slide).push(issue);
  };
  for (const violation of qualityAudit.typography?.violations ?? []) {
    push(violation.slide, { code: "tiny-font", slide: violation.slide, fontSize: violation.fontSize, text: violation.text });
  }
  for (const violation of qualityAudit.geometry?.violations ?? []) {
    push(violation.slide, { code: violation.type ?? "geometry-violation", slide: violation.slide, detail: violation });
  }
  for (const violation of qualityAudit.lineBreaks?.violations ?? []) {
    push(violation.slide, { code: violation.type ?? "line-break-violation", slide: violation.slide, detail: violation });
  }
  return bySlide;
}

/** 逐页归因的列表形式：只用于回报（run.mjs 的 replay 判定），不参与记账。 */
export function violationList(qualityAudit) {
  return [...groupViolations(qualityAudit)].map(([slide, issues]) => ({ slide, issues }));
}

/**
 * 定位"第一个构建失败的前缀"。前缀牌组在语义上合法（封面 + 前 k 页），
 * 而渲染器是按页顺序渲染、遇到问题页即抛出，所以第一个失败的前缀长度就指向第一个问题页。
 * 只在构建已经失败之后才走这里（成功时零成本），二分让代价是 log₂(页数) 次构建。
 */
async function locateFailingPage({ root, pages, manuscriptSource }) {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-attr-"));
  try {
    const buildsOk = async (count) => {
      try {
        await renderDeck({
          root,
          pages: pages.slice(0, count),
          outputPptx: path.join(scratch, "prefix.pptx"),
          qaDir: null,
          manuscriptSource,
        });
        return true;
      } catch {
        return false;
      }
    };
    let low = 1;
    let high = pages.length;
    let culprit = null;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (await buildsOk(mid)) low = mid + 1;
      else { culprit = mid; high = mid - 1; }
    }
    return culprit === null ? null : pages[culprit - 1];
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
}

/** 单页的容量预检。用的是渲染器同文件的 validatePageCompositionTextFit（page-composition.mjs:484）。 */
function precheckFit(deckPage, layouts) {
  if (!deckPage.composition) return [{ code: "missing-composition" }];
  const layout = layouts.get(deckPage.composition.compositionId);
  if (!layout) return [{ code: "unknown-layout", compositionId: deckPage.composition.compositionId }];
  return validatePageCompositionTextFit(
    deckPage.content,
    layout,
    deckPage.composition,
    northeasternUniversitySkin.bodyFrame,
    northeasternUniversitySkin.typographyRoles,
  ).map((issue) => ({ ...issue, code: "composition-text-fit-failed" }));
}

export function buildTools({ root, runDir, committer, statePath }) {
  /** 组装 pages 并把每页的预检结果按 pageId 归好，供后续按页记账。 */
  const planOf = async (state) => {
    const layouts = await loadCompositionLayouts(root);
    const deckPages = buildDeckPages(state);
    const byPageId = new Map(deckPages.filter((page) => page.content.pageId !== "cover").map((page) => [page.content.pageId, page]));
    return { layouts, deckPages, byPageId };
  };

  return [
    defineTool({
      name: "read_catalog",
      description: "读取可用版式与当前页面内容。只列出纯文本版式；每项都给出提炼后的上屏正文（text）与其逐字来源证据（sourceText），你只负责把内容项分配到槽位。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      handler: async () => {
        const state = await committer.read();
        const layouts = await loadCompositionLayouts(root);
        return {
          accepted: true,
          phase: state.phase,
          layouts: [...layouts.values()]
            .filter((layout) => layout.id.startsWith(TEXT_ONLY_LAYOUT_PREFIX))
            .map((layout) => ({
              compositionId: layout.id,
              silhouette: layout.silhouette,
              slots: layout.slots.map((slot) => slot.id),
              note: [LAYOUT_NOTES[layout.id], BAND_NOTE].filter(Boolean).join(" "),
            })),
          pages: state.pages.map((page) => ({
            pageId: page.pageId,
            title: page.title,
            claim: page.claim,
            relation: page.relation,
            compositionRevision: page.compositionRevision ?? 0,
            feedback: state.artifactState[page.pageId]?.feedback ?? null,
            currentPlan: page.composition
              ? { compositionId: page.composition.compositionId, textSlots: page.composition.textSlots, itemLabels: page.composition.itemLabels ?? {} }
              : null,
            items: page.items.map((item) => ({
              id: item.id,
              sourceIds: item.sourceIds,
              // 上屏正文 = 内容阶段提炼的 text（没写则回退逐字来源）。渲染出来的就是它。
              text: item.text ?? item.sourceText,
              // 逐字来源证据：判断"提炼有没有改原意"的唯一依据。不参与排版。
              sourceText: item.sourceText,
              // 内容角色不决定主次或位置；视觉方案通过 bandItemIds 指定辅助项。
              role: item.role ?? "object",
            })),
          })),
          note: "每个内容项必须被某个槽位引用且只引用一次。条目短标签请用原稿里的说法，不要引入原稿没有的信息。",
        };
      },
    }),
    defineTool({
      name: "upsert_page_plan",
      description: "为页面写版式方案：选一个纯文本版式，把该页每个内容项分配到槽位。每次写入消耗一次方案版本。",
      inputSchema: {
        type: "object",
        properties: {
          pages: {
            type: "array", minItems: 1, maxItems: 4,
            items: {
              type: "object",
              properties: {
                pageId: { type: "string" },
                compositionId: { type: "string" },
                textSlots: {
                  type: "array", minItems: 1, maxItems: 4,
                  items: {
                    type: "object",
                    properties: {
                      slotId: { type: "string" },
                      sourceItemIds: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
                      contentMode: { type: "string", enum: ["all", "title", "body"] },
                      bandItemIds: { type: "array", maxItems: 8, uniqueItems: true, items: { type: "string" }, description: "本区域的辅助项 ID；留空表示全部为主区内容。根据页面目的选择，不按 role 自动归类。" },
                    },
                    required: ["slotId", "sourceItemIds"],
                    additionalProperties: false,
                  },
                },
                itemLabels: {
                  type: "array", maxItems: 8,
                  items: {
                    type: "object",
                    properties: {
                      itemId: { type: "string" },
                      label: { type: "string", minLength: 1, maxLength: 16 },
                    },
                    required: ["itemId", "label"],
                    additionalProperties: false,
                  },
                },
                leadLabel: {
                  type: "string", minLength: 1, maxLength: 16,
                  description: "主区上方那行短标签。**必须取自原稿的说法**——缺省时会用兜底文案"
                    + "（list 版式是「关键追问」，focus 版式是「核心能力」），那两个词在多数原稿里没有出处，"
                    + "不要让它们冒充原稿内容。",
                },
              },
              required: ["pageId", "compositionId", "textSlots"],
              additionalProperties: false,
            },
          },
        },
        required: ["pages"],
        additionalProperties: false,
      },
      handler: async ({ pages }) => {
        const current = await committer.read();
        const layouts = await loadCompositionLayouts(root);
        // 先全部校验再写盘：一条不合法就整体拒绝，不落地半套方案。
        const prepared = pages.map((plan) => {
          const page = current.pages.find((candidate) => candidate.pageId === plan.pageId);
          if (!page) throw new Error(`未知页面 ${plan.pageId}`);
          const layout = layouts.get(plan.compositionId);
          if (!layout) throw new Error(`未知版式 ${plan.compositionId}`);
          if (!layout.id.startsWith(TEXT_ONLY_LAYOUT_PREFIX)) {
            throw new Error(`${plan.compositionId} 需要组件或媒体，本阶段只能使用纯文本版式`);
          }
          const itemIds = new Set(page.items.map((item) => item.id));
          const used = [];
          for (const slot of plan.textSlots) {
            if (!layout.slots.some((candidate) => candidate.id === slot.slotId)) {
              throw new Error(`${plan.compositionId} 没有槽位 ${slot.slotId}`);
            }
            for (const itemId of slot.sourceItemIds) {
              if (!itemIds.has(itemId)) throw new Error(`页面 ${plan.pageId} 没有内容项 ${itemId}`);
              if (used.includes(itemId)) throw new Error(`内容项 ${itemId} 被多个槽位引用`);
              used.push(itemId);
            }
          }
          const missing = [...itemIds].filter((itemId) => !used.includes(itemId));
          if (missing.length) throw new Error(`页面 ${plan.pageId} 的内容项 ${missing.join("、")} 未被任何槽位引用`);
          const labels = {};
          for (const entry of plan.itemLabels ?? []) {
            if (!itemIds.has(entry.itemId)) throw new Error(`页面 ${plan.pageId} 没有内容项 ${entry.itemId}`);
            labels[entry.itemId] = entry.label;
          }
          return {
            pageId: plan.pageId,
            composition: {
              compositionId: plan.compositionId,
              textSlots: plan.textSlots.map((slot) => ({
                slotId: slot.slotId,
                sourceItemIds: slot.sourceItemIds,
                contentMode: slot.contentMode ?? "all",
                bandItemIds: slot.bandItemIds ?? [],
              })),
              // 条目短标签属于"这页怎么呈现"，所以跟方案存在一起；渲染器只读 compositionId 与 textSlots。
              itemLabels: labels,
              // 抬头短标签同理。**不给就不写这个键**，保证历史 state 的蓝图逐字不变。
              ...(plan.leadLabel ? { leadLabel: plan.leadLabel } : {}),
            },
          };
        });
        let state = current;
        const written = [];
        for (const { pageId, composition } of prepared) {
          // 校验结果由 check_pages 事后按页记账，这里只负责把方案写下去并消耗一次版本预算。
          const outcome = upsertComposition(state, pageId, composition, { accepted: true });
          state = outcome.state;
          written.push({ pageId, revision: outcome.report.revision });
        }
        await committer.render(state);
        return { accepted: true, pages: written, note: "方案已写入；调用 check_pages 做真实构建检查。" };
      },
    }),
    defineTool({
      name: "check_pages",
      description: "对指定页面做真实构建与审计。会真的渲染 PPTX 并回报真实几何与字号问题；只对改过的页重复检查。",
      inputSchema: {
        type: "object",
        properties: { pageIds: { type: "array", minItems: 1, maxItems: 12, items: { type: "string" } } },
        additionalProperties: false,
      },
      handler: async ({ pageIds }) => {
        const state = await committer.read();
        if (state.phase !== "visual") return { accepted: false, error: `check_pages 只在 visual 阶段可用；当前阶段是 ${state.phase}` };
        const requested = pageIds ?? state.pages.map((page) => page.pageId);
        const unknown = requested.filter((pageId) => !state.pages.some((page) => page.pageId === pageId));
        if (unknown.length) return { accepted: false, error: `未知页面 ${unknown.join("、")}` };

        const { layouts, deckPages, byPageId } = await planOf(state);
        const pending = [];
        const reused = [];
        for (const pageId of requested) {
          const { reusable, revision } = artifactReusable(state, pageId);
          if (reusable) reused.push({ pageId, revision });
          else pending.push(pageId);
        }

        // 方案结构闸门：**在构建之前**判，不靠"渲染出来看少了什么"。
        // 一个区绑多条、或同一个区在方案里写了两遍，渲染器只会画第一条并把其余静默丢掉——
        // 页面上找不到那条，蓝图里却写着它，而 auditRenderedDeck 报 passed（2026-09-13 实跑就是这样丢的）。
        // 这类方案不能进构建：构建出来的是"少了一条"的成品，而不是一个明确的失败。
        const structural = new Map();
        for (const pageId of pending) {
          const deckPage = byPageId.get(pageId);
          const composition = deckPage?.composition;
          structural.set(pageId, composition ? planStructureIssues(composition.compositionId, composition) : []);
        }
        const malformed = pending.filter((pageId) => structural.get(pageId).length);
        if (malformed.length) {
          let next = state;
          for (const pageId of malformed) {
            next = recordArtifact(next, pageId, {
              status: "failed",
              revision: next.pages.find((page) => page.pageId === pageId)?.compositionRevision,
              feedback: { issues: structural.get(pageId).map((issue) => ({ ...issue, code: "build-failed" })), warnings: [] },
            });
          }
          await committer.render(next);
          const first = malformed[0];
          return {
            accepted: false, failedPageId: first, attribution: "plan",
            planIssues: structural.get(first),
            error: structural.get(first).map((issue) => issue.message).join(" "),
            note: "这些页面还没构建就被拦下：方案结构不合法会让渲染器静默丢件。改掉上面说的地方再调 check_pages。",
          };
        }

        // 预检只用于诊断与归因；真正的门禁是下面的真实构建 + auditRenderedDeck，不拿它当闸门。
        const precheck = new Map();
        for (const pageId of pending) {
          const deckPage = byPageId.get(pageId);
          precheck.set(pageId, deckPage ? precheckFit(deckPage, layouts) : [{ code: "unknown-page" }]);
        }

        let compiled = null;
        let failure = null;
        try {
          compiled = await compileDeck({ root, runDir, state });
        } catch (error) {
          failure = error;
        }

        if (failure) {
          if (looksLikeRuntimeFailure(failure.message)) {
            const next = recordRuntimeFailure(state, { message: failure.message });
            await committer.render(next);
            return { accepted: false, runtimeFailure: true, error: failure.message, note: "宿主依赖失败，已停止；模型不得为绕过它而修改内容。" };
          }
          // 归因顺序，从最便宜、最可信到最贵：
          //   ① 渲染器自报的 pageId（组件溢出会带）；
          //   ② 预检唯一失败的那一页——editorial-* 版式的预检帧与渲染器同文件同源，通常直接命中；
          //   ③ 二分定位（前缀构建）——预检沉默或有多个候选时才付这个代价；
          //   ④ 放弃归因，如实说明，不猜。
          let culpritPageId = failure.pageIds?.[0] ?? failure.pageId ?? null;
          let attribution = culpritPageId ? "renderer" : null;
          const precheckFailing = pending.filter((pageId) => precheck.get(pageId)?.length);
          if (!culpritPageId && precheckFailing.length === 1) {
            culpritPageId = precheckFailing[0];
            attribution = "precheck";
          }
          if (!culpritPageId) {
            const located = await locateFailingPage({ root, pages: deckPages, manuscriptSource: state.sourcePath });
            culpritPageId = located?.content.pageId ?? null;
            if (culpritPageId) attribution = "prefix-build";
          }
          const message = failure.message;
          if (culpritPageId === "cover") {
            // 封面字号失败由 Skin 的 fitSkinText 抛出，带 role 与原文，是标题本身装不下。
            return { accepted: false, error: message, deckTitle: { issue: "封面标题或副标题在允许字号档位内排不下", role: failure.role ?? null }, note: "这是整稿标题的问题，改标题需要先走内容修订。" };
          }
          if (culpritPageId) {
            const next = recordArtifact(state, culpritPageId, {
              status: "failed", revision: state.pages.find((page) => page.pageId === culpritPageId)?.compositionRevision,
              feedback: { issues: [{ code: "build-failed", message }], warnings: [] },
            });
            await committer.render(next);
            return { accepted: false, error: message, failedPageId: culpritPageId, attribution, precheck: precheck.get(culpritPageId) ?? [], note: "该页构建失败，请为它换版式或调整槽位分配后重新 check_pages。" };
          }
          return { accepted: false, error: message, note: "构建失败但无法归因到单页；请先为该页换一个版式再试。" };
        }

        const bySlide = groupViolations(compiled.qualityAudit);
        // slide-NN 是 1-based，pages[0] 是封面，所以页序即页码序。
        const slideOfPageId = new Map(compiled.pages.map((page, index) => [page.content.pageId, padSlideNumber(index)]));
        const results = [];
        // 整套结论先落盘：即使本次没有任何待检查的页（全部复用），它也是刚编译出来的这一副的结论。
        let next = recordDeckAudit(state, { status: compiled.qualityAudit.status, qaDir: compiled.qaDir });
        for (const pageId of pending) {
          const slide = slideOfPageId.get(pageId);
          const issues = [...(precheck.get(pageId) ?? []), ...(bySlide.get(slide) ?? [])];
          const revision = next.pages.find((page) => page.pageId === pageId)?.compositionRevision;
          // 预检说放不下、实际却渲染通过——这不是失败，是两个既有模块的帧不一致。作为经验提示交给人看。
          const warnings = (precheck.get(pageId) ?? []).length && compiled.qualityAudit.status === "passed"
            ? [{ code: "composition-fit-precheck-divergence", note: "容量预检判定该页放不下，实际渲染通过；两个既有模块的帧算术不一致，值得看一眼。" }]
            : [];
          next = recordArtifact(next, pageId, {
            status: issues.length ? "failed" : "passed",
            revision,
            feedback: { issues, warnings },
            pptxPath: compiled.outputPptx,
          });
          results.push({ pageId, slide, revision, status: issues.length ? "failed" : "passed", issues, warnings });
        }
        await committer.render(next);
        const pagesPassed = results.every((result) => result.status === "passed");
        const deckPassed = compiled.qualityAudit.status === "passed";
        // 没被上面任何一条结果覆盖的违规：封面（state.pages 里没有它的 pageId）、
        // 以及本次没请求到的页。不单独列出来的话，模型会看到"我请求的页全过了"
        // 却过不了 finish_visual，无从下手。
        const accounted = new Set([
          ...results.map((result) => result.slide),
          ...reused.map((entry) => slideOfPageId.get(entry.pageId)),
        ]);
        const deckOnly = [...bySlide]
          .filter(([slide]) => !accounted.has(slide))
          .map(([slide, issues]) => ({ slide, issues }));
        return {
          accepted: pagesPassed && deckPassed,
          reused,
          pages: results,
          deck: {
            pptx: compiled.outputPptx,
            qaDir: compiled.qaDir,
            qualityAuditStatus: compiled.qualityAudit.status,
            issues: deckOnly,
          },
          note: deckPassed
            ? "审计对象是整副牌组；上面只列出本次请求的页面。全部通过后调用 finish_visual。"
            : "整副牌组未通过质量审计。上面列出的是不属于本次请求页面的违规（例如封面）；先按 deck.issues 修好，再重新 check_pages。",
        };
      },
    }),
    defineTool({
      name: "finish_visual",
      description: "收尾闸门：所有页面都必须是当前版本已通过。经验提示不阻断，但每页都要给出理由。",
      inputSchema: {
        type: "object",
        properties: {
          warningDecisions: {
            type: "array", maxItems: 12,
            items: {
              type: "object",
              properties: {
                pageId: { type: "string" },
                reason: { type: "string", minLength: 1, maxLength: 200 },
              },
              required: ["pageId", "reason"],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
      handler: async ({ warningDecisions }) => {
        const current = await committer.read();
        const outcome = finishVisual(current, warningDecisions ?? []);
        if (outcome.report.accepted) await committer.render(outcome.state);
        return outcome.report;
      },
    }),
    defineTool({
      name: "request_content_revision",
      description: "仅当某页的内容本身无法承载时才用：请求把指定页退回内容阶段重组。整稿只有一次预算。",
      inputSchema: {
        type: "object",
        properties: {
          pageIds: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } },
          reason: { type: "string", minLength: 1, maxLength: 200 },
        },
        required: ["pageIds", "reason"],
        additionalProperties: false,
      },
      handler: async ({ pageIds, reason }) => {
        const current = await committer.read();
        const { requestContentRevision } = await import("../state.mjs");
        const outcome = requestContentRevision(current, { pageIds, reason });
        await committer.render(outcome.state);
        return { accepted: true, phase: outcome.state.phase, feedback: outcome.feedback };
      },
    }),
  ];
}
