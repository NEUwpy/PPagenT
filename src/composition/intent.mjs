import fs from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';

const schema = JSON.parse(await fs.readFile(new URL('../../schemas/composition-intent.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

/** Structural checks only. Rendering, factual grounding and aesthetics need review. */
export function checkCompositionIntents(plan) {
  const issues = [];
  if (!Array.isArray(plan?.pages) || !plan.pages.length) {
    return { status: 'failed', pageCount: 0, issues: ['pages 必须包含正文页计划'], visualStatus: 'not-evaluated' };
  }
  const pageIds = new Set();
  for (const page of plan.pages) {
    const id = page?.pageId;
    const issue = message => issues.push(`${id ?? '?'}: ${message}`);
    if (typeof id !== 'string' || !id.trim() || pageIds.has(id)) issue('pageId 缺失或重复');
    pageIds.add(id);
    const intent = page?.compositionIntent;
    if (!validate(intent)) {
      for (const error of validate.errors ?? []) issue(`${error.instancePath} ${error.message}`);
      continue;
    }
    const groups = new Map(intent.groups.map(group => [group.id, group]));
    if (groups.size !== intent.groups.length) issue('内容组 ID 重复');
    if (!intent.groups.some(group => group.emphasis === 'primary')) issue('缺少主要内容组');
    for (const group of intent.groups) {
      for (const target of group.relatesTo ?? []) {
        if (!groups.has(target) || target === group.id) issue(`${group.id} 关联对象不存在或指向自身: ${target}`);
      }
      if (group.role === 'interpretation' && !(group.relatesTo ?? []).some(target => groups.get(target)?.role === 'analysis')) {
        issue(`${group.id} 解读必须指向本页分析组`);
      }
    }
    const leaves = [];
    for (const relation of intent.relations ?? []) {
      for (const target of [...relation.from, relation.to]) {
        if (!groups.has(target)) issue(`逻辑关系引用未知内容组 ${target}`);
      }
      if (relation.from.includes(relation.to)) issue('逻辑关系不能指向自身');
    }
    const walk = node => {
      if (node.groupId !== undefined) leaves.push(node.groupId);
      else {
        if (node.weights && (node.weights.length !== node.children.length || !['row', 'column'].includes(node.op))) issue('weights 只用于 row/column 且逐项对应 children');
        if (node.columns !== undefined && (node.op !== 'grid' || node.columns > node.children.length)) issue('columns 只用于 grid 且不能超过子项数');
        node.children.forEach(walk);
      }
    };
    walk(intent.composition);
    for (const [label, ids] of [['组合树', leaves], ['阅读顺序', intent.readingOrder]]) {
      for (const groupId of groups.keys()) {
        if (ids.filter(value => value === groupId).length !== 1) issue(`${label}必须且只能包含一次 ${groupId}`);
      }
      for (const groupId of ids) if (!groups.has(groupId)) issue(`${label}引用未知内容组 ${groupId}`);
    }
  }
  return { status: issues.length ? 'failed' : 'passed', pageCount: plan.pages.length, issues, visualStatus: 'not-evaluated' };
}
