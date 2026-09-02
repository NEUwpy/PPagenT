import MarkdownIt from "markdown-it";

import { textRegionAttributes } from "./text-flow.mjs";

const ALIGNMENTS = new Set(["left", "center", "right"]);
const VERTICAL_ALIGNMENTS = new Set(["top", "middle", "bottom"]);
const DENSITIES = new Set(["compact", "standard", "loose"]);
const MODES = new Set(["flow", "zoned"]);
const ZONE_TEMPLATES = new Set(["lead-body"]);

const parser = new MarkdownIt({
  html: true,
  linkify: false,
  typographer: false,
  breaks: false,
});

const UNSUPPORTED_TOKENS = Object.freeze({
  table_open: "表格",
  fence: "代码块",
  code_block: "代码块",
  code_inline: "行内代码",
  image: "图片",
  link_open: "链接",
  html_block: "原始 HTML",
  html_inline: "原始 HTML",
  s_open: "删除线",
});

function text(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function validateSupportedTokens(tokens) {
  for (const token of tokens) {
    if (UNSUPPORTED_TOKENS[token.type]) {
      throw new Error(`受控 Markdown 暂不支持${UNSUPPORTED_TOKENS[token.type]}`);
    }
    if (token.type === "heading_open" && Number(token.tag.slice(1)) > 3) {
      throw new Error("受控 Markdown 标题最多三级");
    }
    validateSupportedTokens(token.children ?? []);
  }
}

function inlineMarkup(inlineToken) {
  return (inlineToken?.children ?? []).map((token) => {
    if (token.type === "text") return escapeHtml(token.content);
    if (token.type === "softbreak" || token.type === "hardbreak") return "<br>";
    if (token.type === "strong_open") return "<strong>";
    if (token.type === "strong_close") return "</strong>";
    if (token.type === "em_open") return "<em>";
    if (token.type === "em_close") return "</em>";
    return token.content ? escapeHtml(token.content) : "";
  }).join("") || escapeHtml(inlineToken?.content ?? "");
}

function plainInlineText(inlineToken) {
  return text((inlineToken?.children ?? []).map((token) => (
    token.type === "softbreak" || token.type === "hardbreak" ? "\n" : token.content
  )).join("") || inlineToken?.content);
}

function pushTextBlock(blocks, type, inlineToken, extra = {}) {
  const value = plainInlineText(inlineToken);
  if (!value) return;
  blocks.push({ type, text: value, html: inlineMarkup(inlineToken), ...extra });
}

/**
 * Parse a deliberately small CommonMark subset into PPagenT text blocks.
 * Markdown-it owns syntax recognition; this function only projects its token
 * stream into the block types that the HTML/Native runtime can audit.
 */
export function parseControlledMarkdown(markdown) {
  const source = text(markdown);
  requireValue(source, "Markdown TextRegion 不能为空");
  const tokens = parser.parse(source, {});
  validateSupportedTokens(tokens);
  const blocks = [];
  const lists = [];
  let headingLevel = null;
  let quote = null;

  for (const token of tokens) {
    if (token.type === "heading_open") {
      headingLevel = Math.min(3, Math.max(1, Number(token.tag.slice(1)) || 2));
      continue;
    }
    if (token.type === "heading_close") {
      headingLevel = null;
      continue;
    }
    if (token.type === "blockquote_open") {
      requireValue(!quote, "Markdown 引语暂不支持嵌套");
      quote = [];
      continue;
    }
    if (token.type === "blockquote_close") {
      if (quote?.length) {
        const quoteText = quote.map((item) => item.text).join("\n");
        const quoteHtml = quote.map((item) => item.html).join("<br>");
        blocks.push({
          type: "quote",
          text: `“${quoteText}”`,
          html: `“${quoteHtml}”`,
        });
      }
      quote = null;
      continue;
    }
    if (token.type === "bullet_list_open" || token.type === "ordered_list_open") {
      requireValue(lists.length === 0, "Markdown 列表第一阶段最多一层");
      lists.push({ ordered: token.type === "ordered_list_open", items: [], current: null });
      continue;
    }
    if (token.type === "list_item_open") {
      const list = lists.at(-1);
      if (list) list.current = [];
      continue;
    }
    if (token.type === "list_item_close") {
      const list = lists.at(-1);
      if (list?.current?.length) {
        list.items.push({
          text: list.current.map((item) => item.text).join(" "),
          html: list.current.map((item) => item.html).join(" "),
        });
      }
      if (list) list.current = null;
      continue;
    }
    if (token.type === "bullet_list_close" || token.type === "ordered_list_close") {
      const list = lists.pop();
      if (list?.items.length) blocks.push({ type: list.ordered ? "ordered-list" : "unordered-list", items: list.items });
      continue;
    }
    if (token.type === "thematic_break") {
      blocks.push({ type: "divider", text: "", html: "" });
      continue;
    }
    if (token.type !== "inline") continue;
    const inline = { text: plainInlineText(token), html: inlineMarkup(token) };
    if (lists.length) {
      const list = lists.at(-1);
      if (inline.text) list.current?.push(inline);
    } else if (quote) {
      if (inline.text) quote.push(inline);
    } else if (headingLevel) {
      pushTextBlock(blocks, "heading", token, { level: headingLevel });
    } else {
      pushTextBlock(blocks, "paragraph", token);
    }
  }

  requireValue(blocks.some((block) => block.type !== "divider"), "Markdown 没有可见文字内容");
  return blocks;
}

function blockRole(block) {
  if (block.type === "heading") return "heading";
  if (block.type === "paragraph") return "body";
  if (block.type === "quote") return "quote";
  if (block.type.endsWith("list")) return "list";
  return block.type;
}

function textBlockMarkup({ block, id, field, index }) {
  if (block.type === "divider") {
    return `<div class="ppagent-markdown-divider" data-markdown-block="divider" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="${escapeHtml(`${id}-divider-${index}`)}"></div>`;
  }
  if (block.type === "unordered-list" || block.type === "ordered-list") {
    return `<div class="ppagent-markdown-list ppagent-markdown-list--${block.type}" data-markdown-block="${block.type}">${block.items.map((item, itemIndex) => {
      const prefix = block.type === "ordered-list" ? `${itemIndex + 1}.` : "•";
      return `<div class="ppagent-markdown-block ppagent-markdown-block--list-item" data-text-primitive="list" data-text-layout-part="list-item" data-text-layout-field="${escapeHtml(`${field}.blocks[${index}].items[${itemIndex}]`)}" data-markdown-block="list-item" data-ppt-kind="text" data-ppt-preserve-lines="true" data-ppt-name="${escapeHtml(`${id}-list-${index}-${itemIndex}`)}"><span class="ppagent-markdown-list-marker">${prefix}</span> ${item.html}</div>`;
    }).join("")}</div>`;
  }
  const role = blockRole(block);
  const level = block.type === "heading" ? ` data-markdown-heading-level="${block.level}"` : "";
  return `<div class="ppagent-markdown-block ppagent-markdown-block--${block.type}" data-text-primitive="${role}" data-text-layout-part="${role}" data-text-layout-field="${escapeHtml(`${field}.blocks[${index}]`)}" data-markdown-block="${block.type}"${level} data-ppt-kind="text" data-ppt-preserve-lines="true" data-ppt-name="${escapeHtml(`${id}-${block.type}-${index}`)}">${block.html}</div>`;
}

function flowMarkup(blocks, id, field) {
  return blocks.map((block, index) => textBlockMarkup({ block, id, field, index })).join("");
}

function zonedMarkup(blocks, id, field) {
  const firstHeadingIndex = blocks.findIndex((block) => block.type === "heading");
  const leadIndex = firstHeadingIndex >= 0 ? firstHeadingIndex : 0;
  const lead = blocks[leadIndex];
  const body = blocks.filter((_, index) => index !== leadIndex);
  return `<div class="ppagent-markdown-zone ppagent-markdown-zone--lead" data-markdown-zone="lead">${textBlockMarkup({ block: lead, id, field, index: leadIndex })}</div>
    <div class="ppagent-markdown-zone-rule" data-ppt-kind="shape" data-ppt-shape="rect" data-ppt-name="${escapeHtml(`${id}-zone-rule`)}"></div>
    <div class="ppagent-markdown-zone ppagent-markdown-zone--body" data-markdown-zone="body">${flowMarkup(body, id, field)}</div>`;
}

export function markdownTextRegionMarkup({
  id,
  field,
  itemId = "",
  regionId = "main",
  markdown,
  mode = "flow",
  zoneTemplate = "lead-body",
  className = "",
  align = "left",
  valign = "top",
  density = "standard",
  tone = "light",
  required = true,
} = {}) {
  requireValue(text(id), "Markdown TextRegion 需要稳定 id");
  requireValue(text(field), `${id} 缺少 Markdown 字段路径`);
  requireValue(MODES.has(mode), `${id} 的 Markdown 渲染模式非法：${mode}`);
  if (mode === "zoned") requireValue(ZONE_TEMPLATES.has(zoneTemplate), `${id} 的 Markdown 区域模板非法：${zoneTemplate}`);
  requireValue(ALIGNMENTS.has(align), `${id} 的 Markdown align 非法：${align}`);
  requireValue(VERTICAL_ALIGNMENTS.has(valign), `${id} 的 Markdown valign 非法：${valign}`);
  requireValue(DENSITIES.has(density), `${id} 的 Markdown density 非法：${density}`);
  const blocks = parseControlledMarkdown(markdown);
  const layoutId = mode === "zoned" ? "markdown-zoned" : "markdown-flow";
  const roles = [...new Set(blocks.map(blockRole).filter((role) => role !== "divider"))];
  const classes = ["ppagent-text-region", "ppagent-markdown-region", className].filter(Boolean).join(" ");
  const inner = mode === "zoned" ? zonedMarkup(blocks, id, field) : flowMarkup(blocks, id, field);
  return `<div class="${escapeHtml(classes)}" ${textRegionAttributes({ id, field, itemId, regionId, required })} data-text-layout-id="${layoutId}" data-text-layout-default-id="${layoutId}" data-text-layout-compatible="${layoutId}" data-text-layout-content-roles="${escapeHtml(roles.join(","))}">
    <div class="ppagent-text-layout ppagent-markdown-layout ppagent-markdown-layout--${mode}" data-ppagent-text-layout data-text-layout-id="${layoutId}" data-text-layout-align="${align}" data-text-layout-valign="${valign}" data-text-layout-density="${density}" data-text-layout-tone="${escapeHtml(tone)}" data-text-layout-style="markdown-skin" data-markdown-renderer="controlled-commonmark" data-markdown-mode="${mode}"${mode === "zoned" ? ` data-markdown-zone-template="${zoneTemplate}"` : ""}>${inner}</div>
  </div>`;
}

export function inferMarkdownRoles(markdown) {
  return [...new Set(parseControlledMarkdown(markdown).map(blockRole).filter((role) => role !== "divider"))];
}

export function listMarkdownBlockTypes() {
  return structuredClone([
    { id: "heading", name: "标题", syntax: "# / ## / ###", defaultFontSizePt: 23 },
    { id: "paragraph", name: "正文段落", syntax: "普通段落", defaultFontSizePt: 17 },
    { id: "unordered-list", name: "无序列表", syntax: "- 项目", defaultFontSizePt: 17 },
    { id: "ordered-list", name: "有序列表", syntax: "1. 项目", defaultFontSizePt: 17 },
    { id: "quote", name: "引语／结论", syntax: "> 内容", defaultFontSizePt: 19 },
    { id: "emphasis", name: "行内强调", syntax: "**重点** / *弱强调*", defaultFontSizePt: 17 },
    { id: "divider", name: "分隔线", syntax: "---", defaultFontSizePt: 15 },
  ]);
}

export function markdownTextCss() {
  return `
    .ppagent-markdown-layout{
      --ppagent-markdown-gap:12px;
      box-sizing:border-box;
      width:100%;
      height:100%;
      min-width:0;
      min-height:0;
      overflow:hidden;
      padding:18px;
      font-family:var(--ppagent-font-body,"Microsoft YaHei"),sans-serif;
      color:var(--ppagent-color-body,#404040);
      text-align:left;
    }
    .ppagent-markdown-layout[data-text-layout-density="compact"]{--ppagent-markdown-gap:7px;padding:14px}
    .ppagent-markdown-layout[data-text-layout-density="loose"]{--ppagent-markdown-gap:17px;padding:22px}
    .ppagent-markdown-layout[data-text-layout-align="center"]{text-align:center}
    .ppagent-markdown-layout[data-text-layout-align="right"]{text-align:right}
    .ppagent-markdown-layout--flow{display:flex;flex-direction:column;gap:var(--ppagent-markdown-gap);justify-content:flex-start}
    .ppagent-markdown-layout--flow[data-text-layout-valign="middle"]{justify-content:center}
    .ppagent-markdown-layout--flow[data-text-layout-valign="bottom"]{justify-content:flex-end}
    .ppagent-markdown-layout--zoned{display:grid;grid-template-columns:minmax(0,.38fr) 3px minmax(0,.62fr);gap:18px;align-items:stretch}
    .ppagent-markdown-zone{display:flex;flex-direction:column;justify-content:flex-start;gap:var(--ppagent-markdown-gap);min-width:0;min-height:0}
    .ppagent-markdown-zone--lead{justify-content:center}
    .ppagent-markdown-zone-rule{width:3px;height:100%;background:var(--ppagent-color-accent,#2F5EA8)}
    .ppagent-markdown-block{box-sizing:border-box;min-width:0;margin:0;padding:0;overflow:visible;color:var(--ppagent-color-body,#404040);font-size:max(15pt,var(--ppagent-component-body-size));font-weight:400;line-height:1.45;text-align:inherit;white-space:pre-line;overflow-wrap:break-word}
    .ppagent-markdown-block strong{font-weight:700;color:var(--ppagent-color-dark,#2B2B2B)}
    .ppagent-markdown-block em{font-style:italic}
    .ppagent-markdown-block--heading{color:var(--ppagent-color-dark,#2B2B2B);font-size:max(21pt,var(--ppagent-component-title-size));font-weight:700;line-height:1.18;letter-spacing:-.25px;text-wrap:balance}
    .ppagent-markdown-block--heading[data-markdown-heading-level="1"]{font-size:max(23pt,var(--ppagent-component-heading-size))}
    .ppagent-markdown-block--heading[data-markdown-heading-level="3"]{font-size:max(19pt,var(--ppagent-component-lead-size))}
    .ppagent-markdown-block--quote{color:var(--ppagent-color-dark,#2B2B2B);font-size:max(19pt,var(--ppagent-component-lead-size));font-weight:600;line-height:1.35}
    .ppagent-markdown-list{display:flex;flex-direction:column;gap:calc(var(--ppagent-markdown-gap) * .65);min-width:0}
    .ppagent-markdown-block--list-item{display:block;padding-left:19px;text-indent:-19px;font-size:max(15pt,var(--ppagent-component-body-size));line-height:1.38}
    .ppagent-markdown-list-marker{color:var(--ppagent-color-accent,#2F5EA8);font-weight:700}
    .ppagent-markdown-divider{box-sizing:border-box;width:54px;height:3px;min-height:3px;background:var(--ppagent-color-accent,#2F5EA8)}
    .ppagent-markdown-layout--zoned .ppagent-markdown-zone--lead .ppagent-markdown-block--heading{font-size:max(23pt,var(--ppagent-component-heading-size));color:var(--ppagent-color-accent,#2F5EA8)}
  `;
}
