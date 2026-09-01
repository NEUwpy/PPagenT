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
import { extractManuscriptSections } from "../content/manuscript-sections.mjs";

const CONTENT_DIRECTOR_SYSTEM_PROMPT = [
  "PPagenT 内容导演",
  "一次读取完整稿件，输出整套 DeckPlan 与逐页 PageContent",
  "只负责内容理解、叙事规划、Logic 判断和版式中立的结构字段提取，不选择最终 Structure Group，不处理坐标、颜色和组件实现",
  "判断优先级依次是原稿证据真实性、原稿结构完整性、全稿叙事完整性、页面容量、现有结构能力的可承载性",
  "不得为了提高结构使用率改变关系、增加节点、补造分点或虚构数据；只有原稿确实没有可视化关系时才使用 editorial",
].join("。\n");

const CONTENT_DIRECTOR_TASK = [
  "读取 context.source，一次完成整套 deckPlan 和 pageContents。",
  "按以下顺序工作：1.确认程序给出的页面边界与全稿叙事；2.逐页识别最外层关系；3.列出听众必须区分的全部主节点；4.提取原稿明确提供的节点内 points、时间、角色、极性和 structuredData；5.参考 structureCapabilities 检查是否遗漏了原稿真实存在且后续结构需要的字段；6.压缩文字并输出完整 JSON。",
  "availableLogicSkills 是完整 Logic 目录；logicIntent.logicId 必须逐字选择，不能因现有结构数量少或为 0 而改成相近 Logic 或 editorial。",
  "structureCapabilities 是当前核心结构按 Logic 分组生成的匿名内容形状摘要，只帮助保留必要字段，不是资产菜单；不得复写能力摘要，不得反向套结构。",
  "一旦选择的 Logic 能力把 structuredData.type、items[].points 或其他字段列为 requiredFields，就必须按 PageContent Schema 填全这些字段；不能只写 logicIntent 而省略该 Logic 的可调用关系数据。",
  "每页 logicIntent.reason 说明关系判断，evidenceFragments 逐字复制该页 sourceText 中 1–3 个最短连续证据片段，confidence 按证据明确程度填写 high、medium 或 low。",
  "structuralGuides 与 structuralHints 是程序从原稿提取的高置信证据；对应页面必须保持 relation、itemRange、主节点和 points 层级。",
  "items 只保存最外层关系中的同级节点；只有原稿明确列出的节点内下级内容才进入 points。不得用醒目标题、引文或结论替换原稿中的多个真实对象。",
  "narrativeArc 只输出 3–5 个简短章节名。结构性 item 标题不超过 10 个汉字，body 尽量 15–30 个汉字；正文与 points 不重复。",
  "不得输出 assetId、familyId、variantId、Structure Group、容器、坐标、颜色、图标或组件专属槽位。不得为了适配能力卡改变语义。",
].join("\n");

function assertModel(model, label) {
  if (!model || typeof model.generateJson !== "function") {
    throw new Error(`${label} 必须提供 generateJson({role, task, context})`);
  }
  return model;
}

function sourceRule(rawMarkdown) {
  const sections = extractManuscriptSections(rawMarkdown);
  const programBindsExplicitPages = sections.length > 0
    && sections.every((section) => section.markerKind === "explicit-page");
  return {
    source: rawMarkdown,
    rules: [
      "只能使用 source 中可核对的信息",
      "不得把资产、坐标、familyId 或 variantId 写进 PageContent",
      programBindsExplicitPages
        ? "原稿已经用显式页标记完整分页；不要输出 PageContent.sourceText，程序会按页序绑定完整原文和来源锚点"
        : "每个 PageContent.sourceText 必须直接复制 source 中一个非空、连续的原文子串，包含原有 Markdown 标记、标点和空格；不得摘要、改写、去掉标题井号或拼接不连续片段",
    ],
  };
}

function contentRevisionDirective(previousReview) {
  const issues = previousReview?.issues ?? [];
  if (!issues.length) return "";
  const requirements = issues.map((issue) => {
    const details = issue.details ?? {};
    if (issue.errorCode === "CONTENT_CAPACITY_EXCEEDED") {
      const capacityIssues = Array.isArray(details.issues) && details.issues.length
        ? details.issues
        : [details];
      return capacityIssues.map((capacityIssue) => {
        if (capacityIssue.sourceItemId && Number.isFinite(capacityIssue.maxChars)) {
          return `${capacityIssue.pageId ?? "指定页面"} 的 ${capacityIssue.sourceItemId} ${capacityIssue.role ?? "文字"} 当前 ${capacityIssue.actualChars ?? "超限"} 字，必须压到 ${capacityIssue.maxChars} 字以内；只压缩该字段的重复修饰，保留节点含义、节点数量和原稿关系，不得改动其他已合法页面`;
        }
        return `${capacityIssue.pageId ?? "指定页面"} 当前总量约 ${capacityIssue.estimatedTotalChars ?? "超限"} 字、最长单项约 ${capacityIssue.maxItemChars ?? "超限"} 字；必须同时把总量压到 ${capacityIssue.required?.maxTotalChars ?? "总容量上限"} 字以内、每个单项压到 ${capacityIssue.required?.maxItemChars ?? "单项容量上限"} 字以内。只压缩重复表述或按原稿章节拆页，不得缩字、删掉主关系或改动其他已合法页面`;
      }).join("；");
    }
    if (issue.errorCode === "SECTION_COVERAGE_FAILED") {
      return `原稿页面或正文标题“${details.sectionHeading ?? "指定章节"}”被遗漏；必须恢复为独立内容页，并让 title、sourceText、主张和支撑内容都来自该章节，不得用封面、目录或相邻章节代替`;
    }
    if (issue.errorCode === "SCHEMA_VALIDATION_FAILED") {
      const schemaErrors = Array.isArray(details.errors) ? details.errors : [];
      if (schemaErrors.some((error) => String(error.schemaPath).includes("/evidenceIds/minItems"))) {
        return `${details.label ?? "指定页面"} 的 argument-evidence 只有一条证据，结构不成立；若原稿有至少两条独立证据，就补成两个以上 items 并让 evidenceIds 逐项引用，否则删除 structuredData、保留普通 editorial 内容，不得虚构证据`;
      }
      const boundaryErrors = schemaErrors
        .filter((error) => new Set(["minItems", "maxItems", "minimum", "maximum", "minLength", "maxLength"]).has(error.keyword))
        .slice(0, 3)
        .map((error) => `${error.instancePath || "/"} ${error.message}`);
      if (boundaryErrors.length) {
        return `${details.label ?? "指定对象"} 超出 schema 容量边界：${boundaryErrors.join("；")}。只调整报错结构的节点数量或删除无法由原稿支持的 structuredData，不得改写其他页面或编造数据`;
      }
      return `${details.label ?? "指定对象"} 未满足输出 schema；只修正报错对象的字段、枚举和必填项，若可选 structuredData 无法由原稿完整支持就删除它，不得编造数据`;
    }
    return `${issue.errorCode ?? "内容错误"}：${issue.evidence ?? previousReview.summary ?? "按反馈修正"}`;
  });
  return `这是失败后的定向修订轮。必须先完成以下要求，再输出完整合法 JSON：${requirements.join("；")}。`;
}

function assertSchemas(schemas) {
  const required = ["contentDirector", "contentReview", "visualIntent", "visualComposition", "visualReview"];
  const missing = required.filter((key) => !schemas?.[key]);
  if (missing.length) throw new Error(`DirectorProvider 缺少输出 schema：${missing.join(", ")}`);
  return schemas;
}

export function candidateSetsForVisualDirector(candidateSets, previousFeedback = []) {
  const overflowPages = new Set(previousFeedback
    .filter((item) => item.code === "component-runtime-overflow")
    .map((item) => item.pageId));
  return candidateSets.map((set) => {
    const structural = set.candidates.filter((candidate) => !candidate.fallbackBody);
    const readyStructural = structural.filter((candidate) => candidate.contentReadiness !== "needs-semantic-refinement");
    const fallback = set.candidates.filter((candidate) => candidate.fallbackBody);
    if (overflowPages.has(set.pageId) && fallback.length) return { ...set, candidates: fallback };
    if (readyStructural.length) return { ...set, candidates: readyStructural };
    if (structural.length) {
      return {
        ...set,
        candidates: [],
        gap: set.gap ?? {
          type: "asset-gap",
          reason: "structural-candidates-require-semantic-refinement",
        },
      };
    }
    return set;
  });
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
    const baseCapability = capabilityByRole.get(expected.targetRole);
    const item = pageContent.items.find((entry) => entry.id === expected.sourceItemId);
    const capacities = baseCapability.compositionCapacities;
    const capability = baseCapability.fitMode !== "dynamic-text-flow" || !item || !capacities
      ? baseCapability
      : expected.targetRole === "item-title" && item.title?.trim() && !item.body?.trim() && !item.points?.length
        ? { ...baseCapability, maxChars: capacities.titleOnly?.maxChars, maxLines: capacities.titleOnly?.maxLines }
        : expected.targetRole === "item-body" && !item.title?.trim() && (item.body?.trim() || item.points?.length)
          ? { ...baseCapability, maxChars: capacities.bodyOnly?.maxChars, maxLines: capacities.bodyOnly?.maxLines }
          : baseCapability;
    const existing = supplied.get(componentTextKey(expected));
    const existingIsLegal = existing
      && existing.targetRole === expected.targetRole
      && String(existing.sourceFragment ?? "").trim()
      && (!Number.isFinite(capability.maxChars) || Array.from(existing.text ?? "").length <= capability.maxChars)
      && (!Number.isFinite(capability.maxLines) || String(existing.text ?? "").split(/\r?\n/).length <= capability.maxLines)
      && source.includes(String(existing.sourceFragment ?? "").trim());
    if (existingIsLegal) return [existing];
    if ((Number.isFinite(capability.maxChars) && Array.from(source).length > capability.maxChars)
      || (Number.isFinite(capability.maxLines) && source.split(/\r?\n/).length > capability.maxLines)) {
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

export function contentSchemaWithSectionFloor(outputSchema, rawMarkdown, logicSkillIndex = []) {
  const sections = extractManuscriptSections(rawMarkdown);
  const sectionCount = sections.length;
  const specialized = structuredClone(outputSchema);
  const pageContents = specialized.schema?.properties?.pageContents;
  if (!pageContents?.items?.properties?.logicIntent) return specialized;
  const pageContentSchema = pageContents.items;
  if (!pageContentSchema.required.includes("logicIntent")) pageContentSchema.required.push("logicIntent");
  const logicIntentSchema = pageContentSchema.properties.logicIntent;
  logicIntentSchema.required ??= [];
  for (const field of ["evidenceFragments", "confidence"]) {
    if (logicIntentSchema.properties?.[field] && !logicIntentSchema.required.includes(field)) {
      logicIntentSchema.required.push(field);
    }
  }
  const logicIds = logicSkillIndex.map((item) => item.logicId).filter(Boolean);
  if (logicIds.length) logicIntentSchema.properties.logicId.enum = logicIds;
  if (sectionCount) {
    const splitAllowance = sections.reduce((total, section) => {
      if (section.markerKind === "explicit-page") return total;
      return total + Math.min(2, Math.max(0, Math.ceil(Array.from(section.body).length / 900) - 1));
    }, 0);
    const pages = specialized.schema.properties.deckPlan.properties.pages;
    pages.minItems = sectionCount;
    pages.maxItems = sectionCount + splitAllowance;
    pageContents.minItems = sectionCount;
    pageContents.maxItems = sectionCount + splitAllowance;
    if (sections.every((section) => section.markerKind === "explicit-page")) {
      delete pageContentSchema.properties.sourceText;
      pageContentSchema.required = pageContentSchema.required.filter((field) => field !== "sourceText");
    }
  }
  return specialized;
}

export function enforceSectionPageContract(contentOutput, rawMarkdown, structuralHints = []) {
  const source = String(rawMarkdown ?? "");
  const sections = extractManuscriptSections(source);
  if (!sections.length) return contentOutput;
  const allowances = sections.map((section) => (
    section.markerKind === "explicit-page"
      ? 0
      : Math.min(2, Math.max(0, Math.ceil(Array.from(section.body).length / 900) - 1))
  ));
  const output = structuredClone(contentOutput);
  const planById = new Map(output.deckPlan.pages.map((page) => [page.pageId, page]));
  const sectionTag = (section) => `PPagenT来源章节=${section.sectionKey}`;
  const shellTag = (section) => (section.shellRole ? `PPagenTShellRole=${section.shellRole}` : "");
  const tagPage = (page, section) => ({
    ...page,
    // 显式“第 X 页：…”是原稿分页标记，不是应出现在 PPT 中的标题。
    // 内容导演即使原样返回了 heading，此处也使用解析后的语义标题收口。
    ...(section.markerKind === "explicit-page" && section.semanticTitle
      ? {
        title: section.semanticTitle,
        sourceText: section.sourceText,
      }
      : {}),
    notes: [page.notes, sectionTag(section), shellTag(section)].filter(Boolean).join("；"),
  });
  const allExplicitPages = sections.every((section) => section.markerKind === "explicit-page");
  const positionalAssignmentAllowed = allExplicitPages && output.pageContents.length === sections.length;
  const sectionIndexForPage = (page, pageIndex) => {
    const sourceText = String(page.sourceText ?? "");
    const existingTag = sections.findIndex((section) => String(page.notes ?? "").includes(sectionTag(section)));
    if (existingTag >= 0) return existingTag;
    const planAnchors = planById.get(page.pageId)?.sourceAnchors ?? [];
    if (sourceText) {
      const containing = sections
        .map((section, index) => (section.sourceText.includes(sourceText) ? index : -1))
        .filter((index) => index >= 0);
      if (containing.length === 1) return containing[0];
    }
    const markerMatches = sections
      .map((section, index) => (
        sourceText.includes(section.markerLine)
        || planAnchors.some((anchor) => String(anchor).includes(section.markerLine))
          ? index
          : -1
      ))
      .filter((index) => index >= 0);
    if (markerMatches.length === 1) return markerMatches[0];
    return positionalAssignmentAllowed ? pageIndex : -1;
  };
  const assignedCounts = Array(sections.length).fill(0);
  const assignedPages = Array.from({ length: sections.length }, () => []);
  output.pageContents.forEach((page, pageIndex) => {
    const sectionIndex = sectionIndexForPage(page, pageIndex);
    if (sectionIndex < 0 || assignedCounts[sectionIndex] >= 1 + allowances[sectionIndex]) return;
    assignedCounts[sectionIndex] += 1;
    assignedPages[sectionIndex].push(tagPage(page, sections[sectionIndex]));
  });
  const usedIds = new Set(output.pageContents.map((page) => page.pageId));
  sections.forEach((section, sectionIndex) => {
    if (assignedPages[sectionIndex].length) return;
    const hint = structuralHints.find((item) => item.sectionKey === section.sectionKey)
      ?? structuralHints.find((item) => item.sectionHeading === section.heading);
    if (!hint) {
      const error = new Error(`内容导演遗漏章节且没有可用结构线索：${section.heading}`);
      error.code = "SECTION_COVERAGE_FAILED";
      error.details = { sectionHeading: section.heading, sectionIndex };
      throw error;
    }
    let pageId = `section-${sectionIndex + 1}`;
    while (usedIds.has(pageId)) pageId = `${pageId}-restored`;
    usedIds.add(pageId);
    assignedPages[sectionIndex].push(tagPage({
      schemaVersion: "1.0",
      pageId,
      title: section.semanticTitle || section.heading,
      logicIntent: {
        logicId: hint.relation === "none" ? "editorial" : hint.relation,
        reason: `程序从原稿恢复出 ${hint.relation} 主关系`,
        evidenceFragments: [section.markerLine],
        confidence: "high",
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
    }, section));
  });
  output.pageContents = assignedPages.flat();
  output.deckPlan.pages = output.pageContents.map((page, index) => {
    const sectionIndex = sections.findIndex((section) => String(page.notes ?? "").includes(sectionTag(section)));
    const existing = planById.get(page.pageId);
    return {
      ...existing,
      pageId: page.pageId,
      sequence: index + 1,
      narrativeJob: existing?.narrativeJob ?? `说明“${page.title}”并支撑整套核心主张`,
      sourceAnchors: sections[sectionIndex]?.markerKind === "explicit-page"
        ? [sections[sectionIndex].markerLine]
        : (existing?.sourceAnchors?.length
          ? existing.sourceAnchors
          : [sections[sectionIndex]?.markerLine ?? page.sourceText]),
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
        role: CONTENT_DIRECTOR_SYSTEM_PROMPT,
        task: `${contentRevisionDirective(input.previousReview)}${CONTENT_DIRECTOR_TASK}`,
        context: {
          executionGuidelines: guidelines.content ?? "",
          availableLogicSkills: guidelines.logicSkillIndex ?? [],
          structureCapabilities: guidelines.structureCapabilities ?? [],
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
        maxJsonAttempts: 1,
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
      const disclosedCandidateSets = candidateSetsForVisualDirector(
        input.candidateSets,
        input.previousResolution?.feedback ?? [],
      );
      const compactPages = compactVisualSkillContext(
        input.pageContents,
        input.pageIntents,
        disclosedCandidateSets,
      );
      const routingOutput = await visualComposition.generateJson({
        role: "PPagenT 视觉导演",
        task: "内容导演已经为每页确定 Logic，你不得重新分类或跨 Logic 选择。像调用 Skills 一样，只在该页合法候选中选择具体 Structure Group，并决定核心短标签、语义图标查询、TextRegion 的组合排版以及必要的局部内容细化。candidateId 必须逐字复制该页 candidates 中的值。选定候选若披露 textRegions，只能从各 Region 的 compatibleLayoutIds 中选择；同级重复 Region 只按 regionKey 选择一次，程序会扩展到每个实际区域。没有文字区域或默认排版已经合适时省略 textLayoutChoices。优先使用语义与容量都合法的 Structure Group；如果该页只提供 fallbackBody 候选，或 previousFeedback 明确报告 component-runtime-overflow，则选择正文兜底，不得继续选择已证明装不下的结构。centerLabel 是页面核心概念的 2–8 字中文短标签，所有页面都填写；若结构没有中心标签槽，程序会忽略。若选中 mediaMode=semantic-icon 的候选，必须为每个 item 输出一个简短英文 icon query，sourceItemId 使用该 item.id；其他候选省略 iconQueries。只有 contentReadiness=needs-semantic-refinement 且原文明确支持缺失分点时才输出 refinementItemIds，否则省略；不得改变 Logic。只有同页存在多个候选或需要响应 previousFeedback 时才写简短 reason，否则省略。不要输出坐标、字号、间距、CompositionPlan、HTML/CSS 或重复正文；程序会读取 Structure Group 表单、形成 TextBinding，并用确定性排版器完成适配。按 pages 原顺序逐页输出且不得遗漏。",
        context: {
          pages: compactPages,
          previousFeedback: input.previousResolution?.feedback ?? [],
        },
        outputSchema: visualSkillRoutingSchema(input.pageContents, disclosedCandidateSets),
        maxJsonAttempts: 1,
      });
      return normalizeVisualCompositionOutput(
        expandVisualSkillRouting(routingOutput, { ...input, candidateSets: disclosedCandidateSets }),
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
