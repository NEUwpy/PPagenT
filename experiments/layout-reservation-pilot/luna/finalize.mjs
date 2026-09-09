import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const here = import.meta.dirname;
const root = path.resolve(here, "../../..");
const skillDir = "C:/Users/ilove/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations";
const pythonExecutable = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
process.env.RUNTIME_NODE = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe";
process.env.RUNTIME_NODE_MODULES = "C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
process.env.RUNTIME_PYTHON = pythonExecutable;
const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools/artifact_tool_utils.mjs")).href);
const stagingDir = path.join(root, ".build-validation", "layout-reservation-pilot");
await fs.mkdir(stagingDir, { recursive: true });

const fontPolicy = {
  basis: "design",
  families: ["HYWenRunSongYun U", "Microsoft YaHei", "汉仪粗宋简"],
};

for (const run of ["revision-02"]) {
  const candidatePath = path.join(here, `layout-reservation-luna-high-${run}.pptx`);
  const finalPath = path.join(here, `layout-reservation-luna-high-${run}-validated.pptx`);
  const receiptPath = path.join(stagingDir, `${run}.validation.json`);
  const result = await finalizePresentation({
    workspaceDir: root,
    candidatePath,
    finalPath,
    pythonExecutable,
    integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
    layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
    layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
    requirements: { explicitTotalSlideCount: 3, requiredNativeTableOwnerSlides: [], requiredNativeChartOwnerSlides: [] },
    explicitTotalSlideCount: 3,
    requiredNativeTableOwnerSlides: [],
    requiredNativeChartOwnerSlides: [],
    fontPolicy,
    verifyArtifactToolImport: true,
    receiptPath,
  });
  await fs.writeFile(path.join(here, `validation-${run}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ run, finalPath, receiptPath }, null, 2));
}
