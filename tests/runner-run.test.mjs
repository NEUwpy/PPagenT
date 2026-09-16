// 运行器 CLI 的纯判定测试。全仓此前**没有任何**测试 import 过 src/runner/run.mjs——
// 「--replay 在审计 failed 时照样返回 delivered」这个缺陷因此一直没人挡得住。
// 这里只测不启动模型、不碰网络的判定函数；真编译仍由 runner-build-tools.test.mjs 覆盖。
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, replayMissingComposition, replayResult, phaseRulesText } from "../src/runner/run.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PASSING_AUDIT = {
  status: "passed",
  typography: { status: "passed", violations: [] },
  geometry: { status: "passed", violations: [] },
  lineBreaks: { status: "passed", violations: [] },
};
const FAILING_AUDIT = {
  status: "failed",
  typography: { status: "passed", violations: [] },
  geometry: { status: "passed", violations: [] },
  lineBreaks: { status: "failed", violations: [{ type: "engine-rewrapped", slide: "slide-03", element: "composition-grid-0/body" }] },
};

const STATE = {
  phase: "ready",
  pages: [{ pageId: "p1", composition: { compositionId: "editorial-grid", textSlots: [] } }],
};

test("--replay 只在整套审计通过时才算交付", () => {
  const passed = replayResult(STATE, { pages: [{}, {}], qualityAudit: PASSING_AUDIT });
  assert.equal(passed.accepted, true);
  assert.equal(passed.qualityAuditStatus, "passed");

  const failed = replayResult(STATE, { pages: [{}, {}], qualityAudit: FAILING_AUDIT });
  assert.equal(failed.accepted, false);
  assert.equal(failed.reason, "quality-audit-failed");
  assert.equal(failed.qualityAuditStatus, "failed");
  // 归因要带到页：只说"整副失败"没法让人知道该修哪一页。
  assert.deepEqual(failed.issues.map((entry) => entry.slide), ["slide-03"]);
  assert.deepEqual(failed.issues[0].issues.map((issue) => issue.code), ["engine-rewrapped"]);
});

test("没有视觉方案的页面无法重编译，且不靠猜测补齐", () => {
  assert.deepEqual(replayMissingComposition({ pages: [{ pageId: "p1", composition: null }] }), ["p1"]);
  assert.deepEqual(replayMissingComposition({ pages: [{ pageId: "p1" }, { pageId: "p2", composition: {} }] }), ["p1"]);
  assert.deepEqual(replayMissingComposition(STATE), []);
});

test("parseArgs 把带值的开关与裸开关分开，值不会被当成下一个开关", () => {
  assert.deepEqual(parseArgs(["--run-dir", "x", "--replay", "--input", "a.md", "--max-turns", "12"]), {
    "run-dir": "x", replay: true, input: "a.md", "max-turns": "12",
  });
  // 值缺失时按裸开关处理，不会把 undefined 塞进参数表。
  assert.deepEqual(parseArgs(["--resume", "--run-dir"]), { resume: true, "run-dir": true });
});

// 视觉阶段此前看到的 system 只有 run.mjs 里两段硬编码短文本，仓库里既有的设计规则一条都没进去。
// 规则加载必须调既有模块（runtime/rules-loader.mjs），不在这里自造规则正文。
test("视觉阶段注入生成规则，内容阶段注入内容导演规则，两者不同", async () => {
  const visual = await phaseRulesText(ROOT, "visual");
  // 生成 profile = 页面组合 + 内容组织 + 质量检查 + Skin 规则与排版体系；这些文件名在 bundle.text 的标记里。
  assert.match(visual, /<!-- rules\/页面组合\.md -->/);
  assert.match(visual, /<!-- rules\/排版体系\/麦肯锡式\.md -->/);
  assert.doesNotMatch(visual, /<!-- rules\/执行\/内容导演\.md -->/);

  const content = await phaseRulesText(ROOT, "content");
  assert.match(content, /<!-- rules\/执行\/内容导演\.md -->/);
  assert.doesNotMatch(content, /<!-- rules\/排版体系\/麦肯锡式\.md -->/);

  // 定向修订与内容阶段是同一套规则（它不是独立阶段，是内容阶段的第二趟）。
  assert.equal(await phaseRulesText(ROOT, "content-revision"), content);
  assert.notEqual(visual, content);
});

test("规则正文必须带优先级声明：它描述的是另一条生产线，冲突时以本次工具契约为准", async () => {
  const visual = await phaseRulesText(ROOT, "visual");
  // 没有这句，模型会去调规则里那套旧产线的工具名（pageMetadata / logicIntent / sourceBlockIds）。
  assert.match(visual, /本次提供的工具/);
  assert.match(visual, /冲突时/);
  // 声明必须在规则正文**之前**，否则模型读到旧工具名时还没看到优先级约定。
  assert.ok(visual.indexOf("本次提供的工具") < visual.indexOf("<!-- rules/"), "优先级声明必须排在规则正文前面");
});
