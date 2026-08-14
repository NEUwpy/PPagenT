function countChars(value) {
  return Array.from(String(value ?? "").trim()).length;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function computeContentStats(pageContent) {
  const items = pageContent.items ?? [];
  const itemTitleLengths = items.map((item) => countChars(item.title));
  const itemBodyLengths = items.map((item) => countChars(item.body));
  const itemPointLengths = items.map((item) => (
    (item.points ?? []).reduce((sum, point) => sum + countChars(point), 0)
  ));
  const itemLengths = items.map((item, index) => (
    itemTitleLengths[index] + itemBodyLengths[index] + itemPointLengths[index]
  ));
  const maxItemChars = itemLengths.length ? Math.max(...itemLengths) : 0;
  const minItemChars = itemLengths.length ? Math.min(...itemLengths) : 0;
  const average = itemLengths.length ? itemLengths.reduce((sum, value) => sum + value, 0) / itemLengths.length : 0;

  return {
    titleChars: countChars(pageContent.title),
    itemCount: items.length,
    maxItemChars,
    avgItemChars: round(average),
    minItemChars,
    maxItemTitleChars: itemTitleLengths.length ? Math.max(...itemTitleLengths) : 0,
    maxItemBodyChars: itemBodyLengths.length ? Math.max(...itemBodyLengths) : 0,
    imbalanceRatio: minItemChars > 0 ? round(maxItemChars / minItemChars) : maxItemChars > 0 ? maxItemChars : 0,
  };
}

export function enrichPageIntent(intentDraft, pageContent) {
  const contentStats = computeContentStats(pageContent);
  const dimensions = { ...(intentDraft.structure?.dimensions ?? {}) };
  const pointCounts = (pageContent.items ?? []).map((item) => item.points?.length ?? 0);
  const pointLengths = (pageContent.items ?? []).flatMap((item) => (
    (item.points ?? []).map((point) => countChars(point))
  ));
  dimensions.maxPointsPerItem = pointCounts.length ? Math.max(...pointCounts) : 0;
  dimensions.maxPointChars = pointLengths.length ? Math.max(...pointLengths) : 0;
  dimensions.totalPoints = pointCounts.reduce((sum, value) => sum + value, 0);
  if (intentDraft.baseRelation === "comparison" && pageContent.items?.length === 2) {
    const pointCount = (value) => Math.max(
      1,
      String(value ?? "").split(/\r?\n|[;；]/).map((item) => item.trim()).filter(Boolean).length,
    );
    dimensions.groups = 2;
    dimensions.itemsPerGroup = Math.max(...pageContent.items.map((item) => pointCount(item.body)));
  }
  return {
    ...intentDraft,
    schemaVersion: "1.1",
    structure: {
      ...intentDraft.structure,
      itemCount: contentStats.itemCount,
      dimensions,
    },
    contentStats,
  };
}
