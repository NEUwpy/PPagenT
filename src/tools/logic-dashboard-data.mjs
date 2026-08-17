import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inspectHtmlComponentEligibility } from "../runtime/html-component-eligibility.mjs";
import { academicReportShell } from "../runtime/shells/academic-report.mjs";
import { northeasternUniversityTheme } from "../runtime/skins/northeastern-university-theme.mjs";

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

async function latestVersion(filePaths) {
  const stats = await Promise.all(filePaths.filter(Boolean).map(async (filePath) => {
    try {
      return await fs.stat(filePath);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }));
  return String(Math.trunc(Math.max(0, ...stats.filter(Boolean).map((stat) => stat.mtimeMs))));
}

function versionedUrl(url, version) {
  return `${url}&v=${encodeURIComponent(version)}`;
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
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
  const htmlEligibility = renderer === "html-component"
    ? await inspectHtmlComponentEligibility(assetDir, manifest.id)
    : null;
  const purposes = (runtime.supportedPurposeKeys ?? []).map((key) => ({
    key,
    description: purposeMap.get(key) ?? "",
  }));
  const autoCallable = library === "core"
    && ["skin", "html-component", "legacy-builder"].includes(renderer)
    && Boolean(runtime.entry && runtime.mapperExport)
    && (renderer !== "html-component" || htmlEligibility?.eligible === true);
  const showcaseName = manifest.showcase || "example.pptx";
  const showcasePath = path.resolve(assetDir, showcaseName);
  const showcaseInsideAsset = !path.relative(assetDir, showcasePath).startsWith("..") && path.relative(assetDir, showcasePath) !== "";
  const previewAvailable = showcaseInsideAsset && await exists(showcasePath);
  const sourceFile = manifest.source?.file ?? "";
  const sourceSlides = Array.isArray(manifest.source?.slides) ? manifest.source.slides.filter(Number.isInteger) : [];
  const sourcePath = sourceFile ? path.resolve(root, sourceFile) : null;
  const sourceRoot = path.join(root, "PPT源");
  const sourcePreviewAvailable = Boolean(sourcePath && sourceSlides.length && isInside(sourceRoot, sourcePath) && await exists(sourcePath));
  const previewVersion = await latestVersion([showcasePath]);
  const sourcePreviewVersion = await latestVersion([sourcePath]);
  const componentVersion = await latestVersion([
    manifestPath,
    runtime.entry ? path.resolve(assetDir, runtime.entry) : null,
    reviewRuntime?.entry ? path.resolve(assetDir, reviewRuntime.entry) : null,
    path.resolve(assetDir, "component.css"),
    path.join(root, "src", "visual-runtime", "html-component-runtime.mjs"),
    path.join(root, "src", "runtime", "skins", "northeastern-university-theme.mjs"),
    path.join(root, "src", "runtime", "skins", "northeastern-university.mjs"),
  ]);
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
  const visualIntentName = reviewRuntime?.visualIntent ?? "";
  const visualIntentPath = visualIntentName ? path.resolve(assetDir, visualIntentName) : null;
  const visualIntentText = visualIntentPath && isInside(assetDir, visualIntentPath)
    ? await readTextIfExists(visualIntentPath)
    : "";
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
  let componentTextCapacity = null;
  if (hasDesignComponent) {
    const reviewEntryPath = path.resolve(assetDir, reviewRuntime.entry);
    if (isInside(assetDir, reviewEntryPath)) {
      const reviewModule = await import(pathToFileURL(reviewEntryPath).href);
      componentTextCapacity = reviewModule[reviewRuntime.componentExport]?.textCapacity ?? null;
    }
  }
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
    logicId: runtime.logicId ?? (renderer === "skin" ? "skin" : "未归类"),
    structureGroupId: runtime.structureGroupId ?? runtime.variantId ?? manifest.id,
    familyId: runtime.familyId ?? "",
    variantId: runtime.variantId ?? "",
    silhouette: runtime.silhouette ?? "",
    baseRelations: runtime.supportedBaseRelations ?? [],
    purposes,
    itemRange: itemRange(runtime),
    textCapacity: componentTextCapacity ?? runtime.textCapacity ?? null,
    stateContract: runtime.stateContract ?? null,
    mediaContract: runtime.mediaContract ?? null,
    contentContract: runtime.contentContract ?? null,
    slotContract: runtime.slotContract ?? null,
    contract: runtime.contract ?? null,
    compositionIds: runtime.compositionIds ?? manifest.spatialContract?.supportedCompositionIds ?? [],
    source: manifest.source ?? null,
    layoutExpansion: manifest.layoutExpansion ?? null,
    spatialContract: manifest.spatialContract ?? null,
    stateFootprints: manifest.spatialContract?.stateFootprints ?? {},
    componentModel: manifest.componentModel ?? null,
    fieldContract: manifest.fieldContract ?? null,
    capacity: manifest.capacity ?? "",
    semanticContract: manifest.semanticContract ?? manifest.boundary ?? "",
    doNotUseWhen: manifest.doNotUseWhen ?? "",
    review: manifest.review ?? "",
    generator: manifest.generator ?? "",
    showcase: manifest.showcase ?? "",
    previewAvailable,
    previewDeckPath: previewAvailable ? relative(showcasePath, root) : null,
    previewUrl: previewAvailable
      ? versionedUrl(`/api/asset-preview?library=${encodeURIComponent(library)}&id=${encodeURIComponent(manifest.id)}`, previewVersion)
      : null,
    sourcePreviewAvailable,
    sourcePreviewUrl: sourcePreviewAvailable
      ? versionedUrl(`/api/source-preview?library=${encodeURIComponent(library)}&id=${encodeURIComponent(manifest.id)}&slide=${sourceSlides[0]}`, sourcePreviewVersion)
      : null,
    sourcePreviewUrls: sourcePreviewAvailable
      ? sourceSlides.map((slide) => ({
          slide,
          url: versionedUrl(`/api/source-preview?library=${encodeURIComponent(library)}&id=${encodeURIComponent(manifest.id)}&slide=${slide}`, sourcePreviewVersion),
        }))
      : [],
    componentPreviewAvailable: hasDesignComponent,
    componentImplementation,
    componentFidelityStatus: htmlEligibility?.stage ?? "legacy-or-unreviewed",
    hasVisualIntent: htmlEligibility?.hasVisualIntent ?? false,
    visualIntentText,
    userApprovedHtmlNative: htmlEligibility?.userApproved ?? false,
    componentGoldenState: reviewRuntime?.goldenState ?? null,
    componentPreviewUrl: hasDesignComponent
      ? versionedUrl(`/api/component-preview?library=${encodeURIComponent(library)}&id=${encodeURIComponent(manifest.id)}`, componentVersion)
      : null,
    componentStates,
    componentInitialState: componentStates.length ? componentInitialSelection[componentControls[0].key] : null,
    componentControls,
    componentInitialSelection,
    runtimeCapabilities,
    nativeBuilderAvailable,
    nativeCompiledOutputAvailable,
    nativeOutputAvailable: nativeBuilderAvailable || nativeCompiledOutputAvailable,
    nativeStatePreviewUrl: componentControls.length && (nativeBuilderAvailable || nativeCompiledOutputAvailable)
      ? versionedUrl(`/api/native-state-preview?library=${encodeURIComponent(library)}&id=${encodeURIComponent(manifest.id)}`, componentVersion)
      : null,
    nativeStatePptxUrl: componentControls.length && (nativeBuilderAvailable || nativeCompiledOutputAvailable)
      ? versionedUrl(`/api/native-state-pptx?library=${encodeURIComponent(library)}&id=${encodeURIComponent(manifest.id)}`, componentVersion)
      : null,
    skinStatePreviewUrl: componentControls.length && (nativeBuilderAvailable || nativeCompiledOutputAvailable) && renderer !== "skin"
      ? versionedUrl(`/api/skin-state-preview?library=${encodeURIComponent(library)}&id=${encodeURIComponent(manifest.id)}`, componentVersion)
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

export async function collectLogicDashboardData(root = defaultProjectRoot) {
  const coreEntries = await findManifests(path.join(root, "assets"), "core");
  const candidateEntries = await findManifests(path.join(root, "备选资产"), "candidate");
  const logicMap = await readJson(path.join(root, "catalog", "logic-map.json"));
  const purposes = await readJson(path.join(root, "catalog", "purpose-vocabulary.json"));
  const compositions = await readJson(path.join(root, "catalog", "composition-layouts.json"));
  const failures = await readJson(path.join(root, "catalog", "failure-cases.json"));
  const contracts = await readJson(path.join(root, "catalog", "asset-contracts.json"));
  const experimentalVariants = await readJson(path.join(root, "catalog", "visual-variants.json"));

  const coverageByAsset = new Map();
  const logics = logicMap.logics ?? [];
  for (const logic of logics) {
    for (const id of logic.assetIds ?? []) {
      const tags = coverageByAsset.get(id) ?? [];
      tags.push(logic.name);
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
  const formalLogics = coreAssets.filter((record) => record.renderer !== "skin" && record.autoCallable);
  const candidateOnly = candidateAssets.filter((record) => !record.candidateCopyOfCore);
  const categoryCounts = Object.entries(primaryAssets.reduce((accumulator, record) => {
    accumulator[record.category] = (accumulator[record.category] ?? 0) + 1;
    return accumulator;
  }, {})).map(([name, count]) => ({ name, count })).sort((left, right) => right.count - left.count);

  return {
    generatedAt: new Date().toISOString(),
    mode: "live-repository-api",
    activeSkin: {
      id: "northeastern-university-001",
      shellId: academicReportShell.id,
      slideSize: academicReportShell.slideSize,
      slots: academicReportShell.slots,
      componentTheme: northeasternUniversityTheme,
      coordinateUnit: "design-px",
      pptPointScale: 0.75,
    },
    summary: {
      coreAssets: coreAssets.length,
      formalLogics: formalLogics.length,
      candidateRecords: candidateAssets.length,
      candidateOnly: candidateOnly.length,
      htmlDesignComponents: formalLogics.filter((record) => record.renderer === "html-component" && record.componentPreviewAvailable).length,
      legacyBuilders: formalLogics.filter((record) => record.renderer === "legacy-builder").length,
      skins: coreAssets.filter((record) => record.renderer === "skin").length,
      autoCallable: coreAssets.filter((record) => record.autoCallable).length,
      previewable: records.filter((record) => record.previewAvailable).length,
      sourceDecks: sourceFiles.length,
      logicSlots: logics.length,
      logicFilled: logics.filter((logic) => (logic.assetIds ?? []).length > 0).length,
      compositions: compositions.layouts?.length ?? 0,
      purposes: purposes.purposes?.length ?? 0,
      failureCases: failures.cases?.length ?? 0,
      contracts: contracts.contracts?.length ?? 0,
      experimentalVariants: experimentalVariants.variants?.length ?? 0,
    },
    records,
    primaryAssets,
    formalLogics,
    candidateOnly,
    logics: logics.map((logic) => ({
      id: logic.id,
      name: logic.name,
      tier: logic.tier,
      description: logic.description,
      assetIds: logic.assetIds ?? [],
      status: (logic.assetIds ?? []).length ? "available" : "empty",
    })),
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
      { name: "Logic 运行声明", path: "*/asset.json", count: formalLogics.length, role: "声明 Logic、Structure Group、触发条件和运行入口", tone: "runtime" },
    ],
  };
}

export async function resolvePreviewDeck(root, library, assetId) {
  if (!new Set(["core", "candidate"]).has(library)) return null;
  const data = await collectLogicDashboardData(root);
  const record = data.records.find((item) => item.library === library && item.id === assetId);
  if (!record?.previewDeckPath) return null;
  const deckPath = path.resolve(root, record.previewDeckPath);
  const relativePath = path.relative(root, deckPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return null;
  return { record, deckPath };
}

export async function resolveSourceSlide(root, library, assetId, requestedSlide) {
  if (!new Set(["core", "candidate"]).has(library)) return null;
  const data = await collectLogicDashboardData(root);
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

async function resolveReviewState(root, library, assetId) {
  if (!new Set(["core", "candidate"]).has(library)) return null;
  const data = await collectLogicDashboardData(root);
  const record = data.records.find((item) => item.library === library && item.id === assetId);
  if (!record?.reviewEntry || !record.previewParametersExport || !record.componentControls?.length) return null;
  const assetDir = path.resolve(root, record.assetDir);
  const entryPath = path.resolve(assetDir, record.reviewEntry);
  if (!isInside(assetDir, entryPath) || !await exists(entryPath)) return null;
  return { record, assetDir, entryPath };
}

export async function resolveComponentPreview(root, library, assetId) {
  const review = await resolveReviewState(root, library, assetId);
  if (!review?.record.componentPreviewAvailable || !review.record.componentExport) return null;
  return review;
}

export async function resolveNativeStatePreview(root, library, assetId) {
  const review = await resolveReviewState(root, library, assetId);
  if (!review?.record.runtimeEntry || (!review.record.builderExport && review.record.renderer !== "html-component")) return null;
  const runtimeEntryPath = path.resolve(review.assetDir, review.record.runtimeEntry);
  if (!isInside(review.assetDir, runtimeEntryPath) || !await exists(runtimeEntryPath)) return null;
  return { ...review, runtimeEntryPath };
}
