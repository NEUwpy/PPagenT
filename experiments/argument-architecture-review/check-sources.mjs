import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const files = { A: '01-响应变慢.md', B: '02-档案平台选择.md', C: '03-试用与公开发布.md' };
const sources = {};
for (const [key, file] of Object.entries(files)) {
  const raw = await fs.readFile(new URL(`./inputs/${file}`, import.meta.url), 'utf8');
  const paragraphs = raw.trim().split(/\r?\n\s*\r?\n/).slice(1);
  assert.ok(paragraphs.length > 0);
  sources[key] = { file: `inputs/${file}`, sha256: createHash('sha256').update(raw).digest('hex'), paragraphs: paragraphs.map((text, i) => ({ id: `${key}${i + 1}`, text })) };
}
const review = await fs.readFile(new URL('./审核材料.md', import.meta.url), 'utf8');
const refs = [...new Set(review.match(/\b[ABC][1-9]\b/g))];
for (const ref of refs) assert.ok(sources[ref[0]].paragraphs.some(p => p.id === ref), `未知引用 ${ref}`);
assert.equal((review.match(/^### [ABC]-P[12]｜/gm) ?? []).length, 6);
const arithmetic = { complexShareBefore: 40 / 200, complexShareAfter: 120 / 300, firstYearA: 12 + 8, firstYearB: 18 + 2, threeYearA: 12 * 3 + 8, threeYearB: 18 * 3 + 2, threeYearDifference: (18 * 3 + 2) - (12 * 3 + 8) };
assert.deepEqual(Object.values(arithmetic), [0.2, 0.4, 20, 20, 44, 56, 12]);
await fs.writeFile(new URL('./source-manifest.json', import.meta.url), JSON.stringify({ sources, checkedReferences: refs, arithmetic, scope: '仅来源引用存在性和派生算术；不证明论证、分页、语义覆盖或视觉质量。' }, null, 2) + '\n');
console.log(JSON.stringify({ manuscripts: 3, pageCandidates: 6, sourceReferences: refs.length, arithmetic, semanticStatus: 'author-reviewed-awaiting-user' }, null, 2));
