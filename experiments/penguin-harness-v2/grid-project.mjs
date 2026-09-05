import { fitChineseTextToFrame } from "../../src/render/chinese-typography.mjs";
import { northeasternUniversitySkin as skin } from "../../src/runtime/skins/northeastern-university-contract.mjs";
import { visualComponent as sequence } from "../../assets/结构图/顺序流程-001/review.mjs";
import fs from "node:fs/promises";

export const GRID = { columns: 24, rows: 12, inset: 8, frame: skin.bodyFrame };
export const RULES = { allowedAlignments: ["left", "center"], oneAlignmentPerBodyPage: true, minGap: 16, sparseInk: 0.12, denseInk: 0.65, largeEmptyRectangle: 0.44 };
export const TEXT_SKILL = "text/basic";
export const STRUCTURE_SKILL = "sequence-flow-001";
export async function skillCatalog(root) {
  const asset = JSON.parse(await fs.readFile(`${root}/assets/结构图/顺序流程-001/asset.json`, "utf8"));
  return [
    { id: TEXT_SKILL, kind: "text", status: "experiment-adapter", source: "src/asset-runtime/component-builders.mjs + Skin typography", purpose: "观点、解释、对比对象与分点；每个区域一个或多个来源项", allowedAlignments: ["left", "center"], titleSize: 27, bodySize: 20 },
    { id: asset.id, kind: "structure", status: asset.status, purpose: asset.semanticContract, avoid: asset.doNotUseWhen, itemCount: asset.runtime.itemCount, footprints: asset.spatialContract.stateFootprints, capacity: sequence.textCapacity, allowedAlignments: ["center"], note: "沿用现有结构的居中文字，同页独立文字也必须居中；区域需容纳自然占用，不缩字。" },
  ];
}
export function sourceMap(raw) {
  let heading = "";
  return raw.split(/\r?\n\s*\r?\n/).map((part) => part.trim()).filter(Boolean).flatMap((part) => {
    if (part.startsWith("#")) { heading = part.replace(/^#+\s*/, ""); return []; }
    return [{ heading, text: part }];
  }).map((source, index) => ({ id: `s${index + 1}`, ...source }));
}
export function newProject(raw, sourcePath) {
  return { schemaVersion: "grid-pilot-1", sourcePath, sources: sourceMap(raw), deckBrief: null, pages: [], artifactState: {}, phase: "content" };
}
export function upsertBriefs(project, pages) {
  if (project.phase !== "content") throw new Error("内容阶段已冻结；不能在视觉阶段修改 PageBrief");
  const next = structuredClone(project);
  const sourceById = new Map(project.sources.map((s) => [s.id, s]));
  for (const page of pages) {
    const ids = new Set();
    for (const item of page.items) {
      if (ids.has(item.id)) throw new Error(`重复内容项 ${item.id}`);
      ids.add(item.id);
      if (!item.sourceIds.length || item.sourceIds.some((id) => !sourceById.has(id))) throw new Error(`未知或空来源 ${item.id}`);
      item.sourceText = item.sourceIds.map((id) => sourceById.get(id).text).join("\n");
    }
    const index = next.pages.findIndex((p) => p.pageId === page.pageId);
    const value = { ...structuredClone(page), revision: (next.pages[index]?.revision ?? 0) + 1 };
    if (index < 0) next.pages.push(value); else next.pages[index] = value;
    delete next.artifactState[page.pageId];
  }
  return next;
}
export function validateContent(project) {
  const used = new Set(project.pages.flatMap((p) => p.items.flatMap((i) => i.sourceIds)));
  const missing = project.sources.filter((s) => !used.has(s.id)).map((s) => s.id);
  const issues = [];
  if (!project.deckBrief || !project.pages.length) issues.push({ code: "missing-deck-or-pages" });
  if (missing.length) issues.push({ code: "missing-source-coverage", sourceIds: missing });
  return { accepted: !issues.length, issues, pageCount: project.pages.length, sourceCoverage: { used: used.size, total: project.sources.length }, semanticLimit: "来源覆盖不自动证明分页、标题或结论正确，仍需人工核对。" };
}
export function replaceBriefs(project, targetPageIds, incoming) {
  if (project.phase !== "content-revision") throw new Error("未进入定向内容修订阶段");
  if (!incoming.length) throw new Error("修订不能删除全部内容");
  const targets = project.pages.filter((p) => targetPageIds.includes(p.pageId));
  if (targets.length !== targetPageIds.length) throw new Error("未知修订页");
  const expected = new Set(targets.flatMap((p) => p.items.flatMap((i) => i.sourceIds)));
  const actual = new Set(incoming.flatMap((p) => p.items.flatMap((i) => i.sourceIds)));
  if (expected.size !== actual.size || [...expected].some((id) => !actual.has(id))) throw new Error("定向修订必须保留目标页的全部来源，不得引入其他页来源");
  const retained = project.pages.filter((p) => !targetPageIds.includes(p.pageId));
  if (incoming.some((p) => retained.some((r) => r.pageId === p.pageId)) || new Set(incoming.map((p) => p.pageId)).size !== incoming.length) throw new Error("修订 pageId 冲突");
  const temporary = upsertBriefs({ ...structuredClone(project), phase: "content", pages: [], artifactState: {} }, incoming);
  const next = structuredClone(project), first = project.pages.findIndex((p) => targetPageIds.includes(p.pageId));
  next.pages = [...retained.slice(0, first), ...temporary.pages, ...retained.slice(first)];
  for (const id of targetPageIds) delete next.artifactState[id];
  for (const p of incoming) delete next.artifactState[p.pageId];
  next.contentRevision.applied = true;
  return next;
}
export function regionFrame(region) {
  const { frame, columns, rows, inset } = GRID;
  return { left: frame.left + region.x * frame.width / columns + inset, top: frame.top + region.y * frame.height / rows + inset, width: region.w * frame.width / columns - 2 * inset, height: region.h * frame.height / rows - 2 * inset };
}
export function textBlocks(region) {
  const frame = regionFrame(region);
  const rowHeight = (frame.height - 20 * (region.view.length - 1)) / region.view.length;
  return region.view.flatMap((view, index) => {
    const top = frame.top + index * (rowHeight + 20);
    const titleHeight = view.title ? 36 : 0;
    return [
      ...(view.title ? [{ text: view.title, role: "title", frame: { ...frame, top, height: titleHeight }, size: 27, maxLines: 1, sourceItemId: view.sourceItemId }] : []),
      ...(view.body ? [{ text: view.body, role: "body", frame: { ...frame, top: top + titleHeight + (view.title ? 12 : 0), height: rowHeight - titleHeight - (view.title ? 12 : 0) }, size: 20, maxLines: 12, sourceItemId: view.sourceItemId }] : []),
    ].map((block) => ({ ...block, regionId: region.id }));
  });
}
export function fitBlock(block) {
  return fitChineseTextToFrame(block.text, { ...block.frame, fontSizes: [block.size], maxLines: block.maxLines, lineHeight: 1.2, glyphWidthFactor: 1.05 });
}
const overlap = (a, b) => Math.min(a.left + a.width, b.left + b.width) > Math.max(a.left, b.left) + 0.5 && Math.min(a.top + a.height, b.top + b.height) > Math.max(a.top, b.top) + 0.5;
export function validateComposition(page, plan, catalog) {
  const issues = [], covered = new Set(), regionIds = new Set();
  const byId = new Map(page.items.map((item) => [item.id, item]));
  const error = (code, regionId, details = {}) => issues.push({ code, regionId, ...details });
  if (!RULES.allowedAlignments.includes(plan.alignment)) error("alignment-mismatch", null, { allowed: RULES.allowedAlignments });
  for (const region of plan.regions) {
    if (regionIds.has(region.id)) error("duplicate-region", region.id);
    regionIds.add(region.id);
    if (![region.x, region.y, region.w, region.h].every(Number.isInteger) || region.x < 0 || region.y < 0 || region.w <= 0 || region.h <= 0 || region.x + region.w > GRID.columns || region.y + region.h > GRID.rows) { error("grid-outside", region.id); continue; }
    const skill = catalog.find((s) => s.id === region.skillId);
    if (!skill) { error("unknown-skill", region.id); continue; }
    if (!skill.allowedAlignments.includes(plan.alignment)) error("skill-alignment-incompatible", region.id, { allowed: skill.allowedAlignments });
    if (!region.view.length) error("empty-region", region.id);
    for (const view of region.view) {
      const item = byId.get(view.sourceItemId);
      if (!item) { error("unknown-source-item", region.id, { sourceItemId: view.sourceItemId }); continue; }
      covered.add(item.id);
      if (!view.title && !view.body) error("empty-view", region.id);
      for (const field of ["title", "body"]) {
        if (view[field] && !item.sourceText.includes(view[field])) error("non-extractive-view", region.id, { field, sourceItemId: item.id, instruction: "本试验仅接受该来源项中逐字连续的片段；完整内容保留在备注，不要改数字或拼接新事实。" });
      }
    }
    if (skill.kind === "structure") {
      if (page.relation !== "sequence") error("structure-semantic-mismatch", region.id, { relation: page.relation });
      const selected = region.view.map((v) => page.items.findIndex((i) => i.id === v.sourceItemId));
      if (selected.some((n, i) => i && n <= selected[i - 1])) error("sequence-order-mismatch", region.id);
      const footprint = skill.footprints[String(region.view.length)];
      const frame = regionFrame(region);
      if (!footprint || frame.width < footprint.width || frame.height < footprint.height) error("structure-frame-too-small", region.id, { frame, required: footprint ?? skill.itemCount });
      try { sequence.renderMarkup({ items: region.view }); } catch (e) { error("structure-capacity", region.id, { message: e.message }); }
    } else {
      for (const block of textBlocks(region)) {
        try { const fit = fitBlock(block); if (!fit.fits) error("text-does-not-fit", region.id, { sourceItemId: block.sourceItemId, role: block.role, lineCount: fit.lineCount, frame: block.frame, instruction: "加宽/增高区域，移动其他区域，或提取更短的来源片段；不缩小字号。" }); }
        catch (e) { error("text-frame-invalid", region.id, { message: e.message }); }
      }
    }
  }
  for (let i = 0; i < plan.regions.length; i++) for (let j = i + 1; j < plan.regions.length; j++) {
    if (overlap(regionFrame(plan.regions[i]), regionFrame(plan.regions[j]))) error("region-overlap", plan.regions[i].id, { otherRegionId: plan.regions[j].id });
  }
  for (const item of page.items) if (!covered.has(item.id)) error("missing-item-view", null, { sourceItemId: item.id });
  return { pageId: page.pageId, accepted: !issues.length, issues };
}

export function occupancy(rectangles) {
  const cells = Array.from({ length: GRID.rows }, () => Array(GRID.columns).fill(0));
  for (let y = 0; y < GRID.rows; y++) for (let x = 0; x < GRID.columns; x++) {
    const cell = { left: GRID.frame.left + x * GRID.frame.width / GRID.columns, top: GRID.frame.top + y * GRID.frame.height / GRID.rows, width: GRID.frame.width / GRID.columns, height: GRID.frame.height / GRID.rows };
    cells[y][x] = rectangles.some((rect) => overlap(rect, cell)) ? 1 : 0;
  }
  let largest = { x: 0, y: 0, w: 0, h: 0, cells: 0 };
  for (let top = 0; top < GRID.rows; top++) {
    const free = Array(GRID.columns).fill(true);
    for (let bottom = top; bottom < GRID.rows; bottom++) {
      let width = 0;
      for (let x = 0; x < GRID.columns; x++) {
        free[x] &&= !cells[bottom][x]; width = free[x] ? width + 1 : 0;
        const area = width * (bottom - top + 1);
        if (area > largest.cells) largest = { x: x - width + 1, y: top, w: width, h: bottom - top + 1, cells: area };
      }
    }
  }
  return { occupiedCellRatio: cells.flat().reduce((a, b) => a + b, 0) / (GRID.rows * GRID.columns), largestEmptyRectangle: { ...largest, ratio: largest.cells / (GRID.rows * GRID.columns) }, heatmap: cells.map((row) => row.map((v) => v ? "#" : ".").join("")) };
}

export function layoutFeedback(layout, page, plan) {
  const elements = layout.elements.filter((e) => e.text && e.bbox && e.bbox[1] >= GRID.frame.top - 1 && e.bbox[1] < GRID.frame.top + GRID.frame.height);
  const issues = [], textRects = [];
  if (!elements.length) issues.push({ code: "native-content-empty" });
  const records = elements.map((element) => {
    const [left, top, width, height] = element.bbox;
    const size = element.resolvedFontSize ?? element.resolvedTextStyle?.fontSize ?? 20;
    const lines = element.textLayout?.lines?.map((line) => line.text) ?? element.text.split("\n");
    const align = element.resolvedTextStyle?.alignment ?? "left";
    if (size < 12) issues.push({ code: "native-font-below-floor", objectName: element.name, actual: size });
    if (!element.name?.startsWith("sequence-order") && align !== (plan.alignment ?? "left")) issues.push({ code: "native-alignment-mismatch", objectName: element.name, actual: align });
    if (left < GRID.frame.left - 0.5 || top < GRID.frame.top - 0.5 || left + width > GRID.frame.left + GRID.frame.width + 0.5 || top + height > GRID.frame.top + GRID.frame.height + 0.5) issues.push({ code: "native-text-outside", objectName: element.name, bbox: element.bbox });
    // Exported layout provides real text frames/lines but no glyph bounds.
    // This proxy is explicitly approximate; it never treats empty frames as ink.
    lines.forEach((line, i) => {
      const units = [...line].reduce((n, c) => n + (/[\uFEFF\u2060]/u.test(c) ? 0 : /[\x00-\x7F]/u.test(c) ? 0.55 : 1), 0);
      const inkWidth = Math.min(width, units * size);
      textRects.push({ left: align === "center" ? left + (width - inkWidth) / 2 : left, top: top + i * size * 1.2, width: inkWidth, height: size * 1.15 });
    });
    return { name: element.name, bbox: element.bbox, fontSize: size, alignment: align, lineCount: lines.length, text: element.text };
  });
  for (let i = 0; i < records.length; i++) for (let j = i + 1; j < records.length; j++) {
    const rect = (r) => ({ left: r.bbox[0], top: r.bbox[1], width: r.bbox[2], height: r.bbox[3] });
    if (overlap(rect(records[i]), rect(records[j]))) issues.push({ code: "native-text-frame-overlap", objectNames: [records[i].name, records[j].name] });
  }
  const ink = occupancy(textRects), regionAllocation = occupancy(plan.regions.map(regionFrame));
  const warnings = [];
  if (ink.occupiedCellRatio < RULES.sparseInk) issues.push({ code: "content-underfilled", actual: ink.occupiedCellRatio, limit: RULES.sparseInk, instruction: "用户要求避免大片空白，不能仅用强调留白作为豁免。若现有内容不适合独页，通过 request_content_revision 请求相关页面重组，不加虚构文字或放大空框。" });
  if (ink.occupiedCellRatio > RULES.denseInk) warnings.push({ code: "dense-content", actual: ink.occupiedCellRatio, limit: RULES.denseInk });
  if (ink.largestEmptyRectangle.ratio > RULES.largeEmptyRectangle) warnings.push({ code: "large-empty-area", rectangle: ink.largestEmptyRectangle, instruction: "检查是否有意留白；必要时调整区域位置或宽度，不能用无内容背景框填密度。" });
  return { pageId: page.pageId, accepted: !issues.length, issues, warnings, regionAllocation, textOccupancyEstimate: ink, textObjects: records, evidenceBoundary: "来自 Native 导出的真实文本框与行；字形占用和空区是估计值，不包含装饰背景，也不证明审美正确。" };
}
