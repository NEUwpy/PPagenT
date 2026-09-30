// 可单独运行的建设段。这里先登记 A0：对一页灰稿计划做版式候选测量、绑定和灰稿编译。
// 它不调用模型，也不代替稿件分页；输入/输出由工作台日志和文件共同留存。
import fs from "node:fs/promises";
import path from "node:path";
import { GRAY_LAYOUT_PROGRAMS } from "../runner/gray-layout-catalog.mjs";
import { measuredLayoutCandidates, bindLayoutSelection } from "../runner/gray-layout-selection.mjs";
import { grayBodyLayout, fitGrayText, validateGrayPlan, renderGrayDraft } from "../runner/gray-draft.mjs";
import { newRunState } from "../runner/state.mjs";

export const DEBUG_SEGMENTS = Object.freeze({
  "a0-layout-candidates": {
    id: "a0-layout-candidates",
    label: "A0 · 已有页面契约的版式测量",
    note: "建设侧局部回放，不是长稿件主线；输入必须已经完成分页和页面表达契约。",
    stages: [["a0-layout-candidates", "契约 → 候选版式 → 灰稿编译", "对已形成的页面表达契约按实文测量版式，绑定候选并编译检查灰稿"]],
    handoffs: { "a0-layout-candidates": "这是局部建设段。输入是已完成分页与页面表达的 gray-plan-3 和版面尺寸；输出是候选清单、绑定回执、程序检查和灰稿产物。未承载的关系或超容量内容保留拒绝原因。" },
  },
});

function json(value) { return JSON.stringify(value, null, 2); }
function sha(value) { return Buffer.from(String(value)).toString("base64url").slice(0, 16); }

function validateInput(input) {
  if (!input || typeof input !== "object") throw new Error("分段输入必须是 JSON 对象");
  if (typeof input.source !== "string" || !input.source.trim()) throw new Error("分段输入缺少 source 正文");
  if (input.initialPlan?.schemaVersion !== "gray-plan-3" || !Array.isArray(input.initialPlan.pages) || input.initialPlan.pages.length !== 1) {
    throw new Error("A0 输入需要恰好一页 schemaVersion=gray-plan-3 的 initialPlan");
  }
  const page = input.initialPlan.pages[0];
  if (!page.pageId || !Array.isArray(page.groups) || !page.groups.length) throw new Error("A0 页面需要 pageId 和至少一个 groups");
  const area = input.area ?? { width: 1170, height: 492, label: "A0 调试区" };
  if (!Number.isFinite(area.width) || !Number.isFinite(area.height) || area.width < 240 || area.height < 240) throw new Error("A0 area 尺寸不合法");
  return { source: input.source, plan: input.initialPlan, area: { width: Math.round(area.width), height: Math.round(area.height), label: String(area.label || "A0 调试区").slice(0, 60) }, selectedCandidateId: input.selectedCandidateId ?? null };
}

function refusalBoundaries(plan, measured) {
  const relationRefusals = [];
  for (const relation of ["comparison", "sequence", "causal"]) {
    try {
      bindLayoutSelection(plan, measured, { pages: [{ pageId: plan.pages[0].pageId, candidateId: measured[0]?.candidates?.[0]?.id, relation, reason: "A0 关系边界回放" }] });
    } catch (error) {
      relationRefusals.push({ input: relation, status: "refused", reason: error.message });
    }
  }
  return relationRefusals;
}

export async function runDebugSegment({ segmentId, input, output, recorder }) {
  const definition = DEBUG_SEGMENTS[segmentId];
  if (!definition) throw new Error(`未登记的调试分段：${segmentId}`);
  const { source, plan, area, selectedCandidateId } = validateInput(input);
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, "source.md"), `${source.trim()}\n`, "utf8");
  await fs.writeFile(path.join(output, "input-plan.json"), json(plan), "utf8");
  await fs.writeFile(path.join(output, "input.json"), json({ source, initialPlan: plan, area, selectedCandidateId }), "utf8");

  const metrics = { measureBody: grayBodyLayout, fitText: fitGrayText };
  const measured = measuredLayoutCandidates(plan, area, metrics);
  const pageMeasurement = measured[0] ?? { candidates: [], rejected: "没有返回候选" };
  const candidates = pageMeasurement.candidates ?? [];
  const chosen = candidates.find(candidate => candidate.id === selectedCandidateId) ?? candidates[0];
  const refusals = refusalBoundaries(plan, measured);
  if (!chosen) {
    const result = { segmentId, status: "refused", inputBoundary: "已完成分页与页面表达契约", area, candidates, refusals, rejection: pageMeasurement.rejected ?? "没有可承载候选", coverage: "候选测量与拒绝边界；未编译灰稿" };
    await fs.writeFile(path.join(output, "result.json"), json(result), "utf8");
    await recorder.observe({ source: "workflow", type: "stage-call", status: "running", stage: segmentId, input: { source, plan, area } });
    await recorder.observe({ source: "workflow", type: "stage-call", status: "failed", stage: segmentId, error: { code: "NO_LAYOUT_CANDIDATE", message: result.rejection }, output: result });
    return { status: "failed", result };
  }

  const selection = { pageId: plan.pages[0].pageId, candidateId: chosen.id, relation: "independent", reason: "A0 调试段按首个可承载候选确定性绑定；不是模型自动选择" };
  await recorder.observe({ source: "workflow", type: "stage-call", status: "running", stage: segmentId, input: { source, plan, area, selectedCandidateId: selectedCandidateId ?? "未指定（取首个可承载候选）" } });
  const built = bindLayoutSelection(plan, measured, { pages: [selection] });
  const checked = validateGrayPlan(newRunState(source, "segment-source.md"), built.plan, area);
  const state = checked.state;
  state.deckBrief = plan.deckBrief;
  state.grayDraft = { version: "gray-segment-a0", area, sourceHash: sha(source), status: "rendering", humanReview: "pending" };
  const planOutput = { sourceHash: state.grayDraft.sourceHash, area, deckBrief: state.deckBrief, pages: state.pages };
  await fs.writeFile(path.join(output, "plan.json"), json(planOutput), "utf8");
  await fs.writeFile(path.join(output, "candidates.json"), json({ area, candidates, selected: selection, programVersion: chosen.programVersion ?? null }), "utf8");
  await fs.writeFile(path.join(output, "refusals.json"), json(refusals), "utf8");
  const result = { segmentId, status: checked.accepted ? "awaiting-user-review" : "refused", inputBoundary: "已完成分页与页面表达契约", area, candidates, selection, receipt: built.receipts[0], check: { accepted: checked.accepted, issues: checked.issues }, refusals, coverage: "实文测量、候选绑定、程序检查和灰稿编译；不证明长稿件分页、语义理解或终稿美化" };
  await fs.writeFile(path.join(output, "result.json"), json(result), "utf8");
  if (!checked.accepted) {
    await recorder.observe({ source: "workflow", type: "stage-call", status: "failed", stage: segmentId, error: { code: "GRAY_PLAN_REJECTED", message: "绑定后的计划未通过程序检查" }, output: result });
    return { status: "failed", result };
  }
  await renderGrayDraft(state, output);
  state.grayDraft.status = "awaiting-user-review";
  await fs.writeFile(path.join(output, "state.json"), json(state), "utf8");
  await recorder.observe({ source: "workflow", type: "stage-call", status: "succeeded", stage: segmentId, output: { ...result, artifacts: ["candidates.json", "result.json", "gray-draft.pptx", "preview/slide-01.png", "editable-check.json"] } });
  return { status: "awaiting-user-review", result };
}

export async function segmentArtifacts(runDir) {
  const candidates = [
    ["输入 JSON", "json", "input.json"], ["输入计划", "json", "input-plan.json"], ["候选清单", "json", "candidates.json"],
    ["绑定与检查结果", "json", "result.json"], ["拒绝边界", "json", "refusals.json"], ["灰稿可编辑 PPTX", "pptx", "gray-draft.pptx"],
    ["可编辑性检查", "json", "editable-check.json"],
  ];
  const items = [];
  for (const [label, kind, relativePath] of candidates) {
    try { await fs.access(path.join(runDir, relativePath)); items.push({ label, kind, path: relativePath }); } catch {}
  }
  let names = [];
  try { names = await fs.readdir(path.join(runDir, "preview")); } catch {}
  for (const name of names.filter(name => /^slide-\d+\.png$/i.test(name)).sort()) items.push({ label: `预览 ${name}`, kind: "image", path: `preview/${name}` });
  return items;
}
