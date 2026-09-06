import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContentDraftFromProject,
  contentProjectStatus,
  createContentProject,
  upsertContentProjectPages,
} from "./content-project.mjs";

test("内容项目支持逐页新增与同 key 定向覆盖", () => {
  let project = createContentProject({
    deckId: "demo",
    title: "演示",
    communicationJob: "说明",
    audience: "听众",
    audienceOutcome: "理解",
    centralTakeaway: "结论",
    narrativeArc: ["问题", "结论"],
  });
  const page = {
    pageKey: "opening",
    title: "第一版",
    claim: "主旨",
    logicIntent: { logicId: "editorial", reason: "说明", evidenceFragments: ["原文"], confidence: "high" },
    sourceBlockIds: ["source-001"],
    items: [{ title: "节点", body: "正文", points: [] }],
  };
  project = upsertContentProjectPages(project, [page]);
  project = upsertContentProjectPages(project, [{ ...page, title: "修订版" }]);
  assert.equal(project.pages.length, 1);
  assert.equal(project.pages[0].title, "修订版");
  assert.equal(contentProjectStatus(project).pageCount, 1);
  const draft = buildContentDraftFromProject(project);
  assert.match(draft.contentMarkdown, /^# 修订版/m);
  assert.equal(draft.pageMetadata.length, 1);
});
