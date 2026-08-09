import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_THEME = {
  background: "#F7FAFC",
  cardFill: "#FFFFFF",
  cardLine: "#C9D5E3",
  accent: "#1677C8",
  accentAlt: "#00A8D8",
  title: "#0F172A",
  body: "#475569",
  muted: "#7C8A9A",
  fontFamily: "Microsoft YaHei",
};

const SAMPLE_ITEMS = [
  { title: "章节标题", subtitle: "Section title", body: "用一句话说明本章节内容" },
  { title: "章节标题", subtitle: "Section title", body: "用一句话说明本章节内容" },
  { title: "章节标题", subtitle: "Section title", body: "用一句话说明本章节内容" },
  { title: "章节标题", subtitle: "Section title", body: "用一句话说明本章节内容" },
  { title: "章节标题", subtitle: "Section title", body: "用一句话说明本章节内容" },
  { title: "章节标题", subtitle: "Section title", body: "用一句话说明本章节内容" },
  { title: "章节标题", subtitle: "Section title", body: "用一句话说明本章节内容" },
  { title: "章节标题", subtitle: "Section title", body: "用一句话说明本章节内容" },
];

function addText(slide, text, position, style = {}) {
  const box = slide.shapes.add({
    geometry: "textbox",
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  box.text = String(text ?? "");
  box.text.style = {
    fontSize: style.fontSize ?? 16,
    typeface: style.typeface ?? "Microsoft YaHei",
    color: style.color ?? "#0F172A",
    bold: style.bold ?? false,
    alignment: style.alignment ?? "left",
    verticalAlignment: style.verticalAlignment ?? "middle",
    autoFit: style.autoFit ?? "shrinkText",
    insets: style.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return box;
}

function addCard(slide, item, index, frame, active, theme) {
  slide.shapes.add({
    geometry: "roundRect",
    name: `catalog-card-${index + 1}`,
    position: frame,
    fill: active ? theme.accent : theme.cardFill,
    line: {
      style: "solid",
      fill: active ? theme.accent : theme.cardLine,
      width: 1.2,
    },
    borderRadius: "rounded-xl",
    shadow: active ? "shadow-md" : "shadow-sm",
  });

  const x = frame.left + 22;
  const numberColor = active ? "#FFFFFF" : theme.title;
  const bodyColor = active ? "#FFFFFF" : theme.body;
  const mutedColor = active ? "#DCEEFF" : theme.muted;
  addText(slide, String(index + 1).padStart(2, "0"), {
    left: x,
    top: frame.top + 16,
    width: frame.width - 44,
    height: 34,
  }, { fontSize: 24, color: numberColor });

  const pillWidth = Math.min(frame.width - 44, Math.max(126, 32 + String(item.title).length * 17));
  const pill = slide.shapes.add({
    geometry: "roundRect",
    name: `catalog-pill-${index + 1}`,
    position: {
      left: x,
      top: frame.top + 66,
      width: pillWidth,
      height: 38,
    },
    fill: active ? "#FFFFFF" : (index % 2 === 0 ? theme.accent : theme.accentAlt),
    line: { style: "solid", fill: "none", width: 0 },
    borderRadius: "rounded-full",
  });
  pill.text = item.title;
  pill.text.style = {
    fontSize: 16,
    typeface: theme.fontFamily,
    color: active ? theme.accent : "#FFFFFF",
    bold: true,
    alignment: "center",
    verticalAlignment: "middle",
    autoFit: "shrinkText",
    insets: { top: 2, right: 12, bottom: 2, left: 12 },
  };

  addText(slide, item.subtitle, {
    left: x,
    top: frame.top + 116,
    width: frame.width - 44,
    height: 24,
  }, { fontSize: 12, color: mutedColor });
  addText(slide, item.body, {
    left: x,
    top: frame.top + 151,
    width: frame.width - 44,
    height: Math.max(42, frame.height - 168),
  }, { fontSize: 14, color: bodyColor, verticalAlignment: "top" });
}

function addTitle(slide, frame, theme, compact = false) {
  addText(slide, "CONTENT", {
    left: frame.left,
    top: frame.top,
    width: compact ? frame.width : 260,
    height: 34,
  }, { fontSize: 22, color: theme.title, bold: true });
  addText(slide, "目录", {
    left: frame.left,
    top: frame.top + 35,
    width: compact ? frame.width : 260,
    height: 66,
  }, { fontSize: 42, color: theme.accent, bold: true, verticalAlignment: "top" });
}

function getLayout(itemCount) {
  if ([3, 4].includes(itemCount)) {
    const left = 94;
    const right = 94;
    const gap = itemCount === 3 ? 70 : 12;
    const width = (1280 - left - right - gap * (itemCount - 1)) / itemCount;
    return {
      title: { left: 94, top: 68, width: 1092, height: 102 },
      cards: Array.from({ length: itemCount }, (_, index) => ({
        left: left + index * (width + gap),
        top: 286,
        width,
        height: 354,
      })),
      titleCompact: true,
    };
  }

  if ([5, 6].includes(itemCount)) {
    const leftRail = 94;
    const gridLeft = 374;
    const gapX = 14;
    const gapY = 18;
    const cardWidth = (816 - gapX * 2) / 3;
    const cardHeight = 240;
    return {
      title: { left: leftRail, top: 135, width: 240, height: 120 },
      cards: Array.from({ length: itemCount }, (_, index) => ({
        left: gridLeft + (index % 3) * (cardWidth + gapX),
        top: 138 + Math.floor(index / 3) * (cardHeight + gapY),
        width: cardWidth,
        height: cardHeight,
      })),
      titleCompact: false,
    };
  }

  if (itemCount === 8) {
    const left = 94;
    const gapX = 12;
    const gapY = 18;
    const cardWidth = (1092 - gapX * 3) / 4;
    const cardHeight = 240;
    return {
      title: { left, top: 54, width: 1092, height: 90 },
      cards: Array.from({ length: itemCount }, (_, index) => ({
        left: left + (index % 4) * (cardWidth + gapX),
        top: 162 + Math.floor(index / 4) * (cardHeight + gapY),
        width: cardWidth,
        height: cardHeight,
      })),
      titleCompact: true,
    };
  }

  throw new Error("当前候选仅验证 3、4、5、6、8 项目录；7 项尚未由源样本验证。");
}

export function buildCatalogSlide(presentation, parameters = {}) {
  const items = (parameters.items ?? SAMPLE_ITEMS).map((item) => ({ ...item }));
  const itemCount = parameters.itemCount ?? items.length;
  if (items.length < itemCount) throw new Error(`items 只有 ${items.length} 项，少于 itemCount=${itemCount}`);
  const theme = { ...DEFAULT_THEME, ...(parameters.theme ?? {}) };
  const layout = getLayout(itemCount);
  const activeIndex = parameters.activeIndex ?? null;

  const slide = presentation.slides.add();
  slide.background.fill = theme.background;
  addTitle(slide, layout.title, theme, layout.titleCompact);
  layout.cards.forEach((frame, index) => {
    addCard(slide, items[index], index, frame, activeIndex === index, theme);
  });
  return slide;
}

async function loadConfiguration(configPath) {
  if (!configPath) return null;
  return JSON.parse(await fs.readFile(path.resolve(configPath), "utf8"));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const values = { output: path.join(moduleDir, "example.pptx"), config: null };
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith("--") || value === undefined) throw new Error(`参数格式错误：${name || "<empty>"}`);
    const key = name.slice(2);
    if (!(key in values)) throw new Error(`不支持的参数：--${key}`);
    values[key] = value;
  }
  return values;
}

async function main() {
  const args = parseArgs();
  const config = await loadConfiguration(args.config);
  const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  if (config) {
    const slides = Array.isArray(config.slides) ? config.slides : [config];
    for (const slideConfig of slides) buildCatalogSlide(presentation, slideConfig);
  } else {
    buildCatalogSlide(presentation, { itemCount: 6, activeIndex: 3, items: SAMPLE_ITEMS });
  }
  await fs.mkdir(path.dirname(path.resolve(args.output)), { recursive: true });
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(path.resolve(args.output));
  console.log(path.resolve(args.output));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}
