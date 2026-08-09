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
      "来源锚点必须能在 source 中逐字定位",
    ],
  };
}

function assertSchemas(schemas) {
  const required = ["contentDirector", "contentReview", "visualIntent", "visualComposition", "visualReview"];
  const missing = required.filter((key) => !schemas?.[key]);
  if (missing.length) throw new Error(`DirectorProvider 缺少输出 schema：${missing.join(", ")}`);
  return schemas;
}

export function createModelDirectorProvider({ contentModel, visualModel, reviewerModel, schemas }) {
  const content = assertModel(contentModel, "contentModel");
  const visual = assertModel(visualModel, "visualModel");
  const reviewer = assertModel(reviewerModel, "reviewerModel");
  const outputs = assertSchemas(schemas);
  return {
    metadata: {
      providerKind: "live-schema-aware-model-provider",
      contentModel: content.identity ?? "unknown",
      visualModel: visual.identity ?? "unknown",
      reviewerModel: reviewer.identity ?? "unknown",
    },
    contentDirector(input) {
      return content.generateJson({
        role: "PPagenT 内容导演",
        task: "在整套尺度决定叙事弧、页数、页序、每页职责、拆分和轻重；输出 deckPlan 与 pageContents。",
        context: {
          ...sourceRule(input.rawMarkdown),
          attempt: input.attempt,
          previous: input.previous,
          previousReview: input.previousReview,
          visualFeedback: input.visualFeedback,
        },
        outputSchema: outputs.contentDirector,
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
    visualDirector(input) {
      if (input.phase === "intent") {
        return visual.generateJson({
          role: "PPagenT 视觉导演",
          task: "只判断每页表达目的和语义关系，输出 pageIntents；此阶段不得选择资产。",
          context: { attempt: input.attempt, skinId: input.skinId, deckPlan: input.deckPlan, pageContents: input.pageContents },
          outputSchema: outputs.visualIntent,
        });
      }
      return visual.generateJson({
        role: "PPagenT 视觉导演",
        task: "只从每页 candidateSets 中选择 familyId/variantId，并在整套尺度控制轮廓重复与节奏；candidateSets 为空时不得自创结构、借用实验变体或伪造资产 ID，必须等待程序失败关闭并回到资产蒸馏；输出 VisualPlan。",
        context: {
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
