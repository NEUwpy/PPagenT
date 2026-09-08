import fs from 'node:fs/promises';
import {FileBlob,PresentationFile} from '@oai/artifact-tool';
for(const group of ['run-fields','run-paragraph']) {
 const dir=new URL(`./${group}/`,import.meta.url);
 const p=await PresentationFile.importPptx(await FileBlob.load(new URL('deck.pptx',dir).pathname.replace(/^\/(\w:)/,'$1')));
 for(const [i,slide] of p.slides.items.entries()) {
  const stem=`slide-${String(i+1).padStart(2,'0')}`;
  await fs.writeFile(new URL(`${stem}.png`,dir),new Uint8Array(await (await p.export({slide,format:'png',scale:1})).arrayBuffer()));
  await fs.writeFile(new URL(`${stem}.layout.json`,dir),await (await slide.export({format:'layout'})).text());
 }
 console.log(`${group}: ${p.slides.items.length} slides reimported and rendered`);
}
