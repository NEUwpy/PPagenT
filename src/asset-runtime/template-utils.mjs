import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

export function parseNamedArgs(defaults) {
  const values = { ...defaults };
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`参数格式错误：${key || "<empty>"}`);
    }
    const name = key.slice(2);
    if (!(name in values)) throw new Error(`不支持的参数：--${name}`);
    values[name] = value;
  }
  return values;
}

async function findExactText(presentation, sourceText) {
  const snapshot = await presentation.inspect({
    kind: "textbox",
    search: sourceText,
    maxChars: 12000,
  });
  const records = (snapshot.ndjson || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const matches = records.filter(
    (record) => record.slide === 1 && record.text === sourceText,
  );
  if (matches.length !== 1) {
    throw new Error(`文本对象匹配失败：${sourceText}，找到 ${matches.length} 个`);
  }
  return presentation.resolve(matches[0].id);
}

export async function generateSinglePageAsset({
  sourcePptx,
  sourceSlideNumber,
  replacements,
  outputPptx,
}) {
  const presentation = await PresentationFile.importPptx(
    await FileBlob.load(sourcePptx),
  );
  const sourceSlides = [...presentation.slides.items];
  const sourceSlide = sourceSlides[sourceSlideNumber - 1];
  if (!sourceSlide) throw new Error(`源页面不存在：${sourceSlideNumber}`);

  const selectedSlide = sourceSlide.duplicate();
  for (const slide of sourceSlides) slide.delete();
  selectedSlide.moveTo(0);

  for (const [sourceText, replacementText] of replacements) {
    const target = await findExactText(presentation, sourceText);
    target.text.replace(sourceText, replacementText);
  }

  await fs.mkdir(path.dirname(outputPptx), { recursive: true });
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPptx);
  return outputPptx;
}
