import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { main, parseArgs } from "../src/tools/audit-distillation-run-v2.mjs";

test("CLI parser accepts the official arguments and rejects incomplete input", () => {
  assert.deepEqual(parseArgs([
    "--root", "C:/repo",
    "--run-dir", "workbench/run-001",
    "--review-state", "review-state.final.json",
  ]), {
    root: "C:/repo",
    runDir: "workbench/run-001",
    reviewStatePath: "review-state.final.json",
  });
  assert.throws(() => parseArgs([]), (error) => error?.code === "CLI_RUN_DIR_REQUIRED");
  assert.throws(
    () => parseArgs(["--run-dir"]),
    (error) => error?.code === "CLI_ARGUMENT_VALUE_MISSING",
  );
  assert.throws(
    () => parseArgs(["--run-dir", "run", "--unknown", "value"]),
    (error) => error?.code === "CLI_UNKNOWN_ARGUMENT",
  );
  assert.throws(
    () => parseArgs(["--run-dir", "run-a", "--run-dir", "run-b"]),
    (error) => error?.code === "CLI_DUPLICATE_ARGUMENT",
  );
});

test("pending governance may pass while remaining explicitly ineligible for promotion", async () => {
  const validatorMarker = { validator: true };
  let received;
  const result = await main(["--root", ".", "--run-dir", "run-001"], {
    createValidators: async () => validatorMarker,
    inspectRun: async (options) => {
      received = options;
      return {
        status: "passed",
        acceptedAssetIds: [],
        runId: "run-001",
        packContentDigest: "sha256:pending",
        issues: [],
      };
    },
  });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.output, {
    status: "passed",
    promotionEligible: false,
    acceptedAssetIds: [],
    runId: "run-001",
    packContentDigest: "sha256:pending",
    issues: [],
  });
  assert.equal(received.repoRoot, path.resolve("."));
  assert.equal(received.runDir, "run-001");
  assert.equal(received.validators, validatorMarker);
  assert.equal(Object.hasOwn(received, "reviewStatePath"), false);
});

test("only non-empty acceptedAssetIds make a passed run promotion eligible", async () => {
  let received;
  const result = await main([
    "--run-dir", "run-accepted",
    "--review-state", "review-state.accepted.json",
  ], {
    createValidators: async () => ({}),
    inspectRun: async (options) => {
      received = options;
      return { status: "passed", acceptedAssetIds: ["organization-tree-001"], issues: [] };
    },
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.output.promotionEligible, true);
  assert.deepEqual(result.output.acceptedAssetIds, ["organization-tree-001"]);
  assert.equal(received.reviewStatePath, "review-state.accepted.json");
});

test("failed governance cannot leak accepted assets and exits nonzero", async () => {
  const result = await main(["--run-dir", "run-failed"], {
    createValidators: async () => ({}),
    inspectRun: async () => ({
      status: "failed",
      acceptedAssetIds: ["must-not-leak"],
      issues: [{ code: "stale-input", message: "input changed" }],
    }),
  });
  assert.equal(result.exitCode, 1);
  assert.equal(result.output.status, "failed");
  assert.equal(result.output.promotionEligible, false);
  assert.deepEqual(result.output.acceptedAssetIds, []);
  assert.equal(result.output.issues.length, 1);
});

test("argument and governance exceptions become JSON-shaped errors with exit 1", async () => {
  const argumentFailure = await main([]);
  assert.equal(argumentFailure.exitCode, 1);
  assert.deepEqual(argumentFailure.output.acceptedAssetIds, []);
  assert.equal(argumentFailure.output.promotionEligible, false);
  assert.equal(argumentFailure.output.status, "error");
  assert.equal(argumentFailure.output.error.code, "CLI_RUN_DIR_REQUIRED");

  const governanceFailure = await main(["--run-dir", "missing-run"], {
    createValidators: async () => ({}),
    inspectRun: async () => {
      const error = new Error("manifest missing");
      error.code = "GOVERNANCE_MANIFEST_MISSING";
      throw error;
    },
  });
  assert.equal(governanceFailure.exitCode, 1);
  assert.equal(governanceFailure.output.status, "error");
  assert.equal(governanceFailure.output.error.code, "GOVERNANCE_MANIFEST_MISSING");
  assert.match(JSON.stringify(governanceFailure.output), /manifest missing/u);
});
