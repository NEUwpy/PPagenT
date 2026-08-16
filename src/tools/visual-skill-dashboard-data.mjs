import fs from "node:fs/promises";
import path from "node:path";

export const defaultProjectRoot = path.resolve(import.meta.dirname, "../..");

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findManifests(root, library) {
  const records = [];
  for (const category of await fs.readdir(root, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const categoryRoot = path.join(root, category.name);
    for (const assetDir of await fs.readdir(categoryRoot, { withFileTypes: true })) {
      if (!assetDir.isDirectory()) continue;
      const manifestPath = path.join(categoryRoot, assetDir.name, "asset.json");
      try {
        records.push({
          manifest: await readJson(manifestPath),
          manifestPath,
          assetDir: path.dirname(manifestPath),
          library,
        });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }
  return records;
}

function relative(filePath, root) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function isInside(parent, child) {
  const relativePath = path.relative(parent, child);
  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function rendererOf(manifest) {
  if (manifest.runtime?.renderer) return manifest.runtime.renderer;
  if (manifest.runtime?.componentExport) return "html-component";
  if (manifest.runtime?.builderExport) return "legacy-builder";
  return "not-wired";
}

function itemRange(runtime) {
  if (!runtime?.itemCount) return null;
  const { min, max, preferred = [] } = runtime.itemCount;
  return { min, max, preferred };
}

async function normalizeRecord(entry, coverageTags, purposeMap, coreIds, root) {
  const { manifest, manifestPath, assetDir, library } = entry;
  const runtime = manifest.runtime ?? {};
  const reviewRuntime = runtime.review ?? (runtime.componentExport && runtime.previewParametersExport ? {
    entry: runtime.entry,
    componentExport: runtime.componentExport,
    previewParametersExport: runtime.previewParametersExport,
    previewResolverExport: runtime.previewResolverExport,
    controls: (runtime.stateContract?.states ?? []).length ? [{
      key: "itemCount",
      label: "项目数",
      values: runtime.stateContract.states,
      default: runtime.stateContract.previewDefault ?? runtime.stateContract.states[0],
    }] : [],
  } : null);
  const renderer = rendererOf(manifest);
  const purposes = (runtime.supportedPurposeKeys ?? []).map((key) => ({
    key,
    description: purposeMap.get(key) ?? "",
  }));
  const autoCallable = library === "core"
    && ["skin", "html-component", "legacy-builder"].includes(renderer)
    && Boolean(runtime.entry && runtime.mapperExport);
  const showcaseName = manifest.showcase || "example.pptx";
  const showcasePath = path.resolve(assetDir, showcaseName);
  const showcaseInsideAsset = !path.relative(assetDir, showcasePath).startsWith("..") && path.relative(assetDir, showcasePath) !== "";
  const previewAvailable = showcaseInsideAsset && await exists(showcasePath);
  const sourceFile = manifest.source?.file ?? "";
  const sourceSlides = Array.isArray(manifest.source?.slides) ? manifest.source.slides.filter(Number.isInteger) : [];
  const sourcePath = sourceFile ? path.resolve(root, sourceFile) : null;
  const sourceRoot = path.join(root, "PPT源");
  const sourcePreviewAvailable = Boolean(sourcePath && sourceSlides.length && isInside(sourceRoot, sourcePath) && await exists(sourcePath));
  const componentControls = (reviewRuntime?.controls ?? []).filter((control) => (
    typeof control?.key === "string"
    && typeof control?.label === "string"
    && Array.isArray(control?.values)
    && control.values.length
  ));
  const componentImplementation = reviewRuntime?.implementation ?? "unclassified";
  const isAssetSpecificHtml = componentImplementation === "asset-specific-html";
  const hasDesignComponent = Boolean(
    isAssetSpecificHtml
    &&
    reviewRuntime?.entry
    && reviewRuntime?.componentExport
    && reviewRuntime?.previewParametersExport
    && componentControls.length
  );
  const componentInitialSelection = Object.fromEntries(componentControls.map((control) => [
    control.key,
    control.values.includes(control.default) ? control.default : control.values[0],
  ]));
  const componentStates = componentControls.length === 1 ? componentControls[0].values : [];
  const nativeBuilderAvailable = Boolean(runtime.entry && runtime.builderExport);
  const nativeCompiledOutputAvailable = Boolean(
    renderer === "html-component"
    && runtime.entry
    && runtime.componentExport
    && hasDesignComponent
  );
  const runtimeCapabilities = [
    hasDesignComponent ? "html-component" : null,
    nativeBuilderAvailable ? "native-builder" : null,
    nativeCompiledOutputAvailable ? "native-compiled-output" : null,
    renderer === "skin" ? "skin" : null,
  ].filter(Boolean);
  return {
    id: manifest.id,
    name: manifest.name,
    category: manifest.category,
    kind: manifest.kind ?? "",
    library,
    status: manifest.status ?? library,
    candidateCopyOfCore: library === "candidate" && coreIds.has(manifest.id),
    creationMethod: manifest.creationMethod ?? "",
    renderer,
    autoCallable,
    skillId: runtime.skillId ?? runtime.familyId ?? coverageTags[0] ?? "未归类",
    styleGroupId: runtime.styleGroupId ?? runtime.variantId ?? manifest.id,
    familyId: runtime.familyId ?? "",
    variantId: runtime.variantId ?? "",
    silhouette: runtime.silhouette ?? "",
    baseRelations: runtime.supportedBaseRelations ?? [],
    purposes,
    itemRange: itemRange(runtime),
    textCapacity: runtime.textCapacity ?? null,
    stateContract: runtime.stateContract ?? null,
    mediaContract: runtime.mediaContract ?? null,
    contentContract: runtime.contentContract ?? null,
    slotContract: runtime.slotContract ?? null,
    contract: runtime.contract ?? null,
    compositionIds: runtime.compositionIds ?? manifest.spatialContract?.supportedCompositionIds ?? [],
    source: manifest.source ?? null,
    layoutExpansion: manifest.layoutExpansion ?? null,
    spatialContract: manifest.spatialContract ?? null,
    capacity: manifest.capacity ?? "",
    semanticContract: manifest.semanticContract ?? manifest.boundary ?? "",
    doNotUseWhen: manifest.doNotUseWhen ?? "",
    review: manifest.review ?? "",
    generator: manifest.generator ?? "",
    showcase: manifest.showcase ?? "",
    previewAvailable,
    previewDeckPath: previewAvailable ? relative(showcasePath, root) : null,
    previewUrl: previewAvailable
      ? `/api/asset-preview?library=${encodeURIComponent(library)}&id=${encodeURIComponent(manifest.id)}`
      : null,
    sourcePreviewAvailable,
    sourcePreviewUrl: sourcePreviewAvailable
      ? `/api/source-preview?library=${encodeURIComponent(library)}&id=${encodeURIComponent(manifest.id)}&slide=${sourceSlides[0]}`
      : null,
    sourcePreviewUrls: sourcePreviewAvailable
      ? sourceSlides.map((slide) => ({ slide, url: `/api/source-preview?library=${encodeURIComponent(library)}&id=${encodeURIComponent(manifest.id)}&slide=${slide}` }))
      : [],
    componentPreviewAvailable: hasDesignComponent,
    componentImplementation,
    componentFidelityStatus: reviewRuntime?.fidelityStatus ?? "unreviewed",
    componentGoldenState: reviewRuntime?.goldenState ?? null,
    componentPreviewUrl: hasDesignComponent
      ? `/api/component-preview?library=${encodeURIComponent(library)}&id=${encodeURIComponent(manifest.id)}`
      : null,
    componentStates,
    componentInitialState: componentStates.length ? componentInitialSelection[componentControls[0].key] : null,
    componentControls,
    componentInitialSelection,
    runtimeCapabilities,
    nativeBuilderAvailable,
    nativeCompiledOutputAvailable,
    nativeOutputAvailable: nativeBuilderAvailable || nativeCompiledOutputAvailable,
    nativeStatePreviewUrl: hasDesignComponent && (nativeBuilderAvailable || nativeCompiledOutputAvailable)
      ? `/api/native-state-preview?library=${encodeURIComponent(library)}&id=${encodeURIComponent(manifest.id)}`
      : null,
    runtimeEntry: runtime.entry ?? "",
    mapperExport: runtime.mapperExport ?? "",
    reviewEntry: reviewRuntime?.entry ?? "",
    componentExport: reviewRuntime?.componentExport ?? "",
    previewParametersExport: reviewRuntime?.previewParametersExport ?? "",
    previewResolverExport: reviewRuntime?.previewResolverExport ?? "",
    builderExport: runtime.builderExport ?? "",
    manifestPath: relative(manifestPath, root),
    assetDir: relative(assetDir, root),
    coverageTags,
  };
}

function uniqueById(records) {
  const byId = new Map();
  for (const record of records) {
    if (!byId.has(record.id) || record.library === "core") byId.set(record.id, record);
  }
  return [...byId.values()];
}

export async function collectVisualSkillDashboardData(root = defaultProjectRoot) {
  const coreEntries = await findManifests(path.join(root, "assets"), "core");
  const candidateEntries = await findManifests(path.join(root, "备选资产"), "candidate");
  const coverage = await readJson(path.join(root, "catalog", "family-candidate-coverage.json"));
  const purposes = await readJson(path.join(root, "catalog", "purpose-vocabulary.json"));
  const compositions = await readJson(path.join(root, "catalog", "composition-layouts.json"));
  const failures = await readJson(path.join(root, "catalog", "failure-cases.json"));
  const contracts = await readJson(path.join(root, "catalog", "asset-contracts.json"));
  const experimentalVariants = await readJson(path.join(root, "catalog", "visual-variants.json"));

  const coverageByAsset = new Map();
  for (const [tag, ids] of Object.entries(coverage.coverage ?? {})) {
    for (const id of ids) {
      const tags = coverageByAsset.get(id) ?? [];
      tags.push(tag);
      coverageByAsset.set(id, tags);
    }
  }
  const purposeMap = new Map((purposes.purposes ?? []).map((item) => [item.key, item.description]));
  const coreIds = new Set(coreEntries.map((entry) => entry.manifest.id));
  const records = await Promise.all([...coreEntries, ...candidateEntries].map((entry) => normalizeRecord(
    entry,
    coverageByAsset.get(entry.manifest.id) ?? [],
    purposeMap,
    coreIds,
    root,
  )));
  const primaryAssets = uniqueById(records);
  const sourceFiles = (await fs.readdir(path.join(root, "PPT源"), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pptx"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "zh-CN"));

  const coreAssets = records.filter((record) => record.library === "core");
  const candidateAssets = records.filter((record) => record.library === "candidate");
  const formalSkills = coreAssets.filter((record) => record.renderer !== "skin");
  const candidateOnly = candidateAssets.filter((record) => !record.candidateCopyOfCore);
  const categoryCounts = Object.entries(primaryAssets.reduce((accumulator, record) => {
    accumulator[record.category] = (accumulator[record.category] ?? 0) + 1;
    return accumulator;
  }, {})).map(([name, count]) => ({ name, count })).sort((left, right) => right.count - left.count);

  return {
    generatedAt: new Date().toISOString(),
    mode: "live-repository-api",
    summary: {
      coreAssets: coreAssets.length,
      formalSkills: formalSkills.length,
      candidateRecords: candidateAssets.length,
      candidateOnly: candidateOnly.length,
      htmlDesignComponents: formalSkills.filter((record) => record.componentPreviewAvailable).length,
      legacyBuilders: formalSkills.filter((record) => record.renderer === "legacy-builder").length,
      skins: coreAssets.filter((record) => record.renderer === "skin").length,
      autoCallable: coreAssets.filter((record) => record.autoCallable).length,
      previewable: records.filter((record) => record.previewAvailable).length,
      sourceDecks: sourceFiles.length,
      coverageTopics: Object.keys(coverage.coverage ?? {}).length,
      compositions: compositions.layouts?.length ?? 0,
      purposes: purposes.purposes?.length ?? 0,
      failureCases: failures.cases?.length ?? 0,
      contracts: contracts.contracts?.length ?? 0,
      experimentalVariants: experimentalVariants.variants?.length ?? 0,
    },
    records,
    primaryAssets,
    formalSkills,
    candidateOnly,
    coverageTopics: Object.entries(coverage.coverage ?? {}).map(([name, assetIds]) => ({ name, assetIds })),
    purposes: purposes.purposes ?? [],
    compositions: compositions.layouts ?? [],
    failureCases: failures.cases ?? [],
    sourceFiles,
    categoryCounts,
    stores: [
      { name: "原始 PPT 来源", path: "PPT源/", count: sourceFiles.length, role: "只提供入库线的原始视觉来源", tone: "source" },
      { name: "核心资产库", path: "assets/", count: coreAssets.length, role: "正式生成线自动发现并只读调用", tone: "core" },
      { name: "候选资产库", path: "备选资产/", count: candidateAssets.length, role: "等待补齐、验证或用户明确确认", tone: "candidate" },
      { name: "规则与能力目录", path: "catalog/", count: (compositions.layouts?.length ?? 0) + (purposes.purposes?.length ?? 0), role: "保存 Composition、Purpose、契约与失败经验", tone: "catalog" },
      { name: "Visual Skill 运行声明", path: "*/asset.json", count: formalSkills.length, role: "声明 Skill、Style Group、触发条件和运行入口", tone: "runtime" },
    ],
  };
}

export async function resolvePreviewDeck(root, library, assetId) {
  if (!new Set(["core", "candidate"]).has(library)) return null;
  const data = await collectVisualSkillDashboardData(root);
  const record = data.records.find((item) => item.library === library && item.id === assetId);
  if (!record?.previewDeckPath) return null;
  const deckPath = path.resolve(root, record.previewDeckPath);
  const relativePath = path.relative(root, deckPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return null;
  return { record, deckPath };
}

export async function resolveSourceSlide(root, library, assetId, requestedSlide) {
  if (!new Set(["core", "candidate"]).has(library)) return null;
  const data = await collectVisualSkillDashboardData(root);
  const record = data.records.find((item) => item.library === library && item.id === assetId);
  const sourceFile = record?.source?.file;
  const allowedSlides = record?.source?.slides ?? [];
  const slideNumber = Number(requestedSlide ?? allowedSlides[0]);
  if (!sourceFile || !Number.isInteger(slideNumber) || !allowedSlides.includes(slideNumber)) return null;
  const sourceRoot = path.resolve(root, "PPT源");
  const deckPath = path.resolve(root, sourceFile);
  if (!isInside(sourceRoot, deckPath) || !await exists(deckPath)) return null;
  return { record, deckPath, slideNumber };
}

export async function resolveComponentPreview(root, library, assetId) {
  if (!new Set(["core", "candidate"]).has(library)) return null;
  const data = await collectVisualSkillDashboardData(root);
  const record = data.records.find((item) => item.library === library && item.id === assetId);
  if (!record?.componentPreviewAvailable || !record.reviewEntry || !record.componentExport || !record.previewParametersExport) return null;
  const assetDir = path.resolve(root, record.assetDir);
  const entryPath = path.resolve(assetDir, record.reviewEntry);
  if (!isInside(assetDir, entryPath) || !await exists(entryPath)) return null;
  return { record, assetDir, entryPath };
}

export async function resolveNativeStatePreview(root, library, assetId) {
  const component = await resolveComponentPreview(root, library, assetId);
  if (!component?.record.runtimeEntry || (!component.record.builderExport && component.record.renderer !== "html-component")) return null;
  const runtimeEntryPath = path.resolve(component.assetDir, component.record.runtimeEntry);
  if (!isInside(component.assetDir, runtimeEntryPath) || !await exists(runtimeEntryPath)) return null;
  return { ...component, runtimeEntryPath };
}
