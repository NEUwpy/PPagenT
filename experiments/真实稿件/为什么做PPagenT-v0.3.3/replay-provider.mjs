import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const experimentDir = path.dirname(fileURLToPath(import.meta.url));
const directorDir = path.join(experimentDir, "director");
const replayLock = JSON.parse(await fs.readFile(path.join(experimentDir, "replay-lock.json"), "utf8"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(directorDir, relativePath), "utf8"));
}

async function assertFileHash(relativePath, expected) {
  const actual = sha256(JSON.stringify(JSON.parse(await fs.readFile(path.join(experimentDir, relativePath), "utf8"))));
  if (actual !== expected) throw new Error(`冻结导演产物哈希不一致：${relativePath}`);
}

await Promise.all(Object.entries(replayLock.artifacts).map(([relativePath, expected]) => assertFileHash(relativePath, expected)));
const [deckPlan, pageContents, pageIntents, visualPlan] = await Promise.all([
  readJson("content-attempt-01/deck-plan.json"),
  readJson("content-attempt-01/page-contents.json"),
  readJson("visual-attempt-01/page-intents.json"),
  readJson("visual-attempt-01/visual-plan.json"),
]);

export default {
  metadata: replayLock.provider,

  async contentDirector({ rawMarkdown }) {
    const normalized = Buffer.from(rawMarkdown.replaceAll("\r\n", "\n"), "utf8");
    if (sha256(normalized) !== replayLock.sourceSha256) {
      throw new Error("原稿哈希与冻结导演产物不一致；必须重新调用内容导演");
    }
    return { deckPlan: structuredClone(deckPlan), pageContents: structuredClone(pageContents) };
  },

  async visualDirector({ phase }) {
    if (phase === "intent") return { pageIntents: structuredClone(pageIntents) };
    if (phase === "composition") return { visualPlan: structuredClone(visualPlan) };
    throw new Error(`未知视觉导演阶段：${phase}`);
  },
};
