function cssString(value, fallback) {
  return `"${String(value ?? fallback).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
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
  const typography = resolveComponentTypography(theme);
  return `:root{
    --ppagent-font-body:${cssString(theme.font, "Microsoft YaHei")};
    --ppagent-component-heading-size:${Number(typography.componentHeading)}pt;
    --ppagent-component-title-size:${Number(typography.componentTitle)}pt;
    --ppagent-component-item-title-size:${Number(typography.componentItemTitle)}pt;
    --ppagent-component-lead-size:${Number(typography.componentLead)}pt;
    --ppagent-component-body-size:${Number(typography.componentBody)}pt;
    --ppagent-component-label-size:${Number(typography.componentLabel)}pt;
    --ppagent-component-meta-size:${Number(typography.componentMeta)}pt;
  }`;
}
