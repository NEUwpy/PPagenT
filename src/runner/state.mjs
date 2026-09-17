// 运行器的机器状态。**纯核**：本文件不联网、不启动浏览器、不构建 PPTX，因此可离线测。
// 分层照抄 experiments/penguin-harness-v2/grid-project.mjs（纯核）与 grid-native.mjs（重依赖）——
// 那套分层已被 6 个测试验证过。重依赖一律留在 tools/ 里，不要挪进来。
//
// 状态归属（与 harness/运行流程.md 一致）：
//   state.json 是唯一可编辑真源；state.md 由 renderStateMarkdown() 从它渲染出来供人与模型阅读。
//   不允许出现两份都能手改的真源——改状态只能改 state.json。

import fs from "node:fs/promises";
import path from "node:path";
import { checkItemFidelity, describeFidelityIssues, fidelityLimitsText } from "../content/source-fidelity.mjs";

export const SCHEMA_VERSION = "ppagent-run-1";
export const PHASES = Object.freeze(["content", "content-revision", "visual", "ready"]);
/** 单页方案版本上限。取 4 是实验里已验证够用且能收敛的值，不是随手定的。 */
export const MAX_COMPOSITION_REVISIONS = 4;
export const RELATIONS = Object.freeze(["none", "parallel", "comparison", "sequence"]);
/**
 * 内容项在页面里的**层级角色**。它回答的是"这一项在原稿里处于哪一层"，不是版式选择：
 *   object    被讨论的对象（默认，缺省即此）
 *   criterion 选择依据 / 判断准则——它是**判断的尺子**，不是被比较的第 N 个对象
 *   step      流程中的一步，按先后顺序编号
 *   global    贯穿整个过程、作用于全部步骤的规则——它不是"第 N 步"
 * R1 首版把准则画成第三张并列卡片、把 global 编号成第四步，问题就出在这里没有表达能力。
 */
export const ROLES = Object.freeze(["object", "criterion", "step", "global"]);

/**
 * 稿件 → 来源项。标题行只作为分组信息，不单独成为来源，避免"章节名被当成一条内容"。
 *
 * **按行解析，不按块解析。** 曾经按「空行分块」切、块首是 `#` 就把**整块**当标题吞掉：
 * `# 标题\n正文`（标题与正文之间没有空行）是合法 Markdown，正文会静默消失，
 * 来源凭空少一条，而下游只会报"来源未覆盖"——看不出是解析把正文吃了。
 * 现在行首匹配 `#`+空白才更新 heading，其余行照常累积成段；空行分段。
 * 产出的 `{ id: "s" + (n+1), heading, text }` 与 `s1..sN` 的 ID/顺序契约不变。
 */
export function splitSources(raw) {
  let heading = "";
  const blocks = [];
  let lines = [];
  const flush = () => {
    const text = lines.join("\n").trim();
    lines = [];
    if (text) blocks.push({ heading, text });
  };
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) { flush(); continue; }
    // 照 CommonMark：`#` 后必须有空白才算标题，所以 `#1 优先级` 是正文不是标题。
    const titleMatch = line.match(/^#{1,6}(?:[ \t]+(.*\S))?[ \t]*$/u);
    if (titleMatch) {
      flush();
      heading = titleMatch[1] ?? "";
      continue;
    }
    lines.push(line);
  }
  flush();
  return blocks.map((source, index) => ({ id: `s${index + 1}`, ...source }));
}

export function newRunState(raw, sourcePath) {
  return {
    schemaVersion: SCHEMA_VERSION,
    sourcePath,
    sources: splitSources(raw),
    deckBrief: null,
    pages: [],
    artifactState: {},
    phase: "content",
    contentRevision: null,
    runtimeFailure: null,
    warningDecisions: [],
  };
}

function requirePhase(state, phase, action) {
  if (state.phase !== phase) throw new Error(`${action} 只在 ${phase} 阶段可用；当前阶段是 ${state.phase}`);
}

/**
 * content-revision 不是一个独立阶段，它是 **content 阶段的第二趟**：定向修订改完页面简报后
 * 仍要回到同一套冻结逻辑。参照实现就是这么分派的（`experiments/penguin-harness-v2/run-grid.mjs:70`
 * 在 phase 为 content 或 content-revision 时都跑 content 阶段），移植时丢了这一层，
 * 导致 freezeContent 只认 content、运行一进 content-revision 就再也出不来。
 *
 * 只放宽"冻结"这一处。upsertPageBriefs 仍然只认 content —— 否则模型能在修订阶段自由改写页面，
 * 绕开 replacePageBriefs 的来源集合守恒校验。
 */
function requireContentStage(state, action) {
  if (!["content", "content-revision"].includes(state.phase)) {
    throw new Error(`${action} 只在 content 阶段可用；当前阶段是 ${state.phase}`);
  }
}

export function setDeckBrief(state, deckBrief) {
  requirePhase(state, "content", "设置整稿任务");
  return { ...state, deckBrief };
}

/**
 * 增量写入页面简报。**两种正文并存**：
 *   - `sourceText`：程序按 sourceIds 从稿件回填的逐字并集。它是**证据**，模型不能自报，永不改写。
 *   - `text`：模型在来源基础上提炼撰写的上屏文本（可选）。缺省则渲染回退到 sourceText。
 *
 * 允许撰写不等于可以乱写：`text` 一律过 `checkItemFidelity`，不过就整批拒绝（与其余校验同形的失败关闭）。
 * 只引用来源 ID 已经不够了——改写之后，"来源引对了"不再蕴含"意思没变"。
 *
 * 页面内容一变，该页的产物状态立即失效（不是标记 dirty 后由谁记得清理，而是直接删）。
 */
export function upsertPageBriefs(state, pages) {
  requirePhase(state, "content", "写入页面简报");
  const next = structuredClone(state);
  const sourceById = new Map(next.sources.map((source) => [source.id, source]));
  for (const page of pages) {
    const itemIds = new Set();
    if (!RELATIONS.includes(page.relation)) throw new Error(`未知关系 ${page.relation}`);
    for (const item of page.items) {
      if (itemIds.has(item.id)) throw new Error(`重复内容项 ${item.id}`);
      itemIds.add(item.id);
      if (!item.sourceIds?.length) throw new Error(`内容项 ${item.id} 没有来源`);
      if (item.role !== undefined && !ROLES.includes(item.role)) throw new Error(`内容项 ${item.id} 的角色 ${item.role} 未知`);
      const unknown = item.sourceIds.filter((id) => !sourceById.has(id));
      if (unknown.length) throw new Error(`内容项 ${item.id} 引用了未知来源 ${unknown.join("、")}`);
      item.sourceText = item.sourceIds.map((id) => sourceById.get(id).text).join("\n");
      const fidelity = checkItemFidelity({ text: item.text, sourceText: item.sourceText });
      if (!fidelity.accepted) {
        throw new Error(`内容项 ${item.id} 没有通过保真检查：${describeFidelityIssues(fidelity.issues)}`);
      }
    }
    const index = next.pages.findIndex((existing) => existing.pageId === page.pageId);
    const value = { ...structuredClone(page), revision: (next.pages[index]?.revision ?? 0) + 1 };
    if (index < 0) next.pages.push(value);
    else next.pages[index] = value;
    delete next.artifactState[page.pageId];
  }
  return next;
}

/** 来源覆盖检查。accepted 只证明"每条来源都被引用"，不证明分页、标题或结论正确。 */
export function validateContent(state) {
  const used = new Set(state.pages.flatMap((page) => page.items.flatMap((item) => item.sourceIds)));
  const missing = state.sources.filter((source) => !used.has(source.id)).map((source) => source.id);
  const issues = [];
  if (!state.deckBrief || !state.pages.length) issues.push({ code: "missing-deck-or-pages" });
  if (missing.length) issues.push({ code: "missing-source-coverage", sourceIds: missing });
  return {
    accepted: issues.length === 0,
    issues,
    pageCount: state.pages.length,
    sourceCoverage: { used: used.size, total: state.sources.length },
    semanticLimit: "来源覆盖不自动证明分页、标题或结论正确，仍需人工核对。",
  };
}

/**
 * 定向内容重组。守恒条件：目标页的来源集合必须**完全相等**（不丢、不增），
 * 且未涉及的页面与其产物原样保留。参考实现里这条是硬校验，照抄。
 */
export function replacePageBriefs(state, targetPageIds, incoming) {
  requirePhase(state, "content-revision", "定向内容重组");
  if (!incoming.length) throw new Error("修订不能删除全部内容");
  const targets = state.pages.filter((page) => targetPageIds.includes(page.pageId));
  if (targets.length !== targetPageIds.length) throw new Error("修订请求包含未知页面");
  const expected = new Set(targets.flatMap((page) => page.items.flatMap((item) => item.sourceIds)));
  const actual = new Set(incoming.flatMap((page) => page.items.flatMap((item) => item.sourceIds)));
  if (expected.size !== actual.size || [...expected].some((id) => !actual.has(id))) {
    throw new Error("定向修订必须保留目标页的全部来源，且不得引入其他页的来源");
  }
  const retained = state.pages.filter((page) => !targetPageIds.includes(page.pageId));
  if (new Set(incoming.map((page) => page.pageId)).size !== incoming.length) throw new Error("修订 pageId 重复");
  if (incoming.some((page) => retained.some((kept) => kept.pageId === page.pageId))) throw new Error("修订 pageId 与保留页冲突");

  const rebuilt = upsertPageBriefs({ ...structuredClone(state), phase: "content", pages: [], artifactState: {} }, incoming);
  const next = structuredClone(state);
  const first = state.pages.findIndex((page) => targetPageIds.includes(page.pageId));
  next.pages = [...retained.slice(0, first), ...rebuilt.pages, ...retained.slice(first)];
  for (const pageId of targetPageIds) delete next.artifactState[pageId];
  next.contentRevision = { ...state.contentRevision, applied: true };
  return next;
}

/** 冻结内容阶段。有遗漏来源时拒绝并原样返回诊断——不自动补齐、不降级放行。 */
export function freezeContent(state) {
  requireContentStage(state, "冻结内容");
  if (state.contentRevision && !state.contentRevision.applied) {
    return { state, report: { accepted: false, issues: [{ code: "content-revision-pending" }] } };
  }
  const report = validateContent(state);
  if (!report.accepted) return { state, report };
  return { state: { ...state, phase: "visual", contentValidation: report }, report };
}

/** 写入/覆盖某页方案。校验失败也记录 revision——否则模型可以靠反复提交无效方案绕过版本预算。 */
export function upsertComposition(state, pageId, composition, validation) {
  requirePhase(state, "visual", "写入页面方案");
  const next = structuredClone(state);
  const page = next.pages.find((candidate) => candidate.pageId === pageId);
  if (!page) throw new Error(`未知页面 ${pageId}`);
  const revision = (page.compositionRevision ?? 0) + 1;
  if (revision > MAX_COMPOSITION_REVISIONS) throw new Error(`页面 ${pageId} 已达到 ${MAX_COMPOSITION_REVISIONS} 次方案上限`);
  page.composition = composition;
  page.compositionRevision = revision;
  delete next.artifactState[pageId];
  // 方案一改，上一次的整套审计就不再描述当前这副牌组了，跟着作废。
  delete next.deckAudit;
  return { state: next, report: { ...validation, pageId, revision } };
}

/**
 * 产物状态是否可复用。复用键是 (status, revision)——只有"检查通过"且"版本未变"才复用。
 * 这一条是"修订只重做受影响页"的实现基础，不要退化成按 pageId 缓存。
 */
export function artifactReusable(state, pageId) {
  const page = state.pages.find((candidate) => candidate.pageId === pageId);
  const artifact = state.artifactState[pageId];
  return {
    reusable: artifact?.status === "passed" && artifact.revision === page?.compositionRevision,
    artifact,
    revision: page?.compositionRevision,
  };
}

export function recordArtifact(state, pageId, { status, revision, feedback, pptxPath = null }) {
  const next = structuredClone(state);
  next.artifactState[pageId] = { status, revision, feedback, pptxPath };
  return next;
}

/**
 * 整套审计的结论。**逐页通过不等于整副牌组通过**：check_pages 只对请求到的页记账，
 * 而封面（slide-01）的违规不归任何正文页——只有这一个字段能拦住它。
 * 因此 finishVisual 要求它必须存在且为 passed（缺了就拒绝，不默认放行）。
 */
export function recordDeckAudit(state, { status, qaDir = null }) {
  const next = structuredClone(state);
  next.deckAudit = { status, qaDir, checkedAt: new Date().toISOString() };
  return next;
}

/**
 * 宿主依赖失败（缺浏览器、缺引擎等）→ 记 runtimeFailure 并**停止**。
 * 刻意不把这类失败交给模型：模型既修不了浏览器，又会在"看起来是页面问题"的假象下乱改内容。
 * 参考实现 grid-mcp.mjs:84-87 处理过一次真实事故，照抄其判定。
 */
export function recordRuntimeFailure(state, { pageId = null, message }) {
  const next = structuredClone(state);
  next.runtimeFailure = {
    pageId,
    message,
    recovery: "修复宿主环境后 --resume 续跑；不要为了绕过依赖失败而修改页面内容。",
  };
  return next;
}

export function looksLikeRuntimeFailure(message) {
  return /未找到 Edge|未找到 Chrome|ENOENT|Cannot find|browser.*closed|Executable|PPT 引擎不可用/i.test(String(message));
}

export function requestContentRevision(state, { pageIds, reason }) {
  requirePhase(state, "visual", "请求内容修订");
  if (state.contentRevision) throw new Error("整稿只有一次内容修订预算，已用过");
  const unknown = pageIds.filter((id) => !state.pages.some((page) => page.pageId === id));
  if (unknown.length) throw new Error(`未知页面 ${unknown.join("、")}`);
  const feedback = pageIds.flatMap((id) => state.artifactState[id]?.feedback?.issues ?? []);
  return {
    state: { ...structuredClone(state), phase: "content-revision", contentRevision: { pageIds, reason, feedback, applied: false } },
    feedback,
  };
}

/**
 * 收尾闸门：所有页面都必须"当前版本已通过"，**且整套审计必须存在并通过**。
 * 经验提示（warnings）不阻断，但必须逐页给出理由。
 *
 * 整套那一关不可省：逐页记账只覆盖 check_pages 请求到的页，封面违规不归任何一页。
 * 缺记录也拒绝（失败关闭）——没调过 check_pages 就进 ready，等于绕过审计。
 */
export function finishVisual(state, warningDecisions = []) {
  requirePhase(state, "visual", "结束视觉阶段");
  const pending = state.pages
    .filter((page) => !artifactReusable(state, page.pageId).reusable)
    .map((page) => page.pageId);
  const unexplained = state.pages
    .filter((page) => state.artifactState[page.pageId]?.feedback?.warnings?.length
      && !warningDecisions.some((decision) => decision.pageId === page.pageId))
    .map((page) => page.pageId);
  if (pending.length || unexplained.length) {
    return { state, report: { accepted: false, pending, warningsNeedReason: unexplained } };
  }
  const deckAudit = state.deckAudit ?? null;
  if (deckAudit?.status !== "passed") {
    return {
      state,
      report: {
        accepted: false,
        pending: [],
        warningsNeedReason: [],
        deckAudit,
        issues: [{ code: deckAudit ? "deck-audit-failed" : "deck-audit-missing" }],
        note: deckAudit
          ? "整副牌组没有通过确定性质量审计：逐页也许都过了，但封面等不计入正文页的幻灯片仍可能违规。先修好再调用 check_pages。"
          : "本运行还没有整套审计记录（没调用过 check_pages），不能进入 ready。",
      },
    };
  }
  return {
    state: { ...structuredClone(state), phase: "ready", warningDecisions },
    report: { accepted: true, pageCount: state.pages.length, note: "无图片反馈通过；经验提示理由是 Agent 判断，不是自动审美认证。" },
  };
}

// —— 以下为落盘与渲染。纯核函数不依赖它们，测试可直接测上面的部分。——

export async function readState(statePath) {
  return JSON.parse(await fs.readFile(statePath, "utf8"));
}

/**
 * rename 有界重试：Windows 上临时文件改名可能撞锁（EPERM/EBUSY/EACCES——读进程、杀软、索引服务），
 * 有限次重试 + 短退避后仍失败才抛出；不做复杂锁机制（评审 #8 批准范围）。rename 可注入，便于测试。
 */
export async function renameWithRetry(temp, target, { rename = fs.rename, attempts = 5, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await rename(temp, target);
    } catch (error) {
      const retryable = ['EPERM', 'EBUSY', 'EACCES'].includes(error?.code);
      if (!retryable || attempt >= attempts) throw error;
      await sleep(40 * attempt);
    }
  }
}

/** 原子写：先写同目录临时文件再 rename。state.json 是唯一真源，半截文件比崩溃更糟。 */
async function writeAtomic(target, text) {
  const temp = `${target}.tmp`;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(temp, text);
  await renameWithRetry(temp, target);
}

export async function writeState(statePath, state) {
  await writeAtomic(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

/**
 * 写纯文本（state.md / content.md）。**不要用 writeState 写这两个文件**——
 * 它做 JSON.stringify，会把整份 Markdown 变成一个带引号、\n 转义的 JSON 字符串。
 * 这个错误发生过一次，所以单独留一个函数和一条测试。
 */
export async function writeText(target, text) {
  await writeAtomic(target, text);
}

/** 下一步做什么由阶段决定，不靠人猜。中断位置同理——它们都是渲染出来的，不是另记的一份。 */
export const NEXT_STEP = Object.freeze({
  content: "继续按信息职责分页，写完调用 finish_content 冻结内容。",
  "content-revision": "只重组请求中列出的页面，来源集合必须完全保留，然后 finish_content。",
  visual: "继续编排页面并用 check_pages 做真实构建检查，全部当前版本通过后 finish_visual。",
  ready: "阶段已完成；可用 --replay 零模型重新编译交付物。",
});

/**
 * content.md：一级标题为页面，内容块有稳定 ID 并标注来源（harness/runs/README.md:6 的约定）。
 * 同样由 state.json 渲染。
 *
 * 每个内容块**两份正文都列出来**，它们是两件不同的事：
 *   - 「上屏」是模型在被引用来源基础上提炼撰写、真正会出现在幻灯片上的文本；
 *   - 「逐字来源」是程序按 sourceIds 从原稿回填的证据，模型改不动它，保真检查就是拿它比对的。
 * 只列上屏稿，读者无从判断提炼有没有走样；只列逐字稿，读者又看不到实际交付的文本。
 * 两者都不是"可手改的真源"——真源始终只有 state.json。
 */
export function renderContentMarkdown(state) {
  const lines = [
    "<!-- 本文件由运行器从 state.json 渲染，不要直接编辑。 -->",
    "<!-- 每项列两份正文：上屏稿由模型提炼撰写，逐字来源由程序从原稿回填、是保真检查的比对证据。 -->",
    "",
  ];
  if (!state.pages.length) lines.push("（尚无页面）", "");
  for (const page of state.pages) {
    lines.push(`# ${page.pageId} ${page.title}`, "");
    lines.push(`> 主张：${page.claim} ｜ 关系：${page.semantics?.narrative ?? page.relation} ｜ 版本：${page.revision}`, "");
    for (const item of page.items) {
      const contentRole = item.semanticRole ?? item.role;
      const role = contentRole && contentRole !== "object" ? ` ｜ 角色：${contentRole}` : "";
      lines.push(`## ${item.id}`, "", `<!-- 来源：${item.sourceIds.join("、")}${role} -->`, "");
      lines.push(`**上屏**：${item.text ?? "（未提炼，回退逐字来源）"}`, "");
      lines.push(`**逐字来源**：`, "", item.sourceText, "");
    }
  }
  return `${lines.join("\n")}\n`;
}

export function renderStateMarkdown(state) {
  const lines = [
    "<!-- 本文件由运行器从 state.json 渲染，不要直接编辑；要改状态请改 state.json。 -->",
    "",
    `# 运行状态：${state.deckBrief?.title ?? "（未命名）"}`,
    "",
    `- 阶段：\`${state.phase}\``,
    `- 原稿：\`${state.sourcePath}\``,
    `- 来源：${state.sources.length} 条`,
    `- 下一步：${NEXT_STEP[state.phase] ?? "（未知阶段）"}`,
  ];
  if (state.lastStop) {
    lines.push(`- 上次中断：\`${state.lastStop.reason}\`${state.lastStop.at ? `（${state.lastStop.at}）` : ""}`);
  }
  if (state.deckBrief) {
    lines.push(`- 受众：${state.deckBrief.audience}`, `- 目标：${state.deckBrief.objective}`);
  }
  if (state.runtimeFailure) {
    lines.push("", `> ⚠️ 宿主依赖失败，运行已停止：${state.runtimeFailure.message}`, `> 恢复方式：${state.runtimeFailure.recovery}`);
  }
  const coverage = validateContent(state);
  lines.push("", "## 来源覆盖", "", coverage.accepted ? "全部来源已被引用。" : `未覆盖：${coverage.issues.find((issue) => issue.code === "missing-source-coverage")?.sourceIds?.join("、") ?? "（尚无页面）"}`);
  if (state.contentRevision) {
    lines.push("", `## 内容修订（${state.contentRevision.applied ? "已应用" : "未应用"}）`, "", `- 目标页：${state.contentRevision.pageIds.join("、")}`, `- 理由：${state.contentRevision.reason}`);
  }
  lines.push("", "## 页面", "");
  if (!state.pages.length) lines.push("（尚无页面）");
  for (const page of state.pages) {
    const artifact = state.artifactState[page.pageId];
    const status = artifact ? `产物 ${artifact.status}（版本 ${artifact.revision}）` : "无产物";
    lines.push(
      `### ${page.pageId} ${page.title}`,
      "",
      `- 主张：${page.claim}`,
      `- 关系：${page.semantics?.narrative ?? page.relation}`,
      `- 内容项：${page.items.length}；来源：${page.items.flatMap((item) => item.sourceIds).join("、")}`,
      `- 方案版本：${page.compositionRevision ?? 0}；${status}`,
    );
    const issues = artifact?.feedback?.issues ?? [];
    if (issues.length) lines.push(`- 未解决问题：${issues.map((issue) => issue.code).join("、")}`);
    const warnings = artifact?.feedback?.warnings ?? [];
    if (warnings.length) lines.push(`- 经验提示：${warnings.map((warning) => warning.code).join("、")}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
