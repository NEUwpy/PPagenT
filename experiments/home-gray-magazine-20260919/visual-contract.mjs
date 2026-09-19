export const SUPPORTED_STRUCTURE = 'convergence-many-to-one-003';
export const normalize = value => String(value ?? '').replace(/[\s\p{P}]/gu, '');

// Experimental adapter: keeps every group/block and all visible prose from the gray plan.
// Diagram content is exact excerpt coverage, not a claim of automated semantic validation.
export function validateBlueprint(gray, blueprint) {
  const issues = [];
  if (gray.pages.length !== 1) return ['This pilot supports one gray page only'];
  const page = gray.pages[0];
  if (page.groups.some(g=>g.kind!=='text')) issues.push('Group-level non-text rendering is not supported in this pilot');
  if (!Array.isArray(blueprint.groupWeights) || blueprint.groupWeights.length !== page.groups.length
      || blueprint.groupWeights.some(x => !Number.isFinite(x) || x <= 0)) issues.push('groupWeights must match the gray groups');
  const expected = page.groups.flatMap(g => g.blocks.filter(b => b.kind && b.kind !== 'text').map(b => ({ group: g, block: b })));
  if (!Array.isArray(blueprint.diagrams) || blueprint.diagrams.length !== expected.length) return [...issues, 'Every gray non-text block must have exactly one diagram binding'];
  const seen = new Set();
  for (const d of blueprint.diagrams) {
    const match = expected.find(x => x.group.id === d.groupId && x.block.id === d.blockId);
    if (!match || seen.has(d.blockId)) { issues.push('Unknown or duplicate diagram block'); continue; }
    seen.add(d.blockId);
    if (d.assetId !== SUPPORTED_STRUCTURE) issues.push('Unsupported structure: report capability gap, do not silently substitute');
    if (!Array.isArray(d.inputs) || d.inputs.length < 3 || d.inputs.length > 6) { issues.push('Convergence requires 3-6 actual inputs'); continue; }
    const source = normalize(match.block.text);
    const pieces = [d.context, ...d.inputs].filter(Boolean).map(normalize);
    if (pieces.some(p => !p || !source.includes(p))) issues.push('Diagram wording must be exact excerpts of its gray block');
    if (pieces.join('') !== source) issues.push('Context and ordered inputs must cover the entire gray block without omission or repetition');
    if (d.result !== match.block.label) issues.push('Result must retain the gray block label');
    if (!d.reason?.trim()) issues.push('Explain causal membership and context separately');
  }
  return issues;
}
