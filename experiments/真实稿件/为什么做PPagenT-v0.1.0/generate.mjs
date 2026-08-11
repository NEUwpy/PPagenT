import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import {
  applyTemplateMappedRecipes,
  exportTemplateMappedQa,
  parseNamedArgs,
  prepareTemplateMappedStarter,
} from "../../../src/asset-runtime/template-utils.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDir, "../../..");
const args = parseNamedArgs({
  output: path.join(
    projectRoot,
    "outputs",
    "真实稿件",
    "为什么做PPagenT",
    "为什么做PPagenT-v0.1.0.pptx",
  ),
  "qa-dir": "",
});

const sourceNotes = [
  "[Sources]",
  "- 内容：workbench/manuscripts/为什么做PPagenT-v1.md（冻结回归稿件）",
  "- 视觉：PPT模板-封面正文尾页.pptx（用户提供的东北大学模板）",
  "[/Sources]",
].join("\n");

const contentFrame = { left: 58, top: 195, width: 1160, height: 430 };
const exampleDeletions = [
  { kind: "shape", name: "箭头: 下 9" },
  { kind: "image", name: "图片 10" },
];

function coverRecipe() {
  return {
    sourceSlideNumber: 1,
    textEdits: [
      { sourceText: "MDM方法偏移量自适应选取", replacementText: "为什么做 PPagenT" },
      { sourceText: "汇报人：魏鹏宇", replacementText: "汇报人：魏鹏宇" },
      { sourceText: "2026.07.20", replacementText: "2026.08.09" },
    ],
    notes: sourceNotes,
  };
}

function agendaRecipe() {
  return {
    sourceSlideNumber: 2,
    textEdits: [
      { sourceText: "目录", replacementText: "目录" },
      {
        sourceText: "1. 定义问题\n2. 真参数未知如何实现“样本-最优偏移量”的选择\n3. 一些关于神经网络的验证\n4. 论文准备\n5. 下一个研究课题",
        replacementText: [
          "1. PPT 真正昂贵在哪里",
          "2. 为什么工作需要稳定，而不是随机惊艳",
          "3. AI、规则与代码如何分工",
          "4. PPagenT 服务谁",
          "5. 这个系统究竟要积累什么",
        ].join("\n"),
        writeMode: "replace-all",
      },
    ],
    notes: sourceNotes,
  };
}

function bodyRecipe(number, section, title, body, position = contentFrame) {
  return {
    sourceSlideNumber: 3,
    textEdits: [
      { sourceText: "01", replacementText: String(number).padStart(2, "0") },
      { sourceText: "正文页", replacementText: section },
      { sourceText: "主旨句", replacementText: title },
      { sourceText: "正文", replacementText: body, position },
    ],
    deletions: exampleDeletions,
    notes: sourceNotes,
  };
}

const slideRecipes = [
  coverRecipe(),
  agendaRecipe(),
  bodyRecipe(
    1,
    "问题",
    "做 PPT 真正昂贵的是一连串判断",
    [
      "不是把文本框拖到左边还是右边，而是反复回答：",
      "1. 这场汇报到底怎么讲",
      "2. 一篇长稿应该拆成多少页",
      "3. 每一页只承担什么任务",
      "4. 观点之间是什么关系，哪里需要突出",
    ].join("\n"),
  ),
  bodyRecipe(
    2,
    "取舍",
    "工作里的 PPT 不需要每次重新发明",
    [
      "学校有学校的样子，企业有企业的样子，个人也会形成稳定的表达方式。",
      "颜色、字体、页眉页脚和已经验证过的页面结构，没有必要每次都让 AI 重新猜。",
      "",
      "每次都不一样，有时候才是缺点。",
    ].join("\n"),
    { left: 82, top: 225, width: 1110, height: 330 },
  ),
  bodyRecipe(
    3,
    "分工",
    "AI 负责理解，规则负责决定，代码负责执行",
    [
      "AI 负责理解：读取稿件，判断重点、关系、拆页和表达目的。",
      "",
      "规则负责决定：选择可用版式，检查容量，决定换版式还是拆页。",
      "",
      "代码负责执行：按已确认的坐标、字号、颜色和间距稳定生成。",
    ].join("\n"),
  ),
  bodyRecipe(
    4,
    "价值",
    "稳定的 80 分，比随机的 95 分更值钱",
    [
      "真正的场景往往很普通：明天上午要汇报，今晚需要一套能继续修改的初稿。",
      "",
      "它不必每次令人惊叹，但必须结构清楚、视觉规范、符合组织风格。",
      "",
      "稳定交付一个能用于工作的 80 分初稿，本身就节省了大量时间。",
    ].join("\n"),
  ),
  bodyRecipe(
    5,
    "用户",
    "PPagenT 服务的是有内容、但不擅长做 PPT 的多数人",
    [
      "最会做 PPT 的少数人也许并不需要 PPagenT，他们自己可以做得更好。",
      "",
      "更多的人有内容、有专业知识，也有真实的汇报任务，",
      "只是缺少拆页、选择表达方式和完成视觉排版的经验。",
      "",
      "系统要做的，是把少数人的经验变成更多人可使用的生产能力。",
    ].join("\n"),
  ),
  bodyRecipe(
    6,
    "资产",
    "真正要积累的不是一万个模板，而是版式背后的经验",
    [
      "什么内容适合怎样表达？",
      "一个版式能处理多少内容？",
      "超过边界以后应当怎样变化？",
      "哪些情况即使能够画出来，也不应该使用？",
      "",
      "这些规律被提炼出来以后，漂亮页面才会从作品变成能力。",
    ].join("\n"),
  ),
  bodyRecipe(
    7,
    "验证",
    "东北大学只是第一套组织视觉系统",
    [
      "学校视觉规范是一套可以替换的 Skin。",
      "",
      "内容理解、拆页、表达规则、容量边界和失败经验可以继续复用。",
      "",
      "每加入一份真实稿件，就验证一次系统边界；",
      "发现问题、修改规则、重新生成，直到可处理的稿件范围不断扩大。",
    ].join("\n"),
  ),
  {
    sourceSlideNumber: 4,
    textEdits: [
      {
        sourceText: "敬请老师批评指正",
        replacementText: "不一定惊艳，但靠谱；\n不一定独一无二，但真的好用",
      },
    ],
    notes: sourceNotes,
  },
];

const starterPptxPath = path.join(
  projectRoot,
  ".tmp",
  "为什么做PPagenT-v0.1.0-runtime",
  "template-starter.pptx",
);
await prepareTemplateMappedStarter({
  sourcePptx: path.join(projectRoot, "PPT模板-封面正文尾页.pptx"),
  sourceSlideNumbers: slideRecipes.map((recipe) => recipe.sourceSlideNumber),
  starterPptx: starterPptxPath,
});

const presentation = await PresentationFile.importPptx(
  await FileBlob.load(starterPptxPath),
);
await applyTemplateMappedRecipes(presentation, slideRecipes);

const output = path.resolve(args.output);
await fs.mkdir(path.dirname(output), { recursive: true });
const finalPptx = await PresentationFile.exportPptx(presentation);
await finalPptx.save(output);
if (args["qa-dir"]) {
  await exportTemplateMappedQa(presentation, path.resolve(args["qa-dir"]));
}

console.log(output);
