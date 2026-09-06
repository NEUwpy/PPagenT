import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const { invokeStructure, closeStructureRuntime } = await import(
  pathToFileURL("C:/PPagenT/.codex/skills/ppagent-structure/scripts/invoke.mjs").href,
);

const here = path.dirname(fileURLToPath(import.meta.url));
const root = "C:/PPagenT";
const out = here;
const FONT = "Microsoft YaHei";
const C = {
  white: "#FFFFFF",
  ink: "#252B33",
  grey: "#707780",
  blue: "#24578C",
  blueSoft: "#E7EEF5",
  blueMid: "#9BB6CE",
  line: "#B8C8D6",
};

const skin = {
  id: "university-skin-pilot-local-v1",
  bodyFrame: { left: 55, top: 166, width: 1170, height: 492 },
  componentSourceFrame: { left: 55, top: 166, width: 1170, height: 492 },
  componentTheme: {
    background: C.white,
    surface: C.white,
    accent: C.blue,
    accentAlt: C.blueMid,
    accentSoft: C.blueSoft,
    cyan: "#C8D9E7",
    dark: C.ink,
    body: C.ink,
    muted: C.grey,
    line: C.line,
    font: FONT,
    typography: {
      componentHeading: 22,
      componentTitle: 20,
      componentItemTitle: 20,
      componentLead: 20,
      componentBody: 20,
      componentLabel: 20,
      componentMeta: 16,
    },
  },
  typographyRoles: {
    bodyTypeface: FONT,
    pageTitle: { fontSizes: [32], maxLines: 2, lineHeight: 1.25 },
    composition: {
      leadTitle: { fontSizes: [22], maxLines: 2 },
      leadBody: { fontSizes: [20], maxLines: 5 },
      rowTitle: { fontSizes: [22], maxLines: 1 },
      rowBody: { fontSizes: [20], maxLines: 4 },
      asideTitle: { fontSizes: [22], maxLines: 2 },
      asideBody: { fontSizes: [20], maxLines: 8 },
    },
  },
};

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function addText(slide, name, text, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: FONT,
    fontSize: 20,
    color: C.ink,
    alignment: "left",
    verticalAlignment: "top",
    autoFit: "none",
    ...style,
  };
  return shape;
}

function addRule(slide, name, position, fill = C.line) {
  return slide.shapes.add({
    geometry: "rect",
    name,
    position,
    fill,
    line: { style: "solid", fill: "none", width: 0 },
  });
}

function addPageChrome(slide, title, pageNumber, kicker) {
  addText(slide, `kicker-${pageNumber}`, kicker, { left: 56, top: 36, width: 400, height: 24 }, {
    fontSize: 16,
    bold: true,
    color: C.blue,
  });
  addText(slide, `title-${pageNumber}`, title, { left: 56, top: 62, width: 1168, height: 84 }, {
    fontSize: 32,
    bold: true,
    color: C.ink,
    verticalAlignment: "top",
  });
  addText(slide, `page-number-${pageNumber}`, String(pageNumber).padStart(2, "0"), { left: 1168, top: 674, width: 56, height: 22 }, {
    fontSize: 16,
    color: C.grey,
    alignment: "right",
  });
  addText(slide, `source-${pageNumber}`, "来源：用户提供稿件｜虚构大学试点场景", { left: 56, top: 674, width: 520, height: 22 }, {
    fontSize: 16,
    color: C.grey,
  });
}

async function build() {
  await fs.mkdir(out, { recursive: true });
  const evidencePath = path.join(out, "structure-invocations.ndjson");
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });

  const slide1 = presentation.slides.add();
  slide1.background.fill = C.white;
  addPageChrome(slide1, "一个结果要能被解释，记录就必须保存它的依据", 1, "问题一｜结果为什么仍然难以追溯");
  await invokeStructure({
    root,
    slide: slide1,
    skin,
    assetId: "hub-radial-001",
    parameters: {
      center: {
        title: "可讨论结果记录",
        body: "把结果、依据与责任连在一起",
      },
      items: [
        { key: "raw", title: "原始数据", body: "保留来源位置与原貌", iconQuery: "database file" },
        { key: "conditions", title: "样本条件", body: "记录采集条件与范围", iconQuery: "flask settings" },
        { key: "script", title: "脚本版本", body: "定位实际运行代码", iconQuery: "code version" },
        { key: "result", title: "结果文件", body: "指向讨论所用结果", iconQuery: "chart result" },
        { key: "exceptions", title: "异常排除", body: "说明判断依据与未纳入样本", iconQuery: "alert checklist" },
      ],
    },
    targetFrame: { left: 55, top: 166, width: 1170, height: 492 },
    evidencePath,
    pageId: "page-01",
    regionId: "record-unit-hub",
    reason: "五项信息共同构成一次可讨论的结果记录，彼此没有先后顺序，因此使用中心辐射表达组成关系。",
  });

  const slide2 = presentation.slides.add();
  slide2.background.fill = C.white;
  addPageChrome(slide2, "归档不改变授权：记录能引用文件，不等于开放文件", 2, "问题二｜可追溯与可访问不是一回事");
  addText(slide2, "lead-2", "记录要保存的是结果与依据之间的联系；访问权限仍由原授权边界决定。", { left: 56, top: 186, width: 1168, height: 48 }, {
    fontSize: 22,
    bold: true,
    color: C.blue,
  });
  addRule(slide2, "rule-2-top", { left: 56, top: 258, width: 1168, height: 2 }, C.blue);
  addText(slide2, "left-heading-2", "可公开讨论的部分", { left: 56, top: 286, width: 520, height: 34 }, {
    fontSize: 22,
    bold: true,
    color: C.ink,
  });
  addText(slide2, "left-body-2", "结果图\n可公开的解释\n记录中的受控引用", { left: 56, top: 336, width: 520, height: 156 }, {
    fontSize: 20,
    color: C.ink,
  });
  addRule(slide2, "rule-2-divider", { left: 640, top: 286, width: 2, height: 232 }, C.line);
  addText(slide2, "right-heading-2", "仍受授权约束的部分", { left: 704, top: 286, width: 520, height: 34 }, {
    fontSize: 22,
    bold: true,
    color: C.ink,
  });
  addText(slide2, "right-body-2", "受限原始数据\n个人信息或合作限制\n原授权位置与访问条件", { left: 704, top: 336, width: 520, height: 156 }, {
    fontSize: 20,
    color: C.ink,
  });
  addRule(slide2, "rule-2-bottom", { left: 56, top: 566, width: 1168, height: 2 }, C.blue);
  addText(slide2, "conclusion-2", "记录表出现一个路径，不代表其他成员已经取得访问权。", { left: 56, top: 586, width: 1168, height: 42 }, {
    fontSize: 22,
    bold: true,
    color: C.blue,
  });

  const slide3 = presentation.slides.add();
  slide3.background.fill = C.white;
  addPageChrome(slide3, "先从新增实验开始，再逐项补真正需要复核的历史结果", 3, "问题三｜试点范围如何取舍");
  await invokeStructure({
    root,
    slide: slide3,
    skin,
    assetId: "comparison-dual-verdict-001",
    parameters: {
      comparisonLabel: "范围选择",
      sides: [
        {
          title: "集中补历史",
          tone: "negative",
          items: [
            "目录可一次变大",
            "追查遗失上下文",
            "记忆可能被写实",
            "先投入追溯成本",
          ],
        },
        {
          title: "新增先行",
          tone: "positive",
          items: [
            "上下文尚清楚",
            "缺项及时暴露",
            "短期难覆盖历史",
            "只补重点历史",
          ],
        },
      ],
    },
    targetFrame: { left: 55, top: 166, width: 1170, height: 492 },
    evidencePath,
    pageId: "page-03",
    regionId: "pilot-scope-comparison",
    reason: "两种推进思路围绕上下文、历史覆盖与投入代价逐行对应，并由稿件明确建议新增实验先行，因此使用双向结论对比。",
  });

  const allLayouts = [];
  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(path.join(out, `${stem}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    const layoutText = await (await slide.export({ format: "layout" })).text();
    await fs.writeFile(path.join(out, `${stem}.layout.json`), layoutText, "utf8");
    allLayouts.push({ slide: index + 1, layout: JSON.parse(layoutText) });
  }
  await fs.writeFile(path.join(out, "layout.json"), JSON.stringify(allLayouts, null, 2), "utf8");
  await writeBlob(path.join(out, "deck-montage.webp"), await presentation.export({ format: "webp", montage: true, scale: 1 }));
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(path.join(out, "deck.pptx"));
}

try {
  await build();
} finally {
  await closeStructureRuntime();
}
