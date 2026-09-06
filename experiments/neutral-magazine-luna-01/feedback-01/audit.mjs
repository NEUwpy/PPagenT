import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const pptx = process.argv[2] ?? "C:/PPagenT/experiments/neutral-magazine-luna-01/feedback-01/deliverables/deck-feedback-01.pptx";
const out = process.argv[3] ?? "C:/PPagenT/experiments/neutral-magazine-luna-01/feedback-01/font-geometry-audit.json";
const JSZIP = await import(pathToFileURL("C:/Users/ilove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/jszip/lib/index.js").href);
const zip = await JSZIP.default.loadAsync(await fs.readFile(pptx));
const entries = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
const esc = (s) => s.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'");
const runs = [];
for (const entry of entries) {
  const slide = Number(entry.match(/\d+/)[0]);
  const xml = await zip.file(entry).async("string");
  for (const block of xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)) {
    const sp = block[1];
    const name = sp.match(/<p:cNvPr[^>]* name="([^"]*)"/)?.[1] ?? "";
    const text = [...sp.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => esc(m[1])).join("");
    if (!text) continue;
    const style = sp.match(/<a:rPr[^>]*?sz="(\d+)"[^>]*>[\s\S]*?<a:latin typeface="([^"]*)"/) ?? sp.match(/<a:defRPr[^>]*?sz="(\d+)"[^>]*>[\s\S]*?<a:latin typeface="([^"]*)"/);
    const sizeHundredPt = style ? Number(style[1]) : null;
    const typeface = style?.[2] ?? null;
    runs.push({ slide, name, text, sizeHundredPt, fontSizePx: sizeHundredPt == null ? null : Number((sizeHundredPt / 75).toFixed(2)), typeface });
  }
}
const sizeCounts = {};
const fontCounts = {};
for (const r of runs) {
  const key = String(r.fontSizePx);
  sizeCounts[key] = (sizeCounts[key] ?? 0) + 1;
  fontCounts[r.typeface] = (fontCounts[r.typeface] ?? 0) + 1;
}
const result = { pptx, slideCount: entries.length, runCount: runs.length, sizeCounts, fontCounts, runs };
await fs.writeFile(out, JSON.stringify(result, null, 2), "utf8");
console.log(JSON.stringify({ out, slideCount: result.slideCount, runCount: result.runCount, sizeCounts, fontCounts }, null, 2));
