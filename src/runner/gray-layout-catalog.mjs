// Current callable gray layout programs. This catalog declares their existing
// boundary; it does not approve new assets or promise final-Skin capacity.
export const GRAY_LAYOUT_PROGRAM_VERSION = 'gray-layout-programs-1';
export const GRAY_FONT_SIZES = Object.freeze([22, 20, 18]);
const variants = [
  ['cards-horizontal-equal', 'cards', 'horizontal', 'equal', '横排均分'],
  ['cards-horizontal-measured', 'cards', 'horizontal', 'measured', '横排实测分配'],
  ['cards-vertical-equal', 'cards', 'vertical', 'equal', '纵排均分'],
  ['cards-vertical-measured', 'cards', 'vertical', 'measured', '纵排实测分配'],
  ['album-horizontal-equal', 'album', 'horizontal', 'equal', '相册均分需求'],
  ['album-horizontal-measured', 'album', 'horizontal', 'measured', '相册实测需求'],
  ['cards-support-band', 'cards', 'support-band', 'measured', '主体与共同说明分带'],
];
export const GRAY_LAYOUT_PROGRAMS = Object.freeze(variants.map(([id, family, direction, allocation, name]) => Object.freeze({
  id, name, family, direction, allocation, version: GRAY_LAYOUT_PROGRAM_VERSION,
  minGroups: family === 'album' || direction === 'support-band' ? 2 : 1,
  maxGroups: 24,
  multiGroupRelations: Object.freeze(direction === 'support-band' ? ['parallel', 'independent', 'support'] : ['parallel', 'independent']),
  slots: 'One region per group, bound in readingOrder; content stays in the original blocks.',
  capacity: 'grayBodyLayout + fitGrayText at each candidate width; no fixed character-count capacity.',
  refusal: direction === 'support-band'
    ? 'Requires primary and contiguous supporting groups at page start/end; primary area must exceed support; minimum band gap 8px; real text must fit.'
    : 'Reject unknown relations requiring cross-group alignment/connectors, insufficient measured space, or invalid group count.',
})));

export function grayLayoutProgram(id) {
  const program = GRAY_LAYOUT_PROGRAMS.find(program => program.id === id);
  if (!program) throw new Error(`未登记灰稿版式 ${id}`);
  return program;
}

export function identifyGrayLayoutCandidate(candidate) {
  const program = grayLayoutProgram(candidate.id);
  for (const key of ['family', 'direction', 'allocation']) {
    if (candidate[key] !== program[key]) throw new Error(`候选 ${candidate.id} 的 ${key} 与登记不符`);
  }
  return { ...candidate, programVersion: program.version };
}
