import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import { invokeStructure, closeStructureRuntime } from "../../../../.codex/skills/ppagent-structure/scripts/invoke.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const outDir = here;
const finalPptx = path.join(outDir, "deck.pptx");
const evidencePath = path.join(outDir, "structure-invocations.ndjson");

const COLORS = Object.freeze({
  ink: "#252B33",
  navy: "#173B70",
  blue: "#2859E8",
  gray: "#707780",
  line: "#D8DEE8",
  pale: "#EEF2F8",
  paleBlue: "#E8EEFF",
  white: "#FFFFFF",
});
const FONT = "Microsoft YaHei";

const skin = Object.freeze({
  id: "consultative-argument-v4",
  bodyFrame: { left: 55, top: 166, width: 1170, height: 492 },
  componentSourceFrame: { left: 55, top: 166, width: 1170, height: 492 },
  componentTheme: Object.freeze({
    background: COLORS.white,
    surface: COLORS.white,
    accent: COLORS.blue,
    accentAlt: COLORS.navy,
    accentSoft: COLORS.paleBlue,
    cyan: "#C8D5F7",
    dark: COLORS.ink,
    body: COLORS.ink,
    muted: COLORS.gray,
    line: COLORS.line,
    font: FONT,
    typography: Object.freeze({
      componentHeading: 17,
      componentTitle: 16,
      componentItemTitle: 15,
      componentLead: 15,
      componentBody: 14,
      componentLabel: 13,
      componentMeta: 11,
    }),
  }),
});

function addShape(slide, geometry, position, fill = "none", line = { style: "solid", fill: "none", width: 0 }, extra = {}) {
  return slide.shapes.add({ geometry, position, fill, line, ...extra });
}

function addText(slide, text, position, style = {}) {
  const shape = addShape(slide, "textbox", position);
  shape.text = text;
  shape.text.style = {
    typeface: FONT,
    color: COLORS.ink,
    fontSize: 20,
    alignment: "left",
    verticalAlignment: "top",
    autoFit: "none",
    ...style,
  };
  return shape;
}

function addRule(slide, left, top, width, color = COLORS.line, height = 1) {
  return addShape(slide, "rect", { left, top, width, height }, color);
}

function addPageChrome(slide, section, title, pageNumber) {
  slide.background.fill = COLORS.white;
  addRule(slide, 55, 36, 68, COLORS.blue, 4);
  addText(slide, section, { left: 139, top: 28, width: 300, height: 24 }, {
    fontSize: 16,
    bold: true,
    color: COLORS.gray,
  });
  addText(slide, title, { left: 55, top: 58, width: 1170, height: 50 }, {
    fontSize: 32,
    bold: true,
    color: COLORS.ink,
  });
  addText(slide, String(pageNumber).padStart(2, "0"), { left: 1174, top: 672, width: 51, height: 20 }, {
    fontSize: 14,
    bold: true,
    color: COLORS.gray,
    alignment: "right",
  });
}

function addSource(slide, text) {
  addText(slide, text, { left: 55, top: 672, width: 1080, height: 20 }, {
    fontSize: 14,
    color: COLORS.gray,
  });
  slide.speakerNotes.textFrame.setText([
    "[Sources]",
    "- 虚构测试数据与方案（稿件提供，非外部来源）",
  ]);
  slide.speakerNotes.setVisible(true);
}

function addLegendItem(slide, left, top, color, label, labelWidth = 96) {
  addShape(slide, "rect", { left, top: top + 5, width: 12, height: 12 }, color);
  addText(slide, label, { left: left + 18, top, width: labelWidth, height: 22 }, { fontSize: 16, color: COLORS.gray });
}

function addSegmentedBar(slide, y, label, values, totalLabel) {
  const labelX = 55;
  const barX = 220;
  const barW = 560;
  const scale = barW / 5;
  const fills = [COLORS.navy, COLORS.blue, "#8EA8E8"];
  addText(slide, label, { left: labelX, top: y + 10, width: 150, height: 28 }, {
    fontSize: 20,
    bold: true,
    color: COLORS.ink,
  });
  let x = barX;
  values.forEach((value, idx) => {
    const width = value * scale;
    const segment = addShape(slide, "rect", { left: x, top: y, width, height: 48 }, fills[idx]);
    segment.name = `${label}-stage-${idx + 1}`;
    addText(slide, value.toFixed(1), { left: x, top: y + 13, width, height: 24 }, {
      fontSize: 16,
      bold: true,
      color: COLORS.white,
      alignment: "center",
      verticalAlignment: "middle",
    });
    x += width;
  });
  addText(slide, totalLabel, { left: 786, top: y + 10, width: 64, height: 28 }, {
    fontSize: 16,
    bold: true,
    color: COLORS.ink,
  });
}

function addAxis(slide) {
  const x0 = 220;
  const scale = 560 / 5;
  addRule(slide, x0, 394, 560, COLORS.line, 1);
  for (let i = 0; i <= 5; i += 1) {
    const x = x0 + i * scale;
    addRule(slide, x, 390, 1, COLORS.line, 9);
    addText(slide, String(i), { left: x - 12, top: 404, width: 24, height: 20 }, {
      fontSize: 14,
      color: COLORS.gray,
      alignment: "center",
    });
  }
  addText(slide, "工作日", { left: 806, top: 404, width: 64, height: 20 }, { fontSize: 14, color: COLORS.gray });
}

function addInsight(slide, top, title, body, accent = COLORS.blue) {
  addRule(slide, 850, top + 2, 4, accent, 42);
  addText(slide, title, { left: 870, top, width: 340, height: 28 }, {
    fontSize: 22,
    bold: true,
    color: accent,
  });
  addText(slide, body, { left: 870, top: top + 34, width: 340, height: 56 }, {
    fontSize: 18,
    color: COLORS.ink,
  });
}

function buildEvidenceSlide(presentation) {
  const slide = presentation.slides.add();
  addPageChrome(slide, "阶段复盘｜定量证据", "试点批次平均少 1.8 个工作日，但差异不能归因于试点", 1);

  addText(slide, "平均完成时间（工作日）", { left: 55, top: 140, width: 300, height: 30 }, {
    fontSize: 22,
    bold: true,
    color: COLORS.ink,
  });
  addText(slide, "同一阶段、同一坐标；每批 120 件已结案申请", { left: 55, top: 174, width: 430, height: 24 }, {
    fontSize: 16,
    color: COLORS.gray,
  });
  addLegendItem(slide, 420, 143, COLORS.navy, "受理分流", 84);
  addLegendItem(slide, 525, 143, COLORS.blue, "材料核对", 84);
  addLegendItem(slide, 630, 143, "#8EA8E8", "教师处理及等待", 150);

  addSegmentedBar(slide, 230, "人工批次", [0.8, 1.6, 2.6], "5.0");
  addSegmentedBar(slide, 310, "试点批次", [0.6, 1.0, 1.6], "3.2");
  addAxis(slide);
  addText(slide, "差异 = 1.8 天", { left: 548, top: 448, width: 240, height: 28 }, {
    fontSize: 20,
    bold: true,
    color: COLORS.blue,
    alignment: "right",
  });

  addText(slide, "差异落点", { left: 850, top: 140, width: 300, height: 30 }, {
    fontSize: 22,
    bold: true,
    color: COLORS.ink,
  });
  addInsight(slide, 190, "整体差 1.8 天", "5.0 → 3.2；这是两批已结案记录的平均差异。", COLORS.blue);
  addInsight(slide, 306, "最大阶段差异为 1.0 天", "教师处理及等待从 2.6 降到 1.6 天，约占总差异 56%。", COLORS.navy);
  addInsight(slide, 422, "试点批次仍以教师环节为主", "1.6 天占试点总用时 50%；合并记录不能拆出实际处理与排队。", COLORS.gray);

  addRule(slide, 55, 610, 1170, COLORS.line, 1);
  addText(slide, "比较边界｜两批来自不同月份；事项难度与人员负荷未控制、未随机分组，时间差异不等于试点因果效果。", { left: 55, top: 620, width: 1170, height: 30 }, {
    fontSize: 16,
    color: COLORS.gray,
  });
  addSource(slide, "来源：虚构测试数据与方案｜均值按三个不重叠阶段相加");
  return slide;
}

async function buildProcessSlide(presentation) {
  const slide = presentation.slides.add();
  addPageChrome(slide, "下一轮安排｜流程与边界", "下一轮先验证“能不能执行”，再判断是否值得缩短时间", 2);
  addText(slide, "四周、仅限常规申请；超授权或非常规事项暂停流转，由负责人指定处理人", { left: 55, top: 122, width: 1170, height: 24 }, {
    fontSize: 18,
    color: COLORS.gray,
  });

  const beforeCount = slide.shapes.items.length;
  await invokeStructure({
    root,
    slide,
    skin,
    assetId: "sequence-phase-gates-004",
    parameters: {
      phases: [
        {
          key: "intake",
          title: "受理分流",
          body: "服务助理登记类型与首次提交时间",
        },
        {
          key: "check",
          title: "材料核对",
          body: "助理按清单核对齐备性；缺件暂停，补齐后重核",
        },
        {
          key: "teacher",
          title: "教师处理",
          body: "教师作专业判断并确认答复；记录接收与答复时间；助理不代作承诺",
        },
      ],
      gates: [
        { key: "authorized", title: "授权范围", body: "常规事项才推进" },
        { key: "complete", title: "材料齐备", body: "齐备后才送交教师" },
      ],
    },
    targetFrame: skin.bodyFrame,
    evidencePath,
    pageId: "argument-01-page-02",
    regionId: "main-process",
    reason: "稿件给出三个真实连续步骤，且授权范围与材料齐备是相邻阶段必须满足的推进门禁；缺件补齐为第二阶段局部异常规则。",
  });

  const beforeLayout = await (await slide.export({ format: "layout" })).text();
  await fs.writeFile(path.join(outDir, "slide-02-structure-before-adaptation.layout.json"), beforeLayout, "utf8");

  const generated = slide.shapes.items.slice(beforeCount);
  const adaptation = [];
  for (const shape of generated) {
    const textValue = typeof shape.text === "string" ? shape.text : "";
    if (shape.text && typeof shape.text === "object") {
      try {
        shape.text.typeface = FONT;
        adaptation.push({ id: shape.id, text: textValue, change: "typeface→Microsoft YaHei; geometry/color/alignment preserved" });
      } catch (error) {
        adaptation.push({ id: shape.id, text: textValue, change: "typeface adaptation unavailable", error: error.message });
      }
    }
    try {
      shape.shadow = "shadow-none";
    } catch {
      // Some generated elements do not expose shadow; keep the native object unchanged.
    }
  }
  await fs.writeFile(path.join(outDir, "style-adaptation.json"), JSON.stringify({
    rule: "仅适配字体与装饰投影；保留结构对象 ID、数量、文本、位置、几何、路径与方向。",
    generatedShapeCount: generated.length,
    changes: adaptation,
  }, null, 2), "utf8");

  addSource(slide, "来源：虚构测试数据与方案｜方案尚未实施；四周后只判断可执行性与记录完整性");
  return slide;
}

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  buildEvidenceSlide(presentation);
  await buildProcessSlide(presentation);

  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(path.join(outDir, `${stem}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(path.join(outDir, `${stem}.layout.json`), await (await slide.export({ format: "layout" })).text(), "utf8");
  }
  await fs.writeFile(path.join(outDir, "deck-inspection.ndjson"), (await presentation.inspect({ kind: "slide,textbox,shape,chart,notes", maxChars: 24000 })).ndjson, "utf8");
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(finalPptx);
  await fs.writeFile(path.join(outDir, "report.txt"), [
    "argument-01 / run-01",
    "",
    "沟通任务：让院系服务负责人先看懂两批已结案记录的时间差异，再看懂下一轮连续分工、推进条件和权限边界。",
    "叙事：定量证据 → 差异落点与证据边界 → 下一轮执行流程 → 四周后的可执行性与记录完整性判断。",
    "",
    "页面 1：原生矩形与文字构成同一坐标下的阶段堆叠条，直接标出 5.0→3.2 与 1.8 天差异；未将差异写成试点成效。",
    "页面 2：真实调用 sequence-phase-gates-004，3 阶段、2 个推进门禁；缺件补齐保留为材料核对阶段的局部规则，不增设正常流程第四步。",
    "",
    "结构适配：仅尝试将结构文字统一为 Microsoft YaHei、移除可移除装饰投影；没有删除、重排或改写结构节点/门禁。详见 style-adaptation.json 及 before/after layout JSON。",
    "检查覆盖：builder 导出的文字、字号、颜色与几何布局 JSON；最终 PNG 已导出供父任务审阅，但本运行未查看图片或渲染预览。",
    "限制：无越界/无重叠的正式判断需结合后续 slides_test.py 与父任务的视觉审阅；当前稿件数据、机构场景和方案均为虚构。",
  ].join("\n"), "utf8");
}

main().catch(async (error) => {
  console.error(error);
  try { await closeStructureRuntime(); } catch {}
  process.exitCode = 1;
});
