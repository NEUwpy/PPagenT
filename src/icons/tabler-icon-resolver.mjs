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
  const queryTokens = tokens(query);
  if (!queryTokens.length) return null;
  const ranked = index
    .map((icon) => ({
      icon,
      score: queryTokens.reduce((sum, token) => sum + tokenScore(token, icon), 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.icon.key.localeCompare(right.icon.key));
  if (!ranked.length) return null;
  const match = ranked[0];
  return {
    key: match.icon.key,
    category: match.icon.category,
    tags: match.icon.tags,
    score: match.score,
    svgPath: path.join(iconRoot, `${match.icon.key}.svg`),
  };
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
