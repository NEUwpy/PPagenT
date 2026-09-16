import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  auditRenderedDeck,
  auditRenderedGeometry,
  auditRenderedLineBreaks,
  auditRenderedTypography,
} from "../src/tools/audit-rendered-typography.mjs";

// 拟合行数（element.text 里的 \n 个数 + 1）与引擎实际排出的行盒是两回事。
// 引擎多排一行 = 交付物上多出一个孤立字，拟合器自己看不出来，只有 QA 行盒记得住。
test("断行审计以引擎行盒为准：引擎多排一行就必须报出来", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-linebreaks-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  // 拟合 2 行，引擎排了 3 行：多出来的那个字独占一行。
  await fs.writeFile(path.join(dir, "slide-04.layout.json"), JSON.stringify({
    elements: [{
      name: "PPAGENT_QA|within=grid-0|role=body",
      text: "管理员逐次确认设备和时间\n换班时需要重新解释",
      textPreview: "…管理员逐次确认设备和时间…",
      resolvedFontSize: 18,
      bbox: [100, 100, 313, 120],
      textLayout: { lineCount: 3, lines: [{ text: "管理员逐次确认设备和" }, { text: "时" }, { text: "间换班时需要重新解释" }] },
    }],
  }));
  const failed = await auditRenderedLineBreaks(dir);
  assert.equal(failed.status, "failed");
  // 引擎多排出来的那一行正好是孤立单字「时」，所以两类违规同时成立、指向同一页同一元素。
  // 这正是 R1 首版 slide-03/05 的实际形状，两条都要报。
  assert.deepEqual([...new Set(failed.violations.map((violation) => violation.type))].sort(),
    ["engine-rewrapped", "stranded-glyph"]);
  const rewrapped = failed.violations.find((violation) => violation.type === "engine-rewrapped");
  assert.deepEqual([rewrapped.slide, rewrapped.fittedLines, rewrapped.engineLines], ["slide-04", 2, 3]);
  assert.equal(rewrapped.element, "PPAGENT_QA|within=grid-0|role=body");

  // 整套审计必须跟着失败：断行一旦不进总状态，交付关口就断了。
  const deck = await auditRenderedDeck(dir);
  assert.equal(deck.status, "failed");
  assert.equal(deck.lineBreaks.status, "failed");

  // 拟合与引擎一致时不报。
  await fs.writeFile(path.join(dir, "slide-04.layout.json"), JSON.stringify({
    elements: [{
      name: "PPAGENT_QA|within=grid-0|role=body",
      text: "管理员逐次确认设备和时间\n换班时需要重新解释",
      textPreview: "…",
      resolvedFontSize: 18,
      bbox: [100, 100, 313, 120],
      textLayout: { lineCount: 2, lines: [{ text: "管理员逐次确认设备和时间" }, { text: "换班时需要重新解释" }] },
    }],
  }));
  const passed = await auditRenderedLineBreaks(dir);
  assert.equal(passed.status, "passed");
  assert.deepEqual(passed.violations, []);
});

test("研发期字号审计会拒绝 Skin 组件中的不可读小字", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-typography-"));
  await fs.writeFile(path.join(dir, "slide-01.layout.json"), JSON.stringify({
    elements: [
      { text: "正文", textPreview: "正文", resolvedFontSize: 18, resolvedTextStyle: { typeface: "Microsoft YaHei" } },
      { text: "重点路线", textPreview: "重点路线", resolvedFontSize: 8, resolvedTextStyle: { typeface: "Microsoft YaHei" } },
    ],
  }));
  const failed = await auditRenderedTypography(dir);
  assert.equal(failed.status, "failed");
  assert.equal(failed.violations[0].text, "重点路线");

  await fs.writeFile(path.join(dir, "slide-01.layout.json"), JSON.stringify({
    elements: [
      { text: "正文", textPreview: "正文", resolvedFontSize: 18, resolvedTextStyle: { typeface: "Microsoft YaHei" } },
      { text: "重点路线", textPreview: "重点路线", resolvedFontSize: 16, resolvedTextStyle: { typeface: "Microsoft YaHei" } },
    ],
  }));
  const passed = await auditRenderedTypography(dir);
  assert.equal(passed.status, "passed");
});

test("几何审计拒绝同一碰撞域的重叠和越出容器的文字", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-geometry-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.writeFile(path.join(dir, "slide-01.layout.json"), JSON.stringify({
    slide: { frame: { left: 0, top: 0, width: 1280, height: 720 } },
    elements: [
      { name: "PPAGENT_QA|parent=a|domains=content", bbox: [100, 100, 300, 200] },
      { name: "PPAGENT_QA|parent=b|domains=content", bbox: [350, 150, 300, 200] },
      { name: "PPAGENT_QA|within=a|role=body", bbox: [120, 120, 360, 40] },
    ],
  }));
  const result = await auditRenderedGeometry(dir, { requireQaParents: true });
  assert.equal(result.status, "failed");
  assert.ok(result.violations.some((issue) => issue.type === "overlap"));
  assert.ok(result.violations.some((issue) => issue.type === "child-outside-parent"));
});

test("几何与字号都通过时确定性交付门禁才通过", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-deck-audit-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.writeFile(path.join(dir, "slide-01.layout.json"), JSON.stringify({
    slide: { frame: { left: 0, top: 0, width: 1280, height: 720 } },
    elements: [
      { name: "PPAGENT_QA|parent=a|domains=content", bbox: [100, 100, 300, 200] },
      {
        name: "PPAGENT_QA|within=a|role=body",
        bbox: [120, 120, 250, 40],
        text: "正文",
        resolvedFontSize: 18,
        resolvedTextStyle: { typeface: "Microsoft YaHei" },
      },
      { name: "PPAGENT_QA|parent=b|domains=content", bbox: [500, 100, 300, 200] },
    ],
  }));
  const result = await auditRenderedDeck(dir, { requireQaParents: true });
  assert.equal(result.status, "passed");
  assert.equal(result.geometry.qaParentCount, 2);
});

test("连接线必须贴合声明的形状边缘锚点", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-connectors-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const elements = [
    { name: "PPAGENT_QA|parent=a", bbox: [100, 100, 100, 100] },
    { name: "PPAGENT_QA|parent=b", bbox: [500, 100, 100, 100] },
    {
      name: "PPAGENT_CONNECTOR|from=a|fromSide=right|to=b|toSide=left",
      geometry: "line",
      bbox: [200, 150, 300, 0],
    },
  ];
  await fs.writeFile(path.join(dir, "slide-01.layout.json"), JSON.stringify({ elements }));
  const passed = await auditRenderedGeometry(dir);
  assert.equal(passed.status, "passed");
  assert.equal(passed.connectorCount, 1);

  elements[2].bbox = [206, 150, 294, 0];
  await fs.writeFile(path.join(dir, "slide-01.layout.json"), JSON.stringify({ elements }));
  const failed = await auditRenderedGeometry(dir);
  assert.equal(failed.status, "failed");
  assert.ok(failed.violations.some((issue) => issue.type === "connector-detached"));
});

test("资产 builder 不得绕过统一 Skin 变换直接写裸线段", async () => {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const runtimeDir = path.join(projectRoot, "src", "asset-runtime");
  const files = (await fs.readdir(runtimeDir)).filter((file) => file.endsWith("-builders.mjs"));
  for (const file of files) {
    const source = await fs.readFile(path.join(runtimeDir, file), "utf8");
    if (file !== "component-builders.mjs") {
      assert.equal(source.includes('geometry: "line"'), false, `${file} 必须调用统一 addLine`);
      continue;
    }
    for (const match of source.matchAll(/geometry:\s*"line"/gu)) {
      const localBlock = source.slice(match.index, match.index + 280);
      assert.match(localBlock, /position:\s*transformPosition\(slide,/u, "component-builders 中的线必须参与 Skin 变换");
    }
  }
});

test("被选中的结构组件页如果丢失几何契约必须失败", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-missing-contract-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.writeFile(path.join(dir, "slide-01.layout.json"), JSON.stringify({ elements: [] }));
  const result = await auditRenderedGeometry(dir, { requiredQaSlides: ["slide-01"] });
  assert.equal(result.status, "failed");
  assert.equal(result.violations[0].type, "missing-qa-geometry-contract");
});
