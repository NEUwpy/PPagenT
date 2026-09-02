function nonBlank(value) {
  return /\S/.test(String(value ?? ""));
}

/**
 * Build stable paragraph-level source references without changing the source.
 * IDs are positional within one normalized manuscript and are never persisted
 * as cross-run identifiers.
 */
export function buildSourceBlocks(rawMarkdown) {
  const source = String(rawMarkdown ?? "");
  const lines = [...source.matchAll(/.*(?:\r?\n|$)/g)]
    .filter((match) => match[0].length > 0);
  const blocks = [];
  let start = null;
  let end = null;

  const flush = () => {
    if (start === null || end === null) return;
    const text = source.slice(start, end).trim();
    if (text) {
      blocks.push({
        id: `source-${String(blocks.length + 1).padStart(3, "0")}`,
        text,
        start,
        end,
      });
    }
    start = null;
    end = null;
  };

  for (const match of lines) {
    const line = match[0];
    const content = line.replace(/\r?\n$/, "");
    if (!nonBlank(content)) {
      flush();
      continue;
    }
    if (start === null) start = match.index;
    end = match.index + content.length;
  }
  flush();
  return blocks;
}

export function sourceBlocksForModel(rawMarkdown) {
  return buildSourceBlocks(rawMarkdown).map(({ id, text }) => ({ id, text }));
}
