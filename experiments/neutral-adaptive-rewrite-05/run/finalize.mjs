import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PresentationFile } from "@oai/artifact-tool";

const runDir = path.dirname(fileURLToPath(import.meta.url));
const skillDir = "C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations";
const workspaceDir = runDir;
const candidatePath = path.join(runDir, "build", "candidate.pptx");
const finalPath = path.join(runDir, "deliverables", "deck-v2.pptx");
const stagingDir = path.join(runDir, ".codex-finalizer-v2");
await fs.mkdir(stagingDir, { recursive: true });
await fs.mkdir(path.dirname(finalPath), { recursive: true });

const { finalizePresentation } = await import(pathToFileURL(
  path.join(skillDir, "container_tools/artifact_tool_utils.mjs"),
).href);

const receiptPath = path.join(stagingDir, "deck.validation.json");
const result = await finalizePresentation({
  explicitTotalSlideCount: 1,
  candidatePath,
  finalPath,
  workspaceDir,
  pythonExecutable: "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
  integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  fontPolicy: { basis: "design", families: ["Noto Serif SC", "Noto Sans SC"] },
  verifyArtifactToolImport: true,
  receiptPath,
});
await fs.writeFile(path.join(runDir, "evidence", "finalizer-result.json"), JSON.stringify(result, null, 2));
console.log(finalPath);
