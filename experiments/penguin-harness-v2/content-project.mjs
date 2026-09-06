function cleanText(value) {
  return String(value ?? "").trim();
}

function markdownText(value) {
  return cleanText(value).replace(/\r\n?/g, "\n");
}

export function createContentProject(deckMetadata) {
  return {
    schemaVersion: "1.0",
    deckMetadata: structuredClone(deckMetadata),
    pages: [],
  };
}

export function upsertContentProjectPages(project, incomingPages) {
  const next = structuredClone(project);
  const byKey = new Map(next.pages.map((page, index) => [page.pageKey, index]));
  for (const page of incomingPages) {
    const normalized = {
      pageKey: cleanText(page.pageKey),
      title: cleanText(page.title),
      claim: cleanText(page.claim),
      logicIntent: structuredClone(page.logicIntent),
      sourceBlockIds: [...page.sourceBlockIds],
      items: page.items.map((item) => ({
        title: cleanText(item.title),
        body: cleanText(item.body),
        points: (item.points ?? []).map(cleanText).filter(Boolean),
      })),
    };
    const existing = byKey.get(normalized.pageKey);
    if (existing === undefined) {
      byKey.set(normalized.pageKey, next.pages.length);
      next.pages.push(normalized);
    } else {
      next.pages[existing] = normalized;
    }
  }
  return next;
}

export function contentProjectStatus(project) {
  return {
    initialized: Boolean(project?.deckMetadata),
    pageCount: project?.pages?.length ?? 0,
    pages: (project?.pages ?? []).map((page, index) => ({
      index: index + 1,
      pageKey: page.pageKey,
      title: page.title,
      logicId: page.logicIntent?.logicId ?? null,
      itemCount: page.items.length,
      visibleChars: page.items.reduce((sum, item) => (
        sum + Array.from([item.title, item.body, ...item.points].filter(Boolean).join("\n")).length
      ), 0),
    })),
  };
}

export function buildContentDraftFromProject(project) {
  if (!project?.deckMetadata) throw new Error("内容项目尚未初始化");
  if (!project.pages?.length) throw new Error("内容项目没有正文页");
  const contentMarkdown = project.pages.map((page) => {
    const blocks = [`# ${markdownText(page.title)}`, `> ${markdownText(page.claim)}`];
    for (const item of page.items) {
      blocks.push(`## ${markdownText(item.title)}`);
      if (item.body) blocks.push(markdownText(item.body));
      if (item.points.length) blocks.push(item.points.map((point) => `- ${markdownText(point)}`).join("\n"));
    }
    return blocks.join("\n\n");
  }).join("\n\n");
  return {
    schemaVersion: "1.0",
    deckMetadata: structuredClone(project.deckMetadata),
    contentMarkdown,
    pageMetadata: project.pages.map((page) => ({
      logicIntent: structuredClone(page.logicIntent),
      sourceBlockIds: [...page.sourceBlockIds],
    })),
  };
}
