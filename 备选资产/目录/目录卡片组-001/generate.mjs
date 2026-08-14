import {
  addBox,
  addText,
  createPresentation,
  qaElementName,
  runGenerator,
} from "../../../src/asset-runtime/component-builders.mjs";
import {
  CATALOG_COMPONENT_FRAME,
  resolveCatalogLayout,
  toSlideFrame,
} from "./layout-contract.mjs";

export const CATALOG_THEME = Object.freeze({
  cardFill: "#F8FBFE",
  cardLine: "#C9D9E8",
  active: "#1486E3",
  activeDeep: "#0F6FC6",
  pill: "#08A8D8",
  title: "#0F5DA5",
  body: "#5F7389",
  muted: "#74859A",
  fontFamily: "Microsoft YaHei",
});

export const SAMPLE_CATALOG_ITEMS = Object.freeze([
  { title: "困境与转型", body: "理解现状、约束与转向动因" },
  { title: "核心框架", body: "明确整套方案的组织方式" },
  { title: "实践路径", body: "说明方案如何逐步落地" },
  { title: "关键机制", body: "解释稳定运行所需条件" },
  { title: "阶段成效", body: "呈现已经形成的核心结果" },
  { title: "风险边界", body: "交代适用范围与限制" },
  { title: "下一步行动", body: "给出后续推进与验证重点" },
]);

function visibleText(value) {
  return String(value ?? "").trim();
}

export function validateCatalogItems(items) {
  if (!Array.isArray(items) || items.length < 3 || items.length > 7) {
    throw new Error("目录标签卡片需要 3–7 个目录项");
  }
  return items.map((item, index) => {
    const title = visibleText(item?.title ?? item);
    const body = visibleText(item?.body);
    if (!title) throw new Error(`items[${index}].title 不能为空`);
    if ([...title].length > 10) throw new Error(`items[${index}].title 不得超过 10 个汉字`);
    if ([...body].length > 28) throw new Error(`items[${index}].body 不得超过 28 个汉字`);
    return { title, body };
  });
}

function renderCard(slide, item, index, frame, active) {
  const cardId = `agenda-card-${index}`;
  const compact = frame.height < 300;
  const palette = active
    ? { fill: CATALOG_THEME.active, line: CATALOG_THEME.active, title: "#FFFFFF", body: "#EAF5FF" }
    : { fill: CATALOG_THEME.cardFill, line: CATALOG_THEME.cardLine, title: CATALOG_THEME.title, body: CATALOG_THEME.body };
  const slideFrame = toSlideFrame(frame);

  addBox(slide, slideFrame, {
    name: qaElementName({ parent: cardId, domains: ["agenda-card", "agenda-content"] }),
    fill: palette.fill,
    line: { style: active ? "solid" : "dashed", fill: palette.line, width: active ? 1.4 : 1.1 },
    shadow: active ? "shadow-md" : "shadow-none",
    borderRadius: "rounded-xl",
  });

  addText(slide, String(index + 1).padStart(2, "0"), {
    left: slideFrame.left + 18,
    top: slideFrame.top + 14,
    width: slideFrame.width - 36,
    height: compact ? 25 : 32,
  }, {
    name: qaElementName({ within: cardId, role: "number" }),
    fontSize: compact ? 17 : 20,
    bold: true,
    color: active ? "#FFFFFF" : CATALOG_THEME.muted,
    typeface: CATALOG_THEME.fontFamily,
  });

  const pillTop = slideFrame.top + (compact ? 50 : 62);
  const pillHeight = compact ? 36 : 40;
  const pillWidth = Math.min(slideFrame.width - 36, Math.max(126, 34 + [...item.title].length * 18));
  addBox(slide, {
    left: slideFrame.left + 18,
    top: pillTop,
    width: pillWidth,
    height: pillHeight,
  }, {
    name: qaElementName({ within: cardId, role: "label" }),
    fill: active ? "#FFFFFF" : (index % 2 === 0 ? CATALOG_THEME.active : CATALOG_THEME.pill),
    line: { style: "solid", fill: "none", width: 0 },
    shadow: active ? "shadow-sm" : "shadow-none",
    borderRadius: "rounded-full",
    text: item.title,
    fontSize: compact ? 17 : 18,
    bold: true,
    color: active ? CATALOG_THEME.activeDeep : "#FFFFFF",
    autoFit: "none",
    insets: { top: 0, right: 10, bottom: 0, left: 10 },
  });

  if (item.body) {
    addText(slide, item.body, {
      left: slideFrame.left + 18,
      top: pillTop + pillHeight + (compact ? 16 : 24),
      width: slideFrame.width - 36,
      height: slideFrame.height - (pillTop - slideFrame.top) - pillHeight - (compact ? 28 : 44),
    }, {
      name: qaElementName({ within: cardId, role: "body" }),
      fontSize: compact ? 16 : 18,
      color: palette.body,
      typeface: CATALOG_THEME.fontFamily,
      verticalAlignment: "top",
      autoFit: "none",
    });
  }
}

export function renderCatalogAgendaOnSlide(slide, parameters = {}) {
  const items = validateCatalogItems(parameters.items ?? SAMPLE_CATALOG_ITEMS.slice(0, 5));
  const activeIndex = parameters.activeIndex ?? null;
  if (activeIndex !== null && (!Number.isInteger(activeIndex) || activeIndex < 0 || activeIndex >= items.length)) {
    throw new Error("activeIndex 必须是目录项下标或 null");
  }
  const layout = resolveCatalogLayout(items.length);
  layout.frames.forEach((frame, index) => renderCard(slide, items[index], index, frame, activeIndex === index));
  return { frame: CATALOG_COMPONENT_FRAME, layout, items };
}

export function buildCatalogAgenda(presentation, parameters = {}) {
  const slide = presentation.slides.add();
  slide.background.fill = "#FFFFFF";
  renderCatalogAgendaOnSlide(slide, parameters);
  return slide;
}

export function createCatalogAgendaPresentation(configs) {
  const presentation = createPresentation();
  for (const config of configs) buildCatalogAgenda(presentation, config);
  return presentation;
}

await runGenerator(import.meta.url, buildCatalogAgenda, {
  items: SAMPLE_CATALOG_ITEMS.slice(0, 5),
  activeIndex: null,
});
