import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const taskDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceDir = taskDir;
const skillDir = "C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations";
const candidatePath = path.join(taskDir, "final", "deck-candidate.pptx");
const finalPath = path.join(taskDir, "final", "deck.pptx");
const stagingDir = path.join(taskDir, "checks", "finalizer");
await fs.mkdir(stagingDir, { recursive:true });
const templatePath = path.join("C:/PPagenT", "assets", "主题", "东北大学-001", "runtime-template.pptx");
const templateBytes = await fs.readFile(templatePath);
const templateSha256 = (await import("node:crypto")).createHash("sha256").update(templateBytes).digest("hex");
const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir,"container_tools","artifact_tool_utils.mjs")).href);
const result = await finalizePresentation({
  explicitTotalSlideCount: 6,
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
  integrityValidatorPath: path.join(skillDir,"container_tools","inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir,"container_tools","inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu","12192000,6858000","--validate-bullet-geometry","--validate-heading-fit"],
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir,"deck.validation.json"),
});
console.log(JSON.stringify(result,null,2));
