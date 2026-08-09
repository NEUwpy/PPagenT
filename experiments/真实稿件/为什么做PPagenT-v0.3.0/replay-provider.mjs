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

async function assertFileHash(relativePath, expected) {
  const target = path.join(experimentDir, relativePath);
  const actual = sha256(JSON.stringify(JSON.parse(await fs.readFile(target, "utf8"))));
  if (actual !== expected) throw new Error(`冻结回放产物哈希不一致：${relativePath}`);
}

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(directorDir, relativePath), "utf8"));
}

const [deckPlan, pageContents, contentReview, pageIntents, visualPlan, preReview, postReview] = await Promise.all([
  readJson("content-attempt-06/deck-plan.json"),
  readJson("content-attempt-06/page-contents.json"),
  readJson("content-attempt-06/content-review.json"),
  readJson("visual-attempt-02/page-intents-draft.json"),
  readJson("visual-attempt-08/visual-plan.json"),
  readJson("visual-attempt-08/visual-review-pre.json"),
  readJson("visual-attempt-08/visual-review-post.json"),
]);
await Promise.all(Object.entries(replayLock.artifacts).map(([relativePath, expected]) => assertFileHash(relativePath, expected)));

function replayReview(review, attempt, stage = null) {
  return {
    ...structuredClone(review),
    reviewId: `${review.deckId}-${stage ?? "content"}-replay-${String(attempt).padStart(2, "0")}`,
    attempt,
    ...(stage ? { stage } : {}),
  };
}

/**
 * 把已经由独立导演与审查者完成的最终轮次接到正式单入口，
 * 用于证明产品入口只接收“原稿 + Skin”，而非人工 pages JSON。
 */
export default {
  metadata: replayLock.provider,

  async contentDirector({ rawMarkdown }) {
    if (sha256(Buffer.from(rawMarkdown.replaceAll("\r\n", "\n"), "utf8")) !== replayLock.sourceSha256) {
      throw new Error("原稿哈希与冻结导演产物不一致；必须重新调用真实导演和审查者");
    }
    return { deckPlan: structuredClone(deckPlan), pageContents: structuredClone(pageContents) };
  },

  async contentReview({ attempt }) {
    return replayReview(contentReview, attempt);
  },

  async visualDirector({ phase }) {
    if (phase === "intent") return { pageIntents: structuredClone(pageIntents) };
    if (phase === "composition") return { visualPlan: structuredClone(visualPlan) };
    throw new Error(`未知视觉导演阶段：${phase}`);
  },

  async visualReview({ stage, attempt, pageEvidence = [] }) {
    if (stage === "pre-render") return replayReview(preReview, attempt, stage);
    if (stage === "post-render") {
      if (pageEvidence.length !== replayLock.pageEvidence.length) throw new Error("渲染证据页数与冻结审查不一致");
      for (let index = 0; index < pageEvidence.length; index += 1) {
        const actual = sha256(await fs.readFile(path.resolve(pageEvidence[index])));
        if (actual !== replayLock.pageEvidence[index]) {
          throw new Error(`第 ${index + 1} 页渲染哈希已变化；冻结视觉审查不能复用`);
        }
      }
      return replayReview(postReview, attempt, stage);
    }
    throw new Error(`未知视觉审查阶段：${stage}`);
  },
};
