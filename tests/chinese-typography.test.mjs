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

test("文字低于 Skin 最小字号仍放不下时失败关闭", () => {
  const result = fitChineseTextToFrame("这是一段明显超过单行标题容量而且不能继续缩小字号的文字", {
    width: 240,
    height: 34,
    fontSizes: [32],
    maxLines: 1,
  });
  assert.equal(result.fits, false);
});
