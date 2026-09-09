import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import { createNortheasternUniversityStarter } from "../../../src/runtime/skins/northeastern-university.mjs";
import {
  closeStructureRuntime,
  invokeUniversityStructure,
  universityMckinseySkin,
  universityMckinseyTypography,
} from "../../../src/runtime/invoke-university-structure.mjs";
import { addBox, addText } from "../../../src/asset-runtime/component-builders.mjs";
import { resolveStructureTheme } from "../../../src/visual-runtime/html-component-theme.mjs";
import { reserveRegions } from "../regions.mjs";

const root = path.resolve(import.meta.dirname, "../../..");
const outDir = import.meta.dirname;
const buildDir = path.join(outDir, ".build");
const runtimeDir = path.join(buildDir, "runtime");
const bundledNodeModules = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const bundledNode = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe";
const bundledPython = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
const skillDir = "C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations";
const manuscriptSource = "experiments/layout-reservation-pilot/manuscript.md";
const arrangements = ["visual-left", "visual-right", "visual-top"];
const bodyFrame = universityMckinseySkin.bodyFrame;
const typography = universityMckinseyTypography;
const theme = resolveStructureTheme(universityMckinseySkin);

process.env.RUNTIME_NODE = bundledNode;
process.env.RUNTIME_NODE_MODULES = bundledNodeModules;
process.env.RUNTIME_PYTHON = bundledPython;

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(runtimeDir, { recursive: true });
const linkPath = path.join(buildDir, "node_modules");
try { await fs.symlink(bundledNodeModules, linkPath, "junction"); } catch (error) { if (error.code !== "EEXIST") throw error; }

const ladderContent = {
  levels: [
    { key: "recordable", title: "可记录", body: "" },
    { key: "traceable", title: "可追溯", body: "" },
    { key: "reusable", title: "可复用", body: "" },
  ],
  showStatus: false,
};

const arrangementLabels = {
  "visual-left": "左图右文",
  "visual-right": "左文右图",
  "visual-top": "上图下文",
};

function makePages(run) {
  return arrangements.map((arrangement, index) => ({
    content: { pageId: `layout-reservation-${run}-${arrangement}`, title: "扩围评审需要三项边界同时成立" },
    meta: { sectionName: run === "first-draft" ? `预留编排 ${index + 1}` : arrangementLabels[arrangement] },
    intent: { intentId: "layout-reservation-pilot" },
    decision: { selectedAssetId: "progression-maturity-steps-002" },
    payload: { assetId: "northeastern-university-body-001", parameters: {} },
  }));
}

function text(slide, value, frame, style = {}) {
  return addText(slide, value, frame, {
    typeface: universityMckinseySkin.fonts.body,
    fontSize: typography.body,
    color: theme.body,
    autoFit: "none",
    verticalAlignment: "top",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    ...style,
  });
}

function heading(slide, value, frame, style = {}) {
  return text(slide, value, frame, {
    fontSize: typography.heading,
    bold: true,
    color: theme.primaryColor,
    ...style,
  });
}

function rule(slide, left, top, width) {
  return addBox(slide, { left, top, width, height: 1 }, {
    geometry: "rect",
    fill: theme.line,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-none",
    borderRadius: 0,
  });
}

function addRevision02Narrative(slide, region, arrangement) {
  if (arrangement === "visual-top") {
    const x = region.left + 24;
    const y = region.top + 18;
    const w = region.width - 48;
    heading(slide, "本方案失败：narrative 区容量不足", { left: x, top: y, width: w, height: 26 });
    text(slide,
      "固定 narrative 高度为 181px。若保持正文 18，需要同时分出能力定义、进入门槛、三项条件、暂停规则和下一次检查，当前区域无法容纳完整层级。该页保留结构调用作为失败证据，不报告为通过。",
      { left: x, top: y + 36, width: w, height: region.height - 54 },
      { fontSize: typography.body },
    );
    return { status: "failure", reason: "narrative 高度 181px 无法在正文 18 下承载完整五组语义层级" };
  }

  const x = region.left + 24;
  // Keep the complete narrative inside the reserved rectangle by translating
  // the complete semantic group upward. Body text remains at 18px and the
  // original spacing and full wording stay intact.
  const y = region.top + 42;
  const w = region.width - 48;
  const labelW = Math.min(300, w);
  heading(slide, "能力形成", { left: x, top: y, width: labelW, height: 26 });
  rule(slide, x, y + 32, w);
  text(slide, "可记录：基本台账齐全。", { left: x, top: y + 44, width: w, height: 24 }, { fontSize: typography.body });
  text(slide, "可追溯：任务来源、执行参数与输出相互关联。", { left: x, top: y + 70, width: w, height: 24 }, { fontSize: typography.body });
  text(slide, "可复用：关键步骤经复核，适用边界清楚。", { left: x, top: y + 96, width: w, height: 24 }, { fontSize: typography.body });
  text(slide, "只有前一阶段证据具备，才进入下一阶段。\n尚未可复用，不能宣称跨项目推广。", { left: x, top: y + 124, width: w, height: 48 }, { fontSize: typography.body });

  const expansionTop = y + 190;
  heading(slide, "扩围三项边界", { left: x, top: expansionTop, width: labelW, height: 26 });
  rule(slide, x, expansionTop + 32, w);
  text(slide, "人员：责任人能够持续履职。", { left: x, top: expansionTop + 44, width: w, height: 24 }, { fontSize: typography.body });
  text(slide, "资源：设备与支持能力可以覆盖。", { left: x, top: expansionTop + 70, width: w, height: 24 }, { fontSize: typography.body });
  text(slide, "方法：适用范围与例外清楚。", { left: x, top: expansionTop + 96, width: w, height: 24 }, { fontSize: typography.body });
  text(slide, "任一条件不满足，就暂停扩围，保留当前试点规模，明确补齐任务。", { left: x, top: expansionTop + 124, width: w, height: 44 }, { fontSize: typography.body });
  text(slide, "下一次讨论先检查证据是否达到门槛，\n再讨论增加项目。", { left: x, top: expansionTop + 172, width: w, height: 44 }, { fontSize: typography.body });
  return { status: "success" };
}

function addNarrative(slide, region, arrangement, run) {
  if (run === "revision-02") return addRevision02Narrative(slide, region, arrangement);
  const pad = 24;
  const x = region.left + pad;
  const y = region.top + 18;
  const w = region.width - pad * 2;
  const h = region.height - 30;
  if (arrangement === "visual-top") {
    const colGap = 36;
    const colW = (w - colGap) / 2;
    const left = { left: x, top: y, width: colW, height: h };
    const right = { left: x + colW + colGap, top: y, width: colW, height: h };
    heading(slide, "能力形成", { left: left.left, top: left.top, width: left.width, height: 26 });
    text(slide,
      "可记录：基本台账齐全。\n可追溯：任务来源、执行参数与输出相互关联。\n可复用：关键步骤经复核，适用边界清楚。\n只有前一阶段证据具备，才进入下一阶段；尚未可复用，不能宣称跨项目推广。",
      { left: left.left, top: left.top + 32, width: left.width, height: h - 32 },
      { fontSize: typography.body, color: theme.body },
    );
    heading(slide, "扩围三项边界", { left: right.left, top: right.top, width: right.width, height: 26 });
    text(slide,
      "人员：责任人能够持续履职。\n资源：设备与支持能力可以覆盖。\n方法：适用范围与例外清楚。\n任一条件不满足，暂停扩围，保留当前试点规模并明确补齐任务。下一次讨论先检查证据是否达到门槛，再讨论增加项目。",
      { left: right.left, top: right.top + 32, width: right.width, height: h - 32 },
      { fontSize: typography.body, color: theme.body },
    );
    return;
  }

  const labelW = Math.min(300, w);
  heading(slide, "能力形成", { left: x, top: y, width: labelW, height: 26 });
  rule(slide, x, y + 32, w);
  text(slide,
    "可记录：基本台账齐全。\n可追溯：任务来源、执行参数与输出相互关联。\n可复用：关键步骤经复核，适用边界清楚。\n只有前一阶段证据具备，才进入下一阶段；尚未可复用，不能宣称跨项目推广。",
    { left: x, top: y + 44, width: w, height: 118 },
    { fontSize: typography.body },
  );
  heading(slide, "扩围三项边界", { left: x, top: y + 184, width: labelW, height: 26 });
  rule(slide, x, y + 216, w);
  text(slide,
    "人员：责任人能够持续履职。资源：设备与支持能力可以覆盖。方法：适用范围与例外清楚。\n任一条件不满足，暂停扩围，保留当前试点规模并明确补齐任务。下一次讨论先检查证据是否达到门槛，再讨论增加项目。",
    { left: x, top: y + 228, width: w, height: h - 228 },
    { fontSize: typography.body },
  );
}

function writeRunMetadata(run, regions, records, outputPptx) {
  return fs.writeFile(path.join(outDir, `run-${run}.json`), JSON.stringify({
    run,
    model: "gpt-5.6-luna",
    reasoning: "high",
    skin: universityMckinseySkin.id,
    layout: "mckinsey",
    bodyFrame,
    arrangements,
    regions,
    records,
    outputPptx,
    manuscriptSource,
  }, null, 2));
}

async function renderSlides(pptxPath, renderDir) {
  await fs.mkdir(renderDir, { recursive: true });
  const imported = await PresentationFile.importPptx(await FileBlob.load(pptxPath));
  for (const [index, slide] of imported.slides.items.entries()) {
    const png = await imported.export({ slide, format: "png", scale: 1 });
    await fs.writeFile(path.join(renderDir, `slide-${index + 1}.png`), new Uint8Array(await png.arrayBuffer()));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(renderDir, `slide-${index + 1}.layout.json`), await layout.text());
  }
}

async function build(run) {
  const pptxPath = path.join(outDir, `layout-reservation-luna-high-${run}.pptx`);
  const evidencePath = path.join(outDir, `structure-calls-${run}.ndjson`);
  try { await fs.rm(evidencePath); } catch {}
  const regions = Object.fromEntries(arrangements.map((id) => [id, reserveRegions(bodyFrame, id)]));
  await fs.writeFile(path.join(outDir, `regions-${run}.json`), JSON.stringify(regions, null, 2));
  const pages = makePages(run);
  const { presentation, slides } = await createNortheasternUniversityStarter({
    starterPptx: path.join(runtimeDir, `template-starter-${run}.pptx`),
    pages,
    manuscriptSource,
  });

  const records = [];
  try {
    for (const [index, arrangement] of arrangements.entries()) {
      const region = regions[arrangement];
      const record = { arrangement, region, assetId: "progression-maturity-steps-002", status: "pending" };
      try {
        const invocation = await invokeUniversityStructure({
          root,
          slide: slides[index],
          assetId: "progression-maturity-steps-002",
          content: ladderContent,
          targetFrame: region.visual,
          evidencePath,
          pageId: pages[index].content.pageId,
          regionId: `${arrangement}-visual`,
          reason: "先按预留编排放入成熟度阶梯，图内保留阶段名；完整能力定义与扩围条件全部留在 narrative 区。",
        });
        record.status = "success-rendered-unreviewed";
        record.invocation = invocation;
      } catch (error) {
        record.status = "failure";
        record.error = { name: error.name, code: error.code ?? null, message: error.message };
      }
      // Narrative is written only inside the computed narrative rectangle.
      record.narrative = addNarrative(slides[index], region.narrative, arrangement, run);
      records.push(record);
    }
    const draft = await PresentationFile.exportPptx(presentation);
    await draft.save(pptxPath);
  } finally {
    await closeStructureRuntime();
  }
  await renderSlides(pptxPath, path.join(outDir, `renders-${run}`));
  await writeRunMetadata(run, regions, records, pptxPath);
  return { pptxPath, records, regions };
}

const run = process.argv[2] ?? "first-draft";
if (!new Set(["first-draft", "revision-01", "revision-02"]).has(run)) throw new Error("run must be first-draft, revision-01, or revision-02");
const result = await build(run);
console.log(JSON.stringify(result, null, 2));
