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
  line: "#B8C8D6",
};

// Local v2 composition settings. The structure asset receives this theme,
// but its exported CSS is checked after compilation and is not assumed to obey it.
const skin = {
  id: "university-skin-pilot-local-v2",
  bodyFrame: { left: 55, top: 166, width: 1170, height: 492 },
  componentSourceFrame: { left: 55, top: 166, width: 1170, height: 492 },
  componentTheme: {
    background: C.white,
    surface: C.white,
    accent: C.blue,
    accentAlt: "#9BB6CE",
    accentSoft: C.blueSoft,
    cyan: "#C8D9E7",
    dark: C.ink,
    body: C.ink,
    muted: C.grey,
    line: C.line,
    font: FONT,
    typography: {
      // html-component-theme writes these values as CSS pt; 1 design px = 0.75 pt.
      componentHeading: 16.5,
      componentTitle: 15,
      componentItemTitle: 15,
      componentLead: 15,
      componentBody: 15,
      componentLabel: 15,
      componentMeta: 12,
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

function addChrome(slide, title, pageNumber, kicker) {
  addText(slide, `kicker-${pageNumber}`, kicker, { left: 56, top: 36, width: 520, height: 24 }, {
    fontSize: 16,
    bold: true,
    color: C.blue,
  });
  addText(slide, `title-${pageNumber}`, title, { left: 56, top: 62, width: 1168, height: 84 }, {
    fontSize: 32,
    bold: true,
    color: C.ink,
  });
  addText(slide, `source-${pageNumber}`, "来源：用户稿件｜虚构大学试点场景", { left: 56, top: 674, width: 520, height: 22 }, {
    fontSize: 16,
    color: C.grey,
  });
  addText(slide, `page-number-${pageNumber}`, String(pageNumber).padStart(2, "0"), { left: 1168, top: 674, width: 56, height: 22 }, {
    fontSize: 16,
    color: C.grey,
    alignment: "right",
  });
}

async function build() {
  await fs.mkdir(out, { recursive: true });
  const evidencePath = path.join(out, "structure-invocations.ndjson");
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });

  const slide1 = presentation.slides.add();
  slide1.background.fill = C.white;
  addChrome(slide1, "记录的目的不是把文件收齐，而是让别人沿依据复核结果", 1, "问题一｜从“找到文件”到“理解结果”");
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
  // This is deliberately outside the component's text fields: it explains the
  // review action and the consequence of a missing field.
  addRule(slide1, "outside-rule-1", { left: 56, top: 418, width: 300, height: 2 }, C.blue);
  addText(slide1, "outside-heading-1", "图外解释｜复核者要做什么", { left: 56, top: 432, width: 380, height: 30 }, {
    fontSize: 22,
    bold: true,
    color: C.blue,
  });
  addText(slide1, "outside-body-1", "沿这五项依据定位同一结果；缺少任一项，文件仍可能被找到，却难以说明“怎么产生”。", { left: 56, top: 468, width: 390, height: 84 }, {
    fontSize: 20,
    color: C.ink,
  });

  const slide2 = presentation.slides.add();
  slide2.background.fill = C.white;
  addChrome(slide2, "归档先写清授权条件，才能决定哪些内容进入讨论材料", 2, "问题二｜可追溯与可访问必须分开处理");
  addText(slide2, "lead-2", "路径解决“从哪来”，授权联系人解决“谁能看”；两个问题必须分开处理。", { left: 56, top: 186, width: 1168, height: 48 }, {
    fontSize: 22,
    bold: true,
    color: C.blue,
  });
  addRule(slide2, "rule-2-top", { left: 56, top: 258, width: 1168, height: 2 }, C.blue);
  addText(slide2, "section-1-heading", "01 记录可写什么", { left: 56, top: 286, width: 520, height: 34 }, {
    fontSize: 22,
    bold: true,
    color: C.ink,
  });
  addText(slide2, "section-1-body", "结果图、可公开解释、受控引用与访问条件可以进入讨论材料。这样复核者知道结果依赖什么，而不是只看到一个文件路径。", { left: 56, top: 330, width: 520, height: 136 }, {
    fontSize: 20,
    color: C.ink,
  });
  addRule(slide2, "rule-2-divider", { left: 640, top: 286, width: 2, height: 214 }, C.line);
  addText(slide2, "section-2-heading", "02 记录不能替代什么", { left: 704, top: 286, width: 520, height: 34 }, {
    fontSize: 22,
    bold: true,
    color: C.ink,
  });
  addText(slide2, "section-2-body", "它不能把原始数据自动开放给其他成员。个人信息、合作限制和原授权位置继续有效；路径出现不等于访问权已经取得。", { left: 704, top: 330, width: 520, height: 136 }, {
    fontSize: 20,
    color: C.ink,
  });
  addRule(slide2, "rule-2-bottom", { left: 56, top: 524, width: 1168, height: 2 }, C.blue);
  addText(slide2, "section-3-heading", "03 出现授权问题时", { left: 56, top: 548, width: 520, height: 34 }, {
    fontSize: 22,
    bold: true,
    color: C.blue,
  });
  addText(slide2, "section-3-body", "若需要新的访问授权，暂停共享，由负责人处理授权后再继续。权限边界说不清时，先缩小要求或停止试点。", { left: 56, top: 590, width: 1168, height: 58 }, {
    fontSize: 20,
    color: C.ink,
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
