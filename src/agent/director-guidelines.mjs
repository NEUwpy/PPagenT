import fs from "node:fs/promises";
import path from "node:path";
import { discoverCoreAssetPackages } from "../runtime/core-asset-packages.mjs";

async function loadLogicSkillIndex(root) {
  const [logicMap, packages] = await Promise.all([
    fs.readFile(path.join(root, "catalog", "logic-map.json"), "utf8").then(JSON.parse),
    discoverCoreAssetPackages(root),
  ]);
  const packageById = new Map(packages.map((item) => [item.assetId, item]));
  return [
    ...logicMap.logics.map((logic) => ({
    logicId: logic.id,
    name: logic.name,
    tier: logic.tier,
    description: logic.description,
    availableStructureGroupCount: logic.assetIds.filter((assetId) => packageById.has(assetId)).length,
  })),
    {
      logicId: "editorial",
      name: "常规叙述",
      tier: "兜底",
      description: "原稿没有适合结构图表达的明确关系时，使用正文排版承载，不强套逻辑图。",
      availableStructureGroupCount: 1,
    },
  ];
}

function itemCountCapability(itemCount = {}) {
  const exact = Number.isInteger(itemCount.exact) ? itemCount.exact : null;
  return {
    min: exact ?? itemCount.min ?? 0,
    preferred: exact === null ? (itemCount.preferred ?? []) : [exact],
    max: exact ?? itemCount.max ?? null,
  };
}

function requiredContentFields(contentContract = {}) {
  return [
    ...(contentContract.points === "required" ? ["items[].points"] : []),
    ...(contentContract.title === "required" ? ["items[].title"] : []),
    ...(contentContract.polarity ? [`items[].polarity:${contentContract.polarity}`] : []),
    ...(contentContract.requiresStructuredDataType
      ? [`structuredData.type:${contentContract.requiresStructuredDataType}`]
      : []),
    ...(contentContract.explicitRelationsRequired ? ["structuredData.links"] : []),
  ];
}

function loadStructureCapabilityIndex(packages) {
  const byLogic = new Map();
  for (const item of packages.filter((entry) => entry.runtime?.logicId)) {
    const { asset, runtime } = item;
    const shapes = byLogic.get(runtime.logicId) ?? [];
    shapes.push({
      contentShape: asset.semanticContract,
      itemCount: itemCountCapability(runtime.itemCount),
      requiredFields: requiredContentFields(runtime.contentContract),
      ...(typeof runtime.contentContract?.ordered === "boolean"
        ? { ordered: runtime.contentContract.ordered }
        : {}),
      ...(Object.keys(runtime.contract?.constraints?.relationTraits ?? {}).length
        ? { relationTraits: runtime.contract.constraints.relationTraits }
        : {}),
    });
    byLogic.set(runtime.logicId, shapes);
  }
  return [...byLogic].map(([logicId, contentShapes]) => ({ logicId, contentShapes }));
}

export async function loadDirectorGuidelines(root) {
  const read = (name) => fs.readFile(path.join(root, "docs", "工作流", "正式生成", name), "utf8");
  const [content, visual, purposeVocabulary, logicSkillIndex, packages] = await Promise.all([
    read("内容导演提示词.md"),
    read("视觉导演提示词.md"),
    fs.readFile(path.join(root, "catalog", "purpose-vocabulary.json"), "utf8").then(JSON.parse),
    loadLogicSkillIndex(root),
    discoverCoreAssetPackages(root),
  ]);
  if (!content.trim() || !visual.trim()) throw new Error("内容导演或视觉导演提示词为空");
  return {
    content,
    visual,
    logicSkillIndex,
    structureCapabilities: loadStructureCapabilityIndex(packages),
    purposeVocabulary: purposeVocabulary.purposes.map(({ key, description }) => ({ key, description })),
  };
}
