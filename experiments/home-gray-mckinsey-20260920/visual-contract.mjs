import { validateBlueprint as validateGray, SUPPORTED_STRUCTURE } from '../home-gray-magazine-20260919/visual-contract.mjs';
export { SUPPORTED_STRUCTURE };
export function validateBlueprint(gray, blueprint) {
  const issues=validateGray(gray,blueprint);
  if(typeof blueprint.sectionTitle!=='string'||!blueprint.sectionTitle.trim()||[...blueprint.sectionTitle].length>4||/[\r\n]/.test(blueprint.sectionTitle)) issues.push('Section title must fit the inherited 178px header: 1–4 characters, one line');
  if(typeof blueprint.headline!=='string'||blueprint.headline.trim().length<8||[...blueprint.headline].length>32||/[\r\n]/.test(blueprint.headline)) issues.push('Headline must be one line, 8–32 characters; never shrink the fixed template title');
  const blocks=gray.pages.flatMap(p=>p.groups.flatMap(g=>g.blocks));
  if(!Array.isArray(blueprint.headlineEvidence)||new Set(blueprint.headlineEvidence).size<2||blueprint.headlineEvidence.some(id=>!blocks.some(b=>b.id===id))) issues.push('Headline needs at least two distinct existing evidence block IDs');
  return issues;
}
