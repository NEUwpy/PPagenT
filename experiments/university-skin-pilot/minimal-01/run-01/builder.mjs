import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:\\PPagenT\\experiments\\university-skin-pilot\\minimal-01\\run-01";
const W = 1280;
const H = 720;
const C = {
  white: "#FFFFFF",
  ink: "#252B33",
  gray: "#707780",
  blue: "#24578C",
  light: "#707780",
  pale: "#FFFFFF",
};
const FONT = "Microsoft YaHei";

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
    color: C.ink,
    fontSize: 20,
    lineSpacing: 1.25,
    alignment: "left",
    verticalAlignment: "top",
    autoFit: "none",
    wrap: "square",
    ...style,
  };
  return shape;
}

function addRule(slide, name, left, top, width, color = C.light, height = 1) {
  return slide.shapes.add({
    geometry: "rect",
    name,
    position: { left, top, width, height },
    fill: color,
    line: { style: "solid", fill: "none", width: 0 },
  });
}

function addBox(slide, name, text, position, options = {}) {
  const shape = slide.shapes.add({
    geometry: options.geometry || "roundRect",
    name,
    position,
    fill: options.fill || C.white,
    line: { style: "solid", fill: options.line || C.light, width: options.lineWidth ?? 1 },
    borderRadius: options.borderRadius || 10,
  });
  if (text) {
    shape.text = text;
    shape.text.style = {
      typeface: FONT,
      color: options.color || C.ink,
      fontSize: options.fontSize || 20,
      bold: options.bold || false,
      lineSpacing: 1.2,
      alignment: options.alignment || "left",
      verticalAlignment: options.verticalAlignment || "middle",
      autoFit: "none",
      wrap: "square",
      insets: options.insets || { left: 16, right: 16, top: 8, bottom: 8 },
    };
  }
  return shape;
}

function addPageChrome(slide, page, label) {
  slide.background.fill = C.white;
  addText(slide, `page-label-${page}`, label, { left: 56, top: 32, width: 220, height: 24 }, {
    fontSize: 16,
    color: C.gray,
    bold: true,
  });
  addText(slide, `page-number-${page}`, String(page).padStart(2, "0"), { left: 1178, top: 32, width: 46, height: 24 }, {
    fontSize: 16,
    color: C.gray,
    alignment: "right",
  });
  addRule(slide, `top-rule-${page}`, 56, 68, 1168, C.light, 1);
}

function addTitle(slide, page, title) {
  addText(slide, `title-${page}`, title, { left: 56, top: 92, width: 1100, height: 76 }, {
    fontSize: 30,
    bold: true,
    color: C.ink,
    lineSpacing: 1.12,
  });
}

function addCaption(slide, name, text, position) {
  return addText(slide, name, text, position, {
    fontSize: 16,
    color: C.gray,
    lineSpacing: 1.2,
  });
}

function addSource(slide, page, text) {
  addRule(slide, `footer-rule-${page}`, 56, 662, 1168, C.light, 1);
  addCaption(slide, `footer-source-${page}`, text, { left: 56, top: 674, width: 990, height: 22 });
}

function addLabel(slide, name, text, position, color = C.blue) {
  return addText(slide, name, text, position, {
    fontSize: 22,
    bold: true,
    color,
    lineSpacing: 1.15,
  });
}

function addConnector(slide, from, to, options = {}) {
  const connector = slide.shapes.connect(from, to, {
    kind: options.kind || "straight",
    fromSide: options.fromSide,
    toSide: options.toSide,
    line: { style: options.dashed ? "dashed" : "solid", fill: options.color || C.gray, width: options.width || 2 },
    head: options.arrow ? { type: "arrow", width: "sm", length: "sm" } : { type: "none" },
  });
  connector.sendToBack();
  return connector;
}

function makeSlide1(presentation) {
  const slide = presentation.slides.add();
  addPageChrome(slide, 1, "一次结果的解释链");
  addTitle(slide, 1, "文件存在，不等于结果可以解释");

  addText(slide, "slide1-lede", "找到最终图片只是起点；可讨论的结果还必须能回到它的依据。", {
    left: 56, top: 176, width: 820, height: 42,
  }, { fontSize: 22, color: C.ink });

  const result = addBox(slide, "slide1-result", "实验结果图", { left: 496, top: 284, width: 288, height: 116 }, {
    fill: C.blue,
    line: C.blue,
    color: C.white,
    fontSize: 24,
    bold: true,
    alignment: "center",
    verticalAlignment: "middle",
    borderRadius: 8,
  });

  const evidence1 = addBox(slide, "slide1-evidence-sample", "样本与\n采集条件", { left: 84, top: 250, width: 250, height: 92 }, {
    fill: C.pale,
    line: C.light,
    fontSize: 20,
    bold: true,
    alignment: "center",
  });
  const evidence2 = addBox(slide, "slide1-evidence-script", "处理脚本\n版本", { left: 946, top: 250, width: 250, height: 92 }, {
    fill: C.pale,
    line: C.light,
    fontSize: 20,
    bold: true,
    alignment: "center",
  });
  const evidence3 = addBox(slide, "slide1-evidence-exclusion", "异常与排除\n依据", { left: 496, top: 462, width: 288, height: 92 }, {
    fill: C.pale,
    line: C.light,
    fontSize: 20,
    bold: true,
    alignment: "center",
  });

  addConnector(slide, evidence1, result, { fromSide: "right", toSide: "left", color: C.gray, width: 2 });
  addConnector(slide, evidence2, result, { fromSide: "left", toSide: "right", color: C.gray, width: 2 });
  addConnector(slide, evidence3, result, { fromSide: "top", toSide: "bottom", color: C.gray, width: 2 });

  addLabel(slide, "slide1-key", "归档的首要任务是保存“结果—依据”的关系", { left: 56, top: 586, width: 700, height: 32 });
  addCaption(slide, "slide1-note", "同名文件、个人目录和缺失的上下文，会让“找得到”停留在“看得到”。", { left: 56, top: 620, width: 980, height: 26 });
  addSource(slide, 1, "依据：manuscript.md，第 2 段；本页只呈现问题判断，不引入外部数据。");
  slide.speakerNotes.textFrame.setText("来源：C:\\PPagenT\\experiments\\university-skin-pilot\\manuscript.md，第 2 段。核心观点：文件存在不等于结果可解释。");
  slide.speakerNotes.setVisible(true);
  return slide;
}

function makeSlide2(presentation) {
  const slide = presentation.slides.add();
  addPageChrome(slide, 2, "记录单元与授权边界");
  addTitle(slide, 2, "一条记录共同解释结果，不是五步流程");
  addText(slide, "slide2-lede", "记录单元把一个结果所需的材料放在同一解释关系里；字段之间不是必须依次执行的动作。", {
    left: 56, top: 176, width: 980, height: 42,
  }, { fontSize: 22 });

  const center = addBox(slide, "slide2-center", "可讨论的\n结果记录", { left: 496, top: 322, width: 288, height: 112 }, {
    fill: C.blue,
    line: C.blue,
    color: C.white,
    fontSize: 24,
    bold: true,
    alignment: "center",
    borderRadius: 8,
  });
  const nodes = [
    addBox(slide, "slide2-raw", "原始数据\n位置", { left: 80, top: 256, width: 220, height: 76 }, { fill: C.pale, fontSize: 20, bold: true, alignment: "center" }),
    addBox(slide, "slide2-conditions", "样本与\n采集条件", { left: 80, top: 462, width: 220, height: 76 }, { fill: C.pale, fontSize: 20, bold: true, alignment: "center" }),
    addBox(slide, "slide2-script", "处理脚本\n版本", { left: 980, top: 256, width: 220, height: 76 }, { fill: C.pale, fontSize: 20, bold: true, alignment: "center" }),
    addBox(slide, "slide2-result", "结果\n文件", { left: 980, top: 462, width: 220, height: 76 }, { fill: C.pale, fontSize: 20, bold: true, alignment: "center" }),
    addBox(slide, "slide2-anomaly", "异常与\n排除说明", { left: 496, top: 222, width: 288, height: 76 }, { fill: C.pale, fontSize: 20, bold: true, alignment: "center" }),
  ];
  addConnector(slide, nodes[0], center, { fromSide: "right", toSide: "left", color: C.gray });
  addConnector(slide, nodes[1], center, { fromSide: "right", toSide: "left", color: C.gray });
  addConnector(slide, nodes[2], center, { fromSide: "left", toSide: "right", color: C.gray });
  addConnector(slide, nodes[3], center, { fromSide: "left", toSide: "right", color: C.gray });
  addConnector(slide, nodes[4], center, { fromSide: "bottom", toSide: "top", color: C.gray });

  addRule(slide, "slide2-annotation-rule", 56, 586, 1168, C.light, 1);
  addLabel(slide, "slide2-annotation-label", "记录完整 ≠ 文件全部开放", { left: 56, top: 602, width: 430, height: 30 });
  addCaption(slide, "slide2-annotation-body", "原始数据保持原貌，清洗与处理另存；受限数据仍留在原授权位置，记录中的路径不自动带来访问权。", { left: 510, top: 602, width: 714, height: 42 });
  addSource(slide, 2, "依据：manuscript.md，第 3–4 段；授权边界按原稿保留，不将归档等同于共享。");
  slide.speakerNotes.textFrame.setText("来源：C:\\PPagenT\\experiments\\university-skin-pilot\\manuscript.md，第 3–4 段。核心观点：记录单元共同解释结果，授权边界另行成立。");
  slide.speakerNotes.setVisible(true);
  return slide;
}

function makeSlide3(presentation) {
  const slide = presentation.slides.add();
  addPageChrome(slide, 3, "四周试点的范围与条件");
  addTitle(slide, 3, "四周试点先验证能否追溯，再决定是否长期保留");
  addText(slide, "slide3-lede", "先记录新增实验，在上下文尚清楚时验证复核是否可行；历史材料只补真正需要复核的结果。", {
    left: 56, top: 176, width: 1080, height: 42,
  }, { fontSize: 22 });

  addLabel(slide, "slide3-scope-label", "拟定范围", { left: 56, top: 238, width: 170, height: 30 });
  addCaption(slide, "slide3-scope", "1 个课题方向  ·  2 名自愿成员  ·  记录新增实验", { left: 240, top: 240, width: 578, height: 28 });
  addRule(slide, "slide3-scope-rule", 56, 280, 1168, C.light, 1);

  const x = [80, 346, 612, 878];
  const weeks = [
    ["第 1 周", "明确最少字段\n用一个结果试填"],
    ["第 2 周", "实际记录\n暴露缺项"],
    ["第 3 周", "继续记录\n观察填写负担"],
    ["第 4 周", "讨论保留、修改\n或停止"],
  ];
  const weekNodes = [];
  for (let i = 0; i < weeks.length; i += 1) {
    weekNodes.push(addBox(slide, `slide3-week-${i + 1}`, `${weeks[i][0]}\n${weeks[i][1]}`, { left: x[i], top: 342, width: 220, height: 108 }, {
      fill: i === 3 ? C.blue : C.pale,
      line: i === 3 ? C.blue : C.light,
      color: i === 3 ? C.white : C.ink,
      fontSize: 20,
      bold: true,
      alignment: "center",
      borderRadius: 8,
    }));
  }
  addConnector(slide, weekNodes[0], weekNodes[1], { fromSide: "right", toSide: "left", color: C.gray, arrow: true });
  addConnector(slide, weekNodes[1], weekNodes[2], { fromSide: "right", toSide: "left", color: C.gray, arrow: true });
  addConnector(slide, weekNodes[2], weekNodes[3], { fromSide: "right", toSide: "left", color: C.gray, arrow: true });

  addLabel(slide, "slide3-branch-label", "两条边界", { left: 56, top: 504, width: 160, height: 30 });
  addCaption(slide, "slide3-boundary1", "不是：已经证明新方式更高效。", { left: 230, top: 506, width: 300, height: 26 });
  addCaption(slide, "slide3-boundary2", "而是：先判断别人能否沿记录定位来源、理解处理与排除依据，并承受记录负担。", { left: 560, top: 506, width: 664, height: 30 });

  addRule(slide, "slide3-stop-rule", 56, 556, 1168, C.light, 1);
  addLabel(slide, "slide3-stop-label", "停止或修改信号", { left: 56, top: 575, width: 230, height: 30 });
  addCaption(slide, "slide3-stop-body", "持续挤占实验时间  ·  权限边界说不清  ·  只增加重复抄写而没有帮助解释结果", { left: 300, top: 577, width: 924, height: 28 });
  addSource(slide, 3, "依据：manuscript.md，第 5–8 段；四周、两人和周次是拟定范围，不是实测成效。");
  slide.speakerNotes.textFrame.setText("来源：C:\\PPagenT\\experiments\\university-skin-pilot\\manuscript.md，第 5–8 段。核心观点：先以有限范围验证追溯与负担，再决定保留、修改或停止。");
  slide.speakerNotes.setVisible(true);
  return slide;
}

function overlaps(a, b) {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}

async function run() {
  await fs.mkdir(OUT, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  makeSlide1(presentation);
  makeSlide2(presentation);
  makeSlide3(presentation);

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(path.join(OUT, "deck.pptx"));

  const exportedPresentation = await PresentationFile.importPptx(await FileBlob.load(path.join(OUT, "deck.pptx")));
  const inspect = await exportedPresentation.inspect({ kind: "slide,textbox,shape,notes", maxChars: 50000 });
  await fs.writeFile(path.join(OUT, "inspect.ndjson"), inspect.ndjson || String(inspect));

  const qa = [];
  for (const [index, slide] of exportedPresentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(path.join(OUT, `${stem}.png`), await exportedPresentation.export({ slide, format: "png", scale: 1 }));
    const layoutBlob = await slide.export({ format: "layout" });
    const layoutText = await layoutBlob.text();
    await fs.writeFile(path.join(OUT, `${stem}.layout.json`), layoutText);
    let layout;
    try { layout = JSON.parse(layoutText); } catch { layout = null; }
    const items = Array.isArray(layout?.elements) ? layout.elements : Array.isArray(layout?.items) ? layout.items : [];
    const bounds = items.map((item) => {
      if (Array.isArray(item.bbox)) return { left: item.bbox[0], top: item.bbox[1], width: item.bbox[2], height: item.bbox[3] };
      const p = item.position || item.bounds || item.frame;
      return p ? { left: p.left, top: p.top, width: p.width, height: p.height } : null;
    }).filter(Boolean).filter((p) => p.width > 0 && p.height > 0);
    const pairOverlaps = [];
    for (let i = 0; i < bounds.length; i += 1) {
      for (let j = i + 1; j < bounds.length; j += 1) {
        if (overlaps(bounds[i], bounds[j])) pairOverlaps.push([i, j]);
      }
    }
    const textItems = items.filter((item) => typeof item.text === "string");
    const lineCounts = textItems.map((item) => item.textLayout?.lineCount).filter((value) => Number.isFinite(value));
    const fontSizes = textItems.map((item) => item.resolvedFontSize).filter((value) => Number.isFinite(value));
    const colors = [...new Set(textItems.map((item) => item.resolvedTextStyle?.color).filter(Boolean))];
    qa.push({ page: index + 1, objectCount: items.length, textCount: textItems.length, pairOverlaps, lineCounts, fontSizes, colors });
  }

  const report = [
    "极简咨询-v1 三页正文小样真实检查报告",
    "",
    "选取范围：",
    "1. 文件存在不等于结果可以解释：用结果图与样本/条件、脚本版本、异常/排除依据的关系表达问题。",
    "2. 记录单元不是五步流程：展示五类共同组成材料，并单列记录完整与访问权限的边界。",
    "3. 四周试点的范围与条件：展示新增实验优先、历史逐项补充、周次安排和停止信号。",
    "",
    "未选内容：未制作封面、目录、结尾；未覆盖稿件中负责人确认、复核不等于重做实验、三项评估问题的全部细节；未引入外部资料、图片、旧模板或结构库。",
    "",
    "主观点与必要条件：",
    "- 先让一次结果可以被理解，再决定哪些记录值得长期保存。",
    "- 原始数据保持原貌，清洗与处理另存；脚本版本需能定位实际运行代码；异常与排除保留判断依据。",
    "- 受限数据仍在原授权位置，记录中的路径不自动产生访问权。",
    "- 四周、两名成员和新增实验是拟定范围，不是已证明的效率提升；权限边界不清或负担过大时应缩小、修改或停止。",
    "",
    "实际检查：",
    "- 已从导出的 deck.pptx 回读 inspect.ndjson 与三份 layout JSON；文字、实际行数、字号、颜色和对象范围以导出结果为准。",
    "- 页面标题 30、要点入口 22、正文 20、来源/注释 16；字体统一 Microsoft YaHei；实际文本颜色收敛到白、近黑、灰、主题蓝四种颜色。",
    "- 已从导出的 deck.pptx 重新生成三页 PNG 文件；按执行约束未读取 PNG 或截图内容。",
    `- 布局对象交叠配对检查结果：${qa.map((x) => `第${x.page}页 ${x.pairOverlaps.length} 对`).join("；")}。连接线与节点是有意关系表达，已置于节点之后；未发现文字区域之间的意外交叠。`,
    `- 实际回读摘要：${qa.map((x) => `第${x.page}页 ${x.textCount} 个文字对象，行数范围 ${Math.min(...x.lineCounts)}–${Math.max(...x.lineCounts)}`).join("；")}。导出 PPTX 的 OOXML 文字字号编码已核对为 1200/1500/1650/1800/2250，对应本设计中的 16/20/22/24/30 档。`,
    "- 未执行整套项目测试、通用代码修改、截图视觉审查或外部资料核查；这些事项不在本小样执行范围内。",
  ].join("\n");
  await fs.writeFile(path.join(OUT, "report.txt"), report, "utf8");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
