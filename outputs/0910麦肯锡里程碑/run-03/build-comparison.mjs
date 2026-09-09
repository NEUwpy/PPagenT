import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { pathToFileURL } from "node:url";

const workspaceDir = "C:/PPagenT/outputs/0910麦肯锡里程碑/run-03";
const buildDir = path.join(workspaceDir, ".comparison-build");
const finalPath = path.join(workspaceDir, "deliverables", process.env.COMPARISON_OUTPUT_NAME ?? "对照.pptx");
const receiptPath = path.join(buildDir, `${process.env.COMPARISON_OUTPUT_NAME ?? "对照.pptx"}.validation.json`);
const skillDir = "C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations";
const runtimeNodeModules = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools/artifact_tool_utils.mjs")).href);

await fs.mkdir(buildDir, { recursive: true });
const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });

const COLORS = Object.freeze({ black: "#252525", body: "#454545", muted: "#777777", soft: "#F6F6F6" });
const FONT = "Microsoft YaHei";

function addText(slide, text, position, { size = 18, color = COLORS.body, bold = false, align = "left", name } = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: FONT,
    fontSize: size,
    color,
    bold,
    alignment: align,
    verticalAlignment: "top",
    autoFit: "none",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

function addBand(slide, text, position) {
  const shape = slide.shapes.add({
    geometry: "rect",
    position,
    fill: COLORS.soft,
    line: { fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: FONT,
    fontSize: 18,
    color: COLORS.black,
    bold: true,
    alignment: "left",
    verticalAlignment: "middle",
    autoFit: "none",
    insets: { top: 0, right: 16, bottom: 0, left: 16 },
  };
  return shape;
}

function addNotes(slide, text) {
  slide.speakerNotes.textFrame.setText(`[Sources]\n- 内容：C:/PPagenT/outputs/0910麦肯锡里程碑/run-03/inputs/01-响应变慢.md\n- 用途：原稿与整理后内容对照\n${text ? `- 说明：${text}\n` : ""}[/Sources]`);
}

function addRawSlide(index, total, title, body) {
  const slide = presentation.slides.add();
  slide.background.fill = "#FFFFFF";
  addText(slide, `原稿页 ${index}/${total}`, { left: 72, top: 48, width: 220, height: 28 }, { size: 16, color: COLORS.muted });
  addText(slide, title, { left: 72, top: 88, width: 1120, height: 54 }, { size: 30, color: COLORS.black, bold: true });
  addText(slide, body, { left: 72, top: 166, width: 1136, height: 480 }, { size: 18, color: COLORS.body });
  addNotes(slide, "原文按顺序保留，仅以手动换行保证可读性。");
  return slide;
}

function addOrganizedSlide(index, title, lead, body, note) {
  const slide = presentation.slides.add();
  slide.background.fill = "#FFFFFF";
  addText(slide, `整理后页 ${index}/4`, { left: 72, top: 48, width: 240, height: 28 }, { size: 16, color: COLORS.muted });
  addText(slide, title, { left: 72, top: 88, width: 1136, height: 58 }, { size: 30, color: COLORS.black, bold: true });
  addText(slide, lead, { left: 72, top: 166, width: 1136, height: 54 }, { size: 21, color: COLORS.black, bold: true });
  addText(slide, body, { left: 72, top: 244, width: 1136, height: 356 }, { size: 18, color: COLORS.body });
  addText(slide, note, { left: 72, top: 628, width: 1136, height: 30 }, { size: 14, color: COLORS.muted });
  addNotes(slide, "整理后页面由原稿事实、条件和边界重新编排；未加入原稿之外的事实。");
  return slide;
}

// 原稿区：完整保留原文顺序和文字，按自然容量连续铺排。
addRawSlide(1, 2, "服务台响应观察", [
  "以下是模拟工作记录。负责人希望在下次例会上决定是否立即增加一名值班人员。最近两个月请求总量从200单变成300单，整体首次响应中位数从4小时变成7小时，有同事据此认为人员已经明显不足。",
  "",
  "下个月有集中入学办理，不能等两个月再收集数据。业务侧愿意先给高峰时段安排临时支持，但要求一周后复核。不能因为临时支持实施后整体中位数下降就认定长期增员有效，因为办理事项与排班都会同时变化。",
].join("\n"));

addRawSlide(2, 2, "服务台响应观察", [
  "复核分类后发现，普通咨询从160单变成180单，复杂权限申请从40单变成120单。普通咨询首次响应中位数两个月都是2小时，复杂权限申请从12小时变成13小时。分类口径没有变化，但目前只有分类中位数，没有逐单时间分布。",
  "",
  "现有登记还缺少请求进入队列的时刻、等待外部审批的时长和实际处理工时。权限申请有些时间是在等待院系确认，有些时间是在等待值班人员接单，当前不能区分二者。有人提出给复杂申请加自动分流，也有人主张先补登记再决定。",
  "",
  "临时支持不能获得权限审批权，仍由原审批人确认。建议立即补记队列等待、外部审批等待和处理工时，并把普通咨询与复杂申请分别统计。若复杂申请主要等待审批，应先改善审批协作；若值班队列持续积压且实际处理负荷饱和，再提出正式增员方案。无论是否安排临时支持，都保留原始记录和未解决申请，不通过关闭旧单改善指标。",
].join("\n"));

// 整理区：先给结论，再按证据、解释、条件和行动展开。
addOrganizedSlide(1,
  "先稳住高峰，增员决策要等到等待来源可分解",
  "当前证据支持高峰临时缓冲，不支持仅凭整体中位数立即长期增员",
  "总体变化\n请求总量：200单 → 300单\n整体首次响应中位数：4小时 → 7小时\n\n立即安排\n下个月集中入学办理期间，在高峰时段安排临时支持，并要求一周后复核。\n\n判断边界\n临时支持后整体中位数下降，不能单独证明长期增员有效，因为办理事项与排班会同时变化。",
  "来源：原稿第1–2段。这里先把“现在要做什么”和“暂时不能推出什么”分开。"
);

addOrganizedSlide(2,
  "复杂权限申请的增长占总量增幅的主要部分",
  "总量增加并不等于所有请求都变慢，分类数据指向复杂申请",
  "请求类别        两个月前 → 最近两个月        首次响应中位数\n普通咨询        160单 → 180单                  2小时 → 2小时\n复杂权限申请    40单 → 120单                   12小时 → 13小时\n\n读法\n按请求量计算，复杂权限申请占总量约20%升至40%，增加80单，是总量增加100单的主要部分。复杂申请的中位数只增加1小时，因此不能仅凭这组分类中位数判断值班人员已经明显不足。\n\n现有限制\n目前只有分类中位数，没有逐单时间分布，不能判断尾部积压或个体差异。",
  "来源：原稿第3段。占比按原稿请求量计算，未补充逐单分布。"
);

addOrganizedSlide(3,
  "复核需要记录三类时长，不能把处理工时当作等待",
  "先补登记，再判断问题落在审批协作还是值班队列",
  "01 队列等待\n    记录请求进入队列的时刻，看请求在接单前等待了多久。\n\n02 外部审批等待\n    记录等待院系确认的时长，不把它算成值班接单负荷。\n\n03 实际处理工时\n    记录处理投入，与排队和审批等待分开。\n\n统计方式\n普通咨询与复杂权限申请分别统计，并保留原始记录和未解决申请。",
  "来源：原稿第4–5段。三类时长是建议补记的字段，不是已经测得的结果。"
);

addOrganizedSlide(4,
  "正式增员需要队列积压与处理负荷同时成立",
  "复核结果决定下一步：改善审批协作，或进入正式增员论证",
  "如果复杂申请主要等待外部审批\n→ 先改善审批协作。临时支持不能获得权限审批权，仍由原审批人确认。\n\n如果值班队列持续积压，且实际处理负荷饱和\n→ 再提出正式增员方案。\n\n无论是否安排临时支持\n→ 不通过关闭旧单改善指标。保留原始记录和未解决申请。",
  "来源：原稿第4–5段。这里把必要条件写成门槛，没有把它改写成已验证结论。"
);

const candidatePath = path.join(buildDir, "candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
await fs.mkdir(path.dirname(finalPath), { recursive: true });

const result = await finalizePresentation({
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
  integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-heading-fit"],
  fontPolicy: { basis: "design", families: [FONT] },
  verifyArtifactToolImport: true,
  receiptPath,
});

console.log(JSON.stringify({ finalPath, receiptPath, slideCount: presentation.slides.items.length, result }, null, 2));
