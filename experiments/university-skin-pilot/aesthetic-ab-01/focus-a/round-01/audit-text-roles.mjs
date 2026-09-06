import fs from "node:fs/promises";
const run = "C:/PPagenT/experiments/university-skin-pilot/aesthetic-ab-01/focus-a/round-01";
const declarations = JSON.parse(await fs.readFile(`${run}/text-roles.json`, "utf8"));
const sizes = { cover: 44, claim: 30, group: 21, body: 18, note: 16, footer: 12, metric: 36 };
const reports = [];
for (const role of declarations.roles) {
  const slide = JSON.parse(await fs.readFile(`${run}/slide-${role.slide}.layout.json`, "utf8"));
  const element = (slide.elements || []).find((e) => e.id === role.id || e.name === role.name);
  const actual = element?.resolvedTextStyle || {};
  const actualSize = Number(element?.resolvedFontSize ?? actual.fontSize ?? 0);
  const actualBold = Boolean(actual.bold);
  reports.push({ slide: role.slide, name: role.name, role: role.role, declaredFontSize: sizes[role.role], actualFontSize: actualSize, declaredBold: Boolean(role.bold), actualBold, typeface: actual.typeface, status: actualSize === sizes[role.role] && actualBold === Boolean(role.bold) && actual.typeface === "Microsoft YaHei" ? "ok" : "mismatch" });
}
const result = { roleCount: reports.length, mismatchCount: reports.filter((r) => r.status !== "ok").length, reports };
await fs.writeFile(`${run}/audit-text-roles.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ roleCount: result.roleCount, mismatchCount: result.mismatchCount }, null, 2));
