import { resolveLayoutTree, CompositionFitError } from '../composition/resolve.mjs';
import { semanticPages, bindSemanticLayout } from './gray-semantics.mjs';

const LAYOUT_TYPES = ['single', 'row', 'column', 'grid'];
/** 布局树的组合节点最多三层：再深的层级用同层组合或回规划合并组表达。 */
const MAX_NEST_LEVEL = 3;
const GAP = 24;

/**
 * 归一化模型的布局选择为求解器组合树。
 * 简式 {type,weights?,columns?} 的 children 默认按阅读顺序取本页全部组；
 * 嵌套式 {type,weights?,columns?,children:[{groupId}|嵌套]} 表达分层（如"主区在上、注记横贯下方"）。
 * 叶子出现顺序必须与阅读顺序一致——区域顺序即阅读顺序，换视觉位置等于改阅读顺序，不允许。
 */
function normalizeLayoutTree(choice, ids, pageId) {
  const leaves = [];
  const walk = (node, level, isRoot) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) throw new Error('布局节点必须是对象');
    if (node.groupId !== undefined) {
      const extra = Object.keys(node).filter(key => key !== 'groupId');
      if (extra.length) throw new Error(`组引用节点只能有 groupId 字段（多了 ${extra.join('、')}）`);
      if (!ids.includes(node.groupId)) throw new Error(`未知组 ${node.groupId}；本页组：${ids.join('、')}`);
      leaves.push(node.groupId);
      return { groupId: node.groupId };
    }
    if (!LAYOUT_TYPES.includes(node.type)) throw new Error(`布局 type 必须是 ${LAYOUT_TYPES.join('/')}，当前 ${JSON.stringify(node.type)}`);
    const extraKeys = Object.keys(node).filter(key => !['type', 'weights', 'columns', 'children'].includes(key));
    if (extraKeys.length) throw new Error(`${node.type} 节点只能有 type/weights/columns/children 字段（多了 ${extraKeys.join('、')}）`);
    const children = node.children !== undefined ? node.children : (isRoot ? ids.map(groupId => ({ groupId })) : null);
    if (!Array.isArray(children) || !children.length) throw new Error(`${node.type} 缺少 children（嵌套节点必须显式给出）`);
    if (level > MAX_NEST_LEVEL) throw new Error(`布局嵌套超过 ${MAX_NEST_LEVEL} 层；深层结构请改成同层组合，或回规划把相关组合并`);
    if (node.type === 'single' && children.length !== 1) throw new Error('single 只能有一个子节点');
    if (node.weights !== undefined && node.type !== 'row') throw new Error(`weights 只能用于 row；当前 type=${node.type}，去掉 weights 即可（${node.type} 的分配由程序按实文高度自动处理）`);
    if (node.type === 'row' && node.weights !== undefined && (!Array.isArray(node.weights) || node.weights.length !== children.length || node.weights.some(w => !Number.isFinite(w) || w <= 0))) throw new Error(`row 的 weights 必须是长度 ${children.length}（与本节点子节点数一致）的正数数组；当前收到 ${JSON.stringify(node.weights)}`);
    if (node.columns !== undefined && node.type !== 'grid') throw new Error(`columns 只能用于 grid；当前 type=${node.type}`);
    if (node.type === 'grid' && node.columns !== undefined && (!Number.isInteger(node.columns) || node.columns < 1 || node.columns > children.length)) throw new Error(`grid 的 columns 必须是 1 到 ${children.length} 之间的整数；当前收到 ${JSON.stringify(node.columns)}`);
    return {
      op: node.type,
      ...(node.type === 'row' && node.weights ? { weights: node.weights } : {}),
      ...(node.type === 'grid' && node.columns ? { columns: node.columns } : {}),
      children: children.map(child => walk(child, level + 1, false)),
    };
  };
  const tree = walk(choice, 1, true);
  if (leaves.length !== ids.length || leaves.some((id, index) => id !== ids[index])) {
    const missing = ids.filter(id => !leaves.includes(id));
    const duplicated = [...new Set(leaves.filter((id, index) => leaves.indexOf(id) !== index))];
    throw new Error(`布局的组必须按阅读顺序恰好出现一次。缺失：${missing.join('、') || '无'}；重复：${duplicated.join('、') || '无'}；当前顺序：${leaves.join('、') || '空'}；应为：${ids.join('、')}`);
  }
  return tree;
}

/** 按组合树的各层比例估算每个组的分栏宽度，用于测量各组的最小可读容量。 */
function estimateLeafWidths(tree, width) {
  const widths = new Map();
  const walk = (node, available) => {
    if (node.groupId) { widths.set(node.groupId, available); return; }
    const count = node.children.length;
    if (node.op === 'single') { walk(node.children[0], available); return; }
    if (node.op === 'row') {
      const weights = node.weights ?? node.children.map(() => 1);
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      const usable = available - GAP * (count - 1);
      node.children.forEach((child, index) => walk(child, usable * weights[index] / total));
      return;
    }
    if (node.op === 'column') { node.children.forEach(child => walk(child, available)); return; }
    const columns = node.columns ?? Math.ceil(Math.sqrt(count));
    const columnWidth = (available - GAP * (columns - 1)) / columns;
    node.children.forEach(child => walk(child, columnWidth));
  };
  walk(tree, width);
  return widths;
}

/** 布局选择：简式或嵌套组合树，程序按真实文字容量求区域。 */
export function resolveGrayLayout(plan, selection, area, { measureBody, fitText }) {
  if (selection?.needsReplan) throw new CompositionFitError(selection.reason || '模型请求重组');
  if (!selection || Object.keys(selection).some(k => k !== 'pages') || !Array.isArray(selection.pages) || selection.pages.length !== plan.pages.length) throw new Error('排版只能返回同页数的pages');
  const pages = semanticPages(plan), layouts = [], receipts = [];
  for (const [index, page] of pages.entries()) {
    const entry = selection.pages[index];
    if (entry?.pageId !== page.pageId || Object.keys(entry).some(k => !['pageId', 'layout'].includes(k))) throw new Error('基础排版不能改正文或页序');
    const choice = entry.layout, ids = page.semantics.readingOrder;
    if (!choice || typeof choice !== 'object') throw new Error('每页必须给出 layout');
    const tree = normalizeLayoutTree(choice, ids, page.pageId);
    const widthsById = estimateLeafWidths(tree, area.width);
    const contracts = {};
    for (const id of ids) {
      const item = page.items.find(item => item.id === id), width = widthsById.get(id);
      if (!(width >= 100)) throw new CompositionFitError('基础分栏过窄，请减少同排组数或调整比例', { pageId: page.pageId, itemId: id, width });
      const heading = fitText(item.heading, width - 32, 40, 26);
      if (!heading.fits) throw new CompositionFitError('组标题无法单行容纳，请改组合或返回规划缩短标题', { pageId: page.pageId, itemId: id, width, heading: item.heading });
      const body = measureBody(item, width - 32, 22);
      if (!body.fits) throw new CompositionFitError('该宽度不能完整容纳正文', { pageId: page.pageId, itemId: id, width });
      contracts[id] = { minWidth: width, minHeight: Math.max(80, Math.ceil(70 + body.height)) };
    }
    const composition = tree.op === 'single' ? tree.children[0] : tree;
    let solved;
    try {
      solved = resolveLayoutTree({ composition, bodyFrame: { left: 0, top: 0, width: area.width, height: area.height }, contracts, style: { gap: GAP } });
      // 内容明显少于正文区时不再把各组拉到满高：满高会让空框自己声明"这里该有内容"。
      // 只在稀疏页面收缩（自然高度 < 55% 正文区），丰实页面照旧铺满。
      if (solved.minimum.height < area.height * 0.55) {
        const frameHeight = Math.max(96, Math.ceil(solved.minimum.height * 1.1));
        solved = resolveLayoutTree({ composition, bodyFrame: { left: 0, top: 0, width: area.width, height: frameHeight }, contracts, style: { gap: GAP } });
      }
    } catch (error) {
      if (error.code === 'COMPOSITION_RECOMPOSE_REQUIRED') {
        // 容量只报"需要重组"不足以让模型收敛：给出实测最小尺寸与出路（合组/精简/分页）。
        const minimum = error.details?.minimum;
        throw new CompositionFitError(
          `一页放不下：该页最小可读尺寸约 ${Math.ceil(minimum?.width ?? 0)}×${Math.ceil(minimum?.height ?? 0)}，正文区 ${area.width}×${area.height}（超出约 ${Math.max(0, Math.ceil((minimum?.height ?? 0) - area.height))}px）。先在本页内解决：改更省空间的组合（同排多栏、规则网格），合并同归属的组，按原稿允许的提炼压紧冗词（不丢必要内容）。仍放不下时按真实归属边界整块分页（整个分支或整个条目组一起移动），不要按条目打散、把同一分支拆到多页。修订后直接重试渲染，不要反复跑检查工具空转。`,
          { pageId: page.pageId, layout: choice, minimum, available: { width: area.width, height: area.height }, groupCapacities: contracts },
        );
      }
      throw error;
    }
    const regions = ids.map(id => {
      const frame = solved.regions[id];
      return { itemId: id, x: frame.left, y: frame.top, width: frame.width, height: frame.height, fontSize: 22 };
    });
    layouts.push({ pageId: page.pageId, regions });
    receipts.push({ pageId: page.pageId, layout: structuredClone(choice), resolved: solved, occupiedRegions: regions, contentMinimums: contracts });
  }
  const bound = bindSemanticLayout(plan, { pages: layouts });
  bound.pages.forEach((page, i) => { page.composition.basicLayout = receipts[i].layout; });
  return { plan: bound, receipts };
}
