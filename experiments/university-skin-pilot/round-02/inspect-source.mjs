import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const sources = [
  "C:/PPagenT/assets/主题/东北大学-001/runtime-template.pptx",
  "C:/PPagenT/PPT源/PPT模板-封面正文尾页.pptx",
];

for (const source of sources) {
  const presentation = await PresentationFile.importPptx(await FileBlob.load(source));
  const snapshot = await presentation.inspect({
    kind: "slide,textbox,shape,image,table,chart,notes,layout",
    maxChars: 200000,
  });
  console.log(`SOURCE ${source}`);
  console.log(`SLIDES ${presentation.slides.items.length}`);
  console.log(snapshot.ndjson);
  console.log("LAYOUTS");
  for (const layout of presentation.layouts.items) {
    console.log(JSON.stringify({ id: layout.id, name: layout.name, parentLayoutId: layout.parentLayoutId, placeholders: layout.placeholders?.summary?.() }));
  }
  console.log("MASTERS");
  for (const master of presentation.masters.items) {
    console.log(JSON.stringify({ id: master.id, name: master.name, elements: master.elements?.length, placeholders: master.placeholders?.summary?.() }));
  }
}
