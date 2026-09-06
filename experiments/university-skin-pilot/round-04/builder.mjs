import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import { prepareTemplateMappedStarter } from "../../../src/asset-runtime/template-utils.mjs";

const ROOT = "C:/PPagenT/experiments/university-skin-pilot/round-04";
const SOURCE = "C:/PPagenT/assets/主题/东北大学-001/runtime-template.pptx";
const STARTER = path.join(ROOT, "template-starter.pptx");
const FINAL = path.join(ROOT, "deck.pptx");
const BLUE = "#2F5EA8";
const BODY = "#404040";
const MUTED = "#6F7D91";
const LINE = "#AFC6E8";
const PALE = "#F5F8FD";
const WHITE = "#FFFFFF";
const BODY_FRAME = { left: 55, top: 166, width: 1170, height: 492 };

async function writeText(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, "utf8");
}

async function writeBlob(filePath, blob) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, Buffer.from(await blob.arrayBuffer()));
}

function recordsFrom(snapshot) {
  return (snapshot.ndjson || "").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function inspectRecords(presentation) {
  return recordsFrom(await presentation.inspect({ kind: "slide,textbox,shape,image,table,chart,notes,layout", maxChars: 300000 }));
}

function textStyle(fontSize, color = BODY, extra = {}) {
  return {
    typeface: "Microsoft YaHei",
    fontSize,
    color,
    alignment: "left",
    verticalAlignment: "top",
    autoFit: "none",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    ...extra,
  };
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
  shape.text.style = textStyle(style.fontSize ?? 22, style.color ?? BODY, style);
  return shape;
}

function addBox(slide, name, position, fill = WHITE, lineFill = LINE, lineWidth = 1, geometry = "rect") {
  return slide.shapes.add({
    geometry,
    name,
    position,
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
  });
}

function addRule(slide, name, left, top, width, height = 0, color = LINE, lineWidth = 1) {
  return slide.shapes.add({
    geometry: "line",
    name,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: color, width: lineWidth },
  });
}

async function setLocalText(presentation, slideNumber, sourceText, replacement) {
  const records = await inspectRecords(presentation);
  const hit = records.find((r) => r.slide === slideNumber && r.kind === "textbox" && r.text === sourceText);
  if (!hit) throw new Error(`第${slideNumber}页找不到文本：${sourceText}`);
  presentation.resolve(hit.id).text = replacement;
}

async function deleteLocalObjects(presentation, slideNumber, predicate) {
  const records = await inspectRecords(presentation);
  const hits = records.filter((r) => r.slide === slideNumber && predicate(r));
  for (const hit of hits) presentation.resolve(hit.id).delete();
  return hits.length;
}

function bodyNotes(slideTitle, intent) {
  return `[Sources]\n- 无外部来源；可见内容来自用户提供的 manuscript.md。\n- 视觉源：用户指定的 runtime-template.pptx。\n\n[Design note]\n${slideTitle}\n布局意图：${intent}`;
}

function frame(left, top, width, height) { return { left, top, width, height }; }

function addSectionLabel(slide, x, y, label, width = 250) {
  addText(slide, `qa-section-${label}`, label, frame(x, y, width, 30), { fontSize: 24, color: BLUE, bold: true });
}

function addBottomNote(slide, text) {
  addBox(slide, "qa-bottom-note", frame(55, 602, 1170, 44), PALE, LINE, 1);
  addText(slide, "qa-bottom-note-text", text, frame(78, 611, 1124, 26), { fontSize: 18, color: BODY });
}

function addComparisonRow(slide, y, label, leftText, rightText, leftX = 205, rightX = 720, leftW = 430, rightW = 445) {
  addText(slide, `qa-row-label-${y}`, label, frame(70, y + 14, 115, 30), { fontSize: 18, color: BLUE, bold: true });
  addText(slide, `qa-left-${y}`, leftText, frame(leftX, y, leftW, 62), { fontSize: 22, color: BODY });
  addText(slide, `qa-right-${y}`, rightText, frame(rightX, y, rightW, 62), { fontSize: 22, color: BODY });
  addRule(slide, `qa-row-rule-${y}`, 70, y + 72, 1110, 0, LINE, 1);
}

function addNumberedStep(slide, index, y, action, result) {
  addText(slide, `qa-step-number-${index}`, String(index).padStart(2, "0"), frame(72, y + 10, 72, 32), { fontSize: 22, color: BLUE, bold: true });
  addRule(slide, `qa-step-mark-${index}`, 148, y + 6, 0, 42, LINE, 2);
  addText(slide, `qa-step-action-${index}`, action, frame(180, y, 430, 62), { fontSize: 22, color: BODY, bold: true });
  addText(slide, `qa-step-result-${index}`, result, frame(660, y, 500, 62), { fontSize: 22, color: BODY });
  if (index < 4) addRule(slide, `qa-step-rule-${index}`, 180, y + 70, 980, 0, LINE, 1);
}

async function makeDeck() {
  const sourceSlides = [1, 2, 3, 3, 3, 3, 3, 3, 4];
  await prepareTemplateMappedStarter({ sourcePptx: SOURCE, sourceSlideNumbers: sourceSlides, starterPptx: STARTER });
  const presentation = await PresentationFile.importPptx(await FileBlob.load(STARTER));
  const slides = [...presentation.slides.items];

  await setLocalText(presentation, 1, "MDM方法偏移量自适应选取", "实验数据归档");
  await setLocalText(presentation, 1, "汇报人：魏鹏宇", "汇报人：课题组讨论");
  await setLocalText(presentation, 1, "2026.07.20", "2026.09");
  slides[0].speakerNotes.textFrame.setText("[Sources]\n- 无外部来源；可见内容来自用户提供的 manuscript.md。\n- 视觉源：用户指定的 runtime-template.pptx。");

  await setLocalText(presentation, 2, "目录", "本次讨论的推进路径");
  await setLocalText(presentation, 2, "1. 定义问题\n2. 真参数未知如何实现“样本-最优偏移量”的选择\n3. 一些关于神经网络的验证\n4. 论文准备\n5. 下一个研究课题", "1. 问题：找到图片，不等于解释结果\n2. 记录：让结果与依据成组可追溯\n3. 边界：共享材料不等于开放原始数据\n4. 方案：先试新增实验，再补关键历史\n5. 决策：四周后保留、修改或停止");
  slides[1].speakerNotes.textFrame.setText("[Sources]\n- 无外部来源；可见内容来自用户提供的 manuscript.md。\n- 视觉源：用户指定的 runtime-template.pptx。");

  const bodySpecs = [
    {
      title: "文件存在，不等于结果可以解释",
      section: "问题界定",
      intent: "左侧把“找到图片”与“解释结果”置于同一对照轴；右侧沿同一行补出缺失的样本、脚本与排除依据，底部收束归档的首要任务。",
      build(slide) {
        addSectionLabel(slide, 70, 186, "可见结果");
        addSectionLabel(slide, 720, 186, "可解释结果");
        addComparisonRow(slide, 245, "现状", "最终图片常常找得到", "还不能快速说明来自哪批样本、哪版脚本");
        addComparisonRow(slide, 335, "缺口", "文件上传解决的是“有没有”", "样本条件、处理版本、异常与排除决定“为什么”");
        addComparisonRow(slide, 425, "判断", "问题不只是文件没有上传", "归档首先要保存结果与依据之间的关系");
        addBottomNote(slide, "共享范围应在关系清楚之后再讨论；归档不是把文件简单集中到一个目录。");
      },
    },
    {
      title: "一次可讨论的结果，需要一组共同解释它的记录",
      section: "记录单元",
      intent: "共享标题先定义一个记录单元；五行使用统一的标签列与说明列，让共同组成关系直接可见，并在底部排除“依次执行五步”的误读。",
      build(slide) {
        addSectionLabel(slide, 70, 186, "一个记录单元");
        addText(slide, "qa-record-intro", "以下几项共同解释一个结果", frame(320, 188, 520, 30), { fontSize: 22, color: BODY });
        const rows = [
          ["原始数据位置", "保持原貌，指向实际样本与采集材料"],
          ["样本与采集条件", "说明结果对应的样本、时间和采集条件"],
          ["处理脚本版本", "能定位实际运行的代码版本"],
          ["结果文件", "保存可讨论的结果图或结果文件"],
          ["异常与排除说明", "保留判断依据；未纳入结果的样本也解释排除条件"],
        ];
        addBox(slide, "qa-record-surface", frame(70, 235, 1140, 330), WHITE, LINE, 1);
        rows.forEach((row, i) => {
          const y = 252 + i * 60;
          addText(slide, `qa-record-label-${i}`, row[0], frame(92, y, 240, 32), { fontSize: 22, color: BLUE, bold: true });
          addText(slide, `qa-record-body-${i}`, row[1], frame(365, y, 790, 36), { fontSize: 22, color: BODY });
          if (i < rows.length - 1) addRule(slide, `qa-record-rule-${i}`, 92, y + 42, 1060, 0, LINE, 1);
        });
        addBottomNote(slide, "这几项共同解释一个结果，并不是必须依次执行的五个步骤。");
      },
    },
    {
      title: "记录完整，也不能替代授权边界",
      section: "边界条件",
      intent: "左右两列沿“讨论材料—原始数据—访问权”逐行对应，右侧小区补充不能因归档而改变的授权与合作限制。",
      build(slide) {
        addSectionLabel(slide, 70, 186, "同一记录中的两种材料");
        addSectionLabel(slide, 760, 186, "不能改变的边界", 360);
        addComparisonRow(slide, 245, "材料", "结果图与可公开的解释", "受限原始数据仍放在原授权位置", 230, 760, 450, 400);
        addComparisonRow(slide, 335, "记录", "保留受控引用与访问条件", "涉及个人信息或合作限制的内容不改变授权", 230, 760, 450, 400);
        addComparisonRow(slide, 425, "误读", "记录表里出现一个路径", "不代表其他成员已经取得访问权", 230, 760, 450, 400);
        addBottomNote(slide, "共享的是可讨论的解释；权限边界仍由原授权与负责人处理。");
      },
    },
    {
      title: "先记录新增实验，再逐项补关键历史",
      section: "推进选择",
      intent: "两列在相同的“能得到什么—要承担什么—暂时解决不了什么”轴上比较推进范围，底部把建议标为范围选择并保留不确定性。",
      build(slide) {
        addSectionLabel(slide, 70, 186, "集中补历史档案");
        addSectionLabel(slide, 710, 186, "从新增实验开始");
        addComparisonRow(slide, 245, "能得到", "一次形成较大的目录", "上下文尚清楚时直接记录", 220, 730, 420, 420);
        addComparisonRow(slide, 335, "代价", "耗时追查遗失上下文，可能把记忆写成确定说明", "短期内无法解决全部历史材料的追溯", 220, 730, 420, 420);
        addComparisonRow(slide, 445, "建议", "不作为首轮范围", "先对新增实验试行；真正需要复核的历史结果逐项补充", 220, 730, 420, 420);
        addBottomNote(slide, "这是范围选择，不能表述为已经证明新方式更高效。");
      },
    },
    {
      title: "复核先检验可理解性，再交负责人确认",
      section: "执行与检查",
      intent: "按真实先后排列四个动作；每行右侧紧邻产出或判据，授权例外附着在最后确认环节，不把暂停误画成完成后的额外步骤。",
      build(slide) {
        addText(slide, "qa-step-head-action", "动作", frame(180, 188, 300, 28), { fontSize: 18, color: BLUE, bold: true });
        addText(slide, "qa-step-head-result", "产出 / 判据", frame(660, 188, 300, 28), { fontSize: 18, color: BLUE, bold: true });
        addNumberedStep(slide, 1, 230, "执行者提交结果记录", "结果、字段与受控引用齐备");
        addNumberedStep(slide, 2, 320, "另一位成员尝试定位", "提出缺项：数据、脚本或条件");
        addNumberedStep(slide, 3, 410, "执行者补充后交负责人", "负责人确认后进入可讨论版本");
        addNumberedStep(slide, 4, 500, "若涉及新授权，暂停共享", "负责人处理授权后再继续");
        addBottomNote(slide, "复核不要求复做整项实验，也不代替科学结论审查；先检查别人能否理解结果如何产生。");
      },
    },
    {
      title: "四周试点只验证是否值得继续",
      section: "试点决策",
      intent: "上半区用共享周次轴对应四周动作，下半区并列三个评估问题与停止信号；页面结论只落到“保留、修改或停止”的决策。",
      build(slide) {
        addSectionLabel(slide, 70, 186, "拟定范围：一个课题方向 · 两名自愿成员", 650);
        const weeks = [
          ["第 1 周", "明确最少字段\n用一个结果试填"],
          ["第 2 周", "实际记录\n收集缺项"],
          ["第 3 周", "继续记录\n观察填写负担"],
          ["第 4 周", "讨论保留、修改\n或停止"],
        ];
        weeks.forEach((item, i) => {
          const x = 70 + i * 285;
          addBox(slide, `qa-week-${i}`, frame(x, 238, 250, 114), i === 3 ? "#EAF2FF" : PALE, LINE, 1);
          addText(slide, `qa-week-label-${i}`, item[0], frame(x + 18, 254, 210, 26), { fontSize: 22, color: BLUE, bold: true });
          addText(slide, `qa-week-body-${i}`, item[1], frame(x + 18, 292, 210, 48), { fontSize: 18, color: BODY });
          if (i < 3) addRule(slide, `qa-week-link-${i}`, x + 250, 295, 35, 0, BLUE, 2);
        });
        addRule(slide, "qa-eval-divider", 70, 382, 1140, 0, LINE, 1);
        addSectionLabel(slide, 70, 404, "评估回答");
        addText(slide, "qa-eval", "01  能否沿记录定位结果来源？\n02  关键处理与排除是否有可理解依据？\n03  记录负担是否在成员愿意持续承担的范围内？", frame(70, 450, 540, 116), { fontSize: 20, color: BODY });
        addSectionLabel(slide, 690, 404, "停止或修改信号");
        addText(slide, "qa-stop", "填写持续挤占必要实验时间\n权限边界无法说明\n记录只增加重复抄写而没有帮助解释结果", frame(690, 450, 520, 116), { fontSize: 20, color: BODY });
      },
    },
  ];

  for (let i = 0; i < bodySpecs.length; i += 1) {
    const slideNumber = i + 3;
    await deleteLocalObjects(presentation, slideNumber, (r) => ["箭头: 下 9", "图片 10", "文本框 13"].includes(r.name));
    await setLocalText(presentation, slideNumber, "主旨句", bodySpecs[i].title);
    await setLocalText(presentation, slideNumber, "正文页", bodySpecs[i].section);
    await setLocalText(presentation, slideNumber, "01", String(slideNumber).padStart(2, "0"));
    bodySpecs[i].build(slides[slideNumber - 1]);
    slides[slideNumber - 1].speakerNotes.textFrame.setText(bodyNotes(bodySpecs[i].title, bodySpecs[i].intent));
  }

  await setLocalText(presentation, 9, "敬请老师批评指正", "先让一次结果可以被理解\n再决定哪些记录值得长期保存");
  slides[8].speakerNotes.textFrame.setText("[Sources]\n- 无外部来源；可见内容来自用户提供的 manuscript.md。\n- 视觉源：用户指定的 runtime-template.pptx。\n\n[Design note]\n结尾回到有限试点的判断边界，不把拟定安排包装成已证实成效。");

  const map = {
    outputSlides: sourceSlides.map((sourceSlide, index) => ({
      outputSlide: index + 1,
      sourceSlide,
      narrativeRole: index === 0 ? "opening thesis" : index === 1 ? "discussion path" : index === 8 ? "closing identity" : bodySpecs[index - 2].title,
      reuseMode: "duplicate-slide",
      editTargets: index < 2 || index === 8 ? ["inherited title/text slots"] : ["inherited page title", "inherited section label", "inherited page marker", "delete sample content", "add bounded native body composition"],
    })),
    omittedSourceSlides: [],
  };
  await writeText(path.join(ROOT, "template-frame-map.json"), JSON.stringify(map, null, 2));
  await writeText(path.join(ROOT, "template-audit.txt"), [
    "source: assets/主题/东北大学-001/runtime-template.pptx",
    "source slide count: 4",
    "source slides used: 1 cover, 2 contents, 3 body, 4 closing",
    "preserved inherited identity: logo, title band, section/page chrome, bottom rule, cover/closing master layouts",
    "body content frame: x=55, y=166, width=1170, height=492",
    "body typography: Microsoft YaHei; group title 24, body 22, support 18, sources 16 (design units)",
    "theme colors: #2F5EA8, #404040, #6F7D91, #AFC6E8, #F5F8FD, #FFFFFF",
  ].join("\n"));
  await writeText(path.join(ROOT, "deviation-log.txt"), [
    "1. Body sample arrow, sample image and sample正文 label deleted on duplicated body slides because they were template sample content.",
    "2. New native text rows, rules and pale surfaces added only inside the contracted content frame to carry the manuscript logic.",
    "3. Cover, contents and closing copy rewritten for this manuscript; inherited shell geometry and identity retained.",
  ].join("\n"));
  await writeText(path.join(ROOT, "content-coverage.txt"), [
    "manuscript.md coverage map",
    "P1: virtual university / discussion purpose / finite four-week pilot -> cover and slide 8 notes",
    "P2: finding final image but not sample/script/exclusions -> slide 3",
    "P3: record unit fields and original/cleaned separation -> slide 4",
    "P4: restricted raw data, controlled references, access is not implied -> slide 5",
    "P5: historical archive vs new experiments and limited claim -> slide 6",
    "P6: four-step review sequence, authorization pause, non-reproduction/non-scientific-review boundary -> slide 7",
    "P7: four-week scope, one direction, two volunteers, no efficiency/completion numbers -> slide 8",
    "P8: evaluation questions, stop/modify signals -> slide 8",
    "P9: owner, authorization contact, member consent, decision boundary -> slide 8 notes and closing",
    "P10: final takeaway: understand one result before deciding what to retain -> closing",
  ].join("\n"));
  const intents = bodySpecs.map((s, i) => ({ slide: i + 3, title: s.title, intent: s.intent }));
  await writeText(path.join(ROOT, "layout-intents.json"), JSON.stringify({ slides: [
    { slide: 1, intent: "封面保持极简，以源模板大标题承担主题识别，保留汇报人与日期身份信息。" },
    { slide: 2, intent: "目录改为递进路径，让读者看到从问题到有限决策的讨论动作。" },
    ...intents,
    { slide: 9, intent: "结尾回到有限尝试与证据边界，以一句可讨论的判断收束并保留结尾身份版式。" },
  ] }, null, 2));

  for (const [i, slide] of slides.entries()) {
    const stem = `slide-${String(i + 1).padStart(2, "0")}`;
    await writeBlob(path.join(ROOT, `${stem}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    await writeText(path.join(ROOT, `${stem}.layout.json`), await (await slide.export({ format: "layout" })).text());
  }
  await writeBlob(path.join(ROOT, "deck-montage.webp"), await presentation.export({ format: "webp", montage: true, scale: 1 }));
  await writeText(path.join(ROOT, "inspect-final.ndjson"), (await presentation.inspect({ kind: "slide,textbox,shape,image,table,chart,notes,layout", maxChars: 300000 })).ndjson || "");
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(FINAL);
  return { slideCount: slides.length, final: FINAL };
}

makeDeck().then((result) => console.log(JSON.stringify(result))).catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
