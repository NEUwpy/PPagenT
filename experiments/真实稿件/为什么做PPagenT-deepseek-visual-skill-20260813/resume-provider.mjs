import fs from "node:fs/promises";
import path from "node:path";
import deepseekProvider from "../../../src/agent/deepseek-provider-from-env.mjs";

const here = import.meta.dirname;
const contentDir = path.join(here, "run-02", "content", "attempt-01");
const [deckPlan, pageContents] = await Promise.all([
  fs.readFile(path.join(contentDir, "deck-plan.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(contentDir, "page-contents.json"), "utf8").then(JSON.parse),
]);

export default {
  ...deepseekProvider,
  metadata: {
    ...deepseekProvider.metadata,
    contentMode: "resume-live-deepseek-output",
    contentSource: "run-02/content/attempt-01",
  },
  async contentDirector() {
    return { deckPlan: structuredClone(deckPlan), pageContents: structuredClone(pageContents) };
  },
};
