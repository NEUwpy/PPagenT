import { requireExpandedManuscript } from '../../../src/runner/gray-agent.mjs';
import { grayBodyLayout, fitGrayText, validateGrayArea, validateGrayPlan } from '../../../src/runner/gray-draft.mjs';
import { bindLayoutSelection, measuredLayoutCandidates } from '../../../src/runner/gray-layout-selection.mjs';
import { validateSemanticPlan } from '../../../src/runner/gray-semantics.mjs';
import { newRunState } from '../../../src/runner/state.mjs';

function asLegacyPlan(manuscript) {
  const groups = [];
  const add = (id, heading, importance, fields) => groups.push({
    id, heading, importance, role: '原稿内容', kind: 'text',
    blocks: fields.map(field => ({ id: field.key, text: field.text, sourceIds: [field.sourceId] })),
  });
  if (manuscript.type === 'grouped-prose') {
    for (const group of manuscript.groups) {
      add(group.key, group.lead.text, 'primary', group.items.map(item => ({
        ...item.body, text: item.title.text + item.body.text,
      })));
    }
  } else {
    for (const object of manuscript.objects) {
      add(object.key, object.title.text, 'primary', object.cells ?? [object.body]);
    }
    add('shared', '共同说明', 'supporting', [manuscript.shared]);
  }
  return { schemaVersion: 'gray-plan-3', deckBrief: { title: manuscript.title.text }, pages: [{
    pageId: manuscript.id, title: manuscript.title.text, claim: manuscript.title.text,
    pagePurpose: '保留并呈现原稿', narrative: manuscript.type, sourceIds: [manuscript.title.sourceId], groups,
  }] };
}

// Isolated baseline. The HTML route does not depend on this scan or its estimates.
export function legacyProbe(raw, sourceFile, frame, manuscript) {
  const area = validateGrayArea({ width: frame.width, height: frame.height });
  requireExpandedManuscript(raw);
  const state = newRunState(raw, sourceFile);
  const plan = asLegacyPlan(manuscript);
  const semantic = validateSemanticPlan(state, plan);
  const [measured] = measuredLayoutCandidates(plan, area, { measureBody: grayBodyLayout, fitText: fitGrayText });
  const relation = { comparison: 'comparison', parallel: 'support', 'grouped-prose': 'independent' }[manuscript.type];
  const candidateId = manuscript.type === 'grouped-prose' ? 'cards-horizontal-measured' : 'cards-support-band';
  const probe = { semantic, measured, selection: { pageId: manuscript.id, candidateId, relation, reason: '按原稿语义尝试既有候选' } };
  try {
    const bound = bindLayoutSelection(plan, [measured], { pages: [probe.selection] });
    const { accepted, issues, warnings, coverage } = validateGrayPlan(state, bound.plan, area);
    return { ...probe, binding: 'accepted', receipts: bound.receipts, compiledPlanValidation: { accepted, issues, warnings, coverage } };
  } catch (error) {
    return { ...probe, binding: 'rejected', message: error.message };
  }
}
