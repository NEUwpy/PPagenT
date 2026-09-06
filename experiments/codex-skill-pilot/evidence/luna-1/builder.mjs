import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import JSZip from "jszip";

function findRepoRoot(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if (fsSync.existsSync(path.join(current, ".codex")) && fsSync.existsSync(path.join(current, "src"))) return current;
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`无法从 ${startDir} 找到 PPagenT 仓库根目录`);
    current = parent;
  }
}

const builderDir = path.dirname(fileURLToPath(import.meta.url));
const root = findRepoRoot(builderDir);
const repoModule = (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);
const { FileBlob, PresentationFile } = await import("@oai/artifact-tool");
const { applyTemplateMappedRecipes, exportTemplateMappedQa, prepareTemplateMappedStarter } = await repoModule(path.join("src", "asset-runtime", "template-utils.mjs"));
const { addBox, addLine, addText, qaElementName } = await repoModule(path.join("src", "asset-runtime", "component-builders.mjs"));
const { fitChineseTextToFrame } = await repoModule(path.join("src", "render", "chinese-typography.mjs"));
const { northeasternUniversitySkin } = await repoModule(path.join("src", "runtime", "skins", "northeastern-university-contract.mjs"));
const { invokeStructure, closeStructureRuntime } = await repoModule(path.join(".codex", "skills", "ppagent-structure", "scripts", "invoke.mjs"));

const tmpDir = path.join(root, ".tmp", "codex-skill-pilot", "luna-1");
const evidenceDir = path.join(root, "experiments", "codex-skill-pilot", "evidence", "luna-1");
const qaDir = path.join(evidenceDir, "qa");
const sourcePptx = path.join(root, "assets", "主题", "东北大学-001", "runtime-template.pptx");
const outputPptx = path.join(root, "output", "codex-skill-pilot", "共享设备预约-技能调用验证.pptx");
const starterPptx = path.join(tmpDir, "template-starter.pptx");
const evidencePath = path.join(evidenceDir, "structure-invocations.ndjson");

const COLORS = Object.freeze({
  blue: "#2F5EA8",
  blue2: "#4C88E8",
  pale: "#DCE9FA",
  pale2: "#F3F7FC",
  dark: "#2B2B2B",
  body: "#404040",
  muted: "#6F7D91",
  line: "#AFC6E8",
  white: "#FFFFFF",
  pause: "#B45C5C",
});

// Semantic roles are the current experiment's rule-level roles. They are
// intentionally independent of the older composition slot names used by the
// production page-composition renderer.
const SEMANTIC_ROLES = Object.freeze({
  coreConclusion: { fontSizes: [30, 27, 24], maxLines: 4 },
  groupTitle: { fontSizes: [24, 22, 20], maxLines: 2 },
  body: { fontSizes: [20, 18], maxLines: 6 },
  support: { fontSizes: [18, 16], maxLines: 3 },
  note: { fontSizes: [16, 14], maxLines: 3 },
});

const bodyFrame = northeasternUniversitySkin.bodyFrame;
const qaEntries = [];

async function preserveReferenceThemes() {
  const originalZip = await JSZip.loadAsync(await fs.readFile(sourcePptx));
  const exportedZip = await JSZip.loadAsync(await fs.readFile(outputPptx));
  const themeNames = Object.keys(originalZip.files).filter((name) => /^ppt\/theme\/theme[^/]*\.xml$/.test(name));
  const restored = [];
  for (const name of themeNames) {
    const bytes = await originalZip.file(name).async("nodebuffer");
    const sourceHash = crypto.createHash("sha256").update(bytes).digest("hex");
    exportedZip.file(name, bytes);
    restored.push({ name, sourceHash });
  }
  await fs.writeFile(outputPptx, await exportedZip.generateAsync({ type: "nodebuffer" }));
  const verifiedZip = await JSZip.loadAsync(await fs.readFile(outputPptx));
  return {
    method: "grid-native-style JSZip restore after artifact-tool export",
    files: restored.map((item) => {
      const bytes = verifiedZip.file(item.name).async("nodebuffer");
      return bytes.then((content) => ({ ...item, finalHash: crypto.createHash("sha256").update(content).digest("hex"), matches: crypto.createHash("sha256").update(content).digest("hex") === item.sourceHash }));
    }),
  };
}

function sourceNotes(pageId, title, extra = []) {
  return [
    "[Sources]",
    "- 内容：experiments/codex-skill-pilot/manuscript.md（虚构试稿；非真实事件或实测结果）",
    "- 视觉：assets/主题/东北大学-001/runtime-template.pptx（东北大学 Skin 运行模板）",
    `- 页面：${pageId}｜${title}`,
    ...extra.map((value) => `- PPagenT：${value}`),
    "[/Sources]",
  ].join("\n");
}

function fit(value, frame, roleName, options = {}) {
  const role = roleName === "pageTitle" ? northeasternUniversitySkin.typographyRoles.pageTitle : SEMANTIC_ROLES[roleName];
  if (!role) throw new Error(`未找到 Skin 文字角色：${roleName}`);
  const result = fitChineseTextToFrame(value, {
    ...frame,
    ...role,
    lineHeight: options.lineHeight ?? 1.18,
    preferSemanticBreaks: options.preferSemanticBreaks ?? false,
  });
  if (!result?.fits) throw new Error(`${roleName} 无法在 Skin 允许档位内排下：${value}`);
  return result;
}

function text(slide, value, frame, roleName, options = {}) {
  const result = fit(value, frame, roleName, options);
  const shape = addText(slide, result.text, frame, {
    name: options.name,
    typeface: options.typeface ?? (roleName === "pageTitle" ? northeasternUniversitySkin.typographyRoles.displayTypeface : northeasternUniversitySkin.typographyRoles.bodyTypeface),
    fontSize: result.fontSize,
    bold: options.bold ?? false,
    color: options.color ?? COLORS.body,
    alignment: options.alignment ?? "left",
    verticalAlignment: options.verticalAlignment ?? "top",
    autoFit: "none",
  });
  qaEntries.push({
    pageId: options.pageId,
    elementId: options.name,
    regionId: options.regionId,
    ruleId: options.ruleId ?? "T02",
    frame,
    text: result.text,
    fontSize: result.fontSize,
    semanticRole: roleName,
    alignment: options.alignment ?? "left",
  });
  return shape;
}

function box(slide, frame, options = {}) {
  return addBox(slide, frame, {
    name: options.name,
    geometry: options.geometry ?? "roundRect",
    fill: options.fill ?? COLORS.pale2,
    line: options.line ?? { style: "solid", fill: COLORS.line, width: 1 },
    shadow: options.shadow ?? "shadow-none",
    borderRadius: options.borderRadius ?? 10,
  });
}

function bodyRecipe(pageNumber, section, title, notes) {
  const titleFit = fit(title, { left: 9.04, top: 88.85, width: 1250.55, height: 48.47 }, "pageTitle");
  return {
    sourceSlideNumber: 3,
    textEdits: [
      { sourceText: "01", replacementText: String(pageNumber).padStart(2, "0") },
      { sourceText: "正文页", replacementText: section },
      {
        sourceText: "主旨句",
        replacementText: titleFit.text,
        position: { left: 9.04, top: 88.85, width: 1250.55, height: 48.47 },
        textStyle: {
          typeface: northeasternUniversitySkin.typographyRoles.displayTypeface,
          fontSize: titleFit.fontSize,
          autoFit: "none",
        },
      },
      { sourceText: "正文", replacementText: "", writeMode: "replace-all" },
    ],
    deletions: [
      { kind: "shape", name: "箭头: 下 9" },
      { kind: "image", name: "图片 10" },
    ],
    notes,
  };
}

function addPage2(slide) {
  const pageId = "pilot-boundary";
  const left = { left: 95, top: 222, width: 420, height: 300 };
  box(slide, left, { name: qaElementName({ within: pageId, role: "problem-surface" }), fill: COLORS.pale2 });
  box(slide, { left: 95, top: 222, width: 8, height: 300 }, { name: qaElementName({ within: pageId, role: "problem-accent" }), geometry: "rect", fill: COLORS.blue, line: { style: "solid", fill: "none", width: 0 }, borderRadius: 0 });
  text(slide, "现状问题", { left: 129, top: 250, width: 280, height: 32 }, "groupTitle", { pageId, regionId: "problem", ruleId: "T01", name: qaElementName({ within: pageId, role: "problem-kicker" }), bold: true, color: COLORS.blue });
  text(slide, "预约信息难以追踪", { left: 129, top: 302, width: 300, height: 78 }, "coreConclusion", { pageId, regionId: "problem", ruleId: "C01", name: qaElementName({ within: pageId, role: "problem-title" }), bold: true, color: COLORS.dark });
  text(slide, "申请散落在不同聊天群，管理员\n反复确认设备、日期和负责人；\n临时取消也难及时通知下一位使用者。", { left: 129, top: 402, width: 370, height: 108 }, "body", { pageId, regionId: "problem", ruleId: "T04", name: qaElementName({ within: pageId, role: "problem-body" }), color: COLORS.body });

  const right = { left: 560, top: 222, width: 600, height: 300 };
  text(slide, "试点边界", { left: right.left, top: right.top, width: 230, height: 36 }, "groupTitle", { pageId, regionId: "boundary", ruleId: "T01", name: qaElementName({ within: pageId, role: "boundary-title" }), bold: true, color: COLORS.blue });
  text(slide, "一间实验室的常用设备\n遵守培训与安全要求\n特殊样品由原负责人审核", { left: right.left, top: 270, width: right.width, height: 100 }, "body", { pageId, regionId: "boundary", ruleId: "C03", name: qaElementName({ within: pageId, role: "boundary-body" }), color: COLORS.body });
  addLine(slide, { x: right.left, y: 394 }, { x: right.left + right.width, y: 394 }, COLORS.line, 1, qaElementName({ within: pageId, role: "separator" }));
  text(slide, "为什么不直接推广", { left: right.left, top: 420, width: 310, height: 36 }, "groupTitle", { pageId, regionId: "scale-boundary", ruleId: "C01", name: qaElementName({ within: pageId, role: "scale-title" }), bold: true, color: COLORS.blue });
  text(slide, "未通过试点就扩大范围，可能把尚未理顺的问题放大。先验证预约信息是否真正可追踪，再讨论扩大。", { left: right.left, top: 468, width: right.width, height: 72 }, "body", { pageId, regionId: "scale-boundary", ruleId: "C04", name: qaElementName({ within: pageId, role: "scale-body" }), color: COLORS.body });
}

function addPage3(slide) {
  const pageId = "booking-process";
  const band = { left: 95, top: 178, width: 1090, height: 42 };
  box(slide, band, { name: qaElementName({ within: pageId, role: "safety-band" }), fill: "#FFF7F7", line: { style: "solid", fill: "#E6B8B8", width: 1 }, borderRadius: 8 });
  box(slide, { left: 95, top: 178, width: 8, height: 42 }, { name: qaElementName({ within: pageId, role: "safety-accent" }), geometry: "rect", fill: COLORS.pause, line: { style: "solid", fill: "none", width: 0 }, borderRadius: 0 });
  text(slide, "贯穿规则：任何一步发现安全问题，都要暂停预约并转交负责人处理。", { left: 122, top: 186, width: 1025, height: 26 }, "support", { pageId, regionId: "safety-rule", ruleId: "C03", name: qaElementName({ within: pageId, role: "safety-copy" }), color: COLORS.pause, alignment: "center", verticalAlignment: "middle" });
  const targetFrame = { left: 55, top: 236, width: 1170, height: 382 };
  return invokeStructure({
    root,
    slide,
    skin: northeasternUniversitySkin,
    assetId: "sequence-flow-001",
    parameters: {
      items: [
        { key: "register", title: "登记申请", body: "设备、时间、用途、联系方式" },
        { key: "check", title: "管理员核对", body: "确认设备状态、申请资格与可用时段" },
        { key: "update", title: "使用后更新", body: "提交使用记录与异常说明，更新设备状态" },
      ],
    },
    targetFrame,
    evidencePath,
    pageId,
    regionId: "booking-sequence",
    reason: "稿件明确要求申请、核对、更新三步保留先后顺序；选择 3-step State 以保持每步完整正文且不把安全暂停误作第四步。",
  });
}

function addPage4(slide) {
  const pageId = "tradeoff";
  return invokeStructure({
    root,
    slide,
    skin: northeasternUniversitySkin,
    assetId: "comparison-pros-cons-balance-005",
    parameters: {
      topic: "是否批准共享预约试点",
      pros: ["申请信息集中留痕", "空闲时段容易共享", "异常记录便于追溯"],
      cons: ["初期维护工作增加", "参与者需熟悉新操作", "线下使用仍需补登记"],
      verdict: "收益更值得争取，但先验证维护负担是否可接受",
      balanceState: "收益侧更重",
    },
    targetFrame: bodyFrame,
    evidencePath,
    pageId,
    regionId: "benefit-cost-balance",
    reason: "稿件比较的是同一个试点决策内部的收益与代价，并明确给出收益更值得争取的综合判断；使用收益侧更重的权衡状态。",
  });
}

function addPage5(slide) {
  const pageId = "review-criteria";
  const top = 238;
  const width = 320;
  const gap = 44;
  const xs = [95, 95 + width + gap, 95 + (width + gap) * 2];
  const items = [
    ["可追溯", "能否根据记录还原一次申请的处理过程"],
    ["可释放", "临时取消是否能及时释放时段"],
    ["可承受", "新增维护工作是否超过管理员可承受范围"],
  ];
  items.forEach(([title, body], index) => {
    const x = xs[index];
    if (index > 0) addLine(slide, { x: x - gap / 2, y: top + 8 }, { x: x - gap / 2, y: top + 226 }, COLORS.line, 1, qaElementName({ within: pageId, role: `separator-${index}` }));
    box(slide, { left: x, top, width: 54, height: 54 }, { name: qaElementName({ within: pageId, role: `index-${index}` }), geometry: "ellipse", fill: COLORS.blue, line: { style: "solid", fill: COLORS.blue, width: 1 }, borderRadius: 0 });
    text(slide, String(index + 1), { left: x, top: top + 10, width: 54, height: 28 }, "support", { pageId, regionId: `criterion-${index + 1}`, ruleId: "L02", name: qaElementName({ within: pageId, role: `index-text-${index}` }), bold: true, color: COLORS.white, alignment: "center", verticalAlignment: "middle" });
    text(slide, title, { left: x, top: top + 82, width, height: 42 }, "groupTitle", { pageId, regionId: `criterion-${index + 1}`, ruleId: "T01", name: qaElementName({ within: pageId, role: `title-${index}` }), bold: true, color: COLORS.dark });
    text(slide, body, { left: x, top: top + 138, width, height: 84 }, "body", { pageId, regionId: `criterion-${index + 1}`, ruleId: "C03", name: qaElementName({ within: pageId, role: `body-${index}` }), color: COLORS.body });
  });
  text(slide, "负责人根据记录和参与者反馈，决定继续、修改或停止。", { left: 95, top: 580, width: 1090, height: 36 }, "note", { pageId, regionId: "review-decision", ruleId: "C04", name: qaElementName({ within: pageId, role: "decision-note" }), color: COLORS.muted, alignment: "left", verticalAlignment: "middle" });
}

function addPage6(slide) {
  const pageId = "approval-conditions";
  const left = { left: 95, top: 224, width: 500, height: 270 };
  box(slide, left, { name: qaElementName({ within: pageId, role: "decision-surface" }), fill: COLORS.pale2 });
  box(slide, { left: 95, top: 224, width: 8, height: 270 }, { name: qaElementName({ within: pageId, role: "decision-accent" }), geometry: "rect", fill: COLORS.blue, line: { style: "solid", fill: "none", width: 0 }, borderRadius: 0 });
  text(slide, "建议批准小范围试点", { left: 132, top: 260, width: 410, height: 76 }, "coreConclusion", { pageId, regionId: "approval", ruleId: "C01", name: qaElementName({ within: pageId, role: "approval-title" }), bold: true, color: COLORS.dark });
  text(slide, "先验证预约信息是否可追踪，以及维护负担是否可接受。", { left: 132, top: 360, width: 400, height: 82 }, "body", { pageId, regionId: "approval", ruleId: "C04", name: qaElementName({ within: pageId, role: "approval-body" }), color: COLORS.body });
  text(slide, "启动前确认", { left: 700, top: 230, width: 320, height: 42 }, "groupTitle", { pageId, regionId: "start-conditions", ruleId: "T01", name: qaElementName({ within: pageId, role: "conditions-title" }), bold: true, color: COLORS.blue });
  text(slide, "一名日常维护负责人\n培训要求与异常处理联系人\n小范围设备清单与参与者范围", { left: 700, top: 294, width: 440, height: 150 }, "body", { pageId, regionId: "start-conditions", ruleId: "C04", name: qaElementName({ within: pageId, role: "conditions-body" }), color: COLORS.body });
  addLine(slide, { x: 700, y: 480 }, { x: 1140, y: 480 }, COLORS.line, 1, qaElementName({ within: pageId, role: "conditions-separator" }));
  text(slide, "扩大范围另行讨论，以复盘结论为依据。", { left: 700, top: 505, width: 440, height: 42 }, "note", { pageId, regionId: "scale-decision", ruleId: "C05", name: qaElementName({ within: pageId, role: "scale-note" }), color: COLORS.muted });
}

function coverRecipe() {
  return {
    sourceSlideNumber: 1,
    textEdits: [
      { sourceText: "MDM方法偏移量自适应选取", replacementText: "共享设备开放预约试点", position: { left: 16.98, top: 198.16, width: 1252.71, height: 169.4 }, textStyle: { typeface: northeasternUniversitySkin.typographyRoles.displayTypeface, fontSize: 64, autoFit: "none", alignment: "center", verticalAlignment: "middle" } },
      { sourceText: "汇报人：魏鹏宇", replacementText: "虚构试稿 · 讨论是否批准小范围试点", position: { left: 240, top: 400, width: 800, height: 76 }, textStyle: { typeface: northeasternUniversitySkin.typographyRoles.displayTypeface, fontSize: 30, autoFit: "none", alignment: "center", verticalAlignment: "middle" } },
      { sourceText: "2026.07.20", replacementText: "实验中心管理讨论稿｜2026.09", position: { left: 390, top: 548, width: 500, height: 72 }, textStyle: { typeface: northeasternUniversitySkin.typographyRoles.bodyTypeface, fontSize: 24, autoFit: "none", alignment: "center", verticalAlignment: "middle" } },
    ],
    notes: sourceNotes("cover", "共享设备开放预约试点", ["显式使用东北大学 Skin cover；内容标注为虚构试稿"]),
  };
}

function closingRecipe() {
  return {
    sourceSlideNumber: 4,
    textEdits: [
      { sourceText: "敬请老师批评指正", replacementText: "建议批准小范围试点\n复盘后再讨论是否扩大范围", position: { left: 42, top: 174, width: 1196, height: 210 }, textStyle: { typeface: northeasternUniversitySkin.typographyRoles.displayTypeface, fontSize: 40, autoFit: "none", alignment: "center", verticalAlignment: "middle" } },
    ],
    notes: sourceNotes("closing", "小范围批准，复盘后再决定是否扩大", ["使用东北大学 Skin closing；未引入任何虚构结果"]),
  };
}

async function main() {
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.appendFile(evidencePath, `${JSON.stringify({ at: new Date().toISOString(), event: "run-start", run: "revision-1-semantic-and-export-checks" })}\n`, "utf8");
  const recipes = [
    coverRecipe(),
    bodyRecipe(1, "问题与边界", "先把预约信息收拢，再谈扩大范围", sourceNotes("pilot-boundary", "先把预约信息收拢，再谈扩大范围")),
    bodyRecipe(2, "运行流程", "预约流程保留三步，安全暂停贯穿其中", sourceNotes("booking-process", "预约流程保留三步，安全暂停贯穿其中", ["调用 sequence-flow-001；安全暂停使用页内原生规则带"])),
    bodyRecipe(3, "收益与代价", "收益值得争取，但维护负担必须实测", sourceNotes("tradeoff", "收益值得争取，但维护负担必须实测", ["调用 comparison-pros-cons-balance-005；balanceState=收益侧更重"])),
    bodyRecipe(4, "复盘标准", "复盘只看三件可核验的事", sourceNotes("review-criteria", "复盘只看三件可核验的事")),
    bodyRecipe(5, "批准条件", "批准条件要清楚，范围先保持可控", sourceNotes("approval-conditions", "批准条件要清楚，范围先保持可控")),
    closingRecipe(),
  ];

  await prepareTemplateMappedStarter({ sourcePptx, sourceSlideNumbers: recipes.map((recipe) => recipe.sourceSlideNumber), starterPptx });
  const presentation = await PresentationFile.importPptx(await FileBlob.load(starterPptx));
  const slides = await applyTemplateMappedRecipes(presentation, recipes);
  try {
    addPage2(slides[1]);
    await addPage3(slides[2]);
    await addPage4(slides[3]);
    addPage5(slides[4]);
    addPage6(slides[5]);

    const nativeChecks = qaEntries.map((item) => ({
      ...item,
      withinBodyFrame: item.frame.left >= bodyFrame.left && item.frame.top >= bodyFrame.top && item.frame.left + item.frame.width <= bodyFrame.left + bodyFrame.width && item.frame.top + item.frame.height <= bodyFrame.top + bodyFrame.height,
      nonEmptyText: Boolean(String(item.text ?? "").trim()),
      fontAtOrAboveCandidateFloor: item.fontSize >= 16,
    }));
    const report = {
      generatedAt: new Date().toISOString(),
      outputPptx,
      slideCount: slides.length,
      template: sourcePptx,
      skin: northeasternUniversitySkin.id,
      structureAssets: ["sequence-flow-001", "comparison-pros-cons-balance-005"],
      nativeTextGeometryChecks: {
        entries: nativeChecks,
        allWithinBodyFrame: nativeChecks.every((item) => item.withinBodyFrame),
        allNonEmptyText: nativeChecks.every((item) => item.nonEmptyText),
        allManualTextAtOrAbove16: nativeChecks.every((item) => item.fontAtOrAboveCandidateFloor),
      },
      checks: [
        "模板页身份元素保留并通过 mapped recipe 生成",
        "手工原生文字/形状区域在 Skin Content Frame 内",
        "手工文本已按 Skin 候选角色测量，未使用 shrinkText",
        "结构调用事件写入 structure-invocations.ndjson",
        "每页已导出 PNG 与 layout JSON",
      ],
      unimplementedOrNotClaimed: [
        "未向模型输入页面图片；未做模型视觉审查",
        "未运行全仓测试",
        "未把 PNG 的人工审美/阅读顺序判断写成程序 QA 通过",
        "结构组件内部实际文字墨迹与最终渲染截图需外部人工复核",
      ],
    };

    await fs.mkdir(path.dirname(outputPptx), { recursive: true });
    const pptx = await PresentationFile.exportPptx(presentation);
    await pptx.save(outputPptx);
    report.themePreservation = await preserveReferenceThemes();
    report.themePreservation.files = await Promise.all(report.themePreservation.files);
    await exportTemplateMappedQa(presentation, qaDir);
    const inspect = await presentation.inspect({ kind: "slide,textbox,shape,image,notes,layout", maxChars: 300000 });
    await fs.writeFile(path.join(evidenceDir, "inspect.ndjson"), inspect.ndjson, "utf8");
    const exportedRecords = inspect.ndjson.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    const exportedText = exportedRecords.filter((record) => record.kind === "textbox" && record.text !== undefined);
    const exportedShapes = exportedRecords.filter((record) => record.kind === "shape");
    const bboxOf = (record) => Array.isArray(record.bbox) && record.bbox.length === 4
      ? { left: record.bbox[0], top: record.bbox[1], width: record.bbox[2], height: record.bbox[3] }
      : null;
    const outOfCanvasObjects = [...exportedText, ...exportedShapes].filter((record) => {
      const bbox = bboxOf(record);
      return bbox && !(bbox.left >= -0.5 && bbox.top >= -0.5 && bbox.left + bbox.width <= 1280.5 && bbox.top + bbox.height <= 720.5);
    });
    const allExportedObjectsWithinCanvas = outOfCanvasObjects.length === 0;
    const contentOutOfCanvasObjects = outOfCanvasObjects.filter((record) => record.slide >= 2 && record.slide <= 6);
    const actualManualText = exportedText.filter((record) => String(record.name ?? "").startsWith("PPAGENT_QA|"));
    const manualTextByPage = new Map();
    actualManualText.forEach((record) => {
      const list = manualTextByPage.get(record.slide) ?? [];
      list.push(record);
      manualTextByPage.set(record.slide, list);
    });
    const unintendedManualTextOverlaps = [];
    for (const [slideNumber, records] of manualTextByPage.entries()) {
      for (let i = 0; i < records.length; i += 1) {
        const a = bboxOf(records[i]);
        if (!a) continue;
        for (let j = i + 1; j < records.length; j += 1) {
          const b = bboxOf(records[j]);
          if (!b) continue;
          const overlapWidth = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
          const overlapHeight = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
          if (overlapWidth > 0.5 && overlapHeight > 0.5) unintendedManualTextOverlaps.push({ slide: slideNumber, a: records[i].name, b: records[j].name, overlap: { width: overlapWidth, height: overlapHeight } });
        }
      }
    }
    const layoutTextStyles = [];
    function collectLayoutTextStyles(value, slideNumber) {
      if (!value || typeof value !== "object") return;
      if (typeof value.name === "string" && value.resolvedTextStyle?.alignment) {
        layoutTextStyles.push({ slide: slideNumber, name: value.name, alignment: value.resolvedTextStyle.alignment });
      }
      if (Array.isArray(value)) value.forEach((item) => collectLayoutTextStyles(item, slideNumber));
      else Object.values(value).forEach((item) => collectLayoutTextStyles(item, slideNumber));
    }
    for (let slideNumber = 1; slideNumber <= slides.length; slideNumber += 1) {
      const layoutPath = path.join(qaDir, `slide-${String(slideNumber).padStart(2, "0")}.layout.json`);
      collectLayoutTextStyles(JSON.parse(await fs.readFile(layoutPath, "utf8")), slideNumber);
    }
    const relevantAlignmentRows = layoutTextStyles.filter((row) => (
      row.name.startsWith("PPAGENT_QA|")
      || row.name.startsWith("sequence-")
      || row.name.startsWith("balance-")
      || row.name.startsWith("benefit-")
      || row.name.startsWith("risk-")
    ));
    const bodyTextAlignmentRows = relevantAlignmentRows.filter((row) => !row.name.includes("role=index-text-"));
    const alignmentByPage = {};
    bodyTextAlignmentRows.forEach((row) => {
      const values = alignmentByPage[row.slide] ?? new Set();
      values.add(row.alignment);
      alignmentByPage[row.slide] = values;
    });
    const alignmentSummary = Object.fromEntries(Object.entries(alignmentByPage).map(([slideNumber, values]) => [slideNumber, [...values]]));
    report.nativeTextGeometryChecks = {
      ...report.nativeTextGeometryChecks,
      exportedObjectCount: exportedRecords.length,
      exportedTextboxCount: exportedText.length,
      exportedShapeCount: exportedShapes.length,
      allExportedObjectsWithinCanvas,
      allGeneratedContentWithinCanvas: contentOutOfCanvasObjects.length === 0,
      templateInheritedOutOfCanvasObjects: outOfCanvasObjects.filter((record) => record.slide === 1 || record.slide === slides.length).map((record) => ({ slide: record.slide, kind: record.kind, name: record.name, bbox: record.bbox })),
      manualTextActualLinesAndBboxes: actualManualText.map((record) => ({
        slide: record.slide,
        name: record.name,
        textLines: record.textLines ?? null,
        bbox: record.bbox ?? null,
        nonEmptyText: Boolean(String(record.text ?? "").trim()),
      })),
      unintendedManualTextOverlaps,
      allManualTextNonEmptyAfterExport: actualManualText.every((record) => Boolean(String(record.text ?? "").trim())),
      relevantActualAlignmentByPage: alignmentSummary,
      allRelevantPagesUseSingleAlignment: Object.values(alignmentByPage).every((values) => values.size <= 1),
      alignmentScope: "正文对齐汇总排除复盘页编号圆内的数字标记；编号标记单独作为视觉标记检查，不作为正文段落对齐。",
    };
    report.checks.push("基于 presentation.inspect 的最终对象记录检查画布边界、文本行数/包围盒与手工文本间重叠");
    report.unimplementedOrNotClaimed.push("结构组件与模板继承层的所有意图性叠放未纳入手工文本重叠判断");
    await fs.writeFile(path.join(evidenceDir, "qa-report.json"), JSON.stringify(report, null, 2), "utf8");
    await fs.writeFile(path.join(evidenceDir, "content-and-layout.json"), JSON.stringify({
      source: "experiments/codex-skill-pilot/manuscript.md",
      pagePlan: recipes.map((recipe, index) => ({ page: index + 1, sourceSlideNumber: recipe.sourceSlideNumber, notes: recipe.notes })),
      selectedStructures: [
        { pageId: "booking-process", assetId: "sequence-flow-001", state: "3 steps", reason: "strict order in manuscript" },
        { pageId: "tradeoff", assetId: "comparison-pros-cons-balance-005", state: "3 benefits + 3 costs + benefits heavier", reason: "single decision trade-off with explicit verdict" },
      ],
      nativePages: ["pilot-boundary", "review-criteria", "approval-conditions"],
    }, null, 2), "utf8");
    console.log(JSON.stringify({ outputPptx, evidenceDir, qaDir, slideCount: slides.length }));
  } finally {
    await closeStructureRuntime();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
