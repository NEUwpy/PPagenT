import fs from 'node:fs/promises';
import JSZip from 'jszip';

const dir = new URL('.', import.meta.url).pathname;
const root = decodeURIComponent(dir.replace(/^\//, '').replaceAll('/', '\\'));
const pptxPath = `${root}northeastern-shared-entry.pptx`;
const inspectPath = `${root}northeastern-shared-entry.pptx.inspect.ndjson`;
const reportPath = `${root}validation-revision.json`;

function overlaps(a, b) {
  return a.bbox[0] < b.bbox[0] + b.bbox[2]
    && a.bbox[0] + a.bbox[2] > b.bbox[0]
    && a.bbox[1] < b.bbox[1] + b.bbox[3]
    && a.bbox[1] + a.bbox[3] > b.bbox[1];
}

function decodeXml(value) {
  return value.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'");
}

async function extractTextStyles() {
  const zip = await JSZip.loadAsync(await fs.readFile(pptxPath));
  const slides = {};
  for (const name of Object.keys(zip.files).filter((item) => /^ppt\/slides\/slide\d+\.xml$/.test(item)).sort()) {
    const xml = await zip.file(name).async('string');
    const runs = [];
    const pattern = /<a:r[\s\S]*?<a:rPr[^>]*?sz="(\d+)"[^>]*>[\s\S]*?<a:latin[^>]*?typeface="([^"]*)"[^>]*>[\s\S]*?<a:t>([\s\S]*?)<\/a:t>[\s\S]*?<\/a:r>/g;
    for (const match of xml.matchAll(pattern)) {
      const text = decodeXml(match[3].replace(/<[^>]+>/g, '')).trim();
      if (text) runs.push({ text, pt: Number(match[1]) / 100, typeface: match[2] });
    }
    slides[name] = runs;
  }
  return slides;
}

async function geometryCheck() {
  const lines = (await fs.readFile(inspectPath, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const textShapes = lines.filter((item) => item.kind === 'textbox' && Array.isArray(item.bbox));
  const boundWarnings = textShapes.filter((item) => item.bbox[0] < 0 || item.bbox[1] < 0 || item.bbox[0] + item.bbox[2] > 1280 || item.bbox[1] + item.bbox[3] > 720)
    .map((item) => ({ slide: item.slide, text: item.text, bbox: item.bbox, issue: 'text-out-of-bounds' }));
  const textOverlapWarnings = [];
  for (let i = 0; i < textShapes.length; i += 1) {
    for (let j = i + 1; j < textShapes.length; j += 1) {
      const a = textShapes[i];
      const b = textShapes[j];
      if (a.slide === b.slide && overlaps(a, b)) textOverlapWarnings.push({ slide: a.slide, a: a.text, b: b.text, aBbox: a.bbox, bBbox: b.bbox, issue: 'text-text-overlap-review' });
    }
  }
  return { textShapeCount: textShapes.length, boundWarnings, textOverlapWarnings };
}

const result = {
  pptx: 'northeastern-shared-entry.pptx',
  expected: {
    bodyTypeface: 'Microsoft YaHei',
    displayTypeface: 'HYWenRunSongYun U',
    pageTypographyPx: { title: 32, heading: 21, body: 18, meta: 14 },
  },
  actualTextStyles: await extractTextStyles(),
  geometry: await geometryCheck(),
  visualReview: {
    slide1: '四类便签正文未见单字尾行；右栏为字段范围说明与证据保留行动。',
    slide2: '三个入口标签分别贴近对应图标；右栏按三类来源逐项映射，无制作说明性句子。',
    slide3: '四级短文案未见对接、审批、记录、机制的单字拆行；右栏只表达下一步关联与复盘。',
  },
};
await fs.writeFile(reportPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
