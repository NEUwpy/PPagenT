// 生成任务的工具集。**薄**：每个 handler 只做三件事——读 state、调 state.mjs 的纯函数、写回并渲染产物。
// 业务判断全在 state.mjs 与既有模块里，这里不写任何"怎么分页""怎么排版"的逻辑。
//
// 内容阶段的工具在此文件；视觉阶段（构建与检查）的实现在同目录的 build-tools.mjs，
// 由 createGenerationTools 一并挂上。分开是因为前者纯状态、可离线测，后者要调 PPT 引擎与浏览器。

import path from "node:path";
import {
  readState, writeState, writeText, renderStateMarkdown, renderContentMarkdown,
  setDeckBrief, upsertPageBriefs, replacePageBriefs, freezeContent, validateContent, ROLES,
} from "../state.mjs";
import { ITEM_TEXT_MAX_LENGTH, fidelityLimitsText } from "../../content/source-fidelity.mjs";
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
          text: {
            type: "string", minLength: 1, maxLength: ITEM_TEXT_MAX_LENGTH,
            description: "上屏正文：在被引用来源的基础上提炼撰写。不写则退化为整段逐字来源。"
              + "里面的每一个数字与每一处引号内容都必须在被引用的来源里逐字存在，否则整批被拒。",
          },
          role: {
            type: "string", enum: ROLES,
            description: "内容项在页面里的层级角色，必须忠于原稿：object=被讨论的对象（默认）；"
              + "criterion=选择依据/判断准则；它可以是准则清单页的主体，也可以是比较页的辅助依据，不能仅凭语义标签决定位置；"
              + "step=流程中的一步，按先后顺序编号；"
              + "global=贯穿整个过程、作用于全部步骤的规则，不得被编号成其中一步。"
              + "拿不准就用 object，不要为了排版好看硬套角色。",
          },
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
          note: "sourceIds 只能引用上面列出的 ID。可以在来源基础上提炼撰写条目的 text，但不得改变原意"
            + "（rules/内容组织.md 允许改写文字、调整顺序、合并拆分，不允许改变原意）："
            + "每个数字与每处引号内容都必须在被引用的来源里逐字存在，写错整批会被拒；"
            + "不写 text 则上屏正文退化为整段逐字来源。",
          // 能力边界必须如实说：过了保真检查 ≠ 原意没被改。逐字照抄没有这个问题，改写有。
          fidelityLimits: fidelityLimitsText(),
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
      description: "增量写入正文页。每项用 sourceIds 引用来源，所有来源必须被覆盖。关系只有存在真实先后步骤才是 sequence。"
        + "可以写条目的 text 作为上屏正文，但必须忠于被引用的来源（数字与引号内容要逐字有据）；"
        + "用 role 如实标注该项在原稿里的层级（准则不是对象、全程规则不是某一步）。"
        + `保真检查查不出来的：${fidelityLimitsText()}。`,
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
