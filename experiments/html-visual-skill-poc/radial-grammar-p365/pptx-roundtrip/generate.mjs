import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, Presentation, PresentationFile } from "@oai/artifact-tool";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INPUT_PATH = path.join(HERE, "input.json");
const OUTPUT_DIR = path.join(HERE, "output");

const COLORS = {
  ink: "#083b83",
  muted: "#5e789b",
  accent: "#1a75bb",
  pale: "#d9eaf8",
  dot: "#c8def1",
  line: "#8db9dc",
  white: "#ffffff"
};

function resolveAsset(inputPath, assetPath) {
  return path.resolve(path.dirname(inputPath), assetPath);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sideAllocation(count) {
  const leftCount = Math.floor(count / 2);
  const rightCount = Math.ceil(count / 2);
  const placements = [];
  let leftRow = 0;
  let rightRow = 0;
  for (let index = 0; index < count; index += 1) {
    const side = count % 2 === 1 && index === count - 1
      ? "right"
      : index % 2 === 0 ? "left" : "right";
    placements.push({
      index,
      side,
      row: side === "left" ? leftRow++ : rightRow++
    });
  }
  return { placements, leftCount, rightCount };
}

function layoutForFrame(frame, items) {
  const { placements, leftCount, rightCount } = sideAllocation(items.length);
  const maxRows = Math.max(leftCount, rightCount);
  const compact = items.length >= 7;
  const density = items.length >= 6 ? "dense" : "regular";
  const rowGap = compact ? 18 : density === "dense" ? 22 : 28;
  const centerSize = clamp(Math.min(frame.width * 0.31, frame.height * 0.57), 218, 342);
  const center = {
    left: frame.left + (frame.width - centerSize) / 2,
    top: frame.top + (frame.height - centerSize) / 2,
    width: centerSize,
    height: centerSize,
    cx: frame.left + frame.width / 2,
    cy: frame.top + frame.height / 2
  };
  const sideWidth = frame.width * 0.285;
  const iconSize = compact ? 42 : density === "dense" ? 46 : 52;
  const itemHeight = compact ? 56 : density === "dense" ? 58 : 62;
  const titleSize = compact ? 20 : density === "dense" ? 21 : 23;
  const bodySize = 16;
  const leftX = frame.left + frame.width * 0.015;
  const rightX = frame.left + frame.width - frame.width * 0.015 - sideWidth;
  const textGap = compact ? 12 : 15;
  const textWidth = sideWidth - iconSize - textGap;
  const placementsBySide = { left: [], right: [] };

  for (const placement of placements) {
    const side = placement.side;
    const countOnSide = side === "left" ? leftCount : rightCount;
    const totalHeight = countOnSide * itemHeight + Math.max(0, countOnSide - 1) * rowGap;
    const firstTop = center.cy - totalHeight / 2;
    const top = firstTop + placement.row * (itemHeight + rowGap);
    const item = items[placement.index];
    const copyLeft = side === "left" ? leftX + iconSize + textGap : rightX;
    const iconLeft = side === "left" ? leftX : rightX + sideWidth - iconSize;
    placementsBySide[side].push({
      ...placement,
      item,
      itemBox: { left: side === "left" ? leftX : rightX, top, width: sideWidth, height: itemHeight },
      icon: { left: iconLeft, top: top + (itemHeight - iconSize) / 2, width: iconSize, height: iconSize },
      title: {
        left: copyLeft,
        top: top + 2,
        width: textWidth,
        height: 27,
        fontSize: titleSize,
        align: side === "left" ? "left" : "right"
      },
      body: {
        left: copyLeft,
        top: top + 31,
        width: textWidth,
        height: 23,
        fontSize: bodySize,
        align: side === "left" ? "left" : "right"
      }
    });
  }

  return {
    frame,
    count: items.length,
    density,
    rowGap,
    maxRows,
    center,
    centerRing: {
      left: center.left - 10,
      top: center.top - 10,
      width: center.width + 20,
      height: center.height + 20
    },
    sides: placementsBySide,
    rules: {
      sideAllocation: `${leftCount}/${rightCount}`,
      yAnchor: "each side independently centered around frame centerY",
      centerSize: "min(frame.width*0.31, frame.height*0.57), clamped",
      density: compact ? "7-item compact row spacing" : density
    }
  };
}

function addShape(slide, geometry, position, fill = "none", line = { style: "solid", fill: "none", width: 0 }, name) {
  return slide.shapes.add({ geometry, position, fill, line, name });
}

function addText(slide, text, box, style, name) {
  const shape = addShape(slide, "textbox", box, "none", { style: "solid", fill: "none", width: 0 }, name);
  shape.text = text;
  shape.text.style = {
    typeface: style.typeface || "Microsoft YaHei",
    fontSize: style.fontSize,
    color: style.color,
    bold: Boolean(style.bold),
    alignment: style.align || "left",
    verticalAlignment: "middle",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    autoFit: "shrinkText"
  };
  return shape;
}

async function addImage(slide, assetPath, position, alt, name) {
  const bytes = await fs.readFile(assetPath);
  const blob = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const extension = path.extname(assetPath).toLowerCase();
  const contentType = extension === ".png" ? "image/png" : "image/jpeg";
  return slide.images.add({
    blob,
    contentType,
    alt,
    fit: "cover",
    geometry: "ellipse",
    position,
    name
  });
}

function addDotField(slide, center, frame) {
  const radiusX = center.width * 0.78;
  const radiusY = center.height * 0.78;
  const step = 24;
  for (let y = center.cy - radiusY; y <= center.cy + radiusY; y += step) {
    for (let x = center.cx - radiusX; x <= center.cx + radiusX; x += step) {
      const ellipseDistance = ((x - center.cx) ** 2) / (radiusX ** 2) + ((y - center.cy) ** 2) / (radiusY ** 2);
      if (ellipseDistance < 0.18 || ellipseDistance > 1.02) continue;
      const size = ellipseDistance > 0.72 ? 4 : 3;
      addShape(slide, "ellipse", { left: x - size / 2, top: y - size / 2, width: size, height: size }, COLORS.dot, { style: "solid", fill: "none", width: 0 }, "dot-field");
    }
  }
}

async function addComponent(slide, input, items, layout, inputPath) {
  const { frame, center } = layout;
  addDotField(slide, center, frame);
  addShape(slide, "ellipse", layout.centerRing, COLORS.white, { style: "solid", fill: COLORS.line, width: 2 }, "center-ring");
  if (input.centerVisual?.src) {
    await addImage(slide, resolveAsset(inputPath, input.centerVisual.src), center, input.centerVisual.alt, "center-visual");
  } else {
    addShape(slide, "ellipse", center, "#eef5ff", { style: "dash", fill: COLORS.accent, width: 2 }, "center-image-required-slot");
    addText(slide, `${input.centerVisual?.placeholderLabel || "中心图片槽"}\n必填`, center, {
      fontSize: 22,
      color: "#37658e",
      bold: true,
      align: "center",
    }, "center-image-required-label");
  }

  for (const side of ["left", "right"]) {
    for (const placement of layout.sides[side]) {
      const item = placement.item;
      addShape(slide, "ellipse", placement.icon, COLORS.white, { style: "solid", fill: COLORS.line, width: 1.5 }, `icon-disk-${item.id}`);
      if (item.icon) {
        await addImage(slide, resolveAsset(inputPath, item.icon), placement.icon, `${item.title} 图标`, `icon-image-${item.id}`);
      } else {
        addText(slide, item.slotLabel || "标识", placement.icon, {
          fontSize: 16,
          color: COLORS.accent,
          bold: true,
          align: "center",
        }, `icon-slot-${item.id}`);
      }
      addText(slide, item.title, placement.title, { fontSize: placement.title.fontSize, color: COLORS.ink, bold: true, align: placement.title.align }, `title-${item.id}`);
      addText(slide, item.body, placement.body, { fontSize: placement.body.fontSize, color: COLORS.muted, align: placement.body.align }, `body-${item.id}`);
    }
  }
}

async function blobText(blob) {
  return await blob.text();
}

async function main() {
  const input = JSON.parse(await fs.readFile(INPUT_PATH, "utf8"));
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const presentation = Presentation.create({ slideSize: input.slideSize });
  const stateNames = ["golden4", "dense7"];
  const layoutSummaries = [];

  for (const [index, stateName] of stateNames.entries()) {
    const ids = input.states[stateName];
    const items = ids.map((id) => input.items.find((item) => item.id === id)).filter(Boolean);
    const layout = layoutForFrame(input.contentFrame, items);
    layoutSummaries.push({ slide: index + 1, state: stateName, ...layout });
    const slide = presentation.slides.add();
    slide.background.fill = COLORS.white;
    await addComponent(slide, input, items, layout, INPUT_PATH);
    await fs.writeFile(path.join(OUTPUT_DIR, `slide-${index + 1}.layout.json`), JSON.stringify({ state: stateName, ...layout }, null, 2), "utf8");
    const png = await slide.export({ format: "png", scale: 1 });
    await fs.writeFile(path.join(OUTPUT_DIR, `slide-${index + 1}.png`), Buffer.from(await png.arrayBuffer()));
  }

  await fs.writeFile(path.join(OUTPUT_DIR, "layout.json"), JSON.stringify({ slideSize: input.slideSize, contentFrame: input.contentFrame, slides: layoutSummaries }, null, 2), "utf8");
  const pptx = await PresentationFile.exportPptx(presentation);
  const pptxPath = path.join(OUTPUT_DIR, "radial-grammar-roundtrip.pptx");
  await pptx.save(pptxPath);

  const imported = await PresentationFile.importPptx(await FileBlob.load(pptxPath));
  const inspection = await imported.inspect({ kind: "slide,textbox,shape,image", maxChars: 50000 });
  await fs.writeFile(path.join(OUTPUT_DIR, "object-inspection.ndjson"), inspection?.ndjson || JSON.stringify(inspection, null, 2), "utf8");
  const editableInspection = await imported.inspect({ kind: "slide,textbox,image", maxChars: 20000 });
  await fs.writeFile(path.join(OUTPUT_DIR, "editable-object-inspection.ndjson"), editableInspection?.ndjson || JSON.stringify(editableInspection, null, 2), "utf8");
  console.log(JSON.stringify({ pptxPath, slideCount: presentation.slides.items.length, stateNames, inspection: inspection?.ndjson ? "ndjson" : typeof inspection }, null, 2));
}

const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

export { layoutForFrame, addComponent };

if (IS_MAIN) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
