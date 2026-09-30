import { createHash } from 'node:crypto';

const nonempty = value => typeof value === 'string' && value.trim().length > 0;

function fail(message) { throw new Error(`视觉块映射：${message}`); }
function keys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k=>!allowed.includes(k))) fail('不接受正文、坐标或未声明字段');
}

function sourceBlocks(page) {
  const result = [];
  for (const group of page?.groups ?? []) {
    for (const [index, block] of (group.blocks ?? []).entries()) {
      if (!nonempty(block?.id)) fail(`组 ${group.id ?? '?'} 存在没有 id 的内容块`);
      result.push({ groupId: group.id, blockId: block.id, index, block });
    }
  }
  return result;
}

/**
 * 将语义组内的原始 blocks 映射成视觉块。
 *
 * 这是建设期的确定性绑定器：它只验证归属、顺序、来源和作用范围，
 * 不替模型决定页面关系、不计算坐标，也不改写正文。映射可把同一组的多个
 * blocks 合并成一个视觉块，但不能跨语义组偷并内容。
 */
export function bindVisualBlocks(page, mapping) {
  if (!nonempty(page?.pageId) || !Array.isArray(page.groups) || !page.groups.length) fail('缺少 pageId 或 groups');
  if (!Array.isArray(mapping?.blocks) || !mapping.blocks.length) fail('必须提交 blocks 映射');
  keys(mapping, ['blocks', 'groups']);

  const groups = new Map(page.groups.map(group => [group.id, group]));
  if (groups.size !== page.groups.length || [...groups.keys()].some(id => !nonempty(id))) fail('语义组 id 必须唯一且非空');
  const sources = sourceBlocks(page);
  const sourceById = new Map();
  for (const source of sources) {
    const key = `${source.groupId}/${source.blockId}`;
    if (sourceById.has(key)) fail(`内容块 id 在同一页重复：${key}`);
    sourceById.set(key, source);
  }

  const visualIds = new Set();
  const claimed = new Set();
  const visualBlocks = mapping.blocks.map((candidate, index) => {
    keys(candidate, ['id','groupId','blockIds','role','scopeGroupIds']);
    if (!nonempty(candidate?.id) || visualIds.has(candidate.id)) fail(`视觉块 ${index + 1} 的 id 缺失或重复`);
    visualIds.add(candidate.id);
    if (!nonempty(candidate.groupId) || !groups.has(candidate.groupId)) fail(`视觉块 ${candidate.id} 的 groupId 无效`);
    if (!Array.isArray(candidate.blockIds) || !candidate.blockIds.length) fail(`视觉块 ${candidate.id} 必须引用至少一个原始 block`);
    const refs = candidate.blockIds.map(blockId => {
      const key = `${candidate.groupId}/${blockId}`;
      const source = sourceById.get(key);
      if (!source) fail(`视觉块 ${candidate.id} 越界引用 ${key}`);
      if (claimed.has(key)) fail(`原始 block 被重复映射：${key}`);
      claimed.add(key);
      return source;
    });
    const scopeGroupIds = candidate.scopeGroupIds ?? [];
    const role = candidate.role ?? 'content';
    if (!['content','shared'].includes(role)) fail(`视觉块 ${candidate.id} 的 role 无效`);
    if (!Array.isArray(scopeGroupIds) || new Set(scopeGroupIds).size !== scopeGroupIds.length || scopeGroupIds.some(id => !groups.has(id))) {
      fail(`视觉块 ${candidate.id} 的 scopeGroupIds 无效`);
    }
    if (scopeGroupIds.length && !scopeGroupIds.includes(candidate.groupId)) {
      fail(`视觉块 ${candidate.id} 的作用范围必须包含所属组 ${candidate.groupId}`);
    }
    if (scopeGroupIds.some(id=>id!==candidate.groupId)) fail('当前映射不支持跨组作用范围，请保留原组或返回规划');
    if (role==='shared' && (scopeGroupIds.length!==1 || refs.some(r=>r.block.scope!=='group'))) fail('共同说明必须引用原有 scope:group 块并声明本组作用范围');
    if (role==='content' && scopeGroupIds.length) fail('普通内容不能声明共同说明作用范围');
    const sourceIds = [...new Set(refs.flatMap(source => source.block.sourceIds ?? []))];
    return {
      id: candidate.id,
      groupId: candidate.groupId,
      role,
      scopeGroupIds: [...scopeGroupIds],
      sourceBlockIds: refs.map(source => `${source.groupId}/${source.blockId}`),
      sourceIds,
      blocks: refs.map(source => structuredClone(source.block)),
    };
  });
  if (claimed.size !== sourceById.size) {
    const missing = [...sourceById.keys()].filter(key => !claimed.has(key));
    fail(`有原始 block 未进入视觉块：${missing.join('、')}`);
  }
  const order=page.readingOrder ?? [...groups.keys()];
  if(order.length!==groups.size || new Set(order).size!==groups.size || order.some(id=>!groups.has(id))) fail('语义阅读顺序无效');
  const expected=order.flatMap(id=>sources.filter(s=>s.groupId===id).map(s=>`${s.groupId}/${s.blockId}`));
  if(JSON.stringify(visualBlocks.flatMap(b=>b.sourceBlockIds))!==JSON.stringify(expected)) fail('视觉块必须保持组及块的阅读顺序');
  const arrangements=mapping.groups ?? [];
  if(!Array.isArray(arrangements) || new Set(arrangements.map(g=>g.groupId)).size!==arrangements.length) fail('组布局缺失或重复');
  for(const g of arrangements) {
    keys(g,['groupId','direction','relation']);
    if(!groups.has(g.groupId) || !['horizontal','vertical'].includes(g.direction) || !['parallel','independent'].includes(g.relation)) fail('组内仅支持并列/独立内容的 horizontal/vertical 布局');
  }
  const groupVisualBlocks = [...groups.keys()].map(groupId => ({
    groupId,
    visualBlockIds: visualBlocks.filter(block => block.groupId === groupId).map(block => block.id),
    direction:arrangements.find(g=>g.groupId===groupId)?.direction ?? 'vertical',
    relation:arrangements.find(g=>g.groupId===groupId)?.relation ?? null,
  }));
  for(const group of groups.values()) {
    const chunks=visualBlocks.filter(b=>b.groupId===group.id);
    if(chunks.length>1 && !arrangements.some(g=>g.groupId===group.id)) fail('拆分视觉块必须声明组内关系与方向');
    if(group.kind!=='text' && chunks.length>1) fail('整组图示不可拆成文字视觉块');
    const shared=chunks.filter(b=>b.role==='shared');
    if(shared.length>1 || shared.length && ![chunks[0],chunks.at(-1)].includes(shared[0])) fail('共同说明只支持组首或组尾的一条连续说明带');
    if(chunks.length>1) for(const chunk of chunks) {
      if(chunk.blocks.some(b=>b.scope==='group') && chunk.role!=='shared') fail('组级说明拆分时必须保留为 shared 带');
      if(chunk.blocks[0]?.kind==='note') fail('附注必须与前一条所属内容绑定在同一视觉块');
      if(chunk.blocks.some(b=>b.kind && !['text','note'].includes(b.kind))) fail('含局部图示的组暂不拆分视觉块');
    }
  }
  const canonical = JSON.stringify({pageId: page.pageId, blocks: visualBlocks, groups: groupVisualBlocks});
  return {
    pageId: page.pageId,
    blocks: visualBlocks,
    groups: groupVisualBlocks,
    contentFingerprint: createHash('sha256').update(canonical, 'utf8').digest('hex'),
  };
}

export function validateVisualBlockMapping(page, mapping) {
  const bound = bindVisualBlocks(page, mapping);
  return { valid: true, pageId: bound.pageId, blockCount: bound.blocks.length, contentFingerprint: bound.contentFingerprint };
}
