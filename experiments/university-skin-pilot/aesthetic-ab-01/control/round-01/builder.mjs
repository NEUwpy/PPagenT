import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const RUN = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(RUN, "../../../../../..");
const INPUTS = path.resolve(RUN, "../../inputs");
const W = 1280;
const H = 720;
const theme = JSON.parse(await fs.readFile(path.join(INPUTS, "theme.json"), "utf8"));
const C = {
  primary: theme.primaryColor,
  primaryDark: "#26496F",
  pale: "#F4F7FA",
  light: "#E5ECF4",
  mid: "#AFC1D4",
  ink: theme.neutral.ink,
  muted: theme.neutral.muted,
  white: theme.neutral.background,
};

function pos(left, top, width, height) { return { left, top, width, height }; }
function addShape(slide, name, geometry, position, fill, line = { style: "solid", fill: "none", width: 0 }) {
  return slide.shapes.add({ geometry, name, position, fill, line });
}
function addText(slide, name, text, position, style = {}) {
  const shape = addShape(slide, name, "textbox", position, "none");
  shape.text = text;
  shape.text.style = {
    fontFamily: theme.font,
    fontSize: style.fontSize ?? 18,
    color: style.color ?? C.ink,
    bold: style.bold ?? false,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "middle",
    italic: style.italic ?? false,
  };
  return shape;
}
function rule(slide, name, x1, y1, x2, y2, color = C.primary, width = 3) {
  const x = Math.min(x1, x2), y = Math.min(y1, y2);
  const w = Math.max(1, Math.abs(x2 - x1)), h = Math.max(1, Math.abs(y2 - y1));
  const r = addShape(slide, name, "rect", pos(x, y, w || width, h || width), color);
  linePaths.push({ slide: slidesBuilt, id: name, from: [x1, y1], to: [x2, y2], relation: "separator", decorative: false });
  return r;
}
function box(slide, name, x, y, w, h, fill = C.pale, stroke = C.light, radius = false) {
  return addShape(slide, name, radius ? "roundRect" : "rect", pos(x, y, w, h), fill, { style: "solid", fill: stroke, width: 1 });
}
function label(slide, name, text, x, y, w, h, size = 18, color = C.ink, bold = false, align = "left") {
  return addText(slide, name, text, pos(x, y, w, h), { fontSize: size, color, bold, alignment: align });
}
function title(slide, n, text, sub = "") {
  label(slide, "slide-title", text, 55, 36, 1170, 48, 32, C.ink, true);
  rule(slide, "title-rule", 55, 101, 1225, 101, C.primary, 3);
  if (sub) label(slide, "title-sub", sub, 55, 108, 1170, 26, 16, C.muted, false);
  label(slide, "page-number", String(n).padStart(2, "0"), 1175, 681, 50, 20, 14, C.muted, true, "right");
  label(slide, "source-footer", "来源：PPagenT 产品叙事（分配原稿）", 55, 681, 500, 20, 14, C.muted);
  slide.speakerNotes.textFrame.setText("[Sources]\n本页内容来自 experiments/university-skin-pilot/aesthetic-ab-01/inputs/product.txt；主题来自 inputs/theme.json。");
}
function arrow(slide, source, target, fromSide = "right", toSide = "left", dashed = false) {
  const c = slide.shapes.connect(source, target, {
    kind: "straight",
    fromSide,
    toSide,
    line: { style: dashed ? "dashed" : "solid", fill: C.primary, width: 2 },
    tail: { type: "arrow", width: "sm", length: "sm" },
  });
  connections.push({ slide: slidesBuilt, source: source.name, target: target.name, arrowAt: "target", kind: "straight", evidence: "原稿明确描述的关系" });
  return c;
}

const presentation = Presentation.create({ slideSize: { width: W, height: H } });
const connections = [];
const linePaths = [];
let slidesBuilt = 0;

// 1 — cover
{
  const s = presentation.slides.add(); s.background.fill = C.primary; slidesBuilt++;
  addShape(s, "cover-band", "rect", pos(0, 0, 18, H), C.primaryDark);
  label(s, "cover-kicker", "PPagenT / 产品叙事", 72, 82, 400, 30, 18, "#DCE8F3", true);
  label(s, "cover-title", "把 PPT 生成\n变成可靠的生产过程", 72, 145, 620, 170, 46, C.white, true);
  label(s, "cover-sub", "让 AI 读懂稿子，让规则做判断，让代码完成重复劳动。", 75, 350, 580, 64, 22, "#E5EEF7");
  const a = box(s, "cover-a", 785, 170, 330, 88, "#4774A3", "#4774A3", true);
  label(s, "cover-a-label", "一次生成", 805, 184, 290, 28, 20, C.white, true, "center");
  label(s, "cover-a-copy", "偶然惊艳", 805, 218, 290, 25, 18, "#E5EEF7", false, "center");
  const b = box(s, "cover-b", 785, 300, 330, 118, C.white, C.white, true);
  label(s, "cover-b-label", "稳定交付", 805, 330, 290, 30, 24, C.primaryDark, true, "center");
  label(s, "cover-b-copy", "可直接讲 · 可继续改", 805, 366, 290, 25, 18, C.primary, false, "center");
  rule(s, "cover-rule", 785, 461, 1115, 461, "#AFC1D4", 2);
  label(s, "cover-foot", "工作型 PPT 的可靠度命题", 785, 478, 330, 28, 16, "#E5EEF7", false, "center");
}

// 2 — pain
{
  const s = presentation.slides.add(); s.background.fill = C.white; slidesBuilt++; title(s, 2, "真正昂贵的，是一连串判断", "拖动文本框只是表面，决定一套稿子能不能讲的是结构与取舍。");
  label(s, "pain-lead", "一套答辩、汇报或讲课用 PPT，最费时间的部分始终重复发生。", 55, 160, 520, 70, 24, C.primaryDark, true);
  label(s, "pain-copy", "怎么讲\n长稿拆成多少页\n每页承担什么职责\n观点是并列、递进、因果还是流程\n哪里该突出，什么时候一句话更有力量", 58, 258, 430, 210, 20, C.ink);
  const steps = [
    ["01", "理解汇报目的", "先确定这场汇报到底要让人明白什么"],
    ["02", "拆出页面职责", "让每一页只承担一个清楚的任务"],
    ["03", "选择表达关系", "并列、递进、因果、流程不能混用"],
    ["04", "反复统一细节", "字体、颜色、间距和既有页面都要回看"],
  ];
  steps.forEach((it, i) => {
    const y = 168 + i * 112;
    label(s, `pain-num-${i}`, it[0], 650, y, 48, 32, 18, C.primary, true);
    rule(s, `pain-line-${i}`, 706, y + 16, 756, y + 16, C.primary, 3);
    label(s, `pain-head-${i}`, it[1], 778, y - 3, 330, 30, 22, C.ink, true);
    label(s, `pain-desc-${i}`, it[2], 778, y + 32, 370, 40, 18, C.muted);
  });
}

// 3 — market
{
  const s = presentation.slides.add(); s.background.fill = C.white; slidesBuilt++; title(s, 3, "PPagenT 选择概率密度最大的工作型 PPT", "目标不是覆盖所有需求，而是在重复发生的场景里稳定过线。");
  label(s, "market-lead", "更多需求位于中间：\n要快、清楚、体面、符合规范，\n还要能继续修改。", 55, 175, 430, 150, 26, C.primaryDark, true);
  label(s, "market-detail", "发布会与高水平比赛需要高度定制；\n纯粹“把文字放上去”又几乎不在意版式。\nPPagenT 先服务学校、科研院所、事业单位、\n央国企和普通企业的工作型 PPT。", 58, 370, 430, 150, 20, C.ink);
  box(s, "market-spectrum", 630, 185, 520, 240, C.pale, C.light);
  label(s, "market-left", "高度定制\n视觉创意", 650, 260, 120, 60, 18, C.muted, true, "center");
  label(s, "market-right", "只要有字\n即可", 1010, 260, 120, 60, 18, C.muted, true, "center");
  const mid = box(s, "market-middle", 815, 220, 160, 170, C.primary, C.primary, true);
  label(s, "market-middle-title", "工作型\nPPT", 835, 250, 120, 54, 28, C.white, true, "center");
  label(s, "market-middle-copy", "清楚 · 体面\n可修改", 835, 320, 120, 40, 18, "#E5EEF7", false, "center");
  rule(s, "market-axis", 760, 445, 1045, 445, C.mid, 2);
  label(s, "market-axis-label", "需求分布（概念示意，不是测量）", 760, 458, 290, 26, 16, C.muted, false, "center");
  label(s, "market-r", "R = P(Q ≥ Q可用 | 目标工作场景)", 635, 545, 515, 46, 24, C.primaryDark, true, "center");
}

// 4 — 80/95
{
  const s = presentation.slides.add(); s.background.fill = C.white; slidesBuilt++; title(s, 4, "产品价值在于稳定跨过可用线", "“80 分”和“95 分”是形象比喻，不是测量结果。");
  label(s, "score-lead", "对工作来说，\n稳定的 80 分，\n很多时候比随机的 95 分更值钱。", 55, 175, 415, 170, 30, C.primaryDark, true);
  label(s, "score-body", "明天上午九点要汇报时，真正需要的是：\n逻辑清楚、版式规范、符合单位风格，\n第二天仍然可以继续修改。", 58, 390, 420, 120, 20, C.ink);
  rule(s, "score-axis", 610, 470, 1135, 470, C.mid, 4);
  label(s, "score-axis-left", "不可用", 585, 492, 90, 26, 16, C.muted, false, "center");
  const use = box(s, "score-80", 760, 414, 145, 56, C.primary, C.primary, true);
  label(s, "score-80-text", "80 分", 770, 422, 125, 38, 30, C.white, true, "center");
  label(s, "score-80-note", "稳定可用", 760, 486, 145, 26, 18, C.primaryDark, true, "center");
  const peak = box(s, "score-95", 1005, 327, 145, 143, C.pale, C.primary, true);
  label(s, "score-95-text", "95 分", 1015, 344, 125, 46, 30, C.primaryDark, true, "center");
  label(s, "score-95-note", "偶然惊艳\n成本可能迅速上升", 1015, 397, 125, 55, 16, C.muted, false, "center");
  label(s, "score-target", "Q可用", 1090, 505, 90, 26, 16, C.primaryDark, true, "center");
  label(s, "score-foot", "PPagenT 最大化的是随机工作稿被可靠转化为可直接使用 PPT 的概率。", 610, 585, 540, 32, 18, C.ink, true, "center");
}

// 5 — constraints
{
  const s = presentation.slides.add(); s.background.fill = C.white; slidesBuilt++; title(s, 5, "限制一部分自由，换取可预测", "正式工作更需要已经验证过的边界，而不是每次都从零决定。");
  label(s, "constraint-lead", "自由度越高，理论上限越高；\n状态空间越大，失败模式也越多。", 55, 175, 470, 95, 27, C.primaryDark, true);
  label(s, "constraint-body", "学校、企业和团队都有长期形成的表达方式。\n颜色、字体、Logo、页眉页脚与好用结构\n本来就应该保持稳定。", 58, 315, 455, 115, 20, C.ink);
  label(s, "constraint-quote", "每次都不一样，有时候才是缺点。", 58, 525, 450, 40, 22, C.primary, true);
  const items = [
    ["组织视觉规范", "固定颜色、字体、Logo 与页面骨架"],
    ["经验证的表达能力", "只调用已经确认的并列、顺序、对比与层级"],
    ["明确的失败边界", "超出容量时换样式、拆页或退回简单排版"],
  ];
  items.forEach((it, i) => {
    const y = 175 + i * 126;
    box(s, `constraint-${i}`, 650, y, 500, 92, i === 1 ? C.primary : C.pale, i === 1 ? C.primary : C.light);
    label(s, `constraint-head-${i}`, it[0], 676, y + 16, 450, 28, 22, i === 1 ? C.white : C.ink, true, "center");
    label(s, `constraint-desc-${i}`, it[1], 676, y + 48, 450, 25, 18, i === 1 ? "#E5EEF7" : C.muted, false, "center");
  });
}

// 6 — controller / two directors
{
  const s = presentation.slides.add(); s.background.fill = C.white; slidesBuilt++; title(s, 6, "AI 负责理解和路由，规则负责约束，代码负责生成", "两个导演做判断，确定性能力把判断落实成可编辑对象。");
  const content = box(s, "content-director", 75, 210, 235, 125, C.pale, C.light, true);
  label(s, "content-director-title", "内容导演", 95, 228, 195, 30, 24, C.primaryDark, true, "center");
  label(s, "content-director-copy", "理解稿件\n组织叙事 · 拆页", 95, 270, 195, 48, 18, C.ink, false, "center");
  const visual = box(s, "visual-director", 75, 375, 235, 125, C.pale, C.light, true);
  label(s, "visual-director-title", "视觉导演", 95, 393, 195, 30, 24, C.primaryDark, true, "center");
  label(s, "visual-director-copy", "判断怎样表达\n选择合适结构", 95, 435, 195, 48, 18, C.ink, false, "center");
  const ai = box(s, "ai-route", 425, 260, 245, 190, C.primary, C.primary, true);
  label(s, "ai-route-title", "AI 控制器", 450, 292, 195, 32, 26, C.white, true, "center");
  label(s, "ai-route-copy", "理解 · 组织\n分类 · 路由 · 填参", 450, 346, 195, 70, 21, "#E5EEF7", false, "center");
  const rules = box(s, "rules", 785, 190, 225, 105, C.pale, C.light, true);
  label(s, "rules-title", "规则", 805, 210, 185, 28, 23, C.primaryDark, true, "center");
  label(s, "rules-copy", "约束与选择", 805, 248, 185, 25, 18, C.ink, false, "center");
  const code = box(s, "code", 785, 390, 225, 105, C.primaryDark, C.primaryDark, true);
  label(s, "code-title", "代码", 805, 410, 185, 28, 23, C.white, true, "center");
  label(s, "code-copy", "稳定生成 PPTX", 805, 448, 185, 25, 18, "#E5EEF7", false, "center");
  const out = box(s, "native-output", 1055, 278, 165, 150, C.pale, C.light);
  label(s, "native-output-title", "原生\n可编辑", 1072, 302, 130, 58, 25, C.primaryDark, true, "center");
  label(s, "native-output-copy", "PowerPoint", 1072, 378, 130, 24, 18, C.muted, false, "center");
  arrow(s, content, ai, "right", "left"); arrow(s, visual, ai, "right", "left");
  arrow(s, ai, rules, "right", "left"); arrow(s, ai, code, "right", "left");
  arrow(s, rules, out, "right", "left"); arrow(s, code, out, "right", "left");
  label(s, "controller-foot", "AI 不直接自由绘制整份 PPT；它调用人已经提前做好的好东西。", 350, 555, 720, 34, 20, C.ink, true, "center");
}

// 7 — architecture lanes
{
  const s = presentation.slides.add(); s.background.fill = C.white; slidesBuilt++; title(s, 7, "建设能力与稳定调用，唯一交汇点是核心资产库", "入库线负责把经验变成能力，正式生成线负责把能力稳定地用出来。");
  label(s, "lane-build", "资产入库线", 55, 165, 170, 30, 22, C.primaryDark, true);
  label(s, "lane-run", "正式生成线", 55, 415, 170, 30, 22, C.primaryDark, true);
  const top = ["优秀参考", "提炼逻辑与\n设计规律", "扩展为\n可复用能力", "用户确认", "核心资产库"];
  const bot = ["原始稿件\n+ 组织主题", "AI 理解与\n编排", "选择合法\n能力", "确定性排版\n与编译", "原生可编辑\nPPTX"];
  const xs = [230, 420, 610, 800, 990];
  const topNodes = top.map((t, i) => { const b = box(s, `build-${i}`, xs[i], 150, 150, 100, i === 4 ? C.primary : C.pale, i === 4 ? C.primary : C.light, true); label(s, `build-${i}-label`, t, xs[i] + 12, 172, 126, 56, i === 4 ? 21 : 19, i === 4 ? C.white : C.ink, true, "center"); return b; });
  const botNodes = bot.map((t, i) => { const b = box(s, `run-${i}`, xs[i], 400, 150, 100, i === 2 ? C.primary : C.pale, i === 2 ? C.primary : C.light, true); label(s, `run-${i}-label`, t, xs[i] + 12, 422, 126, 56, i === 2 ? 21 : 19, i === 2 ? C.white : C.ink, true, "center"); return b; });
  for (let i = 0; i < 4; i++) arrow(s, topNodes[i], topNodes[i + 1]);
  for (let i = 0; i < 4; i++) arrow(s, botNodes[i], botNodes[i + 1]);
  const bridge = slideBridge(s, topNodes[4], botNodes[2]);
  label(s, "bridge-label", "只读调用", 1080, 300, 120, 26, 16, C.primaryDark, true, "center");
  const fallback = box(s, "fallback", 610, 565, 340, 58, C.pale, C.light, true);
  label(s, "fallback-label", "没有合适结构 → 简单排版 / 拆页", 630, 578, 300, 28, 18, C.ink, true, "center");
  arrow(s, botNodes[2], fallback, "bottom", "top", true);
  function slideBridge(slide, source, target) {
    const c = slide.shapes.connect(source, target, { kind: "straight", fromSide: "bottom", toSide: "top", line: { style: "dashed", fill: C.primary, width: 2 }, tail: { type: "arrow", width: "sm", length: "sm" } });
    connections.push({ slide: slidesBuilt, source: source.name, target: target.name, arrowAt: "target", kind: "straight", evidence: "核心资产库向正式生成线提供只读调用" });
    return c;
  }
}

// 8 — cost shift
{
  const s = presentation.slides.add(); s.background.fill = C.white; slidesBuilt++; title(s, 8, "把昂贵的视觉理解前移，运行期只做路由与填参", "一次建设、多次复用，把不确定的在线成本变成可复用的离线资产。");
  label(s, "build-head", "建设期", 95, 166, 480, 34, 26, C.primaryDark, true, "center");
  label(s, "run-head", "运行期", 705, 166, 480, 34, 26, C.primaryDark, true, "center");
  rule(s, "cost-divider", 640, 160, 640, 595, C.light, 3);
  const left = [["筛选优秀页面", "理解为什么好看"], ["内容与数量参数化", "验证不同状态"], ["用户确认能力", "进入正式资产库"]];
  left.forEach((it, i) => { const y = 235 + i * 112; box(s, `cost-build-${i}`, 125, y, 420, 78, i === 2 ? C.primary : C.pale, i === 2 ? C.primary : C.light); label(s, `cost-build-${i}-h`, it[0], 150, y + 11, 370, 26, 21, i === 2 ? C.white : C.ink, true, "center"); label(s, `cost-build-${i}-d`, it[1], 150, y + 42, 370, 22, 17, i === 2 ? "#E5EEF7" : C.muted, false, "center"); });
  const right = [["理解、分类、路由", "低成本模型承担"], ["调用已确认能力", "确定性代码绘制"], ["持续真实任务校准", "视觉模型不是必要成本"]];
  right.forEach((it, i) => { const y = 235 + i * 112; box(s, `cost-run-${i}`, 735, y, 420, 78, i === 1 ? C.primary : C.pale, i === 1 ? C.primary : C.light); label(s, `cost-run-${i}-h`, it[0], 760, y + 11, 370, 26, 21, i === 1 ? C.white : C.ink, true, "center"); label(s, `cost-run-${i}-d`, it[1], 760, y + 42, 370, 22, 17, i === 1 ? "#E5EEF7" : C.muted, false, "center"); });
  label(s, "cost-foot", "视觉理解没有消失，而是从“每次生成都重新支付”变成“一次建设、多次复用”。", 145, 620, 990, 34, 19, C.ink, true, "center");
}

// 9 — moat
{
  const s = presentation.slides.add(); s.background.fill = C.white; slidesBuilt++; title(s, 9, "真正积累的不是一万个模板，而是表达能力包", "页面只有把规律提炼出来，才能从一件作品变成一种能力。");
  label(s, "moat-lead", "现实内容永远会变：\n三个观点会变成四个，\n十个字会变成六十个字。", 55, 175, 400, 115, 26, C.primaryDark, true);
  label(s, "moat-body", "能力要回答的不是“这一页长什么样”，\n而是判断：内容怎样表达，边界在哪里。", 58, 355, 410, 105, 20, C.ink);
  box(s, "capability-package", 560, 160, 610, 410, C.pale, C.light);
  label(s, "capability-title", "经过验证的表达能力包", 595, 190, 540, 34, 25, C.primaryDark, true);
  const rows = [["适配什么", "什么内容适合怎样表达"], ["能装多少", "数量与文字变长时怎样重排"], ["如何变化", "状态变化时怎样保持结构关系"], ["何时退化", "换样式、拆页还是简单排版"]];
  rows.forEach((it, i) => { const y = 255 + i * 65; rule(s, `moat-row-rule-${i}`, 595, y - 12, 1135, y - 12, C.light, 1); label(s, `moat-row-h-${i}`, it[0], 595, y, 130, 28, 19, C.primaryDark, true); label(s, `moat-row-d-${i}`, it[1], 755, y, 355, 28, 19, C.ink); });
  label(s, "moat-bottom", "真正的壁垒：有效能力 × 正确路由 × 清楚边界 × 稳定生成", 560, 600, 610, 35, 20, C.ink, true, "center");
}

// 10 — expansion
{
  const s = presentation.slides.add(); s.background.fill = C.white; slidesBuilt++; title(s, 10, "从一个学校，走向更多组织", "先在有规范、有需求、有边界的场景里落地，再把验证过的能力复用出去。");
  const neu = box(s, "neu", 95, 235, 300, 160, C.primary, C.primary, true);
  label(s, "neu-title", "东北大学", 125, 265, 240, 34, 29, C.white, true, "center");
  label(s, "neu-copy", "第一个正式落地场景\n规范明确 · 需求持续 · 可检验", 125, 320, 240, 45, 18, "#E5EEF7", false, "center");
  const org = box(s, "orgs", 810, 180, 325, 260, C.pale, C.light);
  label(s, "org-title", "更多组织", 850, 205, 245, 32, 25, C.primaryDark, true, "center");
  label(s, "org-copy", "其他学校\n科研院所 / 实验室\n企业 / 团队\n个人长期风格", 850, 267, 245, 145, 20, C.ink, false, "center");
  arrow(s, neu, org, "right", "left");
  label(s, "theme-reuse", "主题可替换", 505, 220, 210, 32, 22, C.primaryDark, true, "center");
  label(s, "theme-reuse-copy", "颜色 · Logo · 字体 · 页眉页脚", 470, 260, 280, 28, 17, C.muted, false, "center");
  label(s, "cap-reuse", "能力可复用", 505, 340, 210, 32, 22, C.primaryDark, true, "center");
  label(s, "cap-reuse-copy", "内容理解与表达规律继续沉淀", 470, 380, 280, 28, 17, C.muted, false, "center");
  label(s, "expand-foot", "把只存在于少数人头脑和电脑里的能力，变成更多人可以低成本获得的生产能力。", 100, 560, 1035, 38, 20, C.ink, true, "center");
}

// 11 — close
{
  const s = presentation.slides.add(); s.background.fill = C.primary; slidesBuilt++;
  label(s, "close-kicker", "PPagenT / 收束", 72, 82, 300, 30, 18, "#DCE8F3", true);
  label(s, "close-title", "把不可预测的 PPT 生成，\n变成概率上高度可预测的交付", 72, 160, 890, 140, 42, C.white, true);
  rule(s, "close-rule", 72, 340, 1110, 340, "#AFC1D4", 2);
  label(s, "close-body", "不一定惊艳，但靠谱；\n不一定独一无二，但真的好用；\n可以立刻拿去讲，也可以继续修改。", 72, 385, 640, 120, 27, "#E5EEF7", true);
  box(s, "close-tag", 870, 425, 260, 90, C.white, C.white, true);
  label(s, "close-tag-text", "可靠的产品能力", 890, 454, 220, 32, 24, C.primaryDark, true, "center");
  label(s, "close-foot", "让一个普通问题，成为一项可靠的生产能力。", 72, 610, 760, 32, 20, "#E5EEF7", false);
}

const out = path.join(RUN, "deck.pptx");
for (const [i, slide] of presentation.slides.items.entries()) {
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(path.join(RUN, `slide-${i + 1}.layout.json`), await layout.text(), "utf8");
}
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(out);
await fs.writeFile(path.join(RUN, "connections.json"), JSON.stringify(connections, null, 2), "utf8");
await fs.writeFile(path.join(RUN, "line-paths.json"), JSON.stringify(linePaths, null, 2), "utf8");
console.log(JSON.stringify({ slides: slidesBuilt, out, connections: connections.length, linePaths: linePaths.length }));
