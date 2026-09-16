// 内容保真检查。**确定性、纯函数、可离线测**：不调模型、不读磁盘、不看渲染。
//
// 为什么需要它：内容阶段此前把"来源可追溯"实现成了"正文只能逐字照抄"——模型不撰写正文，
// 于是分页与编排无从谈起。规则（rules/内容组织.md:2）说的是"可以改写文字、调整顺序、合并拆分，
// 但不得改变原意"。允许改写之后，"用了正确的 sourceIds"就不再蕴含"意思没变"，
// 所以要在写入的关口补一条能机器判定的保真检查。
//
// **能力边界写在 limits 里，不许含糊。** 下面四条判据只覆盖"能逐字比对"的东西：
// 编造的数字、编造的引号内容、空正文、超长正文。改原意但一个数字一个引号都不动的手法
// （加限定条件、弱化语气、换同义词、用中文数词）**机器查不了**，必须原样告诉模型和用户。

/**
 * 条目正文长度上限。与 `pageSchema.items.text.maxLength` 是同一个数——
 * 两处不一致时以 schema 为准会漏掉手工改过的 state.json，所以这里也判一次。
 */
export const ITEM_TEXT_MAX_LENGTH = 400;

/** 数字：含小数。整数与小数都按字面比对。 */
const NUMBER = /\d+(?:\.\d+)?/gu;
/** 引号内容：三种成对引号，只取引号**里面**的文本。 */
const QUOTED = /[「『“]([^」』”]*)[」』”]/gu;

/**
 * 查不出来的四类。**这是本模块最重要的输出之一**：
 * 调用方（工具描述、拒绝消息、渲染产物）必须把它原样交出去，
 * 否则"过了保真检查"会被读成"原意没被改"。
 */
export const FIDELITY_LIMITS = Object.freeze([
  "漏掉或添上限定条件（如把「在现有设备前提下」写成无条件的结论）查不出来",
  "强化或弱化语气（如「须由责任人确认」写成「建议确认」）查不出来",
  "换同义词造成的原意偏移查不出来",
  "中文数词（如「三项」「两步」）的编造查不出来",
  "数字与引号即便逐字命中，也不证明它周围的语境没被改写（如把有说成没有），仍需人看",
]);

/** limits 的单行文本形式，给工具描述与错误消息用。 */
export function fidelityLimitsText() {
  return FIDELITY_LIMITS.join("；");
}

/**
 * 一条内容项的保真判定。
 *
 * `text` 缺省（undefined / null）表示模型没有撰写正文，回退到逐字来源——这不是违规。
 * `sourceText` 是该条目**被引用的全部来源**的逐字并集（由 state.mjs 按 sourceIds 回填，模型不能自报）。
 *
 * 返回 `{ accepted, issues, limits }`。issues 里每条带语义 code，便于拒绝消息与台账引用。
 */
export function checkItemFidelity({ text, sourceText }) {
  const issues = [];
  const limits = FIDELITY_LIMITS;
  if (text === undefined || text === null) return { accepted: true, issues, limits };

  const value = String(text);
  if (!value.trim()) issues.push({ code: "item-text-empty" });
  if (value.length > ITEM_TEXT_MAX_LENGTH) {
    issues.push({ code: "item-text-too-long", length: value.length, limit: ITEM_TEXT_MAX_LENGTH });
  }

  // 去重：同一个编造的数字写三遍是同一个问题，报三条只会淹掉真正的问题。
  const source = String(sourceText ?? "");
  for (const number of new Set(value.match(NUMBER) ?? [])) {
    if (!source.includes(number)) issues.push({ code: "unbacked-number", value: number });
  }
  for (const quoted of new Set([...value.matchAll(QUOTED)].map((match) => match[1]).filter((inner) => inner.trim()))) {
    if (!source.includes(quoted)) issues.push({ code: "unbacked-quote", value: quoted });
  }
  return { accepted: issues.length === 0, issues, limits };
}

/** 把 issues 拼成一句能给模型看的拒绝消息；顺带带上能力边界，免得它以为"过了"就是"对"。 */
export function describeFidelityIssues(issues) {
  const detail = issues.map((issue) => {
    if (issue.code === "item-text-empty") return "正文是空的";
    if (issue.code === "item-text-too-long") return `正文 ${issue.length} 字，超过 ${issue.limit} 字上限`;
    if (issue.code === "unbacked-number") return `数字「${issue.value}」在被引用的来源里找不到`;
    if (issue.code === "unbacked-quote") return `引号内容「${issue.value}」在被引用的来源里找不到`;
    return issue.code;
  });
  return `${detail.join("；")}。可以改写文字，但不得改变原意。注意：${fidelityLimitsText()}。`;
}
