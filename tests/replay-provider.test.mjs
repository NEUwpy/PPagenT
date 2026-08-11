import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import replayProvider from "../experiments/真实稿件/为什么做PPagenT-v0.3.0/replay-provider.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("冻结回放拒绝与审查产物不一致的原稿", async () => {
  const rawMarkdown = await fs.readFile(path.join(root, "workbench", "manuscripts", "为什么做PPagenT-v1.md"), "utf8");
  await assert.doesNotReject(replayProvider.contentDirector({ rawMarkdown }));
  await assert.rejects(
    replayProvider.contentDirector({ rawMarkdown: `${rawMarkdown}\n修改` }),
    /原稿哈希与冻结导演产物不一致/,
  );
});
test("冻结回放拒绝与独立审查不一致的渲染证据", async () => {
  const wrongEvidence = Array.from({ length: 9 }, () => path.join(root, "workbench", "manuscripts", "为什么做PPagenT-v1.md"));
  await assert.rejects(
    replayProvider.visualReview({ stage: "post-render", attempt: 1, pageEvidence: wrongEvidence }),
    /渲染哈希已变化/,
  );
});
