// 多轮工具调用循环。**这是本仓库第一次拥有自己的循环**——在此之前它一直由宿主提供：
// 今天由 Codex 宿主提供，实验里由 @prismshadow/penguin-core 提供。所以这个文件是新的，
// 但它的每条机制都来自 experiments/penguin-harness-v2 里已经跑通过的那一套，不是凭空设计。
//
// 本文件只拥有循环本身：发消息、收 tool_calls、派发、回灌、判断何时停。没有业务逻辑、不碰文件系统。

/**
 * 停止由**工具写下的状态字段**决定，不由模型自然语言决定。
 * 参考实现 run-grid.mjs:57-59 就是这么做的：每一轮工具返回后重新读取项目状态，
 * 一旦阶段字段推进（content → visual → ready）或出现 runtimeFailure，立即结束。
 * 如果改为"模型说完成了就停"，模型只要输出一句"已完成"就能在不写任何状态的情况下骗过循环。
 *
 * @param shouldStop async (turn) => null | {reason: string, detail?: object}
 */
export async function runToolLoop({
  provider,
  systemPrompt,
  userMessage,
  registry,
  shouldStop,
  maxTurns = 16,
  maxStalls = 2,
  onTurn = null,
}) {
  if (!provider?.complete) throw new Error("runToolLoop 需要一个 provider");
  if (typeof shouldStop !== "function") throw new Error("runToolLoop 需要 shouldStop：停止条件必须是工具写下的状态，不能靠模型自述");
  if (!registry?.apiTools) throw new Error("runToolLoop 需要工具注册表");

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];
  const tools = registry.apiTools();
  const turns = [];
  let usage = { requests: 0, toolCalls: 0, tokens: {} };
  let stalls = 0;

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const reply = await provider.complete({ messages, tools });
    usage.requests += 1;
    usage.toolCalls += reply.toolCalls.length;
    for (const [key, value] of Object.entries(reply.usage ?? {})) {
      if (Number.isFinite(value)) usage.tokens[key] = (usage.tokens[key] ?? 0) + value;
    }

    // 模型没调工具：给它有限次数的纠正机会，而不是当成"做完了"。
    if (!reply.toolCalls.length) {
      stalls += 1;
      const record = { turn, content: reply.content, toolCalls: [], stalled: true };
      turns.push(record);
      if (onTurn) await onTurn(record);
      if (stalls > maxStalls) {
        return { stopReason: "model-stalled", turns, usage, messages, note: "模型连续未调用任何工具；这不是完成，是失败。" };
      }
      messages.push({ role: "assistant", content: reply.content ?? "" });
      messages.push({
        role: "user",
        content: "你没有调用任何工具，因此没有任何状态被写下来。请调用工具推进当前阶段；阶段做完时调用该阶段的完成工具。只回复文字不算完成。",
      });
      continue;
    }
    stalls = 0;

    messages.push({
      role: "assistant",
      content: reply.content ?? "",
      tool_calls: reply.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.arguments },
      })),
    });

    const dispatched = [];
    for (const call of reply.toolCalls) {
      let args;
      let outcome;
      try {
        args = call.arguments?.trim() ? JSON.parse(call.arguments) : {};
      } catch (error) {
        // 参数不是合法 JSON 时，把原因作为工具结果回灌，让模型自纠——而不是让整轮崩掉。
        // result 里同样放结构化错误：运行证据要能看出"模型当时发的是坏参数"，
        // 只把错误放进回灌文本会让落盘的 transcript 丢失这一段。
        const payload = { accepted: false, error: `工具 ${call.name} 的参数不是合法 JSON：${error.message}` };
        outcome = { text: JSON.stringify(payload), result: payload };
      }
      if (!outcome) outcome = await registry.dispatch(call.name, args);
      messages.push({ role: "tool", tool_call_id: call.id, content: outcome.text });
      dispatched.push({ id: call.id, name: call.name, args, result: outcome.result });
    }

    const record = { turn, content: reply.content, toolCalls: dispatched, stalled: false };
    turns.push(record);
    if (onTurn) await onTurn(record);

    const stop = await shouldStop(record);
    if (stop) return { stopReason: stop.reason, detail: stop.detail ?? null, turns, usage, messages };
  }

  // 走到这里说明没在预算内停下。这是失败诊断，不是完成。
  return { stopReason: "max-turns", turns, usage, messages, note: `已达 ${maxTurns} 轮上限，阶段未提交。` };
}

/** 把 tool 循环的消息史压成可落盘的证据。完整消息史可能很大，只保留结构与摘要。 */
export function transcriptSummary(result) {
  return {
    stopReason: result.stopReason,
    detail: result.detail ?? null,
    note: result.note ?? null,
    turns: result.turns.length,
    usage: result.usage,
    toolCallCount: result.turns.reduce((total, turn) => total + turn.toolCalls.length, 0),
    stalledTurns: result.turns.filter((turn) => turn.stalled).length,
    toolSequence: result.turns.flatMap((turn) => turn.toolCalls.map((call) => call.name)),
  };
}
