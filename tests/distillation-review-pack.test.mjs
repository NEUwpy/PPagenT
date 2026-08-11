import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createDistillationContractValidators, digestJson } from "../src/distillation/contracts.mjs";
import { buildReviewPack } from "../src/distillation/review-pack.mjs";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await fs.readFile(
  path.join(root, "tests", "fixtures", "distillation", "case-manifest.valid.json"),
  "utf8",
));
const validators = await createDistillationContractValidators(root);
const digest = (character) => `sha256:${character.repeat(64)}`;

function artifact(role, artifactPath, character = "a") {
  return { role, path: artifactPath, digest: digest(character), sizeBytes: 100 };
}

function reportFor(sourceManifest = manifest) {
  return {
    schemaVersion: "2.0",
    batchId: sourceManifest.batchId,
    manifestDigest: digestJson(sourceManifest),
    status: "passed",
    inputs: [artifact("case-manifest", "case-manifest.json", "e")],
    artifacts: [],
    cases: sourceManifest.cases.map((item) => {
      const paramsDigest = digestJson(item.params);
      if (item.expected.outcome === "rejection") {
        const rejection = { outcome: "rejection", paramsDigest, errorCode: item.expected.errorCode };
        return {
          caseId: item.caseId,
          assetId: item.assetId,
          paramsDigest,
          status: "passed",
          contexts: { standalone: { ...rejection }, skin: { ...rejection } },
        };
      }
      const context = (name) => ({
        outcome: "render",
        paramsDigest,
        slideNumber: item.slides[name],
        evidence: {
          deck: artifact(`${name}-deck`, sourceManifest.contexts[name].deck, name === "skin" ? "b" : "a"),
          png: artifact(`${name}-png`, `evidence/${name}/slide-${String(item.slides[name]).padStart(2, "0")}.png`, "c"),
          layout: artifact(`${name}-layout`, `evidence/${name}/slide-${String(item.slides[name]).padStart(2, "0")}.layout.json`, "d"),
          checksPassed: true,
        },
      });
      return {
        caseId: item.caseId,
        assetId: item.assetId,
        paramsDigest,
        status: "passed",
        contexts: { standalone: context("standalone"), skin: context("skin") },
      };
    }),
    issues: [],
  };
}

function input() {
  const sourceManifest = structuredClone(manifest);
  const validationReport = reportFor(sourceManifest);
  return {
    manifest: sourceManifest,
    validationReport,
    validators,
    freshness: {
      status: "passed",
      runId: "organization-tree-001-v2-run-001",
      reportDigest: digestJson(validationReport),
      inputDigest: digest("e"),
    },
    bindings: {
      decks: {
        standalone: artifact("standalone-deck", sourceManifest.contexts.standalone.deck, "a"),
        skin: artifact("skin-deck", sourceManifest.contexts.skin.deck, "b"),
      },
      validationReport: artifact("validation-report", "workbench/distillation/runs/organization-tree-001-v2.0.0/validation-report.json", "d"),
      sources: sourceManifest.assets.map((asset) => ({
        assetId: asset.assetId,
        artifact: artifact("source-pptx", asset.source.pptx, "c"),
        pages: [...asset.source.slides],
      })),
      aesthetics: sourceManifest.assets.map((asset) => ({
        assetId: asset.assetId,
        artifact: artifact("aesthetics-note", `workbench/distillation/runs/organization-tree-001-v2.0.0/${asset.assetId}-aesthetics.md`, "d"),
      })),
      pairedOverview: artifact("paired-overview", "workbench/distillation/runs/organization-tree-001-v2.0.0/paired-overview.png", "e"),
      maintainerCases: sourceManifest.cases.map((item) => ({
        caseId: item.caseId,
        assetId: item.assetId,
        status: "passed",
        summary: "语义、几何与证据已复核",
      })),
    },
  };
}

test("review pack consumes the v2 contract and pairs render cases in manifest order", () => {
  const result = buildReviewPack(input());
  assert.deepEqual(result.index.cases.map((item) => item.caseId), ["org-d2-short", "org-d3-normal"]);
  assert.deepEqual(result.index.cases.map((item) => item.standalone.pageNumber), [1, 2]);
  assert.deepEqual(result.index.cases.map((item) => item.skin.pageNumber), [1, 2]);
  assert.equal(result.index.cases[0].standalone.png.path, "evidence/standalone/slide-01.png");
  assert.equal(result.index.cases[0].standalone.png.digest, digest("c"));
  assert.deepEqual(result.index.summary, {
    assetCount: 1,
    renderCaseCount: 2,
    pairedRenderCount: 2,
    rejectionCaseCount: 1,
  });
  assert.equal(Object.hasOwn(result.index.summary, "reviewState"), false);
  assert.equal(Object.hasOwn(result.index.summary, "acceptedAssetCount"), false);
  assert.equal(result.index.runId, "organization-tree-001-v2-run-001");
  assert.equal(result.index.reportDigest, digestJson(input().validationReport));
  assert.equal(result.index.inputDigest, digest("e"));
  const { packContentDigest, ...content } = result.index;
  assert.equal(packContentDigest, digestJson(content));
  assert.equal(result.index.artifacts.sources[0].pages[0], 406);
  assert.equal(result.index.cases[0].maintainer.status, "passed");
});

test("review pack emits Chinese pair links, rejection codes, and unchecked asset gates", () => {
  const { markdown } = buildReviewPack(input());
  assert.match(markdown, /Standalone（左） \| Skin（右）/);
  assert.match(markdown, /\[PNG\]\(<evidence\/standalone\/slide-01\.png>\)/);
  assert.match(markdown, /ORG_TREE_DEPARTMENT_COUNT/);
  assert.equal((markdown.match(/- \[ \] 用户复核入口：/gu) ?? []).length, 1);
  assert.equal(markdown.includes("- [ ] 用户确认："), false);
  assert.match(markdown, /包内勾选不构成批准/);
  assert.match(markdown, /外部 review-state/);
  assert.match(markdown, /packContentDigest/);
  assert.match(markdown, /第 406 页/);
  assert.match(markdown, /美学说明/);
  assert.match(markdown, /维护者逐案结果/);
  assert.match(markdown, /已通过：语义、几何与证据已复核/);
});

test("review pack fails closed on a semantically failed report or missing pair", () => {
  const failed = input();
  failed.validationReport.status = "failed";
  failed.validationReport.issues = [{ code: "qa-failed", message: "QA failed" }];
  assert.throws(
    () => buildReviewPack(failed),
    (error) => error?.code === "REVIEW_PACK_VALIDATION_NOT_PASSED",
  );

  const missingPair = input();
  const source = missingPair.validationReport.cases[0];
  source.contexts.skin = {
    outcome: "rejection",
    paramsDigest: source.paramsDigest,
    errorCode: "UNEXPECTED_ERROR",
  };
  source.status = "failed";
  missingPair.validationReport.status = "failed";
  missingPair.validationReport.issues = [{ caseId: source.caseId, code: "render-case-rejected", message: "missing Skin" }];
  assert.throws(
    () => buildReviewPack(missingPair),
    (error) => error?.code === "REVIEW_PACK_VALIDATION_NOT_PASSED",
  );
});

test("review pack fails closed on wrong manifest page numbers and rejection codes", () => {
  const wrongSlide = input();
  wrongSlide.manifest.cases[0].slides.skin = 2;
  assert.throws(
    () => buildReviewPack(wrongSlide),
    (error) => error?.code === "REVIEW_PACK_MANIFEST_NOT_PASSED"
      || error?.code === "REVIEW_PACK_VALIDATION_NOT_PASSED",
  );

  const wrongRejection = input();
  const rejection = wrongRejection.validationReport.cases.find((item) => item.caseId === "org-d5-rejected");
  rejection.contexts.skin.errorCode = "WRONG_ERROR";
  assert.throws(
    () => buildReviewPack(wrongRejection),
    (error) => error?.code === "REVIEW_PACK_VALIDATION_NOT_PASSED",
  );
});

test("review pack rejects evidence paths that escape the project", () => {
  const escaped = input();
  escaped.validationReport.cases[0].contexts.standalone.evidence.png.path = "../slide-01.png";
  escaped.freshness.reportDigest = digestJson(escaped.validationReport);
  assert.throws(
    () => buildReviewPack(escaped),
    (error) => error?.code === "REVIEW_PACK_EVIDENCE_PATH_INVALID",
  );
});

test("review pack requires freshness and every unified package component", () => {
  const stale = input();
  stale.freshness.status = "failed";
  assert.throws(
    () => buildReviewPack(stale),
    (error) => error?.code === "REVIEW_PACK_FRESHNESS_NOT_PASSED",
  );

  const missingCases = [
    ["decks", (value) => { delete value.bindings.decks.skin; }],
    ["validation-report", (value) => { delete value.bindings.validationReport; }],
    ["source", (value) => { value.bindings.sources = []; }],
    ["aesthetics", (value) => { value.bindings.aesthetics = []; }],
    ["overview", (value) => { delete value.bindings.pairedOverview; }],
    ["maintainer", (value) => { value.bindings.maintainerCases.pop(); }],
  ];
  for (const [label, mutate] of missingCases) {
    const value = input();
    mutate(value);
    assert.throws(() => buildReviewPack(value), undefined, label);
  }
});
