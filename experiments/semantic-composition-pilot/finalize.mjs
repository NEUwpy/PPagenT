import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { finalizePresentation } = await import(pathToFileURL("C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations/container_tools/artifact_tool_utils.mjs").href);

const workspaceDir = path.resolve(import.meta.dirname);
const skillDir = "C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations";
const runtimePython = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
const candidatePath = path.join(workspaceDir, "final", "semantic-composition-pilot-final-20260909.pptx");
const finalPath = path.join(workspaceDir, "final", "semantic-composition-pilot-validated-20260909.pptx");
const stagingDir = path.join(workspaceDir, ".codex-finalizer-20260909");
const receiptPath = path.join(stagingDir, "semantic-composition-pilot-validated-20260909.validation.json");
await fs.mkdir(stagingDir, { recursive: true });

const result = await finalizePresentation({
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: runtimePython,
  integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  explicitTotalSlideCount: 3,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  fontPolicy: { basis: "design", families: ["HYWenRunSongYun U", "Microsoft YaHei", "汉仪粗宋简"] },
  verifyArtifactToolImport: true,
  receiptPath,
});
console.log(JSON.stringify(result, null, 2));
