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

function expandControls(controls, index = 0, selection = {}) {
  if (index >= controls.length) return [{ ...selection }];
  const control = controls[index];
  const values = controlApplies(control, selection)
    ? (control.values ?? [])
    : [control.default ?? control.values?.[0]];
  return values.flatMap((value) => expandControls(controls, index + 1, { ...selection, [control.key]: value }));
}

function reviewSelections(review) {
  const controls = review.controls ?? [];
  const defaults = Object.fromEntries(controls.map((control) => [control.key, control.default ?? control.values?.[0]]));
  const selections = expandControls(controls);
  for (const selection of review.contractSelections ?? []) selections.push({ ...defaults, ...selection });
  return [...new Map(selections.map((selection) => [selectionKey(selection), selection])).values()];
}

function stateIssues(slots, minimumFontSize) {
  return slots.flatMap((slot) => {
    if (slot.contentType !== "text") return [];
    const issues = [];
    if (slot.capacity?.reliable === false) issues.push("text-slot-needs-explicit-rectangular-container");
    if (slot.capacity?.declarationFits === false) issues.push("declared-capacity-exceeds-geometry");
    if (slot.typography?.role === "custom") issues.push("custom-font-size");
    if (Number.isFinite(minimumFontSize) && slot.typography?.fontSizePt < minimumFontSize) issues.push("font-below-minimum");
    return issues.map((code) => ({ code, slotId: slot.id }));
  });
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
        const issues = stateIssues(tree.slots, minimumFontSize);
        const signature = JSON.stringify({ slots: tree.slots, issues });
        let variantId = variantBySlots.get(signature);
        if (!variantId) {
          variantId = `v${variants.length + 1}`;
          variantBySlots.set(signature, variantId);
          variants.push({ id: variantId, slots: tree.slots, issues });
        }
        states.push({ key: selectionKey(selection), selection, variantId });
      }
      const issueCount = variants.reduce((sum, variant) => sum + variant.issues.length, 0);
      const contract = {
        schemaVersion: 1,
        assetId: manifest.id,
        themeId: "northeastern-university-001",
        coordinateUnit: "design-px",
        typographyUnit: "ppt-pt",
        minimumFontSize,
        status: issueCount ? "needs-adjustment" : "ready",
        states,
        variants,
      };
      await fs.writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
      built.push({ assetId: manifest.id, states: states.length, issueCount, status: contract.status });
    } catch (error) {
      const contract = {
        schemaVersion: 1,
        assetId: manifest.id,
        themeId: "northeastern-university-001",
        coordinateUnit: "design-px",
        typographyUnit: "ppt-pt",
        status: "build-error",
        states: [],
        variants: [],
        error: String(error?.message ?? error).split("\n")[0],
      };
      await fs.writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
      built.push({ assetId: manifest.id, states: 0, issueCount: 1, status: contract.status });
    }
  }
} finally {
  await closeHtmlComponentRuntime();
}

for (const item of built) console.log(`${item.assetId}\tstates=${item.states}\tissues=${item.issueCount}\t${item.status}`);
console.log(`built=${built.length}`);
