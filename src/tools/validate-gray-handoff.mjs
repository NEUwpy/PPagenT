// Standalone proposal checker. Does not change runner state, freeze a package,
// launch models/browsers, compile PPTX, or confer semantic/visual acceptance.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { newRunState } from '../runner/state.mjs';
import { semanticPages, validateSemanticPlan } from '../runner/gray-semantics.mjs';
import { TEMPLATES } from '../runner/gray-templates.mjs';
import { listStructureSkills, loadStructureSkill } from '../runtime/structure-skills.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const schema = JSON.parse(await fs.readFile(path.join(root, 'schemas/gray-handoff.schema.json'), 'utf8'));
const checkShape = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
const sha = value => createHash('sha256').update(value).digest('hex');

export function canonicalJson(value) {
  const canonical = node => Array.isArray(node) ? node.map(canonical)
    : node !== null && typeof node === 'object'
      ? Object.fromEntries(Object.keys(node).sort().map(key => [key, canonical(node[key])])) : node;
  return JSON.stringify(canonical(value));
}

export function handoffFingerprints(pkg) {
  return {
    contentSha256: sha(canonicalJson({ origin: pkg.origin, sources: pkg.sources, plan: pkg.plan })),
    bindingSha256: sha(canonicalJson({ canvas: pkg.canvas, pageBindings: pkg.pageBindings })),
  };
}

function assert(condition, message) { if (!condition) throw new Error(message); }
function unique(values, name) { assert(new Set(values).size === values.length, `${name} 重复`); }
function pathTokens(target) {
  const tokens = target.replace(/\[(\d+)\]/g, '.$1').split('.');
  assert(tokens.every(token => !['__proto__', 'constructor', 'prototype'].includes(token)), '槽位路径含禁止键');
  return tokens;
}
function bindField(parameters, target, value) {
  const tokens = pathTokens(target);
  let cursor = parameters;
  for (let index = 0; index < tokens.length - 1; index++) {
    const key = tokens[index];
    if (!Object.hasOwn(cursor, key)) cursor[key] = /^\d+$/.test(tokens[index + 1]) ? [] : {};
    assert(cursor[key] !== null && typeof cursor[key] === 'object', `槽位路径冲突 ${target}`);
    cursor = cursor[key];
  }
  const key = tokens.at(-1);
  assert(!Object.hasOwn(cursor, key), `槽位 ${target} 重复或 parameters 中存在第二份绑定值`);
  cursor[key] = value;
}

export function expressionParameters(page, expression) {
  const parameters = structuredClone(expression.parameters);
  for (const binding of expression.slotBindings) {
    const ref = binding.contentRef;
    const group = page.groups.find(group => group.id === ref.groupId);
    const node = ref.blockId ? group?.blocks.find(block => block.id === ref.blockId) : group;
    assert(node && Object.hasOwn(node, ref.field), `槽位 ${binding.target} 引用了不存在的内容字段`);
    bindField(parameters, binding.target, node[ref.field]);
  }
  return parameters;
}

function checkLayout(node, ids, depth = 1, isRoot = true) {
  if (node.groupId) { assert(!isRoot && ids.includes(node.groupId), '布局叶子须引用本页组'); return [node.groupId]; }
  assert(depth <= 3, '布局组合超过三层');
  const children = node.children ?? (isRoot ? ids.map(groupId => ({ groupId })) : []);
  assert(children.length > 0, '嵌套组合必须声明 children');
  assert(node.type !== 'single' || children.length === 1, 'single 只能有一个子节点');
  if (node.weights) assert(node.type === 'row' && node.weights.length === children.length, 'weights 仅用于 row，且须与子节点数一致');
  if (node.columns !== undefined) assert(node.type === 'grid' && node.columns <= children.length, 'columns 仅用于 grid，且不得超过子节点数');
  return children.flatMap(child => checkLayout(child, ids, depth + 1, false));
}

export async function validateGrayHandoff(pkg, { rootDir = root } = {}) {
  if (!checkShape(pkg)) return { accepted: false, issues: structuredClone(checkShape.errors), coverage: 'Schema only' };
  const issues = [], warnings = [], materialized = [];
  const inspect = async operation => { try { await operation(); } catch (error) { issues.push(error.message); } };
  await inspect(() => {
    const expected = handoffFingerprints(pkg);
    for (const key of Object.keys(expected)) assert(pkg.freeze[key] === expected[key], `${key} 不匹配：字段或绑定已变更`);
    unique(pkg.sources.map(source => source.id), '来源 ID');
    assert(canonicalJson(pkg.plan.pages.map(page => page.pageId)) === canonicalJson(pkg.pageBindings.map(page => page.pageId)), 'pageBindings 必须与内容页序一一对应');
  });
  const base = { ...newRunState('', 'gray-handoff.json'), sources: pkg.sources };
  const semantic = validateSemanticPlan(base, pkg.plan);
  issues.push(...semantic.issues.map(issue => `${issue.code}: ${issue.message}`));
  warnings.push(...semantic.warnings);
  // Existing compiler also checks the supported visualMapping boundaries.
  await inspect(() => semanticPages(pkg.plan));
  const skills = new Map((await listStructureSkills(rootDir)).map(item => [item.assetId, item]));
  for (const binding of pkg.pageBindings) await inspect(async () => {
    const page = pkg.plan.pages.find(page => page.pageId === binding.pageId);
    assert(page, '绑定引用未知页');
    const groups = new Map(page.groups.map(group => [group.id, group]));
    const order = page.readingOrder ?? [...groups.keys()];
    assert(TEMPLATES.some(template => template.id === binding.layout.layoutId), `页面版式尚未登记 ${binding.layout.layoutId}`);
    const leaves = checkLayout(binding.layout.parameters, order);
    assert(canonicalJson(leaves) === canonicalJson(order), '布局须按阅读顺序完整且唯一引用各组');
    unique(binding.regions.map(region => region.regionId), 'regionId');
    unique(binding.regions.map(region => region.groupId), '区域归属');
    assert(binding.regions.length === groups.size && binding.regions.every(region => groups.has(region.groupId)), 'MVP 区域须与原组一一对应');
    unique(binding.expressions.map(expression => expression.expressionId), 'expressionId');
    const coverage = new Map(page.groups.flatMap(group => group.blocks.map(block => [`${group.id}/${block.id}`, []])));
    for (const expression of binding.expressions) {
      const region = binding.regions.find(region => region.regionId === expression.regionId);
      assert(region, '表达引用未知区域');
      const group = groups.get(region.groupId);
      const [ownerId, ownerBlock, ...extra] = expression.sourceLocation.split('/');
      const owner = ownerBlock ? group.blocks.find(block => block.id === ownerBlock) : group;
      assert(ownerId === group.id && owner && extra.length === 0, 'sourceLocation 与区域归属不一致');
      const own = new Set();
      const blockOrder = group.blocks.map(block => block.id);
      let lastBlockIndex = -1;
      for (const ref of expression.contentRefs) {
        const key = `${ref.groupId}/${ref.blockId}`;
        assert(ref.groupId === group.id && coverage.has(key), '表达不能跨组或引用未知正文');
        assert(!ownerBlock || ref.blockId === ownerBlock, '局部表达不能吞并其他块');
        const blockIndex = blockOrder.indexOf(ref.blockId);
        assert(blockIndex > lastBlockIndex, 'contentRefs 必须保持原块阅读顺序'); lastBlockIndex = blockIndex;
        assert(!own.has(key), '同一表达重复引用正文'); own.add(key);
        coverage.get(key).push(expression.expressionId);
      }
      for (const slot of expression.slotBindings) {
        const ref = slot.contentRef;
        assert(ref.groupId === group.id && (!ref.blockId || own.has(`${ref.groupId}/${ref.blockId}`)), '槽位不能引用表达未拥有的内容');
      }
      if (expression.capacityRef) {
        const file = path.resolve(rootDir, expression.capacityRef.path);
        const relative = path.relative(rootDir, file);
        assert(!relative.startsWith('..') && !path.isAbsolute(relative), '容量声明必须位于工作区');
        assert(sha(await fs.readFile(file)) === expression.capacityRef.sha256, '容量声明版本不匹配');
      }
      if (expression.selection.status === 'missing') {
        assert(pkg.freeze.status === 'draft', 'frozen 包不能保留 missing 能力');
        warnings.push({ code: 'capability-missing', pageId: page.pageId, sourceLocation: expression.sourceLocation, message: expression.selection.reason });
        continue;
      }
      const kind = owner.kind ?? 'text';
      if (expression.kind === 'text') {
        assert(['text', 'note'].includes(kind), '非文字表达需求不能用文字程序替代');
        assert(expression.selection.programId === 'source-text-v1' && !expression.selection.assetId, '文字程序尚未登记或混入结构选择');
        assert(page.groups.every(group => group.kind === 'text' && group.blocks.every(block => ['text', 'note'].includes(block.kind ?? 'text'))), 'source-text-v1 当前只支持纯文字页');
        assert(expression.slotBindings.length === 0 && Object.keys(expression.parameters).length === 0, '文字回填不接受第二份正文或自由参数');
      } else if (expression.kind === 'structure') {
        assert(['diagram', 'flow', 'table'].includes(kind), '结构选择须对应已声明图示需求');
        const descriptor = skills.get(expression.selection.assetId);
        assert(descriptor && expression.selection.execution === 'preserved-design', '结构缺少 core 资产或保真执行登记');
        assert(expression.capacityRef, '选定结构必须固定 capacityRef 版本');
        assert(descriptor.runtime.variantId === expression.selection.variantId, '结构 variantId 与登记不符');
        const ref = await loadStructureSkill(descriptor.assetId, rootDir);
        const module = await import(pathToFileURL(path.resolve(ref.assetDir, ref.guide.exampleImplementation)).href);
        const component = module[ref.runtime.review?.componentExport ?? 'visualComponent'];
        for (const [key, value] of Object.entries(expression.parameters)) {
          if (typeof value === 'string') assert((ref.runtime.review?.controls ?? []).some(control => control.key === key && control.values.includes(value)), 'parameters 字符串只能使用资产登记的状态选项，正文须通过槽位引用');
          assert(!['title', 'heading', 'label', 'text', 'body', 'claim'].includes(key), 'parameters 不接受上屏内容字段');
        }
        // For indexed node collections, check source order before rendering.
        // This validates binding order, not the semantic suitability of an asset.
        const collections = new Map();
        for (const slot of expression.slotBindings) {
          const match = slot.target.match(/^([A-Za-z_][A-Za-z_0-9]*)\[(\d+)\]/);
          if (!match || !slot.contentRef.blockId) continue;
          const entries = collections.get(match[1]) ?? new Map();
          const index = Number(match[2]);
          const sourceId = slot.contentRef.blockId;
          assert(!entries.has(index) || entries.get(index) === sourceId, '同一节点槽位不能混入其他块');
          entries.set(index, sourceId); collections.set(match[1], entries);
        }
        for (const entries of collections.values()) {
          const order = [...entries].sort((a, b) => a[0] - b[0]).map(([, id]) => blockOrder.indexOf(id));
          assert(order.every((value, index) => index === 0 || value > order[index - 1]), '节点槽位必须保持内容块先后顺序');
        }
        const parameters = expressionParameters(page, expression);
        for (const content of expression.contentRefs) {
          const block = group.blocks.find(block => block.id === content.blockId);
          for (const field of ['label', 'text']) if (block[field]) assert(expression.slotBindings.some(slot => slot.contentRef.groupId === group.id && slot.contentRef.blockId === block.id && slot.contentRef.field === field), `结构漏绑正文 ${group.id}/${block.id}.${field}`);
        }
        assert(component.renderMarkup(parameters).includes('data-ppt-root'), '资产未产生有效结构标记');
        materialized.push({ pageId: page.pageId, expressionId: expression.expressionId, assetId: descriptor.assetId, parameters });
      } else throw new Error(`${expression.kind} 尚未接入提案检查器，先记录 missing 能力`);
    }
    for (const [location, owners] of coverage) assert(owners.length === 1, `正文 ${location} 必须由一个表达完整承载，当前 ${owners.length}`);
    for (const group of page.groups) for (const [index, block] of group.blocks.entries()) {
      if (block.kind === 'note') assert(coverage.get(`${group.id}/${block.id}`)[0] === coverage.get(`${group.id}/${group.blocks[index - 1]?.id}`)?.[0], '附注必须与所依附条目同属表达');
      if (block.scope === 'group') assert(group.blocks.every(other => coverage.get(`${group.id}/${other.id}`)[0] === coverage.get(`${group.id}/${block.id}`)[0]), '共同说明的作用范围不能拆散到其他表达');
    }
  });
  return { accepted: issues.length === 0, issues, warnings, materialized,
    coverage: 'Schema、来源与引用、冻结指纹、布局树、正文覆盖、已有结构参数标记；不检查实文容量/原生导出/视觉，不接入生产也不执行冻结。' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const file = process.argv[2];
  if (!file) throw new Error('用法：node src/tools/validate-gray-handoff.mjs <gray-handoff.json>');
  const pkg = JSON.parse(await fs.readFile(file, 'utf8'));
  const report = await validateGrayHandoff(pkg);
  console.log(JSON.stringify(report, null, 2));
  if (!report.accepted) process.exitCode = 1;
}
