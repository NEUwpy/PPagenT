function paragraph(source, marker) {
  const line = source.split(/\r?\n/).find((item) => item.includes(marker));
  if (!line) throw new Error(`原稿缺少来源段落：${marker}`);
  return line.trim();
}

function excerpt(source, startMarker, endMarker = null) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`原稿缺少来源起点：${startMarker}`);
  const end = endMarker ? source.indexOf(endMarker, start) : source.length;
  if (endMarker && end < 0) throw new Error(`原稿缺少来源终点：${endMarker}`);
  return source.slice(start, end).trim();
}

const deckId = "liudi-red-v0.6.1";
const skinId = "northeastern-university-001";

function item(id, title, body, emphasis = false) {
  return { id, title, body, ...(emphasis ? { emphasis: true } : {}) };
}

function page(pageId, title, items, sourceText, notes = "") {
  return {
    schemaVersion: "1.0",
    pageId,
    title,
    items,
    ...(notes ? { notes } : {}),
    sourceText,
  };
}

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

function intent(intentId, purposeKey, purposeText, baseRelation, structure, relationTraits = {}, extras = {}) {
  return {
    schemaVersion: "1.1",
    intentId,
    purposeKey,
    purposeText,
    baseRelation,
    relationTraits: traits(relationTraits),
    structure,
    density: extras.density ?? "unknown",
    evidenceTypes: extras.evidenceTypes ?? ["text"],
    confidence: extras.confidence ?? 0.95,
    assumptions: extras.assumptions ?? [],
  };
}

const preferredAssets = {
  p01: "northeastern-university-cover-001",
  p02: "comparison-structure-001",
  p03: "radial-hub-001",
  p04: "northeastern-university-body-001",
  p05: "sequential-process-001",
  p06: "northeastern-university-body-001",
  p07: "sequential-process-001",
  p08: "radial-hub-001",
  p09: "northeastern-university-body-001",
  p10: "framework-matrix-001",
  p11: "northeastern-university-body-001",
  p12: "northeastern-university-closing-001",
};

const compositionByPage = {
  p01: { compositionId: "fixed-cover", componentItemIds: [], componentContentMode: "none", textSlots: [] },
  p02: { compositionId: "component-full", componentItemIds: ["high", "low"], componentContentMode: "full", textSlots: [] },
  p03: { compositionId: "component-full", componentItemIds: ["land-01", "land-02", "land-03", "land-04", "land-05", "land-06"], componentContentMode: "full", textSlots: [] },
  p04: {
    compositionId: "editorial-list",
    componentItemIds: [],
    componentContentMode: "none",
    textSlots: [
      { slotId: "lead", sourceItemIds: ["route"], contentMode: "full" },
      { slotId: "body", sourceItemIds: ["classroom", "scenes", "ecosystem"], contentMode: "full" },
    ],
  },
  p05: {
    compositionId: "component-aside-right",
    componentItemIds: ["task-01", "task-02", "task-03"],
    componentContentMode: "full",
    textSlots: [{ slotId: "aside", sourceItemIds: ["task-conclusion"], contentMode: "full" }],
  },
  p06: {
    compositionId: "editorial-list",
    componentItemIds: [],
    componentContentMode: "none",
    textSlots: [
      { slotId: "lead", sourceItemIds: ["vr-data"], contentMode: "full" },
      { slotId: "body", sourceItemIds: ["vr-course", "vr-reach", "vr-recognition"], contentMode: "full" },
    ],
  },
  p07: { compositionId: "component-full", componentItemIds: ["voice-01", "voice-02", "voice-03", "voice-04"], componentContentMode: "full", textSlots: [] },
  p08: { compositionId: "component-full", componentItemIds: ["circle-01", "circle-02", "circle-03", "circle-04", "circle-05", "circle-06"], componentContentMode: "full", textSlots: [] },
  p09: {
    compositionId: "editorial-focus-reverse",
    componentItemIds: [],
    componentContentMode: "none",
    textSlots: [
      { slotId: "support", sourceItemIds: ["mechanism", "mentor"], contentMode: "full" },
      { slotId: "primary", sourceItemIds: ["lifecycle"], contentMode: "full" },
    ],
  },
  p10: { compositionId: "component-full", componentItemIds: ["result-01", "result-02", "result-03", "result-04"], componentContentMode: "full", textSlots: [] },
  p11: {
    compositionId: "editorial-focus",
    componentItemIds: [],
    componentContentMode: "none",
    textSlots: [
      { slotId: "primary", sourceItemIds: ["synthesis"], contentMode: "full" },
      { slotId: "support", sourceItemIds: ["instruction"], contentMode: "full" },
    ],
  },
  p12: { compositionId: "fixed-closing", componentItemIds: [], componentContentMode: "none", textSlots: [] },
};

export default {
  metadata: {
    providerKind: "codex-as-api-frozen-director",
    providerId: "liudi-red-v0.6.1",
    contentDirector: "Codex",
    visualDirector: "Codex",
  },

  async contentDirector({ rawMarkdown }) {
    if (!rawMarkdown.includes("让“六地”红，成为理工青年最鲜亮的青春底色")) {
      throw new Error("本冻结导演响应只对应《让“六地”红》原稿");
    }

    const pageContents = [
      page("p01", "让“六地”红，成为理工青年最鲜亮的青春底色", [
        item("subtitle", "", "辽宁“六地”红色文化标识融入党员教育的创新实践"),
      ], paragraph(rawMarkdown, "# 让“六地”红")),
      page("p02", "“三高三低”困境同时存在", [
        item("high", "三高", "高学分；高竞赛；高科研"),
        item("low", "三低", "理论情感浓度低；身份认同声量低；知行合一燃值低", true),
      ], paragraph(rawMarkdown, "十年前，为破解")),
      page("p03", "从“走遍全国”转向“深耕辽宁”", [
        item("land-01", "抗日战争起始地", ""),
        item("land-02", "解放战争转折地", ""),
        item("land-03", "新中国国歌素材地", ""),
        item("land-04", "抗美援朝出征地", ""),
        item("land-05", "共和国工业奠基地", ""),
        item("land-06", "雷锋精神发祥地", ""),
      ], paragraph(rawMarkdown, "今天，我们把目光"), "深耕辽宁"),
      page("p04", "“1+3+N”新矩阵连接全时全域育人", [
        item("route", "1+6+N研学链", "1个校本基地、6处核心场馆、N个配套教学点"),
        item("classroom", "3类青春课堂", "行走课堂·沉浸课堂·互动课堂"),
        item("scenes", "N个教育场景", "校地、校企、校校党建联建"),
        item("ecosystem", "五位一体育人生态", "从“一时一地”走向“全时全域"),
      ], paragraph(rawMarkdown, "学院党委深挖六地红色资源")),
      page("p05", "一张任务单，把参观变成解决真实问题", [
        item("task-01", "拍一段", "“青声说史”短视频"),
        item("task-02", "解决一个", "场馆或教学点“微难题”"),
        item("task-03", "带回一个", "“振兴微课题”"),
        item("task-conclusion", "时代订单", "振兴辽宁不是口号，而是算法、图纸、代码，是必须扛起的时代订单。", true),
      ], paragraph(rawMarkdown, "一张“红色任务单”")),
      page("p06", "22处旧址进入全景数据，7门党课实现“一键穿越”", [
        item("vr-data", "数据底座", "把22处“六地”旧址拍成全景数据"),
        item("vr-course", "课程供给", "开发7门“红色VR党课”"),
        item("vr-reach", "服务覆盖", "170个支部、2400余名党员预约体验"),
        item("vr-recognition", "示范认可", "省级示范基地、高校基层党建创新一等奖"),
      ], paragraph(rawMarkdown, "一座“VR党员教育示范基地”")),
      page("p07", "青年讲、青年听、青年信", [
        item("voice-01", "32人混编", "博士、硕士、本科梯队"),
        item("voice-02", "10类课件", "故事、短剧、红色闯关"),
        item("voice-03", "36场宣讲", "进校园、进社区、进企业"),
        item("voice-04", "3800多人", "覆盖师生群众", true),
      ], paragraph(rawMarkdown, "一支“青春有理”")),
      page("p08", "“红色朋友圈”把校园小盆景变成区域大风景", [
        item("circle-01", "VR党课共享", ""),
        item("circle-02", "主题党日联办", ""),
        item("circle-03", "红色资源联用", ""),
        item("circle-04", "志愿服务联动", ""),
        item("circle-05", "组织资源经验互鉴", ""),
        item("circle-06", "“六地精神西部行”", ""),
      ], paragraph(rawMarkdown, "一张“红色朋友圈”"), "红色朋友圈"),
      page("p09", "把“六地”教育嵌入党员成长全周期", [
        item("lifecycle", "四阶培养链", "入学—入党—转正—毕业", true),
        item("mechanism", "制度嵌入", "红色实践计入学分；VR党课写进“三会一课”"),
        item("mentor", "导师接力", "36位纪念馆专家、抗美援朝老战士担任“红色导师”"),
      ], paragraph(rawMarkdown, "一套“红色育人”机制")),
      page("p10", "五年深耕，让“学霸”有了新标签：红色先锋", [
        item("result-01", "信仰更强", "毕业后留辽意愿：58%→87%"),
        item("result-02", "本领更硬", "26份微课题，8家企业当场“收货”"),
        item("result-03", "声音更响", "理论飞入社区、课堂和生产一线"),
        item("result-04", "脚步更稳", "选调生/重大装备研发：+40%"),
      ], excerpt(rawMarkdown, "经过5年深耕", "## 收束")),
      page("p11", "十年探路、五年深耕，把红色基因熔铸进青春年轮", [
        item("synthesis", "五个抓手", "研学链贯通血脉，任务单激发担当，VR跨越时空，宣讲团传递信仰，育人机制夯实成长。", true),
        item("instruction", "总书记嘱托", "讲好党的故事、革命的故事、英雄的故事，把红色基因传承下去。"),
      ], excerpt(rawMarkdown, "习近平总书记强调")),
      page("p12", "", [
        item("mission", "“六地”红", "成为理工青年最鲜亮的青春底色"),
        item("conclusion", "", "我的汇报完毕，谢谢大家！", true),
      ], paragraph(rawMarkdown, "循着这份沉甸甸的嘱托")),
    ];

    return {
      deckPlan: {
        schemaVersion: "1.0",
        deckId,
        title: "让“六地”红，成为理工青年最鲜亮的青春底色",
        communicationJob: "让评委和组工干部理解辽宁‘六地’红色文化如何被转化为理工学生党员教育的可持续实践。",
        audience: "创新案例评审与组工干部",
        audienceOutcome: "看清问题、方法、五类抓手、可量化成效与长期价值。",
        centralTakeaway: "以辽宁‘六地’为最近的红色课堂，通过研学、数字化、青年宣讲、共建和机制化，把红色基因转化为青年投身振兴的行动。",
        narrativeArc: ["提出三高三低困境", "转向深耕辽宁六地", "搭建总体育人矩阵", "展开五类实践抓手", "用四项成效验证", "回到红色基因传承与青春担当"],
        pages: [
          ["p01", "建立案例主题与汇报对象", ["让“六地”红，成为理工青年最鲜亮的青春底色"]],
          ["p02", "说明创新实践要解决的原始困境", ["三高三低"]],
          ["p03", "解释为什么从全国实践转向辽宁六地", ["从“走遍全国”转向“深耕辽宁”"]],
          ["p04", "呈现1+3+N矩阵的主要构成", ["1+3+N", "全时全域"]],
          ["p05", "呈现任务单如何把参观转为实干", ["红色任务单", "时代订单"]],
          ["p06", "呈现VR基地的建设路径与覆盖成效", ["22处“六地”旧址", "2400余名党员"]],
          ["p07", "呈现青年宣讲的组织方式与传播规模", ["青年讲、青年听、青年信"]],
          ["p08", "呈现跨单位共建形成的共享网络", ["红色朋友圈", "41家单位"]],
          ["p09", "说明如何用制度固化长期育人", ["入学—入党—转正—毕业", "红色导师"]],
          ["p10", "用四个维度呈现五年成效", ["红色先锋", "58%飙到87%", "比例提升40%"]],
          ["p11", "把五类抓手收束为红色基因传承的系统路径", ["十年探路、五年深耕", "把红色基因传承下去"]],
          ["p12", "回扣主题并完成汇报", ["我的汇报完毕，谢谢大家！"]],
        ].map(([pageId, narrativeJob, sourceAnchors], index) => ({ pageId, sequence: index + 1, narrativeJob, sourceAnchors })),
      },
      pageContents,
    };
  },

  async visualDirector(input) {
    if (input.phase === "intent") {
      return {
        pageIntents: [
          intent("i01", "present_cover", "呈现案例标题与副标题", "none", { itemCount: 1, ordered: false, sameLevel: false }),
          intent("i02", "compare_options", "对照理工学生党员同时存在的三高与三低", "comparison", { itemCount: 2, ordered: false, sameLevel: false, dimensions: { groups: 2, itemsPerGroup: 3 } }, { dimensions: 2, secondaryDimension: "domain" }),
          intent("i03", "explain_topics", "围绕深耕辽宁呈现六块同级红色标识", "hub", { itemCount: 6, ordered: false, sameLevel: true }, { dimensions: 2, secondaryDimension: "category" }),
          intent("i04", "present_parallel_points", "并列说明研学链、青春课堂、教育场景和育人生态", "parallel", { itemCount: 4, ordered: false, sameLevel: true }, { dimensions: 2, secondaryDimension: "category" }),
          intent("i05", "explain_process", "说明任务单从记录到解决问题再到形成课题的推进", "sequence", { itemCount: 4, ordered: true, sameLevel: false }, {}, { density: "medium" }),
          intent("i06", "present_parallel_points", "并列呈现VR基地的数据、课程、覆盖与认可", "parallel", { itemCount: 4, ordered: false, sameLevel: true }, { dimensions: 2, secondaryDimension: "category" }),
          intent("i07", "explain_process", "按组织、内容、行动和覆盖呈现青年宣讲路径", "sequence", { itemCount: 4, ordered: true, sameLevel: false }),
          intent("i08", "explain_topics", "围绕红色朋友圈呈现六类共享联建动作", "hub", { itemCount: 6, ordered: false, sameLevel: true }, { dimensions: 2, secondaryDimension: "category" }),
          intent("i09", "explain_lifecycle", "说明四阶培养链及其制度和导师支撑", "sequence", { itemCount: 3, ordered: true, sameLevel: false }, { temporal: true, dimensions: 2, secondaryDimension: "time" }),
          intent("i10", "organize_matrix", "按信仰、本领、声音和脚步四个维度呈现成效", "matrix", { itemCount: 4, ordered: false, sameLevel: true }, { dimensions: 2, secondaryDimension: "category" }),
          intent("i11", "present_parallel_points", "用总书记嘱托和五类抓手共同收束案例价值", "parallel", { itemCount: 2, ordered: false, sameLevel: false }, { dimensions: 2, secondaryDimension: "domain" }),
          intent("i12", "present_closing", "回扣主题并结束汇报", "none", { itemCount: 2, ordered: false, sameLevel: false }),
        ],
      };
    }

    const visualPages = input.candidateSets.map((set) => {
      const expected = preferredAssets[set.pageId];
      const selected = set.candidates.find((candidate) => candidate.assetId === expected);
      if (!selected) {
        throw new Error(`${set.pageId} 没有视觉导演预期的核心候选 ${expected}；实际为 ${set.candidates.map((item) => item.assetId).join(", ")}`);
      }
      return {
        pageId: set.pageId,
        intentId: set.intentId,
        familyId: selected.familyId,
        variantId: selected.variantId,
        silhouette: selected.silhouette,
        adaptationStatus: selected.adaptationStatus,
        reason: `选择与本页语义关系一致的核心资产 ${selected.assetId}，并使用合法整页编排 ${compositionByPage[set.pageId].compositionId}。`,
      };
    });

    return {
      visualPlan: {
        schemaVersion: "1.0",
        deckId,
        skinId,
        visualLanguage: "沿用东北大学 Skin，以蓝色结构资产承载关键关系，正文页用稳定的左右编排控制信息密度。",
        rhythmStrategy: "在对比、中心辐射、分层、顺序、正文、矩阵之间切换；只在语义适配时调用结构资产。",
        pages: visualPages,
      },
      compositionPlan: {
        schemaVersion: "1.0",
        deckId,
        skinId,
        pages: input.candidateSets.map((set) => ({
          pageId: set.pageId,
          intentId: set.intentId,
          ...compositionByPage[set.pageId],
          reason: `本页内容进入 ${compositionByPage[set.pageId].compositionId} 的既定槽位，不新增临时结构。`,
        })),
      },
    };
  },
};
