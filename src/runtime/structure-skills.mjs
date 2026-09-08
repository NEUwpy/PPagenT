import fs from 'node:fs/promises';
import path from 'node:path';
import { structureSkillProfile, readStructureGuide } from './structure-skill-profile.mjs';
const defaultRoot = path.resolve(import.meta.dirname, '../..');

// Design discovery does not import mappers or require frozen Slot Contracts.
export async function listStructureSkills(root = defaultRoot) {
  const base = path.join(root, 'assets');
  const result = [];
  for (const category of await fs.readdir(base, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const categoryPath = path.join(base, category.name);
    for (const entry of await fs.readdir(categoryPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const assetDir = path.join(categoryPath, entry.name);
      const manifestPath = path.join(assetDir, 'asset.json');
      let asset;
      try { asset = JSON.parse(await fs.readFile(manifestPath, 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      if (asset.status !== 'core' || !asset.runtime?.logicId || asset.runtime.renderer === 'skin') continue;
      result.push({ assetId: asset.id, asset, runtime: asset.runtime, assetDir, manifestPath,
        entryPath: path.resolve(assetDir, asset.runtime.entry ?? 'runtime.mjs') });
    }
  }
  return result.sort((a, b) => a.assetId.localeCompare(b.assetId));
}
export async function loadStructureSkill(assetId, root = defaultRoot) {
  const descriptor = (await listStructureSkills(root)).find(item => item.assetId === assetId);
  if (!descriptor) throw new Error(`Unknown structure Skill: ${assetId}`);
  const intentPath = path.resolve(descriptor.assetDir, descriptor.runtime.review?.visualIntent ?? 'visual-intent.md');
  const relative = path.relative(descriptor.assetDir, intentPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('visual intent must stay within the asset directory');
  let visualIntent = '';
  try { visualIntent = await fs.readFile(intentPath, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const guide = await readStructureGuide(descriptor.assetDir);
  return { ...descriptor, visualIntent, guide, skill: structureSkillProfile(descriptor.asset, visualIntent, guide) };
}
export async function executeStructureSkill({ slide, skin, targetFrame, references, build, content, execution, root = defaultRoot }) {
  if (execution === 'preserved-design') {
    if (build) throw new Error('保留造型模式使用已登记实现，不接受额外 build');
    ({ buildPreservedStructure: build } = await import('./preserved-structure-build.mjs'));
  }
  if (typeof build !== 'function') throw new Error('结构 Skill 需要 build 原生构建方法，或指定 execution: preserved-design 使用已登记实现');
  if (!Array.isArray(references) || !references.length) throw new Error('需要记录采用的结构参考与 preservedFeatures');
  for (const reference of references) {
    if (!reference.assetId || !Array.isArray(reference.preservedFeatures) || !reference.preservedFeatures.length
      || reference.preservedFeatures.some(feature => typeof feature !== 'string' || !feature.trim())) throw new Error('每个参考需 assetId 和非空 preservedFeatures');
  }
  const f = targetFrame, b = skin?.bodyFrame;
  if (!f || !b || ![f.left, f.top, f.width, f.height, b.left, b.top, b.width, b.height].every(Number.isFinite)
    || f.width <= 0 || f.height <= 0 || f.left < b.left || f.top < b.top
    || f.left + f.width > b.left + b.width || f.top + f.height > b.top + b.height) throw new Error('targetFrame 必须位于本页正文区域内');
  const skills = await Promise.all(references.map(reference => loadStructureSkill(reference.assetId, root)));
  const before = slide.shapes.items.length;
  const result = await build({ slide, skin, frame: { ...f }, content, references: skills });
  const nativeShapeDelta = slide.shapes.items.length - before;
  if (nativeShapeDelta <= 0) throw new Error('构建没有生成原生形状或文字，不能报告结构执行成功');
  return { result, nativeShapeDelta, validation: 'rendered-unreviewed' };
}
