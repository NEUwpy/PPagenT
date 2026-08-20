import { applyStructuralHints, readStructuralCues } from "./structural-cue-reader.mjs";
import { refinementOutputSchema } from "./semantic-refinement.mjs";

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
    const match = String(pageContents[index]?.notes ?? "").match(/PPagenT主关系=(none|parallel|sequence|comparison|hierarchy|cycle|causal|convergence)/);
    if (!match) return intent;
    const relation = match[1];
    const purposeByRelation = {
      parallel: "present_parallel_points",
      sequence: "explain_process",
      comparison: "compare_options",
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
        ordered: relation === "sequence" ? true : intent.structure?.ordered,
      },
    };
  });
  return output;
}

function contentSchemaWithSectionFloor(outputSchema, rawMarkdown) {
  const source = String(rawMarkdown ?? "");
  const sectionMatches = [...source.matchAll(/^##\s+.+$/gm)];
  const sectionCount = sectionMatches.length;
  if (!sectionCount) return outputSchema;
  const splitAllowance = sectionMatches.filter((match, index) => {
    const body = source.slice(match.index + match[0].length, sectionMatches[index + 1]?.index).trim();
    return Array.from(body).length > 900;
  }).length;
  const specialized = structuredClone(outputSchema);
  const pages = specialized.schema.properties.deckPlan.properties.pages;
  const pageContents = specialized.schema.properties.pageContents;
  pages.minItems = sectionCount;
  pages.maxItems = sectionCount + splitAllowance;
  pageContents.minItems = sectionCount;
  pageContents.maxItems = sectionCount + splitAllowance;
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
      const structuralHints = await readStructuralCues(input.rawMarkdown, structureModel);
      const contentOutput = await content.generateJson({
        role: "PPagenT 内容导演",
        task: "在整套尺度决定叙事弧、页数、页序、每页职责、拆分和轻重；输出 deckPlan 与 pageContents。narrativeArc 是供目录页使用的 3 到 5 个简短章节名，不是逐页摘要。原稿的 Markdown 二级标题默认是一页内容单元；同一节中的反问、引文或总结通常留在该页，不单独拆成过渡页，除非该节容量确实必须拆分。structuralHints 是程序检测高置信结构线索后由独立解析器形成的覆盖结果：对应页面必须逐项使用其 atoms 作为主 items，保持 relation，不得用段落总括、背景、换一种说法或结论替换，也不得额外添加辅助信息为同级 item；允许忠实压缩措辞。items 只表示页面主关系中的同级节点；某一节点内部的说明维度、例子、判断项或枚举必须进入该 item.points，不得提升为新的同级 item。没有 structuralHints 的页面再按原稿关系自行判断。原稿存在人物或组织层级时，用 structuredData.type=hierarchy 保存真实父子关系；部门负责人节点可用 groupLabel 保存部门名，只有原稿明确提供图片路径时才填写 portrait，没有图片保持为空。原稿明确同时给出输入对象、逐级收窄节点和 2–3 个宏观阶段时，用 structuredData.type=convergence 保存 inputs 与 phases，phases.stepIds 只能引用 items 中的真实转化节点；只有输入和逐级转化、没有明确阶段时不要编造 phases。原稿明确给出 2–4 组一一对应的问题与方案，并给出一个共同结果时，用 structuredData.type=problem-solution 保存 pairs 与 outcome；items 使用相同 pair id 镜像 problem.title/body 供页面覆盖校验，不得把方案或结果伪装成同级 item。原稿明确给出两个判断维度、四类象限含义和每个对象的象限归属时，用 structuredData.type=matrix 保存 axes 与固定四个 quadrants；每个象限 itemIds 只能引用 1–3 个 items，对象必须且只能归入一个象限；items 镜像对象标题且 body 留空，四块说明与指标进入 quadrants[].detail，不得凭空补轴名、象限或指标。页面标题或核心结论明确表达 A 与 B、A 比 B、两种标准或二选一时，items 必须恰好是 A 和 B 双方，背景、使用场景和结论不能取代双方。除此以外不要按段落机械拆项，允许只有一个主要观点。结构性枚举、步骤或对比双方的每项标题不超过 10 个汉字、body 尽量压缩到 15 至 30 个汉字；正文与 points 不得重复同一事实。多项页面的标题、正文和 points 合计必须控制在正式字号可承载范围；previousReview 若含 CONTENT_CAPACITY_EXCEEDED，必须删去重复细节、压缩每项或按叙事职责拆页，不能原样返回，也不能靠缩小字号解决；若含 SECTION_COVERAGE_FAILED，必须补回指定 Markdown 二级章节。不得为了套资产改变语义。",
        context: {
          executionGuidelines: guidelines.content ?? "",
          structuralHints,
          ...sourceRule(input.rawMarkdown),
          attempt: input.attempt,
          previous: input.previous,
          previousReview: input.previousReview,
          visualFeedback: input.visualFeedback,
        },
        outputSchema: contentSchemaWithSectionFloor(outputs.contentDirector, input.rawMarkdown),
      });
      return applyStructuralHints(
        enforceSectionPageContract(contentOutput, input.rawMarkdown, structuralHints),
        structuralHints,
      );
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
      if (input.phase === "intent") {
        const intentOutput = await visualIntent.generateJson({
          role: "PPagenT 视觉导演",
          task: "只判断每页表达目的和语义关系，输出 pageIntents；此阶段不得选择资产。purposeKey 必须逐字选自 allowedPurposeVocabulary 中的 key，不得自创新值。PageContent.notes 含 PPagenT主关系=parallel|sequence 等程序高置信标记时，baseRelation 必须使用该值；structuredData.type=problem-solution 时使用 composite 和 connect_problems_and_solutions；structuredData.type=matrix 时使用 matrix 和 organize_matrix。多个动作构成先理解、再决定、后执行之类的先后链路时使用 sequence，不能仅因它们属于不同职责就写成 layered；同级判断类别即使会在工作中依次发生也仍是 parallel。只有内容明确表达输入对象经过连续筛选、收窄或转化时使用 convergence；普通步骤仍使用 sequence。目标用户与非目标用户的角色差异不是优劣比较，除非双方在同一评价维度形成明确取舍，否则不得写 comparison。comparison 的组数和组内条目数由程序补齐，不要猜资产私有字段。",
          context: {
            executionGuidelines: guidelines.visual ?? "",
            allowedPurposeVocabulary: (guidelines.purposeVocabulary ?? []).filter(
              (item) => !new Set(["present_cover", "present_agenda", "present_closing"]).has(item.key),
            ),
            attempt: input.attempt, skinId: input.skinId, deckPlan: input.deckPlan, pageContents: input.pageContents,
            previousResolution: input.previousResolution,
          },
          outputSchema: visualIntentSchemaWithPurposeVocabulary(
            outputs.visualIntent,
            guidelines.purposeVocabulary,
          ),
        });
        return enforceStructuralIntentRelations(intentOutput, input.pageContents);
      }
      return visualComposition.generateJson({
        role: "PPagenT 视觉导演",
        task: "先为每页从 candidateSets 中选择合法的整页 composition，再选择 familyId/variantId；compositionId、familyId、variantId、silhouette 都必须逐字复制同一个候选。候选的 contentContract 是 Logic 自己声明的内容接口：items 是主节点，points 是内容导演提供的节点内分点；视觉导演不得把 points 提升为同级节点。候选的 slotContract 只说明父 Structure Group 在 State 求解后可提供真实 Content Slots，不是当前 Composition 槽位，也不授权自创子结构；当前输出 Schema 没有受控子候选和 Slot 绑定字段，因此必须使用资产的 plain-text 兜底，不得输出子 Logic、Slot ID 或嵌套结构。若候选 mediaContract.mode=semantic-icon，通常按候选声明的媒体来源输出 iconQueries：普通 per-item 图标以 componentItemId 为 sourceItemId；source=structuredData.inputs 时以 PageContent.structuredData.inputs[].id 为 sourceItemId。required=false 时图标查询可省略，程序会在同一个圆形标记槽内使用输入短标签回退；不得同时显示圆内图标和圆外重复标签。视觉导演不看图标、不列候选、也不得输出 iconKey；本地程序会从 Tabler 元数据中模糊匹配唯一 Top 1。其他候选不得输出 iconQueries。若 contentContract.bindings 非空，视觉导演必须在该页 componentBindings 中按声明完成视觉内容适配：bindingId 必须来自候选，per-component-item 表示每个 componentItemId 各输出一组；entries 数量、单条字数和跨组平衡必须满足契约，preferredItems 是来源内容允许时的优先数量。每条 entry.text 是观众可见的精炼短句，entry.sourceFragment 必须逐字摘自该页 sourceText 或对应内容项，作为不可见依据；禁止增加来源没有的事实，也禁止把整段正文作为一个长条目。没有 bindings 声明时不得自行输出 componentBindings。如果候选中存在 fallbackBody=false、且语义关系、主节点数量和文字容量均适配的结构组件，默认选择该结构组件；只有结构不能真实澄清关系、需要原稿没有的媒体、或容量不成立时才选择 fallbackBody=true 的简单排版，reason 必须具体写出不适配原因，不能仅以低密度、文字较少或编辑页也能容纳为由放弃结构。sequence 若表达任务、职责交接或操作步骤且没有日期、阶段年份或里程碑证据，优先选择 sequential-process；timeline-roadmap 只用于明确的时间进程、历史演进或里程碑。textSlots 只能使用该候选 compositions 中所选 composition 声明的 role=text 槽位 id，并且每个文字槽位恰好填写一次；role=component 或 role=image 的槽位不得写入 textSlots。每个内容项的非空 title 和 body 都必须分别被承载：full 同时承载两者，title 或 body 只承载对应字段，必要时同一内容项可分别进入两个槽位。componentContentMode=full 表示组件负责该内容项以及契约化适配结果；titles-only 只有在每个被省略的正文与 points 同时进入合法文字槽时才允许，不能把‘组件能够显示正文’臆测成 tooltip。若 previousResolution.feedback 非空，必须逐项修正其中指出的非法选择、内容遗漏或节奏重复，并优先使用反馈给出的 legalAlternatives。明确内容进入组件还是文字槽位，并在整套尺度控制轮廓、图文比例与节奏。不得自创结构、版式、bindingId、槽位或伪造 ID；输出 VisualPlan 与 CompositionPlan。",
        context: {
          executionGuidelines: guidelines.visual ?? "",
          semanticRefinementAllowed: input.semanticRefinementAllowed === true,
          semanticRefinementGuidance: "仅当所选候选允许 points，且 sourceText 明确含有属于某个主节点、但 PageContent 尚未提取的二级枚举时，才输出 semanticRefinementRequests。请求必须引用所选候选的 familyId/variantId 和缺失 points 的 itemIds；不得为丰富画面请求细节，不得请求 adaptationOwner=visual-director 的绑定型候选。即使发出请求，也必须照常输出完整 VisualPlan 与 CompositionPlan。",
          slotPlanningGuidance: "候选的 slotCapabilities 是正式排版合同。选择 HTML Structure Group 后，必须按其中 textSlots 的 role、maxChars、maxLines，为每个被组件承载的来源字段输出 CompositionPlan.componentText；sourceFragment 逐字引用对应来源字段，text 是实际进入 PPT 的精炼文字。item-body 默认是一个完整的流式正文容器：普通段落直接写入，来源确有 points 时只在同一文本框内换行或使用项目符号，不得把 points 当成预设数量的几何小槽。只有候选明确声明 pointRendering=separate-slots 时才允许逐点绑定独立槽。item-title 默认可选，来源没有标题时保持为空，不得编造“步骤1”等占位文字。不得超过容量，不能靠缩字。存在必填 mediaSlots.icon 时还必须输出对应 iconQueries；若无法忠实压缩到容量内，应改选其他 Structure Group、正文 Composition 或拆页，不能硬塞。",
          attempt: input.attempt,
          skinId: input.skinId,
          deckPlan: input.deckPlan,
          pageContents: input.pageContents,
          pageIntents: input.pageIntents,
          candidateSets: input.candidateSets,
          previousResolution: input.previousResolution,
          previousReview: input.previousReview,
        },
        outputSchema: outputs.visualComposition,
      });
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
