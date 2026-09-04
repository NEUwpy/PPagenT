import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import {
  applyTemplateMappedRecipes,
  exportTemplateMappedQa,
  prepareTemplateMappedStarter,
} from "../../src/asset-runtime/template-utils.mjs";
import { loadCompositionLayouts } from "../../src/composition/layouts.mjs";
import { renderPageComposition } from "../../src/render/page-composition.mjs";
import { fitChineseTextToFrame } from "../../src/render/chinese-typography.mjs";
import { auditRenderedDeck } from "../../src/tools/audit-rendered-typography.mjs";
import { closeHtmlComponentRuntime, renderStructureAsset } from "../../src/runtime/assets.mjs";
import { northeasternUniversitySkin } from "../../src/runtime/skins/northeastern-university-contract.mjs";
import { composeStructureWithAside } from "./page-composer.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const experimentDir = path.join(root, "experiments", "page-composition-v1");
const outputDir = path.join(root, "output", "page-composition-v1", "manuscript-trial");
const qaDir = path.join(outputDir, "qa");
const starterPptx = path.join(outputDir, ".runtime", "starter.pptx");
const outputPptx = path.join(outputDir, "为什么做PPagenT-PageComposition试跑.pptx");
const sourcePptx = path.join(root, "assets", "主题", "东北大学-001", "runtime-template.pptx");
const manuscriptSource = "稿件/为什么做PPagenT-v1.md";
const priorRunDir = path.join(
  root,
  "experiments",
  "正式生成-候选决策验证-20260902",
  "为什么做PPagenT",
  "run-r2",
);

const bodyContents = JSON.parse(await fs.readFile(
  path.join(priorRunDir, "content", "attempt-01", "page-contents.json"),
  "utf8",
));
const priorPayloads = JSON.parse(await fs.readFile(
  path.join(priorRunDir, "visual", "attempt-01", "render-payloads.json"),
  "utf8",
));
const payloadByIntent = new Map(priorPayloads.map((payload) => [payload.intentId, payload]));
const contentById = new Map(bodyContents.map((content) => [content.pageId, content]));

function normalizedFrame(frame, within) {
  return {
    left: (frame.left - within.left) / within.width,
    top: (frame.top - within.top) / within.height,
    width: frame.width / within.width,
    height: frame.height / within.height,
  };
}

function fullStructurePlan(pageId) {
  return {
    pageId,
    compositionId: "component-full",
    textSlots: [],
  };
}

function editorialPlan(pageId, compositionId, textSlots) {
  return { pageId, compositionId, textSlots };
}

function payload(intentId) {
  const value = payloadByIntent.get(intentId);
  if (!value) throw new Error(`Missing persisted payload: ${intentId}`);
  return value;
}

function content(pageId) {
  const value = contentById.get(pageId);
  if (!value) throw new Error(`Missing persisted page content: ${pageId}`);
  return structuredClone(value);
}

const p5Content = content("p5");
p5Content.items.push({
  id: "p5-takeaway",
  title: "控制边界",
  body: "AI 只负责理解与路由；稳定的视觉结果仍由规则和代码完成。",
  emphasis: true,
});
const p5Composition = composeStructureWithAside({
  pageBrief: {
    pageId: "p5",
    pageJob: "解释 AI、规则与代码的职责边界",
    rhythm: "dense",
    structure: { skillId: "sequence-flow-001", sourceItemIds: ["p5-structure-1", "p5-structure-2", "p5-structure-3"] },
    aside: { sourceItemIds: ["p5-takeaway"] },
  },
  bodyFrame: northeasternUniversitySkin.bodyFrame,
  structureFootprint: { width: 930, height: 382 },
});
if (!p5Composition.accepted) throw new Error(`p5 composition rejected: ${p5Composition.reason}`);
p5Composition.compositionId = p5Composition.layout.id;

const p7Content = content("p7");
p7Content.items.unshift({
  id: "p7-lead",
  title: "一次建设，多次复用",
  body: "把视觉理解和审美判断从每次生成前移到能力建设期。",
  emphasis: true,
});

const p8Content = content("p8");
p8Content.items.unshift({
  id: "p8-lead",
  title: "积累判断经验",
  body: "模板只是表面，真正可复用的是内容、容量、变化和失败边界。",
  emphasis: true,
});

const p10Content = content("p10");
p10Content.items.unshift({
  id: "p10-thesis",
  title: "把重复判断变成生产能力",
  body: "让不太会做 PPT 的人，也能快速得到一套靠谱、好用、仍可继续修改的演示。",
  emphasis: true,
});

const pages = [
  {
    kind: "cover",
    pageId: "shell-cover",
    section: "",
    content: { pageId: "shell-cover", title: "把 PPT 生成变成可靠的生产过程", items: [] },
    payload: payload("shell-cover-intent"),
  },
  {
    kind: "agenda",
    pageId: "shell-agenda",
    section: "",
    content: { pageId: "shell-agenda", title: "目录", items: [] },
    payload: payload("shell-agenda-intent"),
  },
  {
    kind: "body", pageId: "p1", section: "判断成本", content: content("p1"),
    payload: payload("p1-intent"), plan: fullStructurePlan("p1"),
  },
  {
    kind: "body", pageId: "p2", section: "可靠性", content: content("p2"),
    payload: payload("p2-intent"), plan: fullStructurePlan("p2"),
  },
  {
    kind: "body", pageId: "p3", section: "可靠性", content: content("p3"),
    payload: payload("p3-intent"),
    plan: editorialPlan("p3", "editorial-dual-statement", [
      { slotId: "left", sourceItemIds: ["p3-item1"], contentMode: "full" },
      { slotId: "right", sourceItemIds: ["p3-item2"], contentMode: "full" },
    ]),
  },
  {
    kind: "body", pageId: "p4", section: "可靠性", content: content("p4"),
    payload: payload("p4-intent"), plan: fullStructurePlan("p4"),
  },
  {
    kind: "body", pageId: "p5", section: "能力积累", content: p5Content,
    payload: payload("p5-intent"), plan: p5Composition,
  },
  {
    kind: "body", pageId: "p6", section: "能力积累", content: content("p6"),
    payload: payload("p6-intent"), plan: fullStructurePlan("p6"),
  },
  {
    kind: "body", pageId: "p7", section: "能力积累", content: p7Content,
    payload: payload("p7-intent"),
    plan: editorialPlan("p7", "component-lead-top", [
      { slotId: "lead", sourceItemIds: ["p7-lead"], contentMode: "full" },
    ]),
  },
  {
    kind: "body", pageId: "p8", section: "能力积累", content: p8Content,
    payload: payload("p8-intent"),
    plan: editorialPlan("p8", "editorial-list", [
      { slotId: "lead", sourceItemIds: ["p8-lead"], contentMode: "full" },
      { slotId: "body", sourceItemIds: ["p8-item1", "p8-item2", "p8-item3", "p8-item4", "p8-item5"], contentMode: "full" },
    ]),
  },
  {
    kind: "body", pageId: "p9", section: "扩展目标", content: content("p9"),
    payload: payload("p9-intent"),
    plan: editorialPlan("p9", "editorial-focus-reverse", [
      { slotId: "primary", sourceItemIds: ["p9-item1"], contentMode: "full" },
      { slotId: "support", sourceItemIds: ["p9-item2", "p9-item3", "p9-item4", "p9-item5"], contentMode: "full" },
    ]),
  },
  {
    kind: "body", pageId: "p10", section: "扩展目标", content: p10Content,
    payload: payload("p10-intent"),
    plan: editorialPlan("p10", "editorial-single-focus", [
      { slotId: "primary", sourceItemIds: ["p10-thesis", "p10-item1", "p10-item2", "p10-item3"], contentMode: "full" },
    ]),
  },
  {
    kind: "closing",
    pageId: "shell-closing",
    section: "",
    content: { pageId: "shell-closing", title: "", items: [] },
    payload: payload("shell-closing-intent"),
  },
];

function fitSkinText(value, frame, roleName, options = {}) {
  const role = northeasternUniversitySkin.typographyRoles[roleName];
  const result = fitChineseTextToFrame(value, { ...frame, ...role, ...options });
  if (!result?.fits) throw new Error(`${roleName} text does not fit: ${value}`);
  return result;
}

function notesFor(page) {
  return [
    "[Sources]",
    `- 内容：${manuscriptSource}`,
    "- 视觉：assets/主题/东北大学-001/runtime-template.pptx",
    `- 页面编排：${page.plan?.compositionId ?? page.kind}`,
    ...(page.kind === "body" && page.payload.assetId !== "northeastern-university-body-001"
      ? [`- 结构资产：${page.payload.assetId}`]
      : []),
    "[/Sources]",
  ].join("\n");
}

function recipeFor(page, bodyIndex) {
  if (page.kind === "cover") {
    const titleFrame = { left: 16.98, top: 198.16, width: 1252.71, height: 169.4 };
    const title = fitSkinText(page.payload.parameters.title, titleFrame, "coverTitle", { preferSemanticBreaks: true });
    return {
      sourceSlideNumber: 1,
      textEdits: [
        { sourceText: "MDM方法偏移量自适应选取", replacementText: title.text, position: titleFrame,
          textStyle: { typeface: northeasternUniversitySkin.typographyRoles.displayTypeface, fontSize: title.fontSize, autoFit: "none", alignment: "center", verticalAlignment: "middle" } },
        { sourceText: "汇报人：魏鹏宇", replacementText: "产品架构试跑", position: { left: 240, top: 400, width: 800, height: 76 },
          textStyle: { typeface: northeasternUniversitySkin.typographyRoles.displayTypeface, fontSize: 20, autoFit: "none", alignment: "center", verticalAlignment: "middle" } },
        { sourceText: "2026.07.20", replacementText: "PageComposition · 2026.09", position: { left: 390, top: 548, width: 500, height: 72 },
          textStyle: { typeface: northeasternUniversitySkin.typographyRoles.bodyTypeface, fontSize: 14, autoFit: "none", alignment: "center", verticalAlignment: "middle" } },
      ],
      notes: notesFor(page),
    };
  }
  if (page.kind === "agenda") {
    const frame = { left: 135, top: 205, width: 1010, height: 350 };
    const text = page.payload.parameters.items.map((item, index) => `${index + 1}. ${item}`).join("\n");
    const fitted = fitSkinText(text, frame, "agendaItems");
    return {
      sourceSlideNumber: 2,
      textEdits: [
        { sourceText: "目录", replacementText: "目录" },
        { sourceText: "1. 定义问题\n2. 真参数未知如何实现“样本-最优偏移量”的选择\n3. 一些关于神经网络的验证\n4. 论文准备\n5. 下一个研究课题", replacementText: fitted.text,
          position: frame, textStyle: { typeface: northeasternUniversitySkin.typographyRoles.bodyTypeface, fontSize: fitted.fontSize, autoFit: "none", verticalAlignment: "middle" }, writeMode: "replace-all" },
      ],
      notes: notesFor(page),
    };
  }
  if (page.kind === "closing") {
    const frame = { left: 42, top: 174, width: 1196, height: 210 };
    const fitted = fitSkinText(page.payload.parameters.text, frame, "closingTitle", { preferSemanticBreaks: true });
    return {
      sourceSlideNumber: 4,
      textEdits: [{ sourceText: "敬请老师批评指正", replacementText: fitted.text, position: frame,
        textStyle: { typeface: northeasternUniversitySkin.typographyRoles.displayTypeface, fontSize: fitted.fontSize, autoFit: "none", alignment: "center", verticalAlignment: "middle" } }],
      notes: notesFor(page),
    };
  }
  const frame = { left: 9.04, top: 88.85, width: 1250.55, height: 48.47 };
  const fitted = fitSkinText(page.content.title, frame, "pageTitle");
  return {
    sourceSlideNumber: 3,
    textEdits: [
      { sourceText: "01", replacementText: String(bodyIndex).padStart(2, "0") },
      { sourceText: "正文页", replacementText: page.section },
      { sourceText: "主旨句", replacementText: fitted.text, position: frame,
        textStyle: { typeface: northeasternUniversitySkin.typographyRoles.displayTypeface, fontSize: fitted.fontSize, autoFit: "none" } },
      { sourceText: "正文", replacementText: "", writeMode: "replace-all" },
    ],
    deletions: [
      { kind: "shape", name: "箭头: 下 9" },
      { kind: "image", name: "图片 10" },
    ],
    notes: notesFor(page),
  };
}

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(experimentDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "page-compositions.json"), `${JSON.stringify(pages.map((page) => ({
  pageId: page.pageId,
  contentTitle: page.content.title,
  payloadAssetId: page.payload.assetId,
  composition: page.plan ?? null,
})), null, 2)}\n`, "utf8");
await fs.writeFile(path.join(outputDir, "source-notes.txt"), [
  `Content: ${manuscriptSource}`,
  "Pagination and semantic payloads: persisted run-r2 artifacts",
  "Visual source: assets/主题/东北大学-001/runtime-template.pptx",
  "Trial scope: PageComposition macro layout before region Skill rendering",
].join("\n"), "utf8");

let bodyIndex = 0;
const recipes = pages.map((page) => recipeFor(page, page.kind === "body" ? ++bodyIndex : 0));
await prepareTemplateMappedStarter({
  sourcePptx,
  sourceSlideNumbers: recipes.map((recipe) => recipe.sourceSlideNumber),
  starterPptx,
});
const presentation = await PresentationFile.importPptx(await FileBlob.load(starterPptx));
const slides = await applyTemplateMappedRecipes(presentation, recipes);
const layouts = await loadCompositionLayouts(root);

try {
  for (const [index, page] of pages.entries()) {
    if (page.kind !== "body") continue;
    const layout = page.plan.layout ?? layouts.get(page.plan.compositionId);
    if (!layout) throw new Error(`Missing composition layout: ${page.plan.compositionId}`);
    const { componentFrame } = renderPageComposition(
      slides[index],
      page.content,
      layout,
      page.plan,
      northeasternUniversitySkin.bodyFrame,
      northeasternUniversitySkin.typographyRoles,
    );
    if (layout.requiresComponent) {
      if (!componentFrame) throw new Error(`${page.pageId} has no component frame`);
      await renderStructureAsset(slides[index], page.payload, northeasternUniversitySkin, componentFrame, root);
    }
  }

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPptx);
  await exportTemplateMappedQa(presentation, qaDir);
  const quality = await auditRenderedDeck(qaDir, {
    minimumFontSize: 12,
    tolerance: 0.5,
    requiredQaSlides: pages
      .map((page, index) => page.kind === "body" ? `slide-${String(index + 1).padStart(2, "0")}` : null)
      .filter(Boolean),
  });
  await fs.writeFile(path.join(outputDir, "quality.json"), `${JSON.stringify(quality, null, 2)}\n`, "utf8");
  if (quality.status !== "passed") throw new Error(`Render quality failed: ${quality.status}`);
  console.log(JSON.stringify({ outputPptx, qaDir, pageCount: pages.length, quality }, null, 2));
} finally {
  await closeHtmlComponentRuntime();
}
