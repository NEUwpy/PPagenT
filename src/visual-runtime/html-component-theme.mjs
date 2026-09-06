const DEFAULT_PRIMARY_COLOR = "#315F91";

function cssString(value, fallback) {
  return `"${String(value ?? fallback).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function normalizeHex(value) {
  const candidate = String(value ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(candidate)) return candidate.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(candidate)) {
    return `#${[...candidate.slice(1)].map((part) => part.repeat(2)).join("")}`.toUpperCase();
  }
  return null;
}

function cssColor(value, fallback) {
  return normalizeHex(value) ?? fallback;
}

function neutralCssColor(value, fallback, strict) {
  const color = normalizeHex(value);
  if (!color) return fallback;
  if (!strict || rgbToHsl(hexToRgb(color)).s < 0.075) return color;
  return fallback;
}

function hexToRgb(hex) {
  const value = normalizeHex(hex);
  if (!value) return null;
  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const channel = (value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

function rgbToHsl({ r, g, b }) {
  const [red, green, blue] = [r, g, b].map((value) => value / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l: lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue = max === red
    ? 60 * (((green - blue) / delta) % 6)
    : max === green
      ? 60 * ((blue - red) / delta + 2)
      : 60 * ((red - green) / delta + 4);
  return { h: (hue + 360) % 360, s: saturation, l: lightness };
}

function mix(left, right, ratio) {
  const a = hexToRgb(left);
  const b = hexToRgb(right);
  return rgbToHex({
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio,
  });
}

export const defaultStructurePrimaryColor = DEFAULT_PRIMARY_COLOR;

export function resolveStructureTheme(theme = {}) {
  const explicitPrimary = normalizeHex(theme?.primaryColor);
  const primaryColor = explicitPrimary ?? cssColor(theme.accent, DEFAULT_PRIMARY_COLOR);
  const derived = {
    primaryColor,
    accent: primaryColor,
    accentAlt: mix(primaryColor, "#FFFFFF", 0.18),
    accentSoft: mix(primaryColor, "#FFFFFF", 0.82),
    cyan: mix(primaryColor, "#FFFFFF", 0.36),
    line: mix(primaryColor, "#FFFFFF", 0.64),
    primaryDeep: mix(primaryColor, "#000000", 0.42),
    primaryDark: mix(primaryColor, "#000000", 0.24),
    primaryLight: mix(primaryColor, "#FFFFFF", 0.34),
    primaryPale: mix(primaryColor, "#FFFFFF", 0.65),
    primaryWash: mix(primaryColor, "#FFFFFF", 0.88),
  };
  return Object.freeze({
    ...theme,
    ...derived,
    // Compatibility: old callers can keep secondary tokens until they opt in.
    accentAlt: explicitPrimary ? derived.accentAlt : cssColor(theme.accentAlt, derived.accentAlt),
    accentSoft: explicitPrimary ? derived.accentSoft : cssColor(theme.accentSoft, derived.accentSoft),
    cyan: explicitPrimary ? derived.cyan : cssColor(theme.cyan, derived.cyan),
    line: explicitPrimary ? derived.line : cssColor(theme.line, derived.line),
    background: neutralCssColor(theme.background, "#FFFFFF", Boolean(explicitPrimary)),
    surface: neutralCssColor(theme.surface, "#FFFFFF", Boolean(explicitPrimary)),
    dark: neutralCssColor(theme.dark, "#2B2B2B", Boolean(explicitPrimary)),
    body: neutralCssColor(theme.body, "#404040", Boolean(explicitPrimary)),
    muted: neutralCssColor(theme.muted, "#6F6F6F", Boolean(explicitPrimary)),
    font: theme.font ?? "Microsoft YaHei",
  });
}

export const defaultComponentTypography = Object.freeze({
  componentHeading: 22,
  componentTitle: 20,
  componentItemTitle: 18,
  componentLead: 16,
  componentBody: 14,
  componentLabel: 14,
  componentMeta: 12,
});

export function resolveComponentTypography(theme = {}) {
  return Object.freeze({
    ...defaultComponentTypography,
    ...(theme.typography ?? {}),
  });
}

export function htmlComponentThemeCss(theme = {}) {
  const resolved = resolveStructureTheme(theme);
  const typography = resolveComponentTypography(theme);
  return `/* ppagent-theme:resolved */:root{
    --ppagent-font-body:${cssString(resolved.font, "Microsoft YaHei")};
    --ppagent-color-background:${resolved.background};
    --ppagent-color-surface:${resolved.surface};
    --ppagent-color-primary:${resolved.primaryColor};
    --ppagent-color-primary-deep:${resolved.primaryDeep};
    --ppagent-color-primary-dark:${resolved.primaryDark};
    --ppagent-color-primary-light:${resolved.primaryLight};
    --ppagent-color-primary-pale:${resolved.primaryPale};
    --ppagent-color-primary-wash:${resolved.primaryWash};
    --ppagent-color-accent:${resolved.accent};
    --ppagent-color-accent-alt:${resolved.accentAlt};
    --ppagent-color-accent-soft:${resolved.accentSoft};
    --ppagent-color-cyan:${resolved.cyan};
    --ppagent-color-dark:${resolved.dark};
    --ppagent-color-body:${resolved.body};
    --ppagent-color-muted:${resolved.muted};
    --ppagent-color-line:${resolved.line};
    --ppagent-component-heading-size:${Number(typography.componentHeading)}pt;
    --ppagent-component-title-size:${Number(typography.componentTitle)}pt;
    --ppagent-component-item-title-size:${Number(typography.componentItemTitle)}pt;
    --ppagent-component-lead-size:${Number(typography.componentLead)}pt;
    --ppagent-component-body-size:${Number(typography.componentBody)}pt;
    --ppagent-component-label-size:${Number(typography.componentLabel)}pt;
    --ppagent-component-meta-size:${Number(typography.componentMeta)}pt;
  }`;
}

function authoredColorRole(rgb) {
  const { s, l } = rgbToHsl(rgb);
  if (s < 0.075) return null;
  if (l <= 0.22) return "primaryDeep";
  if (l <= 0.36) return "primaryDark";
  if (l <= 0.62) return "primaryColor";
  if (l <= 0.74) return "primaryLight";
  if (l <= 0.86) return "primaryPale";
  return "primaryWash";
}

function compileRgb(rgb, palette) {
  const role = authoredColorRole(rgb);
  return role ? hexToRgb(palette[role]) : rgb;
}

function cssFunctionEnd(source, start) {
  let depth = 0;
  let quote = null;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "(") depth += 1;
    else if (character === ")" && --depth === 0) return index + 1;
  }
  return source.length;
}

function compileCssColorTokens(value, palette) {
  let output = "";
  for (let index = 0; index < value.length;) {
    const character = value[index];
    if (character === "/" && value[index + 1] === "*") {
      const end = value.indexOf("*/", index + 2);
      const next = end < 0 ? value.length : end + 2;
      output += value.slice(index, next);
      index = next;
      continue;
    }
    if (character === '"' || character === "'") {
      const start = index++;
      while (index < value.length) {
        if (value[index] === "\\") index += 2;
        else if (value[index++] === character) break;
      }
      output += value.slice(start, index);
      continue;
    }
    if (/^url\s*\(/i.test(value.slice(index))) {
      const end = cssFunctionEnd(value, index + value.slice(index).search(/\(/));
      output += value.slice(index, end);
      index = end;
      continue;
    }
    const hex = value.slice(index).match(/^#[0-9a-f]{8}\b|^#[0-9a-f]{6}\b/i)?.[0];
    if (hex) {
      const alpha = hex.length === 9 ? hex.slice(7) : "";
      output += `${rgbToHex(compileRgb(hexToRgb(hex.slice(0, 7)), palette))}${alpha}`;
      index += hex.length;
      continue;
    }
    const functional = value.slice(index).match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(\s*,\s*(?:0|1|0?\.\d+))?\s*\)/i);
    if (functional) {
      const [, red, green, blue, alpha = ""] = functional;
      const rgb = compileRgb({ r: Number(red), g: Number(green), b: Number(blue) }, palette);
      output += `${alpha ? "rgba" : "rgb"}(${rgb.r}, ${rgb.g}, ${rgb.b}${alpha})`;
      index += functional[0].length;
      continue;
    }
    output += character;
    index += 1;
  }
  return output;
}

function declarationColon(segment) {
  let quote = null;
  let comment = false;
  let parentheses = 0;
  for (let index = 0; index < segment.length; index += 1) {
    const character = segment[index];
    if (comment) {
      if (character === "*" && segment[index + 1] === "/") { comment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "/" && segment[index + 1] === "*") { comment = true; index += 1; }
    else if (character === '"' || character === "'") quote = character;
    else if (character === "(") parentheses += 1;
    else if (character === ")") parentheses = Math.max(0, parentheses - 1);
    else if (character === ":" && parentheses === 0) return index;
  }
  return -1;
}

function compileDeclarationSegment(segment, palette) {
  let declarationStart = 0;
  while (declarationStart < segment.length) {
    const whitespace = segment.slice(declarationStart).match(/^\s+/)?.[0];
    if (whitespace) { declarationStart += whitespace.length; continue; }
    if (segment.startsWith("/*", declarationStart)) {
      const commentEnd = segment.indexOf("*/", declarationStart + 2);
      if (commentEnd < 0) return segment;
      declarationStart = commentEnd + 2;
      continue;
    }
    break;
  }
  const declaration = segment.slice(declarationStart);
  const colon = declarationColon(declaration);
  if (colon < 0 || !/^-{0,2}[a-z_][\w-]*\s*$/i.test(declaration.slice(0, colon))) return segment;
  return `${segment.slice(0, declarationStart)}${declaration.slice(0, colon + 1)}${compileCssColorTokens(declaration.slice(colon + 1), palette)}`;
}

function compileCssDeclarations(source, palette) {
  let output = "";
  let start = 0;
  let quote = null;
  let comment = false;
  let parentheses = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (comment) {
      if (character === "*" && source[index + 1] === "/") { comment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") { comment = true; index += 1; }
    else if (character === '"' || character === "'") quote = character;
    else if (character === "(") parentheses += 1;
    else if (character === ")") parentheses = Math.max(0, parentheses - 1);
    else if (parentheses === 0 && (character === "{" || character === ";" || character === "}")) {
      const segment = source.slice(start, index);
      output += character === "{" ? segment : compileDeclarationSegment(segment, palette);
      output += character;
      start = index + 1;
    }
  }
  return output + compileDeclarationSegment(source.slice(start), palette);
}

function compileTagAttributes(tag, palette) {
  const selected = new Set(["style", "fill", "stroke", "color", "stop-color", "flood-color", "lighting-color", "bgcolor"]);
  const head = tag.match(/^<\s*\/?\s*[^\s/>]+/)?.[0];
  if (!head) return tag;
  let output = head;
  let index = head.length;
  while (index < tag.length) {
    const whitespace = tag.slice(index).match(/^\s+/)?.[0];
    if (whitespace) { output += whitespace; index += whitespace.length; continue; }
    if (tag[index] === ">" || (tag[index] === "/" && tag[index + 1] === ">")) {
      output += tag.slice(index);
      break;
    }
    const name = tag.slice(index).match(/^[^\s=/>]+/)?.[0];
    if (!name) { output += tag[index++]; continue; }
    output += name;
    index += name.length;
    const spacing = tag.slice(index).match(/^\s*/)?.[0] ?? "";
    output += spacing;
    index += spacing.length;
    if (tag[index] !== "=") continue;
    output += "=";
    index += 1;
    const valueSpacing = tag.slice(index).match(/^\s*/)?.[0] ?? "";
    output += valueSpacing;
    index += valueSpacing.length;
    const quote = tag[index] === '"' || tag[index] === "'" ? tag[index] : null;
    if (quote) {
      const valueStart = ++index;
      const valueEnd = tag.indexOf(quote, valueStart);
      if (valueEnd < 0) { output += quote + tag.slice(valueStart); break; }
      const value = tag.slice(valueStart, valueEnd);
      const compiled = selected.has(name.toLowerCase())
        ? name.toLowerCase() === "style" ? compileCssDeclarations(value, palette) : compileCssColorTokens(value, palette)
        : value;
      output += `${quote}${compiled}${quote}`;
      index = valueEnd + 1;
      continue;
    }
    const unquoted = tag.slice(index).match(/^[^\s>]+/)?.[0] ?? "";
    output += selected.has(name.toLowerCase())
      ? name.toLowerCase() === "style" ? compileCssDeclarations(unquoted, palette) : compileCssColorTokens(unquoted, palette)
      : unquoted;
    index += unquoted.length;
  }
  return output;
}

function tagEnd(markup, start) {
  let quote = null;
  for (let index = start; index < markup.length; index += 1) {
    const character = markup[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
    } else if (character === '"' || character === "'") quote = character;
    else if (character === ">") return index + 1;
  }
  return markup.length;
}

function compileMarkupColors(markup, palette) {
  let output = "";
  let index = 0;
  while (index < markup.length) {
    const open = markup.indexOf("<", index);
    if (open < 0) return output + markup.slice(index);
    output += markup.slice(index, open);
    if (markup.startsWith("<!--", open)) {
      const end = markup.indexOf("-->", open + 4);
      const next = end < 0 ? markup.length : end + 3;
      output += markup.slice(open, next);
      index = next;
      continue;
    }
    const end = tagEnd(markup, open);
    const tag = markup.slice(open, end);
    const name = tag.match(/^<\s*([a-z][\w:-]*)/i)?.[1]?.toLowerCase();
    if (name === "script" || name === "style") {
      const closeTag = `</${name}>`;
      const close = markup.toLowerCase().indexOf(closeTag, end);
      if (close < 0) { output += tag; index = end; continue; }
      output += compileTagAttributes(tag, palette);
      const content = markup.slice(end, close);
      output += name === "style" ? compileCssDeclarations(content, palette) : content;
      output += markup.slice(close, close + closeTag.length);
      index = close + closeTag.length;
      continue;
    }
    output += compileTagAttributes(tag, palette);
    index = end;
  }
  return output;
}

/**
 * Compiles historical component colors before browser layout. Every chromatic
 * literal maps to one auditable shared role; neutral colors and alpha survive.
 * The browser's computed tree is then the single HTML/SVG/Native color source.
 */
export function compileStructureThemeSource(source, theme = {}) {
  const input = String(source ?? "");
  // Legacy callers keep authored colors until they explicitly choose the new
  // one-primary contract. Product Skin and current generators always do so.
  if (!normalizeHex(theme?.primaryColor)) return input;
  if (input.includes("/* ppagent-theme:resolved */")) return input;
  const palette = resolveStructureTheme(theme);
  return compileCssDeclarations(input, palette);
}

export function compileHtmlComponentTheme({ markup = "", css = "", theme = {} } = {}) {
  return Object.freeze({
    markup: normalizeHex(theme?.primaryColor) ? compileMarkupColors(String(markup ?? ""), resolveStructureTheme(theme)) : String(markup ?? ""),
    css: compileStructureThemeSource(css, theme),
  });
}
