import { detailShape } from "./candidates.mjs";

export const detailKey = (owner, id, field) => `detail:${owner}:${id}:${field}`;
export const detailTitleKey = (owner) => `detail:${owner}:title`;

export function relationSentence({ type, from, to }, nodes) {
  const titles = from.map((id) => nodes.get(id).title.text).join("、");
  const target = nodes.get(to).title.text;
  return type === "precedes" ? `${titles}先于${target}。` : `${titles}共同作用，结果是${target}。`;
}

function plainDetail({ id, body }, detail, bindings) {
  const shape = detailShape(detail);
  const target = `item:${id}:body`;
  const sources = new Set();
  let text = "";
  function add(key, field) {
    if (!field) return;
    bindings[key] = { target, span: [text.length, text.length + field.text.length], sourceIds: field.sourceIds };
    text += field.text;
    for (const source of field.sourceIds) sources.add(source);
  }
  function nodeCopy(node) {
    add(detailKey(id, node.id, "title"), node.title);
    if (node.body) {
      text += "：";
      add(detailKey(id, node.id, "body"), node.body);
    }
  }
  function list(nodes) {
    for (const [index, node] of nodes.entries()) {
      if (index) text += "；";
      nodeCopy(node);
    }
  }

  if (body) {
    add(target, body);
    text += "\n";
  }
  if (detail.title) {
    add(detailTitleKey(id), detail.title);
    text += "：";
  }
  if (shape.kind === "causes") {
    list(shape.inputs);
    text += "\n共同作用的结果：";
    nodeCopy(shape.result);
  } else if (shape.kind === "chain") {
    text += "按先后：";
    list(shape.nodes);
  } else {
    list(detail.nodes);
    if (shape.kind === "graph") {
      const nodes = new Map(detail.nodes.map((node) => [node.id, node]));
      text += "\n" + detail.links.map((link) => relationSentence(link, nodes)).join("");
    }
  }
  for (const link of detail.links ?? []) for (const source of link.sourceIds) sources.add(source);
  return { text, sourceIds: [...sources] };
}

export function project(content, choices, probe) {
  const { page, sources } = content;
  const selected = new Map(choices.map((choice) => [choice.owner, choice]));
  const plan = { schemaVersion: "gray-page-plan@1", page: { ...page, groups: [] }, sources };
  const bindings = {};
  const crossCaseItems = [];
  let changed = false;
  function keepScopes(scopes) {
    if (probe !== "drop-scope" || changed || !scopes?.length) return scopes;
    changed = true;
    return scopes.slice(1);
  }
  plan.page.scopeNotes = keepScopes(page.scopeNotes);
  for (const group of page.groups) {
    const projected = { ...group, relation: selected.get(group.id)?.kind === "comparison" ? "comparison"
      : group.relation === "peer" ? "parallel" : "independent", items: [], scopeNotes: keepScopes(group.scopeNotes) };
    if (probe === "cases-as-sequence" && !changed && group.relation === "cases") {
      projected.relation = "sequence";
      changed = true;
    }
    for (const { detail, appliesAcrossCases, ...item } of group.items) {
      if (appliesAcrossCases) crossCaseItems.push({ group: group.id, item: item.id });
      if (detail) {
        const choice = selected.get(item.id);
        const component = `component:${item.id}`;
        const bind = (node, field, target) => { bindings[detailKey(item.id, node.id, field)] = { target }; };
        if (choice?.kind === "convergence") {
          const { inputs, result } = choice.shape;
          for (const node of inputs) {
            const target = `${component}:input:${node.id}`;
            bind(node, "title", target + ":title");
            if (node.body) bind(node, "body", target + ":body");
          }
          bind(result, "title", component + ":result:title");
          item.component = { kind: "convergence", inputs, result: result.title };
        } else if (choice?.kind === "sequence") {
          let nodes = choice.shape.nodes;
          if (probe === "reverse-sequence" && !changed) {
            nodes = [...nodes].reverse();
            changed = true;
          }
          nodes.forEach((node, index) => bind(node, "title", `${component}:step:${index + 1}`));
          item.component = { kind: "sequence", steps: nodes.map(({ title }) => title) };
        } else if (choice?.kind === "short-facts") {
          if (detail.title) bindings[detailTitleKey(item.id)] = { target: component + ":label" };
          detail.nodes.forEach((node, index) => {
            bind(node, "title", `${component}:fact:${index + 1}:label`);
            bind(node, "body", `${component}:fact:${index + 1}:value`);
          });
          item.component = { kind: "short-facts", label: detail.title,
            facts: detail.nodes.map(({ title, body }) => ({ label: title, value: body })) };
        } else {
          item.body = plainDetail(item, detail, bindings);
        }
      }
      projected.items.push(item);
    }
    plan.page.groups.push(projected);
  }
  if (probe && !changed) throw new Error(`该内容没有可执行的 ${probe} 注入点`);
  return { plan, bindings, crossCaseItems, relations: page.groups.flatMap(({ items }) => items.filter(({ detail }) => detail)
    .map(({ id, detail }) => ({ owner: id, links: detail.links ?? [] }))) };
}
