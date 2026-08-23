import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { northeasternUniversityTheme } from "../runtime/skins/northeastern-university-theme.mjs";
import { closeHtmlComponentRuntime, resolveHtmlComponent } from "../visual-runtime/html-component-runtime.mjs";

const projectRoot = path.resolve(process.argv[2] ?? path.resolve(import.meta.dirname, "../.."));
const assetFilter = new Set((process.argv.find((value) => value.startsWith("--assets="))?.slice("--assets=".length) ?? "")
  .split(",").map((value) => value.trim()).filter(Boolean));
const skipExisting = process.argv.includes("--skip-existing");

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function writeJson(filePath, value) {
  const content = `${JSON.stringify(value)}\n`;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await fs.writeFile(filePath, content, "utf8");
      return;
    } catch (error) {
      if (!['UNKNOWN', 'EBUSY', 'EPERM'].includes(error.code) || attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 100));
    }
  }
}

async function manifests() {
  const result = [];
  for (const category of await fs.readdir(path.join(projectRoot, "assets"), { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const categoryRoot = path.join(projectRoot, "assets", category.name);
    for (const entry of await fs.readdir(categoryRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const assetDir = path.join(categoryRoot, entry.name);
      const manifestPath = path.join(assetDir, "asset.json");
      if (!await exists(manifestPath)) continue;
      result.push({ assetDir, manifest: await readJson(manifestPath) });
    }
  }
  return result;
}

function selectionKey(selection) {
  return Object.entries(selection).map(([key, value]) => `${key}=${value}`).join("|");
}

function controlApplies(control, selection) {
  return Object.entries(control.when ?? {}).every(([key, values]) => (
    (values ?? []).map(String).includes(String(selection[key]))
  ));
}

function reviewSelections(review) {
  const controls = review.controls ?? [];
  const defaults = Object.fromEntries(controls.map((control) => [control.key, control.default ?? control.values?.[0]]));
  const selections = [{ ...defaults }];
  for (const control of controls) {
    const activation = Object.fromEntries(Object.entries(control.when ?? {}).map(([key, values]) => [key, values?.[0]]));
    for (const value of control.values ?? []) {
      const selection = { ...defaults, ...activation, [control.key]: value };
      for (const candidate of controls) {
        if (!controlApplies(candidate, selection)) selection[candidate.key] = candidate.default ?? candidate.values?.[0];
      }
      selections.push(selection);
    }
  }
  for (const selection of review.contractSelections ?? []) selections.push({ ...defaults, ...selection });
  return [...new Map(selections.map((selection) => [selectionKey(selection), selection])).values()];
}

function stateIssues(slots, minimumFontSize) {
  return slots.flatMap((slot) => {
    if (slot.contentType !== "text") return [];
    const issues = [];
    if (slot.capacity?.reliable === false) issues.push("text-slot-needs-explicit-rectangular-container");
    if (slot.capacity?.declarationFits === false) issues.push("declared-capacity-exceeds-geometry");
    if (slot.capacity?.sampleUnexpectedWrap === true) issues.push("unexpected-single-line-wrap");
    if (slot.capacity?.sampleOverflowsWidth === true || slot.capacity?.sampleOverflowsHeight === true) issues.push("sample-text-overflow");
    if (slot.typography?.role === "custom") issues.push("custom-font-size");
    if (Number.isFinite(minimumFontSize) && slot.typography?.fontSizePt < minimumFontSize) issues.push("font-below-minimum");
    return issues.map((code) => ({ code, slotId: slot.id }));
  });
}

function compactSlot(slot) {
  return {
    id: slot.id,
    role: slot.role,
    field: slot.field,
    itemId: slot.itemId,
    contentType: slot.contentType,
    required: slot.required,
    textMode: slot.textMode,
    listPolicy: slot.listPolicy,
    frame: slot.frame,
    capacity: slot.contentType === "text" ? {
      charsPerLine: slot.capacity?.charsPerLine,
      maxLines: slot.capacity?.maxLines,
      maxChars: slot.capacity?.maxChars,
      reliable: slot.capacity?.reliable,
      declarationFits: slot.capacity?.declarationFits,
      sampleFits: slot.capacity?.sampleFits,
    } : {},
    ...(slot.typography ? { typography: {
      role: slot.typography.role,
      fontSizePt: slot.typography.fontSizePt,
      alignment: slot.typography.alignment,
      lineHeightPt: slot.typography.lineHeightPt,
    } } : {}),
    ...(slot.media ? { media: slot.media } : {}),
  };
}

const built = [];
try {
  for (const { assetDir, manifest } of await manifests()) {
    const runtime = manifest.runtime ?? {};
    const review = runtime.review ?? {};
    if (
      manifest.status !== "core"
      || runtime.renderer !== "html-component"
      || !runtime.entry
      || !runtime.componentExport
      || !review.entry
      || !review.previewParametersExport
      || (assetFilter.size && !assetFilter.has(manifest.id))
    ) continue;
    const approvalPath = path.join(assetDir, "user-approval.json");
    if (!await exists(approvalPath) || (await readJson(approvalPath)).decision !== "approved") continue;
    const contractPath = path.join(assetDir, "slot-contract.json");
    if (skipExisting && await exists(contractPath)) continue;

    try {
      const reviewPath = path.resolve(assetDir, review.entry);
      const reviewModule = await import(`${pathToFileURL(reviewPath).href}?slot-contract=${(await fs.stat(reviewPath)).mtimeMs}`);
      const component = reviewModule[runtime.componentExport];
      const preview = reviewModule[review.previewParametersExport];
      const resolver = review.previewResolverExport ? reviewModule[review.previewResolverExport] : null;
      if (!component?.renderMarkup || !preview) throw new Error(`${manifest.id} 缺少 HTML 审查入口`);

      const targetFrame = manifest.spatialContract?.contentFrame ?? { left: 55, top: 166, width: 1170, height: 492 };
      const minimumFontSize = Number(manifest.spatialContract?.minFontSize ?? 16);
      const states = [];
      const variants = [];
      const variantBySlots = new Map();
      for (const selection of reviewSelections(review)) {
        const parameters = resolver ? resolver(structuredClone(preview), selection) : structuredClone(preview);
        const tree = await resolveHtmlComponent({ component, parameters, assetDir, targetFrame, theme: northeasternUniversityTheme });
        const slots = tree.slots.map(compactSlot);
        const issues = stateIssues(tree.slots, minimumFontSize);
        const signature = JSON.stringify({ slots, issues });
        let variantId = variantBySlots.get(signature);
        if (!variantId) {
          variantId = `v${variants.length + 1}`;
          variantBySlots.set(signature, variantId);
          variants.push({ id: variantId, slots, issues });
        }
        states.push({ key: selectionKey(selection), selection, variantId });
      }
      const issueCount = variants.reduce((sum, variant) => sum + variant.issues.length, 0);
      const contract = {
        schemaVersion: 2,
        assetId: manifest.id,
        themeId: "northeastern-university-001",
        sampling: "default-plus-one-control",
        controls: (review.controls ?? []).map(({ key, label, values, default: defaultValue, when }) => ({
          key,
          label,
          values,
          default: defaultValue ?? values?.[0],
          ...(when ? { when } : {}),
        })),
        coordinateUnit: "design-px",
        typographyUnit: "ppt-pt",
        minimumFontSize,
        status: issueCount ? "needs-adjustment" : "ready",
        states,
        variants,
      };
      await writeJson(contractPath, contract);
      built.push({ assetId: manifest.id, states: states.length, issueCount, status: contract.status });
    } catch (error) {
      const contract = {
        schemaVersion: 2,
        assetId: manifest.id,
        themeId: "northeastern-university-001",
        coordinateUnit: "design-px",
        typographyUnit: "ppt-pt",
        status: "build-error",
        states: [],
        variants: [],
        error: String(error?.message ?? error).split("\n")[0],
      };
      await writeJson(contractPath, contract);
      built.push({ assetId: manifest.id, states: 0, issueCount: 1, status: contract.status });
    }
  }
} finally {
  await closeHtmlComponentRuntime();
}

for (const item of built) console.log(`${item.assetId}\tstates=${item.states}\tissues=${item.issueCount}\t${item.status}`);
console.log(`built=${built.length}`);
