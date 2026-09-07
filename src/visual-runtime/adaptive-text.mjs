/**
 * Conservative text envelope helpers used before the browser-backed component
 * compiler runs.  The browser remains the final authority; these functions
 * only prevent a page planner from offering a clearly impossible region.
 */

export const ADAPTIVE_FONT_TIERS = Object.freeze([25, 23, 21, 19, 17, 15]);

function isWideCharacter(character) {
  return /[\u1100-\u11ff\u2e80-\u9fff\uf900-\ufaff\ufe30-\ufe6f\uff00-\uffef]/u.test(character);
}

export function estimateTextWidth(text, fontSizePt, { letterSpacing = 0 } = {}) {
  const value = String(text ?? "").replace(/\r/g, "");
  const average = [...value].reduce((sum, character) => (
    sum + (isWideCharacter(character) ? 1 : /\s/u.test(character) ? 0.34 : 0.58)
  ), 0);
  return (average * (Number(fontSizePt) / 0.75)) + Math.max(0, [...value].length - 1) * Number(letterSpacing || 0);
}

export function estimateTextHeight(text, fontSizePt, width, {
  lineHeight = 1.2,
  maxLines = Infinity,
} = {}) {
  const lines = String(text ?? "").replace(/\r/g, "").split("\n");
  const lineWidth = Math.max(1, Number(width) || 1);
  const measuredLines = lines.reduce((sum, line) => {
    const required = estimateTextWidth(line, fontSizePt);
    return sum + Math.max(1, Math.ceil(required / lineWidth));
  }, 0);
  return {
    lines: measuredLines,
    height: measuredLines * (Number(fontSizePt) / 0.75) * Number(lineHeight || 1.2),
    fitsLineLimit: measuredLines <= maxLines,
    method: "conservative-character-envelope",
  };
}

export function resolveAdaptiveFontTier({
  text = "",
  requestedPt = 17,
  minimumPt = 15,
  width,
  height,
  lineHeight = 1.2,
  maxLines = Infinity,
  tiers = ADAPTIVE_FONT_TIERS,
} = {}) {
  const candidates = [...new Set(tiers.map(Number).filter((size) => (
    Number.isFinite(size) && size <= Number(requestedPt) + 0.01 && size >= Number(minimumPt)
  )))].sort((left, right) => right - left);
  for (const fontSizePt of candidates) {
    const estimate = estimateTextHeight(text, fontSizePt, width, { lineHeight, maxLines });
    if (estimate.fitsLineLimit && estimate.height <= Number(height) + 2) {
      return { fontSizePt, reduced: fontSizePt < requestedPt, estimate, method: estimate.method };
    }
  }
  return {
    fontSizePt: null,
    reduced: false,
    estimate: estimateTextHeight(text, minimumPt, width, { lineHeight, maxLines }),
    method: "conservative-character-envelope",
    reason: "text-overflow",
  };
}

export function summarizeTextPressure(value) {
  const text = typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value.map(summarizeTextPressure).reduce((sum, item) => sum + item.characters, 0)
      : value && typeof value === "object"
        ? Object.entries(value)
          .filter(([key]) => !["key", "id", "icon", "color", "value"].includes(key))
          .map(([, item]) => summarizeTextPressure(item).characters)
          .reduce((sum, item) => sum + item, 0)
        : 0;
  const characters = typeof text === "number" ? text : [...text].length;
  return {
    characters,
    multiplier: characters > 520 ? 1.2 : characters > 300 ? 1.1 : characters > 180 ? 1.04 : 1,
    method: "conservative-character-envelope",
  };
}

