import fs from 'node:fs/promises';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';

const deck = 'C:/PPagenT/experiments/university-skin-pilot/aesthetic-ab-01/evidence/round-01/deck.pptx';
const presentation = await PresentationFile.importPptx(await FileBlob.load(deck));
const slides = [];
for (const [index, slide] of presentation.slides.items.entries()) {
  const layout = JSON.parse(await (await slide.export({ format: 'layout' })).text());
  slides.push({ slide: index + 1, texts: (layout.elements || []).filter(e => e.text?.trim()).map(e => e.text) });
}
await fs.writeFile('C:/PPagenT/experiments/university-skin-pilot/aesthetic-ab-01/evidence/round-01/final-text-export.json', JSON.stringify({ source: deck, slideCount: slides.length, slides }, null, 2));
