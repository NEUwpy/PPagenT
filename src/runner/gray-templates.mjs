/**
 * 灰稿版式模板（骨架默认，2026-09-18 拍板；规则真源：rules/页面组合.md「版式模板库」，
 * 代码与真源同步由测试守卫）。模板管结构形态默认，不承担内容理解与表达选择；
 * 程序按内容特征选默认，模型可覆盖但须一句话理由（入档分析）；覆盖率是双面 KPI。
 */
export const TEMPLATES = Object.freeze([
  { id: 'category-container', name: '类别容器', role: '类别或分支页：一个容器内逐条列出条目', fit: '单组且组内 ≥2 块' },
  { id: 'single-subject', name: '单主体', role: '单一主体（可带附注）：主体在上、附注承接', fit: '单组；或两组且一组为 supporting（主辅，非对照）' },
  { id: 'dual-column', name: '双栏对照', role: '两个并列对象或分支的直接对照', fit: '两组且均为 primary' },
  { id: 'row-list', name: '行式清单', role: '多个等位条目沿阅读顺序顺列', fit: '三组及以上（无头带特征时）' },
  { id: 'band-main', name: '头带主线', role: '短结论/现状并排成头带，主流程或主体全幅在下', fit: '三组、末组为唯一非 text 且前两组为短文本' },
]);

const templateById = id => TEMPLATES.find(template => template.id === id);

const textLength = group => (group.blocks ?? []).reduce((sum, block) => sum + String(block.text ?? '').length, 0);
const importanceOf = group => group.importance ?? 'primary';
const kindOf = group => group.kind ?? 'text';

/** 内容特征：组数、各组块数与实文量、非 text 组占比（用于默认映射与台账分析）。 */
export function pageFeatures(page) {
  const groups = page.groups ?? [];
  return {
    groupCount: groups.length,
    blocksPerGroup: groups.map(group => (group.blocks ?? []).length),
    textLengths: groups.map(textLength),
    nonTextGroups: groups.filter(group => kindOf(group) !== 'text').length,
    supporting: groups.filter(group => importanceOf(group) === 'supporting').length,
  };
}

/** 双栏 weights 按实文量分配（小整数，和为 5；仅用于默认，模型可自行微调）。 */
const weightsFor = lengths => {
  const total = lengths.reduce((sum, value) => sum + value, 0) || 1;
  const first = Math.min(4, Math.max(1, Math.round((5 * lengths[0]) / total)));
  return [first, 5 - first];
};

/** 头带主线：三组、末组为唯一非 text 主体、前两组短文本并排（B02 覆盖样本 fixture）。 */
const bandMainLayout = groups => ({
  type: 'column',
  children: [
    { type: 'row', children: [{ groupId: groups[0].id }, { groupId: groups[1].id }] },
    { groupId: groups[2].id },
  ],
});

/** 特征 → 默认模板。映射不出的情形给保守默认（单主体，column 堆叠）。 */
export function defaultTemplateFor(page) {
  const groups = page.groups ?? [];
  const features = pageFeatures(page);
  if (features.groupCount === 1) {
    const id = features.blocksPerGroup[0] >= 2 ? 'category-container' : 'single-subject';
    return { ...templateById(id), layout: { type: 'single' }, features };
  }
  if (features.groupCount === 2) {
    if (features.supporting === 1) {
      return { ...templateById('single-subject'), layout: { type: 'column' }, features };
    }
    return { ...templateById('dual-column'), layout: { type: 'row', weights: weightsFor(features.textLengths) }, features };
  }
  if (features.groupCount === 3) {
    const band = groups.slice(0, 2);
    const main = groups[2];
    const bandText = band.every(group => kindOf(group) === 'text' && group.id) && textLength(band[0]) + textLength(band[1]) <= 160;
    if (features.nonTextGroups === 1 && kindOf(main) !== 'text' && main.id && bandText) {
      return { ...templateById('band-main'), layout: bandMainLayout(groups), features };
    }
  }
  if (features.groupCount >= 3) {
    return { ...templateById('row-list'), layout: { type: 'column' }, features };
  }
  return { ...templateById('single-subject'), layout: { type: 'column' }, features };
}

/** check_plan 回执用的逐页默认模板摘要（含特征依据；把默认提前暴露，避免猜一版被打回）。 */
export function describeDefaults(plan) {
  return (plan?.pages ?? []).map(page => {
    const template = defaultTemplateFor(page);
    return {
      pageId: page.pageId,
      template: template.id,
      name: template.name,
      features: { groupCount: template.features.groupCount, blocksPerGroup: template.features.blocksPerGroup, textLengths: template.features.textLengths, supporting: template.features.supporting, nonTextGroups: template.features.nonTextGroups },
    };
  });
}

/** 形状指纹：只看 type 与 children 结构，忽略 weights/columns（微调 weights 不算覆盖）。 */
export function layoutShape(layout) {
  if (!layout || typeof layout !== 'object') return 'invalid';
  if (layout.groupId) return 'group';
  if (Array.isArray(layout.children) && layout.children.length) return `${layout.type}[${layout.children.map(layoutShape).join(',')}]`;
  return String(layout.type ?? 'invalid');
}

/**
 * 应用模板默认：页条目可只写 {pageId} 采用默认；形状与默认不同时必须带 override:{reason}。
 * 返回 {layouts, decisions}——decisions 入档（templates.json）供覆盖率 KPI 与理由样本分析。
 */
export function applyTemplateDefaults(plan, layouts) {
  const pages = plan?.pages ?? [];
  const entries = new Map((layouts ?? []).map(entry => [entry?.pageId, entry]));
  for (const entry of layouts ?? []) {
    if (!pages.some(page => page.pageId === entry?.pageId)) throw new Error(`layouts 含未知页面：${entry?.pageId ?? '(无 pageId)'}`);
  }
  const applied = [];
  const decisions = [];
  for (const page of pages) {
    const entry = entries.get(page.pageId) ?? { pageId: page.pageId };
    const template = defaultTemplateFor(page);
    if (entry.layout === undefined) {
      decisions.push({ pageId: page.pageId, template: template.id, name: template.name, mode: 'default' });
      applied.push({ pageId: page.pageId, layout: structuredClone(template.layout) });
      continue;
    }
    if (layoutShape(entry.layout) === layoutShape(template.layout)) {
      decisions.push({ pageId: page.pageId, template: template.id, name: template.name, mode: 'default' });
      applied.push({ pageId: page.pageId, layout: entry.layout });
      continue;
    }
    const reason = typeof entry.override?.reason === 'string' ? entry.override.reason.trim() : '';
    if (!reason) {
      throw new Error(`页 ${page.pageId} 的组合与默认模板「${template.name}」（${layoutShape(template.layout)}）不同：采用默认（该页不写 layout），或在页条目加 override:{reason:"一句话理由"}（理由会入档分析）`);
    }
    decisions.push({ pageId: page.pageId, template: template.id, name: template.name, mode: 'override', reason, chosen: layoutShape(entry.layout), ...(entry.override?.template ? { picked: String(entry.override.template) } : {}) });
    // 只向下游传 {pageId, layout}：override 理由已入 decisions，不能随 layouts 进求解器（否则被判为非法字段）。
    applied.push({ pageId: page.pageId, layout: entry.layout });
  }
  return { layouts: applied, decisions };
}
