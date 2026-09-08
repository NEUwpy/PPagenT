import test from 'node:test';
import assert from 'node:assert/strict';
import { structureSkillProfile } from '../src/runtime/structure-skill-profile.mjs';
import { collectLogicDashboardData } from '../src/tools/logic-dashboard-data.mjs';
import { execFileSync } from 'node:child_process';
import { listStructureSkills, loadStructureSkill } from '../src/runtime/structure-skills.mjs';

test('missing evidence is disclosed rather than inferred from a name', () => {
  const profile = structureSkillProfile({ name: 'folded notes' });
  assert.equal(profile.evidenceStatus, 'needs-inspection');
  assert.equal(profile.identityEvidence, '');
});

test('dashboard and Skill guide expose the same real asset evidence', async () => {
  const data = await collectLogicDashboardData();
  const guide = JSON.parse(execFileSync(process.execPath, [
    '.codex/skills/ppagent-structure/scripts/catalog.mjs', 'guide', 'parallel-folded-notes-grid-002',
  ], { encoding: 'utf8' }));
  const find = value => {
    if (!value || typeof value !== 'object') return null;
    if (value.id === guide.referenceAssetId && value.structureSkill) return value;
    return Object.values(value).map(find).find(Boolean);
  };
  const { identityEvidence, fixedEvidence, variableEvidence, ...currentSkill } = find(data).structureSkill;
  assert.deepEqual(currentSkill, guide.skill);
  assert.match(identityEvidence, /独立卷页/);
  assert.equal(guide.skill.variableEvidence, undefined);
  assert.equal(guide.visualIntent, undefined);
  assert.match(guide.referenceImplementation.exampleCode, /review\.mjs$/);
  const inspected = JSON.parse(execFileSync(process.execPath, [
    '.codex/skills/ppagent-structure/scripts/catalog.mjs', 'inspect', guide.referenceAssetId,
  ], { encoding: 'utf8' }));
  assert.equal(inspected.provenance.identityEvidence, identityEvidence);
  assert.match(guide.skill.executorBoundary, /重新验证/);
  assert.equal(guide.skill.evidenceStatus, 'authored-guide');
  assert.match(guide.skill.adaptation, /行数/);
});

test('every core design has an authored guide without old text-slot requirements', async () => {
  for (const asset of await listStructureSkills()) {
    const p = await loadStructureSkill(asset.assetId);
    assert.equal(p.guide?.assetId, asset.assetId);
    assert.equal(p.skill.evidenceStatus, 'authored-guide');
    assert.doesNotMatch(p.skill.features.join(' '), /TextRegion|TextFlow|Slot Contract|stateFootprints/);
    assert.ok(p.skill.validation.status);
  }
});
