import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.resolve("@tabler/icons/outline/activity.svg"))),
  "../..",
);
const iconRoot = path.join(packageRoot, "icons", "outline");
const metadata = JSON.parse(fs.readFileSync(path.join(packageRoot, "icons.json"), "utf8"));

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value) {
  return normalize(value).split(/\s+/).filter(Boolean);
}

const index = Object.values(metadata)
  .filter((icon) => icon.styles?.outline)
  .map((icon) => {
    const nameTokens = tokens(icon.name);
    const tagTokens = (icon.tags ?? []).flatMap(tokens);
    const categoryTokens = tokens(icon.category);
    return {
      key: icon.name,
      category: icon.category ?? "",
      tags: (icon.tags ?? []).map(String),
      nameTokens,
      tagTokens,
      categoryTokens,
      allTokens: new Set([...nameTokens, ...tagTokens, ...categoryTokens]),
    };
  });

const iconByNormalizedKey = new Map(index.map((icon) => [normalize(icon.key), icon]));

// The model supplies semantic search phrases, not Tabler file names. A small
// concept map prevents literal matches such as "visual" -> Visual Studio or
// "capacity" -> cubic metre from outranking the intended pictogram.
const semanticAliases = Object.freeze([
  { key: "presentation", phrases: ["presentation approach", "presentation method"] },
  { key: "list-numbers", phrases: ["page count", "number of pages"] },
  { key: "checklist", words: ["responsibility", "duty", "responsibilities"] },
  { key: "hierarchy", words: ["relationship", "relation", "dependency"] },
  { key: "layout", phrases: ["image and text", "picture and text", "text and image"] },
  { key: "hourglass-low", phrases: ["low requirement", "low demand"] },
  { key: "adjustments-horizontal", phrases: ["mid requirement", "medium requirement"] },
  { key: "wand", phrases: ["high customization", "customization"] },
  { key: "palette", phrases: ["visual specification", "visual style", "design specification"] },
  { key: "typography", phrases: ["expression capability", "expression ability"], words: ["expression"] },
  { key: "stack-2", phrases: ["quantity capacity", "content capacity"], words: ["capacity"] },
  { key: "arrows-down", phrases: ["degradation method", "fallback method"], words: ["degradation", "fallback"] },
  { key: "refresh", words: ["rearrangement", "reorder", "redistribution"] },
  { key: "border-all", words: ["boundary", "border", "limits"] },
  { key: "ban", words: ["disabled", "forbidden", "prohibited"] },
  { key: "file-text", phrases: ["draft reading", "read draft"] },
  { key: "scale", phrases: ["rule judgment", "rule decision"] },
  { key: "code", phrases: ["code labor", "code execution"] },
]);

function semanticAlias(normalizedQuery, queryTokens) {
  for (const alias of semanticAliases) {
    if (alias.phrases?.some((phrase) => normalizedQuery.includes(phrase))) return iconByNormalizedKey.get(normalize(alias.key));
    if (alias.words?.some((word) => queryTokens.includes(word))) return iconByNormalizedKey.get(normalize(alias.key));
  }
  return null;
}

function resultFor(icon, score) {
  if (!icon) return null;
  return {
    key: icon.key,
    category: icon.category,
    tags: icon.tags,
    score,
    svgPath: path.join(iconRoot, `${icon.key}.svg`),
  };
}

function tokenScore(query, icon) {
  if (icon.key === query) return 240;
  if (icon.nameTokens.includes(query)) return 90;
  if (icon.tagTokens.includes(query)) return 70;
  if (icon.categoryTokens.includes(query)) return 45;
  if (icon.key.includes(query)) return 38;
  if ([...icon.allTokens].some((token) => token.startsWith(query) || query.startsWith(token))) return 24;
  if ([...icon.allTokens].some((token) => token.includes(query) || query.includes(token))) return 12;
  return 0;
}

export function resolveTablerIcon(query) {
  const normalizedQuery = normalize(query);
  const queryTokens = tokens(query);
  if (!queryTokens.length) return null;
  const aliasIcon = semanticAlias(normalizedQuery, queryTokens);
  if (aliasIcon) return resultFor(aliasIcon, 900);
  const exactIcon = iconByNormalizedKey.get(normalizedQuery);
  if (exactIcon) return resultFor(exactIcon, 1000);
  const ranked = index
    .map((icon) => ({
      icon,
      score: queryTokens.reduce((sum, token) => sum + tokenScore(token, icon), 0)
        - (icon.key.startsWith("brand-") && !queryTokens.includes("brand") ? 180 : 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.icon.key.localeCompare(right.icon.key));
  if (!ranked.length) return null;
  const match = ranked[0];
  return resultFor(match.icon, match.score);
}

export function tablerIconSvgMarkup(icon, { name = "tabler-icon", className = "tabler-icon" } = {}) {
  if (!icon?.key) return "";
  const svgPath = path.join(iconRoot, `${icon.key}.svg`);
  if (!fs.existsSync(svgPath)) return "";
  const svg = fs.readFileSync(svgPath, "utf8")
    .replace(/<path\s+stroke="none"\s+d="M0 0h24v24H0z"\s+fill="none"\s*\/>/i, "")
    .replace(/<svg\b/, `<svg data-ppt-kind="image" data-ppt-name="${name}" data-icon-key="${icon.key}"`)
    .replace(/class="[^"]*"/, `class="${className}"`);
  return svg;
}

export function tablerIconCount() {
  return index.length;
}
