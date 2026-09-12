// 生成任务的工具集。**薄**：每个 handler 只做三件事——读 state、调 state.mjs 的纯函数、写回并渲染产物。
// 业务判断全在 state.mjs 与既有模块里，这里不写任何"怎么分页""怎么排版"的逻辑。
//
// 内容阶段的工具在此文件；视觉阶段（构建与检查）的实现在同目录的 build-tools.mjs，
// 由 createGenerationTools 一并挂上。分开是因为前者纯状态、可离线测，后者要调 PPT 引擎与浏览器。

import path from "node:path";
import {
  readState, writeState, writeText, renderStateMarkdown, renderContentMarkdown,
  setDeckBrief, upsertPageBriefs, replacePageBriefs, freezeContent, validateContent,
} from "../state.mjs";
import { defineTool } from "./index.mjs";

/**
 * 统一的提交口：读 → 纯函数改 → 原子写 → 渲染两份可读产物。
 * state.md 与 content.md 都在这里重新渲染，保证它们永远与 state.json 一致，
 * 不会出现"改了 state.json 忘了更新 md"这种两份真源才会有的漂移。
 */
export function createCommitter({ statePath }) {
  const render = async (state) => {
    await writeState(statePath, state);
    await writeText(path.join(path.dirname(statePath), "state.md"), renderStateMarkdown(state));
    await writeText(path.join(path.dirname(statePath), "content.md"), renderContentMarkdown(state));
  };
  return {
    read: () => readState(statePath),
    /** mutator 收到当前状态，返回新状态；抛出的错误会变成工具的 {accepted:false}，不落地任何修改。 */
    async commit(mutator) {
      const current = await readState(statePath);
      const next = await mutator(current);
      await render(next);
      return next;
    },
    render,
  };
}

const pageSchema = {
  type: "object",
  properties: {
    pageId: { type: "string", pattern: "^[A-Za-z0-9-]{1,48}$", description: "稳定页面标识，如 p1" },
    title: { type: "string", minLength: 1, maxLength: 30 },
    claim: { type: "string", minLength: 1, maxLength: 150, description: "这一页要说的那一句话" },
    relation: { type: "string", enum: ["none", "parallel", "comparison", "sequence"], description: "仅当内容有真实先后步骤时才用 sequence；比较不等于流程" },
    items: {
      type: "array", minItems: 1, maxItems: 8,
      items: {
        type: "object",
        properties: {
          id: { type: "string", pattern: "^[A-Za-z0-9-]{1,48}$" },
          sourceIds: { type: "array", minItems: 1, maxItems: 6, items: { type: "string" } },
        },
        required: ["id", "sourceIds"],
        additionalProperties: false,
      },
    },
  },
  required: ["pageId", "title", "claim", "relation", "items"],
  additionalProperties: false,
};

export function contentTools({ committer }) {
  return [
    defineTool({
      name: "read_manuscript",
      description: "读取整份试稿与来源 ID。按信息职责自行分页，不选择版式、不调用结构能力。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      handler: async () => {
        const state = await committer.read();
        return {
          accepted: true,
          phase: state.phase,
          sourcePath: state.sourcePath,
          deckBrief: state.deckBrief,
          sources: state.sources.map((source) => ({ id: source.id, heading: source.heading, text: source.text })),
          note: "sourceIds 只能引用上面列出的 ID；正文由程序从原稿逐字回填，你不要自己改写或缩写正文。",
        };
      },
    }),
    defineTool({
      name: "set_deck_brief",
      description: "保存受众、沟通目标与整套标题。必须在写页面之前调用。",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 40 },
          audience: { type: "string", minLength: 1, maxLength: 80 },
          objective: { type: "string", minLength: 1, maxLength: 200 },
        },
        required: ["title", "audience", "objective"],
        additionalProperties: false,
      },
      handler: async (deckBrief) => {
        await committer.commit((state) => setDeckBrief(state, deckBrief));
        return { accepted: true, deckBrief };
      },
    }),
    defineTool({
      name: "upsert_page_briefs",
      description: "增量写入正文页。每项用 sourceIds 引用来源，所有来源必须被覆盖。关系只有存在真实先后步骤才是 sequence。",
      inputSchema: {
        type: "object",
        properties: { pages: { type: "array", minItems: 1, maxItems: 4, items: pageSchema } },
        required: ["pages"],
        additionalProperties: false,
      },
      handler: async ({ pages }) => {
        const state = await committer.commit((current) => upsertPageBriefs(current, pages));
        return {
          accepted: true,
          pages: state.pages.map((page) => ({ pageId: page.pageId, title: page.title, itemCount: page.items.length })),
          coverage: validateContent(state),
        };
      },
    }),
    defineTool({
      name: "replace_page_briefs",
      description: "定向内容重组：只重组修订请求指向的页面，可以合页或拆页，但必须完整保留这些页的全部来源，且不得引入其他页的来源。",
      inputSchema: {
        type: "object",
        properties: { pages: { type: "array", minItems: 1, maxItems: 4, items: pageSchema } },
        required: ["pages"],
        additionalProperties: false,
      },
      handler: async ({ pages }) => {
        const state = await committer.commit((current) => replacePageBriefs(current, current.contentRevision?.pageIds ?? [], pages));
        return { accepted: true, pages: state.pages.map((page) => ({ pageId: page.pageId, title: page.title })), coverage: validateContent(state) };
      },
    }),
    defineTool({
      name: "finish_content",
      description: "校验全部来源覆盖并冻结内容。来源有遗漏时会被拒绝，不要用省略、改写或添加来源的方式绕过。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      handler: async () => {
        const current = await committer.read();
        if (current.phase === "content-revision" && !current.contentRevision?.applied) {
          return { accepted: false, error: "还有未完成的定向内容修订，请先 replace_page_briefs" };
        }
        // 先算出报告再决定是否写盘：被拒时 state.json 必须原样不动。
        const outcome = freezeContent(current);
        if (outcome.report.accepted) await committer.render(outcome.state);
        return outcome.report;
      },
    }),
  ];
}
