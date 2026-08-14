export const CATALOG_COMPONENT_FRAME = Object.freeze({
  left: 55,
  top: 166,
  width: 1170,
  height: 492,
});

function centeredRow({ count, width, gap, top, height }) {
  const totalWidth = count * width + (count - 1) * gap;
  const left = (CATALOG_COMPONENT_FRAME.width - totalWidth) / 2;
  return Array.from({ length: count }, (_, index) => ({
    left: left + index * (width + gap),
    top,
    width,
    height,
  }));
}

export function resolveCatalogLayout(itemCount) {
  if (!Number.isInteger(itemCount) || itemCount < 3 || itemCount > 7) {
    throw new Error("目录标签卡片支持 3–7 项");
  }

  if (itemCount <= 4) {
    const gap = itemCount === 3 ? 48 : 18;
    const width = itemCount === 3
      ? 340
      : (1116 - gap * (itemCount - 1)) / itemCount;
    return {
      itemCount,
      columns: itemCount,
      rowCounts: [itemCount],
      frames: centeredRow({ count: itemCount, width, gap, top: 66, height: 360 }),
    };
  }

  const columns = itemCount <= 6 ? 3 : 4;
  const gapX = columns === 3 ? 18 : 14;
  const width = (1116 - gapX * (columns - 1)) / columns;
  const rowCounts = [columns, itemCount - columns];
  const frames = [
    ...centeredRow({ count: rowCounts[0], width, gap: gapX, top: 26, height: 210 }),
    ...centeredRow({ count: rowCounts[1], width, gap: gapX, top: 256, height: 210 }),
  ];
  return { itemCount, columns, rowCounts, frames };
}

export function toSlideFrame(localFrame) {
  return {
    left: CATALOG_COMPONENT_FRAME.left + localFrame.left,
    top: CATALOG_COMPONENT_FRAME.top + localFrame.top,
    width: localFrame.width,
    height: localFrame.height,
  };
}
