import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import liveProvider from "../../../src/agent/deepseek-provider-from-env.mjs";

const experimentDir = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(experimentDir, "run", "content", "attempt-03");
const savedContent = {
  deckPlan: JSON.parse(await fs.readFile(path.join(contentDir, "deck-plan.json"), "utf8")),
  pageContents: JSON.parse(await fs.readFile(path.join(contentDir, "page-contents.json"), "utf8")),
};

export default {
  ...liveProvider,
  metadata: {
    ...liveProvider.metadata,
    continuation: "saved-content-attempt-03",
  },
  async contentDirector() {
    return structuredClone(savedContent);
  },
};
