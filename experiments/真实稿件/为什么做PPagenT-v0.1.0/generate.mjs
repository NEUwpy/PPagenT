import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { PresentationFile } from "@oai/artifact-tool";
import {
  THEME,
  addBox,
  addText,
  buildComparison,
  buildLayeredArchitecture,
  buildRadialHub,
  buildSequentialProcess,
  createPresentation,
} from "../../../src/asset-runtime/component-builders.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDir, "../../..");
const defaultOutput = path.join(
  projectRoot,
  "outputs",
  "真实稿件",
  "为什么做PPagenT",
  "为什么做PPagenT-v0.1.0.pptx",
);

function parseArgs() {
  const values = { output: defaultOutput, "qa-dir": "" };
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`参数格式错误：${key || "<empty>"}`);
    const name = key.slice(2);
    if (!(name in values)) throw new Error(`不支持的参数：--${name}`);
    values[name] = value;
  }
  return values;
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function loadBrandAssets() {
  const source = path.join(projectRoot, "PPT模板-封面正文尾页.pptx");
  try {
    await fs.access(source);
  } catch {
    throw new Error(`缺少本地视觉源文件：${source}`);
  }
  const zip = await JSZip.loadAsync(await fs.readFile(source));
  const read = async (entry) => {
    const file = zip.file(entry);
    if (!file) throw new Error(`视觉源中缺少资源：${entry}`);
    return toArrayBuffer(await file.async("nodebuffer"));
  };
  return {
    campus: await read("ppt/media/image1.jpeg"),
    institute: await read("ppt/media/image3.png"),
  };
}

function addSources(slide) {
  slide.speakerNotes.textFrame.setText(
    "[Sources]\n- 内容：docs/为什么做PPagenT.md（项目内部稿件）\n- 视觉：PPT模板-封面正文尾页.pptx（用户提供）\n[/Sources]",
  );
}

function addBrandMark(slide, position = { left: 980, top: 24, width: 228, height: 52 }) {
  addText(slide, "东北大学  ·  PPagenT", position, {
    fontSize: 16, bold: true, color: THEME.dark, alignment: "right",
  });
}

function addContentChrome(slide, brand, pageNumber) {
  addBrandMark(slide);
  slide.shapes.add({
    geometry: "line",
    position: { left: 72, top: 678, width: 1136, height: 0 },
    fill: "none",
    line: { style: "solid", fill: THEME.accent, width: 2 },
  });
  addText(slide, `PPagenT v0.1.0  ·  ${String(pageNumber).padStart(2, "0")}`, {
    left: 980, top: 684, width: 228, height: 20,
  }, { fontSize: 12, color: THEME.muted, alignment: "right" });
  addSources(slide);
}

function addCover(presentation, brand) {
  const slide = presentation.slides.add();
  slide.background.fill = "#FFFFFF";
  addText(slide, "东北大学", { left: 34, top: 24, width: 280, height: 50 }, {
    fontSize: 28, bold: true, color: THEME.dark,
  });
  slide.images.add({
    blob: brand.institute,
    contentType: "image/png",
    alt: "智能机械与可靠性研究所",
    fit: "contain",
    position: { left: 770, top: 18, width: 480, height: 76 },
  });
  addBox(slide, { left: 0, top: 158, width: 1280, height: 250 }, {
    geometry: "rect",
    fill: THEME.accent,
    line: { style: "solid", fill: "none", width: 0 },
    shadow: "shadow-sm",
  });
  addText(slide, "为什么做 PPagenT", { left: 90, top: 210, width: 1100, height: 92 }, {
    fontSize: 58, bold: true, color: "#FFFFFF", alignment: "center",
  });
  addText(slide, "让 AI 读懂稿子，然后调用人已经提前做好的好东西", {
    left: 170, top: 310, width: 940, height: 46,
  }, { fontSize: 24, color: "#EAF6FF", alignment: "center" });
  slide.images.add({
    blob: brand.campus,
    contentType: "image/jpeg",
    alt: "东北大学校门线稿",
    fit: "cover",
    crop: { left: 0, top: 0.30, right: 0, bottom: 0.05 },
    position: { left: 0, top: 420, width: 1280, height: 300 },
  });
  addText(slide, "魏鹏宇  ·  2026.08.09", { left: 455, top: 456, width: 370, height: 38 }, {
    fontSize: 20, color: THEME.dark, alignment: "center",
  });
  addText(slide, "生成能力版本 v0.1.0", { left: 1000, top: 686, width: 230, height: 18 }, {
    fontSize: 12, color: THEME.muted, alignment: "right",
  });
  addSources(slide);
}

function addClosing(presentation, brand) {
  const slide = presentation.slides.add();
  slide.background.fill = "#FFFFFF";
  addText(slide, "东北大学", { left: 34, top: 24, width: 280, height: 50 }, {
    fontSize: 28, bold: true, color: THEME.dark,
  });
  slide.images.add({
    blob: brand.institute,
    contentType: "image/png",
    alt: "智能机械与可靠性研究所",
    fit: "contain",
    position: { left: 770, top: 18, width: 480, height: 76 },
  });
  addBox(slide, { left: 0, top: 158, width: 1280, height: 250 }, {
    geometry: "rect", fill: THEME.accent,
    line: { style: "solid", fill: "none", width: 0 }, shadow: "shadow-sm",
  });
  addText(slide, "不一定惊艳，但靠谱；", { left: 110, top: 205, width: 1060, height: 72 }, {
    fontSize: 46, bold: true, color: "#FFFFFF", alignment: "center",
  });
  addText(slide, "不一定独一无二，但真的好用。", { left: 110, top: 288, width: 1060, height: 64 }, {
    fontSize: 38, bold: true, color: "#FFFFFF", alignment: "center",
  });
  slide.images.add({
    blob: brand.campus,
    contentType: "image/jpeg",
    alt: "东北大学校门线稿",
    fit: "cover",
    crop: { left: 0, top: 0.30, right: 0, bottom: 0.05 },
    position: { left: 0, top: 420, width: 1280, height: 300 },
  });
  addText(slide, "这就是为什么做 PPagenT", { left: 405, top: 470, width: 470, height: 44 }, {
    fontSize: 24, bold: true, color: THEME.dark, alignment: "center",
  });
  addText(slide, "v0.1.0", { left: 1090, top: 686, width: 140, height: 18 }, {
    fontSize: 12, color: THEME.muted, alignment: "right",
  });
  addSources(slide);
}

async function writeBlob(outputPath, blob) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(await blob.arrayBuffer()));
}

async function exportQa(presentation, qaDir) {
  await fs.mkdir(qaDir, { recursive: true });
  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(path.join(qaDir, `${stem}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(path.join(qaDir, `${stem}.layout.json`), await layout.text(), "utf8");
  }
  await writeBlob(
    path.join(qaDir, "montage.webp"),
    await presentation.export({ format: "webp", montage: true, scale: 1 }),
  );
  const inspect = await presentation.inspect({
    kind: "slide,textbox,shape,image,chart,table,notes",
    maxChars: 50000,
  });
  await fs.writeFile(path.join(qaDir, "inspect.ndjson"), inspect.ndjson, "utf8");
}

async function main() {
  const args = parseArgs();
  const brand = await loadBrandAssets();
  const presentation = createPresentation();

  addCover(presentation, brand);

  addContentChrome(buildSequentialProcess(presentation, {
    title: "做 PPT 真正昂贵的是一连串判断",
    steps: [
      { title: "理解材料", body: "先弄清楚真正想讲什么" },
      { title: "组织讲述", body: "决定先讲什么、后讲什么" },
      { title: "拆成页面", body: "让每一页只承担一个任务" },
      { title: "选择表达", body: "判断关系、重点与合适版式" },
    ],
  }), brand, 2);

  addContentChrome(buildComparison(presentation, {
    title: "工作里的 PPT 不需要每次重新发明",
    left: { title: "每次自由生成", items: ["视觉可能更惊艳", "结果难以预测", "规范需要重新确认"] },
    right: { title: "调用验证经验", items: ["组织风格保持一致", "结果可以解释", "页面仍然原生可改"] },
    centerLabel: "主动取舍",
  }), brand, 3);

  addContentChrome(buildSequentialProcess(presentation, {
    title: "PPagenT 把任务交给三种不同能力",
    steps: [
      { title: "AI 负责理解", body: "读取稿件，判断重点、关系与拆页" },
      { title: "规则负责决定", body: "筛选合法版式，检查容量与边界" },
      { title: "代码负责执行", body: "稳定绘制原生可编辑的 PowerPoint" },
    ],
  }), brand, 4);

  addContentChrome(buildComparison(presentation, {
    title: "稳定的 80 分比随机的 95 分更适合工作",
    left: { title: "随机 95 分", items: ["偶尔令人惊艳", "下一次可能完全不同", "后续修改成本未知"] },
    right: { title: "稳定 80 分", items: ["结构和规范可靠", "第二天敢拿去汇报", "每个元素还能继续改"] },
    centerLabel: "工作价值",
  }), brand, 5);

  addContentChrome(buildComparison(presentation, {
    title: "它服务的不是最会做 PPT 的少数人",
    left: { title: "最会做的 1%", items: ["已经形成个人方法", "自己可以做得更好", "未必需要自动生成"] },
    right: { title: "更广泛的用户", items: ["有内容和专业知识", "缺少拆页与表达经验", "需要低成本专业初稿"] },
    centerLabel: "经验产品化",
  }), brand, 6);

  addContentChrome(buildRadialHub(presentation, {
    title: "真正沉淀的是会做 PPT 的经验",
    center: "可复用经验",
    items: ["理解内容", "拆分页面", "判断关系", "容量边界", "退化策略", "视觉规范"],
  }), brand, 7);

  addContentChrome(buildLayeredArchitecture(presentation, {
    title: "东北大学只是第一套组织视觉系统",
    sources: ["内容理解", "演示拆页", "表达规则", "确定性代码"],
    platform: "PPagenT 演示生产引擎",
    apps: ["东北大学", "企业", "实验室", "个人"],
  }), brand, 8);

  addContentChrome(buildSequentialProcess(presentation, {
    title: "从真实稿件到可编辑 PPT，系统必须走完整闭环",
    steps: [
      { title: "读懂稿件", body: "保留作者真正想表达的内容" },
      { title: "规划页面", body: "确定顺序、拆页与每页任务" },
      { title: "匹配资产", body: "在已知边界内选择版式" },
      { title: "生成复核", body: "输出 PPT，并记录失败与人工修改" },
    ],
  }), brand, 9);

  addClosing(presentation, brand);

  const output = path.resolve(args.output);
  await fs.mkdir(path.dirname(output), { recursive: true });
  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(output);
  if (args["qa-dir"]) await exportQa(presentation, path.resolve(args["qa-dir"]));
  console.log(output);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
