import fs from "node:fs/promises";
import path from "node:path";
import {
  collectVisualSkillDashboardData,
  defaultProjectRoot,
} from "./visual-skill-dashboard-data.mjs";

const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(defaultProjectRoot, "docs", "架构", "PPagenT-Visual-Skill-建设看板.html");
const templatePath = path.join(import.meta.dirname, "templates", "visual-skill-dashboard.html");
const data = await collectVisualSkillDashboardData(defaultProjectRoot);
const template = await fs.readFile(templatePath, "utf8");
const serialized = JSON.stringify({ ...data, mode: "static-snapshot" }).replaceAll("<", "\\u003c");
const output = template.replace("/*__PPAGENT_DATA__*/", `const DATA = ${serialized};`);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, output, "utf8");

console.log(JSON.stringify({
  status: "passed",
  mode: "static-snapshot",
  output: outputPath,
  coreAssets: data.summary.coreAssets,
  formalSkills: data.summary.formalSkills,
  candidateOnly: data.summary.candidateOnly,
}, null, 2));
