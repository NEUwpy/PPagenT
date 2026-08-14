const deckPlan = {
  schemaVersion: "1.0",
  deckId: "why-ppagent-codex-control",
  title: "为什么做 PPagenT",
  communicationJob: "让有真实汇报任务的人理解 PPagenT 为什么值得做、怎样工作以及服务谁",
  audience: "有内容和汇报任务、但不希望每次从零制作 PPT 的人",
  audienceOutcome: "理解 PPagenT 用可复用经验换取稳定、可靠和可编辑的交付",
  centralTakeaway: "把高手经验变成更多人可用的 PPT 生产能力",
  narrativeArc: [
    "为什么做 PPT 费时间",
    "为什么固定也是优势",
    "PPagenT 如何分工",
    "稳定交付服务谁",
    "能力如何持续积累"
  ],
  pages: [
    { pageId: "p1", sequence: 1, narrativeJob: "问题", sourceAnchors: ["真正费时间的不是把文本框拖到左边还是右边，而是一连串判断"] },
    { pageId: "p2", sequence: 2, narrativeJob: "取舍", sourceAnchors: ["> **每次都不一样，有时候才是缺点。**"] },
    { pageId: "p3", sequence: 3, narrativeJob: "机制", sourceAnchors: ["> **AI 负责理解。**", "> **规则负责决定。**", "> **代码负责执行。**"] },
    { pageId: "p4", sequence: 4, narrativeJob: "价值", sourceAnchors: ["> **对工作来说，稳定的 80 分，很多时候比随机的 95 分更值钱。**"] },
    { pageId: "p5", sequence: 5, narrativeJob: "用户", sourceAnchors: ["PPagenT 不需要让所有人成为设计师。"] },
    { pageId: "p6", sequence: 6, narrativeJob: "积累", sourceAnchors: ["一个漂亮页面只有在这些规律被提炼出来以后，才能从一件作品变成一种能力。"] },
    { pageId: "p7", sequence: 7, narrativeJob: "扩展", sourceAnchors: ["东北大学可以是第一个落地场景，但不会是 PPagenT 的最终边界。"] }
  ]
};

const pageContents = [
  {
    schemaVersion: "1.0",
    pageId: "p1",
    title: "做 PPT 真正昂贵的，是五次重复判断",
    items: [
      { id: "story", title: "怎么讲", body: "确定整场汇报的叙事主线" },
      { id: "split", title: "拆几页", body: "把长稿拆成单一页面任务" },
      { id: "focus", title: "讲什么", body: "决定每页只承担什么职责" },
      { id: "relation", title: "什么关系", body: "辨认并列、递进、因果或流程" },
      { id: "emphasis", title: "如何突出", body: "判断何时用图、何时一句话更有力量" }
    ],
    sourceText: "真正费时间的不是把文本框拖到左边还是右边，而是一连串判断：这场汇报到底怎么讲，一篇长稿应该拆成多少页，每一页只讲什么，这几个观点是并列、递进、因果还是流程，哪里应该突出，什么时候应该用图，什么时候一句话反而更有力量。"
  },
  {
    schemaVersion: "1.0",
    pageId: "p2",
    title: "固定不是退步，而是把验证过的经验留下来",
    items: [
      { id: "validated", title: "固定意味着已经验证", body: "颜色、字体、页眉页脚和好用的页面结构，不必每次都让 AI 重新猜。", emphasis: true }
    ],
    sourceText: "> **每次都不一样，有时候才是缺点。**"
  },
  {
    schemaVersion: "1.0",
    pageId: "p3",
    title: "AI 理解，规则决定，代码执行",
    items: [
      { id: "understand", title: "AI 理解", body: "读稿，判断重点、关系与拆页" },
      { id: "decide", title: "规则决定", body: "选版式、查容量，决定换版或拆页" },
      { id: "execute", title: "代码执行", body: "按坐标、字号、颜色和间距稳定生成" }
    ],
    sourceText: "> **AI 负责理解。** 读取稿件，判断重点、关系、拆页和表达目的。"
  },
  {
    schemaVersion: "1.0",
    pageId: "p4",
    title: "稳定的 80 分，比随机的 95 分更值钱",
    items: [
      { id: "random", title: "随机 95 分", body: "偶尔惊艳\n质量波动\n难以复现", polarity: "negative" },
      { id: "stable", title: "稳定 80 分", body: "结构清楚\n符合组织风格\n第二天仍可修改", polarity: "positive", emphasis: true }
    ],
    notes: "工作价值",
    sourceText: "> **对工作来说，稳定的 80 分，很多时候比随机的 95 分更值钱。**"
  },
  {
    schemaVersion: "1.0",
    pageId: "p5",
    title: "PPagenT 不把所有人变成设计师",
    items: [
      { id: "expert", title: "少数熟练制作者", body: "他们已经掌握拆页、表达和视觉排版的方法，往往可以自己做得更好。" },
      { id: "majority", title: "更多有内容的人", body: "他们有专业知识和真实任务，需要以更低成本获得接近专业标准的结果。", emphasis: true }
    ],
    sourceText: "PPagenT 不需要让所有人成为设计师。"
  },
  {
    schemaVersion: "1.0",
    pageId: "p6",
    title: "漂亮页面要从作品变成可扩展能力",
    items: [
      { id: "work", title: "作品", body: "先得到一个真正漂亮的页面" },
      { id: "rules", title: "规律", body: "提炼表达、容量、变化与禁忌" },
      { id: "capability", title: "能力", body: "让同一种方法适配更多真实内容" }
    ],
    sourceText: "一个漂亮页面只有在这些规律被提炼出来以后，才能从一件作品变成一种能力。"
  },
  {
    schemaVersion: "1.0",
    pageId: "p7",
    title: "东北大学是第一个 Skin，不是最终边界",
    items: [
      { id: "skin", title: "视觉可替换", body: "学校、企业和个人可以拥有各自 Skin" },
      { id: "logic", title: "逻辑可复用", body: "内容理解、拆页和表达规则继续复用" },
      { id: "learning", title: "经验可积累", body: "每份真实稿件都用来验证和扩展边界" }
    ],
    sourceText: "东北大学可以是第一个落地场景，但不会是 PPagenT 的最终边界。"
  }
];

function traits(overrides = {}) {
  return {
    temporal: false,
    cyclic: false,
    converging: false,
    branched: false,
    dimensions: 1,
    secondaryDimension: "none",
    ...overrides,
  };
}

const pageIntents = [
  { intentId: "p1-intent", purposeKey: "present_parallel_points", purposeText: "并列呈现反复发生的五类判断", baseRelation: "parallel", relationTraits: traits(), structure: { itemCount: 5, ordered: false, sameLevel: true, dimensions: { items: 5 } }, density: "medium", emphasis: [], evidenceTypes: ["text"], confidence: 1, assumptions: [] },
  { intentId: "p2-intent", purposeKey: "explain_topics", purposeText: "用单一判断强调固定的价值", baseRelation: "none", relationTraits: traits(), structure: { itemCount: 1, ordered: false, sameLevel: true, dimensions: { items: 1 } }, density: "low", emphasis: [0], evidenceTypes: ["text", "quotation"], confidence: 1, assumptions: [] },
  { intentId: "p3-intent", purposeKey: "explain_process", purposeText: "说明从理解到决定再到执行的三步链路", baseRelation: "sequence", relationTraits: traits(), structure: { itemCount: 3, ordered: true, sameLevel: true, dimensions: { items: 3 } }, density: "low", emphasis: [], evidenceTypes: ["text", "diagram"], confidence: 1, assumptions: [] },
  { intentId: "p4-intent", purposeKey: "compare_options", purposeText: "比较随机高分与稳定可用的工作价值", baseRelation: "comparison", relationTraits: traits(), structure: { itemCount: 2, ordered: false, sameLevel: true, dimensions: { items: 2, groups: 2, itemsPerGroup: 3 } }, density: "low", emphasis: [1], evidenceTypes: ["text", "diagram"], confidence: 1, assumptions: [] },
  { intentId: "p5-intent", purposeKey: "explain_topics", purposeText: "说明熟练制作者与多数用户的不同处境", baseRelation: "none", relationTraits: traits({ secondaryDimension: "category" }), structure: { itemCount: 2, ordered: false, sameLevel: true, dimensions: { items: 2 } }, density: "medium", emphasis: [1], evidenceTypes: ["text"], confidence: 1, assumptions: [] },
  { intentId: "p6-intent", purposeKey: "explain_evolution", purposeText: "说明页面从作品到规律再到能力的递进", baseRelation: "sequence", relationTraits: traits(), structure: { itemCount: 3, ordered: true, sameLevel: true, dimensions: { items: 3 } }, density: "low", emphasis: [2], evidenceTypes: ["text", "diagram"], confidence: 1, assumptions: [] },
  { intentId: "p7-intent", purposeKey: "present_parallel_points", purposeText: "并列说明系统可扩展的三个层面", baseRelation: "parallel", relationTraits: traits(), structure: { itemCount: 3, ordered: false, sameLevel: true, dimensions: { items: 3 } }, density: "low", emphasis: [], evidenceTypes: ["text", "diagram"], confidence: 1, assumptions: [] }
];

const visualPlan = {
  schemaVersion: "1.0",
  deckId: deckPlan.deckId,
  skinId: "northeastern-university-001",
  visualLanguage: "东北大学 Shell 与已登记蓝色结构组件",
  rhythmStrategy: "结构页与单点判断页交替，避免连续重复轮廓",
  pages: [
    { pageId: "p1", intentId: "p1-intent", familyId: "parallel", variantId: "parallel-cards-p135", silhouette: "equal-width-capability-cards", adaptationStatus: "adaptive", reason: "五个同级判断适合并列能力卡片" },
    { pageId: "p2", intentId: "p2-intent", familyId: "skin-body-editorial", variantId: "editorial", silhouette: "editorial-page", adaptationStatus: "adaptive", reason: "单一核心判断需要大字号留白而不是伪造结构" },
    { pageId: "p3", intentId: "p3-intent", familyId: "sequential-process", variantId: "horizontal-cards", silhouette: "horizontal-card-chain", adaptationStatus: "adaptive", reason: "三个动作构成明确顺序" },
    { pageId: "p4", intentId: "p4-intent", familyId: "comparison-structure", variantId: "default", silhouette: "symmetric-column-contrast", adaptationStatus: "adaptive", reason: "两种交付标准需要对比" },
    { pageId: "p5", intentId: "p5-intent", familyId: "skin-body-editorial", variantId: "editorial", silhouette: "editorial-page", adaptationStatus: "adaptive", reason: "受众差异以主次文字关系表达，不强行使用结构图" },
    { pageId: "p6", intentId: "p6-intent", familyId: "sequential-process", variantId: "horizontal-cards", silhouette: "horizontal-card-chain", adaptationStatus: "adaptive", reason: "作品、规律、能力形成递进" },
    { pageId: "p7", intentId: "p7-intent", familyId: "parallel", variantId: "parallel-cards-p135", silhouette: "equal-width-capability-cards", adaptationStatus: "adaptive", reason: "三个扩展方向地位相同" }
  ]
};

const compositionPlan = {
  schemaVersion: "1.0",
  deckId: deckPlan.deckId,
  skinId: "northeastern-university-001",
  pages: [
    { pageId: "p1", intentId: "p1-intent", compositionId: "component-full", componentItemIds: ["story", "split", "focus", "relation", "emphasis"], componentContentMode: "full", textSlots: [], reason: "组件完整承载五项内容" },
    { pageId: "p2", intentId: "p2-intent", compositionId: "editorial-single-focus", componentItemIds: [], componentContentMode: "none", textSlots: [{ slotId: "primary", sourceItemIds: ["validated"], contentMode: "full" }], reason: "单点判断使用单焦点文字版式" },
    { pageId: "p3", intentId: "p3-intent", compositionId: "component-full", componentItemIds: ["understand", "decide", "execute"], componentContentMode: "full", textSlots: [], reason: "组件完整承载三步" },
    { pageId: "p4", intentId: "p4-intent", compositionId: "component-full", componentItemIds: ["random", "stable"], componentContentMode: "full", textSlots: [], reason: "双栏组件完整承载两组对比" },
    { pageId: "p5", intentId: "p5-intent", compositionId: "editorial-dual-statement", componentItemIds: [], componentContentMode: "none", textSlots: [{ slotId: "left", sourceItemIds: ["expert"], contentMode: "full" }, { slotId: "right", sourceItemIds: ["majority"], contentMode: "full" }], reason: "两类用户用平衡双陈述构图表达，避免卡片化" },
    { pageId: "p6", intentId: "p6-intent", compositionId: "component-full", componentItemIds: ["work", "rules", "capability"], componentContentMode: "full", textSlots: [], reason: "组件完整承载三级递进" },
    { pageId: "p7", intentId: "p7-intent", compositionId: "component-full", componentItemIds: ["skin", "logic", "learning"], componentContentMode: "full", textSlots: [], reason: "组件完整承载三个扩展方向" }
  ]
};

const provider = {
  metadata: {
    providerKind: "codex-authored-control-provider",
    model: "current-codex-session",
    purpose: "isolate-director-output-from-runtime"
  },
  async contentDirector() {
    return structuredClone({ deckPlan, pageContents });
  },
  async visualDirector(input) {
    if (input.phase === "intent") return structuredClone({ pageIntents });
    return structuredClone({ visualPlan, compositionPlan });
  }
};

export default provider;
