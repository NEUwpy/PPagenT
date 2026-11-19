import { validatePagePlan, collectFields, onSlideFields, bindingKey } from "../gray-compiler-20261120/validate.mjs";
import { validateContent } from "../content-to-expression-20261120/validate-content.mjs";

function orderedChain(nodes, links) {
  if (links.length !== nodes.length - 1 || nodes.length < 2
    || links.some(({ type, from }) => type !== "precedes" || from.length !== 1)) return null;
  const successors = new Map(links.map(({ from, to }) => [from[0], to]));
  const targets = new Set(links.map(({ to }) => to));
  if (successors.size !== links.length || targets.size !== links.length) return null;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const head = nodes.find(({ id }) => !targets.has(id));
  if (!head) return null;
  const ordered = [];
  for (let next = head.id; next && ordered.length < nodes.length; next = successors.get(next)) {
    ordered.push(byId.get(next));
  }
  return ordered.length === nodes.length ? ordered : null;
}

function selectDetail(detail, itemId, decisions, errors) {
  const { title, nodes, links = [] } = detail;
  const lookup = new Map(nodes.map((node) => [node.id, node]));
  const prefix = "component:" + itemId;

  const merge = links.length === 1 && links[0].type === "contributes-to" ? links[0] : null;
  if (merge && !title && merge.from.length >= 3 && merge.from.length <= 6
    && merge.from.length === nodes.length - 1 && !lookup.get(merge.to).body) {
    const inputs = merge.from.map((id) => lookup.get(id));
    decisions.push({ itemId, relation: "contributes-to", expression: "convergence",
      rule: "三至六个不同原因直达单一结果，且所有节点均可绑定",
      binding: Object.fromEntries([...inputs.map(({ id }) => [id, prefix + ":input:" + id]), [merge.to, prefix + ":result"]]) });
    return { kind: "convergence", inputs, result: lookup.get(merge.to).title };
  }

  const chain = orderedChain(nodes, links);
  if (chain && !title && chain.every(({ body }) => !body)) {
    decisions.push({ itemId, relation: "precedes", expression: "sequence",
      rule: "有据的无分叉单链，按边走完且保留全部节点",
      binding: Object.fromEntries(chain.map(({ id }, index) => [id, prefix + ":step:" + (index + 1)])) });
    return { kind: "sequence", steps: chain.map(({ title }) => title) };
  }

  if (!links.length && nodes.every(({ body }) => body)) {
    decisions.push({ itemId, expression: "label-value-strip", rule: "条目由若干对象及其有据状态构成",
      binding: Object.fromEntries(nodes.map(({ id }, index) => [id, prefix + ":fact:" + (index + 1)])) });
    return { kind: "short-facts", ...(title ? { label: title } : {}),
      facts: nodes.map(({ title, body }) => ({ label: title, value: body })) };
  }
  errors.push({ code: "unsupported-detail", itemId, message: "现有表达仅支持有据的三至六路单结果、短语单链及无边的对象与状态" });
}

export async function deriveExpression(content, repository) {
  const contentErrors = await validateContent(content, repository);
  if (contentErrors.length) return { errors: contentErrors.map((message) => ({ code: "content-validation", message })) };
  const errors = [];
  const decisions = [];
  const groupFormats = { independent: "independent", peer: "parallel", comparison: "comparison", cases: "parallel" };
  const crossCase = [];
  const groups = content.page.groups.map(({ relation, items, ...group }) => {
    const localCases = items.filter(({ appliesAcrossCases }) => !appliesAcrossCases).map(({ id }) => id);
    decisions.push({ groupId: group.id, relation, expression: groupFormats[relation],
      ...(relation === "cases" ? { localCases } : {}) });
    return { ...group, relation: groupFormats[relation], items: items.map(({ detail, appliesAcrossCases, ...item }) => {
      if (appliesAcrossCases) {
        crossCase.push({ id: item.id, groupId: group.id, appliesTo: localCases, scope: "all-cases" });
      }
      if (!detail) return item;
      const component = selectDetail(detail, item.id, decisions, errors);
      return { ...item, component };
    }) };
  });
  if (errors.length) return { errors };
  const plan = { schemaVersion: "gray-page-plan@1", page: { ...content.page, groups }, sources: content.sources };
  const fields = (page) => {
    const keyed = ({ field }) => bindingKey(field.text, field.sourceIds);
    return [...onSlideFields(page).map(keyed).sort(), "speaker-notes", ...collectFields(page.notes).map(keyed)];
  };
  if (JSON.stringify(fields(content.page)) !== JSON.stringify(fields(plan.page))) {
    return { errors: [{ code: "expression-content-drift", message: "转换前后上屏实文、来源绑定或讲述备注发生变化" }] };
  }
  const result = await validatePagePlan(plan, repository);
  return { ...result, plan, decisions, crossCase };
}
