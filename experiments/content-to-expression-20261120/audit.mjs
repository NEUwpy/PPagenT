import { isDeepStrictEqual } from "node:util";
import { detailKey, detailTitleKey, relationSentence } from "./projection.mjs";

export function audit(content, projection, layout) {
  const { page } = content;
  const { bindings } = projection;
  const textById = new Map(layout.texts.map((text) => [text.id, text]));
  const objectById = new Map(layout.objects.map((object) => [object.id, object]));
  const relationGroups = new Map(layout.relations.groups.map((group) => [group.id, group]));
  const errors = [];
  const expectedEdges = new Set();
  const touched = new Set();
  const spans = new Map();
  const fail = (code, id) => errors.push({ code, id });
  const edge = (from, to) => `${from} → ${to}`;

  function read(key, field) {
    if (!field) return;
    const { target, span } = bindings[key] ?? { target: key };
    const actual = textById.get(target);
    if (!actual) {
      fail("missing-content-field", key);
      return;
    }
    touched.add(target);
    const visible = span ? actual.text.slice(...span) : actual.text;
    if (visible !== field.text) fail("changed-content-field", key);
    const supported = span ? field.sourceIds.every((id) => actual.sourceIds.includes(id))
      && isDeepStrictEqual(field.sourceIds, bindings[key].sourceIds)
      : isDeepStrictEqual([...actual.sourceIds].sort(), [...field.sourceIds].sort());
    if (!supported) fail("lost-field-source", key);
    if (span) {
      if (!spans.has(target)) spans.set(target, []);
      spans.get(target).push(span);
    }
  }
  function scope(notes) {
    for (const note of notes ?? []) {
      const id = `note:${note.id}`;
      read(id + ":text", note.text);
      const actual = objectById.get(id)?.appliesTo;
      if (!actual || !isDeepStrictEqual([...actual].sort(), [...note.appliesTo].sort())) fail("changed-scope", id);
    }
  }
  function checkDetail(item) {
    const { id, detail } = item;
    read(detailTitleKey(id), detail.title);
    for (const node of detail.nodes) {
      read(detailKey(id, node.id, "title"), node.title);
      read(detailKey(id, node.id, "body"), node.body);
    }
    const nodes = new Map(detail.nodes.map((node) => [node.id, node]));
    const component = objectById.get(`component:${id}`);
    const prose = textById.get(`item:${id}:body`);
    const titleBinding = (node) => bindings[detailKey(id, node, "title")];
    const record = projection.relations.find(({ owner }) => owner === id);
    if (!isDeepStrictEqual(record?.links, detail.links ?? [])) fail("changed-link-provenance", id);
    for (const link of detail.links ?? []) {
      const { from, to, type } = link;
      const target = titleBinding(to);
      const starts = from.map(titleBinding);
      if (!target || starts.some((start) => !start)) {
        fail("unbound-relation", id);
        continue;
      }
      if (component?.component.id === "convergence" && type === "contributes-to") {
        if (component.asset !== "convergence-many-to-one-003") fail("unexpected-convergence-asset", id);
        for (const start of starts) expectedEdges.add(edge(start.target.replace(/:title$/u, ""), target.target.replace(/:title$/u, "")));
      } else if (component?.component.id === "sequence-flow" && type === "precedes") {
        expectedEdges.add(edge(starts[0].target, target.target));
      } else if (!component && prose && target.span && starts.every((start) => start.span)) {
        const lead = prose.text.slice(0, target.span[0]);
        const ordered = starts.every(({ span }) => span[1] < target.span[0]);
        const signalled = type === "precedes" ? lead.includes("按先后：") : lead.endsWith("共同作用的结果：");
        if (!(ordered && signalled) && !prose.text.includes(relationSentence(link, nodes))) fail("missing-prose-relation", id);
        if (!link.sourceIds.every((id) => prose.sourceIds.includes(id))) fail("lost-link-source", id);
      } else {
        fail("wrong-relation-encoding", id);
      }
    }
  }

  read("claim", page.claim);
  read("title", page.title);
  scope(page.scopeNotes);
  if (!isDeepStrictEqual(layout.groups.map(({ id }) => id), page.groups.map(({ id }) => `group:${id}`))) {
    fail("changed-group-order", page.id);
  }
  for (const group of page.groups) {
    const id = `group:${group.id}`;
    read(id + ":title", group.title);
    scope(group.scopeNotes);
    const measured = relationGroups.get(group.id);
    if (!isDeepStrictEqual(measured?.members, group.items.map(({ id }) => id))) fail("changed-item-order", id);
    const allowed = { comparison: ["comparison", "independent"], independent: ["independent"],
      peer: ["parallel"], cases: ["independent"] };
    if (!allowed[group.relation].includes(measured?.relation)) fail("wrong-group-relation", id);
    for (const item of group.items) {
      read(`item:${item.id}:title`, item.title);
      read(`item:${item.id}:body`, item.body);
      if (item.detail) checkDetail(item);
    }
  }
  const expectedCrossCase = page.groups.flatMap((group) => group.items
    .filter(({ appliesAcrossCases }) => appliesAcrossCases).map(({ id }) => ({ group: group.id, item: id })));
  if (!isDeepStrictEqual(projection.crossCaseItems, expectedCrossCase)) fail("changed-cross-case-scope", page.id);
  if (!isDeepStrictEqual(layout.notes, page.notes ?? [])) fail("changed-speaker-notes", page.id);

  for (const [target, locations] of spans) {
    locations.sort((a, b) => a[0] - b[0]);
    if (locations.some(([start], index) => index && locations[index - 1][1] > start)) fail("overlapping-text-bindings", target);
  }
  for (const { id } of layout.texts) if (!touched.has(id)) fail("unexpected-text-field", id);
  const actualEdges = new Set(layout.objects.filter(({ connection }) => connection)
    .map(({ connection: { from, to } }) => edge(from, to)));
  for (const link of expectedEdges) if (!actualEdges.has(link)) fail("missing-connection", link);
  for (const link of actualEdges) if (!expectedEdges.has(link)) fail("extra-connection", link);
  return { errors, expectedEdges: [...expectedEdges], actualEdges: [...actualEdges],
    checkedTextFields: touched.size, crossCaseItems: projection.crossCaseItems };
}
