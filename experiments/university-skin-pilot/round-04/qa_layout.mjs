import fs from "node:fs/promises";
import path from "node:path";

const root = "C:/PPagenT/experiments/university-skin-pilot/round-04";
const summary = [];
for (let i = 1; i <= 9; i += 1) {
  const file = path.join(root, `slide-${String(i).padStart(2, "0")}.layout.json`);
  const data = JSON.parse(await fs.readFile(file, "utf8"));
  const local = (data.elements || []).filter((e) => e.name?.startsWith("qa-"));
  const text = local.filter((e) => typeof e.text === "string").map((e) => ({ name: e.name, text: e.text, lines: e.textLayout?.lineCount ?? null, font: e.resolvedFontSize ?? null, typeface: e.resolvedTextStyle?.typeface ?? null, bbox: e.bbox }));
  const out = local.filter((e) => { const [l,t,w,h] = e.bbox || []; return l < 55 || t < 166 || l+w > 1225 || t+h > 658; });
  summary.push({ slide: i, localObjects: local.length, textObjects: text.length, outOfBodyFrame: out.map((e) => e.name), text });
}
await fs.writeFile(path.join(root, "qa-layout-summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify(summary.map((s) => ({ slide: s.slide, localObjects: s.localObjects, textObjects: s.textObjects, outOfBodyFrame: s.outOfBodyFrame }))));
