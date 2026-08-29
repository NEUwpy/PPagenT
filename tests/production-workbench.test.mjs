import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import JSZip from "jszip";
import { DeepSeekJsonModel } from "../src/agent/deepseek-director-provider.mjs";
import { normalizeManuscript } from "../src/workbench/manuscript-normalizer.mjs";
import { createTraceRecorder, readTraceEvents } from "../src/workbench/trace-recorder.mjs";

async function tempDir(t) {
  const target = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-workbench-"));
  t.after(() => fs.rm(target, { recursive: true, force: true }));
  return target;
}

test("工作台保留 Markdown 原稿并拒绝伪装支持旧版 DOC", async (t) => {
  const root = await tempDir(t);
  const input = path.join(root, "稿件.md");
  await fs.writeFile(input, "# 标题\n\n正文\n", "utf8");
  const normalized = await normalizeManuscript({ inputPath: input, originalName: "稿件.md" });
  assert.equal(normalized.rawMarkdown, "# 标题\n\n正文\n");
  await assert.rejects(
    normalizeManuscript({ inputPath: input, originalName: "旧稿.doc" }),
    /另存为 \.docx/,
  );
});

test("DOCX 规范化保留标题、列表与表格语义", async (t) => {
  const root = await tempDir(t);
  const target = path.join(root, "中文稿件.docx");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>项目标题</w:t></w:r></w:p><w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>第一项</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>阶段</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>任务</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>一</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>理解</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>`);
  await fs.writeFile(target, await zip.generateAsync({ type: "nodebuffer" }));
  const normalized = await normalizeManuscript({ inputPath: target, originalName: "中文稿件.docx" });
  assert.match(normalized.rawMarkdown, /项目标题/);
  assert.match(normalized.rawMarkdown, /第一项/);
  assert.match(normalized.rawMarkdown, /阶段/);
  assert.match(normalized.rawMarkdown, /理解/);
});

test("运行追踪把大对象外置并屏蔽 API Key", async (t) => {
  const root = await tempDir(t);
  const recorder = createTraceRecorder(root);
  await recorder.observe({ source: "model", type: "api-call", status: "running", stage: "content-director", apiKey: "secret", context: { source: "稿件" } });
  await recorder.flush();
  const events = await readTraceEvents(root);
  assert.equal(events.length, 1);
  assert.equal(events[0].detailPath, "trace/event-0001.json");
  const detail = JSON.parse(await fs.readFile(path.join(root, events[0].detailPath), "utf8"));
  assert.equal(detail.apiKey, "[REDACTED]");
  assert.deepEqual(detail.context, { source: "稿件" });
});

test("DeepSeek 观察口区分真实 HTTP 尝试并保留 usage", async () => {
  const events = [];
  const model = new DeepSeekJsonModel({
    apiKey: "test-key",
    observer: async (event) => events.push(event),
    fetchImpl: async () => ({
      ok: true,
      async json() { return { choices: [{ message: { content: "{\"ok\":true}" } }], usage: { total_tokens: 12 } }; },
    }),
  });
  await model.generateJson({ role: "PPagenT 内容导演", task: "测试", context: { source: "稿件" }, outputSchema: { name: "test", schema: { type: "object" } } });
  assert.deepEqual(events.map((event) => event.status), ["running", "succeeded"]);
  assert.equal(events[1].usage.total_tokens, 12);
  assert.equal("apiKey" in events[0], false);
});
