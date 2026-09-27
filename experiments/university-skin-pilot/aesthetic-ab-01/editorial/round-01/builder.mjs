import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "C:/PPagenT/experiments/university-skin-pilot/aesthetic-ab-01/editorial/round-01";
const W = 1280, H = 720;
const FONT = "Microsoft YaHei";
const C = {
  primary: "#315F91",
  ink: "#252B33",
  muted: "#707780",
  bg: "#FFFFFF",
  pale: "#F6F8FB",
  light: "#EEF3F8",
  line: "#D8DEE6",
  white: "#FFFFFF",
  dark: "#234569"
};

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function textbox(slide, name, text, x, y, w, h, size, color = C.ink, bold = false, align = "left") {
  const s = slide.shapes.add({ geometry: "textbox", name, position: { left: x, top: y, width: w, height: h }, fill: "none", line: { style: "solid", fill: "none", width: 0 } });
  s.text = text;
  s.text.style = { fontFamily: FONT, fontSize: size, color, bold, alignment: align, verticalAlignment: "middle" };
  return s;
}

function rect(slide, name, x, y, w, h, fill = C.pale, stroke = C.line, radius = "square") {
  return slide.shapes.add({ geometry: radius === "round" ? "roundRect" : "rect", name, position: { left: x, top: y, width: w, height: h }, fill, line: { style: "solid", fill: stroke, width: 1 }, borderRadius: radius === "round" ? "rounded-md" : undefined });
}

function rule(slide, name, x, y, w, color = C.line, width = 1) {
  return slide.shapes.add({ geometry: "line", name, position: { left: x, top: y, width: w, height: 0 }, fill: "none", line: { style: "solid", fill: color, width } });
}

function heading(slide, n, title, kicker = "PPAGENT / 产品叙事") {
  textbox(slide, `eyebrow-${n}`, kicker, 55, 28, 420, 22, 12, C.primary, true);
  textbox(slide, `title-${n}`, title, 55, 56, 1170, 54, 30, C.ink, true);
  rule(slide, `title-rule-${n}`, 55, 124, 1170, C.line, 1);
  textbox(slide, `page-${n}`, String(n).padStart(2, "0"), 1180, 26, 45, 26, 12, C.muted, false, "right");
}

function footer(slide, n, label = "PPagenT 产品叙事") {
  rule(slide, `footer-rule-${n}`, 55, 680, 1170, C.line, 1);
  textbox(slide, `footer-${n}`, label, 55, 684, 600, 24, 12, C.muted);
}

function arrow(slide, source, target, evidence, connections) {
  slide.shapes.connect(source, target, { kind: "straight", fromSide: "right", toSide: "left", line: { fill: C.primary, width: 2 }, tail: { type: "arrow", width: "sm", length: "sm" } });
  connections.push({ source: source.name, target: target.name, arrowAt: "target", evidence });
}

function addNotes(slide, text) {
  if (slide.addNotes) slide.addNotes(text);
}

async function main() {
  const p = Presentation.create({ slideSize: { width: W, height: H } });
  const connections = [];
  const linePaths = [];

  // 1 cover
  {
    const s = p.slides.add(); s.background.fill = C.bg;
    rect(s, "cover-band", 55, 55, 10, 610, C.primary, C.primary);
    textbox(s, "cover-kicker", "PPAGENT / 产品叙事", 105, 96, 500, 25, 13, C.primary, true);
    textbox(s, "cover-title", "把 PPT 生成\n变成可靠的生产过程", 105, 170, 750, 160, 44, C.ink, true);
    textbox(s, "cover-subtitle", "让 AI 读稿，让规则做判断，让代码完成重复劳动。", 108, 370, 720, 42, 21, C.muted);
    rule(s, "cover-rule", 108, 455, 530, C.line, 2); linePaths.push({ slide: 1, name: "cover-rule", from: [108,455], to: [638,455], relation: "分隔线", note: "页内标题与说明分组" });
    textbox(s, "cover-note", "稳定可用 · 原生可编辑 · 符合组织规范", 108, 485, 640, 32, 18, C.primary, true);
    textbox(s, "cover-page", "01 / 11", 1080, 650, 120, 22, 12, C.muted, false, "right");
    addNotes(s, "本页为产品叙事封面。无外部来源。");
  }

  // 2 cost is judgement
  {
    const n = 2; const s = p.slides.add(); s.background.fill = C.bg; heading(s, n, "昂贵的部分不是画，而是连续判断");
    textbox(s, "s2-lead", "认真完成一套答辩、汇报或讲课用的演示，时间主要花在反复判断上。", 55, 150, 1120, 34, 20, C.ink);
    const labels = [
      ["拆页", "一篇长稿应该拆成多少页"],
      ["定责", "每一页只承担什么职责"],
      ["理关系", "观点是并列、递进、因果还是流程"],
      ["定焦点", "哪里应该突出，何时用图或一句话"],
      ["再统一", "替换结构后统一字体、颜色与间距"]
    ];
    labels.forEach((d, i) => {
      const x = 55 + i * 232;
      rect(s, `s2-box-${i}`, x, 250, 205, 150, i === 2 ? C.light : C.pale, i === 2 ? C.primary : C.line);
      textbox(s, `s2-h-${i}`, d[0], x + 18, 270, 169, 30, 21, i === 2 ? C.primary : C.ink, true);
      textbox(s, `s2-b-${i}`, d[1], x + 18, 315, 169, 62, 17, C.ink);
    });
    textbox(s, "s2-tail", "一个 PPT 做得很好的人，脑子里已经积累了大量答案。PPagenT 从这里发问：为什么每次还要重新做一遍？", 55, 470, 1120, 72, 22, C.dark, true);
    footer(s, n);
  }

  // 3 target demand and R
  {
    const n = 3; const s = p.slides.add(); s.background.fill = C.bg; heading(s, n, "工作型 PPT 位于需求分布的中间，也是最适合标准化的场景");
    textbox(s, "s3-intro", "需求两端都真实存在，但更多需求来自需要快速交付、结构清楚、视觉体面且符合组织规范的日常工作。", 55, 148, 1135, 48, 19, C.ink);
    rect(s, "s3-left", 55, 230, 335, 178, C.pale, C.line);
    textbox(s, "s3-left-h", "只要把文字放上去", 78, 255, 285, 30, 21, C.ink, true);
    textbox(s, "s3-left-b", "几乎不在意版式\n需求存在，但不是 PPagenT 的首要切入点。", 78, 302, 270, 75, 17, C.muted);
    rect(s, "s3-mid", 420, 214, 440, 210, C.light, C.primary);
    textbox(s, "s3-mid-h", "概率密度最大的工作型 PPT", 448, 242, 385, 33, 22, C.primary, true);
    textbox(s, "s3-mid-b", "学校 · 科研院所 · 事业单位\n央国企 · 普通企业\n\n底线：不能乱、不能丑、不能掉价、生成后仍可修改。", 448, 290, 385, 105, 18, C.ink);
    rect(s, "s3-right", 890, 230, 335, 178, C.pale, C.line);
    textbox(s, "s3-right-h", "高度定制的视觉创意", 913, 255, 285, 30, 21, C.ink, true);
    textbox(s, "s3-right-b", "发布会、品牌路演、高水平比赛\n需求真实，但标准化难度更高。", 913, 302, 270, 75, 17, C.muted);
    textbox(s, "s3-formula-label", "产品可靠度（概念定义）", 55, 480, 300, 28, 18, C.primary, true);
    textbox(s, "s3-formula", "R = P(Q ≥ Q可用 | 目标工作场景)", 55, 515, 690, 58, 36, C.dark, true);
    textbox(s, "s3-formula-note", "R 关注的是：随机工作稿达到“可以直接拿去讲”的最低标准的概率，而不是一次生成的最高分。", 760, 505, 445, 68, 18, C.ink);
    footer(s, n);
  }

  // 4 80/95
  {
    const n = 4; const s = p.slides.add(); s.background.fill = C.bg; heading(s, n, "稳定跨过可用线，比偶然惊艳更重要");
    textbox(s, "s4-lead", "明天上午九点要汇报，今晚交稿；第二天仍要能继续修改。工作需要的是确定的交付。", 55, 150, 1120, 42, 20, C.ink);
    rect(s, "s4-80", 55, 245, 520, 260, C.light, C.primary);
    textbox(s, "s4-80-num", "80", 82, 270, 165, 90, 64, C.primary, true);
    textbox(s, "s4-80-h", "稳定可用状态", 265, 282, 270, 40, 25, C.primary, true);
    textbox(s, "s4-80-b", "直接使用不失专业\n继续修改有可靠基础\n投入与收益相匹配", 85, 385, 420, 92, 20, C.ink);
    rect(s, "s4-95", 650, 245, 575, 260, C.pale, C.line);
    textbox(s, "s4-95-num", "95", 680, 270, 165, 90, 64, C.muted, true);
    textbox(s, "s4-95-h", "随机惊艳作品", 865, 282, 300, 40, 25, C.ink, true);
    textbox(s, "s4-95-b", "偶尔让所有人惊叹\n从可用到高度定制，成本可能迅速上升\n许多内部汇报不需要为增量付出同等代价", 680, 385, 490, 92, 20, C.ink);
    textbox(s, "s4-tail", "PPagenT 最大化的是：一份随机工作稿被可靠转化为可直接使用 PPT 的概率。", 55, 558, 1135, 38, 22, C.dark, true);
    footer(s, n);
  }

  // 5 constrain
  {
    const n = 5; const s = p.slides.add(); s.background.fill = C.bg; heading(s, n, "限制一部分自由，换取正式工作的可预测性");
    textbox(s, "s5-lead", "自由度越高，理论上限越高；状态空间也越大，失败模式随之增加。正式工作不需要每次都重来。", 55, 148, 1140, 42, 19, C.ink);
    rect(s, "s5-left", 55, 230, 515, 300, C.pale, C.line);
    textbox(s, "s5-left-h", "稳定的组织表达", 82, 258, 450, 32, 22, C.primary, true);
    textbox(s, "s5-left-b", "学校有学校的样子，企业有企业的样子。\n\n颜色、字体、Logo、页眉页脚和已证明好用的页面结构，本来就应该保持稳定。", 82, 315, 440, 130, 19, C.ink);
    textbox(s, "s5-left-q", "每次都不一样，有时候才是缺点。", 82, 468, 430, 30, 18, C.dark, true);
    rect(s, "s5-right", 620, 230, 605, 300, C.light, C.primary);
    textbox(s, "s5-right-h", "主动登记的约束", 650, 258, 520, 32, 22, C.primary, true);
    textbox(s, "s5-right-b", "确定的组织视觉规范\n经过验证的表达能力\n明确的数量与容量边界\n已经登记的退化方式", 650, 320, 510, 150, 21, C.ink);
    textbox(s, "s5-tail", "这可能降低一次生成的理论峰值，却大幅减少结果落到不可用区间的机会。固定，往往意味着已经验证过。", 55, 575, 1140, 46, 20, C.dark, true);
    footer(s, n);
  }

  // 6 two directors and deterministic chain
  {
    const n = 6; const s = p.slides.add(); s.background.fill = C.bg; heading(s, n, "两位导演把 AI 放在控制器位置");
    textbox(s, "s6-lead", "AI 不直接自由绘制整份 PPT；它理解稿件、组织叙事，再从已确认能力中选择合法表达。", 55, 148, 1140, 38, 19, C.ink);
    const content = rect(s, "content-director", 55, 230, 520, 145, C.pale, C.line);
    textbox(s, "s6-c-h", "内容导演", 67, 252, 496, 32, 22, C.primary, true, "center");
    textbox(s, "s6-c-b", "理解稿件 · 组织叙事 · 拆页\n形成每页承担的页面内容", 67, 300, 496, 52, 19, C.ink, false, "center");
    const visual = rect(s, "visual-director", 650, 230, 575, 145, C.light, C.primary);
    textbox(s, "s6-v-h", "视觉导演", 662, 252, 551, 32, 22, C.primary, true, "center");
    textbox(s, "s6-v-b", "判断每页适合怎样表达\n从已经确认的能力中选择合适结构", 662, 300, 551, 52, 19, C.ink, false, "center");
    const ai = rect(s, "ai-understands", 55, 475, 245, 92, C.dark, C.dark);
    const rules = rect(s, "rules-constrain", 355, 475, 245, 92, C.pale, C.line);
    const code = rect(s, "code-stable", 655, 475, 245, 92, C.pale, C.line);
    const pptx = rect(s, "native-pptx", 955, 475, 270, 92, C.light, C.primary);
    textbox(s, "s6-ai", "AI\n理解与路由", 67, 492, 221, 58, 21, C.white, true, "center");
    textbox(s, "s6-rules", "规则\n约束与选择", 367, 492, 221, 58, 21, C.ink, true, "center");
    textbox(s, "s6-code", "代码\n稳定生成", 667, 492, 221, 58, 21, C.ink, true, "center");
    textbox(s, "s6-pptx", "原生可编辑\nPowerPoint", 967, 492, 246, 58, 21, C.primary, true, "center");
    arrow(s, ai, rules, "AI 负责理解和路由；规则负责约束和选择。", connections);
    arrow(s, rules, code, "规则作出合法选择后，由确定性代码完成重复绘制。", connections);
    arrow(s, code, pptx, "程序把决策编译成原生可编辑 PowerPoint。", connections);
    footer(s, n);
  }

  // 7 architecture
  {
    const n = 7; const s = p.slides.add(); s.background.fill = C.bg; heading(s, n, "核心资产库是建设线与正式生成线的唯一交汇点");
    textbox(s, "s7-lead", "只有用户明确确认的能力才能进入正式生成线；交付现场只读核心库。", 55, 145, 1140, 36, 19, C.ink);
    textbox(s, "s7-build-label", "资产入库线 / 把经验变成能力", 55, 208, 430, 28, 18, C.primary, true);
    const ref = rect(s, "excellent-reference", 55, 270, 190, 82, C.pale, C.line);
    const rules = rect(s, "design-rules", 285, 270, 190, 82, C.pale, C.line);
    const ability = rect(s, "reusable-ability", 515, 270, 190, 82, C.pale, C.line);
    const confirm = rect(s, "user-confirm", 745, 270, 190, 82, C.light, C.primary);
    const core = rect(s, "core-asset-library", 975, 270, 250, 82, C.dark, C.dark);
    textbox(s, "s7-ref", "优秀参考", 67, 289, 166, 40, 19, C.ink, true, "center");
    textbox(s, "s7-rules", "提炼规律", 297, 289, 166, 40, 19, C.ink, true, "center");
    textbox(s, "s7-ability", "可复用能力", 527, 289, 166, 40, 19, C.ink, true, "center");
    textbox(s, "s7-confirm", "用户确认", 757, 289, 166, 40, 19, C.primary, true, "center");
    textbox(s, "s7-core", "核心资产库", 987, 289, 226, 40, 21, C.white, true, "center");
    arrow(s, ref, rules, "资产入库线：筛选优秀页面并提炼逻辑与设计规律。", connections);
    arrow(s, rules, ability, "将规律扩展为可复用能力。", connections);
    arrow(s, ability, confirm, "只有经过用户确认的能力可进入正式资产库。", connections);
    arrow(s, confirm, core, "确认通过后进入核心资产库。", connections);
    textbox(s, "s7-run-label", "正式生成线 / 只读调用能力", 55, 407, 430, 28, 18, C.primary, true);
    const raw = rect(s, "raw-manuscript", 55, 465, 215, 82, C.pale, C.line);
    const organize = rect(s, "ai-orchestration", 315, 465, 215, 82, C.pale, C.line);
    const select = rect(s, "select-legal-ability", 575, 465, 215, 82, C.light, C.primary);
    const compile = rect(s, "deterministic-compile", 835, 465, 215, 82, C.pale, C.line);
    const out = rect(s, "editable-output", 1095, 465, 130, 82, C.dark, C.dark);
    textbox(s, "s7-raw", "原始稿件 +\n组织主题", 67, 484, 191, 45, 18, C.ink, true, "center");
    textbox(s, "s7-organize", "AI 理解与\n编排", 327, 484, 191, 45, 18, C.ink, true, "center");
    textbox(s, "s7-select", "选择合法\n能力", 587, 484, 191, 45, 18, C.primary, true, "center");
    textbox(s, "s7-compile", "确定性排版\n与编译", 847, 484, 191, 45, 18, C.ink, true, "center");
    textbox(s, "s7-out", "原生\nPPTX", 1107, 484, 106, 45, 18, C.white, true, "center");
    arrow(s, raw, organize, "正式生成线从原始稿件与组织主题开始。", connections);
    arrow(s, organize, select, "AI 负责理解与编排，再从核心库选择合法能力。", connections);
    arrow(s, select, compile, "确定性排版与编译完成稳定生成。", connections);
    arrow(s, compile, out, "交付原生可编辑 PPTX。", connections);
    // bridge is a real relation but kept as a separate short connector in its own channel
    slideBridge(s, core, select, connections);
    textbox(s, "s7-fallback", "没有合适结构 → 已登记的简单文字排版 / 拆页；缺口只向用户说明，由用户决定是否另行入库。", 55, 584, 1140, 34, 17, C.muted);
    footer(s, n);
  }

  // 8 cost moved forward
  {
    const n = 8; const s = p.slides.add(); s.background.fill = C.bg; heading(s, n, "把昂贵的视觉理解前移，运行期只支付必要成本");
    textbox(s, "s8-lead", "视觉理解没有消失：它从每次交付都要重新支付的在线成本，变成一次建设、多次复用的离线资产。", 55, 145, 1140, 42, 19, C.ink);
    rect(s, "s8-build", 55, 230, 530, 320, C.light, C.primary);
    textbox(s, "s8-build-h", "建设期 / 一次投入", 85, 258, 440, 34, 22, C.primary, true);
    textbox(s, "s8-build-b", "筛选优秀页面\n理解为何有效\n内容、图片、数量参数化\n验证不同状态\n用户确认进入正式资产库", 85, 320, 430, 170, 20, C.ink);
    textbox(s, "s8-build-cost", "视觉模型可用于资产理解与审查。", 85, 505, 430, 26, 16, C.muted);
    rect(s, "s8-run", 640, 230, 585, 320, C.pale, C.line);
    textbox(s, "s8-run-h", "正式生成期 / 反复复用", 670, 258, 500, 34, 22, C.ink, true);
    textbox(s, "s8-run-b", "模型：理解、分类、路由、填参\n代码：确定性绘制与检查\n\n不要求视觉大模型重新设计每一页。\n低成本纯文字模型承担有限任务，稳定性在真实任务中持续校准。", 670, 320, 500, 170, 20, C.ink);
    textbox(s, "s8-run-cost", "视觉模型不成为每次交付的必要成本。", 670, 505, 500, 26, 16, C.muted);
    textbox(s, "s8-tail", "目标：把一次性手工业变成可以重复运行的标准化生产过程。", 55, 590, 1140, 34, 22, C.dark, true);
    footer(s, n);
  }

  // 9 capability moat
  {
    const n = 9; const s = p.slides.add(); s.background.fill = C.bg; heading(s, n, "真正积累的是表达能力的边界，不是一万个模板");
    textbox(s, "s9-lead", "原页面有三个观点，新稿件可能有四个；原页面每项十个字，新内容可能每项六十个字。静态模板无法穷尽变化。", 55, 145, 1140, 42, 18, C.ink);
    rect(s, "s9-left", 55, 230, 450, 320, C.pale, C.line);
    textbox(s, "s9-left-h", "能力要回答", 82, 258, 380, 34, 22, C.primary, true);
    textbox(s, "s9-left-b", "什么内容适合怎样表达？\n一个版式能处理多少内容？\n数量变化时怎样重新排布？\n超过边界：换样式、拆页，还是退化？\n哪些结构即使能画，也不应该使用？", 82, 320, 380, 185, 19, C.ink);
    rect(s, "s9-right", 555, 230, 670, 320, C.light, C.primary);
    textbox(s, "s9-right-h", "经过验证的表达能力包，形成真正壁垒", 585, 258, 600, 32, 22, C.primary, true);
    textbox(s, "s9-right-b", "积累多少真正有效的表达能力\n能否可靠路由到正确能力\n是否知道每种能力的容量、变化方式和失败边界\n能否稳定生成符合组织规范、原生可编辑的结果", 585, 325, 580, 155, 20, C.ink);
    textbox(s, "s9-tail", "模型会继续变强、变便宜；真实任务验证过的表达经验不会自动出现。", 55, 590, 1140, 34, 21, C.dark, true);
    footer(s, n);
  }

  // 10 scale organizations
  {
    const n = 10; const s = p.slides.add(); s.background.fill = C.bg; heading(s, n, "从东北大学开始，能力可以扩展到更多组织");
    rect(s, "s10-origin", 55, 180, 315, 270, C.light, C.primary);
    textbox(s, "s10-origin-h", "东北大学\n首个正式落地场景", 84, 215, 255, 70, 27, C.primary, true);
    textbox(s, "s10-origin-b", "明确的视觉规范\n持续发生的汇报需求\n真实可检验的使用边界", 84, 330, 255, 88, 19, C.ink);
    rect(s, "s10-theme", 430, 180, 330, 270, C.pale, C.line);
    textbox(s, "s10-theme-h", "主题配置可替换", 460, 215, 270, 34, 22, C.ink, true);
    textbox(s, "s10-theme-b", "学校或组织的\n颜色 · Logo · 字体\n页眉页脚", 460, 290, 270, 100, 21, C.ink);
    rect(s, "s10-reuse", 820, 180, 405, 270, C.pale, C.line);
    textbox(s, "s10-reuse-h", "能力继续复用", 850, 215, 330, 34, 22, C.primary, true);
    textbox(s, "s10-reuse-b", "学校 · 科研院所 · 实验室\n企业 · 团队 · 个人长期风格\n\n让更多人低成本获得生产能力。", 850, 290, 330, 120, 20, C.ink);
    // simple relation line, no arrow: origin to configuration to reuse
    rule(s, "s10-line-1", 370, 315, 60, C.primary, 2); linePaths.push({ slide: 10, name: "s10-line-1", from: [370,315], to: [430,315], relation: "迁移关系", note: "首个场景到主题配置" });
    rule(s, "s10-line-2", 760, 315, 60, C.primary, 2); linePaths.push({ slide: 10, name: "s10-line-2", from: [760,315], to: [820,315], relation: "迁移关系", note: "主题配置到能力复用" });
    textbox(s, "s10-tail", "它不只是模板工具：组织不必要求每名成员都成为设计师，也能让日常输出稳定达到基本标准。", 55, 535, 1140, 46, 21, C.dark, true);
    footer(s, n);
  }

  // 11 close
  {
    const n = 11; const s = p.slides.add(); s.background.fill = C.bg; heading(s, n, "最终价值很普通：靠谱、好用，而且真的能继续修改");
    textbox(s, "s11-lead", "做一套好 PPT 太费时间了，其中很多时间花在以前已经有人解决过的问题上。", 55, 150, 1120, 40, 21, C.ink);
    textbox(s, "s11-steps", "AI 帮我们读稿子\n规则帮我们做判断\n代码完成重复劳动", 55, 255, 380, 160, 25, C.primary, true);
    s.shapes.add({ geometry: "line", name: "s11-rule", position: { left: 485, top: 240, width: 1, height: 190 }, fill: "none", line: { style: "solid", fill: C.line, width: 1 } }); linePaths.push({ slide: 11, name: "s11-rule", from: [485,240], to: [486,430], relation: "分隔线", note: "机制与结果分组" });
    rect(s, "s11-result", 560, 230, 665, 245, C.light, C.primary);
    textbox(s, "s11-result-h", "一个原本不太会做 PPT 的人，也能很快得到一套", 595, 265, 590, 38, 21, C.ink, true);
    textbox(s, "s11-result-b", "不一定惊艳，但靠谱；\n不一定独一无二，但真的好用；\n可以立刻拿去讲，也可以继续修改。", 595, 330, 590, 110, 25, C.primary, true);
    textbox(s, "s11-tail", "如果能持续做到这一点，普通问题就能成为可靠的产品能力，也有机会形成一门真正的生意。", 55, 565, 1140, 42, 22, C.dark, true);
    footer(s, n, "PPagenT / 可靠的生产过程");
  }

  // Add speaker notes only for provenance; all claims are from supplied product.txt.
  for (const slide of p.slides.items) addNotes(slide, "[Sources]\n- inputs/product.txt（本次任务唯一原稿）\n[/Sources]");

  const s6Names = new Set(["ai-understands", "rules-constrain", "code-stable", "native-pptx"]);
  for (const c of connections) c.slide = s6Names.has(c.source) ? 6 : 7;
  await fs.writeFile(`${OUT}/connections.json`, JSON.stringify({ connections }, null, 2));
  await fs.writeFile(`${OUT}/line-paths.json`, JSON.stringify({ linePaths }, null, 2));

  for (const [i, slide] of p.slides.items.entries()) {
    const stem = `slide-${i + 1}`;
    await fs.writeFile(`${OUT}/${stem}.layout.json`, await (await slide.export({ format: "layout" })).text());
  }
  const pptx = await PresentationFile.exportPptx(p);
  await pptx.save(`${OUT}/deck.pptx`);
}

function slideBridge(slide, source, target, connections) {
  slide.shapes.connect(source, target, { kind: "straight", fromSide: "bottom", toSide: "top", line: { fill: C.primary, width: 2 }, tail: { type: "arrow", width: "sm", length: "sm" } });
  connections.push({ source: source.name, target: target.name, arrowAt: "target", evidence: "正式生成线只读调用用户确认后进入核心资产库的能力。", geometry: "straight bottom-to-top" });
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
