import fs from "node:fs/promises";
import path from "node:path";
import { renderCase, skin } from "../harness.mjs";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "").replace(/^([A-Za-z]):/, "$1:"));
const input = JSON.parse(await fs.readFile(path.join(here, "input.json"), "utf8"));
const assetId = "progression-maturity-steps-002";

function guideContent(item) {
  const levels = item.content.levels.map((level, index) => ({
    key: `level-${index + 1}`,
    title: level.title,
    body: level.body,
  }));
  return {
    levels,
    showStatus: item.content.showStatus,
    currentIndex: item.content.currentIndex,
  };
}

const specs = [
  {
    item: input.find((entry) => entry.caseId === "c1"),
    frame: { left: 70, top: 176, width: 1140, height: 410 },
    blocks: [
      { text: "当前在形成记录阶段，需经过计划维护达到持续改善。", role: "aux", frame: { left: 290, top: 607, width: 700, height: 28 } },
    ],
    reason: "四个明确能力门槛沿共同维度递进，采用已登记成熟度能力阶梯；宽结构区保留连续阶台、同一消失点与随透视文字承托面。",
    pageNumber: 9,
  },
  {
    item: input.find((entry) => entry.caseId === "c2"),
    frame: { left: 70, top: 176, width: 1140, height: 258 },
    blocks: [
      { text: "当前 · 第2级：形成记录\n故障原因与处理过程可查", role: "body", frame: { left: 70, top: 462, width: 545, height: 118 } },
      { text: "目标 · 第4级：持续改善\n用复盘减少重复故障", role: "body", frame: { left: 665, top: 462, width: 545, height: 118 } },
    ],
    reason: "与c1同稿、同级顺序及状态，改用上半区结构与下方左右两列说明，验证高度缩减仍能保留阶台关系与文字承托面。",
    pageNumber: 10,
  },
  {
    item: input.find((entry) => entry.caseId === "c3"),
    frame: { left: 70, top: 176, width: 1140, height: 410 },
    blocks: [
      { text: "当前在统一分类阶段，后续需走向团队复用、持续更新与反馈优化。", role: "aux", frame: { left: 235, top: 607, width: 810, height: 28 } },
    ],
    reason: "六个知识管理等级是同一能力维度的离散门槛，采用已登记成熟度能力阶梯；保留六级顺序、当前第3级和目标第6级。",
    pageNumber: 11,
  },
  {
    item: input.find((entry) => entry.caseId === "c4"),
    frame: { left: 340, top: 280, width: 600, height: 240 },
    blocks: [
      { text: "首试：600×240；六级稿件与当前/目标状态完整保留。", role: "aux", frame: { left: 245, top: 548, width: 790, height: 28 } },
    ],
    reason: "复用c3同稿六级成熟度阶梯，在600×240区域进行真实容量压力测试；不删除等级、事实或降低字号。",
    pageNumber: 12,
  },
];

const results = [];
for (const spec of specs) {
  if (!spec.item) throw new Error(`input.json 缺少 ${spec.caseId}`);
  const result = await renderCase({
    caseId: spec.item.caseId,
    title: spec.item.title,
    assetId,
    content: guideContent(spec.item),
    frame: spec.frame,
    blocks: spec.blocks,
    reason: spec.reason,
    chapter: "03",
    pageNumber: spec.pageNumber,
  }, here, 1);
  results.push({ caseId: spec.item.caseId, attempt: 1, result });
}

await fs.writeFile(path.join(here, "run-results-attempt-1.json"), JSON.stringify({ skin: skin.id, results }, null, 2), "utf8");
console.log(JSON.stringify(results, null, 2));
