import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PresentationFile } from "@oai/artifact-tool";
import { createPresentation } from "../asset-runtime/component-builders.mjs";

const projectRoot = path.resolve(process.argv[2] ?? path.resolve(import.meta.dirname, "../.."));

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function assetManifests() {
  const result = [];
  const assetsRoot = path.join(projectRoot, "assets");
  for (const category of await fs.readdir(assetsRoot, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const categoryRoot = path.join(assetsRoot, category.name);
    for (const asset of await fs.readdir(categoryRoot, { withFileTypes: true })) {
      if (!asset.isDirectory()) continue;
      const assetDir = path.join(categoryRoot, asset.name);
      const manifestPath = path.join(assetDir, "asset.json");
      try {
        result.push({ assetDir, manifest: await readJson(manifestPath) });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }
  return result;
}

function cartesianControls(controls, index = 0, selection = {}) {
  if (index >= controls.length) return [{ ...selection }];
  const control = controls[index];
  return control.values.flatMap((value) => cartesianControls(
    controls,
    index + 1,
    { ...selection, [control.key]: value },
  ));
}

async function importFresh(filePath) {
  const stat = await fs.stat(filePath);
  return import(`${pathToFileURL(filePath).href}?examples=${stat.mtimeMs}`);
}

function resolvedParameters(reviewModule, review, selection) {
  const parameters = structuredClone(reviewModule[review.previewParametersExport]);
  const resolver = review.previewResolverExport
    ? reviewModule[review.previewResolverExport]
    : null;
  return resolver ? resolver(parameters, selection) : parameters;
}

const built = [];
for (const { assetDir, manifest } of await assetManifests()) {
  const runtime = manifest.runtime ?? {};
  const review = runtime.review;
  if (
    manifest.status !== "core"
    || !runtime.entry
    || !runtime.builderExport
    || !review?.entry
    || !review.previewParametersExport
    || !Array.isArray(review.controls)
    || !review.controls.length
  ) continue;

  const [runtimeModule, reviewModule] = await Promise.all([
    importFresh(path.resolve(assetDir, runtime.entry)),
    importFresh(path.resolve(assetDir, review.entry)),
  ]);
  const builder = runtimeModule[runtime.builderExport];
  if (typeof builder !== "function") throw new Error(`${manifest.id} 缺少 ${runtime.builderExport}`);

  const presentation = createPresentation();
  const selections = cartesianControls(review.controls);
  for (const selection of selections) {
    const parameters = resolvedParameters(reviewModule, review, selection);
    await builder(presentation, parameters);
  }

  const outputPath = path.resolve(assetDir, manifest.showcase ?? "example.pptx");
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPath);
  built.push({ id: manifest.id, slides: selections.length, output: path.relative(projectRoot, outputPath) });
}

for (const item of built) console.log(`${item.id}\t${item.slides}\t${item.output}`);
console.log(`built=${built.length}`);
