import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import {
  applyTemplateMappedRecipes,
  exportTemplateMappedQa,
  prepareTemplateMappedStarter,
} from "../../src/asset-runtime/template-utils.mjs";
import { auditRenderedDeck } from "../../src/tools/audit-rendered-typography.mjs";
import { renderPageComposition } from "../../src/render/page-composition.mjs";
import { closeHtmlComponentRuntime, renderStructureAsset } from "../../src/runtime/assets.mjs";
import { northeasternUniversitySkin } from "../../src/runtime/skins/northeastern-university-contract.mjs";
import { composeStructureWithAside } from "./page-composer.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const outputDir = path.join(root, "output", "page-composition-v1");
const qaDir = path.join(outputDir, "qa");
const starterPptx = path.join(outputDir, ".runtime", "starter.pptx");
const outputPptx = path.join(outputDir, "page-composition-v1.pptx");
const sourcePptx = path.join(root, "assets", "主题", "东北大学-001", "runtime-template.pptx");

const pageBrief = {
  schemaVersion: "0.1",
  pageId: "page-01",
  pageJob: "让读者理解 PPagenT 从先构图到原生输出的工作方式",
  audienceMove: "把结构资产理解为整页模板 → 把 Skill 理解为区域内的设计能力",
  coreMessage: "页面先完成宏观构图，再调用结构 Skill。",
  rhythm: "dense",
  content: {
    title: "页面先构图，再调用结构 Skill",
    items: [
      { id: "step-1", title: "内容定页", body: "冻结本页主旨与三步关系" },
      { id: "step-2", title: "区域编排", body: "分配结构区与解释区" },
      { id: "step-3", title: "原生生成", body: "各 Skill 汇入可编辑 PPTX" },
      {
        id: "takeaway",
        title: "关键变化",
        body: "Structure Skill 不再占据整页，而是作为区域组件参与组合。",
        emphasis: true,
      },
    ],
  },
  structure: {
    skillId: "sequence-flow-001",
    sourceItemIds: ["step-1", "step-2", "step-3"],
  },
  aside: { sourceItemIds: ["takeaway"] },
};

const composition = composeStructureWithAside({
  pageBrief,
  bodyFrame: northeasternUniversitySkin.bodyFrame,
  structureFootprint: { width: 930, height: 382 },
});
if (!composition.accepted) throw new Error(`PageComposition rejected: ${composition.reason}`);

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "page-brief.json"), `${JSON.stringify(pageBrief, null, 2)}\n`, "utf8");
await fs.writeFile(path.join(outputDir, "page-composition.json"), `${JSON.stringify(composition, null, 2)}\n`, "utf8");

await prepareTemplateMappedStarter({
  sourcePptx,
  sourceSlideNumbers: [3],
  starterPptx,
});
const presentation = await PresentationFile.importPptx(await FileBlob.load(starterPptx));
const [slide] = await applyTemplateMappedRecipes(presentation, [{
  sourceSlideNumber: 3,
  textEdits: [
    { sourceText: "01", replacementText: "01" },
    { sourceText: "正文页", replacementText: "架构验证" },
    {
      sourceText: "主旨句",
      replacementText: pageBrief.content.title,
      position: { left: 9.04, top: 88.85, width: 1250.55, height: 48.47 },
      textStyle: {
        typeface: northeasternUniversitySkin.typographyRoles.displayTypeface,
        fontSize: 32,
        autoFit: "none",
      },
    },
    { sourceText: "正文", replacementText: "", writeMode: "replace-all" },
  ],
  deletions: [
    { kind: "shape", name: "箭头: 下 9" },
    { kind: "image", name: "图片 10" },
  ],
  notes: [
    "[Sources]",
    "- 内容：PPagenT PageComposition 最小架构实验",
    "- 视觉：assets/主题/东北大学-001/runtime-template.pptx",
    "- 结构：sequence-flow-001",
    "[/Sources]",
  ].join("\n"),
}]);

try {
  const { componentFrame } = renderPageComposition(
    slide,
    pageBrief.content,
    composition.layout,
    composition,
    northeasternUniversitySkin.bodyFrame,
    northeasternUniversitySkin.typographyRoles,
  );
  await renderStructureAsset(slide, {
    assetId: "sequence-flow-001",
    parameters: {
      title: pageBrief.content.title,
      items: pageBrief.content.items.slice(0, 3).map((item) => ({
        key: item.id,
        title: item.title,
        body: item.body,
      })),
    },
  }, northeasternUniversitySkin, componentFrame, root);

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPptx);
  await exportTemplateMappedQa(presentation, qaDir);
  const quality = await auditRenderedDeck(qaDir, {
    minimumFontSize: 12,
    tolerance: 0.5,
    requiredQaSlides: ["slide-01"],
  });
  await fs.writeFile(path.join(outputDir, "quality.json"), `${JSON.stringify(quality, null, 2)}\n`, "utf8");
  if (quality.status !== "passed") throw new Error(`Render quality failed: ${quality.status}`);
  console.log(JSON.stringify({ outputPptx, preview: path.join(qaDir, "slide-01.png"), composition, quality }, null, 2));
} finally {
  await closeHtmlComponentRuntime();
}
