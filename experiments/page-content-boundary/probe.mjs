import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { prepareContentDraft } from '../../src/composition/content-stages.mjs';

// Existing simulated manuscript; source authority is fixed before page assignment.
const sourcePath = new URL('../visual-balance-cold-run/manuscript.md', import.meta.url);
const manuscript = await fs.readFile(sourcePath, 'utf8');
const selected = manuscript.split('## N1｜')[1].split('## N2｜')[0];
const paragraphs = selected.split(/\r?\n/).slice(1).map(s => s.trim()).filter(Boolean);
assert.equal(paragraphs.length, 3);
const source = paragraphs.map((text, i) => ({ id: `N1.p${i + 1}`, text }));

// This fixture does not claim good pagination: it isolates the scope of coverage.
function checkPage(ids, pageId) {
  const entries = ids.map(id => source.find(p => p.id === id));
  return prepareContentDraft({
    pageId,
    sourceParagraphs: entries.map(p => p.text),
    grouping: {
      topic: { sourceText: entries[0].text },
      groups: entries.slice(1).map(p => ({ id: p.id, title: p.id, role: 'analysis', sourceText: p.text })),
      relations: entries.slice(1).map(p => ({ type: 'support', from: [p.id], to: 'topic', meaning: '验证覆盖范围，非语义验收' })),
    },
  });
}

const scenarios = [
  { name: 'complete', pages: [['N1.p1', 'N1.p2', 'N1.p3']], expectedMissing: [], expectedRepeated: [] },
  { name: 'omit-condition-before-grouping', pages: [['N1.p1', 'N1.p2']], expectedMissing: ['N1.p3'], expectedRepeated: [] },
  { name: 'duplicate-across-pages', pages: [['N1.p1', 'N1.p2', 'N1.p3'], ['N1.p1', 'N1.p2', 'N1.p3']], expectedMissing: [], expectedRepeated: ['N1.p1', 'N1.p2', 'N1.p3'] },
];
const results = scenarios.map(scenario => {
  const pageResults = scenario.pages.map((ids, i) => ({ pageId: `P${i + 1}`, coverage: checkPage(ids, `P${i + 1}`).coverage }));
  const counts = new Map(source.map(p => [p.id, scenario.pages.flat().filter(id => id === p.id).length]));
  const missing = source.filter(p => counts.get(p.id) === 0).map(p => p.id);
  const repeated = source.filter(p => counts.get(p.id) > 1).map(p => p.id);
  assert.deepEqual(missing, scenario.expectedMissing);
  assert.deepEqual(repeated, scenario.expectedRepeated);
  assert.ok(pageResults.every(p => p.coverage === 'complete-verbatim'));
  return { name: scenario.name, assignments: scenario.pages, pageResults, manuscriptAudit: { missing, repeated }, expectedObservationConfirmed: true };
});

// Control: omission AFTER fixing the full page source is correctly rejected.
let omissionWithinPageRejected = false;
try {
  const draft = checkPage(['N1.p1', 'N1.p2', 'N1.p3'], 'control');
  prepareContentDraft({ pageId: 'control', sourceParagraphs: draft.sourceParagraphs, grouping: {
    ...structuredClone(draft.grouping),
    groups: draft.grouping.groups.slice(0, 1),
    relations: draft.grouping.relations.slice(0, 1),
  } });
} catch (error) {
  assert.match(error.message, /原稿未完整归组/);
  omissionWithinPageRejected = true;
}
assert.ok(omissionWithinPageRejected);
const report = {
  generatedAt: new Date().toISOString(),
  sourceFile: 'experiments/visual-balance-cold-run/manuscript.md',
  sourceSha256: createHash('sha256').update(manuscript).digest('hex'),
  section: 'N1', source, results, omissionWithinPageRejected,
  evidenceType: 'mechanism-only',
  conclusion: '页内完整覆盖不能证明整稿覆盖；分页前遗漏和跨页重复均不会被单页入口发现。重复主题可能合理，本实验只暴露重复，不把所有重复判为语义错误。',
};
await fs.writeFile(new URL('./result.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ scenarios: results.length, omissionWithinPageRejected, evidenceType: report.evidenceType, conclusion: report.conclusion }, null, 2));
