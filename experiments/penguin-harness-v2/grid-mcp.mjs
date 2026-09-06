import fs from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { GRID, RULES, skillCatalog, upsertBriefs, replaceBriefs, validateContent, validateComposition } from "./grid-project.mjs";
import { buildGridDeck } from "./grid-native.mjs";

const root = process.env.PPAGENT_ROOT;
const runDir = process.env.PPAGENT_GRID_RUN;
const mode = process.argv.at(-1);
const projectPath = path.join(runDir, "deck-project.json");
const read = async () => JSON.parse(await fs.readFile(projectPath, "utf8"));
const write = async (project) => { const temp = `${projectPath}.tmp`; await fs.writeFile(temp, JSON.stringify(project, null, 2)); await fs.rename(temp, projectPath); };
const catalog = await skillCatalog(root);
const server = new McpServer({ name: `ppagent-grid-${mode}`, version: "0.1.0" });
// Serialize all state-changing tools even when the model emits parallel calls.
let tail = Promise.resolve();
function register(name, description, schema, fn) {
  server.registerTool(name, { description, inputSchema: schema }, (args) => {
    const pending = tail.then(async () => {
      let value;
      try { value = await fn(args); } catch (e) { value = { accepted: false, error: e.message }; }
      await fs.appendFile(path.join(runDir, "tool-events.ndjson"), `${JSON.stringify({ time: new Date().toISOString(), mode, tool: name, args, result: value })}\n`);
      return { content: [{ type: "text", text: JSON.stringify(value) }] };
    });
    tail = pending.catch(() => {}); return pending;
  });
}
const id = z.string().regex(/^[a-zA-Z0-9-]+$/).max(48);
const briefSchema = z.object({ pageId: id, title: z.string().min(1).max(30), claim: z.string().min(1).max(150), relation: z.enum(["none", "parallel", "comparison", "sequence"]), items: z.array(z.object({ id, sourceIds: z.array(id).min(1).max(6) })).min(1).max(8) });
if (mode === "content") {
  register("read_revision", "读取视觉提出的定向内容问题和相关页面。只有修订阶段需要；其他页面保持冻结。", z.object({}), async () => { const p = await read(); return { phase: p.phase, request: p.contentRevision ?? null, pages: p.pages.filter((page) => p.contentRevision?.pageIds.includes(page.pageId)) }; });
  register("replace_page_briefs", "只重组反馈指向的页面。可以合页或拆页，完整保留全部来源；其他页面及其产物保持。完成后 finish_content。", z.object({ pages: z.array(briefSchema).min(1).max(4) }), async ({ pages }) => { const p = await read(); const next = replaceBriefs(p, p.contentRevision?.pageIds ?? [], pages); await write(next); return { accepted: true, pages: next.pages.map(({ pageId, title }) => ({ pageId, title })), coverage: validateContent(next) }; });
  register("read_manuscript", "读取完整试稿及来源 ID；按信息职责自行分页，不选择版式或能力。", z.object({}), async () => ({ sources: (await read()).sources }));
  register("set_deck_brief", "保存受众、沟通目标和整套标题。", z.object({ title: z.string().min(1).max(40), audience: z.string().min(1), objective: z.string().min(1) }), async (deckBrief) => { const p = await read(); if (p.phase !== "content") throw new Error("定向修订不能更改整稿任务"); p.deckBrief = deckBrief; await write(p); return { accepted: true }; });
  register("upsert_page_briefs", "增量保存正文页，来源文本由程序绑定。一个内容项可引用多个来源段落。不同职责可分开，不照抄章节强制分页。", z.object({ pages: z.array(z.object({ pageId: id, title: z.string().min(1).max(30), claim: z.string().min(1).max(150), relation: z.enum(["none", "parallel", "comparison", "sequence"]), items: z.array(z.object({ id, sourceIds: z.array(id).min(1).max(6) })).min(1).max(8) })).min(1).max(4) }), async ({ pages }) => { const p = upsertBriefs(await read(), pages); await write(p); return { accepted: true, pages: p.pages.map((v) => ({ pageId: v.pageId, title: v.title, itemCount: v.items.length })), coverage: validateContent(p) }; });
  register("finish_content", "校验全部来源覆盖并冻结 PageBrief；成功后结束本阶段。", z.object({}), async () => { const p = await read(); if (p.phase === "content-revision" && !p.contentRevision?.applied) return { accepted: false, error: "请先完成定向内容修订" }; const report = validateContent(p); if (report.accepted) { p.phase = "visual"; p.contentValidation = report; await write(p); } return report; });
} else {
  register("request_content_revision", "当页面内容不足或无法合理承载时，提出一次相关页面重组请求。必须引用 Native 已报告的具体问题页，可带上相关邻页。宿主切换到独立内容阶段，当前视觉阶段随即停止。", z.object({ pageIds: z.array(id).min(1).max(3), reason: z.string().min(12).max(300) }), async ({ pageIds, reason }) => {
    const p = await read();
    if (p.contentRevision) return { accepted: false, error: "整稿一次内容修订预算已使用" };
    if (pageIds.some((id) => !p.pages.some((page) => page.pageId === id))) throw new Error("未知页面");
    const feedback = pageIds.flatMap((id) => p.artifactState[id]?.feedback?.issues ?? []);
    if (!feedback.some((i) => i.code === "content-underfilled" || i.code === "native-text-outside")) return { accepted: false, error: "需要先检查页面，提供可定位的内容/容量问题" };
    p.phase = "content-revision"; p.contentRevision = { pageIds, reason, feedback, applied: false }; await write(p);
    return { accepted: true, nextStage: "content", stopCurrentStage: true };
  });
  register("read_project", "读取页面内容、来源、已有方案和反馈；包含一个网格空间与有限能力摘要，无逐页版式答案。", z.object({}), async () => { const p = await read(); return { deckBrief: p.deckBrief, grid: GRID, rules: RULES, skills: catalog, pages: p.pages, state: p.artifactState }; });
  const view = z.object({ sourceItemId: id, title: z.string().max(80).default(""), body: z.string().max(300).default("") });
  const plan = z.object({ pageId: id, alignment: z.enum(["left", "center"]), rationale: z.string().min(1).max(240), regions: z.array(z.object({ id, x: z.number().int(), y: z.number().int(), w: z.number().int(), h: z.number().int(), skillId: z.enum(["text/basic", "sequence-flow-001"]), view: z.array(view).min(1).max(8) })).min(1).max(6) });
  register("upsert_page_compositions", "保存区域与上屏文案；view.title/body 必须逐字取自该 sourceItemId 的 sourceText，完整原文保留在备注。区域坐标 24×12，数值错误返回精确诊断；不缩字。每页最多四个方案版本。", z.object({ pages: z.array(plan).min(1).max(4) }), async ({ pages }) => {
    const p = await read();
    if (p.phase !== "visual") throw new Error("当前不是视觉阶段");
    const reports = [];
    for (const incoming of pages) {
      const page = p.pages.find((v) => v.pageId === incoming.pageId);
      if (!page) { reports.push({ pageId: incoming.pageId, accepted: false, issues: [{ code: "unknown-page" }] }); continue; }
      if ((page.compositionRevision ?? 0) >= 4) { reports.push({ pageId: page.pageId, accepted: false, issues: [{ code: "page-revision-budget" }] }); continue; }
      const validation = validateComposition(page, incoming, catalog);
      page.composition = incoming; page.compositionRevision = (page.compositionRevision ?? 0) + 1;
      p.artifactState[page.pageId] = { status: "dirty", revision: page.compositionRevision, validation };
      reports.push(validation);
    }
    await write(p); return { accepted: reports.every((r) => r.accepted), reports };
  });
  register("check_pages", "生成所选页面的原生 PPT 并读取真实文字布局，返回对齐、越界、密度热图和最大空区；无图片发送。只检查修改页，已通过同版本复用结果。", z.object({ pageIds: z.array(id).min(1).max(6) }), async ({ pageIds }) => {
    const p = await read(), reports = [];
    for (const pageId of pageIds) {
      const page = p.pages.find((v) => v.pageId === pageId);
      if (!page?.composition) { reports.push({ pageId, accepted: false, issues: [{ code: "missing-composition" }] }); continue; }
      const state = p.artifactState[pageId];
      if (state?.status === "passed" && state.revision === page.compositionRevision) { reports.push({ ...state.feedback, reused: true }); continue; }
      const validation = validateComposition(page, page.composition, catalog);
      if (!validation.accepted) { reports.push(validation); continue; }
      try {
        const artifact = await buildGridDeck(root, p, [pageId], path.join(runDir, "pages", pageId, `revision-${page.compositionRevision}`));
        const feedback = artifact.feedback[0];
        p.artifactState[pageId] = { status: feedback.accepted ? "passed" : "failed", revision: page.compositionRevision, pptxPath: artifact.pptxPath, feedback };
        reports.push(feedback);
      } catch (e) {
        const feedback = { pageId, accepted: false, issues: [{ code: "native-build-failed", message: e.message }] };
        p.artifactState[pageId] = { status: "failed", revision: page.compositionRevision, feedback }; reports.push(feedback);
        if (/未找到 Edge|ENOENT|Cannot find|browser.*closed|Executable/i.test(e.message)) {
          p.runtimeFailure = { pageId, message: e.message, recovery: "修复宿主环境后 --resume true；不让模型修改页面以补偿依赖失败。" };
          await write(p); break;
        }
      }
      await write(p);
    }
    return { accepted: reports.every((r) => r.accepted), reports };
  });
  register("finish_visual", "确认所有当前版本页面已完成 Native 检查；对留白/密度等经验提示解释接受原因，或先修正。成功后立即停止。", z.object({ warningDecisions: z.array(z.object({ pageId: id, reason: z.string().min(12).max(240) })).max(12).default([]) }), async ({ warningDecisions }) => {
    const p = await read();
    const pending = p.pages.filter((page) => p.artifactState[page.pageId]?.status !== "passed" || p.artifactState[page.pageId]?.revision !== page.compositionRevision).map((v) => v.pageId);
    const unexplained = p.pages.filter((page) => p.artifactState[page.pageId]?.feedback?.warnings?.length && !warningDecisions.some((d) => d.pageId === page.pageId)).map((v) => v.pageId);
    if (pending.length || unexplained.length) return { accepted: false, pending, warningsNeedReason: unexplained };
    p.phase = "ready"; p.warningDecisions = warningDecisions; await write(p);
    return { accepted: true, pageCount: p.pages.length, note: "无图片反馈通过；经验提示理由是 Agent 判断，不是自动审美认证。" };
  });
}
serveStdio(() => server, { onerror: (e) => process.stderr.write(`${e.message}\n`) });
