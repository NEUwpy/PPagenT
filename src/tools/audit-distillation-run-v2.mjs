import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDistillationContractValidators } from "../distillation/contracts.mjs";
import { inspectDistillationRunFromDisk } from "../distillation/governance.mjs";

class CliArgumentError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CliArgumentError";
    this.code = code;
  }
}

export function parseArgs(argv) {
  const options = { root: ".", runDir: null, reviewStatePath: undefined };
  const allowed = new Set(["--root", "--run-dir", "--review-state"]);
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!allowed.has(argument)) {
      throw new CliArgumentError("CLI_UNKNOWN_ARGUMENT", `unknown argument: ${argument}`);
    }
    if (seen.has(argument)) {
      throw new CliArgumentError("CLI_DUPLICATE_ARGUMENT", `argument provided more than once: ${argument}`);
    }
    seen.add(argument);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new CliArgumentError("CLI_ARGUMENT_VALUE_MISSING", `missing value for ${argument}`);
    }
    index += 1;
    if (argument === "--root") options.root = value;
    else if (argument === "--run-dir") options.runDir = value;
    else options.reviewStatePath = value;
  }
  if (!options.runDir) throw new CliArgumentError("CLI_RUN_DIR_REQUIRED", "--run-dir is required");
  return options;
}

function resultOutput(result) {
  const status = result?.status ?? "failed";
  const acceptedAssetIds = status === "passed" && Array.isArray(result?.acceptedAssetIds)
    ? [...result.acceptedAssetIds]
    : [];
  return {
    status,
    promotionEligible: acceptedAssetIds.length > 0,
    acceptedAssetIds,
    runId: result?.runId ?? null,
    packContentDigest: result?.packContentDigest ?? null,
    issues: Array.isArray(result?.issues) ? result.issues : [],
  };
}

function errorOutput(error) {
  return {
    status: "error",
    promotionEligible: false,
    acceptedAssetIds: [],
    runId: null,
    packContentDigest: null,
    issues: [],
    error: {
      code: error?.code ?? "DISTILLATION_RUN_AUDIT_ERROR",
      message: error?.message ?? String(error),
    },
  };
}

export async function main(argv = process.argv.slice(2), {
  createValidators = createDistillationContractValidators,
  inspectRun = inspectDistillationRunFromDisk,
} = {}) {
  try {
    const options = parseArgs(argv);
    const root = path.resolve(options.root);
    const validators = await createValidators(root);
    const result = await inspectRun({
      repoRoot: root,
      runDir: options.runDir,
      validators,
      ...(options.reviewStatePath ? { reviewStatePath: options.reviewStatePath } : {}),
    });
    const output = resultOutput(result);
    return { exitCode: output.status === "passed" ? 0 : 1, output };
  } catch (error) {
    return { exitCode: 1, output: errorOutput(error) };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await main();
  process.stdout.write(`${JSON.stringify(result.output, null, 2)}\n`);
  process.exitCode = result.exitCode;
}
