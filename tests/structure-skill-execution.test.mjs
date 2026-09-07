import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { listStructureSkills, executeStructureSkill } from '../src/runtime/structure-skills.mjs';
import { renderStructureAsset } from '../src/runtime/assets.mjs';

test('native execution ignores legacy counts, text slots and missing sample executors', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'structure-skill-'));
  try {
    const dir = path.join(root, 'assets', 'structure', 'sample');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'asset.json'), JSON.stringify({
      id: 'sample', status: 'core', runtime: { logicId: 'parallel', renderer: 'html-component', entry: 'missing.mjs', itemCount: { min: 4, max: 8 } },
      spatialContract: { minimumFrame: { width: 1170, height: 492 } },
    }));
    assert.equal((await listStructureSkills(root)).length, 1);
    const slide = { shapes: { items: [] } };
    const frame = { left: 0, top: 0, width: 400, height: 300 };
    const content = Array.from({ length: 9 }, () => ({ body: 'long content '.repeat(20) }));
    const result = await renderStructureAsset(slide, {
      content, references: [{ assetId: 'sample', preservedFeatures: ['paper fold'] }],
      build: context => { assert.equal(context.content, content); context.slide.shapes.items.push({ native: true }); },
    }, { bodyFrame: frame }, frame, root);
    assert.equal(result.nativeShapeDelta, 1);
    assert.equal(result.validation, 'rendered-unreviewed');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('old parameter-only calls fail explicitly instead of falling back', async () => {
  await assert.rejects(executeStructureSkill({ assetId: 'sample', parameters: { items: [] } }), /build/);
});

test('no-op native construction cannot claim success', async () => {
  const frame = { left: 0, top: 0, width: 100, height: 100 };
  await assert.rejects(executeStructureSkill({
    slide: { shapes: { items: [] } }, skin: { bodyFrame: frame }, targetFrame: frame,
    references: [{ assetId: 'parallel-folded-notes-grid-002', preservedFeatures: ['fold'] }], build() {},
  }), /没有生成/);
});
