import assert from "node:assert/strict";
import test from "node:test";
import { wrapChineseText } from "../src/render/chinese-typography.mjs";

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
