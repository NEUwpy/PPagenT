const PAGE_MARKER = /^(?:#{2,6}[ \t]+)?第[ \t]*([一二三四五六七八九十百零〇\d]+)[ \t]*页[ \t]*(?:[：:、.\-—][ \t]*)?([^\r\n]*)$/gm;

function maskFencedCode(source) {
  return source.replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\r\n]/g, " "));
}

function shellRoleForSemanticTitle(value) {
  const title = String(value ?? "").trim();
  if (/^(?:封面|首页|标题页)$/.test(title)) return "cover";
  if (/^(?:目录|议程)$/.test(title)) return "agenda";
  if (/^(?:结束语|尾页|结语|致谢)$/.test(title)) return "closing";
  return null;
}

function buildSection(source, matches, match, index, metadata) {
  const endIndex = matches[index + 1]?.index ?? source.length;
  const markerLine = source.slice(match.index, match.index + match[0].length).trimEnd();
  const sourceText = source.slice(match.index, endIndex).trim();
  const body = source.slice(match.index + match[0].length, endIndex).trim();
  return {
    sectionKey: `section-${index + 1}@${match.index}`,
    markerLine,
    headingLine: markerLine,
    heading: metadata.heading,
    semanticTitle: metadata.semanticTitle,
    markerKind: metadata.markerKind,
    pageNumber: metadata.pageNumber ?? null,
    shellRole: metadata.shellRole ?? null,
    headingLevel: metadata.headingLevel,
    body,
    sourceText,
    startIndex: match.index,
    endIndex,
  };
}

/**
 * Extract intended page/section units using one shared policy.
 * Explicit full-line "第X页" markers win. Otherwise the shallowest Markdown
 * body-heading level (H2-H6) defines sections, so nested headings do not split pages.
 */
export function extractManuscriptSections(rawMarkdown) {
  const source = String(rawMarkdown ?? "");
  const masked = maskFencedCode(source);
  const explicitMatches = [...masked.matchAll(PAGE_MARKER)];
  if (explicitMatches.length >= 1) {
    return explicitMatches.map((match, index) => {
      const markerLine = source.slice(match.index, match.index + match[0].length).trimEnd();
      const pageNumber = match[1].trim();
      const semanticTitle = match[2].trim();
      const heading = markerLine.replace(/^#{2,6}[ \t]+/, "").trim();
      const headingLevel = markerLine.match(/^(#{2,6})[ \t]+/)?.[1].length ?? 0;
      return buildSection(source, explicitMatches, match, index, {
        heading,
        semanticTitle,
        markerKind: "explicit-page",
        pageNumber,
        shellRole: shellRoleForSemanticTitle(semanticTitle),
        headingLevel,
      });
    });
  }

  const markdownMatches = [...masked.matchAll(/^(#{2,6})[ \t]+(.+?)[ \t]*$/gm)];
  if (!markdownMatches.length) return [];
  const shallowestLevel = Math.min(...markdownMatches.map((match) => match[1].length));
  const sectionMatches = markdownMatches.filter((match) => match[1].length === shallowestLevel);
  return sectionMatches.map((match, index) => buildSection(source, sectionMatches, match, index, {
    heading: match[2].trim(),
    semanticTitle: match[2].trim(),
    markerKind: "markdown-heading",
    headingLevel: match[1].length,
  }));
}
