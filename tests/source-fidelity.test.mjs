// 内容保真检查：模型可以撰写条目正文，但"写了"不等于"忠于原稿"。
// 这里只测**查得出来**的四条；查不出来的四类必须由 limits 如实列明，且必须非空——
// 一个自称覆盖了原意保真的检查器，比没有检查器更危险。
import test from "node:test";
import assert from "node:assert/strict";
import { checkItemFidelity, fidelityLimitsText, FIDELITY_LIMITS, ITEM_TEXT_MAX_LENGTH } from "../src/content/source-fidelity.mjs";

const SOURCE = "临时协调：申请人在群里描述需求，管理员逐次确认设备和时间。入口简单，但调整记录分散，换班时需要重新解释。";

test("没写正文时不报错：回退到逐字来源，不是违规", () => {
  for (const text of [undefined, null]) {
    const result = checkItemFidelity({ text, sourceText: SOURCE });
    assert.equal(result.accepted, true);
    assert.deepEqual(result.issues, []);
  }
});

test("空白正文与超长正文都必须报出来", () => {
  const empty = checkItemFidelity({ text: "   \n ", sourceText: SOURCE });
  assert.equal(empty.accepted, false);
  assert.deepEqual(empty.issues.map((issue) => issue.code), ["item-text-empty"]);

  const exact = checkItemFidelity({ text: "调".repeat(ITEM_TEXT_MAX_LENGTH), sourceText: "调" });
  assert.equal(exact.accepted, true, `恰好 ${ITEM_TEXT_MAX_LENGTH} 字不该被拒`);

  const tooLong = checkItemFidelity({ text: "调".repeat(ITEM_TEXT_MAX_LENGTH + 1), sourceText: "调" });
  assert.equal(tooLong.accepted, false);
  assert.deepEqual(tooLong.issues, [{ code: "item-text-too-long", length: ITEM_TEXT_MAX_LENGTH + 1, limit: ITEM_TEXT_MAX_LENGTH }]);
});

test("正文里的数字必须在被引用的来源里逐字存在", () => {
  const backed = checkItemFidelity({ text: "管理员逐次确认设备和时间（换班时需重新解释）", sourceText: SOURCE });
  assert.equal(backed.accepted, true);

  // 原稿里没有的数字：编造。
  const invented = checkItemFidelity({ text: "共 3 类协调方式", sourceText: SOURCE });
  assert.equal(invented.accepted, false);
  assert.deepEqual(invented.issues, [{ code: "unbacked-number", value: "3" }]);

  // 同一个编造数字出现多次只报一条；有据的数字与无据的混在一起时只报无据的那个。
  const mixed = checkItemFidelity({ text: "2 步流程，共 3 类", sourceText: "第一步、第二步" });
  assert.deepEqual(mixed.issues, [
    { code: "unbacked-number", value: "2" },
    { code: "unbacked-number", value: "3" },
  ]);
  assert.equal(checkItemFidelity({ text: "第一步与第二步", sourceText: "第一步、第二步" }).accepted, true);
});

test("正文里的引号内容必须在被引用的来源里逐字存在", () => {
  const backed = checkItemFidelity({ text: "原稿称之为「临时协调」", sourceText: SOURCE });
  assert.equal(backed.accepted, true);

  const invented = checkItemFidelity({ text: "原稿称之为「智能排期」", sourceText: SOURCE });
  assert.equal(invented.accepted, false);
  assert.deepEqual(invented.issues, [{ code: "unbacked-quote", value: "智能排期" }]);

  // 三种引号都查，空引号不报（它没有内容可保真）。
  const both = `${SOURCE}\n统一登记：申请先进入同一份登记表。`;
  assert.equal(checkItemFidelity({ text: "称『临时协调』与“统一登记”", sourceText: both }).accepted, true);
  // 换一种引号不会让它蒙混过关：内容对不上照样报，报的是引号里的内容而不是引号本身。
  assert.deepEqual(
    checkItemFidelity({ text: "称『统一登记』", sourceText: SOURCE }).issues,
    [{ code: "unbacked-quote", value: "统一登记" }],
  );
  assert.equal(checkItemFidelity({ text: "空引号「」不算违规", sourceText: SOURCE }).accepted, true);
});

test("来源为空时，正文里的任何数字都算无据", () => {
  const result = checkItemFidelity({ text: "共 3 类", sourceText: "" });
  assert.equal(result.accepted, false);
  assert.deepEqual(result.issues.map((issue) => issue.code), ["unbacked-number"]);
});

test("查不出来的四类必须如实列明，且能渲染进工具描述", () => {
  // 这四类机器查不了：改了原意但一个数字、一个引号都不动，上面四条规则一条都不会响。
  assert.ok(FIDELITY_LIMITS.length >= 4);
  const text = fidelityLimitsText();
  for (const keyword of ["限定条件", "语气", "同义", "中文数词"]) {
    assert.ok(text.includes(keyword), `limits 必须写明查不了「${keyword}」这类改动`);
  }
  // 每条检查都带上 limits，拒绝时也要能把它原样交给模型。
  assert.equal(checkItemFidelity({ text: "共 3 类", sourceText: "" }).limits, FIDELITY_LIMITS);
  assert.equal(checkItemFidelity({ text: null, sourceText: "" }).limits, FIDELITY_LIMITS);
});
