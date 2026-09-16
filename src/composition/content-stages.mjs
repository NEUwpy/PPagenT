import { createHash } from 'node:crypto';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const compact = text => text.replace(/\s/gu, '');
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

/** A lossless grouping pilot. Source paragraphs exclude manuscript headings. */
export function prepareContentDraft({ pageId, sourceParagraphs, grouping }) {
  if (!pageId || !Array.isArray(sourceParagraphs) || !sourceParagraphs.length) throw new Error('缺少原稿');
  if (!grouping?.topic?.sourceText || !grouping.groups?.length) throw new Error('缺少主题原文或内容组');
  const source = compact(sourceParagraphs.join(''));
  const owners = Array(source.length).fill(null);
  const ids = new Set(['topic']);
  const entries = [{ ...grouping.topic, id: 'topic' }, ...grouping.groups];
  for (const group of grouping.groups) {
    if (!group.id || ids.has(group.id)) throw new Error(`重复或无效组 ID: ${group.id}`);
    ids.add(group.id);
    if (!group.role || !group.title) throw new Error(`内容组缺少角色或标题: ${group.id}`);
    if ('medium' in group || 'assetId' in group) throw new Error('分组阶段不选择组件');
  }
  for (const entry of entries) {
    if (typeof entry.sourceText !== 'string' || !compact(entry.sourceText)) throw new Error(`缺少真实文字: ${entry.id}`);
    const text = compact(entry.sourceText);
    let start = source.indexOf(text);
    while (start >= 0 && owners.slice(start, start + text.length).some(Boolean)) start = source.indexOf(text, start + 1);
    if (start < 0) throw new Error(`原文不匹配或重复归组: ${entry.id}`);
    owners.fill(entry.id, start, start + text.length);
  }
  const missing = owners.findIndex(owner => !owner);
  if (missing >= 0) throw new Error(`原稿未完整归组，遗漏位置 ${missing}: ${source.slice(missing, missing + 32)}`);
  const connected = new Set();
  for (const relation of grouping.relations ?? []) {
    if (!relation.type || !relation.meaning || !Array.isArray(relation.from) || !relation.from.length) throw new Error('关系缺少实际含义或来源数组');
    for (const id of [...relation.from, relation.to]) {
      if (!ids.has(id)) throw new Error(`关系指向未知组: ${id}`);
      connected.add(id);
    }
    if (relation.from.includes(relation.to)) throw new Error('关系不能指向自身');
  }
  for (const group of grouping.groups) {
    if (!connected.has(group.id)) throw new Error(`内容组缺少关系: ${group.id}`);
    for (const id of group.relatesTo ?? []) if (!ids.has(id) || id === group.id) throw new Error(`关联组无效: ${id}`);
  }
  const content = structuredClone({ pageId, sourceParagraphs, grouping });
  return freeze({ ...content, contentHash: digest(content), coverage: 'complete-verbatim', semanticStatus: 'unreviewed' });
}

/** Bind whole content groups exactly once. Media adapters own selection fields, never the copy. */
export function bindExpressionGroups(groups, selections) {
  const byId = new Map(groups.map(group=>[group.id,group])), seen = new Set();
  if (byId.size !== groups.length || !Array.isArray(selections) || !selections.length) throw new Error('表达绑定缺少内容或选择');
  const bound = selections.map(selection=>{
    if (!Array.isArray(selection.groupIds) || !selection.groupIds.length) throw new Error('表达缺少内容组引用');
    const content = selection.groupIds.map(id=>{
      if (!byId.has(id) || seen.has(id)) throw new Error(`未知或重复表达组: ${id}`);
      seen.add(id);return structuredClone(byId.get(id));
    });
    return {selection:structuredClone(selection),groups:content};
  });
  if (seen.size !== byId.size) throw new Error('表达选择遗漏内容组');
  return freeze(bound);
}

/** Selection only binds media to existing groups; it cannot replace their text. */
export function bindExpressions({ draft, review, selections }) {
  const { pageId, sourceParagraphs, grouping } = draft;
  if (draft.contentHash !== digest({ pageId, sourceParagraphs, grouping })) throw new Error('分组稿已变化，需要重新检查');
  if (review?.contentHash !== draft.contentHash || review?.status !== 'passed' || !review?.reason) throw new Error('需先完成当前分组与实文草稿的复核');
  for (const selection of selections ?? []) {
    if (Object.keys(selection).some(key => !['groupId', 'medium', 'assetId', 'reason'].includes(key))) throw new Error('表达阶段不得携带替换正文或重新分组');
    if (!['text', 'table', 'chart', 'structure', 'image'].includes(selection.medium) || !selection.reason) throw new Error('表达需声明媒介与理由');
    if (selection.medium === 'structure' && !selection.assetId) throw new Error('结构表达需指定资产');
  }
  const bound = bindExpressionGroups(grouping.groups, selections?.map(selection=>({...selection,groupIds:[selection.groupId]})));
  const expressions = bound.map(({selection,groups}) => {
    const {groupIds,...choice}=selection;
    return {...choice,group:groups[0]};
  });
  return freeze({ pageId, contentHash: draft.contentHash, topic: grouping.topic, expressions, relations: grouping.relations, visualStatus: 'unreviewed' });
}
