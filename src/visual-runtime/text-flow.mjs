const ALIGNMENTS = new Set(["left", "center", "right"]);
const VERTICAL_ALIGNMENTS = new Set(["top", "middle", "bottom"]);

function text(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function resolveTextFlowContent({ title, body, points = [] } = {}) {
  const resolvedTitle = text(title);
  const resolvedBody = text(body);
  const resolvedPoints = Array.isArray(points)
    ? points.map((point) => text(point?.text ?? point)).filter(Boolean)
    : [];
  const support = [resolvedBody, ...resolvedPoints.map((point) => `• ${point}`)]
    .filter(Boolean)
    .join("\n");
  return {
    title: resolvedTitle,
    body: support,
    composition: resolvedTitle && support
      ? "title-body"
      : resolvedTitle
        ? "title-only"
        : support
          ? "body-only"
          : "empty",
  };
}

function positive(value, fallback) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
}

/**
 * 给导演阶段使用的保守中文容量摘要。它只依赖入库时已求出的内容区几何，
 * 不替代浏览器最终排版；最终交付仍以真实字体度量和 DOM 结果为准。
 */
export function estimateTextFlowPlanningCapacity({
  width,
  height,
  gapPx = 10,
  separatorHeightPx = 0,
  titleMinPt = 17,
  bodyMinPt = 15,
  titleMaxLines = 2,
} = {}) {
  const innerWidth = positive(width, 0);
  const innerHeight = positive(height, 0);
  requireValue(innerWidth > 0 && innerHeight > 0, "TextFlow 容量估算需要有效的内容区宽高");
  const pxPerPt = 4 / 3;
  const titleFontPx = positive(titleMinPt, 17) * pxPerPt;
  const bodyFontPx = positive(bodyMinPt, 15) * pxPerPt;
  const titleLineHeightPx = titleFontPx * 1.2;
  const bodyLineHeightPx = bodyFontPx * 1.45;
  const titleLines = Math.max(1, Math.floor(positive(titleMaxLines, 2)));
  const titleCharsPerLine = Math.max(1, Math.floor(innerWidth / titleFontPx));
  const bodyCharsPerLine = Math.max(1, Math.floor(innerWidth / bodyFontPx));
  const separatorGap = separatorHeightPx > 0 ? positive(gapPx, 10) * 2 + separatorHeightPx : positive(gapPx, 10);
  const bodyOnlyLines = Math.max(1, Math.floor(innerHeight / bodyLineHeightPx));
  const titleBodyHeight = Math.max(0, innerHeight - titleLineHeightPx * titleLines - separatorGap);
  const titleBodyBodyLines = Math.max(1, Math.floor(titleBodyHeight / bodyLineHeightPx));
  return {
    basis: "conservative-cjk-geometry",
    titleOnly: {
      maxChars: titleCharsPerLine * titleLines,
      maxLines: titleLines,
    },
    bodyOnly: {
      maxChars: bodyCharsPerLine * bodyOnlyLines,
      maxLines: bodyOnlyLines,
    },
    titleBody: {
      maxTitleChars: titleCharsPerLine * titleLines,
      maxTitleLines: titleLines,
      maxBodyChars: bodyCharsPerLine * titleBodyBodyLines,
      maxBodyLines: titleBodyBodyLines,
    },
  };
}

/**
 * 声明一个“内容区域”，而不是分别声明标题框和正文框。
 * 标题、正文和分点只是同一容器中的语义内容，由公共 TextFlow 在浏览器中排版。
 */
export function textFlowMarkup({
  id,
  field,
  itemId = "",
  regionId = "main",
  title = "",
  body = "",
  points = [],
  className = "",
  profile = "standard",
  align = "left",
  valign = "middle",
  tone = "light",
  required = true,
  separator = false,
  titleField = "title",
  bodyField = "body",
  names = {},
  exposeSlot = true,
  layoutId = "title-body-adaptive",
} = {}) {
  requireValue(text(id), "TextFlow 需要稳定的容器 id");
  requireValue(text(field), `${id} 缺少内容字段路径`);
  requireValue(text(regionId), `${id} 缺少连续文字区域 regionId`);
  requireValue(ALIGNMENTS.has(align), `${id} 的 TextFlow align 非法：${align}`);
  requireValue(VERTICAL_ALIGNMENTS.has(valign), `${id} 的 TextFlow valign 非法：${valign}`);
  const content = resolveTextFlowContent({ title, body, points });
  if (required) requireValue(content.composition !== "empty", `${id} 至少需要标题或正文内容`);

  const classes = ["ppagent-text-flow", className].filter(Boolean).join(" ");
  const titleName = names.title ?? `${id}-title`;
  const bodyName = names.body ?? `${id}-body`;
  const separatorName = names.separator ?? `${id}-separator`;
  const titleMarkup = content.title
    ? `<div class="ppagent-text-flow__title" data-text-flow-part="title" data-text-flow-field="${escapeHtml(titleField)}" data-ppt-kind="text" data-ppt-name="${escapeHtml(titleName)}">${escapeHtml(content.title)}</div>`
    : "";
  const separatorMarkup = separator && content.composition === "title-body"
    ? `<div class="ppagent-text-flow__separator" data-text-flow-part="separator" data-ppt-kind="shape" data-ppt-shape="roundRect" data-ppt-name="${escapeHtml(separatorName)}"></div>`
    : "";
  const bodyMarkup = content.body
    ? `<div class="ppagent-text-flow__body" data-text-flow-part="body" data-text-flow-field="${escapeHtml(bodyField)}" data-ppt-kind="text" data-ppt-preserve-lines="true" data-ppt-name="${escapeHtml(bodyName)}">${escapeHtml(content.body)}</div>`
    : "";

  const slotAttributes = exposeSlot ? `
    data-ppagent-text-flow
    data-text-flow-profile="${escapeHtml(profile)}"
    data-text-flow-composition="${content.composition}"
    data-text-flow-align="${align}"
    data-text-flow-valign="${valign}"
    data-text-flow-tone="${escapeHtml(tone)}"
    data-text-layout-id="${escapeHtml(layoutId)}"
    data-slot-id="${escapeHtml(id)}"
    data-slot-role="item-content"
    data-slot-field="${escapeHtml(field)}"
    data-slot-item-id="${escapeHtml(itemId)}"
    data-slot-region-id="${escapeHtml(regionId)}"
    data-slot-content-type="text-flow"
    data-slot-required="${required ? "true" : "false"}"
    data-slot-text-mode="flow"
    data-slot-list-policy="inline"` : `
    data-ppagent-text-flow
    data-text-flow-profile="${escapeHtml(profile)}"
    data-text-flow-composition="${content.composition}"
    data-text-flow-align="${align}"
    data-text-flow-valign="${valign}"
    data-text-flow-tone="${escapeHtml(tone)}"
    data-text-layout-id="${escapeHtml(layoutId)}"
    data-text-layout-instance-id="${escapeHtml(id)}"
    data-text-layout-field="${escapeHtml(field)}"`;

  return `<div class="${escapeHtml(classes)}"${slotAttributes}>${titleMarkup}${separatorMarkup}${bodyMarkup}</div>`;
}

/**
 * 声明一个连续矩形的复合文字承载面。它可以包含 TextFlow、指标、标签等
 * 多种内部排版块；外层区域负责向看板和视觉导演披露整体可用范围。
 */
export function textRegionAttributes({ id, field, itemId = "", regionId = "main", required = true } = {}) {
  requireValue(text(id), "TextRegion 需要稳定的区域 id");
  requireValue(text(field), `${id} 缺少区域字段路径`);
  requireValue(text(regionId), `${id} 缺少连续文字区域 regionId`);
  return `data-ppagent-text-region data-slot-id="${escapeHtml(id)}" data-slot-role="text-region" data-slot-field="${escapeHtml(field)}" data-slot-item-id="${escapeHtml(itemId)}" data-slot-region-id="${escapeHtml(regionId)}" data-slot-content-type="text-region" data-slot-safe-box="true" data-slot-required="${required ? "true" : "false"}" data-slot-text-mode="structured" data-slot-list-policy="structured"`;
}

export function htmlTextFlowCss() {
  return `
    .ppagent-text-region{
      box-sizing:border-box;
      min-width:0;
      min-height:0;
    }
    .ppagent-text-region > .ppagent-text-flow,
    .ppagent-text-region > .ppagent-text-layout{
      width:100%;
      height:100%;
    }
    .ppagent-text-layout{
      box-sizing:border-box;
      display:flex;
      flex-direction:column;
      align-items:stretch;
      justify-content:center;
      gap:var(--ppagent-text-layout-gap,10px);
      width:100%;
      height:100%;
      min-width:0;
      min-height:0;
      overflow:hidden;
      font-family:var(--ppagent-font-body,"Microsoft YaHei"),sans-serif;
      text-align:left;
    }
    .ppagent-text-layout[data-text-layout-align="center"]{text-align:center}
    .ppagent-text-layout[data-text-layout-align="right"]{text-align:right}
    .ppagent-text-layout[data-text-layout-valign="top"]{justify-content:flex-start}
    .ppagent-text-layout[data-text-layout-valign="bottom"]{justify-content:flex-end}
    .ppagent-text-layout[data-text-layout-density="compact"]{--ppagent-text-layout-gap:6px;--ppagent-text-layout-item-gap:5px}
    .ppagent-text-layout[data-text-layout-density="standard"]{--ppagent-text-layout-gap:10px;--ppagent-text-layout-item-gap:8px}
    .ppagent-text-layout[data-text-layout-density="loose"]{--ppagent-text-layout-gap:15px;--ppagent-text-layout-item-gap:12px}
    .ppagent-text-primitive{
      box-sizing:border-box;
      flex:0 0 auto;
      min-width:0;
      margin:0;
      padding:0;
      overflow:visible;
      color:var(--ppagent-text-color,#46566a);
      text-align:inherit;
      white-space:pre-line;
      overflow-wrap:break-word;
    }
    .ppagent-text-primitive--heading{color:var(--ppagent-heading-color,#254b7c);font-size:var(--ppagent-component-item-title-size,21pt);font-weight:700;line-height:1.2;text-wrap:balance}
    .ppagent-text-primitive--body{font-size:var(--ppagent-component-body-size,17pt);font-weight:400;line-height:1.45}
    .ppagent-text-primitive--list{display:flex;flex-direction:column;gap:var(--ppagent-text-layout-item-gap,8px)}
    .ppagent-text-list__item{box-sizing:border-box;min-width:0;margin:0;padding:0;overflow:visible;color:var(--ppagent-text-color,#46566a);font-size:var(--ppagent-component-body-size,17pt);font-weight:400;line-height:1.38;text-align:inherit;white-space:pre-line;overflow-wrap:break-word}
    .ppagent-text-primitive--metric{color:var(--ppagent-value-color,#2f5ea8);font-size:var(--ppagent-component-heading-size,25pt);font-weight:700;line-height:1.08}
    .ppagent-text-primitive--label{color:var(--ppagent-label-color,#60758d);font-size:var(--ppagent-component-label-size,17pt);font-weight:600;line-height:1.2}
    .ppagent-text-primitive--annotation{color:var(--ppagent-annotation-color,#748495);font-size:var(--ppagent-component-meta-size,15pt);font-weight:400;line-height:1.3}
    .ppagent-text-primitive--quote{color:var(--ppagent-heading-color,#254b7c);font-size:var(--ppagent-component-item-title-size,21pt);font-weight:500;line-height:1.35}
    .ppagent-text-primitive--emphasis{color:var(--ppagent-heading-color,#254b7c);font-size:var(--ppagent-component-title-size,23pt);font-weight:700;line-height:1.2;text-wrap:balance}
    .ppagent-structured-list{display:flex;flex-direction:column;gap:var(--ppagent-text-layout-item-gap,8px);min-width:0;min-height:0}
    .ppagent-structured-list__item{display:flex;flex-direction:column;gap:4px;min-width:0}
    .ppagent-structured-list__item .ppagent-text-primitive--heading{font-size:var(--ppagent-component-lead-size,19pt)}
    .ppagent-metric-set{display:grid;grid-template-columns:repeat(var(--ppagent-metric-columns,2),minmax(0,1fr));gap:var(--ppagent-text-layout-gap,10px);min-width:0;min-height:0;align-items:start}
    .ppagent-metric-set[data-metric-count="3"]{--ppagent-metric-columns:3}
    .ppagent-metric-set[data-metric-count="4"]{--ppagent-metric-columns:4}
    .ppagent-metric-set__item{display:flex;flex-direction:column;gap:4px;min-width:0;text-align:inherit}
    .ppagent-key-value{display:flex;flex-direction:column;gap:var(--ppagent-text-layout-item-gap,8px);min-width:0;min-height:0}
    .ppagent-key-value__row{display:grid;grid-template-columns:minmax(64px,.42fr) minmax(0,1fr);gap:10px;align-items:start;min-width:0}
    .ppagent-key-value__row .ppagent-text-primitive--metric{font-size:var(--ppagent-component-lead-size,19pt)}
    .ppagent-text-layout--quote-attribution-flow .ppagent-text-primitive--label,
    .ppagent-text-layout--quote-attribution-flow .ppagent-text-primitive--annotation{text-align:right}
    .ppagent-summary-information{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--ppagent-text-layout-gap,10px);min-width:0;min-height:0}
    .ppagent-summary-information__item{display:flex;flex-direction:column;gap:4px;min-width:0;text-align:inherit}
    .ppagent-summary-information__item .ppagent-text-primitive--emphasis{font-size:var(--ppagent-component-lead-size,19pt)}
    .ppagent-text-layout[data-text-layout-style="swiss-international"]{
      justify-content:flex-start;
      gap:12px;
      padding:18px;
      color:var(--ppagent-color-body);
      background:transparent;
      text-align:left;
    }
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-text-primitive{color:var(--ppagent-color-body)}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-text-primitive--heading,
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-text-primitive--emphasis,
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-text-primitive--quote{color:var(--ppagent-color-dark);font-weight:700;letter-spacing:-.25px}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-text-primitive--body,
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-text-list__item{font-size:max(15pt,var(--ppagent-component-body-size))}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-text-primitive--label{color:var(--ppagent-color-accent);font-size:max(15pt,var(--ppagent-component-label-size));font-weight:700;letter-spacing:.7px}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-text-primitive--annotation{color:var(--ppagent-color-muted);font-size:max(15pt,var(--ppagent-component-meta-size))}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-text-primitive--metric{color:var(--ppagent-color-accent);font-weight:700;letter-spacing:-.5px}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-text-list__item{position:relative;padding-left:17px;color:var(--ppagent-color-body)}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-text-list__item::before{content:"";position:absolute;left:0;top:.68em;width:8px;height:2px;background:var(--ppagent-color-accent)}
    .ppagent-text-layout[data-text-layout-style="swiss-international"].ppagent-text-layout--heading-content-flow > .ppagent-text-primitive--heading,
    .ppagent-text-layout[data-text-layout-style="swiss-international"].ppagent-text-layout--label-content-flow > .ppagent-text-primitive--label,
    .ppagent-text-layout[data-text-layout-style="swiss-international"].ppagent-text-layout--heading-metric-content-flow > .ppagent-text-primitive--heading{padding-bottom:10px;border-bottom:2px solid var(--ppagent-color-accent)}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-structured-list{gap:0;border-top:2px solid var(--ppagent-color-dark)}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-structured-list__item{display:grid;grid-template-columns:minmax(82px,.42fr) minmax(0,1fr);gap:14px;padding:9px 0;border-bottom:1px solid var(--ppagent-color-line)}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-structured-list__item .ppagent-text-primitive--body{margin:0}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-metric-set{gap:0;border-top:2px solid var(--ppagent-color-dark)}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-metric-set__item{padding:12px 14px 4px 0}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-metric-set__item + .ppagent-metric-set__item{padding-left:14px;border-left:1px solid var(--ppagent-color-line)}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-key-value{gap:0;border-top:2px solid var(--ppagent-color-dark)}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-key-value__row{padding:9px 0;border-bottom:1px solid var(--ppagent-color-line)}
    .ppagent-text-layout[data-text-layout-style="swiss-international"].ppagent-text-layout--quote-attribution-flow{position:relative;padding-left:52px}
    .ppagent-text-layout[data-text-layout-style="swiss-international"].ppagent-text-layout--quote-attribution-flow::before{content:"“";position:absolute;left:16px;top:8px;color:var(--ppagent-color-accent);font-family:Georgia,serif;font-size:42pt;font-weight:700;line-height:1}
    .ppagent-text-layout[data-text-layout-style="swiss-international"].ppagent-text-layout--quote-attribution-flow .ppagent-text-primitive--label{margin-top:auto;padding-top:10px;border-top:2px solid var(--ppagent-color-dark)}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-summary-information{gap:0;border-top:2px solid var(--ppagent-color-dark)}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-summary-information__item{padding:10px 12px 8px 0;border-bottom:1px solid var(--ppagent-color-line)}
    .ppagent-text-layout[data-text-layout-style="swiss-international"] .ppagent-summary-information__item:nth-child(even){padding-left:12px;border-left:1px solid var(--ppagent-color-line)}
    .ppagent-text-layout--value-label{
      display:flex;
      flex-direction:column;
      align-items:stretch;
      justify-content:center;
      gap:var(--ppagent-value-label-gap,5px);
      padding:var(--ppagent-value-label-padding,5px);
      text-align:center;
    }
    .ppagent-text-layout__value,
    .ppagent-text-layout__label{
      box-sizing:border-box;
      width:100%;
      min-width:0;
      margin:0;
      padding:0;
      overflow:hidden;
      text-align:inherit;
    }
    .ppagent-text-layout__value{
      color:var(--ppagent-value-color,#2f5ea8);
      font-size:var(--ppagent-component-lead-size,19pt);
      font-weight:700;
      line-height:1.15;
    }
    .ppagent-text-layout__label{
      color:var(--ppagent-label-color,#60758d);
      font-size:var(--ppagent-component-meta-size,15pt);
      font-weight:400;
      line-height:1.2;
    }
    .ppagent-text-flow{
      box-sizing:border-box;
      display:flex;
      flex-direction:column;
      align-items:stretch;
      justify-content:center;
      gap:var(--ppagent-text-flow-gap,10px);
      min-width:0;
      min-height:0;
      overflow:hidden;
      font-family:var(--ppagent-font-body,"Microsoft YaHei"),sans-serif;
      text-align:left;
    }
    .ppagent-text-flow[data-text-flow-align="center"]{text-align:center}
    .ppagent-text-flow[data-text-flow-align="right"]{text-align:right}
    .ppagent-text-flow[data-text-flow-valign="top"]{justify-content:flex-start}
    .ppagent-text-flow[data-text-flow-valign="bottom"]{justify-content:flex-end}
    .ppagent-text-flow__title,
    .ppagent-text-flow__body{
      position:relative;
      box-sizing:border-box;
      flex:0 0 auto;
      width:100%;
      min-width:0;
      margin:0;
      padding:0;
      overflow:visible;
      text-align:inherit;
    }
    .ppagent-text-flow__title{
      font-size:var(--ppagent-component-item-title-size,21pt);
      font-weight:700;
      line-height:1.2;
      white-space:normal;
      text-wrap:balance;
    }
    .ppagent-text-flow__body{
      font-size:var(--ppagent-component-body-size,17pt);
      font-weight:400;
      line-height:1.45;
      white-space:pre-line;
    }
    .ppagent-text-flow__separator{
      box-sizing:border-box;
      flex:0 0 auto;
      align-self:center;
      width:var(--ppagent-text-flow-separator-width,54px);
      height:var(--ppagent-text-flow-separator-height,4px);
      border:0;
      border-radius:99px;
      background:var(--ppagent-text-flow-separator-color,#78aeef);
    }
  `;
}
