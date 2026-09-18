import { grayBodyLayout } from './gray-draft.mjs';

const clampRatio = value => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

/**
 * 空洞 warn 阈值（数据驱动，2026-09-18 全归档统计：32 run / 82 页 / 138 区域）：
 * - 页面底部留白 p50=0.16 p75=0.34 p90=0.49；阈值 0.40 取在 p75 与 p90 之间，
 *   正值评审/用户反复点名的 0.4+ 抱怨带（55%~75% 内容高度边界产生的 25%~45% 留白，其上沿落在此）；
 * - 组内容空洞 p50=0.37 p75=0.47 p90=0.67；阈值 0.70 贴近 p90，且要求容器 ≥160px（过滤小容器噪声）。
 * warn 不阻塞交付；阈值若需升 fail 只提案不实施。
 */
export const VOID_THRESHOLDS = Object.freeze({ bottomVoid: 0.4, regionVoid: 0.7, regionMinAvailable: 160 });

/** 逐页空洞 warn：页底留白或组内容空洞超阈即记录（非阻塞）。 */
export function voidWarnings(rows, thresholds = VOID_THRESHOLDS) {
  const warnings = [];
  for (const row of rows ?? []) {
    if (row.bottomVoid >= thresholds.bottomVoid) {
      warnings.push({ code: 'page-bottom-void', pageId: row.pageId, value: Number(row.bottomVoid.toFixed(3)), threshold: thresholds.bottomVoid, message: `页 ${row.pageId} 底部留白 ${(row.bottomVoid * 100).toFixed(0)}% ≥ ${(thresholds.bottomVoid * 100).toFixed(0)}%：内容明显少于页高，考虑合并/填充或改分页（记录，不阻塞）。` });
    }
    for (const region of row.regions ?? []) {
      if (region.available >= thresholds.regionMinAvailable && region.voidRatio >= thresholds.regionVoid) {
        warnings.push({ code: 'region-void', pageId: row.pageId, itemId: region.itemId, value: Number(region.voidRatio.toFixed(3)), threshold: thresholds.regionVoid, message: `页 ${row.pageId} 组 ${region.itemId} 内容只占容器 ${(100 - region.voidRatio * 100).toFixed(0)}%（空洞 ${(region.voidRatio * 100).toFixed(0)}%）：考虑压紧容器或补内容（记录，不阻塞）。` });
      }
    }
  }
  return warnings;
}

/**
 * 几何审计（空洞检测）：逐页计算内容最小高与容器高之比、以及页面底部留白比。
 * 坐标口径与 renderGrayDraft 完全一致（heading 区 54px，sections 相对组内容区）。
 * 只度量、不判定级别；阈值由归档数据的分布决定（评审 #3 任务合同）。
 */
export function auditGeometry(pages, area) {
  const rows = [];
  for (const page of pages ?? []) {
    const regions = page.composition?.regions ?? [];
    let maxBottom = 0;
    const regionRows = [];
    for (const region of regions) {
      const item = (page.items ?? []).find(candidate => candidate.id === region.itemId);
      if (!item) continue;
      const available = region.height - 70;
      const body = grayBodyLayout(item, region.width - 32, region.fontSize ?? 22, Math.max(0, available));
      const contentMin = body.minimumHeight;
      const contentBottom = Math.max(0, ...body.sections.map(section => section.top + section.height));
      maxBottom = Math.max(maxBottom, region.y + 54 + contentBottom);
      regionRows.push({
        itemId: region.itemId,
        available,
        contentMin,
        voidRatio: clampRatio(1 - contentMin / Math.max(1, available)),
      });
    }
    rows.push({ pageId: page.pageId, bottomVoid: clampRatio(1 - maxBottom / Math.max(1, area.height)), regions: regionRows });
  }
  return rows;
}
