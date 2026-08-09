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

function presentationSlides(presentation) {
  if (Array.isArray(presentation.slides?.items)) return presentation.slides.items;
  if (Number.isInteger(presentation.slides?.count)) {
    return Array.from(
      { length: presentation.slides.count },
      (_, index) => presentation.slides.getItem(index),
    );
  }
  throw new Error("无法读取演示文稿页面");
}

async function inspectEditableElements(presentation) {
  const snapshot = await presentation.inspect({
    kind: "slide,textbox,shape,image,notes",
    maxChars: 200000,
  });
  return (snapshot.ndjson || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function requireUniqueRecord(records, slideNumber, predicate, label) {
  const matches = records.filter(
    (record) => record.slide === slideNumber && predicate(record),
  );
  if (matches.length !== 1) {
    throw new Error(`第 ${slideNumber} 页对象匹配失败：${label}，找到 ${matches.length} 个`);
  }
  return matches[0];
}

async function writeBlob(outputPath, blob) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(await blob.arrayBuffer()));
}

export async function prepareTemplateMappedStarter({
  sourcePptx,
  sourceSlideNumbers,
  starterPptx,
}) {
  if (!Array.isArray(sourceSlideNumbers) || sourceSlideNumbers.length === 0) {
    throw new Error("sourceSlideNumbers 不能为空");
  }
  const presentation = await PresentationFile.importPptx(
    await FileBlob.load(sourcePptx),
  );
  const originals = [...presentationSlides(presentation)];
  const starterSlides = sourceSlideNumbers.map((sourceSlideNumber, index) => {
    const source = originals[sourceSlideNumber - 1];
    if (!source) {
      throw new Error(`第 ${index + 1} 页引用了不存在的源页：${sourceSlideNumber}`);
    }
    return source.duplicate();
  });
  for (const slide of originals) slide.delete();
  starterSlides.forEach((slide, index) => slide.moveTo(index));

  const output = path.resolve(starterPptx);
  await fs.mkdir(path.dirname(output), { recursive: true });
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(output);
  return output;
}

export async function applyTemplateMappedRecipes(presentation, slideRecipes) {
  if (!Array.isArray(slideRecipes) || slideRecipes.length === 0) {
    throw new Error("slideRecipes 不能为空");
  }
  const generatedSlides = [...presentationSlides(presentation)];
  if (generatedSlides.length !== slideRecipes.length) {
    throw new Error(
      `模板起始稿页数与配方不一致：${generatedSlides.length} != ${slideRecipes.length}`,
    );
  }

  const records = await inspectEditableElements(presentation);
  for (let index = 0; index < slideRecipes.length; index += 1) {
    const slideNumber = index + 1;
    const slide = generatedSlides[index];
    const recipe = slideRecipes[index];

    for (const edit of recipe.textEdits || []) {
      const record = requireUniqueRecord(
        records,
        slideNumber,
        (item) => item.kind === "textbox" && item.text === edit.sourceText,
        `文本 ${edit.sourceText}`,
      );
      const target = presentation.resolve(record.id);
      if (edit.writeMode === "replace-all") {
        target.text = edit.replacementText;
      } else {
        target.text.replace(edit.sourceText, edit.replacementText);
      }
      if (edit.position) target.position = { ...edit.position };
    }

    for (const deletion of recipe.deletions || []) {
      const record = requireUniqueRecord(
        records,
        slideNumber,
        (item) => item.kind === deletion.kind && item.name === deletion.name,
        `${deletion.kind} ${deletion.name}`,
      );
      presentation.resolve(record.id).delete();
    }

    if (recipe.notes) {
      slide.speakerNotes.textFrame.setText(recipe.notes);
    }
  }

  return generatedSlides;
}

export async function exportTemplateMappedQa(presentation, qaDir) {
  const generatedSlides = [...presentationSlides(presentation)];
  const qaOutput = path.resolve(qaDir);
  await fs.mkdir(qaOutput, { recursive: true });
  for (const [index, slide] of generatedSlides.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(
      path.join(qaOutput, `${stem}.png`),
      await presentation.export({ slide, format: "png", scale: 1 }),
    );
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(
      path.join(qaOutput, `${stem}.layout.json`),
      await layout.text(),
      "utf8",
    );
  }
  await writeBlob(
    path.join(qaOutput, "montage.webp"),
    await presentation.export({ format: "webp", montage: true, scale: 1 }),
  );
  const inspect = await presentation.inspect({
    kind: "slide,textbox,shape,image,notes,layout",
    maxChars: 200000,
  });
  await fs.writeFile(
    path.join(qaOutput, "inspect.ndjson"),
    inspect.ndjson,
    "utf8",
  );
}

/**
 * 以用户提供的 PPTX 为唯一视觉源，按映射复制源页并编辑继承对象。
 * 该入口故意不接受“新建空白演示”或“通用主题”，避免真实稿件绕过组织模板。
 */
export async function generateTemplateMappedDeck({
  sourcePptx,
  slideRecipes,
  outputPptx,
  qaDir = "",
}) {
  const starterPptx = `${path.resolve(outputPptx)}.starter.pptx`;
  await prepareTemplateMappedStarter({
    sourcePptx,
    sourceSlideNumbers: slideRecipes.map((recipe) => recipe.sourceSlideNumber),
    starterPptx,
  });
  const presentation = await PresentationFile.importPptx(
    await FileBlob.load(starterPptx),
  );
  await applyTemplateMappedRecipes(presentation, slideRecipes);

  const output = path.resolve(outputPptx);
  await fs.mkdir(path.dirname(output), { recursive: true });
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(output);

  if (qaDir) await exportTemplateMappedQa(presentation, qaDir);

  return output;
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
