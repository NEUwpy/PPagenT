function cssString(value, fallback) {
  return `"${String(value ?? fallback).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function cssColor(value, fallback) {
  const candidate = String(value ?? fallback).trim();
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback;
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
    --ppagent-color-background:${cssColor(theme.background, "#FFFFFF")};
    --ppagent-color-surface:${cssColor(theme.surface, "#FFFFFF")};
    --ppagent-color-accent:${cssColor(theme.accent, "#2F5EA8")};
    --ppagent-color-accent-alt:${cssColor(theme.accentAlt, "#4C88E8")};
    --ppagent-color-accent-soft:${cssColor(theme.accentSoft, "#DCE9FA")};
    --ppagent-color-dark:${cssColor(theme.dark, "#2B2B2B")};
    --ppagent-color-body:${cssColor(theme.body, "#404040")};
    --ppagent-color-muted:${cssColor(theme.muted, "#6F7D91")};
    --ppagent-color-line:${cssColor(theme.line, "#AFC6E8")};
    --ppagent-component-heading-size:${Number(typography.componentHeading)}pt;
    --ppagent-component-title-size:${Number(typography.componentTitle)}pt;
    --ppagent-component-item-title-size:${Number(typography.componentItemTitle)}pt;
    --ppagent-component-lead-size:${Number(typography.componentLead)}pt;
    --ppagent-component-body-size:${Number(typography.componentBody)}pt;
    --ppagent-component-label-size:${Number(typography.componentLabel)}pt;
    --ppagent-component-meta-size:${Number(typography.componentMeta)}pt;
  }`;
}
