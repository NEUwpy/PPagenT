import { refinementOutputSchema } from "./semantic-refinement.mjs";
import {
  compactVisualSkillContext,
  expandVisualSkillRouting,
  visualSkillRoutingSchema,
} from "./visual-skill-router.mjs";
import { extractManuscriptSections } from "../content/manuscript-sections.mjs";
import { compileContentDirectorDraft } from "../content/content-director-markdown.mjs";
import { sourceBlocksForModel } from "../content/source-blocks.mjs";
import { candidateReadiness, normalizeDerivationPolicy } from "./visual-resolution.mjs";

const CONTENT_DIRECTOR_SYSTEM_PROMPT = [
  "PPagenT 内容导演",
  "一次读取完整稿件，输出一份既可直接阅读、又能由程序确定性解析的逐页 Markdown 内容稿",
  "只负责内容理解、叙事规划、Logic 判断和版式中立的结构字段提取，不选择最终 Structure Group，不处理坐标、颜色和组件实现",
  "判断优先级依次是原稿证据真实性、原稿结构完整性、全稿叙事完整性、页面容量、现有结构能力的可承载性",
  "不得为了提高结构使用率改变关系、增加节点、补造分点或虚构数据；只有原稿确实没有可视化关系时才使用 editorial",
  "Markdown 是唯一内容层级与正文事实源，机器元数据不得重复页面标题、章节、正文、节点或分点",
].join("。\n");

const VISUAL_DIRECTOR_BATCH_PAGE_LIMIT = 8;

const CONTENT_DIRECTOR_TASK = [
  "读取 context.sourceBlocks 中按顺序编号的完整原稿段落，一次完成 contentMarkdown、deckMetadata 和按 H1 页面顺序对齐的 pageMetadata。",
  "先识别整稿最大的叙事章节，再识别每个章节中可以独立承担一页职责的最小语义单元；普通原稿 Markdown 标题只是来源组织，不是 PPT 页数上限。只有原稿完整行写明‘第 X 页’时才必须保持其页数与顺序。",
  "contentMarkdown 只有一个页面边界规则：每个 H1 就是一页。H1 是简洁的页面主题标题；紧随 H1 的首个引用块是面向听众的页面主旨句，必须直接说清本页要让听众理解的判断，不能写成‘介绍、说明、呈现本页内容’之类制作职责，也不能与 H1 同义重复。H2 是页面最外层关系中的一个同级主节点，H2 下普通段落是 body，列表是该节点的 points；H3 仅用于 H2 节点内部确有必要的小标题。不得用 H2 或 H3 暗示另一套页边界，不使用 H4 及更深标题。",
  "一页可以有多个 H2 主节点；开场、案例、论证和收束若承担不同叙事职责，应拆成不同 H1 页面。每页在正式字号下保持适量，不得把整章硬压成一个巨型并列、时序或卡片页，也不得为了多页而重复内容。",
  "按以下顺序工作：1.通读全稿并在 deckMetadata.narrativeArc 中概括最大叙事阶段；2.确定 H1 页序与职责；3.逐页识别最外层 Logic；4.用 H2 列出听众必须区分的全部主节点；5.把原稿明确提供的节点内下级内容写成列表，必要时用 H3 标明节点内小节；6.参考 structureCapabilities 检查是否遗漏了原稿真实存在且后续结构需要的关系字段；7.压缩文字并输出完整对象。",
  "当原稿同时给出一个总机制及其内部层级、数量组、类型组、阶段组或应用场景时，必须保留从最大机制到最小明确节点的层级：不能只留下一个泛化 H2 和两条概括而丢掉内部结构；用 H3、列表或独立 H1 保存原稿真实存在的下级节点。",
  "availableLogicSkills 是完整 Logic 目录；logicIntent.logicId 必须逐字选择，不能因现有结构数量少或为 0 而改成相近 Logic 或 editorial。",
  "structureCapabilities 是当前核心结构按 Logic 分组生成的匿名内容形状摘要，只帮助保留必要字段，不是资产菜单；不得复写能力摘要，不得反向套结构。",
  "若 structureCapabilities 的 requiredFields 表明该 Logic 需要节点内 points 或复杂关系字段，先把全部人类可读内容写进 Markdown，再用 relationBindings 只补机器关系。",
  "deckMetadata 保存整套标题、沟通任务、受众、期望结果、核心结论与简短 narrativeArc；这些整套字段不在 contentMarkdown 里伪装成页面。",
  "每个 pageMetadata 只保存 logicIntent、sourceBlockIds、可选 itemMetadata 和必要的 relationBindings，并严格对应同序 H1；pageId 由程序按 H1 顺序生成。itemMetadata 必须与本页 H2 同序等长；当 H2 内部确有独立 Logic 时填写 itemMetadata.logicIntent，否则省略，只可另外填写 emphasis / polarity。不得重复 Markdown 中的页标题、职责、H2 正文或列表。",
  "sourceBlockIds 从 context.sourceBlocks 逐字选择本页实际使用的全部必要 ID，至少一个且不得重复；不要为了凑数量选入无关段落。它们只证明本页内容来自哪些原稿段落，不负责把全文切成互不重叠的连续区间。不同页面可以回看、交叠或重排来源段落，但不得使用完全相同的证据集合制造重复页。不要自行抄写 sourceAnchors；程序会只按实际选择的 ID 生成逐字证据与 sourceText。evidenceFragments 尽量逐字复制，若有空白或标点偏差程序会以 sourceBlockIds 的原文收口。",
  "Logic 名与 structuredData.type 不是一回事。普通 editorial、parallel、sequence、layered、hub、progression、network、comparison 只需 Markdown 节点，必须省略 relationBindings。只有确实要生成已登记机器关系时才填写 relationBindings，且 type 只能直接使用 hierarchy、convergence、problem-solution、problem-method-result、argument-evidence、multi-set-common-intersection、iceberg-visible-hidden、decision-tradeoff、internal-external-ecosystem、hub-tiered-ecosystem、branching-decision、branching-scenario、goal-strategy-metrics、role-stage、matrix、matrix-grid 之一；不得把 Logic 名写进 type，也不得用 /structuredData/type 间接改 type。references 的 ref 只能引用 page.title、item:N.id/title/body 或 item:N.point:M；literals 只填 ID、枚举、布尔、数值或邻接矩阵，不得重复正文。",
  "程序按页面顺序生成 page-01、page-02，并按每页 H2 顺序生成 page-01-item-1 等稳定 ID；relationBindings 中所有 itemIds、methodIds、evidenceIds 等必须使用这些可预测 ID，不能自创组件专属 ID。",
  "H2 标题不超过 10 个汉字，body 尽量 15–30 个汉字；正文与 points 不重复。",
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
    sourceBlocks: sourceBlocksForModel(rawMarkdown),
    rules: [
      "只能使用 sourceBlocks[].text 中可核对的信息",
      "不得把资产、坐标、familyId 或 variantId 写进 PageContent",
      programBindsExplicitPages
        ? `原稿已经用显式页标记完整分页，共 ${sections.length} 页；contentMarkdown 必须输出相同数量和顺序的 H1，程序会按页序绑定完整原文`
        : "普通 Markdown 标题只表示来源章节，不是输出页边界；由 contentMarkdown 的 H1 表达最终逐页稿",
      "sourceBlockIds 必须从 sourceBlocks 的 id 中选择；不得自造 ID，程序会据此生成逐字来源证据",
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
        const pointLimits = [
          Number.isFinite(capacityIssue.required?.maxPointsPerItem)
            ? `每个 H2 最多 ${capacityIssue.required.maxPointsPerItem} 个分点`
            : null,
          Number.isFinite(capacityIssue.required?.maxPointChars)
            ? `每个分点最多 ${capacityIssue.required.maxPointChars} 字`
            : null,
        ].filter(Boolean);
        const pointLimit = pointLimits.length ? `；${pointLimits.join("、")}` : "";
        return `${capacityIssue.pageId ?? "指定页面"} 当前总量约 ${capacityIssue.estimatedTotalChars ?? "超限"} 字、最长单项约 ${capacityIssue.maxItemChars ?? "超限"} 字；必须同时把总量压到 ${capacityIssue.required?.maxTotalChars ?? "总容量上限"} 字以内、每个单项压到 ${capacityIssue.required?.maxItemChars ?? "单项容量上限"} 字以内${pointLimit}。优先把该 H1 按不同叙事职责拆成两个 H1，并同步补齐 pageMetadata 与各页可核对的来源证据；也可压缩重复修饰，但不能把多个不同层级或不同类别硬塞进一个 H2。不得缩字、删掉主关系或改动其他已合法页面`;
      }).join("；");
    }
    if (issue.errorCode === "CONTENT_METADATA_MISMATCH") {
      if (Number.isInteger(details.markdownPages) && Number.isInteger(details.metadataPages)) {
        return `contentMarkdown 当前只有 ${details.markdownPages} 个 H1，但 pageMetadata 已有 ${details.metadataPages} 项。previous.pageMetadata 已经表达了完整逐页规划；必须把 contentMarkdown 补成严格同序、同数量的 ${details.metadataPages} 个 H1，每项 pageMetadata 对应一个 H1。保留已有页面内容，依据各项 sourceBlockIds 回到 context.sourceBlocks 补齐缺失页面；每页继续遵守 H1 页面、引用块主旨句、H2 主节点、正文和列表分点的 Markdown 契约，不得删除已有 pageMetadata 来迁就残缺 Markdown`;
      }
      const page = details.pageId ? `页面 ${details.pageId}` : "报错页面";
      const anchor = details.anchor ? `旧式锚点“${details.anchor}”` : "来源段落 ID 或同序元数据";
      return `${page} 的 ${anchor} 未通过确定性校验。previous 中是上一轮已经完成的完整草稿；必须保留其 H1 页序、H2/H3 页内内容、页面正文、Logic 和其他已合法元数据，只修正报错页的 sourceBlockIds 或与同序 H1 的元数据对应关系。不得把 H2/H3 当成页面，不得借机重写整套内容稿`;
    }
    if (issue.errorCode === "CONTENT_CONTRACT_GAP") {
      const gapRequirements = (details.gaps ?? []).map((gap) => {
        const reasons = (gap.rejected ?? []).flatMap((candidate) => candidate.reasons ?? []);
        return `${gap.pageId ?? "报错页面"} 的 ${gap.logicId ?? "既有 Logic"} 缺少候选所需字段：${[...new Set(reasons)].join("、") || gap.reason || "核心字段不足"}`;
      });
      return `${gapRequirements.join("；")}。previous 中是上一轮完整草稿；只在原稿 source 明确支持时，为报错 H1 的现有 H2 补齐或压缩 points／关系字段，并保持 H1 页序、H2/H3 内容、Logic、节点数量和其他页面不变。允许忠实概括原稿已有语句以适配字段长度，不得新增事实、节点、因果或结论`;
    }
    if (issue.errorCode === "CONTENT_HIERARCHY_COVERAGE_FAILED") {
      const missing = details.missingStructuralTokens ?? [];
      return `${details.pageId ?? "报错页面"} 已选择的来源段落包含数量层级 ${missing.join("、") || "结构公式"}，但逐页 Markdown 没有保留。previous 中是上一轮完整草稿；只修正该 H1，在 H2/H3/列表中恢复总结构及其明确下级组，并保持其他页面、事实和顺序不变。不得只把公式塞进一句正文，也不得补造来源没有的节点`;
    }
    if (issue.errorCode === "CONTENT_RELATION_COMPILE_FAILED") {
      return `${issue.evidence ?? previousReview.summary ?? "关系元数据无法编译"}。previous 中是上一轮完整草稿；保持 contentMarkdown、H1 页序、Logic、节点和其他元数据不变，只删除或修正报错页中不受支持的可选 relationBindings。普通 editorial、parallel、sequence、comparison 可直接依靠 Markdown 节点表达，不得发明机器字段或为了保留 relationBindings 改写正文`;
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
  return `这是当前一次定向修订。必须先完成以下要求，再输出完整的 Markdown 内容稿与机器元数据：${requirements.join("；")}。若仍有格式或确定性校验错误，程序会保留草稿并继续给出更具体反馈。`;
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
  const normalizeCandidate = (candidate, context = {}) => {
    if (!candidate) return null;
    const derivation = normalizeDerivationPolicy(
      candidate.derivationPolicy ?? candidate.contentContract?.derivationPolicy,
    );
    const readiness = candidateReadiness(candidate, context);
    const normalized = {
      ...candidate,
      readiness,
      reasons: readiness === "incompatible" && candidate.readiness === "derivable"
        ? [...(candidate.reasons ?? []), ...derivation.errors]
        : candidate.reasons ?? [],
      ...(readiness === "derivable" ? { derivationPolicy: derivation.policy } : {}),
    };
    if (readiness !== "derivable") delete normalized.derivationPolicy;
    delete normalized.contentReadiness;
    return normalized;
  };
  const uniqueCandidates = (candidates, context = {}) => {
    const seen = new Set();
    return candidates.flatMap((candidate) => {
      const normalized = normalizeCandidate(candidate, context);
      if (!normalized) return [];
      const key = [normalized.assetId, normalized.familyId, normalized.variantId, normalized.silhouette].join("::");
      if (seen.has(key)) return [];
      seen.add(key);
      return [normalized];
    });
  };
  const finalize = (set, candidates, context, forcedMode = null) => {
    const groups = [...new Set(candidates.map((candidate) => candidate.structureGroupId).filter(Boolean))];
    const selectionMode = !candidates.length ? null : forcedMode
      ?? (candidates.every((candidate) => candidate.readiness === "fallback")
        ? "fallback-locked"
        : groups.length <= 1 ? "group-locked" : "visual-selectable");
    const lockedStructureGroupId = selectionMode === "group-locked" && groups.length === 1
      ? groups[0]
      : null;
    return {
      ...set,
      candidates: candidates.map((candidate) => ({ ...candidate, selectionMode })),
      ...(selectionMode ? { selectionMode } : {}),
      ...(set.fallbackCandidate ? { fallbackCandidate: normalizeCandidate(set.fallbackCandidate, context) } : {}),
      ...(lockedStructureGroupId ? { lockedStructureGroupId } : {}),
    };
  };

  return candidateSets.map((set) => {
    const context = {
      assetGap: set.gap?.type === "asset-gap",
      runtimeOverflow: overflowPages.has(set.pageId),
    };
    const normalized = uniqueCandidates(set.candidates ?? [], context);
    const structural = normalized.filter((candidate) => !candidate.fallbackBody);
    const legalStructural = structural.filter((candidate) => (
      new Set(["ready", "derivable"]).has(candidate.readiness)
    ));
    const incompatibleStructural = structural.filter((candidate) => candidate.readiness === "incompatible");
    const contextualReadyBody = normalized.filter((candidate) => candidate.fallbackBody && candidate.readiness === "ready");
    const contextualFallbackCandidate = context.assetGap || context.runtimeOverflow
      ? [set.fallbackCandidate]
      : [];
    const fallback = uniqueCandidates([
      ...normalized.filter((candidate) => candidate.readiness === "fallback"),
      ...contextualFallbackCandidate,
    ], context).map((candidate) => ({
      ...candidate,
      readiness: "fallback",
      reasons: candidate.reasons?.length ? candidate.reasons : ["deterministic-body-fallback"],
    }));
    if (overflowPages.has(set.pageId) && fallback.length) return finalize(set, fallback, context, "fallback-locked");
    if (legalStructural.length) return finalize(set, legalStructural, context);
    if (incompatibleStructural.length) {
      return {
        ...finalize(set, [], context, null),
        gap: set.gap ?? {
          type: "content-contract-gap",
          reason: "structural-candidates-miss-core-content-fields",
        },
      };
    }
    if (contextualReadyBody.length) return finalize(set, contextualReadyBody, context, "group-locked");
    if (fallback.length) return finalize(set, fallback, context, "fallback-locked");
    return finalize(set, [], context, null);
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
  const specialized = structuredClone(outputSchema);
  const pageMetadata = specialized.schema?.properties?.pageMetadata;
  if (!pageMetadata?.items?.properties?.logicIntent) return specialized;
  const metadataSchema = pageMetadata.items;
  if (!metadataSchema.required.includes("logicIntent")) metadataSchema.required.push("logicIntent");
  const logicIntentSchema = metadataSchema.properties.logicIntent;
  logicIntentSchema.required ??= [];
  for (const field of ["evidenceFragments", "confidence"]) {
    if (logicIntentSchema.properties?.[field] && !logicIntentSchema.required.includes(field)) {
      logicIntentSchema.required.push(field);
    }
  }
  const logicIds = logicSkillIndex.map((item) => item.logicId).filter(Boolean);
  if (logicIds.length) logicIntentSchema.properties.logicId.enum = logicIds;
  const sourceBlockIds = sourceBlocksForModel(rawMarkdown).map((block) => block.id);
  if (metadataSchema.properties?.sourceBlockIds && sourceBlockIds.length) {
    metadataSchema.properties.sourceBlockIds.items.enum = sourceBlockIds;
  }
  const explicitPages = sections.length > 0
    && sections.every((section) => section.markerKind === "explicit-page");
  if (explicitPages) {
    pageMetadata.minItems = sections.length;
    pageMetadata.maxItems = sections.length;
  } else {
    // Ordinary source headings describe manuscript organization, not PPT pages.
    // The content director expresses final page boundaries with H1 in Markdown.
    pageMetadata.minItems = 1;
    pageMetadata.maxItems = 30;
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
  const onePagePerSection = output.pageContents.length === sections.length;
  const positionalAssignmentAllowed = onePagePerSection;
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
    const section = sections[sectionIndex];
    const pageSource = String(page.sourceText ?? "");
    const groundedPage = onePagePerSection && (!pageSource || !section.sourceText.includes(pageSource))
      ? { ...page, sourceText: section.sourceText }
      : page;
    assignedPages[sectionIndex].push(tagPage(groundedPage, section));
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
    const section = sections[sectionIndex];
    const groundedAnchors = (existing?.sourceAnchors ?? []).filter((anchor) => (
      section?.sourceText.includes(String(anchor))
    ));
    return {
      ...existing,
      pageId: page.pageId,
      sequence: index + 1,
      narrativeJob: existing?.narrativeJob ?? `说明“${page.title}”并支撑整套核心主张`,
      sourceAnchors: section?.markerKind === "explicit-page"
        ? [section.markerLine]
        : (groundedAnchors.length ? groundedAnchors : [section?.markerLine ?? page.sourceText]),
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
      const contentDraft = await content.generateJson({
        role: CONTENT_DIRECTOR_SYSTEM_PROMPT,
        task: `${contentRevisionDirective(input.previousReview)}${CONTENT_DIRECTOR_TASK}`,
        context: {
          executionGuidelines: guidelines.content ?? "",
          availableLogicSkills: guidelines.logicSkillIndex ?? [],
          structureCapabilities: guidelines.structureCapabilities ?? [],
          ...sourceRule(input.rawMarkdown),
          attempt: input.attempt,
          previous: input.previous?.contentDraftMarkdown
            ? {
              contentMarkdown: input.previous.contentDraftMarkdown,
              contentMetadata: input.previous.contentMetadata,
            }
            : undefined,
          previousReview: input.previousReview,
          visualFeedback: input.visualFeedback,
        },
        outputSchema: contentSchemaWithSectionFloor(
          outputs.contentDirector,
          input.rawMarkdown,
          guidelines.logicSkillIndex,
        ),
        // 内容导演的唯一恢复预算由工作流统一管理，避免模型层与
        // Markdown 编译层各自重试，叠加成四次 API 连接。
        maxJsonAttempts: 1,
      });
      try {
        return compileContentDirectorDraft(input.rawMarkdown, contentDraft, { repairMode: true });
      } catch (error) {
        // The only content-revision turn needs the actual failed draft so it
        // can repair the reported field instead of reconstructing the deck.
        error.contentDirectorDraft = contentDraft;
        throw error;
      }
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
      const batches = [];
      for (let start = 0; start < input.pageContents.length; start += VISUAL_DIRECTOR_BATCH_PAGE_LIMIT) {
        const end = Math.min(start + VISUAL_DIRECTOR_BATCH_PAGE_LIMIT, input.pageContents.length);
        batches.push({
          pageContents: input.pageContents.slice(start, end),
          pageIntents: input.pageIntents.slice(start, end),
          candidateSets: disclosedCandidateSets.slice(start, end),
        });
      }
      if (!batches.length) batches.push({ pageContents: [], pageIntents: [], candidateSets: [] });
      const selections = [];
      for (const [batchIndex, batch] of batches.entries()) {
        const pageIds = new Set(batch.pageContents.map((page) => page.pageId));
        const compactPages = compactVisualSkillContext(
          batch.pageContents,
          batch.pageIntents,
          batch.candidateSets,
        );
        const visualRequest = {
          role: "PPagenT 视觉导演",
          task: "内容导演已经为每页确定 Logic，你不得重新分类或跨 Logic 选择。你要把逐页内容稿与资产清单弥合：在该页合法候选中选择具体 Structure Group。当前自动正式线只开放 registered-structure，因为2+3组合原型尚未通过视觉验收、也还不能把已登记资产可靠地嵌入子区域；不要选择 text-plus-structure 或 multi-structure。candidateId 必须逐字复制该页 candidates 中的值；selectionMode=group-locked 表示程序已经锁定唯一合法 Structure Group，你仍需完成 centerLabel、图标、文字布局和整套节奏判断，但不得跨出 lockedStructureGroupId。readiness=ready 可直接绑定，readiness=derivable 只允许按 derivationPolicy.allowedFields 补展示字段；reasons 只是解释，不授予派生权限，不得补造核心节点、分点或关系。选定候选若披露 textRegions，只能从各 Region 的 compatibleLayoutIds 中选择；同级重复 Region 只按 regionKey 选择一次，程序会扩展到每个实际区域。没有文字区域或默认排版已经合适时省略 textLayoutChoices。如果该页 selectionMode=fallback-locked，或 previousFeedback 明确报告 component-runtime-overflow，则使用已锁定的正文兜底，不得继续选择已证明装不下的结构。centerLabel 是页面核心概念的 2–8 字中文短标签，所有页面都填写；若结构没有中心标签槽，程序会忽略。若选中 mediaMode=semantic-icon 的候选，只为该候选披露的 iconSourceItemIds 逐项输出简短英文 icon query，sourceItemId 必须逐字复制；iconSourceItemIds 为空时省略 iconQueries，不得改用普通 items。其他候选也省略 iconQueries。只有 selectionMode=visual-selectable 或需要响应 previousFeedback 时才写简短 reason，否则省略。不要输出坐标、字号、间距、CompositionPlan、HTML/CSS、重复正文或内容细化请求；程序会读取表单并用确定性排版器完成适配。按 pages 原顺序逐页输出且不得遗漏。",
          context: {
            deckPlan: input.deckPlan,
            pages: compactPages,
            previousFeedback: (input.previousResolution?.feedback ?? [])
              .filter((item) => !item.pageId || pageIds.has(item.pageId)),
            ...(batches.length > 1 ? {
              batch: { index: batchIndex + 1, count: batches.length },
              priorSelections: selections.map(({ pageId, candidateId }) => ({ pageId, candidateId })),
            } : {}),
          },
          outputSchema: visualSkillRoutingSchema(batch.pageContents, batch.candidateSets),
          // 每批通常只调用一次；空响应或非法 JSON 时仍保留一次受控重答。
          maxJsonAttempts: 2,
        };
        visualRequest.task = `像调用 Skills 一样使用候选能力卡；当前自动正式线不启用实验性的 blockStructureModes。${visualRequest.task}`;
        const routingOutput = await visualComposition.generateJson(visualRequest);
        selections.push(...(routingOutput.selections ?? []));
      }
      return normalizeVisualCompositionOutput(
        expandVisualSkillRouting({ selections }, { ...input, candidateSets: disclosedCandidateSets }),
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
