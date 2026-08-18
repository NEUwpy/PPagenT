function cssString(value, fallback) {
  return `"${String(value ?? fallback).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function htmlComponentThemeCss(theme = {}) {
  const typography = theme.typography ?? {};
  return `:root{
    --ppagent-font-body:${cssString(theme.font, "Microsoft YaHei")};
    --ppagent-component-heading-size:${Number(typography.componentHeading ?? 29)}px;
    --ppagent-component-title-size:${Number(typography.componentTitle ?? 26)}px;
    --ppagent-component-item-title-size:${Number(typography.componentItemTitle ?? 21)}px;
    --ppagent-component-body-size:${Number(typography.componentBody ?? 19)}px;
    --ppagent-component-label-size:${Number(typography.componentLabel ?? 18)}px;
    --ppagent-component-meta-size:${Number(typography.componentMeta ?? 17)}px;
  }`;
}
