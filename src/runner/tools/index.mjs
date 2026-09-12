// 工具注册表。**薄**：这里只做四件事——登记、校验入参、派发、记账。不含任何业务逻辑。
// 业务逻辑在被调用的现有模块里（src/render、src/runtime、src/asset-runtime 等），不要搬进来。
//
// 两条来自参考实现（experiments/penguin-harness-v2/grid-mcp.mjs）的机制，照抄：
//   1. 工具异常一律转成 {accepted:false, error}，绝不抛穿到循环——模型需要看到可读原因才能自纠，
//      而抛异常会让整轮对话死掉、丢掉已经写下的状态。
//   2. 状态变更工具串行化（tail 链）。模型可以一次发多个 tool_calls，并行写同一份 state.json
//      会互相覆盖。参考实现里这条是显式加上的，不是默认行为。
//
// 与参考实现的一处**刻意不同**：不用 MCP。那边走 stdio 子进程是因为循环在 penguin-core 里、
// 模型只能经 MCP 触达工具；循环归自己之后工具就是进程内函数，省掉子进程、串行化和
// Windows 环境变量白名单透传（那正是 GRID-RESULTS.md 里那次事故的根因）。

import fs from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

/** 单条工具结果的序列化上限。超过就截断并在结果里显式标注——绝不静默截断。 */
export const TOOL_RESULT_LIMIT = 40000;

const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function defineTool({ name, description, inputSchema, handler }) {
  if (!NAME_PATTERN.test(name ?? "")) throw new Error(`工具名不合法：${name}`);
  if (!description) throw new Error(`工具 ${name} 缺少说明`);
  if (inputSchema?.type !== "object") throw new Error(`工具 ${name} 的 inputSchema 必须是 object`);
  if (typeof handler !== "function") throw new Error(`工具 ${name} 缺少 handler`);
  return { name, description, inputSchema, handler };
}

/**
 * inputSchema 一次定义两用：既转成发给模型的 tools[].function.parameters，
 * 也编译成 ajv 校验器校验模型实际传来的入参。这正是选 JSON Schema 而不是 zod 的原因——
 * 它本身就是 API 要的格式，不必再加一层转换，也不必新增依赖（ajv 已是根仓库依赖）。
 */
export function createToolRegistry({ tools, runDir, limit = TOOL_RESULT_LIMIT }) {
  const seen = new Set();
  for (const tool of tools) {
    if (seen.has(tool.name)) throw new Error(`工具名重复：${tool.name}`);
    seen.add(tool.name);
  }
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const validate = new Map(tools.map((tool) => [tool.name, ajv.compile(tool.inputSchema)]));
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const eventsPath = path.join(runDir, "tool-events.ndjson");

  // 串行化：并行 tool_calls 不得并发写状态。
  let tail = Promise.resolve();

  async function invoke(name, args) {
    const tool = byName.get(name);
    if (!tool) return { accepted: false, error: `未知工具 ${name}；可用工具：${[...seen].join("、")}` };
    const check = validate.get(name);
    if (!check(args)) {
      const details = (check.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message}`).join("；");
      return { accepted: false, error: `工具 ${name} 的入参不符合 schema：${details}` };
    }
    try {
      return await tool.handler(args);
    } catch (error) {
      return { accepted: false, error: error?.message ?? String(error) };
    }
  }

  async function record(name, args, result) {
    const line = `${JSON.stringify({ time: new Date().toISOString(), tool: name, args, result })}\n`;
    await fs.mkdir(runDir, { recursive: true });
    await fs.appendFile(eventsPath, line);
  }

  return {
    apiTools() {
      return tools.map((tool) => ({
        type: "function",
        function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
      }));
    },
    names: () => [...seen],
    /**
     * 派发一次工具调用。返回给模型的内容一律是可解析 JSON 字符串；
     * 结果过长时截断并在末尾标注，完整结果始终留在 tool-events.ndjson。
     */
    async dispatch(name, args) {
      const pending = tail.then(async () => {
        const result = await invoke(name, args);
        await record(name, args, result);
        const text = JSON.stringify(result);
        if (text.length <= limit) return { text, result };
        return {
          text: `${text.slice(0, limit)}…[结果已截断：完整结果见 tool-events.ndjson]`,
          result,
        };
      });
      tail = pending.then(() => {}, () => {});
      return pending;
    },
  };
}
