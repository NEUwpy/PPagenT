import { enrichPageIntent } from "../content/page-content.mjs";

const SHELL_ROLES = Object.freeze({
  "shell-cover": "cover",
  "shell-agenda": "agenda",
  "shell-closing": "closing",
});

export function shellRoleForPage(page) {
  return SHELL_ROLES[page?.pageId] ?? null;
}

export function isShellPage(page) {
  return Boolean(shellRoleForPage(page));
}

function compactAgendaLabel(value) {
  const text = String(value ?? "").trim();
  const semanticTail = text.split(/[：:]/).at(-1)?.trim() || text;
  return Array.from(semanticTail).slice(0, 22).join("");
}

function agendaItems(deckPlan) {
  const labels = deckPlan.narrativeArc
    .map(compactAgendaLabel)
    .filter(Boolean)
    .slice(0, 5);
  return labels.map((title, index) => ({
    id: `agenda-${index + 1}`,
    title,
    body: "",
  }));
}

function shellPlanPage(pageId, sequence, narrativeJob, anchor) {
  return {
    pageId,
    sequence,
    narrativeJob,
    sourceAnchors: [anchor],
  };
}

export function applyAcademicReportShellScaffold(contentOutput) {
  const bodyPages = contentOutput.pageContents.filter((page) => !isShellPage(page));
  const bodyPlanPages = contentOutput.deckPlan.pages.filter((page) => !SHELL_ROLES[page.pageId]);
  const firstAnchor = bodyPlanPages[0]?.sourceAnchors?.[0] ?? contentOutput.deckPlan.title;
  const lastAnchor = bodyPlanPages.at(-1)?.sourceAnchors?.[0] ?? firstAnchor;
  const agenda = agendaItems(contentOutput.deckPlan);
  const cover = {
    schemaVersion: "1.0",
    pageId: "shell-cover",
    title: contentOutput.deckPlan.title,
    items: [],
  };
  const agendaPage = {
    schemaVersion: "1.0",
    pageId: "shell-agenda",
    title: "目录",
    items: agenda,
  };
  const closing = {
    schemaVersion: "1.0",
    pageId: "shell-closing",
    title: "",
    items: [{
      id: "closing-takeaway",
      title: "",
      body: contentOutput.deckPlan.centralTakeaway,
      emphasis: true,
    }],
  };
  const pageContents = [cover, agendaPage, ...bodyPages, closing];
  const pages = [
    shellPlanPage("shell-cover", 1, "封面", firstAnchor),
    shellPlanPage("shell-agenda", 2, "目录", firstAnchor),
    ...bodyPlanPages.map((page, index) => ({ ...page, sequence: index + 3 })),
    shellPlanPage("shell-closing", pageContents.length, "收束", lastAnchor),
  ];
  return {
    deckPlan: { ...contentOutput.deckPlan, pages },
    pageContents,
  };
}

function shellIntentDraft(page, role) {
  const purposeKey = {
    cover: "present_cover",
    agenda: "present_agenda",
    closing: "present_closing",
  }[role];
  return {
    intentId: `${page.pageId}-intent`,
    purposeKey,
    purposeText: { cover: "呈现演示标题", agenda: "呈现演示目录", closing: "收束整套演示" }[role],
    baseRelation: "none",
    relationTraits: {
      temporal: false,
      cyclic: false,
      converging: false,
      branched: false,
      dimensions: 1,
      secondaryDimension: "none",
    },
    structure: {
      itemCount: page.items.length,
      ordered: role === "agenda",
      sameLevel: true,
      dimensions: { items: page.items.length },
    },
    density: "low",
    emphasis: [],
    evidenceTypes: ["text"],
    confidence: 1,
    assumptions: ["该页由 Shell 固定提供，不进入正文视觉导演选择"],
  };
}

export function buildShellIntent(page) {
  const role = shellRoleForPage(page);
  if (!role) throw new Error(`${page?.pageId ?? "<unknown>"} 不是 Shell 页面`);
  return enrichPageIntent(shellIntentDraft(page, role), page);
}

export function shellVisualSelection({ deckId, skinId, page, intent, candidateSet }) {
  const role = shellRoleForPage(page);
  if (!role) throw new Error(`${page.pageId} 不是 Shell 页面`);
  if (candidateSet.candidates.length !== 1) {
    throw new Error(`${page.pageId} 的 Shell 候选必须唯一，实际为 ${candidateSet.candidates.length}`);
  }
  const candidate = candidateSet.candidates[0];
  const compositionId = {
    cover: "fixed-cover",
    agenda: "fixed-agenda",
    closing: "fixed-closing",
  }[role];
  if (!candidate.compositionIds.includes(compositionId)) {
    throw new Error(`${page.pageId} 缺少固定 Composition：${compositionId}`);
  }
  return {
    visualPage: {
      pageId: page.pageId,
      intentId: intent.intentId,
      familyId: candidate.familyId,
      variantId: candidate.variantId,
      silhouette: candidate.silhouette,
      adaptationStatus: candidate.adaptationStatus,
      reason: `由 ${role} Shell 固定提供`,
    },
    compositionPage: {
      pageId: page.pageId,
      intentId: intent.intentId,
      compositionId,
      componentItemIds: [],
      componentContentMode: "none",
      textSlots: [],
      reason: `由 ${role} Shell 固定提供`,
    },
  };
}
