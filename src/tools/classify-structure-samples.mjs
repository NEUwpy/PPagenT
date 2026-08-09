import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith("--") || value === undefined) throw new Error(`Invalid argument: ${name ?? "<empty>"}`);
    values[name.slice(2)] = value;
  }
  if (!values.root || !values.map) throw new Error("Required: --root and --map");
  return values;
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root);
const map = JSON.parse(await fs.readFile(path.resolve(args.map), "utf8"));
const registryPath = path.join(root, "registry.json");
const registry = JSON.parse(await fs.readFile(registryPath, "utf8"));
const byId = new Map(registry.samples.map((entry) => [entry.id, entry]));
const assigned = new Set();
let moved = 0;

for (const [family, ids] of Object.entries(map.groups)) {
  const destinationDir = path.resolve(root, family);
  if (!inside(root, destinationDir)) throw new Error(`Family path outside root: ${family}`);
  await fs.mkdir(destinationDir, { recursive: true });
  for (const id of ids) {
    if (assigned.has(id)) throw new Error(`Duplicate classification: ${id}`);
    assigned.add(id);
    const entry = byId.get(id);
    if (!entry) throw new Error(`Unknown sample: ${id}`);
    const currentMeta = path.resolve(root, entry.path);
    if (!inside(root, currentMeta)) throw new Error(`Metadata path outside root: ${entry.path}`);
    const currentDir = path.dirname(currentMeta);
    const destinationMeta = path.join(destinationDir, `${id}.json`);
    for (const extension of [".png", ".pptx", ".json"]) {
      const source = path.join(currentDir, `${id}${extension}`);
      const destination = path.join(destinationDir, `${id}${extension}`);
      if (path.resolve(source) === path.resolve(destination)) continue;
      if (await exists(source)) {
        if (await exists(destination)) throw new Error(`Destination already exists: ${destination}`);
        await fs.rename(source, destination);
      } else if (!(await exists(destination))) {
        throw new Error(`Missing sample file: ${source}`);
      }
    }
    const metadata = JSON.parse(await fs.readFile(destinationMeta, "utf8"));
    metadata.families = [family];
    metadata.preview = `${family}/${id}.png`;
    metadata.singleSlidePptx = `${family}/${id}.pptx`;
    await fs.writeFile(destinationMeta, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    entry.families = [family];
    entry.path = `${family}/${id}.json`;
    moved += 1;
  }
}

registry.samples.sort((left, right) => {
  const familyCompare = String(left.families?.[0] ?? "").localeCompare(String(right.families?.[0] ?? ""), "zh-CN");
  if (familyCompare !== 0) return familyCompare;
  return String(left.name).localeCompare(String(right.name), "zh-CN");
});
await fs.writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
console.log(`CLASSIFIED=${moved}`);
