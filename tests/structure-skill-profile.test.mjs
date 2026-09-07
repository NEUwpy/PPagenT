import test from 'node:test';
import assert from 'node:assert/strict';
import { structureSkillProfile } from '../src/runtime/structure-skill-profile.mjs';
import { collectLogicDashboardData } from '../src/tools/logic-dashboard-data.mjs';
import { execFileSync } from 'node:child_process';

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
  assert.deepEqual(find(data)?.structureSkill, guide.skill);
  assert.match(guide.skill.identityEvidence, /独立卷页/);
  assert.match(guide.skill.executorBoundary, /重新验证/);
});
