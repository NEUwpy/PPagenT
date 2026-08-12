import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const W = 1280;
const H = 720;
const BLUE = "#0F6FC6";
const CYAN = "#009DD9";
const AQUA = "#0BD0D9";
const DARK = "#404040";
const MUTED = "#7F7F7F";
const SOURCE = "PPT源/狗哥蓝色-精美逻辑图PPT模板.pptx";

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    values[argv[index]?.replace(/^--/, "")] = argv[index + 1];
  }
  return values;
}

async function readArrayBuffer(file) {
  const bytes = await fs.readFile(file);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function writeBlob(file, blob) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}

function addShape(slide, geometry, position, options = {}) {
  return slide.shapes.add({
    geometry,
    position,
    fill: options.fill ?? "none",
    line: options.line ?? { style: "solid", fill: "none", width: 0 },
    shadow: options.shadow ?? "shadow-none",
    name: options.name,
    ...(options.borderRadius ? { borderRadius: options.borderRadius } : {}),
    ...(options.adjustmentList ? { adjustmentList: options.adjustmentList } : {}),
  });
}

function addText(slide, text, position, options = {}) {
  const box = addShape(slide, "textbox", position, {
    fill: options.fill ?? "none",
    line: options.line,
    shadow: options.shadow,
    name: options.name,
  });
  box.text = text;
  box.text.fontSize = options.fontSize ?? 20;
  box.text.typeface = options.typeface ?? "Microsoft YaHei";
  box.text.bold = Boolean(options.bold);
  box.text.color = options.color ?? DARK;
  box.text.alignment = options.alignment ?? "left";
  box.text.verticalAlignment = options.verticalAlignment ?? "middle";
  box.text.insets = options.insets ?? { left: 0, right: 0, top: 0, bottom: 0 };
  box.text.autoFit = options.autoFit ?? "shrinkText";
  return box;
}

function addPill(slide, text, position, fill) {
  const pill = addShape(slide, "roundRect", position, {
    fill,
    line: { style: "solid", fill: "#FFFFFF/70", width: 1 },
    shadow: "0px 7px 15px #0870B4/23",
    borderRadius: "rounded-full",
  });
  pill.text = text;
  pill.text.fontSize = 16;
  pill.text.typeface = "Source Han Sans CN Normal";
  pill.text.color = "#FFFFFF";
  pill.text.alignment = "center";
  pill.text.verticalAlignment = "middle";
  pill.text.insets = { left: 4, right: 4, top: 0, bottom: 0 };
  pill.text.autoFit = "shrinkText";
  return pill;
}

function addSourceChrome(slide, number, title, subtitle) {
  addText(slide, `${number} ${title}`, { left: 66, top: 48, width: 380, height: 43 }, {
    fontSize: 26, bold: true, typeface: "Source Han Serif CN Heavy", color: BLUE,
  });
  addText(slide, subtitle, { left: 66, top: 88, width: 300, height: 30 }, {
    fontSize: 19, typeface: "Source Han Sans CN Normal", color: MUTED,
  });
  [0, 1, 2].forEach((index) => addShape(slide, "ellipse", {
    left: 1206 + index * 16, top: 58, width: 7, height: 7,
  }, { fill: "#595959" }));
}

function addDashedRing(slide, position, color, width = 2) {
  return addShape(slide, "ellipse", position, {
    fill: "none",
    line: { style: "dashed", fill: color, width },
  });
}

function addWing(slide, side) {
  const isLeft = side === "left";
  const wing = addShape(slide, "ellipse", {
    left: isLeft ? -165 : 745,
    top: 138,
    width: 700,
    height: 455,
  }, {
    fill: isLeft
      ? "linear(0deg, #FFFFFF/0 0%, #D4E8FA/92 100%)"
      : "linear(180deg, #D5F2F8/92 0%, #FFFFFF/0 100%)",
    line: { style: "solid", fill: isLeft ? "#75B5E9" : "#77D8E7", width: 1.5 },
  });
  wing.sendToBack();
  const inner = addShape(slide, "ellipse", {
    left: isLeft ? -88 : 806,
    top: 174,
    width: 610,
    height: 383,
  }, {
    fill: "none",
    line: { style: "solid", fill: isLeft ? "#B5DAF6" : "#B9ECF2", width: 1.2 },
  });
  inner.sendToBack();
  return wing;
}

function buildMirrorComparison(slide, model) {
  slide.background.fill = "#FFFFFF";
  addSourceChrome(slide, model.number, model.title, model.subtitle);

  addWing(slide, "left");
  addWing(slide, "right");
  const centerMask = addShape(slide, "ellipse", { left: 324, top: 91, width: 632, height: 558 }, {
    fill: "#FFFFFF",
    line: { style: "solid", fill: "none", width: 0 },
  });
  addDashedRing(slide, { left: 366, top: 89, width: 561, height: 561 }, "#D2D2D2", 2);
  addDashedRing(slide, { left: 458, top: 183, width: 375, height: 375 }, "#BEBEBE", 2);

  const leftCircle = addShape(slide, "ellipse", { left: 335, top: 248, width: 246, height: 246 }, {
    fill: "linear(135deg, #1778D0 0%, #0F6FC6 100%)",
    line: { style: "solid", fill: "#FFFFFF/20", width: 1 },
    shadow: "0px 12px 24px #0F6FC6/24",
  });
  const rightCircle = addShape(slide, "ellipse", { left: 710, top: 248, width: 246, height: 246 }, {
    fill: "linear(135deg, #00B8E8 0%, #009DD9 100%)",
    line: { style: "solid", fill: "#FFFFFF/20", width: 1 },
    shadow: "0px 12px 24px #009DD9/24",
  });

  addText(slide, model.left.title, { left: 371, top: 312, width: 174, height: 48 }, {
    fontSize: 27, color: "#FFFFFF", bold: true, alignment: "center",
    typeface: "Source Han Sans CN Bold",
  });
  addText(slide, model.left.body, { left: 366, top: 359, width: 184, height: 86 }, {
    fontSize: 16, color: "#FFFFFF", alignment: "center",
    typeface: "Source Han Sans CN Normal",
  });
  addText(slide, model.right.title, { left: 746, top: 312, width: 174, height: 48 }, {
    fontSize: 27, color: "#FFFFFF", bold: true, alignment: "center",
    typeface: "Source Han Sans CN Bold",
  });
  addText(slide, model.right.body, { left: 741, top: 359, width: 184, height: 86 }, {
    fontSize: 16, color: "#FFFFFF", alignment: "center",
    typeface: "Source Han Sans CN Normal",
  });

  addText(slide, model.center, { left: 589, top: 331, width: 116, height: 74 }, {
    fontSize: 25, bold: true, alignment: "center", typeface: "Source Han Serif CN Heavy", color: DARK,
  });
  addShape(slide, "downArrow", { left: 605, top: 169, width: 87, height: 118 }, {
    fill: AQUA, line: { style: "solid", fill: "none", width: 0 }, shadow: "0px 8px 18px #0BD0D9/35",
  });
  addShape(slide, "upArrow", { left: 605, top: 456, width: 87, height: 118 }, {
    fill: AQUA, line: { style: "solid", fill: "none", width: 0 }, shadow: "0px 8px 18px #0BD0D9/35",
  });
  addText(slide, model.topLabel, { left: 551, top: 102, width: 190, height: 56 }, {
    fontSize: 20, bold: true, alignment: "center", typeface: "Source Han Sans CN Bold", color: DARK,
  });
  addText(slide, model.bottomLabel, { left: 551, top: 588, width: 190, height: 56 }, {
    fontSize: 20, bold: true, alignment: "center", typeface: "Source Han Sans CN Bold", color: DARK,
  });

  const ys = [291, 353, 415];
  const leftXs = [45, 190];
  const rightXs = [967, 1112];
  model.left.items.forEach((text, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    addPill(slide, text, { left: leftXs[col], top: ys[row], width: 124, height: 32 }, BLUE);
  });
  model.right.items.forEach((text, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    addPill(slide, text, { left: rightXs[col], top: ys[row], width: 124, height: 32 }, CYAN);
  });

}

function addPanel(slide, side, model) {
  const isLeft = side === "left";
  const x = isLeft ? 137 : 736;
  const color = isLeft ? "#8A8A8A" : BLUE;
  const deep = isLeft ? "#595959" : "#0B5395";
  addShape(slide, "roundRect", { left: x, top: 149, width: 414, height: 473 }, {
    fill: "#FFFFFF/94",
    line: { style: "dashed", fill: "#A8A8A8", width: 1.5 },
    borderRadius: "rounded-xl",
    shadow: "0px 10px 28px #0F6FC6/12",
  });
  addShape(slide, "roundRect", { left: x, top: 149, width: 414, height: 69 }, {
    fill: isLeft ? "linear(0deg, #7F7F7F 0%, #969696 100%)" : "linear(0deg, #0F6FC6 0%, #2487E8 100%)",
    line: { style: "solid", fill: "none", width: 0 },
    borderRadius: "rounded-xl",
    shadow: "0px 9px 22px #0F6FC6/18",
  });
  addText(slide, model.title, { left: x + 70, top: 157, width: 274, height: 38 }, {
    fontSize: 25, bold: true, color: "#FFFFFF", alignment: "center", typeface: "Source Han Serif CN Heavy",
  });
  addText(slide, model.subtitle, { left: x + 70, top: 192, width: 274, height: 23 }, {
    fontSize: 16, color: "#FFFFFF", alignment: "center", typeface: "Source Han Sans CN Normal",
  });

  model.items.forEach((item, index) => {
    const y = 266 + index * 76;
    addShape(slide, "roundRect", { left: x + 36, top: y, width: 340, height: 42 }, {
      fill: isLeft
        ? "linear(0deg, #8B8B8B 0%, #979797 100%)"
        : "linear(0deg, #0F6FC6 0%, #278BEF 100%)",
      line: { style: "solid", fill: "none", width: 0 },
      borderRadius: "rounded-full",
      shadow: "0px 8px 18px #0F6FC6/20",
    });
    addShape(slide, "ellipse", { left: x + 49, top: y + 7, width: 28, height: 28 }, {
      fill: deep,
      line: { style: "solid", fill: "none", width: 0 },
    });
    addText(slide, isLeft ? "×" : "✓", { left: x + 49, top: y + 7, width: 28, height: 28 }, {
      fontSize: 17, bold: true, color: "#FFFFFF", alignment: "center",
    });
    addText(slide, item, { left: x + 92, top: y + 5, width: 242, height: 32 }, {
      fontSize: 17, color: "#FFFFFF", alignment: "center", typeface: "DengXian",
    });
  });
}

function buildColumnComparison(slide, model) {
  slide.background.fill = "linear(90deg, #FFFFFF 0%, #EEF7FC 55%, #FFFFFF 100%)";
  addSourceChrome(slide, model.number, model.title, model.subtitle);
  addPanel(slide, "left", model.left);
  addPanel(slide, "right", model.right);
  addDashedRing(slide, { left: 570, top: 290, width: 140, height: 140 }, "#B8C2CA", 1.5);
  addShape(slide, "ellipse", { left: 587, top: 306, width: 107, height: 107 }, {
    fill: "linear(135deg, #0F6FC6 0%, #00B8E8 100%)",
    line: { style: "solid", fill: "#FFFFFF", width: 2 },
    shadow: "0px 10px 24px #0F6FC6/23",
  });
  addText(slide, "VS", { left: 603, top: 328, width: 75, height: 63 }, {
    fontSize: 42, color: "#FFFFFF", alignment: "center", typeface: "Source Han Sans CN Bold",
  });
  addShape(slide, "ellipse", { left: 64, top: 609, width: 1150, height: 74 }, {
    fill: "none", line: { style: "dashed", fill: "#60A5E8", width: 1.5 },
  });
  addShape(slide, "ellipse", { left: 96, top: 617, width: 1088, height: 61 }, {
    fill: "none", line: { style: "solid", fill: "#4C94D8", width: 3 },
  });
}

async function addReferenceSlide(presentation, imagePath, slideNumber) {
  const slide = presentation.slides.add();
  slide.background.fill = "#FFFFFF";
  slide.images.add({
    blob: await readArrayBuffer(imagePath),
    contentType: "image/png",
    fit: "contain",
    alt: `狗哥蓝色模板第 ${slideNumber} 页原始渲染`,
    position: { left: 0, top: 0, width: W, height: H },
  });
  slide.speakerNotes.textFrame.setText(`[Sources]\n- ${SOURCE}#slide=${slideNumber}`);
  return slide;
}

function addGeneratedSlide(presentation, builder, model, slideNumber) {
  const slide = presentation.slides.add();
  builder(slide, model);
  slide.speakerNotes.textFrame.setText([
    "[Sources]",
    `- ${SOURCE}#slide=${slideNumber}`,
    "- 本页为代码生成的视觉蒸馏实验，不是源页复制。",
  ].join("\n"));
  return slide;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const output = path.resolve(args.output ?? "outputs/资产学习实验/狗哥蓝色-视觉蒸馏实验-v0.3.0.pptx");
  const qaDir = path.resolve(args.qa ?? "experiments/视觉蒸馏方法验证/狗哥蓝色-p031-p055/qa-v0.3.0");
  const source31 = path.resolve(args.source31 ?? ".tmp/comparison-source-review/source-slide-031.png");
  const source55 = path.resolve(args.source55 ?? ".tmp/comparison-source-review/source-slide-055.png");

  const faithful31 = {
    number: "16", title: "多项目标", subtitle: "Intelligent invoicing",
    left: { title: "高质产品", body: "使用最先进的工艺\n和材料打造高质量产品", items: ["时尚造型", "款款独一无二", "1000道工序", "精细设计", "纳米打磨", "稀有材料"] },
    right: { title: "高端服务", body: "提供最优质的高端服务\n让客户百分百满意", items: ["一对一服务", "专属停车位", "职业解答", "零食饮料", "高素质人员", "专业礼仪"] },
    center: "高附加值\n策略", topLabel: "顶级投行参与\n大资本投入", bottomLabel: "尖端人才参与\n全球纳贤",
  };
  const adapted31 = {
    number: "A1", title: "双主体协同", subtitle: "Mirror comparison variant",
    left: { title: "内容导演", body: "理解原稿、组织叙事\n决定每页要讲什么", items: ["拆页", "主次", "证据", "节奏", "标题", "压缩"] },
    right: { title: "视觉导演", body: "安排整页构图\n选择合法核心资产", items: ["对齐", "层级", "留白", "均衡", "变体", "Skin"] },
    center: "共同完成\n表达", topLabel: "同一份原稿", bottomLabel: "同一套目标",
  };
  const faithful55 = {
    number: "40", title: "优劣比较", subtitle: "Enter your title",
    left: { title: "传统ERP", subtitle: "Enter your title", items: ["单体应用", "难于拓展", "顶不住高并发", "过时的管理理念"] },
    right: { title: "数字化时代ERP", subtitle: "Enter your title", items: ["微服务架构", "PASS平台", "高并发", "行业最佳实践"] },
  };
  const adapted55 = {
    number: "A2", title: "两种生成路线", subtitle: "Balanced column comparison",
    left: { title: "自由生成", subtitle: "每次临场设计", items: ["结果难以复现", "版式质量波动", "反复消耗判断", "难以沉淀经验"] },
    right: { title: "受控生成", subtitle: "调用已验证资产", items: ["输出稳定可靠", "版式边界明确", "问题可以回归", "能力持续积累"] },
  };

  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  await addReferenceSlide(presentation, source31, 31);
  addGeneratedSlide(presentation, buildMirrorComparison, faithful31, 31);
  addGeneratedSlide(presentation, buildMirrorComparison, adapted31, 31);
  await addReferenceSlide(presentation, source55, 55);
  addGeneratedSlide(presentation, buildColumnComparison, faithful55, 55);
  addGeneratedSlide(presentation, buildColumnComparison, adapted55, 55);

  await fs.mkdir(qaDir, { recursive: true });
  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(path.join(qaDir, `${stem}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(path.join(qaDir, `${stem}.layout.json`), await (await slide.export({ format: "layout" })).text(), "utf8");
  }
  await writeBlob(path.join(qaDir, "montage.webp"), await presentation.export({ format: "webp", montage: true, scale: 1 }));
  await fs.mkdir(path.dirname(output), { recursive: true });
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(output);
  console.log(JSON.stringify({ output, qaDir, slides: presentation.slides.items.length }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
