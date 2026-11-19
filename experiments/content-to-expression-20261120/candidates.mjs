const count = ({ text }) => [...text].length;
const linkedToClaim = (claim, ids) => ids.some((id) => claim.sourceIds.includes(id));

export function detailShape(detail) {
  const { nodes, links = [] } = detail;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (!links.length) return { kind: "facts", nodes };
  if (links.length === 1 && links[0].type === "contributes-to" && links[0].from.length === nodes.length - 1) {
    const { from, to } = links[0];
    return { kind: "causes", inputs: nodes.filter(({ id }) => from.includes(id)), result: byId.get(to) };
  }
  if (links.length !== nodes.length - 1 || !links.every(({ type }) => type === "precedes")) {
    return { kind: "graph" };
  }
  const next = new Map(links.map(({ from, to }) => [from[0], to]));
  const targets = new Set(next.values());
  const first = nodes.find(({ id }) => !targets.has(id));
  const ordered = [];
  for (let at = first?.id; at; at = next.get(at)) ordered.push(byId.get(at));
  return ordered.length === nodes.length ? { kind: "chain", nodes: ordered } : { kind: "graph" };
}

export function discover({ claim, groups }) {
  const choices = [];
  const excluded = [];
  for (const group of groups) {
    if (group.relation === "comparison") {
      const focus = group.items.every(({ title, body }) =>
        linkedToClaim(claim, [...title.sourceIds, ...(body?.sourceIds ?? [])]));
      choices.push({ owner: group.id, kind: "comparison", benefit: focus ? 5 : 3,
        reason: focus ? "被比较的各项均支撑页首主旨，同口径可并排定位" : "有明确比较关系，可并排读两项" });
    }
    if (group.relation === "cases") {
      excluded.push({ owner: group.id, kind: "group-sequence", reason: "各情形满足各自条件，组内没有先后边" });
    }
    for (const item of group.items) {
      if (!item.detail) continue;
      const shape = detailShape(item.detail);
      const local = { owner: item.id, shape };
      switch (shape.kind) {
        case "causes": {
          if (shape.inputs.length < 3 || shape.inputs.length > 6 || shape.result.body || item.detail.title) {
            excluded.push({ owner: item.id, kind: "convergence", reason: "现有库只绑定 3–6 路因素及单行结果字段" });
            break;
          }
          const focus = linkedToClaim(claim, shape.result.title.sourceIds);
          choices.push({ ...local, kind: "convergence", benefit: focus ? 6 : 3,
            reason: focus ? "三类以上同级因素共同指向支撑页首主旨的结果" : "多因素共同指向同一结果" });
          break;
        }
        case "chain": {
          if (item.detail.title || shape.nodes.some(({ title, body }) => body || count(title) > 18)) {
            excluded.push({ owner: item.id, kind: "sequence", reason: "当前步骤槽只适合短节点标题" });
            break;
          }
          // Evidence overlap is a proxy for narrative relevance, never proof of emphasis.
          const focus = linkedToClaim(claim, item.detail.links.flatMap(({ sourceIds }) => sourceIds));
          choices.push({ ...local, kind: "sequence", benefit: focus || shape.nodes.length >= 4 ? 4 : 1,
            reason: focus || shape.nodes.length >= 4 ? "较长或与主旨引用相交的先后链" : "链较短，正文用一次按先后陈述即可" });
          break;
        }
        case "facts":
          if (shape.nodes.length >= 2 && shape.nodes.every(({ title, body }) => body && count(title) <= 8 && count(body) <= 8)) {
            choices.push({ ...local, kind: "short-facts", benefit: shape.nodes.length >= 5 ? 3 : 1,
              reason: "字段和值短，可对照扫读，也可在一行正文内读完" });
          }
          break;
      }
    }
  }
  return { choices, excluded };
}

export function enumerate(choices) {
  return choices.reduce((plans, choice) =>
    [...plans, ...plans.map((selected) => [...selected, choice])], [[]]);
}

export function candidateId(choices) {
  return choices.map(({ owner, kind }) => `${owner}-${kind}`).join("--") || "text";
}

export function grade(choices, layout) {
  const benefit = choices.reduce((sum, choice) => sum + choice.benefit, 0);
  const expressionCost = choices.length * 2;
  const densityCost = layout.compilerLayout.density === "compact" ? 2 : 0;
  const shortEnds = layout.texts.filter(({ lines }) => lines.length > 1 && [...lines.at(-1).text.trim()].length <= 3).length;
  const wrapCost = Math.min(shortEnds, 3);
  return { total: benefit - expressionCost - densityCost - wrapCost, benefit, expressionCost, densityCost, wrapCost };
}
