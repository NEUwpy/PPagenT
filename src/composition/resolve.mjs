import { checkCompositionIntents } from './intent.mjs';

const positive = n => Number.isFinite(n) && n > 0;
const nonnegative = n => Number.isFinite(n) && n >= 0;
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export class CompositionFitError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'CompositionFitError';
    this.code = 'COMPOSITION_RECOMPOSE_REQUIRED';
    this.details = details;
  }
}

/** Resolve a semantic tree, never infer hierarchy from media type. No painting occurs here. */
export function resolveComposition({ pageId, intent, bodyFrame, contracts, style = {} }) {
  const checked = checkCompositionIntents({ pages: [{ pageId, compositionIntent: intent }] });
  if (checked.status !== 'passed') throw new Error(checked.issues.join('\n'));
  const body = structuredClone(bodyFrame);
  if (!body || !nonnegative(body.left) || !nonnegative(body.top) || !positive(body.width) || !positive(body.height)) throw new Error('Invalid bodyFrame');
  const gap = style.gap ?? 28;
  const innerGap = style.innerGap ?? gap;
  if (!nonnegative(gap) || !nonnegative(innerGap)) throw new Error('Invalid composition spacing');
  const groups = new Map(intent.groups.map(group => [group.id, group]));
  if (groups.size > 1 && !intent.relations?.length) throw new Error('执行组合需要显式 relations；不能仅声明图文区域');
  const connected = new Set((intent.relations ?? []).flatMap(r => [...r.from, r.to]));
  for (const group of groups.values()) {
    if (groups.size > 1 && !connected.has(group.id)) throw new Error(`内容组缺少逻辑关联: ${group.id}`);
    const contract = contracts?.[group.id];
    if (!positive(contract?.minWidth) || !positive(contract?.minHeight)) throw new Error(`缺少可读容量契约: ${group.id}`);
  }
  const measurements = new Map();
  const measure = (node, depth = 0) => {
    if (depth > 12) throw new Error('组合嵌套超过 12 层，请简化分组');
    let result;
    if (node.groupId) {
      const c = contracts[node.groupId];
      result = { width: c.minWidth, height: c.minHeight };
    } else {
      // Annotate needs actual component anchors, not arbitrary overlapping rectangles.
      if (node.op === 'annotate') throw new CompositionFitError('annotate 尚需组件锚点；请先用邻接嵌套组合，不能静默覆盖主图');
      const children = node.children.map(child => measure(child, depth + 1));
      const g = node.gap ?? (depth ? innerGap : gap);
      if (node.op === 'row') result = { width: children.reduce((s, c) => s + c.width, 0) + g * (children.length - 1), height: Math.max(...children.map(c => c.height)) };
      if (node.op === 'column') result = { width: Math.max(...children.map(c => c.width)), height: children.reduce((s, c) => s + c.height, 0) + g * (children.length - 1) };
      if (node.op === 'grid') {
        const cols = node.columns ?? Math.ceil(Math.sqrt(children.length));
        const rows = Math.ceil(children.length / cols);
        result = { width: Math.max(...children.map(c => c.width)) * cols + g * (cols - 1), height: Math.max(...children.map(c => c.height)) * rows + g * (rows - 1) };
      }
    }
    measurements.set(node, result);
    return result;
  };
  const minimum = measure(intent.composition);
  if (minimum.width > body.width + 1e-6 || minimum.height > body.height + 1e-6) throw new CompositionFitError('组合最小可读容量超过正文区，需要重组', { minimum, available: body });
  const regions = {};
  const allocate = (node, frame, depth = 0) => {
    if (node.groupId) { regions[node.groupId] = { ...frame }; return; }
    const g = node.gap ?? (depth ? innerGap : gap);
    if (node.op === 'grid') {
      const cols = node.columns ?? Math.ceil(Math.sqrt(node.children.length));
      const rows = Math.ceil(node.children.length / cols);
      const width = (frame.width - (cols - 1) * g) / cols;
      const height = (frame.height - (rows - 1) * g) / rows;
      node.children.forEach((child, i) => allocate(child, { left: frame.left + (i % cols) * (width + g), top: frame.top + Math.floor(i / cols) * (height + g), width, height }, depth + 1));
      return;
    }
    const horizontal = node.op === 'row';
    const dimension = horizontal ? 'width' : 'height';
    const axis = horizontal ? 'left' : 'top';
    const minimums = node.children.map(child => measurements.get(child)[dimension]);
    const spare = frame[dimension] - g * (node.children.length - 1) - minimums.reduce((a, b) => a + b, 0);
    const weights = node.weights ?? node.children.map(() => 1);
    const total = weights.reduce((a, b) => a + b, 0);
    let cursor = frame[axis];
    node.children.forEach((child, i) => {
      const size = minimums[i] + spare * weights[i] / total;
      allocate(child, { ...frame, [axis]: cursor, [dimension]: size }, depth + 1);
      cursor += size + g;
    });
  };
  allocate(intent.composition, body);
  return freeze(structuredClone({ pageId, intent, bodyFrame: body, regions, contracts, style: { gap, innerGap }, visualStatus: 'not-evaluated' }));
}

/** Builders must use the supplied frame for the complete group, including labels. */
export async function buildComposition({ resolved, builders }) {
  const ids = resolved.intent.readingOrder;
  for (const id of ids) if (typeof builders?.[id] !== 'function') throw new Error(`缺少内容组构建器: ${id}`);
  for (const id of Object.keys(builders)) if (!ids.includes(id)) throw new Error(`未知内容组构建器: ${id}`);
  const records = [];
  for (const id of ids) {
    const group = resolved.intent.groups.find(item => item.id === id);
    const relations = (resolved.intent.relations ?? []).filter(r => r.to === id || r.from.includes(id));
    const result = await builders[id]({ group, frame: resolved.regions[id], relations });
    records.push({ groupId: id, medium: group.medium, frame: resolved.regions[id], status: 'built-unreviewed', result });
  }
  return { pageId: resolved.pageId, records, visualStatus: 'not-evaluated' };
}
