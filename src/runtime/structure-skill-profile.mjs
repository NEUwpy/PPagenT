import fs from 'node:fs/promises';
import path from 'node:path';

export async function readStructureGuide(assetDir) {
  try {
    const guide = JSON.parse(await fs.readFile(path.join(assetDir, 'structure-skill.json'), 'utf8'));
    if (guide.schemaVersion !== 1 || !guide.assetId || !Array.isArray(guide.features)
      || !guide.features.length || guide.features.some(f => typeof f !== 'string' || !f.trim())
      || typeof guide.adaptation !== 'string' || !guide.adaptation.trim()) throw new Error(`Invalid structure guide: ${assetDir}`);
    return guide;
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// Asset-local guide is the current design source; old intent remains provenance.
export function structureSkillProfile(asset, visualIntent = "", guide = null) {
  if (guide && guide.assetId !== asset.id) throw new Error(`Structure guide assetId mismatch: ${asset.id}`);
  const sections = visualIntent.split(/^##\s+/m).slice(1);
  const identity = sections.filter(section => /结构表达语法|审美语言|不变量/.test(section.split('\n')[0])).join('\n## ');
  const featureSource = sections.filter(section => /结构表达语法|不变量/.test(section.split('\n')[0])).map(section => section.split('\n').slice(1).join('\n')).join('\n');
  const features = [...new Set((featureSource || (asset.componentModel?.fixed ?? []).join('\n'))
    .split(/[。；\n]/).map(item => item.replace(/^\s*[-*]\s*/, '').trim())
    .filter(item => item && !/TextRegion|TextFlow|Slot|data-|字号|最小|容量|固定文字框/.test(item)))];
  return {
    mode: "native-skill",
    semantic: asset.semanticContract ?? asset.boundary ?? "",
    avoid: asset.doNotUseWhen ?? "",
    identityEvidence: identity || visualIntent || "",
    features: guide?.features ?? features,
    designBoundary: guide?.designBoundary ?? null,
    implementation: guide?.implementation ?? null,
    fixedEvidence: asset.componentModel?.fixed ?? [],
    variableEvidence: asset.componentModel?.variable ?? [],
    evidenceStatus: guide ? "authored-guide" : visualIntent || asset.componentModel?.fixed?.length ? "source-declared" : "needs-inspection",
    validation: guide?.validation ?? { status: 'not-validated' },
    adaptation: guide?.adaptation ?? "按内容和区域调整尺寸、间距、文字分工、Skin 色彩与字号；数量和朝向变化需重算布局，并保留关系及所采用的识别特征。",
    identityReview: "原文中的固定项同时包含视觉特征和旧执行器限制。先区分二者，说明本次保留的造型、层次、节奏与连接方式；不要把有特点的结构统一改成普通卡片。",
    executorBoundary: guide?.implementation?.mode === 'preserved-design'
      ? "使用已登记原造型实现，按区域重算图形和文字空间；文字选允许档位，显式 Skin 字号优先，小配件联动；沿用当前数量范围，选定字号仍溢出则拒绝。重新验证可编辑输出与视觉特征，不将一次样本通过外推到任意内容。"
      : "执行本次原生构建方法，不加载原 Mapper、固定文字框或数量契约。文字按本页内容排版；重新验证可编辑输出、文字边界和视觉特征。样例仅展示一种设计效果。",
    outcomes: ["adapted", "composed"],
  };
}
