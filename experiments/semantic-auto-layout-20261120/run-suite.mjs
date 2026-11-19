import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { bindingKey, onSlideFields } from "../gray-compiler-20261120/validate.mjs";
import { deriveExpression } from "./express.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const experiment = path.dirname(fileURLToPath(import.meta.url));
const shared = fileURLToPath(new URL("../content-to-expression-20261120/inputs/", import.meta.url));
const { values, positionals } = parseArgs({ allowPositionals: true, options: { "verify-only": { type: "boolean" } } });
assert(positionals.length <= 1);
const target = path.resolve(positionals[0] ?? path.join(experiment, "output"));
assert.notEqual(target, experiment);
if (!values["verify-only"]) await fs.mkdir(target);

const runs = [
  { name: "hr", source: "hr", width: 1280, height: 720 },
  { name: "options", source: "options", width: 1280, height: 720 },
  { name: "duty", source: "duty", width: 1280, height: 720 },
  { name: "procurement", source: "procurement", width: 1280, height: 720 },
  { name: "hr-narrow", source: "hr", width: 1020, height: 720 },
  { name: "duty-narrow", source: "duty", width: 900, height: 720 },
  { name: "duty-tall", source: "duty", width: 720, height: 800, rejected: ["baseline"] },
  { name: "pressure", source: "hr", width: 720, height: 420, rejected: ["baseline", "bands"] },
];
const readJson = async (...segments) => JSON.parse(await fs.readFile(path.join(...segments), "utf8"));
const contentBySource = new Map();
const checkRecords = [];

for (const { name, source, width, height, rejected = [] } of runs) {
  const origin = path.join(shared, source + ".json");
  const resultDir = path.join(target, name);
  if (!values["verify-only"]) {
    const result = spawnSync(process.execPath, [path.join(experiment, "compile.mjs"), origin, "--out",
      resultDir, "--width", String(width), "--height", String(height)], { encoding: "utf8", cwd: repository });
    assert.equal(result.status, rejected.length ? 1 : 0, result.stdout + result.stderr);
  }
  const summary = await readJson(resultDir, "summary.json");
  const original = await fs.readFile(origin);
  assert.equal(summary.inputSha256, createHash("sha256").update(original).digest("hex"));
  assert.deepEqual(await fs.readFile(path.join(resultDir, "content.json")), original);
  const content = JSON.parse(original);
  contentBySource.set(source, content);
  const expression = await readJson(resultDir, "expression.json");
  const expectedFields = onSlideFields(content.page).map(({ field }) => bindingKey(field.text, field.sourceIds)).sort();
  const records = {};

  for (const [route, evaluation] of Object.entries(summary.routes)) {
    const routeDir = path.join(resultDir, route);
    const report = await readJson(routeDir, "report.json");
    assert.equal(evaluation.status, rejected.includes(route) ? "rejected" : "passed", name + "/" + route);
    assert.equal(report.status, evaluation.status);
    if (evaluation.status === "rejected") {
      await fs.access(path.join(routeDir, "rejected.html"));
      await fs.access(path.join(routeDir, "rejected.png"));
      const failures = [...new Set(report.candidates.flatMap(({ errors }) => errors.map(({ code }) => code)))];
      assert(failures.includes("object-outside-body"));
      records[route] = { status: "rejected", checkedCandidates: report.candidates.length, failures };
      continue;
    }
    await fs.access(path.join(routeDir, "gray.html"));
    await fs.access(path.join(routeDir, "gray.png"));
    const layout = await readJson(routeDir, "layout.json");
    assert.deepEqual(layout.canvas, { width, height });
    assert.deepEqual(layout.texts.map(({ text, sourceIds }) => bindingKey(text, sourceIds)).sort(), expectedFields);
    assert.deepEqual(layout.notes, content.page.notes ?? []);
    assert.deepEqual(layout.readingOrder, layout.texts.map(({ id }) => id));
    assert.deepEqual(layout.groups.map(({ id }) => id), content.page.groups.map(({ id }) => "group:" + id));
    const bodySizes = layout.texts.filter(({ role }) => !["claim", "page-title"].includes(role))
      .map(({ typography }) => typography.sizePx);
    const minBodyPx = Math.min(...bodySizes);
    assert(minBodyPx >= 18);
    const objects = new Map(layout.objects.map((node) => [node.id, node]));
    for (const note of [...(content.page.scopeNotes ?? []), ...content.page.groups.flatMap(({ scopeNotes = [] }) => scopeNotes)]) {
      assert.deepEqual(objects.get("note:" + note.id)?.appliesTo, note.appliesTo);
    }
    const actualEdges = layout.objects.filter(({ connection }) => connection).map(({ connection }) => connection);
    for (const { itemId, links = [] } of expression.localRelations) {
      const { binding } = expression.decisions.find((decision) => decision.itemId === itemId);
      for (const { from, to } of links) {
        for (const id of from) assert(actualEdges.some((edge) => edge.from === binding[id] && edge.to === binding[to]));
      }
    }
    const anchorErrors = layout.objects.flatMap(({ path }) => path?.anchorError === undefined ? [] : [path.anchorError]);
    if (source === "hr") {
      assert(layout.objects.some(({ asset }) => asset === "convergence-many-to-one-003"));
      assert.equal(anchorErrors.length, 3);
      assert(anchorErrors.every((error) => error <= 0.5));
      assert.equal(actualEdges.length, 5);
    }
    if (source === "procurement") {
      assert.equal(actualEdges.length, 1);
      assert(actualEdges[0].from.startsWith("component:emergency-procedure:"));
      assert(actualEdges[0].to.startsWith("component:emergency-procedure:"));
    }
    if (route === "bands") {
      for (const rule of expression.crossCase) {
        const marker = objects.get("item:" + rule.id);
        assert.deepEqual(marker.appliesTo, rule.appliesTo);
        for (const id of rule.appliesTo) {
          const local = objects.get("item:" + id);
          assert(marker.bounds.x <= local.bounds.x && marker.bounds.x + marker.bounds.width >= local.bounds.x + local.bounds.width);
        }
      }
      if (name === "duty-tall") assert.deepEqual(layout.compilerLayout.rows.map((row) => row.length), [2, 1]);
      if (source === "procurement") assert.deepEqual(layout.compilerLayout.rows.flat().map(({ itemsAcross }) => itemsAcross), [3, 1]);
    }
    const bottom = Math.max(...layout.groups.map(({ bounds }) => bounds.y + bounds.height));
    records[route] = { status: "passed", selected: report.selected, checkedCandidates: report.candidates.length,
      widthsPx: layout.compilerLayout.columns, bodySpaceBelowGroupsPx: +(layout.frame.y + layout.frame.height - bottom).toFixed(1),
      minBodyPx, boundTextFields: expectedFields.length, localEdges: actualEdges.length,
      ...(anchorErrors.length ? { maxConvergenceAnchorErrorPx: Math.max(...anchorErrors) } : {}) };
  }
  checkRecords.push({ name, source, width, height, inputSha256: summary.inputSha256, routes: records });
  console.log(name, Object.fromEntries(Object.entries(records).map(([route, record]) => [route, record.status])));
}

const hr = contentBySource.get("hr");
const duty = contentBySource.get("duty");
for (const [field, value] of Object.entries({ layoutId: "columns", assetId: "asset", x: 0, fontSize: 18, column: 1, placement: {} })) {
  const invalid = structuredClone(hr);
  invalid.page.groups[0].items[0][field] = value;
  assert((await deriveExpression(invalid, repository)).errors.some(({ code }) => code === "content-validation"));
}
const invalidScope = structuredClone(duty);
invalidScope.page.scopeNotes[0].appliesTo = [invalidScope.page.groups[0].items[0].id];
assert((await deriveExpression(invalidScope, repository)).errors.some(({ code }) => code === "content-validation"));
const reordered = structuredClone(hr);
reordered.page.id = "same-content-different-id";
const sequence = reordered.page.groups.flatMap(({ items }) => items).find(({ detail }) => detail?.links?.[0]?.type === "precedes");
sequence.detail.nodes.reverse();
sequence.detail.links.reverse();
const originalPlan = await deriveExpression(hr, repository);
const reorderedPlan = await deriveExpression(reordered, repository);
assert.deepEqual(reorderedPlan.errors, []);
assert.deepEqual(reorderedPlan.plan.page.groups, originalPlan.plan.page.groups);
await fs.writeFile(path.join(target, "verification.json"), JSON.stringify({
  status: "passed", runs: checkRecords,
  inputGuards: { rejectsDesignFields: 6, rejectsScopeFromWrongLevel: true, localOrderFromEdges: true },
}, null, 2) + "\n");
