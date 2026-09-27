// Preserve nested expression requirements; a text group may own a diagram block.
export function expressionRequirements(page) {
  return page.items.flatMap(item => {
    const requirements = [];
    const visit = (node, location) => {
      if (node.kind && node.kind !== 'text') requirements.push({
        itemId: item.id, location, kind: node.kind,
        expression: node.expression ?? '', relationship: node.relationship ?? '',
        production: node.production ?? '',
      });
      (node.blocks ?? []).forEach((block, i) => visit(block, `${location}/${block.id ?? i}`));
    };
    visit(item, item.id);
    return requirements;
  });
}

export function missingExpressions(page, plan) {
  if (plan?.compositionId === 'component-gray-regions') return expressionRequirements(page).filter(r => r.location !== plan.structure?.sourceLocation);
  const bound = new Set(plan?.structure?.sourceItemIds ?? []);
  return expressionRequirements(page).filter(r => !bound.has(r.itemId));
}

export function validateGrayRegionPlan(page, plan) {
  if (plan?.compositionId !== 'component-gray-regions') throw new Error('灰稿必须保留原分区，使用 component-gray-regions，不能重选整页结构版式');
  const requirements = expressionRequirements(page);
  if (requirements.length !== 1) throw new Error('当前灰稿局部结构接口要求恰好一个图示区；多图示/纯文字支持尚未验证');
  const req = requirements[0];
  if (plan.structure?.sourceLocation !== req.location || JSON.stringify(plan.structure?.sourceItemIds) !== JSON.stringify([req.itemId])) throw new Error('结构只能绑定精确图示区及其所属内容项，不能吞并文字区');
  if (plan.textSlots?.length) throw new Error('灰稿文字区由原文自动渲染，textSlots 必须为空');
  const regions = page.grayComposition?.regions ?? [];
  if (plan.regionVisuals !== undefined) {
    const styles = plan.regionVisuals;
    if (!Array.isArray(styles) || styles.length !== page.items.length || new Set(styles.map(s=>s.itemId)).size !== styles.length || page.items.some(i=>!styles.some(s=>s.itemId===i.id))) throw new Error('regionVisuals 必须逐区完整且唯一对应灰稿内容');
    for (const style of styles) {
      if (!['plain','outline','dashed-gradient'].includes(style.surface) || typeof style.reason !== 'string' || !style.reason.trim() || typeof style.headingEnglish !== 'string' || !/^[A-Za-z0-9 &/()–-]{0,36}$/.test(style.headingEnglish)) throw new Error('灰稿区域视觉方案非法');
    }
  }
  if (regions.length !== page.items.length || new Set(regions.map(r=>r.itemId)).size !== regions.length || page.items.some(i=>!regions.some(r=>r.itemId===i.id))) throw new Error('灰稿区域与内容归属不完整');
}
