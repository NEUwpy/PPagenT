import fs from "node:fs/promises";
import path from "node:path";
import { renderCase } from "../harness.mjs";

const here = import.meta.dirname;
const input = JSON.parse(await fs.readFile(path.join(here, "input.json"), "utf8"));
const requestedCase = process.argv[2] ?? null;
const attempt = Number(process.argv[3] ?? 1);
const selectedInput = requestedCase ? input.filter((item) => item.caseId === requestedCase) : input;
if (!selectedInput.length) throw new Error(`unknown case: ${requestedCase}`);

function contentFor(item, attempt = 1) {
  const raw = item.structure.content;
  if (item.caseId === "b3" && attempt < 4) {
    return {
      levels: raw.items.map((x) => ({ key: x.id, title: x.title, body: x.body })),
      showStatus: false,
      currentIndex: 0,
    };
  }
  const short = attempt > 1 && item.caseId === "b4";
  const funnelInputs = raw.structuredData.inputs.map((x, index) => ({
    ...x,
    iconQuery: item.caseId === "b3" && attempt >= 5
      ? ["user-round", "clipboard-list", "headset", "notebook-pen"][index]
      : x.iconQuery,
  }));
  return {
    inputs: funnelInputs,
    steps: raw.items.map((x) => ({ key: x.id, title: short ? x.shortTitle : x.title })),
  };
}

function assetFor(item, attempt = 1) {
  if (item.caseId === "b3" && attempt >= 4) return "convergence-simple-funnel-001";
  return item.structure.assetId;
}

function frameFor(item, attempt = 1) {
  if (item.caseId === "b3" && attempt >= 4) {
    return { left: 180, top: 155, width: 920, height: 430 };
  }
  if (item.caseId === "b4") {
    return attempt === 1 ? item.layout.initialStructureFrame : item.layout.expandedStructureFrame;
  }
  return item.layout.structureFrame;
}

function blocksFor(item, attempt = 1) {
  if (item.caseId === "b1") {
    if (attempt > 2) {
      return [
        { role: "body", text: "入口：访谈、工单、使用记录；提供待核对的现场语境。", frame: { left: 56, top: 200, width: 500, height: 58 } },
        { role: "aux", text: "准入依据：问题可复现后进入核对；小样验证有效，才纳入发布。", frame: { left: 56, top: 295, width: 500, height: 90 } },
      ];
    }
    if (attempt > 1) {
      return [
        { role: "body", text: "入口：访谈、工单、使用记录；它们提供需要核对的现场语境。", frame: { left: 56, top: 200, width: 500, height: 58 } },
        { role: "aux", text: "准入依据：能复现的问题进入核对；小样验证有效后，才纳入明确交付范围。", frame: { left: 56, top: 295, width: 500, height: 110 } },
      ];
    }
    return [
      { role: "body", text: "入口：访谈、工单、使用记录。", frame: { left: 56, top: 200, width: 500, height: 45 } },
      { role: "aux", text: "四个阶段分别强调原始反馈、可复现问题、小样验证与明确交付范围。图内只保留短标题，说明置于图外。", frame: { left: 56, top: 285, width: 500, height: 130 } },
    ];
  }
  if (item.caseId === "b2") {
    return [
      { role: "aux", text: "入口\n访谈 · 工单 · 使用记录", frame: { left: 56, top: 215, width: 250, height: 80 } },
      { role: "aux", text: "从原始反馈\n走向明确交付范围", frame: { left: 950, top: 215, width: 240, height: 80 } },
    ];
  }
  if (item.caseId === "b3") {
    return [
      { role: "aux", text: "入口：用户访谈、现场记录、客服工单、内部复盘。四类入口先汇总，再沿六层逐步收束。", frame: { left: 56, top: 600, width: 1100, height: 35 } },
    ];
  }
  if (item.caseId === "b4" && attempt > 1) {
    return [
      { role: "body", text: "汇总反馈：各渠道原始反馈尚未核实。", frame: { left: 56, top: 205, width: 215, height: 70 } },
      { role: "body", text: "保留问题：能够重复观察并有材料支持。", frame: { left: 56, top: 300, width: 215, height: 90 } },
      { role: "body", text: "明确方案：责任人与交付范围均已明确。", frame: { left: 995, top: 270, width: 220, height: 90 } },
    ];
  }
  return [];
}

const reasons = Object.fromEntries(input.map((item) => [item.caseId, item.caseId === "b4"
  ? "三层收敛先严格记录 320×300 首试，再在必要时扩区；不以模板自由重画。"
  : item.structure.assetId === "convergence-simple-funnel-001"
    ? "连续输入经过逐层收窄进入发布范围，保留曲面圆台、分层留白与随形导流箭头。"
    : "六个有明确门槛的筛选层级沿共同能力维度递进，保留连续阶台与随形承托面。"]));

const results = [];
for (const item of selectedInput) {
  const result = await renderCase({
    caseId: item.caseId,
    title: item.title,
    assetId: assetFor(item, attempt),
    content: contentFor(item, attempt),
    frame: frameFor(item, attempt),
    blocks: blocksFor(item, attempt),
    reason: item.caseId === "b3" && attempt >= 4
      ? "父任务语义纠正：六层筛选是连续收敛过程，使用简明输入转化漏斗保留逐层收窄与入口汇总。"
      : reasons[item.caseId],
    ...(item.caseId === "b3" && attempt >= 4 ? { auditNote: "parent-guided semantic correction" } : {}),
    chapter: "02",
    pageNumber: { b1: 5, b2: 6, b3: 7, b4: 8 }[item.caseId],
  }, here, attempt);
  results.push({ caseId: item.caseId, attempt, status: result.status, error: result.error ?? null, artifactKey: result.key });
}

await fs.writeFile(path.join(here, requestedCase ? `${requestedCase}-attempt-${attempt}-results.json` : "first-round-results.json"), JSON.stringify(results, null, 2), "utf8");
console.log(JSON.stringify(results, null, 2));
