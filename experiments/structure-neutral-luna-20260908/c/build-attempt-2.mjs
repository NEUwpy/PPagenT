import fs from "node:fs/promises";
import path from "node:path";
import { renderCase, skin } from "../harness.mjs";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "").replace(/^([A-Za-z]):/, "$1:"));
const input = JSON.parse(await fs.readFile(path.join(here, "input.json"), "utf8"));
const assetId = "progression-maturity-steps-002";

function content(item) {
  return {
    levels: item.content.levels.map((level, index) => ({ key: `level-${index + 1}`, title: level.title, body: level.body })),
    showStatus: item.content.showStatus,
    currentIndex: item.content.currentIndex,
  };
}

const specs = [
  {
    caseId: "c3",
    frame: { left: 56, top: 176, width: 1168, height: 430 },
    blocks: [{ text: "当前在统一分类阶段，后续需走向团队复用、持续更新与反馈优化。", role: "aux", frame: { left: 235, top: 618, width: 810, height: 26 } }],
    reason: "c3首轮宽区因正文容量拒绝；本次仅在同一页内扩大可用结构宽度并使用已给出的8至14字说明，保留六级、事实和状态。",
    pageNumber: 11,
  },
  {
    caseId: "c4",
    frame: { left: 180, top: 220, width: 900, height: 320 },
    blocks: [{ text: "第2次尝试：扩至900×320；六级稿件与当前/目标状态完整保留。", role: "aux", frame: { left: 230, top: 566, width: 820, height: 26 } }],
    reason: "c4首试600×240因六级正文容量拒绝；第2次尝试只扩大区域至900×320，不删除等级、事实或降低字号。",
    pageNumber: 12,
  },
];

const results = [];
for (const spec of specs) {
  const item = input.find((entry) => entry.caseId === spec.caseId);
  const result = await renderCase({
    caseId: spec.caseId,
    title: item.title,
    assetId,
    content: content(item),
    frame: spec.frame,
    blocks: spec.blocks,
    reason: spec.reason,
    chapter: "03",
    pageNumber: spec.pageNumber,
  }, here, 2);
  results.push({ caseId: spec.caseId, attempt: 2, result });
}
await fs.writeFile(path.join(here, "run-results-attempt-2.json"), JSON.stringify({ skin: skin.id, results }, null, 2), "utf8");
console.log(JSON.stringify(results, null, 2));
