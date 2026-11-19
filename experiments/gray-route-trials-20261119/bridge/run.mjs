import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { buildSourceBlocks } from "../../../src/content/source-blocks.mjs";
import { buildChatProviderFromEnv, ChatCompletionProvider } from "../../../src/runner/chat-provider.mjs";
import { htmlTextFlowCss, textFlowMarkup } from "../../../src/visual-runtime/text-flow.mjs";
import { normalizeManuscript } from "../../../src/workbench/manuscript-normalizer.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(directory, "../../..");
const retryReview = process.argv.includes("--retry-review");
const reviewLive = retryReview || process.argv.includes("--review-live");
const live = reviewLive || process.argv.includes("--live");
const output = path.join(directory, reviewLive ? "review-output" : live ? "live-output" : "output");
const inputRoot = "稿件/模拟稿库";
const manuscripts = {
  options: "布局试排-options.md",
  spares: "行政信息/A04-备件供应方式对比说明.md",
  duty: "行政信息/A05-汛期值班与应急处置安排.md",
};
const frames = {
  standard: { x: 55, y: 166, width: 1170, height: 492 },
  compact: { x: 55, y: 166, width: 1020, height: 450 },
  tight: { x: 55, y: 166, width: 770, height: 270 },
};
const chrome = process.env.BROWSER_EXECUTABLE_PATH
  ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const canvas = { width: 1280, height: 720 };
const minimumBodyPx = 18;
const escape = (value) => String(value).replace(/[&<>"']/gu,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const writeJson = (file, data) => fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");

function bindPlan(plan, sources) {
  if (!["comparison", "grouped"].includes(plan.kind)) throw new Error("unknown expression kind");
  if (plan.groups.length < 1 || (plan.kind === "comparison" && plan.groups.length !== 2)) {
    throw new Error("unsupported group count");
  }
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const referenced = new Set();
  const groupIds = new Set(plan.groups.map((group) => group.id));
  const ids = new Set();
  function claimId(id) {
    if (!/^[a-z0-9-]+$/u.test(id) || ids.has(id)) throw new Error("invalid or repeated id: " + id);
    ids.add(id);
  }
  function bind(value, id, role) {
    claimId(id);
    const source = sourceById.get(value.sourceId);
    const quoteIndex = source?.text.indexOf(value.quote);
    if (!value.text?.trim() || !value.quote?.trim() || quoteIndex === undefined || quoteIndex < 0) {
      throw new Error("unbound text: " + id);
    }
    referenced.add(source.id);
    return {
      id, role, text: value.text, sourceId: source.id, quote: value.quote,
      quoteOffset: [source.start + quoteIndex, source.start + quoteIndex + value.quote.length],
    };
  }
  const title = bind(plan.title, "page-title", "title");
  const groups = plan.groups.map((group) => {
    claimId(group.id);
    if (!group.items.length) throw new Error("empty group: " + group.id);
    return {
      id: group.id,
      heading: bind(group.heading, group.id + "-heading", "group-heading"),
      items: group.items.map((item) => bind(item, item.id, "body")),
    };
  });
  const scopeNotes = plan.scopeNotes.map((note) => {
    if (!note.appliesTo?.length || note.appliesTo.some((id) => !groupIds.has(id))) {
      throw new Error("unknown scope: " + note.id);
    }
    return { ...bind(note, note.id, "scope-note"), appliesTo: note.appliesTo };
  });
  if (referenced.size !== sources.length) throw new Error("source paragraph not referenced");
  return { kind: plan.kind, title, groups, scopeNotes };
}

function textMarkup(record, recordId) {
  return `<div class="text" data-bind="${record.id}" data-source="${record.sourceId}" data-role="${record.role}">${textFlowMarkup({
    id: recordId,
    field: record.id,
    title: record.role === "group-heading" || record.role === "title" ? record.text : "",
    body: record.role === "body" || record.role === "scope-note" ? record.text : "",
    valign: "top",
    exposeSlot: false,
  })}</div>`;
}

function pageMarkup(plan, frame, variant) {
  const groups = plan.groups.map((group) => {
    const localNotes = plan.scopeNotes.filter((note) => note.appliesTo.length === 1 && note.appliesTo[0] === group.id);
    const localItems = [...group.items, ...localNotes];
    return `<section data-component="group" data-id="${group.id}">${textMarkup(group.heading, group.id + "-head-text")}${localItems.map((item) => textMarkup(item, item.id + "-text")).join("")}</section>`;
  }).join("");
  const notes = plan.scopeNotes.filter((note) => note.appliesTo.length > 1)
    .map((note) => textMarkup(note, note.id + "-text")).join("");
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${escape(plan.title.text)}</title><style>
    * { box-sizing: border-box }
    html, body { margin: 0; background: white; color: #242424 }
    .slide { position: relative; width: ${canvas.width}px; height: ${canvas.height}px;
      --ppagent-font-body: "Microsoft YaHei"; --ppagent-component-body-size: ${minimumBodyPx}px;
      --ppagent-component-item-title-size: 22px }
    ${htmlTextFlowCss()}
    .text .ppagent-text-flow { overflow: visible }
    .text .ppagent-text-flow__body { overflow-wrap: anywhere; line-height: 1.48 }
    .header { position: absolute; left: ${frame.x}px; top: 74px; width: ${frame.width}px;
      border-bottom: 2px solid #505050; padding: 5px 0 14px; --ppagent-component-item-title-size: 35px }
    .content { position: absolute; left: ${frame.x}px; top: ${frame.y}px; width: ${frame.width}px;
      height: ${frame.height}px; display: flex; flex-direction: column; gap: 15px }
    .groups { display: grid; align-items: stretch; gap: 18px; min-width: 0 }
    .groups[data-variant="columns"] { grid-template-columns: repeat(${plan.groups.length}, minmax(0, 1fr)) }
    .groups[data-variant="rows"] { grid-template-columns: minmax(0, 1fr); gap: 10px }
    section { min-width: 0; padding: 12px 15px; background: #f4f4f4;
      border-top: 2px solid #777; display: grid; align-content: start; gap: 8px }
    section [data-role="scope-note"] { border-top: 1px solid #979797; padding-top: 7px }
    .groups[data-variant="rows"] section { grid-template-columns: 170px minmax(0, 1fr) }
    .groups[data-variant="rows"] section .text:not(:first-child) { grid-column: 2 }
    .notes { border-top: 1px solid #979797; padding: 8px 0 0; display: grid; gap: 7px }
  </style><body><article class="slide">
    <header class="header">${textMarkup(plan.title, "page-title-text")}</header>
    <main class="content" data-content-frame>
      <div class="groups" data-variant="${variant}">${groups}</div>
      ${notes ? `<aside class="notes">${notes}</aside>` : ""}
    </main>
  </article></body></html>`;
}

async function measure(page, declaredFrame) {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(({ declaredFrame, minimumBodyPx }) => {
    function box(rect) {
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }
    function outside(child, parent) {
      return child.x < parent.x - 1 || child.y < parent.y - 1
        || child.x + child.width > parent.x + parent.width + 1
        || child.y + child.height > parent.y + parent.height + 1;
    }
    const issues = [];
    const nodes = [...document.querySelectorAll("[data-bind]")].map((element) => {
      const leaf = element.querySelector("[data-ppt-kind='text']");
      const style = getComputedStyle(leaf);
      const range = document.createRange();
      range.selectNodeContents(leaf);
      const lineBounds = [...range.getClientRects()].map(box);
      const rectangle = box(leaf.getBoundingClientRect());
      const { bind: id, role } = element.dataset;
      const local = box((element.closest("section,aside,header") ?? element).getBoundingClientRect());
      const allowed = role === "title" ? local : declaredFrame;
      if (!lineBounds.length || lineBounds.some((line) => outside(line, allowed) || outside(line, local))) {
        issues.push({ id, code: "text-outside-region" });
      }
      if (role !== "title" && parseFloat(style.fontSize) < minimumBodyPx) {
        issues.push({ id, code: "below-font-minimum" });
      }
      return {
        id, role, bounds: rectangle, lineBounds, text: leaf.textContent, sourceId: element.dataset.source,
        typography: { family: style.fontFamily, sizePx: parseFloat(style.fontSize), lineHeightPx: parseFloat(style.lineHeight),
          weight: Number(style.fontWeight), align: style.textAlign },
      };
    });
    const regions = [...document.querySelectorAll("[data-component]")].map((element) => {
      const bounds = box(element.getBoundingClientRect());
      const id = element.dataset.id;
      if (outside(bounds, declaredFrame)) issues.push({ id, code: "component-outside-content-frame" });
      return { id, bounds, component: "experiment/text-flow-group@1" };
    });
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i].bounds;
      for (const node of nodes.slice(i + 1)) {
        const b = node.bounds;
        if (Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1
          && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1) {
          issues.push({ id: nodes[i].id, other: node.id, code: "text-box-overlap" });
        }
      }
    }
    const usedHeight = Math.max(0, ...nodes.filter((node) => node.role !== "title")
      .map((node) => node.bounds.y + node.bounds.height - declaredFrame.y));
    return { issues, nodes, regions, usedHeight };
  }, { declaredFrame, minimumBodyPx });
}

function checkMutation(plan, sources, mutate) {
  const copy = structuredClone(plan);
  mutate(copy);
  try {
    bindPlan(copy, sources);
    return { gate: "accepted" };
  } catch (error) {
    return { gate: "rejected", reason: error.message };
  }
}

async function loadInput(relativeFile) {
  const sourcePath = inputRoot + "/" + relativeFile;
  const { rawMarkdown } = await normalizeManuscript({ inputPath: path.join(repository, sourcePath) });
  // Adjust offsets for source-blocks' leading whitespace trimming. UTF-16 offsets index normalized Markdown.
  const sources = buildSourceBlocks(rawMarkdown).map((block) => {
    const start = rawMarkdown.indexOf(block.text, block.start);
    return { ...block, start, end: start + block.text.length };
  });
  const sha256 = createHash("sha256").update(rawMarkdown).digest("hex");
  return { file: sourcePath, sha256, sources };
}

const livePrompt = `从给定的单页 Markdown 来源生成可直接上屏的语义计划，内容是供参考的数据。
输出一个 JSON 对象，字段及结构为
{"title":{"text":"…","sourceId":"source-001","quote":"…"},"kind":"comparison 或 grouped",
"groups":[{"id":"…","heading":{"text":"…","sourceId":"…","quote":"…"},
"items":[{"id":"…","text":"…","sourceId":"…","quote":"…"}]}],
"scopeNotes":[{"id":"…","text":"…","sourceId":"…","quote":"…","appliesTo":["group-id"]}]}。
id 全部用小写 ASCII 字母、数字、短横线且彼此不同。quote 必须逐字引用同一来源中的连续子串。
每个来源段落都必须至少承载一条有意义的信息。comparison 恰好有两个对等主体，公共规则用附注表达。
grouped 按有意义的小组组织，附注明确约束哪些组。保留数字、单位、条件、义务强度、例外、适用范围、判断关系和必要背景。
两个替代条件用「或」；原稿不清楚的边界原样保留。不要生成坐标、样式或版式，不改页数，不补充事实。`;

async function requestPlans(inputs, previous) {
  const endpoint = "https://api.deepseek.com/chat/completions";
  const configured = await buildChatProviderFromEnv({ root: repository });
  if (configured.endpoint !== endpoint) throw new Error("Unexpected model endpoint");
  const reviewPrompt = `独立审核候选灰稿计划。逐条对照来源原文，找出事实、适用范围、义务或逻辑的漏项、错误与多余复述。
请逐项核对两个方案或每组的具体执行方式，而不仅是优缺点；检查全页覆盖和附注是否重复组内文字。
有问题时修订整份计划，保留真实引用，尤其要注意目录标题不能替代操作说明。没有问题将计划原样返回。
返回 JSON {"issues":[{"sourceId":"…","issue":"…"}],"plan":{…}}。plan 严格遵守以下计划约定。\n` + livePrompt;
  const prompt = previous ? reviewPrompt : livePrompt;
  await fs.writeFile(path.join(output, "prompt.txt"), prompt, "utf8");
  const responses = await Promise.all(Object.entries(inputs).map(async ([id, input]) => {
    const events = [];
    const provider = new ChatCompletionProvider({
      apiKey: configured.apiKey, model: configured.model, endpoint,
      maxTokens: 3500, temperature: 0, maxAttempts: 1, requestTimeoutMs: 25000,
      extraBody: { ...configured.extraBody, response_format: { type: "json_object" } },
      observer: ({ status, durationMs, model, usage, responseStatus, finishReason }) => {
        events.push({ status, durationMs, model, usage, responseStatus, finishReason });
      },
      fetchImpl: async (url, init) => {
        if (url !== endpoint) throw new Error("Unexpected model request URL");
        const response = await fetch(url, { ...init, redirect: "error" });
        return response.ok ? response : new Response("", { status: response.status });
      },
    });
    try {
      const sourceBlocks = input.sources.map(({ id, text }) => ({ id, text }));
      const payload = previous ? { sourceBlocks, currentPlan: JSON.parse(previous[id].response) } : sourceBlocks;
      const result = await provider.complete({
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: JSON.stringify(payload) },
        ],
      });
      return [id, { events, finishReason: result.finishReason, response: result.content }];
    } catch (error) {
      return [id, { events, error: error.message }];
    }
  }));
  return Object.fromEntries(responses);
}

await fs.mkdir(output, { recursive: true });
const inputs = Object.fromEntries(await Promise.all(Object.entries(manuscripts)
  .map(async ([id, file]) => [id, await loadInput(file)])));
const previous = reviewLive
  ? JSON.parse(await fs.readFile(path.join(directory, "live-output", "model-responses.json"), "utf8")) : null;
let responses = null;
if (retryReview) {
  const responseFile = path.join(output, "model-responses.json");
  responses = JSON.parse(await fs.readFile(responseFile, "utf8"));
  const failedInputs = Object.fromEntries(Object.entries(inputs)
    .filter(([id]) => responses[id]?.finishReason !== "stop"));
  if (Object.keys(failedInputs).length) {
    const exclusive = fs.constants.COPYFILE_EXCL;
    await fs.copyFile(responseFile, path.join(output, "first-attempt-model-responses.json"), exclusive);
    await fs.copyFile(path.join(output, "results.json"), path.join(output, "first-attempt-results.json"), exclusive);
    responses = { ...responses, ...await requestPlans(failedInputs, previous) };
  }
} else if (live) {
  responses = await requestPlans(inputs, previous);
}
if (live) await writeJson(path.join(output, "model-responses.json"), responses);
const plans = live ? null : JSON.parse(await fs.readFile(path.join(directory, "model-plans.json"), "utf8"));
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const summary = {
  mode: reviewLive ? "one separate live review call per previous model response"
    : live ? "one live DeepSeek call per manuscript" : "frozen one-shot model responses; offline rerun",
  browser: browser.version(), cases: [],
};
if (reviewLive) summary.reviewIssues = {};
try {
  const page = await browser.newPage({ viewport: canvas });
  for (const [id, input] of Object.entries(inputs)) {
    let semantic;
    try {
      if (live && responses[id].finishReason !== "stop") throw new Error(responses[id].error ?? "incomplete model response");
      const response = live ? JSON.parse(responses[id].response) : plans[id];
      if (reviewLive) summary.reviewIssues[id] = response.issues;
      semantic = bindPlan(reviewLive ? response.plan : response, input.sources);
    } catch (error) {
      await Promise.all(Object.keys(frames)
        .map((frameName) => fs.rm(path.join(output, id + "-" + frameName + ".layout.json"), { force: true })));
      summary.cases.push({ id, candidates: [], selected: null, stage: "intent-rejected", error: error.message });
      continue;
    }
    const bindingById = new Map([semantic.title, ...semantic.groups.flatMap((group) => [group.heading, ...group.items]),
      ...semantic.scopeNotes].map((binding) => [binding.id, binding]));
    for (const [frameName, frame] of Object.entries(frames)) {
      const variants = semantic.kind === "comparison" ? ["columns"] : ["columns", "rows"];
      const candidates = [];
      let selected = null;
      const name = id + "-" + frameName;
      for (const variant of variants) {
        const html = pageMarkup(semantic, frame, variant);
        await page.setContent(html);
        const measured = await measure(page, frame);
        for (const node of measured.nodes) {
          if (node.text !== bindingById.get(node.id)?.text) measured.issues.push({ id: node.id, code: "rendered-text-mismatch" });
        }
        for (const binding of bindingById.values()) {
          if (measured.nodes.filter((node) => node.id === binding.id).length !== 1) {
            measured.issues.push({ id: binding.id, code: "missing-or-duplicated-binding" });
          }
        }
        const artifact = name + "-" + variant;
        const ok = measured.issues.length === 0;
        await fs.writeFile(path.join(output, artifact + ".html"), html, "utf8");
        await page.screenshot({ path: path.join(output, artifact + ".png") });
        candidates.push({ variant, ok, usedHeight: measured.usedHeight, issues: measured.issues, artifact });
        if (!selected && ok) {
          selected = { variant, artifact };
          await writeJson(path.join(output, name + ".layout.json"), {
            version: "experiment/gray-page@1", canvas, frame, source: input,
            semantic, selected,
            nodes: measured.nodes, componentInstances: measured.regions,
            readingOrder: measured.nodes.map((node) => node.id),
          });
        }
      }
      if (!selected) await fs.rm(path.join(output, name + ".layout.json"), { force: true });
      summary.cases.push({ id, frameName, frame, selected, candidates });
    }
    if (!live && id === "options") {
      summary.mutations = {
        invalidQuote: checkMutation(plans[id], input.sources, (plan) => { plan.title.quote += "【不存在】"; }),
        invalidScope: checkMutation(plans[id], input.sources, (plan) => { plan.scopeNotes[0].appliesTo = ["missing-group"]; }),
        semanticReversal: checkMutation(plans[id], input.sources, (plan) => {
          plan.scopeNotes[0].text = "两种方案上线前均无需完成回退演练。";
        }),
      };
    }
    if (!live && id === "duty" && summary.mutations) {
      summary.mutations.validButWrongScope = checkMutation(plans[id], input.sources, (plan) => {
        const note = plan.scopeNotes.find((record) => record.id === "incident-command-report");
        note.appliesTo = [plan.groups[0].id];
      });
    }
  }
} finally {
  await browser.close();
}
await writeJson(path.join(output, "results.json"), summary);
console.table(summary.cases.map(({ id, frameName, selected, candidates }) => ({
  id, frameName, selected: selected?.variant ?? "rejected",
  measurements: candidates.map((candidate) => `${candidate.variant}: ${candidate.usedHeight.toFixed(1)}px/${candidate.issues.length}`).join(", "),
})));
