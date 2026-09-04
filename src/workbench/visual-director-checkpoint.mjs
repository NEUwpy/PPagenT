import fs from "node:fs/promises";
import path from "node:path";
import { normalizeVisualCompositionOutput } from "../agent/model-director-provider.mjs";
import { expandVisualSkillRouting } from "../agent/visual-skill-router.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pageIds(value, field) {
  const pages = value?.[field]?.pages;
  if (!Array.isArray(pages)) throw new Error(`视觉导演输出缺少 ${field}.pages`);
  return pages.map((page) => page?.pageId);
}

export function validateVisualDirectorOutput(output, expectedPageIds = []) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new Error("视觉导演输出必须是 JSON 对象");
  }
  const visualPageIds = pageIds(output, "visualPlan");
  const compositionPageIds = pageIds(output, "compositionPlan");
  for (const [label, ids] of [["visualPlan", visualPageIds], ["compositionPlan", compositionPageIds]]) {
    if (ids.some((id) => typeof id !== "string" || !id)) throw new Error(`${label}.pages 中存在无效 pageId`);
    if (new Set(ids).size !== ids.length) throw new Error(`${label}.pages 中存在重复 pageId`);
  }
  if (visualPageIds.join("\n") !== compositionPageIds.join("\n")) {
    throw new Error("visualPlan 与 compositionPlan 的页面顺序不一致");
  }
  if (expectedPageIds.length && visualPageIds.join("\n") !== expectedPageIds.join("\n")) {
    throw new Error("人工修改不能增删页面或改变页面顺序");
  }
  return clone(output);
}

function visualKey(page) {
  return [
    page?.familyId,
    page?.variantId,
    page?.silhouette,
    page?.expressionSource?.sourceItemId ?? page?.structureSourceItemId ?? "page",
  ].join("::");
}

function routingCandidateId(candidate) {
  return [
    candidate?.familyId,
    candidate?.variantId,
    candidate?.silhouette,
    ...(candidate?.expressionSource?.sourceItemId ? [candidate.expressionSource.sourceItemId] : []),
  ].join("::");
}

export function rebuildChangedVisualSelections(output, originalOutput, input) {
  if (!Array.isArray(input?.candidateSets) || !input.candidateSets.length) return output;
  const originalVisual = new Map(originalOutput.visualPlan.pages.map((page) => [page.pageId, page]));
  const compositionById = new Map(output.compositionPlan.pages.map((page) => [page.pageId, page]));
  const candidateSetById = new Map((input.candidateSets ?? []).map((set) => [set.pageId, set]));
  const pageById = new Map((input.pageContents ?? []).map((page) => [page.pageId, page]));
  const changedPageIds = new Set();
  const selections = output.visualPlan.pages.map((page) => {
    const candidate = candidateSetById.get(page.pageId)?.candidates.find((item) => visualKey(item) === visualKey(page));
    if (!candidate) throw new Error(`${page.pageId} 选择的 Structure Group 不在该页合法候选中`);
    if (visualKey(originalVisual.get(page.pageId)) !== visualKey(page)) changedPageIds.add(page.pageId);
    const compositionPage = compositionById.get(page.pageId);
    const centerLabel = compositionPage?.componentText?.find((item) => item.targetRole === "center-title")?.text
      ?? pageById.get(page.pageId)?.title?.slice(0, 8)
      ?? page.pageId;
    return {
      pageId: page.pageId,
      candidateId: routingCandidateId(candidate),
      centerLabel,
      ...(page.expressionStrategy ? { expressionStrategy: page.expressionStrategy } : {}),
      ...(page.pageRole ? { pageRole: page.pageRole } : {}),
      ...(page.densityTarget ? { densityTarget: page.densityTarget } : {}),
      ...(page.visualWeight ? { visualWeight: page.visualWeight } : {}),
      ...(compositionPage?.compositionId ? { compositionId: compositionPage.compositionId } : {}),
      ...(page.compositionFamily ? { compositionFamily: page.compositionFamily } : {}),
      ...(page.continuityGroup ? { continuityGroup: page.continuityGroup } : {}),
      ...(page.contrastBreakBefore ? { contrastBreakBefore: true } : {}),
      ...(page.iconQueries ? { iconQueries: page.iconQueries } : {}),
      ...(compositionPage?.textLayoutChoices?.length ? { textLayoutChoices: compositionPage.textLayoutChoices } : {}),
      ...(page.reason ? { reason: page.reason } : {}),
    };
  });
  if (!changedPageIds.size) return normalizeVisualCompositionOutput(output, input);
  const rebuilt = normalizeVisualCompositionOutput(expandVisualSkillRouting({ selections }, input), input);
  const rebuiltVisual = new Map(rebuilt.visualPlan.pages.map((page) => [page.pageId, page]));
  const rebuiltComposition = new Map(rebuilt.compositionPlan.pages.map((page) => [page.pageId, page]));
  return normalizeVisualCompositionOutput({
    ...output,
    visualPlan: {
      ...output.visualPlan,
      pages: output.visualPlan.pages.map((page) => changedPageIds.has(page.pageId) ? rebuiltVisual.get(page.pageId) : page),
    },
    compositionPlan: {
      ...output.compositionPlan,
      pages: output.compositionPlan.pages.map((page) => changedPageIds.has(page.pageId) ? rebuiltComposition.get(page.pageId) : page),
    },
    routingDiagnostics: rebuilt.routingDiagnostics,
  }, input);
}

export function createVisualDirectorCheckpoint({ runDir, onAwaiting, onResumed } = {}) {
  const checkpointDir = path.join(runDir, "checkpoint");
  const checkpointPath = path.join(checkpointDir, "visual-director.json");
  let state = null;
  let resolvePending = null;
  let rejectPending = null;
  let readyPromise = Promise.resolve();

  async function persist() {
    await fs.mkdir(checkpointDir, { recursive: true });
    await fs.writeFile(checkpointPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  async function pause(input, output) {
    if (resolvePending) throw new Error("视觉导演表单调试暂停已经在等待确认");
    const expectedPageIds = (input?.pageContents ?? []).map((page) => page.pageId);
    const originalOutput = validateVisualDirectorOutput(output, expectedPageIds);
    state = {
      schemaVersion: "1.0",
      stage: "visual-director",
      status: "awaiting-user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expectedPageIds,
      input: clone({
        skinId: input?.skinId,
        deckPlan: input?.deckPlan,
        pageContents: input?.pageContents,
        pageIntents: input?.pageIntents,
        candidateSets: input?.candidateSets,
      }),
      originalOutput,
      editedOutput: null,
    };
    const awaitingState = clone(state);
    const pending = new Promise((resolve, reject) => {
      resolvePending = resolve;
      rejectPending = reject;
    });
    try {
      readyPromise = (async () => {
        await persist();
        await onAwaiting?.(awaitingState);
      })();
      await readyPromise;
      return pending;
    } catch (error) {
      resolvePending = null;
      rejectPending = null;
      throw error;
    }
  }

  async function submit(output) {
    await readyPromise;
    if (!state || state.status !== "awaiting-user" || !resolvePending) {
      const error = new Error("当前运行没有等待确认的视觉导演输出");
      error.statusCode = 409;
      throw error;
    }
    const editedOutput = rebuildChangedVisualSelections(
      validateVisualDirectorOutput(output, state.expectedPageIds),
      state.originalOutput,
      state.input,
    );
    const resolve = resolvePending;
    state = {
      ...state,
      status: "accepted",
      updatedAt: new Date().toISOString(),
      editedOutput,
    };
    const acceptedState = clone(state);
    await persist();
    await onResumed?.(acceptedState);
    resolvePending = null;
    rejectPending = null;
    resolve(editedOutput);
    return acceptedState;
  }

  async function cancel() {
    await readyPromise;
    if (!state || state.status !== "awaiting-user" || !rejectPending) {
      const error = new Error("当前运行没有可取消的视觉导演检查点");
      error.statusCode = 409;
      throw error;
    }
    state = { ...state, status: "cancelled", updatedAt: new Date().toISOString() };
    await persist();
    const reject = rejectPending;
    resolvePending = null;
    rejectPending = null;
    const error = new Error("用户删除了等待确认的运行");
    error.code = "WORKBENCH_RUN_CANCELLED";
    error.stage = "visual-director";
    reject(error);
    return clone(state);
  }

  return {
    checkpointPath,
    pause,
    submit,
    cancel,
    read: () => clone(state),
  };
}

export function withVisualDirectorCheckpoint(provider, checkpoint, prepareInput = (input) => input) {
  return {
    ...provider,
    metadata: provider.metadata,
    visualDirector: async (input) => checkpoint.pause(prepareInput(input), await provider.visualDirector(input)),
  };
}
