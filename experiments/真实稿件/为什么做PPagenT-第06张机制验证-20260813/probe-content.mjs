import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import provider from "../../../src/agent/deepseek-provider-from-env.mjs";

const experimentDir = path.dirname(fileURLToPath(import.meta.url));
const rawMarkdown = await fs.readFile(path.join(experimentDir, "第06张验证稿.md"), "utf8");
const result = await provider.contentDirector({
  rawMarkdown,
  skinId: "northeastern-university",
  attempt: 1,
  previous: null,
  previousReview: null,
});
await fs.writeFile(
  path.join(experimentDir, "probe-content-output.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify(result.pageContents, null, 2)}\n`);
