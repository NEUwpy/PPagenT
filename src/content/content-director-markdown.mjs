import { extractManuscriptSections } from "./manuscript-sections.mjs";
import { buildSourceBlocks } from "./source-blocks.mjs";

export class ContentDirectorMarkdownError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ContentDirectorMarkdownError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ContentDirectorMarkdownError(code, message, details);
}

function plainInline(value) {
  return String(value ?? "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/[*_~]/g, "")
    .trim();
}

function quoteText(lines) {
  return plainInline(lines
    .filter((line) => /^\s*>/.test(line))
    .map((line) => line.replace(/^\s*>\s?/, "").trim())
    .filter(Boolean)
    .join(" "));
}

function parseItemBlock(block, pageId, itemIndex) {
  const bodyLines = [];
  const points = [];
  let paragraph = [];
  const flushParagraph = () => {
    const text = plainInline(paragraph.join(" "));
    if (text) bodyLines.push(text);
    paragraph = [];
  };
  for (const rawLine of block.lines) {
    const line = rawLine.trimEnd();
    const subheading = line.match(/^###\s+(.+?)\s*$/);
    if (subheading) {
      flushParagraph();
      const label = plainInline(subheading[1]);
      if (label) bodyLines.push(label);
      continue;
    }
    const bullet = line.match(/^\s*[-+*]\s+(.+?)\s*$/);
    if (bullet) {
      flushParagraph();
      const point = plainInline(bullet[1]);
      if (point) points.push(point);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    if (/^\s*>/.test(line)) continue;
    paragraph.push(line.trim());
  }
  flushParagraph();
  if (!bodyLines.length && !points.length) {
    fail("CONTENT_MARKDOWN_INVALID", `页面“${block.pageTitle}”的 H2“${block.title}”没有正文或列表`);
  }
  return {
    id: `${pageId}-item-${itemIndex + 1}`,
    title: plainInline(block.title),
    body: bodyLines.join("\n\n"),
    ...(points.length ? { points: [...new Set(points)] } : {}),
  };
}

/**
 * Parse the controlled, human-readable content draft. Markdown is the only
 * content hierarchy: every H1 is one page, H2 is a semantic item, and H3 is
 * an optional subsection label inside that item. Deck-level facts live in
 * deckMetadata so Markdown has exactly one page boundary rule.
 */
export function parseContentDirectorMarkdown(contentMarkdown) {
  const source = String(contentMarkdown ?? "").replace(/\r\n/g, "\n").trim();
  if (!source) fail("CONTENT_MARKDOWN_INVALID", "内容导演没有输出 Markdown 内容稿");
  const lines = source.split("\n");
  let fenced = false;
  let currentPage = null;
  let currentItem = null;
  const pages = [];
  const flushItem = () => {
    if (!currentItem || !currentPage) return;
    currentPage.itemBlocks.push(currentItem);
    currentItem = null;
  };
  const flushPage = () => {
    flushItem();
    if (!currentPage) return;
    const unexpectedPrelude = currentPage.prelude.filter((line) => line.trim() && !/^\s*>/.test(line));
    if (unexpectedPrelude.length) {
        fail("CONTENT_MARKDOWN_INVALID", `页面“${currentPage.title}”在首个 H2 前只能写引用块叙事职责`, {
        unexpected: unexpectedPrelude.slice(0, 3),
      });
    }
    currentPage.narrativeJob = quoteText(currentPage.prelude);
    if (!currentPage.narrativeJob) {
      fail("CONTENT_MARKDOWN_INVALID", `页面“${currentPage.title}”缺少紧随 H1 的引用块叙事职责`);
    }
    if (!currentPage.itemBlocks.length) {
      fail("CONTENT_MARKDOWN_INVALID", `页面“${currentPage.title}”至少需要一个 H2 内容节点`);
    }
    pages.push(currentPage);
    currentPage = null;
  };

  for (const rawLine of lines) {
    if (/^\s*```/.test(rawLine)) {
      fenced = !fenced;
      if (currentItem) currentItem.lines.push(rawLine);
      continue;
    }
    const heading = fenced ? null : rawLine.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!heading) {
      if (currentItem) currentItem.lines.push(rawLine);
      else if (currentPage) currentPage.prelude.push(rawLine);
      else if (rawLine.trim()) fail("CONTENT_MARKDOWN_INVALID", "首个 H1 页面之前不能写正文");
      continue;
    }
    const level = heading[1].length;
    const title = plainInline(heading[2]);
    if (!title) fail("CONTENT_MARKDOWN_INVALID", `H${level} 标题不能为空`);
    if (level === 1) {
      flushPage();
      currentPage = { title, prelude: [], itemBlocks: [] };
      continue;
    }
    if (!currentPage) fail("CONTENT_MARKDOWN_INVALID", `H${level}“${title}”之前缺少 H1 页面标题`);
    if (level === 2) {
      flushItem();
      currentItem = { title, pageTitle: currentPage.title, lines: [] };
      continue;
    }
    if (level === 3) {
      if (!currentItem) fail("CONTENT_MARKDOWN_INVALID", `H3“${title}”之前缺少 H2 内容节点`);
      currentItem.lines.push(`### ${title}`);
      continue;
    }
    fail("CONTENT_MARKDOWN_INVALID", `内容稿不使用 H${level}；只允许 H1 页面、H2 主节点和 H3 节点内小标题`, { level, title });
  }
  flushPage();
  if (!pages.length) fail("CONTENT_MARKDOWN_INVALID", "Markdown 内容稿至少需要一个 H1 页面");
  return { source, pages };
}

function paragraphBounds(source, start, end) {
  const previousBreak = source.lastIndexOf("\n\n", Math.max(0, start - 1));
  const nextBreak = source.indexOf("\n\n", end);
  return {
    start: previousBreak < 0 ? 0 : previousBreak + 2,
    end: nextBreak < 0 ? source.length : nextBreak,
  };
}

function canonicalBlockAnchor(block) {
  const text = String(block?.text ?? "").trim();
  return Array.from(text).slice(0, 160).join("");
}

function duplicateRange(ranges, range, index) {
  return ranges.slice(0, index).find((candidate) => (
    candidate.anchorStart === range.anchorStart && candidate.anchorEnd === range.anchorEnd
  ));
}

function locatePageSources(rawMarkdown, pageMetadata) {
  const source = String(rawMarkdown ?? "");
  const explicitSections = extractManuscriptSections(source);
  const explicitPages = explicitSections.length > 0
    && explicitSections.every((section) => section.markerKind === "explicit-page");
  const usesSourceBlocks = pageMetadata.length > 0 && pageMetadata.every((metadata) => (
    Array.isArray(metadata.sourceBlockIds) && metadata.sourceBlockIds.length > 0
  ));
  if (usesSourceBlocks) {
    const blocks = buildSourceBlocks(source);
    const byId = new Map(blocks.map((block) => [block.id, block]));
    if (explicitPages && pageMetadata.length !== explicitSections.length) {
      fail("CONTENT_METADATA_MISMATCH", `原稿有 ${explicitSections.length} 个显式页面，内容稿输出了 ${pageMetadata.length} 页`, {
        expectedPages: explicitSections.length,
        actualPages: pageMetadata.length,
      });
    }
    const ranges = pageMetadata.map((metadata, pageIndex) => {
      const ids = metadata.sourceBlockIds;
      if (ids.length < 1 || ids.length > 2 || new Set(ids).size !== ids.length) {
        fail("CONTENT_METADATA_MISMATCH", `第 ${pageIndex + 1} 页 sourceBlockIds 必须包含一至两个不同的原稿段落 ID`, {
          pageId: metadata.pageId,
          sourceBlockIds: ids,
        });
      }
      const selected = ids.map((id) => byId.get(id));
      const missing = ids.filter((_, index) => !selected[index]);
      if (missing.length) {
        fail("CONTENT_METADATA_MISMATCH", `第 ${pageIndex + 1} 页引用了不存在的原稿段落 ID`, {
          pageId: metadata.pageId,
          missingSourceBlockIds: missing,
        });
      }
      const first = selected.reduce((left, right) => (left.start <= right.start ? left : right));
      const last = selected.reduce((left, right) => (left.start >= right.start ? left : right));
      if (explicitPages) {
        const section = explicitSections[pageIndex];
        if (first.start < section.startIndex || last.end > section.endIndex) {
          fail("CONTENT_METADATA_MISMATCH", `第 ${pageIndex + 1} 页来源段落不属于对应的显式页面`, {
            pageId: metadata.pageId,
            sourceBlockIds: ids,
          });
        }
      }
      const sourceAnchors = [...new Set(selected.map(canonicalBlockAnchor).filter(Boolean))];
      return {
        start: first.start,
        end: last.end,
        anchorStart: first.start,
        anchorEnd: last.end,
        pageId: metadata.pageId,
        sourceAnchors,
      };
    });
    ranges.forEach((range, index) => {
      const duplicate = duplicateRange(ranges, range, index);
      if (duplicate) {
        fail("CONTENT_METADATA_MISMATCH", `第 ${index + 1} 页与前页使用了完全相同的来源证据范围`, {
          previousPageId: duplicate.pageId,
          pageId: range.pageId,
        });
      }
    });
    return ranges.map((range) => ({
      sourceText: source.slice(range.start, range.end).trim(),
      sourceAnchors: range.sourceAnchors,
    }));
  }
  if (explicitPages) {
    if (pageMetadata.length !== explicitSections.length) {
      fail("CONTENT_METADATA_MISMATCH", `原稿有 ${explicitSections.length} 个显式页面，内容稿输出了 ${pageMetadata.length} 页`, {
        expectedPages: explicitSections.length,
        actualPages: pageMetadata.length,
      });
    }
    return explicitSections.map((section, index) => {
      const anchors = pageMetadata[index].sourceAnchors ?? [];
      if (!anchors.length || anchors.some((anchor) => !section.sourceText.includes(String(anchor)))) {
        fail("CONTENT_METADATA_MISMATCH", `第 ${index + 1} 页来源锚点不属于对应的显式页面`, {
          pageId: pageMetadata[index].pageId,
          sourceAnchors: anchors,
        });
      }
      return { sourceText: section.sourceText, sourceAnchors: anchors };
    });
  }

  const ranges = pageMetadata.map((metadata, pageIndex) => {
    const anchors = metadata.sourceAnchors;
    if (!Array.isArray(anchors) || anchors.length < 1 || anchors.length > 2
      || anchors.some((anchor) => typeof anchor !== "string" || !anchor.trim())) {
      fail("CONTENT_METADATA_MISMATCH", `第 ${pageIndex + 1} 页 sourceAnchors 必须包含一至两个原稿证据片段`);
    }
    const positions = anchors.map((anchor) => {
      const position = source.indexOf(anchor);
      if (position < 0) {
        fail("CONTENT_METADATA_MISMATCH", `第 ${pageIndex + 1} 页来源锚点无法在原稿中定位`, {
          pageId: metadata.pageId,
          anchor,
        });
      }
      if (source.indexOf(anchor, position + anchor.length) >= 0) {
        fail("CONTENT_METADATA_MISMATCH", `第 ${pageIndex + 1} 页来源锚点在原稿中不唯一`, {
          pageId: metadata.pageId,
          anchor,
        });
      }
      return { anchor, position };
    });
    const first = positions.reduce((left, right) => (left.position <= right.position ? left : right));
    const last = positions.reduce((left, right) => (left.position >= right.position ? left : right));
    const start = first.position;
    const end = last.position + last.anchor.length;
    const bounds = paragraphBounds(source, start, end);
    return { ...bounds, anchorStart: start, anchorEnd: end, pageId: metadata.pageId };
  });
  ranges.forEach((range, index) => {
    const duplicate = duplicateRange(ranges, range, index);
    if (duplicate) {
      fail("CONTENT_METADATA_MISMATCH", `第 ${index + 1} 页与前页使用了完全相同的来源证据范围`, {
        previousPageId: duplicate.pageId,
        pageId: range.pageId,
      });
    }
  });
  return ranges.map((range, index) => ({
    sourceText: source.slice(range.start, range.end).trim(),
    sourceAnchors: pageMetadata[index].sourceAnchors,
  }));
}

function decodePointer(path) {
  if (typeof path !== "string" || !path.startsWith("/")) {
    fail("CONTENT_RELATION_COMPILE_FAILED", `relationBindings path 必须是 JSON Pointer：${path}`);
  }
  const parts = path.slice(1).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  if (parts.some((part) => ["__proto__", "prototype", "constructor"].includes(part))) {
    fail("CONTENT_RELATION_COMPILE_FAILED", `relationBindings path 包含非法属性：${path}`);
  }
  return parts;
}

function setPointer(target, path, value) {
  const parts = decodePointer(path);
  let node = target;
  parts.forEach((part, index) => {
    const last = index === parts.length - 1;
    const nextIsIndex = /^\d+$/.test(parts[index + 1] ?? "");
    if (last) {
      if (Array.isArray(node) && /^\d+$/.test(part)) node[Number(part)] = value;
      else node[part] = value;
      return;
    }
    if (Array.isArray(node) && /^\d+$/.test(part)) {
      node[Number(part)] ??= nextIsIndex ? [] : {};
      node = node[Number(part)];
    } else {
      node[part] ??= nextIsIndex ? [] : {};
      node = node[part];
    }
  });
}

function referenceValue(reference, page, parsedPage) {
  if (reference === "page.title") return page.title;
  const match = String(reference ?? "").match(/^item:(\d+)\.(id|title|body|point:(\d+))$/);
  if (!match) fail("CONTENT_RELATION_COMPILE_FAILED", `未知 Markdown 内容引用：${reference}`);
  const itemIndex = Number(match[1]) - 1;
  const item = page.items[itemIndex];
  if (!item) fail("CONTENT_RELATION_COMPILE_FAILED", `引用了不存在的 H2 节点：${reference}`);
  if (match[2] === "id") return item.id;
  if (match[2] === "title") return item.title;
  if (match[2] === "body") return item.body;
  const pointIndex = Number(match[3]) - 1;
  const point = item.points?.[pointIndex];
  if (point === undefined) {
    fail("CONTENT_RELATION_COMPILE_FAILED", `引用了不存在的列表项：${reference}`, { pageTitle: parsedPage.title });
  }
  return point;
}

function machineLiteralAllowed(path) {
  const parts = decodePointer(path);
  const key = parts.at(-1);
  const parent = parts.at(-2) ?? "";
  return key === "id"
    || key === "from"
    || key === "to"
    || /Id$/.test(key)
    || (/^\d+$/.test(key) && /Ids$/.test(parent))
    || ["balanceState", "cellMode", "focusQuadrant", "showDefinitionRail", "intensity"].includes(key)
    || parts.includes("adjacency");
}

function binaryAdjacency(value) {
  if (!Array.isArray(value)) return value === 0 || value === 1;
  return value.length <= 12 && value.every(binaryAdjacency);
}

function machineLiteralValueAllowed(path, value) {
  const parts = decodePointer(path);
  const key = parts.at(-1);
  if (parts.includes("adjacency")) return binaryAdjacency(value);
  if (["focusQuadrant", "intensity"].includes(key)) return Number.isInteger(value);
  if (key === "showDefinitionRail") return typeof value === "boolean";
  return typeof value === "string";
}

const HUMAN_RELATION_FIELDS = new Set([
  "title", "body", "label", "name", "role", "portrait", "condition", "outcome",
  "trigger", "assumption", "highlight", "value", "marker", "cornerLabel",
  "internalTitle", "externalTitle",
]);

function referenceTargetAllowed(path, reference) {
  const parts = decodePointer(path);
  const key = parts.at(-1);
  const parent = parts.at(-2) ?? "";
  const idReference = String(reference).endsWith(".id");
  if (idReference) {
    return key === "id" || key === "from" || key === "to" || /Id$/.test(key)
      || (/^\d+$/.test(key) && /Ids$/.test(parent));
  }
  return HUMAN_RELATION_FIELDS.has(key);
}

function compileRelationBindings(bindings, page, parsedPage) {
  if (!bindings) return undefined;
  if (typeof bindings.type !== "string" || !bindings.type) {
    fail("CONTENT_RELATION_COMPILE_FAILED", `页面“${page.title}”的 relationBindings 缺少 type`);
  }
  const structuredData = { type: bindings.type };
  for (const literal of bindings.literals ?? []) {
    if (!machineLiteralAllowed(literal.path) || !machineLiteralValueAllowed(literal.path, literal.value)) {
      fail("CONTENT_RELATION_COMPILE_FAILED", `relationBindings 不允许在元数据重复正文：${literal.path}`);
    }
    setPointer(structuredData, literal.path, literal.value);
  }
  for (const reference of bindings.references ?? []) {
    if (!referenceTargetAllowed(reference.path, reference.ref)) {
      fail("CONTENT_RELATION_COMPILE_FAILED", `relationBindings 引用不能写入该目标字段：${reference.path}`);
    }
    setPointer(structuredData, reference.path, referenceValue(reference.ref, page, parsedPage));
  }
  return structuredData;
}

export function compileContentDirectorDraft(rawMarkdown, draft, { repairMode = false } = {}) {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    fail("CONTENT_METADATA_MISMATCH", "内容导演输出必须是 Markdown 内容稿与机器元数据组成的对象");
  }
  const parsed = parseContentDirectorMarkdown(draft.contentMarkdown);
  const metadata = Array.isArray(draft.pageMetadata) ? draft.pageMetadata : [];
  if (metadata.length !== parsed.pages.length) {
    fail("CONTENT_METADATA_MISMATCH", `Markdown 有 ${parsed.pages.length} 个 H1 页面，但 pageMetadata 有 ${metadata.length} 项`, {
      markdownPages: parsed.pages.length,
      metadataPages: metadata.length,
    });
  }
  const repairActions = [];
  const normalizedMetadata = metadata.map((page, index) => ({
    ...page,
    pageId: `page-${String(index + 1).padStart(2, "0")}`,
  }));
  const sourceRecords = locatePageSources(rawMarkdown, normalizedMetadata);
  normalizedMetadata.forEach((metadataPage, index) => {
    metadataPage.sourceAnchors = sourceRecords[index].sourceAnchors;
  });
  const pageContents = parsed.pages.map((parsedPage, index) => {
    const meta = normalizedMetadata[index];
    if (meta.itemMetadata && meta.itemMetadata.length !== parsedPage.itemBlocks.length) {
      fail("CONTENT_METADATA_MISMATCH", `页面“${parsedPage.title}”有 ${parsedPage.itemBlocks.length} 个 H2，但 itemMetadata 有 ${meta.itemMetadata.length} 项`);
    }
    const items = parsedPage.itemBlocks.map((block, itemIndex) => ({
      ...parseItemBlock(block, meta.pageId, itemIndex),
      ...(meta.itemMetadata?.[itemIndex]?.emphasis !== undefined
        ? { emphasis: meta.itemMetadata[itemIndex].emphasis }
        : {}),
      ...(meta.itemMetadata?.[itemIndex]?.polarity
        ? { polarity: meta.itemMetadata[itemIndex].polarity }
        : {}),
    }));
    const page = {
      schemaVersion: "1.0",
      pageId: meta.pageId,
      title: parsedPage.title,
      logicIntent: meta.logicIntent,
      items,
      sourceText: sourceRecords[index].sourceText,
    };
    let structuredData;
    try {
      structuredData = compileRelationBindings(meta.relationBindings, page, parsedPage);
    } catch (error) {
      if (!repairMode || error?.code !== "CONTENT_RELATION_COMPILE_FAILED") throw error;
      repairActions.push({
        pageId: page.pageId,
        type: "drop-invalid-optional-relation-bindings",
        message: error.message,
      });
      delete meta.relationBindings;
    }
    if (structuredData) page.structuredData = structuredData;
    let evidence = page.logicIntent?.evidenceFragments ?? [];
    const invalidEvidence = evidence.filter((fragment) => !page.sourceText.includes(fragment));
    if (repairMode && invalidEvidence.length) {
      const valid = evidence.filter((fragment) => page.sourceText.includes(fragment));
      const canonical = meta.sourceAnchors.filter((anchor) => page.sourceText.includes(anchor));
      evidence = [...new Set([...valid, ...canonical])].slice(0, 3);
      page.logicIntent = { ...page.logicIntent, evidenceFragments: evidence };
      meta.logicIntent = page.logicIntent;
      repairActions.push({
        pageId: page.pageId,
        type: "canonicalize-logic-evidence",
        replaced: invalidEvidence,
        evidenceFragments: evidence,
      });
    }
    if (evidence.some((fragment) => !page.sourceText.includes(fragment))) {
      fail("CONTENT_METADATA_MISMATCH", `页面“${page.title}”的 Logic 证据不在来源锚点覆盖范围内`, {
        pageId: page.pageId,
        evidenceFragments: evidence,
      });
    }
    return page;
  });
  const deck = draft.deckMetadata ?? {};
  for (const [field, label] of [
    ["title", "整套标题"],
    ["centralTakeaway", "整套核心结论"],
  ]) {
    if (typeof deck[field] !== "string" || !deck[field].trim()) {
      fail("CONTENT_METADATA_MISMATCH", `deckMetadata 缺少${label}`);
    }
  }
  if (!Array.isArray(deck.narrativeArc) || !deck.narrativeArc.length
    || deck.narrativeArc.some((item) => typeof item !== "string" || !item.trim())) {
    fail("CONTENT_METADATA_MISMATCH", "deckMetadata.narrativeArc 必须包含整套叙事阶段");
  }
  const deckPlan = {
    schemaVersion: "1.0",
    deckId: deck.deckId,
    title: deck.title,
    communicationJob: deck.communicationJob,
    audience: deck.audience,
    audienceOutcome: deck.audienceOutcome,
    centralTakeaway: deck.centralTakeaway,
    narrativeArc: deck.narrativeArc,
    pages: parsed.pages.map((page, index) => ({
      pageId: normalizedMetadata[index].pageId,
      sequence: index + 1,
      narrativeJob: page.narrativeJob,
      sourceAnchors: normalizedMetadata[index].sourceAnchors,
    })),
  };
  return {
    deckPlan,
    pageContents,
    contentDraftMarkdown: parsed.source,
    contentMetadata: {
      schemaVersion: draft.schemaVersion,
      deckMetadata: draft.deckMetadata,
      pageMetadata: normalizedMetadata,
    },
    contentRepairReport: {
      schemaVersion: "1.0",
      status: repairActions.length ? "repaired" : "unchanged",
      actions: repairActions,
    },
  };
}
