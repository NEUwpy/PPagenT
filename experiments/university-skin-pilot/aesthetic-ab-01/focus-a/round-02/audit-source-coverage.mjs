import fs from "node:fs/promises";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const run = "C:/PPagenT/experiments/university-skin-pilot/aesthetic-ab-01/focus-a/round-01";
const deck = await PresentationFile.importPptx(await FileBlob.load(`${run}/deck.pptx`));
const inspected = await deck.inspect({ kind: "slide,textbox", maxChars: 60000 });
await fs.writeFile(`${run}/extracted-text.ndjson`, inspected.ndjson);
const bySlide = {};
for (const line of inspected.ndjson.split(/\r?\n/)) {
  if (!line.trim()) continue;
  const item = JSON.parse(line);
  if (item.kind === "textbox") (bySlide[item.slide] ||= []).push({ name: item.name, text: item.text });
}
await fs.writeFile(`${run}/extracted-text.json`, JSON.stringify(bySlide, null, 2));
console.log(JSON.stringify({ slideCount: Object.keys(bySlide).length, textBoxCount: Object.values(bySlide).flat().length }, null, 2));
