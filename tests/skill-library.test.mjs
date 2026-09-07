import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getSkillBinding, verifySkill } from '../skills/library.mjs';
import { listSkills } from '../skills/library.mjs';

test('project structure precedes Archify and binding includes selection policy',async()=>{
  const skills=await listSkills();
  assert(skills.findIndex(s=>s.id==='ppagent-structure') < skills.findIndex(s=>s.id==='archify'));
  const binding=await getSkillBinding('archify');
  assert.match(binding.selectionInstruction,/项目结构/);
  assert.match(binding.selectionInstruction,/原生可编辑/);
});

test('binding resolves from an arbitrary host root and detects pinned-content drift',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'ppagent-skill-test-'));
  try {
    await fs.mkdir(path.join(root,'skills/vendor/sample'),{recursive:true});
    const entry='skills/vendor/sample/SKILL.md';
    const content='---\nname: sample\ndescription: test\n---\nRun local tool.';
    await fs.writeFile(path.join(root,entry),content);
    await fs.writeFile(path.join(root,'skills/integration.md'),'Use project-relative paths.');
    await fs.writeFile(path.join(root,'skills/registry.json'),JSON.stringify({skills:[{id:'sample',entry,root:'skills/vendor/sample',integration:'skills/integration.md',integrityFile:'skills/hash.json'}]}));
    await fs.writeFile(path.join(root,'skills/hash.json'),JSON.stringify({files:{'SKILL.md':createHash('sha256').update(content).digest('hex')}}));
    const binding=await getSkillBinding('sample',root);
    assert.equal(binding.instruction,content);
    assert.equal(binding.workingDirectory,'.');
    assert.equal(binding.skillDirectory,'skills/vendor/sample');
    assert.equal((await verifySkill('sample',root)).integrity,'passed');
    await fs.appendFile(path.join(root,entry),' modified');
    assert.equal((await verifySkill('sample',root)).integrity,'failed');
    await assert.rejects(getSkillBinding('missing',root),/Unknown skill/);
  } finally {
    // mkdtemp-created exact temporary directory only.
    await fs.rm(root,{recursive:true,force:true});
  }
});

test('chart binding exposes its scoped capability, license and PPT integration',async()=>{
  const chart=await getSkillBinding('lieflat-charts');
  const diagrams=await getSkillBinding('archify');
  const structure=await getSkillBinding('ppagent-structure');
  assert.equal(chart.capability,'data-chart');
  assert.equal(diagrams.capability,'relationship-diagram');
  assert.equal(chart.selectionPriority,diagrams.selectionPriority);
  assert(structure.selectionPriority < chart.selectionPriority);
  assert.equal(chart.nativeEditablePptx,false);
  assert.equal(chart.license,'PolyForm-Noncommercial-1.0.0');
  assert(chart.instruction.includes('Lieflat Charts'));
  assert(chart.integrationInstruction.includes('adapted-native'));
  assert(chart.selectionInstruction.includes('Lieflat Charts'));
  assert.equal((await verifySkill('lieflat-charts')).integrity,'passed');
});
