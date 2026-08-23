import {
  applyStructuralHints,
  assertStructuralCueCompliance,
  buildStructuralCueGuides,
  readStructuralCues,
} from "./structural-cue-reader.mjs";
import { refinementOutputSchema } from "./semantic-refinement.mjs";
import {
  compactVisualSkillContext,
  expandVisualSkillRouting,
  visualSkillRoutingSchema,
} from "./visual-skill-router.mjs";

function assertModel(model, label) {
  if (!model || typeof model.generateJson !== "function") {
    throw new Error(`${label} 必须提供 generateJson({role, task, context})`);
  }
  return model;
}

function sourceRule(rawMarkdown) {
  return {
    source: rawMarkdown,
    rules: [
      "只能使用 source 中可核对的信息",
      "不得把资产、坐标、familyId 或 variantId 写进 PageContent",
      "每个 PageContent.sourceText 必须直接复制 source 中一个非空、连续的原文子串，包含原有 Markdown 标记、标点和空格；不得摘要、改写、去掉标题井号或拼接不连续片段",
    ],
  };
}

function assertSchemas(schemas) {
  const required = ["contentDirector", "contentReview", "visualIntent", "visualComposition", "visualReview"];
  const missing = required.filter((key) => !schemas?.[key]);
  if (missing.length) throw new Error(`DirectorProvider 缺少输出 schema：${missing.join(", ")}`);
  return schemas;
}

function visualIntentSchemaWithPurposeVocabulary(outputSchema, vocabulary = []) {
  const shellPurposeKeys = new Set(["present_cover", "present_agenda", "present_closing"]);
  const keys = vocabulary.map((item) => item.key).filter((key) => key && !shellPurposeKeys.has(key));
  const purposeKeySchema = outputSchema?.schema?.properties?.pageIntents?.items?.properties?.purposeKey;
  if (!keys.length || !purposeKeySchema) return outputSchema;
  const specialized = structuredClone(outputSchema);
  specialized.schema.properties.pageIntents.items.properties.purposeKey.enum = keys;
  return specialized;
}

export function enforceStructuralIntentRelations(intentOutput, pageContents) {
  const output = structuredClone(intentOutput);
  output.pageIntents = output.pageIntents.map((intent, index) => {
    if (pageContents[index]?.structuredData?.type === "matrix") {
      return {
        ...intent,
        baseRelation: "matrix",
        purposeKey: "organize_matrix",
        relationTraits: { ...(intent.relationTraits ?? {}), dimensions: 2 },
        structure: { ...intent.structure, ordered: false, sameLevel: true },
      };
    }
    if (pageContents[index]?.structuredData?.type === "problem-solution") {
      return {
        ...intent,
        baseRelation: "composite",
        purposeKey: "connect_problems_and_solutions",
        relationTraits: { ...(intent.relationTraits ?? {}), temporal: false, converging: true },
        structure: { ...intent.structure, ordered: false },
      };
    }
    const match = String(pageContents[index]?.notes ?? "").match(/PPagenT主关系=(none|parallel|sequence|comparison|hierarchy|cycle|causal|convergence|hub|layered|progression)/);
    if (!match) return intent;
    const relation = match[1];
    const purposeByRelation = {
      parallel: "present_parallel_points",
      sequence: "explain_process",
      comparison: "compare_options",
      hub: "explain_topics",
      layered: "explain_layers",
      progression: "explain_evolution",
    };
    const relationTraits = { ...(intent.relationTraits ?? {}) };
    if (new Set(["parallel", "comparison"]).has(relation)) {
      relationTraits.temporal = false;
    }
    if (relation === "sequence") {
      const source = String(pageContents[index]?.sourceText ?? "");
      relationTraits.temporal = /(?:\d{4}\s*年|第[一二三四五六七八九十\d]+阶段|时间轴|里程碑|路线图|历史|演进|年度|季度|月份|未来\s*\d+)/.test(source);
    }
    return {
      ...intent,
      baseRelation: relation,
      ...(purposeByRelation[relation] ? { purposeKey: purposeByRelation[relation] } : {}),
      relationTraits,
      structure: {
        ...intent.structure,
        ordered: new Set(["sequence", "progression"]).has(relation) ? true : intent.structure?.ordered,
      },
    };
  });
  return output;
}

function visualPageKey(page) {
  return [page.familyId, page.variantId, page.silhouette].join("::");
}

function componentTextKey(binding) {
  return [binding.sourceField, binding.sourceItemId ?? "page", binding.sourceIndex ?? ""].join(":");
}

function componentTextSource(pageContent, binding) {
  if (binding.sourceField === "page-title") return pageContent.title ?? "";
  const item = pageContent.items.find((entry) => entry.id === binding.sourceItemId);
  if (!item) return "";
  if (binding.sourceField === "title") return item.title ?? "";
  if (binding.sourceField === "body") return item.body ?? "";
  if (binding.sourceField === "support") {
    return [item.body, ...(item.points ?? []).map((point) => point?.text ?? point)]
      .filter((value) => String(value ?? "").trim())
      .join("\n");
  }
  if (binding.sourceField === "point") {
    const point = item.points?.[binding.sourceIndex];
    return point?.text ?? point ?? "";
  }
  return "";
}

function expectedComponentText(pageContent, candidate, compositionPage) {
  const roles = new Map((candidate.slotCapabilities?.textSlots ?? []).map((slot) => [slot.role, slot]));
  const selected = new Set(compositionPage.componentItemIds ?? []);
  const expected = [];
  if (roles.has("center-title")) {
    expected.push({ sourceField: "page-title", targetRole: "center-title" });
  }
  for (const item of pageContent.items.filter((entry) => selected.has(entry.id))) {
    if (roles.has("item-title") && item.title?.trim()) {
      expected.push({ sourceItemId: item.id, sourceField: "title", targetRole: "item-title" });
    }
    const bodyRole = roles.get("item-body");
    const bodySourceField = bodyRole?.sourceField ?? "body";
    if (bodyRole && (item.body?.trim() || (bodySourceField === "support" && item.points?.length))) {
      expected.push({ sourceItemId: item.id, sourceField: bodySourceField, targetRole: "item-body" });
    }
    if (roles.has("item-point")) {
      (item.points ?? []).forEach((point, sourceIndex) => {
        if (String(point?.text ?? point ?? "").trim()) {
          expected.push({ sourceItemId: item.id, sourceField: "point", sourceIndex, targetRole: "item-point" });
        }
      });
    }
  }
  return expected;
}

function legalizeComponentText(pageContent, candidate, compositionPage) {
  const capabilities = candidate.slotCapabilities?.textSlots ?? [];
  if (!capabilities.length || compositionPage.componentContentMode !== "full") return [];
  const capabilityByRole = new Map(capabilities.map((slot) => [slot.role, slot]));
  const supplied = new Map((compositionPage.componentText ?? []).map((binding) => [componentTextKey(binding), binding]));
  return expectedComponentText(pageContent, candidate, compositionPage).flatMap((expected) => {
    const source = String(componentTextSource(pageContent, expected) ?? "").trim();
    if (!source) return [];
    const capability = capabilityByRole.get(expected.targetRole);
    const existing = supplied.get(componentTextKey(expected));
    const existingIsLegal = existing
      && existing.targetRole === expected.targetRole
      && String(existing.sourceFragment ?? "").trim()
      && Array.from(existing.text ?? "").length <= capability.maxChars
      && (!capability.maxLines || String(existing.text ?? "").split(/\r?\n/).length <= capability.maxLines)
      && source.includes(String(existing.sourceFragment ?? "").trim());
    if (existingIsLegal) return [existing];
    if (Array.from(source).length > capability.maxChars
      || (capability.maxLines && source.split(/\r?\n/).length > capability.maxLines)) {
      return [];
    }
    return [{ ...expected, text: source, sourceFragment: source }];
  });
}

export function normalizeVisualCompositionOutput(output, input) {
  const normalized = structuredClone(output);
  if (!normalized?.visualPlan?.pages || !normalized?.compositionPlan?.pages) return normalized;
  const requestedPageIds = input.pageContents.map((page) => page.pageId);
  const currentVisualById = new Map(normalized.visualPlan.pages.map((page) => [page.pageId, page]));
  const currentCompositionById = new Map(normalized.compositionPlan.pages.map((page) => [page.pageId, page]));
  normalized.visualPlan.pages = requestedPageIds.map((pageId) => currentVisualById.get(pageId)).filter(Boolean);
  normalized.compositionPlan.pages = requestedPageIds.map((pageId) => currentCompositionById.get(pageId)).filter(Boolean);
  const failedPageIds = new Set((input.previousResolution?.feedback ?? [])
    .map((item) => item.pageId)
    .filter(Boolean));
  if (failedPageIds.size && input.previous?.visualPlan && input.previous?.compositionPlan) {
    const previousVisual = new Map(input.previous.visualPlan.pages.map((page) => [page.pageId, page]));
    const previousComposition = new Map(input.previous.compositionPlan.pages.map((page) => [page.pageId, page]));
    normalized.visualPlan.pages = normalized.visualPlan.pages.map((page) => (
      failedPageIds.has(page.pageId) ? page : (previousVisual.get(page.pageId) ?? page)
    ));
    normalized.compositionPlan.pages = normalized.compositionPlan.pages.map((page) => (
      failedPageIds.has(page.pageId) ? page : (previousComposition.get(page.pageId) ?? page)
    ));
  }

  const pageContentById = new Map(input.pageContents.map((page) => [page.pageId, page]));
  const candidateSetById = new Map(input.candidateSets.map((set) => [set.pageId, set]));
  const visualById = new Map(normalized.visualPlan.pages.map((page) => [page.pageId, page]));
  const previousVisualById = new Map((input.previous?.visualPlan?.pages ?? []).map((page) => [page.pageId, page]));
  const feedbackById = new Map((input.previousResolution?.feedback ?? [])
    .filter((item) => item.pageId)
    .map((item) => [item.pageId, item]));
  normalized.compositionPlan.pages = normalized.compositionPlan.pages.map((compositionPage) => {
    const visualPage = visualById.get(compositionPage.pageId);
    const candidate = candidateSetById.get(compositionPage.pageId)?.candidates.find(
      (item) => visualPageKey(item) === visualPageKey(visualPage),
    );
    const composition = candidate?.compositions?.find((item) => item.id === compositionPage.compositionId);
    if (!candidate || !composition) return compositionPage;
    const previousVisualPage = previousVisualById.get(compositionPage.pageId);
    const feedback = feedbackById.get(compositionPage.pageId);
    const legalAlternative = feedback?.legalAlternatives?.length
      && previousVisualPage
      && visualPageKey(previousVisualPage) === visualPageKey(visualPage)
      ? feedback.legalAlternatives?.find((alternative) => candidate.compositionIds?.includes(alternative.compositionId))
      : null;
    if (legalAlternative) {
      return {
        pageId: compositionPage.pageId,
        intentId: compositionPage.intentId,
        ...legalAlternative,
        reason: `${compositionPage.reason}；按解析器返回的同候选合法 Composition 修正`,
      };
    }
    const legalTextSlotIds = new Set(composition.slots.filter((slot) => slot.role === "text").map((slot) => slot.id));
    const seenTextSlots = new Set();
    const textSlots = (compositionPage.textSlots ?? []).filter((slot) => {
      if (!legalTextSlotIds.has(slot.slotId) || seenTextSlots.has(slot.slotId)) return false;
      seenTextSlots.add(slot.slotId);
      return true;
    });
    const pageContent = pageContentById.get(compositionPage.pageId);
    const legalized = { ...compositionPage, textSlots };
    if (!candidate.contentContract?.bindings?.length) delete legalized.componentBindings;
    if (composition.requiresComponent && legalized.componentItemIds?.length && !legalTextSlotIds.size) {
      legalized.componentContentMode = "full";
      legalized.textSlots = [];
    }
    if (pageContent && candidate.slotCapabilities?.textSlots?.length) {
      legalized.componentText = legalizeComponentText(pageContent, candidate, legalized);
    } else {
      delete legalized.componentText;
    }
    return legalized;
  });

  normalized.visualPlan.pages = normalized.visualPlan.pages.map((page) => {
    const candidate = candidateSetById.get(page.pageId)?.candidates.find(
      (item) => visualPageKey(item) === visualPageKey(page),
    );
    if (candidate?.mediaContract?.mode === "semantic-icon") return page;
    const clean = { ...page };
    delete clean.iconQueries;
    return clean;
  });
  return normalized;
}

function contentSchemaWithSectionFloor(outputSchema, rawMarkdown, logicSkillIndex = []) {
  const source = String(rawMarkdown ?? "");
  const sectionMatches = [...source.matchAll(/^##\s+.+$/gm)];
  const sectionCount = sectionMatches.length;
  const specialized = structuredClone(outputSchema);
  const pageContents = specialized.schema?.properties?.pageContents;
  if (!pageContents?.items?.properties?.logicIntent) return specialized;
  const pageContentSchema = pageContents.items;
  if (!pageContentSchema.required.includes("logicIntent")) pageContentSchema.required.push("logicIntent");
  const logicIds = logicSkillIndex.map((item) => item.logicId).filter(Boolean);
  if (logicIds.length) pageContentSchema.properties.logicIntent.properties.logicId.enum = logicIds;
  if (sectionCount) {
    const splitAllowance = sectionMatches.filter((match, index) => {
      const body = source.slice(match.index + match[0].length, sectionMatches[index + 1]?.index).trim();
      return Array.from(body).length > 900;
    }).length;
    const pages = specialized.schema.properties.deckPlan.properties.pages;
    pages.minItems = sectionCount;
    pages.maxItems = sectionCount + splitAllowance;
    pageContents.minItems = sectionCount;
    pageContents.maxItems = sectionCount + splitAllowance;
  }
  return specialized;
}

export function enforceSectionPageContract(contentOutput, rawMarkdown, structuralHints = []) {
  const source = String(rawMarkdown ?? "");
  const sectionMatches = [...source.matchAll(/^##\s+.+$/gm)];
  if (!sectionMatches.length) return contentOutput;
  const sections = sectionMatches.map((match, index) => ({
    heading: match[0].replace(/^##\s+/, "").trim(),
    headingLine: match[0],
    sourceText: source.slice(match.index, sectionMatches[index + 1]?.index).trim(),
  }));
  const allowances = sectionMatches.map((match, index) => (
    Array.from(source.slice(match.index + match[0].length, sectionMatches[index + 1]?.index).trim()).length > 900 ? 1 : 0
  ));
  const sectionIndexForPage = (page) => {
    const sourceText = String(page.sourceText ?? "");
    const explicit = sectionMatches.findIndex((match) => sourceText.includes(match[0]));
    if (explicit >= 0) return explicit;
    const title = String(page.title ?? "").trim();
    const titleMatch = sections.findIndex((section) => (
      title === section.heading || title.includes(section.heading) || section.heading.includes(title)
    ));
    if (titleMatch >= 0) return titleMatch;
    const sourceIndex = sourceText ? source.indexOf(sourceText) : -1;
    if (sourceIndex < 0) return -1;
    let result = -1;
    sectionMatches.forEach((match, index) => { if (match.index <= sourceIndex) result = index; });
    return result;
  };
  const output = structuredClone(contentOutput);
  const planById = new Map(output.deckPlan.pages.map((page) => [page.pageId, page]));
  const assignedCounts = Array(sectionMatches.length).fill(0);
  const assignedPages = Array.from({ length: sectionMatches.length }, () => []);
  output.pageContents.forEach((page) => {
    const sectionIndex = sectionIndexForPage(page);
    if (sectionIndex < 0 || assignedCounts[sectionIndex] >= 1 + allowances[sectionIndex]) return;
    assignedCounts[sectionIndex] += 1;
    assignedPages[sectionIndex].push({
      ...page,
      title: sections[sectionIndex].heading,
      sourceText: sections[sectionIndex].sourceText,
    });
  });
  const usedIds = new Set(output.pageContents.map((page) => page.pageId));
  sections.forEach((section, sectionIndex) => {
    if (assignedPages[sectionIndex].length) return;
    const hint = structuralHints.find((item) => item.sectionHeading === section.heading);
    if (!hint) {
      const error = new Error(`内容导演遗漏章节且没有可用结构线索：${section.heading}`);
      error.code = "SECTION_COVERAGE_FAILED";
      error.details = { sectionHeading: section.heading, sectionIndex };
      throw error;
    }
    let pageId = `section-${sectionIndex + 1}`;
    while (usedIds.has(pageId)) pageId = `${pageId}-restored`;
    usedIds.add(pageId);
    assignedPages[sectionIndex].push({
      schemaVersion: "1.0",
      pageId,
      title: section.heading,
      logicIntent: {
        logicId: hint.relation === "none" ? "editorial" : hint.relation,
        reason: `程序从原稿恢复出 ${hint.relation} 主关系`,
      },
      items: hint.atoms.map((atom, itemIndex) => ({
        id: `${pageId}-structure-${itemIndex + 1}`,
        title: atom.title,
        body: atom.body,
        ...(atom.points?.length ? { points: atom.points } : {}),
        ...(atom.polarity ? { polarity: atom.polarity } : {}),
        ...(atom.emphasis ? { emphasis: true } : {}),
      })),
      notes: `PPagenT主关系=${hint.relation}`,
      sourceText: section.sourceText,
    });
  });
  output.pageContents = assignedPages.flat();
  output.deckPlan.pages = output.pageContents.map((page, index) => {
    const sectionIndex = sections.findIndex((section) => page.sourceText === section.sourceText);
    const existing = planById.get(page.pageId);
    return {
      pageId: page.pageId,
      sequence: index + 1,
      narrativeJob: existing?.narrativeJob ?? `说明“${page.title}”并支撑整套核心主张`,
      sourceAnchors: [sections[sectionIndex].headingLine],
    };
  });
  return output;
}

export function createModelDirectorProvider({
  contentModel,
  structureModel = null,
  visualModel,
  visualIntentModel = visualModel,
  visualCompositionModel = visualModel,
  reviewerModel,
  schemas,
  guidelines = {},
}) {
  const content = assertModel(contentModel, "contentModel");
  const refinement = structureModel ? assertModel(structureModel, "structureModel") : content;
  const visualIntent = assertModel(visualIntentModel, "visualIntentModel");
  const visualComposition = assertModel(visualCompositionModel, "visualCompositionModel");
  const reviewer = assertModel(reviewerModel, "reviewerModel");
  const outputs = assertSchemas(schemas);
  return {
    metadata: {
      providerKind: "live-schema-aware-model-provider",
      contentModel: content.identity ?? "unknown",
      structureModel: structureModel?.identity ?? "disabled",
      contentRefinementModel: refinement.identity ?? "unknown",
      visualIntentModel: visualIntent.identity ?? "unknown",
      visualCompositionModel: visualComposition.identity ?? "unknown",
      reviewerModel: reviewer.identity ?? "unknown",
    },
    async contentDirector(input) {
      const structuralGuides = buildStructuralCueGuides(input.rawMarkdown);
      const structuralHints = await readStructuralCues(input.rawMarkdown, structureModel);
      const deterministicHints = structuralGuides
        .filter((guide) => guide.fixedAtoms?.length)
        .map((guide) => ({ ...guide, atoms: guide.fixedAtoms }));
      const effectiveStructuralHints = [
        ...deterministicHints,
        ...structuralHints.filter((hint) => !deterministicHints.some((fixed) => fixed.cueId === hint.cueId)),
      ];
      const contentOutput = await content.generateJson({
        role: "PPagenT 内容导演",
        task: "在整套尺度决定叙事弧、页数、页序、每页职责、拆分、轻重，并为每个正文页选择一个 Logic；输出 deckPlan 与 pageContents。availableLogicSkills 是完整的语义 Logic 目录，不是现有资产菜单：PageContent.logicIntent.logicId 必须从中逐字选择，availableStructureGroupCount 即使为 0 也照样可以选择，后续程序会把它报告为资产缺口；绝不能因为暂时没有 Structure Group 就改成相近 Logic 或 editorial。reason 简要说明原稿关系为何属于该 Logic。structuralGuides 是程序直接从原稿句法识别出的高置信结构证据，不是资产推荐：对应章节必须保持 guide.relation，并按 guide.itemRange 提取主 items；guide.task 说明节点边界，fixedAtoms 若存在则必须逐项使用。不得用一句总括、背景或结论替换 structuralGuides 已证实存在的多个对象。内容导演只选 Logic，不读取也不选择 assetId、Structure Group、容器、坐标或图标；这些属于视觉导演。只有原稿确实没有可视化关系时才选择 editorial，绝不为套结构图篡改原稿。narrativeArc 是供目录页使用的 3 到 5 个简短章节名，不是逐页摘要。原稿的 Markdown 二级标题默认是一页内容单元；同一节中的反问、引文或总结通常留在该页，不单独拆成过渡页，除非该节容量确实必须拆分。先识别听众必须区分的全部对象，再压缩字句；醒目的引文、结论或标题通常是页面主张，不能替代支撑它的三至六个对象。structuralHints 是可选结构读取器形成的精确 atoms 覆盖结果：对应页面必须逐项使用 atoms 作为主 items 并保持 relation，允许忠实压缩，但不得用总括、背景或结论替换。items 只表示主关系中的同级节点；节点内部的说明维度、例子和枚举进入 points，不得提升为同级节点。没有 structuralGuides 的页面再按原稿关系判断。冒号、分号、项目符号或‘包括／分别／一是二是’明确列出三至六个同级机制、抓手、标准、结果或场景时，必须保留为三至六个 items；不要把它们塞进一个总括 item 的 points。只有这些条目都在解释同一个更小主节点时才放入 points。两个极端衬托中间主体时，必须保留左端、中间主体和右端；描述 A 进入或支撑 B、B 再服务 C 时，中介节点 B 不能被压掉。存在人物或组织层级时，用 structuredData.type=hierarchy 保存真实父子关系；只有原稿明确提供图片路径时才填写 portrait。明确同时给出输入对象、逐级收窄节点和 2–3 个宏观阶段时，才用 structuredData.type=convergence；没有阶段不得编造。明确给出 2–4 组问题与方案及共同结果时，用 structuredData.type=problem-solution；一个问题由 2–5 项同级方法共同处理并得到一个结果时，用 structuredData.type=problem-method-result，items 只保存方法且 methodIds 逐项引用；一个论点由 2–5 条证据共同支撑并收束为结论时，用 structuredData.type=argument-evidence，items 只保存证据且 evidenceIds 逐项引用；一个明确判断把同一情境分流到 2–4 条后续路径时，用 structuredData.type=branching-decision，items 保存路径动作与说明，branches 以相同 id 补充进入条件和可选结果。起点、终点、条件和路径必须来自原稿。明确给出两个判断维度和四个象限时，用 structuredData.type=matrix，均不得凭空补字段。标题或核心结论明确比较 A 与 B 时，items 必须恰好是双方；若来源提供共同维度，应为两侧提取数量一致的 3–5 条 points。除此以外不要按段落机械拆项，允许只有一个主要观点。结构性项目标题不超过 10 个汉字，body 尽量 15–30 个汉字；正文与 points 不重复。多项页面必须控制在正式字号可承载范围；收到容量反馈时压缩或拆页，不得缩字。不得为了套资产改变语义。",
        context: {
          executionGuidelines: guidelines.content ?? "",
          availableLogicSkills: guidelines.logicSkillIndex ?? [],
          structuralGuides,
          structuralHints: effectiveStructuralHints,
          ...sourceRule(input.rawMarkdown),
          attempt: input.attempt,
          previous: input.previous,
          previousReview: input.previousReview,
          visualFeedback: input.visualFeedback,
        },
        outputSchema: contentSchemaWithSectionFloor(
          outputs.contentDirector,
          input.rawMarkdown,
          guidelines.logicSkillIndex,
        ),
      });
      const normalized = applyStructuralHints(
        enforceSectionPageContract(contentOutput, input.rawMarkdown, effectiveStructuralHints),
        effectiveStructuralHints,
      );
      return assertStructuralCueCompliance(normalized, structuralGuides);
    },
    refineContent(input) {
      return refinement.generateJson({
        role: "PPagenT 内容局部细化器",
        task: "只处理 requests 指定的页面和 item。检查对应 page.sourceText 是否明确包含属于该主节点的二级支撑点；冒号后的并列短项，以及‘包括、分为、分别、有’等词引出的明确枚举，若语义上说明目标 item，必须逐项提取。有则返回短 points，只有确实没有明确枚举时才返回空 items。不得改变页面、主节点、标题、正文或顺序，不得补充常识和推断。每个 point.sourceFragment 必须逐字复制 sourceText 中能够支持该 point 的最短连续片段；point.text 是忠实短写，并满足请求中的数量与字数上限。不同页面的请求在这一次响应中一并完成。",
        context: { requests: input.requests, pages: input.pages },
        outputSchema: refinementOutputSchema(),
        maxJsonAttempts: 1,
        requestTimeoutMs: 30000,
      });
    },
    contentReview(input) {
      return reviewer.generateJson({
        role: "独立内容对抗审查者",
        task: "审查覆盖、无依据补充、叙事、节奏、重复、过度压缩、来源锚点和版式中立性；输出 ContentReview。",
        context: {
          ...sourceRule(input.rawMarkdown),
          attempt: input.attempt,
          deckPlan: input.deckPlan,
          pageContents: input.pageContents,
          visualFeedback: input.visualFeedback,
        },
        outputSchema: outputs.contentReview,
      });
    },
    async visualDirector(input) {
      if (input.phase === "intent") throw new Error("正式流程已取消视觉意图模型调用；Logic 由内容导演负责");
      const compactPages = compactVisualSkillContext(
        input.pageContents,
        input.pageIntents,
        input.candidateSets,
      );
      const routingOutput = await visualComposition.generateJson({
        role: "PPagenT 视觉导演",
        task: "内容导演已经为每页确定 Logic，你不得重新分类或跨 Logic 选择。像调用 Skills 一样，只在该页合法候选中选择具体 Structure Group，并决定核心短标签、语义图标查询和必要的局部内容细化。candidateId 必须逐字复制该页 candidates 中的值。结构性 Logic 没有兼容 Structure Group 时，程序会在调用你之前返回 asset-gap，绝不会提供正文兜底；只有内容导演明确选择 editorial 的页面才正常使用正文 Composition。centerLabel 是页面核心概念的 2–8 字中文短标签，所有页面都填写；若结构没有中心标签槽，程序会忽略。若选中 mediaMode=semantic-icon 的候选，必须为每个 item 输出一个简短英文 icon query，sourceItemId 使用该 item.id；其他候选 iconQueries=[]。若 contentReadiness=needs-semantic-refinement，只在原文明确支持缺失分点时列出对应 refinementItemIds，否则改选其他合法结构；不得改变 Logic。不要输出坐标、CompositionPlan 或重复正文；程序会在选择后读取 Structure Group 表单并完成确定性绑定。按 pages 原顺序逐页输出且不得遗漏。",
        context: {
          pages: compactPages,
          previousFeedback: input.previousResolution?.feedback ?? [],
        },
        outputSchema: visualSkillRoutingSchema(input.pageContents, input.candidateSets),
      });
      return normalizeVisualCompositionOutput(
        expandVisualSkillRouting(routingOutput, input),
        input,
      );

    },
    visualReview(input) {
      return reviewer.generateJson({
        role: "独立视觉对抗审查者",
        task: input.stage === "pre-render"
          ? "审查语义、容量、家族、变体、整套轮廓重复和节奏；输出 VisualReview。"
          : "逐页查看 pageEvidence，审查 Skin、一致性、几何、连线、层级和文字适配；输出 VisualReview。",
        context: input,
        outputSchema: outputs.visualReview,
        imagePaths: input.stage === "post-render" ? input.pageEvidence : [],
      });
    },
  };
}
