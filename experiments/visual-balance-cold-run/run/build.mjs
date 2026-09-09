import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PresentationFile } from "@oai/artifact-tool";
import { createNortheasternUniversityStarter } from "../../../src/runtime/skins/northeastern-university.mjs";
import { invokeUniversityStructure, closeStructureRuntime, universityMckinseySkin, universityMckinseyTypography } from "../../../src/runtime/invoke-university-structure.mjs";
import { resolveComposition, buildComposition } from "../../../src/composition/resolve.mjs";
import { addBox, addText } from "../../../src/asset-runtime/component-builders.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const variant = process.argv[2] === "final" ? "final" : "first";
const outDir = path.join(here, variant);
const bodyFrame = universityMckinseySkin.bodyFrame;
const bodyFont = universityMckinseySkin.fonts.body;
const displayFont = universityMckinseySkin.fonts.display;
const blue = universityMckinseySkin.primaryColor ?? universityMckinseySkin.componentTheme?.primaryColor ?? "#315F91";
const dark = universityMckinseySkin.dark ?? "#2B2B2B";
const textColor = universityMckinseySkin.body ?? "#404040";
const muted = universityMckinseySkin.muted ?? "#6F6F6F";
const line = "#D7E0EA";
const pale = "#F5F8FC";

await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(path.join(here, ".runtime"), { recursive: true });
const plans = JSON.parse(await fs.readFile(path.join(here, "composition-intent.json"), "utf8"));
const planById = new Map(plans.pages.map((p) => [p.pageId, p.compositionIntent]));

const pageSpecs = [
  { pageId: "P2", title: "分级准入让每个阶段产生下一阶段需要的证据", sectionName: "过程与门槛", assetId: "northeastern-university-body-001" },
  { pageId: "P3", title: "三类模拟证据共同支持先做B的限量试点", sectionName: "多证据论证", assetId: "northeastern-university-body-001" },
  { pageId: "N1", title: "统一镜像适合先做通用课程试点，特殊依赖保留定制决策", sectionName: "比较决策", assetId: "northeastern-university-body-001" },
  { pageId: "N2", title: "晚间预约与未使用率同时上升，先核对需求与履约再评估容量", sectionName: "多证据论证", assetId: "northeastern-university-body-001" },
  { pageId: "N3", title: "开放共享数据集须同时满足授权、去标识与维护责任", sectionName: "条件与行动", assetId: "northeastern-university-body-001" },
].map((p) => ({
  ...p,
  payload: { assetId: p.assetId, parameters: {} },
  content: { pageId: p.pageId, title: p.title },
  meta: { sectionName: p.sectionName },
  intent: { intentId: `visual-balance-cold-run-${p.pageId}` },
  decision: { selectedAssetId: p.assetId },
}));

function frameText(slide, value, frame, options = {}) {
  return addText(slide, value, frame, {
    typeface: options.typeface ?? bodyFont,
    fontSize: options.fontSize ?? universityMckinseyTypography.body,
    color: options.color ?? textColor,
    bold: options.bold ?? false,
    verticalAlignment: options.verticalAlignment ?? "top",
    alignment: options.alignment ?? "left",
    autoFit: "none",
    insets: { left: 0, right: 0, top: 0, bottom: 0 },
    name: options.name,
  });
}

function surface(slide, frame, fill = pale) {
  return addBox(slide, frame, { geometry: "rect", fill, line: { style: "solid", fill: line, width: 1 }, shadow: "shadow-none", borderRadius: 0 });
}

function divider(slide, x, y, width, color = line) {
  return addBox(slide, { left: x, top: y, width, height: 1 }, { geometry: "rect", fill: color, line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-none", borderRadius: 0 });
}

function drawP2(slide, id, frame) {
  if (id === "process") {
    const pad = 18; const inner = { left: frame.left + pad, top: frame.top + pad, width: frame.width - pad * 2, height: frame.height - pad * 2 };
    frameText(slide, "三阶段过程", { left: inner.left, top: inner.top, width: inner.width, height: 28 }, { fontSize: universityMckinseyTypography.heading, bold: true, color: blue });
    const rows = [
      ["01  登记与资格核对｜第1—2天", "收集六项信息；责任人确认数据使用范围，项目属于低风险试点。交付带编号申请记录，缺项退回补齐且不占名额。"],
      ["02  限量运行与异常记录｜第1—2周", "最多纳入5个项目，使用统一环境模板；记录实际参数、输出位置和异常处理人。"],
      ["03  复核与有限扩围｜第3周评审", "复核两周记录、异常闭环和管理员工作量，决定是否增加项目类型或名额。"],
    ];
    const top = inner.top + 42; const gap = 14; const h = (inner.height - 42 - gap * 2) / 3;
    rows.forEach((r, i) => {
      const y = top + i * (h + gap);
      if (i) divider(slide, inner.left, y - gap / 2, inner.width);
      frameText(slide, r[0], { left: inner.left, top: y, width: inner.width, height: 28 }, { fontSize: universityMckinseyTypography.heading, bold: true, color: dark });
      frameText(slide, r[1], { left: inner.left, top: y + 34, width: inner.width, height: h - 38 }, { fontSize: universityMckinseyTypography.body, color: textColor });
    });
  } else if (id === "gates") {
    const pad = 18; surface(slide, frame, "#F8FAFD");
    frameText(slide, "进入与扩围门槛", { left: frame.left + pad, top: frame.top + pad, width: frame.width - pad * 2, height: 30 }, { fontSize: universityMckinseyTypography.heading, bold: true, color: blue });
    frameText(slide, "阶段一→二\n六项信息齐全，责任人完成环境确认。\n\n阶段二→三\n记录完整率达到90%以上；高风险异常在1个工作日内有责任人和处置结论。\n\n扩围条件\n连续两周完整率达到95%以上；无未关闭高风险异常；管理员负荷不超过每周3个工作日。", { left: frame.left + pad, top: frame.top + 58, width: frame.width - pad * 2, height: frame.height - 76 }, { fontSize: universityMckinseyTypography.body, color: textColor });
  } else {
    surface(slide, frame, "#FFFFFF");
    frameText(slide, "不满足扩围条件：保留当前试点规模，先修订字段、环境模板或异常规则，再决定是否重启评审。保留已产生记录，不静默删除失败项目。", { left: frame.left + 18, top: frame.top + 12, width: frame.width - 36, height: frame.height - 24 }, { fontSize: universityMckinseyTypography.body, color: textColor, verticalAlignment: "middle" });
  }
}

function drawN1(slide, id, frame) {
  if (id === "decision") {
    surface(slide, frame, "#F5F8FC");
    frameText(slide, "建议与验证边界", { left: frame.left + 18, top: frame.top + 14, width: frame.width - 36, height: 28 }, { fontSize: universityMckinseyTypography.heading, bold: true, color: blue });
    frameText(slide, "先在3门通用课程试点两周，记录启动失败次数、恢复时间和教师反馈；特殊课程先确认依赖，再决定复用或定制。试点未结束前不承诺节省比例；若兼容问题影响授课，回到原环境并保留日志。", { left: frame.left + 18, top: frame.top + 52, width: frame.width - 36, height: frame.height - 64 }, { fontSize: universityMckinseyTypography.body, color: textColor });
    return;
  }
  const isUnified = id === "unified";
  const title = isUnified ? "统一镜像" : "每课定制";
  const rows = isUnified
    ? [["准备", "6个管理员工作日"], ["维护", "0.5个工作日/周"], ["优势", "同一版本便于复现"], ["限制", "特殊依赖不能直接覆盖"]]
    : [["准备", "18个管理员工作日"], ["维护", "2个工作日/周"], ["优势", "适配特殊版本"], ["限制", "版本追踪与更新责任分散"]];
  surface(slide, frame, isUnified ? "#F6F9FD" : "#FBFCFE");
  frameText(slide, title, { left: frame.left + 20, top: frame.top + 16, width: frame.width - 40, height: 32 }, { fontSize: universityMckinseyTypography.heading, bold: true, color: blue });
  const top = frame.top + 66; const rowH = (frame.height - 84) / rows.length;
  rows.forEach((r, i) => { const y = top + i * rowH; if (i) divider(slide, frame.left + 20, y - 8, frame.width - 40); frameText(slide, r[0], { left: frame.left + 20, top: y, width: 80, height: rowH - 8 }, { fontSize: universityMckinseyTypography.body, bold: true, color: blue, verticalAlignment: "middle" }); frameText(slide, r[1], { left: frame.left + 118, top: y, width: frame.width - 138, height: rowH - 8 }, { fontSize: universityMckinseyTypography.body, color: textColor, verticalAlignment: "middle" }); });
}

function drawN3(slide, id, frame) {
  if (id === "decision") {
    surface(slide, frame, "#F5F8FC");
    frameText(slide, "共同行动与边界", { left: frame.left + 18, top: frame.top + 12, width: frame.width - 36, height: 28 }, { fontSize: universityMckinseyTypography.heading, bold: true, color: blue });
    frameText(slide, "三项同时满足才进入小范围试用；任一缺失则保留内部版本，列出补齐责任与证据。试用阶段收集可复现性、字段缺失和错误报告；扩大范围前重新核对授权是否覆盖新增用途。本页为模拟工作方案，不表示任何实际数据已经通过审核。", { left: frame.left + 18, top: frame.top + 48, width: frame.width - 36, height: frame.height - 58 }, { fontSize: universityMckinseyTypography.body, color: textColor });
    return;
  }
  const data = {
    auth: ["授权", "每个来源有可追溯许可，限定用途与再分发范围；来源不清的数据暂不纳入。"],
    deid: ["去标识", "移除直接标识并复核组合字段的再识别风险；不能只删除姓名。"],
    maint: ["维护", "明确版本负责人、问题反馈渠道和撤回机制；发布后能追踪更正。"],
  }[id];
  surface(slide, frame, "#FAFBFD");
  frameText(slide, data[0], { left: frame.left + 16, top: frame.top + 16, width: frame.width - 32, height: 30 }, { fontSize: universityMckinseyTypography.heading, bold: true, color: blue });
  divider(slide, frame.left + 16, frame.top + 56, frame.width - 32, blue);
  frameText(slide, data[1], { left: frame.left + 16, top: frame.top + 76, width: frame.width - 32, height: frame.height - 96 }, { fontSize: universityMckinseyTypography.body, color: textColor });
}

async function renderPage(page, slide, intent) {
  const id = page.pageId;
  const contracts = id === "P2"
    ? { process: { minWidth: 680, minHeight: 300 }, gates: { minWidth: 380, minHeight: 300 }, fallback: { minWidth: 1080, minHeight: 100 } }
    : id === "N1"
      ? { unified: { minWidth: 520, minHeight: 290 }, custom: { minWidth: 520, minHeight: 290 }, decision: { minWidth: 1080, minHeight: 150 } }
      : id === "N3"
        ? { auth: { minWidth: 350, minHeight: 300 }, deid: { minWidth: 350, minHeight: 300 }, maint: { minWidth: 350, minHeight: 300 }, decision: { minWidth: 1080, minHeight: 150 } }
        : { [id === "P3" ? "evidence" : "signals"]: { minWidth: 1170, minHeight: 492 } };
  const resolved = resolveComposition({ pageId: id, intent, bodyFrame, contracts, style: { gap: 28, innerGap: 20 } });
  const builders = {};
  for (const group of intent.groups) {
    builders[group.id] = async ({ frame }) => {
      if (id === "P3" || id === "N2") {
        const assetId = id === "P3" ? "parallel-folded-notes-grid-002" : "parallel-folded-notes-grid-002";
        const content = id === "P3" ? {
          title: "先做B的限量试点，三周复核再决定扩围",
          items: [
            { key: "demand", title: "需求集中", body: "74/120来自三个集群（61.7%）；52份用同一GPU模板", iconKey: "layout-grid" },
            { key: "gaps", title: "记录缺口", body: "14/78缺参数或输出位置（17.9%）；其中9份来自两个集群", iconKey: "clipboard-check" },
            { key: "capacity", title: "管理员容量", body: "全量5.0日/周高于3.5日；限量5项目2.6日，稳定后1.4日", iconKey: "clock" },
            { key: "judgement", title: "综合判断", body: "三类证据支持试点范围与评审节奏，不证明已提升效率", iconKey: "scale" },
            { key: "boundary", title: "验证边界", body: "无随机对照且可能受课程周期影响；阶段二记录工时与异常闭环", iconKey: "route-off" },
          ],
        } : {
          title: "先核对高峰期需求与空约原因，再评估容量",
          items: [
            { key: "volume", title: "四周总量", body: "总预约80/100/120/120；晚间48/65/84/90次", iconKey: "calendar-stats" },
            { key: "unused", title: "未使用率", body: "未使用8/10/24/30次；占比10%/10%/20%/25%", iconKey: "calendar-off" },
            { key: "boundary", title: "口径边界", body: "两类记录可能重叠，不能相加；数据不证明容量不足", iconKey: "scale" },
            { key: "action", title: "核对动作", body: "抽查第4周30条，区分取消、需求变化与故障；记录排队和利用率", iconKey: "search" },
          ],
        };
        await invokeUniversityStructure({ root, slide, assetId, content, targetFrame: frame, evidencePath: path.join(outDir, `${id}-structure.ndjson`), pageId: id, regionId: group.id, reason: intent.fitStrategy });
        if (id === "P3") frameText(slide, "模拟观察；无随机对照，必须用阶段二与阶段三记录校准。", { left: 70, top: 635, width: 1140, height: 18 }, { fontSize: universityMckinseyTypography.meta, color: muted });
        else frameText(slide, "模拟观察；两类记录可能重叠，不能将比例相加。", { left: 70, top: 635, width: 1140, height: 18 }, { fontSize: universityMckinseyTypography.meta, color: muted });
      } else if (id === "P2") drawP2(slide, group.id, frame);
      else if (id === "N1") drawN1(slide, group.id, frame);
      else if (id === "N3") drawN3(slide, group.id, frame);
      return { drawn: true };
    };
  }
  const receipt = await buildComposition({ resolved, builders });
  return { resolved, receipt };
}

const starter = await createNortheasternUniversityStarter({ pages: pageSpecs, starterPptx: path.join(here, ".runtime", `template-starter-${variant}.pptx`), manuscriptSource: "experiments/visual-balance-cold-run/manuscript.md" });
const resolvedAll = []; const receiptAll = [];
try {
  for (const [i, page] of pageSpecs.entries()) {
    const result = await renderPage(page, starter.slides[i], planById.get(page.pageId));
    resolvedAll.push(result.resolved); receiptAll.push(result.receipt);
    starter.slides[i].speakerNotes.textFrame.setText(`[Sources]\n- 内容：experiments/visual-balance-cold-run/manuscript.md（模拟材料）\n- 结构与编排：${page.pageId} 由 resolveComposition/buildComposition 执行\n[/Sources]`);
  }
} finally { await closeStructureRuntime(); }
await fs.writeFile(path.join(outDir, "resolved-composition.json"), JSON.stringify(resolvedAll, null, 2), "utf8");
await fs.writeFile(path.join(outDir, "build-receipt.json"), JSON.stringify(receiptAll, null, 2), "utf8");
const draftPath = path.join(outDir, `visual-balance-${variant}-draft.pptx`);
await (await PresentationFile.exportPptx(starter.presentation)).save(draftPath);
if (variant === "final") {
  const skillDir = "C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations";
  process.env.RUNTIME_NODE_MODULES = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
  const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools/artifact_tool_utils.mjs")).href);
  const stagingDir = path.join(here, ".codex-finalizer"); await fs.mkdir(stagingDir, { recursive: true });
  const finalPath = path.join(outDir, "visual-balance-cold-run.pptx");
  await finalizePresentation({
    explicitTotalSlideCount: 5,
    candidatePath: draftPath,
    finalPath,
    workspaceDir: here,
    sourceTemplatePath: path.join(root, "assets/主题/东北大学-001/runtime-template.pptx"),
    requiredTemplateReferenceSlides: [1, 2, 3],
    minimumTemplateCoverageRatio: 0.8,
    pythonExecutable: "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
    integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
    layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
    layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
    verifyArtifactToolImport: true,
    receiptPath: path.join(stagingDir, "validation.json"),
  });
}
console.log(JSON.stringify({ variant, draftPath, finalPath: variant === "final" ? path.join(outDir, "visual-balance-cold-run.pptx") : null }, null, 2));
