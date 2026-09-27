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
  const bound = new Set(plan?.structure?.sourceItemIds ?? []);
  return expressionRequirements(page).filter(r => !bound.has(r.itemId));
}
