import assert from "node:assert/strict";
import test from "node:test";
import { fitChineseTextToFrame, wrapChineseText } from "../src/render/chinese-typography.mjs";

test("中文容量适配保持词语、数量短语和标点完整", () => {
  const cases = [
    ["做 PPT 真正昂贵的，是这些反复发生的判断。", 14, ["这些", "判断。"]],
    ["主动牺牲一部分自由，换取可靠、稳定和效率。", 17, ["可靠、", "稳定"]],
    ["条目会从三个变四个，文字会从十字变六十字。", 10, ["六十字。"]],
    ["内容理解、拆页、表达规则和失败经验可以继续服务其他学校、企业、实验室和个人。", 17, ["个人。"]],
  ];
  for (const [source, capacity, protectedPhrases] of cases) {
    const wrapped = wrapChineseText(source, capacity);
    assert.equal(wrapped.replaceAll("\n", ""), source);
    assert.doesNotMatch(wrapped, /\n[、，。：；！？,.!?)]/u);
    for (const phrase of protectedPhrases) assert.match(wrapped, new RegExp(phrase.replace(".", "\\."), "u"));
  }
});

test("Skin 标题使用离散字号并优先在语义标点处换行", () => {
  const cover = fitChineseTextToFrame("让“六地”红，成为理工青年最鲜亮的青春底色", {
    width: 1252.71,
    height: 169.4,
    fontSizes: [64, 58, 52],
    maxLines: 2,
    lineHeight: 1.15,
    preferSemanticBreaks: true,
  });
  assert.equal(cover.fits, true);
  assert.equal(cover.fontSize, 64);
  assert.equal(cover.text, "让“六地”红，\n成为理工青年最鲜亮的青春底色");

  const closing = fitChineseTextToFrame("“六地”红：成为理工青年最鲜亮的青春底色\n我的汇报完毕，谢谢大家！", {
    width: 1252.71,
    height: 169.4,
    fontSizes: [52, 48, 44],
    maxLines: 3,
    lineHeight: 1.1,
    preferSemanticBreaks: true,
  });
  assert.equal(closing.fits, true);
  assert.ok(closing.fontSize <= 52);
  assert.ok(closing.lineCount <= 3);
});

test("行首禁则：闭引号/闭括号/句读不得起行（含实证样本）", () => {
  const forbidden = /^[、，。：；！？,.!?)”’」』）】》〉〕]/u;
  const empirical = "体系变革是否成效，要以能否“解决实际问题”为唯一检验标准，力求变革落地有实效。";
  for (let capacity = 8; capacity <= 24; capacity += 1) {
    const wrapped = wrapChineseText(empirical, capacity);
    assert.equal(wrapped.replaceAll("\n", ""), empirical);
    for (const line of wrapped.split("\n")) assert.ok(!forbidden.test(line), `capacity=${capacity}: ${line}`);
  }
  const cases = [
    ["指标“按期完成”并复核。", 6],
    ["负责人（含副职）签字后归档。", 7],
    ["“六地”红是最鲜亮的底色。", 6],
  ];
  for (const [source, capacity] of cases) {
    const wrapped = wrapChineseText(source, capacity);
    assert.equal(wrapped.replaceAll("\n", ""), source);
    for (const line of wrapped.split("\n")) assert.ok(!forbidden.test(line), `${source} @${capacity}: ${line}`);
  }
});

test("行尾禁则：开引号/开括号不得收行（含实证样本）", () => {
  const forbiddenEnd = /[“‘（「『【《〈〔]$/u;
  const empirical = "强化“变革是硬道理，合规是硬要求，作风是硬标准”管理意识，统筹兼顾，攻守有道，以规范管理的“效率”强化变革转型的“力度”，以优良的思想作风、工作作风、战斗作风跑出变革转型的“加速度”。";
  for (let capacity = 8; capacity <= 26; capacity += 1) {
    const wrapped = wrapChineseText(empirical, capacity);
    assert.equal(wrapped.replaceAll("\n", ""), empirical);
    for (const line of wrapped.split("\n")) assert.ok(!forbiddenEnd.test(line), `capacity=${capacity}: ${line}`);
  }
  const cases = [
    ["由“规划”到“落地”的转变。", 7],
    ["参见《管理办法》第三条。", 7],
    ["他说：“继续打磨。”", 6],
  ];
  for (const [source, capacity] of cases) {
    const wrapped = wrapChineseText(source, capacity);
    assert.equal(wrapped.replaceAll("\n", ""), source);
    for (const line of wrapped.split("\n")) assert.ok(!forbiddenEnd.test(line), `${source} @${capacity}: ${line}`);
  }
});

test("文字低于 Skin 最小字号仍放不下时失败关闭", () => {
  const result = fitChineseTextToFrame("这是一段明显超过单行标题容量而且不能继续缩小字号的文字", {
    width: 240,
    height: 34,
    fontSizes: [32],
    maxLines: 1,
  });
  assert.equal(result.fits, false);
});
