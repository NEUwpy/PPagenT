// A shared reading view of asset evidence, not a second asset registry.
export function structureSkillProfile(asset, visualIntent = "") {
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
    features,
    fixedEvidence: asset.componentModel?.fixed ?? [],
    variableEvidence: asset.componentModel?.variable ?? [],
    evidenceStatus: visualIntent || asset.componentModel?.fixed?.length ? "source-declared" : "needs-inspection",
    adaptation: "按内容和区域调整尺寸、间距、文字分工、Skin 色彩与字号；数量和朝向变化需重算布局，并保留关系及所采用的识别特征。",
    identityReview: "原文中的固定项同时包含视觉特征和旧执行器限制。先区分二者，说明本次保留的造型、层次、节奏与连接方式；不要把有特点的结构统一改成普通卡片。",
    executorBoundary: "执行本次原生构建方法，不加载原 Mapper、固定文字框或数量契约。文字按本页内容排版；重新验证可编辑输出、文字边界和视觉特征。样例仅展示一种设计效果。",
    outcomes: ["adapted", "composed"],
  };
}
