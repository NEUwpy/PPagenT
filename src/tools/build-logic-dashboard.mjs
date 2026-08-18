import fs from "node:fs/promises";
import path from "node:path";
import {
  collectLogicDashboardData,
  defaultProjectRoot,
} from "./logic-dashboard-data.mjs";

const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(defaultProjectRoot, "docs", "架构", "PPagenT-Logic-建设看板.html");
const templatePath = path.join(import.meta.dirname, "templates", "logic-dashboard.html");
const data = await collectLogicDashboardData(defaultProjectRoot);
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
  formalLogics: data.summary.formalLogics,
  pendingApproval: data.summary.pendingApproval,
}, null, 2));
