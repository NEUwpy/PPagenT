import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PresentationFile } from "../../src/ppt-engine/index.mjs";
import { Presentation } from "../../src/ppt-engine/index.mjs";
import { addText, addBox } from "../../src/asset-runtime/component-builders.mjs";
import { renderStructureAsset, closeHtmlComponentRuntime } from "../../src/runtime/legacy-structure-assets.mjs";
import { renderNortheasternUniversityDeck } from "../../src/runtime/skins/northeastern-university.mjs";
import { northeasternUniversitySkin } from "../../src/runtime/skins/northeastern-university-contract.mjs";
import { neutralEditorialTheme } from "../../src/runtime/skins/neutral-editorial-theme.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts");
const bodyFrame = { left: 55, top: 166, width: 1170, height: 492 };
const payload = {
  assetId: "argument-evidence-conclusion-001",
  parameters: {
    claim: {
      title: "先核验信息，再决定是否扩大试点",
      body: "当前建议先改进入口，再观察是否值得扩大覆盖。",
    },
    evidences: [
      { key: "interview", title: "访谈记录", body: "支持“办理入口难找”" },
      { key: "process", title: "流程记录", body: "支持“交接等待”" },
      { key: "boundary", title: "样本边界", body: "只覆盖试点部门，不能外推全部部门" },
    ],
    conclusion: {
      title: "先修复试点，再评估扩大范围",
      body: "其他部门仍需补充记录；本轮材料不足以证明普遍存在同样问题。",
    },
  },
};

const page = {
  content: { pageId: "p1", title: "证据支撑判断", items: [] },
  payload,
  intent: { intentId: "argument-evidence" },
  decision: { selectedAssetId: payload.assetId },
  meta: { sectionName: "核心判断" },
  composition: { compositionId: "component-full", textSlots: [], componentItemIds: [] },
};

function addNeutralRule(slide, x1, y1, x2, y2, color = "#D7D4CA", width = 1) {
  slide.shapes.add({
    geometry: "line",
    position: { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), horizontalFlip: x2 < x1, verticalFlip: y2 < y1 },
    fill: "none",
    line: { style: "solid", fill: color, width },
  });
}

function addNeutralHeader(slide) {
  slide.background.fill = "#F5F4EF";
  addText(slide, "01", { left: 56, top: 48, width: 24, height: 24 }, {
    name: "neutral-section-number", typeface: "Noto Sans SC", fontSize: 18, color: "#A35D4F", verticalAlignment: "middle",
  });
  addText(slide, "证据支撑判断", { left: 91, top: 44, width: 230, height: 36 }, {
    name: "neutral-page-title", typeface: "Noto Serif SC", fontSize: 25, bold: true, color: "#201F1D", verticalAlignment: "middle",
  });
  addNeutralRule(slide, 338, 60.5, 1220, 60.5);
  addText(slide, "灰稿 01 · 判断与依据", { left: 56, top: 679, width: 240, height: 18 }, {
    name: "neutral-footer-label", typeface: "Noto Sans SC", fontSize: 11, color: "#85837B", verticalAlignment: "middle",
  });
  addText(slide, "01", { left: 1198, top: 679, width: 26, height: 18 }, {
    name: "neutral-folio", typeface: "Noto Sans SC", fontSize: 11, color: "#85837B", alignment: "right", verticalAlignment: "middle",
  });
}

const neutralSkin = {
  id: "neutral-editorial-001",
  bodyFrame,
  componentSourceFrame: bodyFrame,
  componentTheme: { ...neutralEditorialTheme, structureColorMode: "continuous-tone-v1" },
};

async function buildNeutral() {
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  const slide = presentation.slides.add();
  addNeutralHeader(slide);
  await renderStructureAsset(slide, payload, neutralSkin, bodyFrame, root);
  slide.speakerNotes.textFrame.setText([
    "[Sources]",
    "- 内容：experiments/gray-structure-coverage-20260926/artifacts/state.json · pageId=p1",
    "- 结构：argument-evidence-conclusion-001",
    "- Skin：neutral-editorial-001",
    "[/Sources]",
  ].join("\n"));
  await (await PresentationFile.exportPptx(presentation)).save(path.join(out, "gray-01-neutral.pptx"));
}

async function buildUniversity() {
  await renderNortheasternUniversityDeck({
    root,
    pages: [page],
    sourcePptx: path.join(root, "assets/主题/东北大学-001/runtime-template.pptx"),
    outputPptx: path.join(out, "gray-01-university.pptx"),
    qaDir: path.join(out, "qa-university"),
    manuscriptSource: "experiments/gray-structure-coverage-20260926/artifacts/state.json · pageId=p1",
    templateSourceKind: "bundled-runtime",
  });
}

await fs.mkdir(out, { recursive: true });
await buildNeutral();
await buildUniversity();
await closeHtmlComponentRuntime();
console.log(JSON.stringify({ neutral: path.join(out, "gray-01-neutral.pptx"), university: path.join(out, "gray-01-university.pptx") }, null, 2));
