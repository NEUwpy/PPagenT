import fs from "node:fs/promises";

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(new URL(relativePath, import.meta.url), "utf8"));
}

const deckPlan = await readJson("./run-r2/content/attempt-01/deck-plan.json");
const pageContents = await readJson("./run-r2/content/attempt-01/page-contents.json");
const visualPlan = await readJson("./run-r2/visual/attempt-01/visual-plan.json");
const compositionPlan = await readJson("./run-r2/visual/attempt-01/composition-plan.json");
const bodyPageIds = new Set(deckPlan.pages.map((page) => page.pageId));
visualPlan.pages = visualPlan.pages.filter((page) => bodyPageIds.has(page.pageId));
compositionPlan.pages = compositionPlan.pages.filter((page) => bodyPageIds.has(page.pageId));

for (const page of visualPlan.pages) {
  if (page.pageId === "p6") delete page.iconQueries;
}

export default {
  metadata: {
    providerKind: "saved-director-output-replay",
    sourceRun: "run-r2",
    purpose: "verify icon-source contract fix without another API call",
  },
  async contentDirector() {
    return structuredClone({ deckPlan, pageContents });
  },
  async visualDirector() {
    return structuredClone({ visualPlan, compositionPlan });
  },
};
