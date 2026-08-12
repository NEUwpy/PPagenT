// PowerPoint 的东亚断行会忽略 U+2060；U+FEFF 在 OOXML 中保持零宽且禁止换行。
const WORD_JOINER = "\uFEFF";
const ZH_WORD_SEGMENTER = new Intl.Segmenter("zh-CN", { granularity: "word" });

function joinCharacters(value) {
  return [...value].join(WORD_JOINER);
}

/**
 * 在不改动可见文字的前提下，保护中文词语、数量短语与行内标点，
 * 避免 PowerPoint 把“这些”“个人”“六十字”或顿号拆到两行。
 */
export function protectChineseLineBreaks(value) {
  const source = String(value ?? "");
  const segmented = [...ZH_WORD_SEGMENTER.segment(source)]
    .map(({ segment, isWordLike }) => (
      isWordLike && /\p{Script=Han}/u.test(segment) && [...segment].length > 1
        ? joinCharacters(segment)
        : segment
    ))
    .join("");

  return segmented
    .replace(/[一二三四五六七八九十百千万两〇零\d](?:\uFEFF?[一二三四五六七八九十百千万两〇零\d])*\uFEFF?字/gu,
      (match) => joinCharacters(match.replaceAll(WORD_JOINER, "")))
    .replace(/([\p{Script=Han}\dA-Za-z])([、，。：；！？])(?=[\p{Script=Han}\dA-Za-z])/gu, `$1${WORD_JOINER}$2${WORD_JOINER}`);
}

function textUnits(value) {
  return [...value].reduce((total, char) => {
    if (/\s/u.test(char)) return total + 0.3;
    if (/^[\x00-\x7F]$/u.test(char)) return total + 0.55;
    return total + 1;
  }, 0);
}

function semanticTwoLineWrap(value, maxUnits) {
  const source = String(value ?? "").trim();
  if (!source || textUnits(source) <= maxUnits) return source;
  const chars = [...source];
  const candidates = [];
  chars.forEach((char, index) => {
    if (!/[，。：；！？]/u.test(char) || index >= chars.length - 1) return;
    const left = chars.slice(0, index + 1).join("");
    const right = chars.slice(index + 1).join("");
    const leftUnits = textUnits(left);
    const rightUnits = textUnits(right);
    const shorterRatio = Math.min(leftUnits, rightUnits) / Math.max(1, leftUnits + rightUnits);
    if (leftUnits <= maxUnits && rightUnits <= maxUnits && shorterRatio >= 0.2) {
      candidates.push({ left, right, score: Math.abs(leftUnits - rightUnits) });
    }
  });
  if (candidates.length) {
    candidates.sort((a, b) => a.score - b.score);
    return `${candidates[0].left}\n${candidates[0].right}`;
  }
  return wrapChineseText(source, maxUnits);
}

/**
 * 用 Skin 声明的离散字号档位，把中文文本放进已知容器。
 * 这不是无限缩字：只尝试角色允许的字号，仍放不下时返回 fits=false，
 * 由上层换版式、拆页或失败关闭。
 */
export function fitChineseTextToFrame(value, {
  width,
  height,
  fontSizes,
  maxLines,
  lineHeight = 1.15,
  glyphWidthFactor = 0.95,
  preferSemanticBreaks = false,
} = {}) {
  const source = String(value ?? "");
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error("文字适配需要有效的容器宽高");
  }
  if (!Array.isArray(fontSizes) || !fontSizes.length || fontSizes.some((size) => !Number.isFinite(size) || size <= 0)) {
    throw new Error("文字适配需要至少一个有效字号档位");
  }
  if (!Number.isInteger(maxLines) || maxLines < 1) throw new Error("文字适配需要正整数 maxLines");

  const sizes = [...new Set(fontSizes)].sort((a, b) => b - a);
  let fallback = null;
  for (const fontSize of sizes) {
    const maxUnits = width / (fontSize * glyphWidthFactor);
    const paragraphs = source.split(/\r?\n/);
    const text = paragraphs.map((paragraph) => (
      preferSemanticBreaks
        ? semanticTwoLineWrap(paragraph, maxUnits)
        : wrapChineseText(paragraph, maxUnits)
    )).join("\n");
    const lines = text.split("\n");
    const widest = Math.max(0, ...lines.map((line) => textUnits(line)));
    const result = {
      text,
      fontSize,
      lineCount: lines.length,
      maxUnits,
      fits: lines.length <= maxLines
        && widest <= maxUnits + 0.5
        && lines.length * fontSize * lineHeight <= height,
    };
    fallback = result;
    if (result.fits) return result;
  }
  return fallback;
}

function lineTokens(value) {
  const tokens = [];
  for (const { segment } of ZH_WORD_SEGMENTER.segment(String(value ?? ""))) {
    if (!segment) continue;
    if (/^\s+$/u.test(segment) || /^[、，。：；！？,.!?)]$/u.test(segment)) {
      if (tokens.length) tokens[tokens.length - 1] += segment;
      else tokens.push(segment);
      continue;
    }
    if (/^[字页章节项个]$/u.test(segment)
      && tokens.length
      && /[一二三四五六七八九十百千万两〇零\d]$/u.test(tokens[tokens.length - 1])) {
      tokens[tokens.length - 1] += segment;
      continue;
    }
    tokens.push(segment);
  }
  return tokens;
}

/**
 * 按组件的真实容量做词语感知的均衡断行。输出可见换行，不插入隐藏字符，
 * 因而 PowerPoint、PDF 与 PNG 的排版结果保持一致。
 */
export function wrapChineseText(value, maxUnits) {
  const tokens = lineTokens(value);
  if (!tokens.length || !Number.isFinite(maxUnits) || maxUnits <= 0) return String(value ?? "");
  const total = tokens.reduce((sum, token) => sum + textUnits(token), 0);
  const lineCount = Math.max(1, Math.ceil(total / maxUnits));
  if (lineCount === 1) return tokens.join("");

  const prefix = [0];
  tokens.forEach((token) => prefix.push(prefix.at(-1) + textUnits(token)));
  const target = total / lineCount;
  const memo = new Map();
  function solve(start, linesLeft) {
    const key = `${start}:${linesLeft}`;
    if (memo.has(key)) return memo.get(key);
    if (linesLeft === 1) {
      const width = prefix[tokens.length] - prefix[start];
      const result = { cost: (width - target) ** 2 + Math.max(0, width - maxUnits - 1) ** 2 * 100, cuts: [] };
      memo.set(key, result);
      return result;
    }
    let best = null;
    const lastCut = tokens.length - (linesLeft - 1);
    for (let end = start + 1; end <= lastCut; end += 1) {
      const width = prefix[end] - prefix[start];
      const rest = solve(end, linesLeft - 1);
      const overflow = Math.max(0, width - maxUnits - 1);
      const cost = (width - target) ** 2 + overflow ** 2 * 100 + rest.cost;
      if (!best || cost < best.cost) best = { cost, cuts: [end, ...rest.cuts] };
    }
    memo.set(key, best);
    return best;
  }
  const { cuts } = solve(0, Math.min(lineCount, tokens.length));
  const lines = [];
  let start = 0;
  for (const end of [...cuts, tokens.length]) {
    lines.push(tokens.slice(start, end).join("").trim());
    start = end;
  }
  return lines.join("\n");
}
