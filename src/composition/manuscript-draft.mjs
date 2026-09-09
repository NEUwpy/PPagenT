import { createHash } from 'node:crypto';
import { buildSourceBlocks } from '../content/source-blocks.mjs';
import { prepareContentDraft } from './content-stages.mjs';

export const manuscriptHash = raw => createHash('sha256').update(raw).digest('hex');

/** Lossless, whole-block pilot. Does not judge semantics, capacity, or rendering.
 * Every block must occur once; intentional repeats and summaries need a later contract.
 * Source IDs are positional and valid only with the matching manuscript hash.
 */
export function prepareManuscriptDraft({ rawMarkdown, sourceHash, pages }) {
  if (typeof rawMarkdown !== 'string' || !rawMarkdown.trim()) throw new Error('缺少完整原稿');
  if (sourceHash !== manuscriptHash(rawMarkdown)) throw new Error('原稿哈希不匹配，需重新分页');
  if (!Array.isArray(pages) || !pages.length) throw new Error('缺少页面分配');
  const blocks = buildSourceBlocks(rawMarkdown);
  const byId = new Map(blocks.map(block => [block.id, block]));
  const owners = new Map();
  const pageIds = new Set();
  const staged = pages.map(page => {
    if (!page.pageId || pageIds.has(page.pageId) || !page.purpose?.trim()) throw new Error('缺少页面职责或页 ID 重复');
    pageIds.add(page.pageId);
    if (!page.topic || !Array.isArray(page.groups) || !page.groups.length) throw new Error('缺少主题或内容组');
    const take = (entry, groupId) => {
      if ('sourceText' in entry) throw new Error('页面只能引用来源，不得携带替换正文');
      if (!Array.isArray(entry.sourceIds) || !entry.sourceIds.length) throw new Error(`缺少来源: ${groupId}`);
      return entry.sourceIds.map(id => {
        if (!byId.has(id)) throw new Error(`未知来源: ${id}`);
        if (owners.has(id)) throw new Error(`来源重复分配: ${id}`);
        owners.set(id, { pageId: page.pageId, groupId });
        return byId.get(id).text;
      }).join('\n\n');
    };
    const topic = { sourceText: take(page.topic, 'topic') };
    const groups = page.groups.map(group => {
      const { sourceIds, ...fields } = group;
      return { ...fields, sourceText: take(group, group.id) };
    });
    const ids = [page.topic, ...page.groups].flatMap(entry => entry.sourceIds);
    return { page, ids, grouping: { topic, groups, relations: page.relations } };
  });
  const missing = blocks.filter(block => !owners.has(block.id)).map(block => block.id);
  if (missing.length) throw new Error(`整稿来源未分配: ${missing.join(', ')}`);
  const drafts = staged.map(({ page, ids, grouping }) => ({
    pageId: page.pageId, purpose: page.purpose, sourceIds: ids,
    draft: prepareContentDraft({ pageId: page.pageId, sourceParagraphs: ids.map(id => byId.get(id).text), grouping }),
  }));
  return {
    sourceHash, coverage: 'complete-verbatim-whole-blocks',
    sourceMap: blocks.map(block => ({ ...block, ...owners.get(block.id) })),
    pages: drafts, semanticStatus: 'unreviewed', visualStatus: 'not-evaluated',
  };
}
