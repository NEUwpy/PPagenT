function cssString(value, fallback) {
  return `"${String(value ?? fallback).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export const defaultComponentTypography = Object.freeze({
  componentHeading: 29,
  componentTitle: 26,
  componentItemTitle: 21,
  componentBody: 19,
  componentLabel: 18,
  componentMeta: 17,
});

export function resolveComponentTypography(theme = {}) {
  return Object.freeze({
    ...defaultComponentTypography,
    ...(theme.typography ?? {}),
  });
}

export function htmlComponentThemeCss(theme = {}) {
  const typography = resolveComponentTypography(theme);
  return `:root{
    --ppagent-font-body:${cssString(theme.font, "Microsoft YaHei")};
    --ppagent-component-heading-size:${Number(typography.componentHeading)}pt;
    --ppagent-component-title-size:${Number(typography.componentTitle)}pt;
    --ppagent-component-item-title-size:${Number(typography.componentItemTitle)}pt;
    --ppagent-component-body-size:${Number(typography.componentBody)}pt;
    --ppagent-component-label-size:${Number(typography.componentLabel)}pt;
    --ppagent-component-meta-size:${Number(typography.componentMeta)}pt;
  }`;
}
