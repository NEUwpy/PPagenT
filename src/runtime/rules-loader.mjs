import fs from "node:fs/promises";
import path from "node:path";

const PROFILES = new Set(["generation", "content-director", "visual-selector"]);
const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function relativeFile(value) {
  if (typeof value !== "string" || !value || value.includes("\\")
    || value.includes(":") || value.includes("\0") || path.posix.isAbsolute(value)
    || value.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`非法规则路径: ${value}`);
  }
  return value;
}

async function boundedFile(root, relative) {
  relativeFile(relative);
  const [base, file] = await Promise.all([fs.realpath(root), fs.realpath(path.join(root, relative))]);
  const offset = path.relative(base, file);
  if (!offset || offset === ".." || offset.startsWith(`..${path.sep}`) || path.isAbsolute(offset)) {
    throw new Error(`规则路径越界: ${relative}`);
  }
  return file;
}

function paths(value, label) {
  if (!Array.isArray(value) || !value.length) throw new Error(`规则清单为空或非法: ${label}`);
  return value.map((entry) => {
    relativeFile(entry);
    if (!entry.endsWith(".md")) throw new Error(`规则必须为 Markdown: ${entry}`);
    return entry;
  });
}

/** Read the selected bodies on every call; no module or process-level rule cache. */
export async function loadRules(root, { profile, skin } = {}) {
  if (!PROFILES.has(profile)) throw new Error(`非法规则 profile: ${profile}`);
  if (skin !== undefined && (profile !== "generation" || typeof skin !== "string" || !ID.test(skin))) {
    throw new Error("仅 generation 允许合法 skin ID");
  }
  const rulesRoot = path.join(root, "rules");
  const index = JSON.parse(await fs.readFile(await boundedFile(rulesRoot, "index.json"), "utf8"));
  if (!index.profiles || Object.keys(index.profiles).length !== 3
    || Object.keys(index.profiles).some((key) => !PROFILES.has(key))) {
    throw new Error("规则索引必须且只能声明三个正式 profiles");
  }
  for (const [key, value] of Object.entries(index.profiles)) paths(value, key);
  if (!index.skins || Array.isArray(index.skins) || typeof index.skins !== "object") {
    throw new Error("规则索引缺少 skins 映射");
  }
  for (const [key, value] of Object.entries(index.skins)) {
    if (!ID.test(key)) throw new Error(`非法 skin ID: ${key}`);
    paths(value, key);
  }
  if (skin !== undefined && !Object.hasOwn(index.skins, skin)) throw new Error(`未知 skin: ${skin}`);
  const selected = [...index.profiles[profile], ...(skin === undefined ? [] : index.skins[skin])];
  const files = [];
  const seen = new Set();
  const configurationSources = [];
  const seenFonts = new Set();
  for (const relative of selected) {
    const absolute = await boundedFile(rulesRoot, relative);
    if (seen.has(absolute)) continue;
    seen.add(absolute);
    const body = await fs.readFile(absolute, "utf8");
    if (!body.trim()) throw new Error(`规则正文为空: ${relative}`);
    files.push({ path: relative, body });
    for (const match of body.matchAll(/<!--\s*asset-fonts:\s*(.*?)\s*-->/g)) {
      const source = relativeFile(match[1]);
      if (profile !== "generation" || !skin || !/^assets\/主题\/[^/]+\/asset\.json$/.test(source)) {
        throw new Error(`字体配置引用不适用于当前规则范围: ${source}`);
      }
      const absoluteSource = await boundedFile(root, source);
      // Also prevent a linked asset folder from escaping the theme directory.
      await boundedFile(path.join(root, "assets", "主题"), source.slice("assets/主题/".length));
      if (seenFonts.has(absoluteSource)) continue;
      seenFonts.add(absoluteSource);
      const asset = JSON.parse(await fs.readFile(absoluteSource, "utf8"));
      if (asset.id !== skin || asset.kind !== "skin" || !asset.fonts
        || typeof asset.fonts !== "object" || Array.isArray(asset.fonts)
        || !Object.keys(asset.fonts).length
        || Object.values(asset.fonts).some((font) => typeof font !== "string" || !font.trim())) {
        throw new Error(`Skin 字体配置无效: ${source}`);
      }
      configurationSources.push({ path: source, field: "fonts", value: asset.fonts });
    }
  }
  const text = [
    ...files.map((file) => `<!-- rules/${file.path} -->\n${file.body.trim()}`),
    ...configurationSources.map((source) => `## Skin 字体配置（${source.path}#${source.field}）\n\n\`\`\`json\n${JSON.stringify(source.value, null, 2)}\n\`\`\``),
  ].join("\n\n");
  return { profile, ...(skin === undefined ? {} : { skin }), files, configurationSources, text };
}
