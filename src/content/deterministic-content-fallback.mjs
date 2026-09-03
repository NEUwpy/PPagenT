import { buildSourceBlocks } from "./source-blocks.mjs";

const PAGE_CHAR_TARGET = 180;
const ITEM_CHAR_TARGET = 68;

function chars(value) {
  return Array.from(String(value ?? ""));
}

function clip(value, limit) {
  return chars(value).slice(0, limit).join("").trim();
}

function cleanMarkdown(value) {
  return String(value ?? "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .trim();
}

function splitLongBlock(source, block) {
  const textStart = source.indexOf(block.text, block.start);
  if (textStart < 0 || chars(block.text).length <= PAGE_CHAR_TARGET) {
    return [{ start: block.start, end: block.end, text: block.text }];
  }
  const pieces = [];
  let cursor = 0;
  while (cursor < block.text.length) {
    let end = Math.min(block.text.length, cursor + PAGE_CHAR_TARGET);
    if (end < block.text.length) {
      const window = block.text.slice(cursor, end);
      const punctuation = Math.max(
        window.lastIndexOf("。"), window.lastIndexOf("！"), window.lastIndexOf("？"),
        window.lastIndexOf("；"), window.lastIndexOf("\n"),
      );
      if (punctuation >= Math.floor(PAGE_CHAR_TARGET * 0.55)) end = cursor + punctuation + 1;
    }
    const piece = block.text.slice(cursor, end).trim();
    if (piece) {
      const localStart = block.text.indexOf(piece, cursor);
      pieces.push({
        start: textStart + localStart,
        end: textStart + localStart + piece.length,
        text: piece,
      });
    }
    cursor = end;
  }
  return pieces;
}

function sourceUnits(rawMarkdown) {
  const source = String(rawMarkdown ?? "");
  return buildSourceBlocks(source).flatMap((block) => splitLongBlock(source, block));
}

function displayFragments(sourceText) {
  const cleaned = cleanMarkdown(sourceText);
  const sentences = cleaned.split(/(?<=[。！？；])|\n+/u).map((item) => item.trim()).filter(Boolean);
  const atoms = sentences.flatMap((sentence) => {
    const sourceChars = chars(sentence);
    const pieces = [];
    let cursor = 0;
    while (cursor < sourceChars.length) {
      let end = Math.min(sourceChars.length, cursor + ITEM_CHAR_TARGET);
      if (end < sourceChars.length) {
        const window = sourceChars.slice(cursor, end);
        let punctuation = -1;
        for (let index = window.length - 1; index >= Math.floor(ITEM_CHAR_TARGET * 0.55); index -= 1) {
          if (/[，、；：,;:]/u.test(window[index])) {
            punctuation = index;
            break;
          }
        }
        if (punctuation >= 0) end = cursor + punctuation + 1;
      }
      const piece = sourceChars.slice(cursor, end).join("").trim();
      if (piece) pieces.push(piece);
      cursor = end;
    }
    return pieces;
  });
  const groups = [];
  for (const atom of atoms) {
    if (!groups.length || chars(groups.at(-1)).length + chars(atom).length > ITEM_CHAR_TARGET) groups.push(atom);
    else groups[groups.length - 1] += atom;
  }
  return groups;
}

function itemFromFragment(fragment, pageId, index) {
  const plain = cleanMarkdown(fragment);
  const colon = plain.search(/[：:]/);
  const title = clip(colon > 0 && colon <= 12 ? plain.slice(0, colon) : plain, 10) || `内容${index + 1}`;
  const bodyStart = colon > 0 && colon <= 12 ? colon + 1 : Math.min(plain.length, title.length);
  const body = clip(plain.slice(bodyStart).trim() || plain, ITEM_CHAR_TARGET);
  return { id: `${pageId}-item-${index + 1}`, title, body };
}

function titleFrom(value, fallback) {
  const first = cleanMarkdown(value).split(/\r?\n|[。！？]/u).find((item) => item.trim());
  return clip(first || fallback, 24) || fallback;
}

/**
 * Last-resort, extractive content plan. It never invents facts and deliberately
 * uses editorial pages so the theme body renderer can always take over.
 */
export function buildDeterministicContentFallback(rawMarkdown, { reason = "内容导演输出无法通过确定性校验" } = {}) {
  const source = String(rawMarkdown ?? "");
  const units = sourceUnits(source);
  if (!units.length) throw new Error("原稿没有可用于确定性兜底的正文");
  const deckTitle = titleFrom(source, "演示文稿");
  const pageContents = units.map((unit, index) => {
    const pageId = `fallback-${String(index + 1).padStart(2, "0")}`;
    const fragments = displayFragments(unit.text);
    const anchor = clip(unit.text, 160);
    return {
      schemaVersion: "1.0",
      pageId,
      title: titleFrom(unit.text, `第${index + 1}页`),
      logicIntent: {
        logicId: "editorial",
        reason: "确定性兜底保留原稿内容，不推断额外逻辑关系",
        evidenceFragments: [anchor],
        confidence: "high",
      },
      items: (fragments.length ? fragments : [unit.text]).map((fragment, itemIndex) => (
        itemFromFragment(fragment, pageId, itemIndex)
      )),
      notes: `PPagenT确定性内容兜底=true；原因=${reason}`,
      sourceText: unit.text,
    };
  });
  const deckPlan = {
    schemaVersion: "1.0",
    deckId: "deterministic-content-fallback",
    title: deckTitle,
    communicationJob: "忠实呈现原稿的主要内容",
    audience: "原稿目标受众",
    audienceOutcome: "理解原稿中的主要信息",
    centralTakeaway: clip(cleanMarkdown(source), 80) || deckTitle,
    narrativeArc: pageContents.map((page) => page.title),
    pages: pageContents.map((page, index) => ({
      pageId: page.pageId,
      sequence: index + 1,
      narrativeJob: `忠实呈现原稿第 ${index + 1} 个内容单元`,
      sourceAnchors: [page.logicIntent.evidenceFragments[0]],
    })),
  };
  return {
    deckPlan,
    pageContents,
    contentRepairReport: {
      schemaVersion: "1.0",
      status: "deterministic-fallback",
      actions: [{ type: "replace-invalid-content-output", reason }],
    },
  };
}
