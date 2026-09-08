import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PresentationFile } from "@oai/artifact-tool";
import { addBox, addText } from "../../../src/asset-runtime/component-builders.mjs";
import {
  createNortheasternUniversityStarter,
  northeasternUniversitySkin,
} from "../../../src/runtime/skins/northeastern-university.mjs";
import {
  invokeUniversityStructure,
  closeStructureRuntime,
} from "../../../src/runtime/invoke-university-structure.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const runDir = path.dirname(fileURLToPath(import.meta.url));
const outputPptx = path.join(runDir, "deck.pptx");
const qaDir = path.join(runDir, "qa");
const evidencePath = path.join(runDir, "structure-call-log.jsonl");
const bodyFrame = northeasternUniversitySkin.bodyFrame;

const COLORS = {
  blue: "#315F91",
  blue2: "#4C88E8",
  dark: "#2B2B2B",
  body: "#404040",
  muted: "#6F6F6F",
  line: "#AFC6E8",
  pale: "#DCE9FA",
};
const FONT = "Microsoft YaHei";

const pages = [
  {
    pageId: "cover",
    payload: {
      assetId: "northeastern-university-cover-001",
      parameters: {
        title: "共享实验平台试点方案",
        subtitle: "记录、筛选与能力建设",
        presenter: "方案讨论",
        organization: "",
        date: "",
      },
    },
    content: { pageId: "cover", title: "共享实验平台试点方案" },
    meta: { sectionName: "" },
  },
  {
    pageId: "agenda",
    payload: {
      assetId: "northeastern-university-agenda-001",
      parameters: {
        title: "目录",
        items: ["记录规范", "试点筛选", "能力建设"],
      },
    },
    content: { pageId: "agenda", title: "目录" },
    meta: { sectionName: "" },
  },
  {
    pageId: "records",
    payload: {
      assetId: "northeastern-university-body-001",
      parameters: {
        items: [
          { key: "source", title: "申请来源", body: "登记申请人与课题", iconQuery: "file description" },
          { key: "approval", title: "审批依据", body: "记录责任人与时间", iconQuery: "clipboard check" },
          { key: "execution", title: "执行结果", body: "关联输出和参数", iconQuery: "settings output" },
          { key: "exception", title: "异常处置", body: "保留原因、处理结论", iconQuery: "alert triangle" },
        ],
      },
    },
    content: {
      pageId: "records",
      title: "首轮记录应覆盖四项基本信息，先让异常能够追溯",
    },
    meta: { sectionName: "记录规范" },
  },
  {
    pageId: "selection",
    payload: {
      assetId: "northeastern-university-body-001",
      parameters: {
        inputs: [
          { key: "self", label: "自荐", iconQuery: "flask" },
          { key: "platform", label: "平台", iconQuery: "building" },
          { key: "合作", label: "合作", iconQuery: "handshake" },
        ],
        steps: [
          { key: "eligibility", title: "资格核对" },
          { key: "owner", title: "责任确认" },
          { key: "record", title: "记录准备" },
        ],
      },
    },
    content: {
      pageId: "selection",
      title: "试点名单应逐轮收敛，先核资格再核责任与记录条件",
    },
    meta: { sectionName: "试点筛选" },
  },
  {
    pageId: "capability",
    payload: {
      assetId: "northeastern-university-body-001",
      parameters: {
        levels: [
          { key: "recordable", title: "可记录", body: "每次任务留下最小台账" },
          { key: "traceable", title: "可追溯", body: "记录关联来源、参数与输出" },
          { key: "reusable", title: "可复用", body: "他人能够依据记录重做关键过程" },
        ],
        showStatus: false,
        currentIndex: 0,
      },
    },
    content: {
      pageId: "capability",
      title: "能力建设分三层累积，跨实验室复用依赖前两层基础",
    },
    meta: { sectionName: "能力建设" },
  },
  {
    pageId: "closing",
    payload: {
      assetId: "northeastern-university-closing-001",
      parameters: { text: "敬请老师批评指正" },
    },
    content: { pageId: "closing", title: "敬请老师批评指正" },
    meta: { sectionName: "" },
  },
];

for (const page of pages) {
  page.intent = { intentId: `${page.pageId}-intent` };
  page.decision = { selectedAssetId: page.payload.assetId };
}

function text(slide, value, frame, style = {}) {
  return addText(slide, value, frame, {
    typeface: FONT,
    color: COLORS.body,
    fontSize: 18,
    autoFit: "none",
    verticalAlignment: "top",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    protectLineBreaks: true,
    ...style,
  });
}

function rule(slide, left, top, width) {
  addBox(slide, { left, top, width, height: 2 }, {
    geometry: "rect",
    fill: COLORS.line,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-none",
    borderRadius: 0,
  });
}

function sectionBlock(slide, x, y, width, heading, body, height, options = {}) {
  addBox(slide, { left: x, top: y, width: 6, height }, {
    geometry: "rect",
    fill: options.accent ?? COLORS.blue2,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-none",
    borderRadius: 0,
  });
  text(slide, heading, { left: x + 22, top: y, width: width - 22, height: 30 }, {
    fontSize: 21,
    bold: true,
    color: options.headingColor ?? COLORS.blue,
    verticalAlignment: "top",
  });
  text(slide, body, { left: x + 22, top: y + 38, width: width - 22, height: height - 38 }, {
    fontSize: options.bodyFontSize ?? 18,
    color: COLORS.body,
    verticalAlignment: "top",
  });
}

function renderRecords(slide) {
  const x = 815;
  const w = 410;
  sectionBlock(slide, x, 206, w, "观察", "模拟抽查20笔预约\n7笔缺审批时间；5笔缺执行记录\n两类问题可重叠，不能相加为12笔问题预约。", 150);
  rule(slide, x + 22, 378, w - 22);
  sectionBlock(slide, x, 402, w, "行动", "先在两间自愿实验室执行这份清单，再复核记录完整性。\n当前不能据此判断效率提升。", 142, { accent: COLORS.blue });
  text(slide, "四项为并列要求，不是四步流程。", { left: 815, top: 590, width: 410, height: 28 }, {
    fontSize: 14,
    color: COLORS.muted,
  });
}

function renderSelection(slide) {
  const x = 760;
  const w = 465;
  sectionBlock(slide, x, 194, w, "候选来源", "实验室自荐、平台推荐、既有合作汇入同一筛选过程，不是先后阶段。", 100);
  rule(slide, x + 22, 306, w - 22);
  sectionBlock(slide, x, 330, w, "三轮条件", "资格：设备与任务适配\n责任：落实审批与执行负责人\n记录：按最小清单登记\n三项全满足才入拟议名单；不足项补齐后再申请。", 190, { accent: COLORS.blue });
  rule(slide, x + 22, 544, w - 22);
  sectionBlock(slide, x, 566, w, "边界与执行", "拟议规则，非实测转化率；无每轮人数，不编造比例或淘汰率。\n平台负责人维护依据；试点限两间自愿实验室；来源数量不等于入选数量。", 92, { accent: COLORS.blue2, bodyFontSize: 14 });
}

function renderCapability(slide) {
  const x = 850;
  const w = 375;
  sectionBlock(slide, x, 190, w, "判断", "可复用建立在前两层基础上，不是三个互斥方案。", 82);
  rule(slide, x + 22, 288, w - 22);
  sectionBlock(slide, x, 312, w, "首轮目标", "仅将“可记录”作为首轮目标；没有完成度调查，不能暗示已达到某一级。", 112, { accent: COLORS.blue });
  rule(slide, x + 22, 448, w - 22);
  sectionBlock(slide, x, 472, w, "验收与边界", "研究人员提交记录；管理员抽查关联；平台负责人处理跨实验室责任争议。三者是分工，不是三级审批。\n\n复用能力需要实际重做验证，文件齐全不足以判定可复用。", 174, { accent: COLORS.blue2, bodyFontSize: 14 });
}

async function main() {
  await fs.mkdir(qaDir, { recursive: true });
  await fs.writeFile(evidencePath, "", "utf8");
  const starterPptx = path.join(runDir, ".runtime", "template-starter.pptx");
  const { presentation, slides } = await createNortheasternUniversityStarter({
    starterPptx,
    pages,
    manuscriptSource: "experiments/university-template-integration-03/manuscript.txt",
  });

  await invokeUniversityStructure({
    root,
    slide: slides[2],
    assetId: "parallel-folded-notes-grid-002",
    content: pages[2].payload.parameters,
    targetFrame: { left: 55, top: 214, width: 740, height: 390 },
    evidencePath,
    pageId: "records",
    regionId: "records-structure",
    reason: "四项同级记录要求必须保持并列关系；折角便签保留原蓝色结构与居中阵列。",
  });
  renderRecords(slides[2]);

  await invokeUniversityStructure({
    root,
    slide: slides[3],
    assetId: "convergence-simple-funnel-001",
    content: pages[3].payload.parameters,
    targetFrame: { left: 55, top: 198, width: 650, height: 430 },
    evidencePath,
    pageId: "selection",
    regionId: "selection-structure",
    reason: "三个候选来源汇入三轮连续筛选；漏斗只表达收敛关系，拟议规则和证据边界置于图外。",
  });
  renderSelection(slides[3]);

  await invokeUniversityStructure({
    root,
    slide: slides[4],
    assetId: "progression-maturity-steps-002",
    content: pages[4].payload.parameters,
    targetFrame: { left: 55, top: 198, width: 770, height: 430 },
    evidencePath,
    pageId: "capability",
    regionId: "capability-structure",
    reason: "可记录、可追溯、可复用是有基础依赖的离散能力层级；当前与目标状态关闭以避免无调查的达成暗示。",
  });
  renderCapability(slides[4]);

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPptx);
  await closeStructureRuntime();
  console.log(JSON.stringify({ outputPptx, pages: pages.length, evidencePath, qaDir }));
}

main().catch(async (error) => {
  console.error(error?.stack || error);
  try { await closeStructureRuntime(); } catch {}
  process.exitCode = 1;
});
