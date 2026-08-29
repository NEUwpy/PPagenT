import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  inspectAssetManifestContract,
  normalizeFormalAssetManifest,
} from "../src/runtime/asset-manifest-contract.mjs";
import { inspectAssetIntakeState } from "../src/runtime/asset-intake-state.mjs";

const assetId = "causal-intake-fixture";
const logicMap = {
  logics: [{ id: "causal", name: "因果与归因", assetIds: [] }],
};

function manifest(status = "pending-review") {
  return {
    id: assetId,
    name: "因果入库夹具",
    kind: "component",
    category: "结构图",
    status,
    generator: "generate.mjs",
    showcase: "example.pptx",
    runtime: {
      renderer: "html-component",
      entry: "runtime.mjs",
      componentExport: "visualComponent",
      mapperExport: "mapPageContent",
      logicId: "causal",
      structureGroupId: "causal-intake",
      familyId: "causal",
      variantId: "trigger-mediators-outcome",
      silhouette: "causal-chain",
      supportedBaseRelations: ["causal"],
      supportedPurposeKeys: ["analyze_causes"],
      itemCount: { min: 2, preferred: [3], max: 4 },
      contentContract: { itemRole: "causal-mediator", points: "forbidden" },
      contract: {
        abstractionLevel: "foundation",
        adaptationStatus: "adaptive",
        constraints: { relationTraits: {}, density: ["medium"] },
      },
    },
  };
}

async function prepareDirectory() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ppagent-intake-"));
  await Promise.all([
    fs.writeFile(path.join(directory, "visual-intent.md"), "# intent\n", "utf8"),
    fs.writeFile(path.join(directory, "runtime.mjs"), "export const placeholder = true;\n", "utf8"),
    fs.writeFile(path.join(directory, "generate.mjs"), "export const placeholder = true;\n", "utf8"),
    fs.writeFile(path.join(directory, "example.pptx"), "fixture", "utf8"),
    fs.writeFile(path.join(directory, "html-approval.json"), JSON.stringify({
      schemaVersion: "1.0", assetId, decision: "approved", scope: "html-golden",
    }), "utf8"),
    fs.writeFile(path.join(directory, "user-approval.json"), JSON.stringify({
      schemaVersion: "1.0", assetId, decision: "approved", scope: "html-golden-and-native",
    }), "utf8"),
    fs.writeFile(path.join(directory, "slot-contract.json"), JSON.stringify({
      schemaVersion: 3, assetId, status: "ready", states: [], variants: [],
    }), "utf8"),
  ]);
  return directory;
}

test("入库收尾把资产专属角色规范为正式 semantic-node 接口", () => {
  const invalid = manifest();
  assert.equal(inspectAssetManifestContract(invalid).valid, false);
  const normalized = normalizeFormalAssetManifest(invalid);
  assert.equal(normalized.runtime.contentContract.itemRole, "semantic-node");
  assert.equal(inspectAssetManifestContract(normalized).valid, true);
});

test("两轮审批与契约齐全后仍保持待注册，注册完成才成为一致核心状态", async () => {
  const directory = await prepareDirectory();
  try {
    const normalized = normalizeFormalAssetManifest(manifest());
    const ready = await inspectAssetIntakeState({ asset: normalized, assetDir: directory, logicMap });
    assert.equal(ready.stage, "ready-to-register");
    assert.equal(ready.readyToRegister, true);
    assert.equal(ready.coreConsistent, false);

    const registeredMap = structuredClone(logicMap);
    registeredMap.logics[0].assetIds.push(assetId);
    const core = await inspectAssetIntakeState({
      asset: { ...normalized, status: "core" },
      assetDir: directory,
      logicMap: registeredMap,
    });
    assert.equal(core.stage, "core");
    assert.equal(core.coreConsistent, true);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("直接把非法声明改成 core 会被状态机拒绝", async () => {
  const directory = await prepareDirectory();
  try {
    const state = await inspectAssetIntakeState({ asset: manifest("core"), assetDir: directory, logicMap });
    assert.equal(state.stage, "invalid-core");
    assert.equal(state.coreConsistent, false);
    assert.ok(state.readinessIssues.some((issue) => issue.includes("itemRole")));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("AssetContract schema errors block registration before promotion", async () => {
  const directory = await prepareDirectory();
  try {
    const normalized = normalizeFormalAssetManifest(manifest());
    normalized.runtime.contract.constraints.relationTraits = { mediation: true };
    const state = await inspectAssetIntakeState({
      asset: normalized,
      assetDir: directory,
      logicMap,
      root: path.resolve(import.meta.dirname, ".."),
    });
    assert.equal(state.stage, "blocked-before-registration");
    assert.equal(state.readyToRegister, false);
    assert.ok(state.readinessIssues.some((issue) => issue.startsWith("AssetContract:")));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
