import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

import { extractManuscriptSections } from "../../src/content/manuscript-sections.mjs";
import { sourceBlocksForModel } from "../../src/content/source-blocks.mjs";
import { compileContentDirectorDraft } from "../../src/content/content-director-markdown.mjs";
import { loadDirectorGuidelines } from "../../src/agent/director-guidelines.mjs";
import {
  candidateSetsForVisualDirector,
  normalizeVisualCompositionOutput,
} from "../../src/agent/model-director-provider.mjs";
import {
  compactVisualSkillContext,
  expandVisualSkillRouting,
} from "../../src/agent/visual-skill-router.mjs";
import { resolveVisualPlan } from "../../src/agent/visual-resolution.mjs";
import {
  buildContentDraftFromProject,
  contentProjectStatus,
  createContentProject,
  upsertContentProjectPages,
} from "./content-project.mjs";

const mode = process.argv[process.argv.indexOf("--mode") + 1] ?? "";
const root = path.resolve(process.env.PPAGENT_ROOT ?? process.cwd());
const contextPath = path.resolve(process.env.PPAGENT_HARNESS_CONTEXT ?? "");
const finalPath = path.resolve(process.env.PPAGENT_HARNESS_FINAL ?? "");
const draftPath = path.resolve(process.env.PPAGENT_HARNESS_DRAFT ?? `${finalPath}.draft.json`);

if (!new Set(["content", "visual"]).has(mode)) throw new Error("--mode must be content or visual");
if (!contextPath || !finalPath) throw new Error("PPAGENT_HARNESS_CONTEXT and PPAGENT_HARNESS_FINAL are required");

async function readJson(file) { return JSON.parse(await fs.readFile(file, "utf8")); }
async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
async function optionalJson(file, fallback) {
  try { return await readJson(file); } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}
function result(value) {
  return { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value };
}
function safeError(error) {
  return { name: error?.name ?? "Error", code: error?.code ?? "UNKNOWN", message: error?.message ?? String(error) };
}
function candidateId(candidate) {
  return [
    candidate.familyId,
    candidate.variantId,
    candidate.silhouette,
    ...(candidate.expressionSource?.sourceItemId ? [candidate.expressionSource.sourceItemId] : []),
  ].join("::");
}
let assetIndexPromise;
async function assetPreviewForId(assetId) {
  if (!assetId) return null;
  if (!assetIndexPromise) assetIndexPromise = (async () => {
    const index = new Map();
    for (const category of await fs.readdir(path.join(root, "assets"), { withFileTypes: true })) {
      if (!category.isDirectory() || category.name.startsWith("_")) continue;
      const categoryPath = path.join(root, "assets", category.name);
      for (const asset of await fs.readdir(categoryPath, { withFileTypes: true })) {
        if (!asset.isDirectory() || asset.name.startsWith("_")) continue;
        const assetDir = path.join(categoryPath, asset.name);
        try {
          const manifest = JSON.parse(await fs.readFile(path.join(assetDir, "asset.json"), "utf8"));
          const preview = path.join(assetDir, "example", "slide-01.png");
          await fs.access(preview);
          if (manifest.id) index.set(manifest.id, preview);
        } catch {
          // The asset audit reports malformed or incomplete assets; preview evidence is best effort.
        }
      }
    }
    return index;
  })();
  return (await assetIndexPromise).get(assetId) ?? null;
}

async function registerContentTools(server) {
  server.registerTool("get_manuscript_map", {
    title: "获取稿件地图",
    description: "返回章节、来源块和能力摘要；内容阶段必须先调用。",
    inputSchema: z.object({}),
  }, async () => {
    const context = await readJson(contextPath);
    const [guidelines] = await Promise.all([loadDirectorGuidelines(root)]);
    const sections = extractManuscriptSections(context.rawMarkdown);
    const blocks = sourceBlocksForModel(context.rawMarkdown);
    return result({
      title: blocks[0]?.text ?? "",
      sectionCount: sections.length,
      sourceBlockCount: blocks.length,
      sections: sections.map((section) => ({
        sectionKey: section.sectionKey,
        heading: section.heading,
        markerKind: section.markerKind,
        chars: Array.from(section.sourceText).length,
      })),
      logicSkills: guidelines.logicSkillIndex,
      structureCapabilities: guidelines.structureCapabilities.map((entry) => ({
        logicId: entry.logicId,
        contentShapes: entry.contentShapes.map((shape) => ({
          itemCount: shape.itemCount,
          requiredFields: shape.requiredFields,
          ordered: shape.ordered,
          relationTraits: shape.relationTraits,
        })),
      })),
    });
  });

  server.registerTool("read_manuscript_sections", {
    title: "读取稿件章节",
    description: "按 sectionKey 分批读取原稿，一次最多四节。",
    inputSchema: z.object({ sectionKeys: z.array(z.string()).min(1).max(4) }),
  }, async ({ sectionKeys }) => {
    const context = await readJson(contextPath);
    const sections = extractManuscriptSections(context.rawMarkdown);
    const blocks = sourceBlocksForModel(context.rawMarkdown);
    const wanted = new Set(sectionKeys);
    const found = sections.filter((section) => wanted.has(section.sectionKey)).map((section) => ({
      sectionKey: section.sectionKey,
      heading: section.heading,
      sourceText: section.sourceText,
      sourceBlocks: blocks.filter((block) => section.sourceText.includes(block.text) || block.text.includes(section.heading)),
    }));
    return result({ found, missingSectionKeys: sectionKeys.filter((key) => !found.some((item) => item.sectionKey === key)) });
  });

  server.registerTool("get_content_contract", {
    title: "获取内容契约",
    description: "返回内容导演真正需要的精简编译契约；完整 JSON Schema 留在程序端验证，不把大表灌给模型。",
    inputSchema: z.object({}),
  }, async () => {
    return result({
      requiredTopLevel: ["schemaVersion", "deckMetadata", "contentMarkdown", "pageMetadata"],
      deckMetadataRequired: ["deckId", "title", "communicationJob", "audience", "audienceOutcome", "centralTakeaway", "narrativeArc"],
      pageMetadataRequired: ["logicIntent", "sourceBlockIds"],
      logicIntentRequired: ["logicId", "reason", "evidenceFragments", "confidence"],
      markdownContract: {
        pageBoundary: "每个 H1 是一页；H1 后第一个引用块是页面叙事职责",
        hierarchy: "每页至少一个 H2；H2 是页内同级主节点；段落是正文；列表是节点分点；H3 是节点内小标题",
        metadata: "pageMetadata 与 H1 页序一一对应",
      },
      visibleCopyGuidance: {
        principle: "保留完整论证，但不要把原稿解释全文复制到画面；过长就拆页",
        pageClaim: "一个 H1 只承担一个可复述判断",
        nodeBody: "每个 H2 节点正文一到两句",
        comparison: "明确二元比较只用两个 H2 对象，结论放引用主旨，背景另页",
        structureNodes: "并列、层级、中心辐射等关系页的 H2 直接对应外层节点",
      },
      shellContract: "封面、目录和结束页由 Skin/Shell 自动生成；contentMarkdown 只输出正文页，不要把 deck 标题、目录或感谢页再做成 H1 正文页。",
      compactExample: {
        schemaVersion: "1.0",
        deckMetadata: {
          deckId: "stable-kebab-id",
          title: "整套标题",
          communicationJob: "这套演示要完成什么沟通任务",
          audience: "目标听众",
          audienceOutcome: "听众看完应理解或决定什么",
          centralTakeaway: "整套核心结论",
          narrativeArc: ["问题", "判断", "收束"],
        },
        contentMarkdown: "# 正文页标题\n> 面向听众的本页主旨句\n\n## 主节点\n简短正文。",
        pageMetadata: [{
          logicIntent: {
            logicId: "editorial",
            reason: "原稿是普通观点说明，没有必须依赖拓扑表达的关系",
            evidenceFragments: ["逐字复制的最短原稿片段"],
            confidence: "high",
          },
          sourceBlockIds: ["source-002"],
        }],
      },
    });
  });

  server.registerTool("get_revision_context", {
    title: "获取定向修订上下文",
    description: "仅在 attempt > 1 时调用；返回上一份有效内容稿和候选阶段的具体容量/契约反馈。",
    inputSchema: z.object({}),
  }, async () => {
    const context = await readJson(contextPath);
    if ((context.attempt ?? 1) <= 1) return result({ revision: false, attempt: context.attempt ?? 1 });
    return result({
      revision: true,
      attempt: context.attempt,
      previous: context.previous ? {
        contentDraftMarkdown: context.previous.contentDraftMarkdown ?? null,
        contentMetadata: context.previous.contentMetadata ?? null,
      } : null,
      previousReview: context.previousReview ?? null,
      capacityFeedback: context.capacityFeedback ?? [],
      contractFeedback: context.contractFeedback ?? [],
    });
  });

  const deckMetadataSchema = z.object({
    deckId: z.string().min(1).max(80),
    title: z.string().min(1).max(120),
    communicationJob: z.string().min(1).max(300),
    audience: z.string().min(1).max(240),
    audienceOutcome: z.string().min(1).max(300),
    centralTakeaway: z.string().min(1).max(240),
    narrativeArc: z.array(z.string().min(1).max(40)).min(2).max(8),
  });
  const contentPageSchema = z.object({
    pageKey: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).max(60),
    title: z.string().min(1).max(48),
    claim: z.string().min(1).max(100),
    logicIntent: z.object({
      logicId: z.string().min(1).max(50),
      reason: z.string().min(1).max(220),
      evidenceFragments: z.array(z.string().min(1).max(180)).min(1).max(5),
      confidence: z.enum(["low", "medium", "high"]),
    }),
    sourceBlockIds: z.array(z.string().min(1)).min(1).max(20),
    items: z.array(z.object({
      title: z.string().min(1).max(42),
      body: z.string().max(140).default(""),
      points: z.array(z.string().min(1).max(64)).max(6).default([]),
    })).min(1).max(8),
  });

  server.registerTool("start_content_project", {
    title: "初始化内容项目",
    description: "建立本次 PPT 的持久化内容项目；先定整套沟通任务，再逐页写入。",
    inputSchema: z.object({ deckMetadata: deckMetadataSchema }),
  }, async ({ deckMetadata }) => {
    const project = createContentProject(deckMetadata);
    await writeJson(draftPath, project);
    return result({ accepted: true, ...contentProjectStatus(project) });
  });

  server.registerTool("upsert_content_pages", {
    title: "增量写入内容页",
    description: "一次新增或修改最多四页；pageKey 相同即覆盖，其他页面不重写。",
    inputSchema: z.object({ pages: z.array(contentPageSchema).min(1).max(4) }),
  }, async ({ pages }) => {
    const project = await optionalJson(draftPath, null);
    if (!project?.deckMetadata) return result({ accepted: false, error: "请先调用 start_content_project" });
    const updated = upsertContentProjectPages(project, pages);
    await writeJson(draftPath, updated);
    return result({ accepted: true, savedPageKeys: pages.map((page) => page.pageKey), ...contentProjectStatus(updated) });
  });

  server.registerTool("get_content_project_status", {
    title: "查看内容项目状态",
    description: "查看已写入页序、逻辑、节点数量和可见文字量，不返回全文。",
    inputSchema: z.object({}),
  }, async () => result(contentProjectStatus(await optionalJson(draftPath, null))));

  server.registerTool("validate_content_project", {
    title: "校验并提交内容项目",
    description: "把持久化页面项目编译为正式 DeckPlan / PageContent；失败时只修对应页面。",
    inputSchema: z.object({}),
  }, async () => {
    const context = await readJson(contextPath);
    try {
      const project = await optionalJson(draftPath, null);
      const draft = buildContentDraftFromProject(project);
      const compiled = compileContentDirectorDraft(context.rawMarkdown, draft, { repairMode: true });
      await writeJson(finalPath, compiled);
      return result({ accepted: true, pageCount: compiled.pageContents.length, pages: compiled.pageContents.map((page) => ({
        pageId: page.pageId, title: page.title, logicId: page.logicIntent?.logicId, itemCount: page.items.length,
      })) });
    } catch (error) {
      return result({ accepted: false, error: safeError(error), project: contentProjectStatus(await optionalJson(draftPath, null)) });
    }
  });

  server.registerTool("submit_content_draft", {
    title: "提交内容草稿",
    description: "用 PPagenT 编译器验证并保存 DeckPlan / PageContent。",
    inputSchema: z.object({ draft: z.any() }),
  }, async ({ draft }) => {
    const context = await readJson(contextPath);
    try {
      const compiled = compileContentDirectorDraft(context.rawMarkdown, draft, { repairMode: true });
      await writeJson(finalPath, compiled);
      return result({ accepted: true, pageCount: compiled.pageContents.length, pages: compiled.pageContents.map((page) => ({
        pageId: page.pageId, title: page.title, logicId: page.logicIntent?.logicId, itemCount: page.items.length,
      })) });
    } catch (error) {
      return result({ accepted: false, error: safeError(error) });
    }
  });
}

async function visualState() {
  const input = await readJson(contextPath);
  const candidateSets = candidateSetsForVisualDirector(input.candidateSets, input.previousResolution?.feedback ?? []);
  const compactPages = compactVisualSkillContext(input.pageContents, input.pageIntents, candidateSets)
    .map((page, pageIndex) => ({
      ...page,
      candidates: page.candidates.map((candidate) => {
        const raw = candidateSets[pageIndex]?.candidates.find(
          (item) => candidateId(item) === candidate.candidateId,
        );
        return {
          ...candidate,
          assetId: raw?.assetId ?? null,
          variantId: raw?.variantId ?? null,
          silhouette: raw?.silhouette ?? null,
        };
      }),
    }));
  return { input: { ...input, candidateSets }, compactPages };
}

async function registerVisualTools(server) {
  server.registerTool("get_visual_overview", {
    title: "获取全稿视觉概览",
    description: "返回页序、关系、节点数量、候选摘要和上一轮问题；视觉阶段必须先调用。",
    inputSchema: z.object({}),
  }, async () => {
    const { input, compactPages } = await visualState();
    return result({
      deckTitle: input.deckPlan.title,
      previousFeedback: input.previousResolution?.feedback ?? [],
      pages: compactPages.map((page) => ({
        pageId: page.pageId,
        title: page.title,
        relation: page.relation,
        purposeKey: page.purposeKey,
        itemCount: page.items.length,
        itemPointCounts: page.items.map((item) => item.pointCount),
        items: page.items.map((item) => ({
          id: item.id,
          title: item.title,
          bodyChars: Array.from(item.body ?? "").length,
          pointCount: item.pointCount,
          pointPreviews: (item.points ?? []).map((point) => String(point).slice(0, 28)),
        })),
        candidateCount: page.candidates.length,
        candidates: page.candidates.map((candidate) => ({
          candidateId: candidate.candidateId,
          assetId: candidate.assetId,
          structureGroupId: candidate.structureGroupId,
          selectionMode: candidate.selectionMode,
          readiness: candidate.readiness,
          compositionOptions: candidate.compositionOptions ?? [],
          expressionStrategy: candidate.expressionStrategy ?? null,
        })),
      })),
    });
  });

  server.registerTool("inspect_page_content", {
    title: "检查单页完整内容",
    description: "只展开一个页面的标题、正文节点和原始分点，用于判断版式与结构，不读取全稿。",
    inputSchema: z.object({ pageId: z.string().min(1) }),
  }, async ({ pageId }) => {
    const { input } = await visualState();
    const page = input.pageContents.find((item) => item.pageId === pageId);
    if (!page) return result({ found: false, error: "页面不存在" });
    return result({ found: true, page: {
      pageId: page.pageId,
      title: page.title,
      logicIntent: page.logicIntent,
      items: page.items,
    } });
  });

  server.registerTool("inspect_candidate", {
    title: "检查候选详情",
    description: "只展开指定页面的一个合法候选。",
    inputSchema: z.object({ pageId: z.string().min(1), candidateId: z.string().min(1) }),
  }, async ({ pageId, candidateId: requestedId }) => {
    const { input } = await visualState();
    const set = input.candidateSets.find((item) => item.pageId === pageId);
    const candidate = set?.candidates.find((item) => candidateId(item) === requestedId);
    if (!candidate) return result({ found: false, error: "候选不属于该页面" });
    return result({ found: true, candidate: {
      candidateId: requestedId,
      assetId: candidate.assetId,
      logicId: candidate.logicId,
      structureGroupId: candidate.structureGroupId,
      semanticContract: candidate.semanticContract,
      itemCount: candidate.itemCount,
      readiness: candidate.readiness,
      reasons: candidate.reasons ?? [],
      textRegions: candidate.textRegions ?? [],
      slotCapabilities: candidate.slotCapabilities ?? null,
      contentContract: candidate.contentContract ?? null,
      compositions: candidate.compositions ?? [],
      expressionStrategy: candidate.expressionStrategy ?? null,
      previewPath: await assetPreviewForId(candidate.assetId),
    } });
  });

  server.registerTool("get_visual_project_status", {
    title: "查看视觉项目状态",
    description: "返回已经保存和仍待选择的页面，支持断点续作而无需重新提交全稿。",
    inputSchema: z.object({}),
  }, async () => {
    const { input } = await visualState();
    const routing = await optionalJson(draftPath, { selections: [] });
    const selectedPageIds = (routing.selections ?? []).map((item) => item.pageId);
    const selected = new Set(selectedPageIds);
    return result({
      pageCount: input.pageContents.length,
      selectedPageIds,
      missingPageIds: input.pageContents.map((page) => page.pageId).filter((pageId) => !selected.has(pageId)),
    });
  });

  server.registerTool("read_candidate_preview", {
    title: "读取候选预览",
    description: "读取已登记 Structure 的真实预览；只用于理解构图，不把示例文字当作稿件事实。",
    inputSchema: z.object({ assetId: z.string().min(1) }),
  }, async ({ assetId }) => {
    const file = await assetPreviewForId(assetId);
    if (!file) return result({ found: false, assetId, error: "未找到已登记候选预览" });
    try {
      const data = await fs.readFile(file);
      return { content: [{ type: "image", data: data.toString("base64"), mimeType: "image/png" }, { type: "text", text: JSON.stringify({ assetId, path: file }) }] };
    } catch (error) {
      return result({ found: false, assetId, error: safeError(error) });
    }
  });

  server.registerTool("choose_page_visual", {
    title: "保存单页视觉选择",
    description: "保存一个页面的合法 Skill、Layout 和展示参数。",
    inputSchema: z.object({
      pageId: z.string().min(1),
      candidateId: z.string().min(1),
      centerLabel: z.string().min(2).max(8),
      compositionId: z.string().min(1).optional(),
      pageRole: z.enum(["opening", "orientation", "problem", "explanation", "evidence", "comparison", "process", "decision", "recommendation", "summary", "closing"]).optional(),
      densityTarget: z.enum(["quiet", "balanced", "dense"]).optional(),
      visualWeight: z.enum(["quiet", "normal", "anchor", "peak"]).optional(),
      continuityGroup: z.string().min(1).max(40).optional(),
      contrastBreakBefore: z.boolean().optional(),
      expressionStrategy: z.enum(["registered-structure", "text-plus-structure"]).optional(),
      blockStructureModes: z.array(z.object({
        sourceItemId: z.string().min(1),
        pattern: z.enum(["auto", "chain", "rail", "support-grid"]),
      })).max(16).optional(),
      reason: z.string().max(160).optional(),
      iconQueries: z.array(z.object({ sourceItemId: z.string().min(1), query: z.string().min(1).max(40) })).max(12).optional(),
      textLayoutChoices: z.array(z.object({ regionKey: z.string().min(1), layoutId: z.string().min(1) })).max(16).optional(),
      textSlotAssignments: z.array(z.object({
        slotId: z.string().min(1),
        sourceItemIds: z.array(z.string().min(1)).min(1),
        contentMode: z.enum(["full", "title", "body"]).optional(),
      })).max(8).optional(),
    }),
  }, async (choice) => {
    const { input } = await visualState();
    const set = input.candidateSets.find((item) => item.pageId === choice.pageId);
    const candidate = set?.candidates.find((item) => candidateId(item) === choice.candidateId);
    if (!candidate) return result({ accepted: false, error: "候选不属于该页面" });
    if (choice.compositionId && !(candidate.compositions ?? []).some((item) => item.id === choice.compositionId)) {
      return result({ accepted: false, error: "Composition 不属于该候选", legalCompositionIds: (candidate.compositions ?? []).map((item) => item.id) });
    }
    const draft = await optionalJson(draftPath, { selections: [] });
    const selections = (draft.selections ?? []).filter((item) => item.pageId !== choice.pageId);
    selections.push(choice);
    const order = new Map(input.pageContents.map((page, index) => [page.pageId, index]));
    selections.sort((a, b) => order.get(a.pageId) - order.get(b.pageId));
    await writeJson(draftPath, { selections });
    return result({ accepted: true, savedPageId: choice.pageId, selectedCount: selections.length });
  });

  server.registerTool("validate_visual_plan", {
    title: "验证整套视觉计划",
    description: "用现有视觉路由、解析器和确定性检查验证所有页面。",
    inputSchema: z.object({}),
  }, async () => {
    const { input } = await visualState();
    const routing = await optionalJson(draftPath, { selections: [] });
    const expected = input.pageContents.map((page) => page.pageId);
    const selected = new Set((routing.selections ?? []).map((item) => item.pageId));
    const missingPageIds = expected.filter((pageId) => !selected.has(pageId));
    if (missingPageIds.length) return result({ accepted: false, code: "missing-pages", missingPageIds });
    try {
      const expanded = expandVisualSkillRouting(routing, input);
      const normalized = normalizeVisualCompositionOutput(expanded, input);
      const resolved = await resolveVisualPlan({
        root,
        pageContents: input.pageContents,
        pageIntents: input.pageIntents,
        visualPlan: normalized.visualPlan,
        compositionPlan: normalized.compositionPlan,
        candidateSets: input.candidateSets,
        previousResolution: input.previousResolution,
      });
      await writeJson(finalPath, normalized);
      if (resolved.status !== "accepted") return result({
        accepted: false,
        status: resolved.status,
        feedback: resolved.feedback ?? [],
        pageCount: normalized.visualPlan.pages.length,
        draftSubmittedForOuterOrchestrator: true,
      });
      return result({ accepted: true, pageCount: normalized.visualPlan.pages.length, warnings: resolved.warnings ?? [], routingDiagnostics: expanded.routingDiagnostics ?? [] });
    } catch (error) {
      return result({ accepted: false, error: safeError(error) });
    }
  });
}

const server = new McpServer({ name: `ppagent-penguin-v2-${mode}`, version: "0.2.0" }, { capabilities: { tools: {} } });
if (mode === "content") await registerContentTools(server);
else await registerVisualTools(server);
serveStdio(() => server, { onerror: (error) => process.stderr.write(`[ppagent-penguin-v2] ${error.message}\n`) });
