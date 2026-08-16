import fs from "node:fs/promises";
import path from "node:path";

async function findManifestPaths(directory) {
  const manifests = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) manifests.push(...await findManifestPaths(target));
    else if (entry.isFile() && entry.name === "asset.json") manifests.push(target);
  }
  return manifests;
}

export async function discoverAssetManifestEntries(root, libraryDirectory) {
  const libraryRoot = path.resolve(root, libraryDirectory);
  const manifests = await findManifestPaths(libraryRoot);
  const entries = [];
  const ids = new Set();
  for (const manifestPath of manifests) {
    const metadata = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (!metadata.id || !metadata.name || !metadata.category) {
      throw new Error(`${path.relative(root, manifestPath)} 缺少 id、name 或 category`);
    }
    if (ids.has(metadata.id)) throw new Error(`${libraryDirectory} 中资产 id 重复：${metadata.id}`);
    ids.add(metadata.id);
    const directory = path.dirname(manifestPath);
    entries.push({
      id: metadata.id,
      name: metadata.name,
      category: metadata.category,
      status: metadata.status,
      path: path.relative(libraryRoot, directory).replaceAll("\\", "/"),
      directory,
      manifestPath,
      layoutExpansion: metadata.layoutExpansion ?? null,
      metadata,
    });
  }
  return entries.sort((left, right) => left.id.localeCompare(right.id));
}

