import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createNortheasternUniversityRenderer } from "../src/agent/neu-renderer.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("东北大学 Skin 经过统一 renderer 真实生成 PPTX 与逐页证据", async (t) => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-neu-render-"));
  t.after(async () => fs.rm(temp, { recursive: true, force: true }));
  const outputPptx = path.join(temp, "真实渲染.pptx");
  const renderer = createNortheasternUniversityRenderer({
    sourcePptx: path.join(root, "PPT模板-封面正文尾页.pptx"),
    outputPptx,
    manuscriptSource: "docs/为什么做PPagenT.md",
  });
  const pageContents = [
    { schemaVersion: "1.0", pageId: "cover", title: "为什么做 PPagenT", items: [] },
    {
      schemaVersion: "1.0",
      pageId: "topics",
      title: "真正费时间的是判断",
      notes: "判断成本",
      items: [
        { id: "a", title: "拆页", body: "" },
        { id: "b", title: "关系", body: "" },
        { id: "c", title: "重点", body: "" },
      ],
    },
    { schemaVersion: "1.0", pageId: "closing", title: "可靠、好用、可继续修改", items: [] },
  ];
  const pageIntents = [
    { intentId: "cover-intent" },
    { intentId: "topics-intent" },
    { intentId: "closing-intent" },
  ];
  const layoutDecisions = [
    { selectedAssetId: "northeastern-university-cover-001" },
    { selectedAssetId: "radial-hub-001" },
    { selectedAssetId: "northeastern-university-closing-001" },
  ];
  const renderPayloads = [
    { assetId: "northeastern-university-cover-001", parameters: { title: "为什么做 PPagenT", presenter: "", date: "" } },
    {
      assetId: "radial-hub-001",
      parameters: {
        title: "真正费时间的是判断",
        center: "判断成本",
        items: ["拆页", "关系", "重点"],
        visualVariantId: "split-wing",
      },
    },
    { assetId: "northeastern-university-closing-001", parameters: { text: "可靠、好用、可继续修改" } },
  ];
  const result = await renderer({
    outputDir: path.join(temp, "runtime"),
    deckPlan: {
      pages: [
        { narrativeJob: "开场" },
        { narrativeJob: "核心观点" },
        { narrativeJob: "收束" },
      ],
    },
    pageContents,
    pageIntents,
    layoutDecisions,
    renderPayloads,
  });
  const pptx = await fs.readFile(result.outputPptx);
  assert.equal(pptx.subarray(0, 2).toString("ascii"), "PK");
  assert.equal(result.pageEvidence.length, 3);
  for (const evidence of result.pageEvidence) {
    const png = await fs.readFile(evidence);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
});
