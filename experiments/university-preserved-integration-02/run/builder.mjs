import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, Presentation, PresentationFile } from '@oai/artifact-tool';
import {
  closeStructureRuntime,
  invokeUniversityStructure,
  universityMckinseySkin,
} from '../../../src/runtime/invoke-university-structure.mjs';

const runDir = path.resolve(import.meta.dirname);
const root = path.resolve(runDir, '../../..');
const finalPptx = path.join(runDir, 'deck.pptx');
const evidencePath = path.join(runDir, 'invoke-structure.jsonl');
const renderDir = path.join(runDir, 'final-render');

const palette = {
  bg: '#FFFFFF',
  dark: '#2B2B2B',
  body: '#404040',
  muted: '#6F6F6F',
  blue: '#315F91',
  blueSoft: '#EAF1F6',
  bluePale: '#F5F8FA',
  line: '#D5DDE4',
  warning: '#A75D2A',
};

function textBox(slide, name, value, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: 'textbox',
    name,
    position,
    fill: 'none',
    line: { style: 'solid', fill: 'none', width: 0 },
  });
  shape.text = value;
  shape.text.style = {
    typeface: style.typeface ?? style.fontFamily ?? 'Microsoft YaHei',
    fontSize: style.fontSize ?? 18,
    color: style.color ?? palette.body,
    bold: style.bold ?? false,
    alignment: style.alignment ?? 'left',
    verticalAlignment: style.verticalAlignment ?? 'middle',
    ...style,
  };
  return shape;
}

function rect(slide, name, position, fill, lineFill = 'none', lineWidth = 0, radius = 'none') {
  return slide.shapes.add({
    geometry: radius === 'none' ? 'rect' : 'roundRect',
    name,
    position,
    fill,
    line: { style: 'solid', fill: lineFill, width: lineWidth },
    ...(radius === 'none' ? {} : { borderRadius: radius }),
  });
}

function rule(slide, name, left, top, width, color = palette.line, height = 2) {
  return rect(slide, name, { left, top, width, height }, color);
}

function pageChrome(slide, pageNumber, title, kicker) {
  slide.background.fill = palette.bg;
  textBox(slide, `kicker-${pageNumber}`, kicker, { left: 55, top: 44, width: 360, height: 24 }, {
    fontSize: 14, color: palette.blue, bold: true, letterSpacing: 1.2,
  });
  textBox(slide, `page-title-${pageNumber}`, title, { left: 55, top: 75, width: 1170, height: 58 }, {
    fontFamily: 'HYWenRunSongYun U', fontSize: 32, color: palette.dark, bold: true,
  });
  rule(slide, `title-rule-${pageNumber}`, 55, 145, 1170, palette.blue, 2);
  textBox(slide, `page-number-${pageNumber}`, String(pageNumber).padStart(2, '0'), { left: 1164, top: 48, width: 60, height: 24 }, {
    fontSize: 14, color: palette.muted, alignment: 'right', bold: true,
  });
}

function callout(slide, name, heading, body, position, accent = palette.blue) {
  rect(slide, `${name}-surface`, position, palette.bluePale, palette.line, 1, 'rounded-lg');
  rect(slide, `${name}-accent`, { left: position.left, top: position.top, width: 5, height: position.height }, accent);
  textBox(slide, `${name}-heading`, heading, {
    left: position.left + 18, top: position.top + 12, width: position.width - 30, height: 28,
  }, { fontSize: 18, color: palette.dark, bold: true });
  textBox(slide, `${name}-body`, body, {
    left: position.left + 18, top: position.top + 44, width: position.width - 30, height: position.height - 52,
  }, { fontSize: 16, color: palette.body, verticalAlignment: 'top' });
}

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });

const slide1 = presentation.slides.add();
pageChrome(slide1, 1, '首轮记录要覆盖四项基本信息，先让异常能够追溯', '记录规范 / 并列要求');
await invokeUniversityStructure({
  root,
  slide: slide1,
  assetId: 'parallel-folded-notes-grid-002',
  content: {
    items: [
      { key: 'source', title: '申请来源', body: '登记申请人与课题', iconQuery: 'file-text' },
      { key: 'approval', title: '审批依据', body: '记录责任人与时间', iconQuery: 'user-check' },
      { key: 'execution', title: '执行结果', body: '关联输出和参数', iconQuery: 'clipboard-check' },
      { key: 'exception', title: '异常处置', body: '保留原因与结论', iconQuery: 'alert-triangle' },
    ],
  },
  targetFrame: { left: 55, top: 220, width: 1170, height: 300 },
  evidencePath,
  pageId: 'page-01',
  regionId: 'preserved-folded-notes',
  reason: '四项信息处于同一层级，使用折角便签保留并列关系与原造型。',
});
callout(slide1, 'evidence-1', '模拟抽查观察', '20笔预约中，7笔缺审批时间，5笔缺执行记录。两类可重叠，不能相加为12笔问题预约。', { left: 55, top: 542, width: 600, height: 92 }, palette.warning);
callout(slide1, 'action-1', '先做小范围复核', '先在两间自愿实验室执行清单，再复核记录完整性；当前不能据此判断效率提升。', { left: 675, top: 542, width: 550, height: 92 }, palette.blue);

const slide2 = presentation.slides.add();
pageChrome(slide2, 2, '试点名单应逐轮收敛，先核资格再核责任与记录条件', '试点筛选 / 收敛规则');
await invokeUniversityStructure({
  root,
  slide: slide2,
  assetId: 'convergence-simple-funnel-001',
  content: {
    inputs: [
      { key: 'self', label: '自荐', iconQuery: 'building-community' },
      { key: 'platform', label: '推荐', iconQuery: 'arrows-right-left' },
      { key: 'partner', label: '合作', iconQuery: 'handshake' },
    ],
    steps: [
      { key: 'eligibility', title: '资格核对' },
      { key: 'responsibility', title: '责任确认' },
      { key: 'recording', title: '记录准备' },
    ],
  },
  targetFrame: { left: 100, top: 195, width: 760, height: 375 },
  evidencePath,
  pageId: 'page-02',
  regionId: 'preserved-funnel',
  reason: '三类候选来源汇入同一筛选过程，三轮条件逐步收窄，使用简明漏斗保留收敛关系。',
});
callout(slide2, 'condition-2', '进入拟议试点名单的条件', '候选来源为实验室自荐、平台推荐、既有合作。设备与任务适配；落实审批与执行负责人；可按最小清单登记。只有全部满足才进入拟议名单，未满足者补齐后再申请。', { left: 890, top: 220, width: 335, height: 205 }, palette.blue);
callout(slide2, 'action-2', '平台负责人维护依据', '试点暂限两间自愿实验室；候选来源数量不等于入选数量。这里是拟议筛选规则，不是实测转化率。', { left: 890, top: 448, width: 335, height: 142 }, palette.warning);

const slide3 = presentation.slides.add();
pageChrome(slide3, 3, '能力建设分三层累积，跨实验室复用依赖前两层基础', '能力建设 / 离散递进');
await invokeUniversityStructure({
  root,
  slide: slide3,
  assetId: 'progression-maturity-steps-002',
  content: {
    levels: [
      { key: 'recordable', title: '可记录', body: '每次任务留下最小台账' },
      { key: 'traceable', title: '可追溯', body: '记录关联来源、参数与输出' },
      { key: 'reusable', title: '可复用', body: '他人能够依据记录重做关键过程' },
    ],
    showStatus: false,
    currentIndex: 0,
  },
  targetFrame: { left: 55, top: 218, width: 1170, height: 320 },
  evidencePath,
  pageId: 'page-03',
  regionId: 'preserved-maturity-ladder',
  reason: '三层能力沿同一维度离散递进，后层以前层为基础，使用成熟度阶梯保留共同消失点与承托面。',
});
callout(slide3, 'target-3', '首轮目标与边界', '首轮只将“可记录”作为目标；没有完成度调查，不能暗示已达到某一级。跨实验室复用还需要实际重做验证。', { left: 55, top: 548, width: 560, height: 100 }, palette.blue);
callout(slide3, 'accept-3', '验收分工', '研究人员提交记录，管理员抽查关联是否齐全，平台负责人处理跨实验室责任争议；三者是分工，不是三级审批。', { left: 640, top: 548, width: 585, height: 100 }, palette.warning);

await fs.mkdir(renderDir, { recursive: true });
const exported = await PresentationFile.exportPptx(presentation);
await exported.save(finalPptx);

const imported = await PresentationFile.importPptx(await FileBlob.load(finalPptx));
for (const [index, slide] of imported.slides.items.entries()) {
  const png = await imported.export({ slide, format: 'png', scale: 1 });
  await writeBlob(path.join(renderDir, `slide-${String(index + 1).padStart(2, '0')}.png`), png);
  const layout = await slide.export({ format: 'layout' });
  await fs.writeFile(path.join(renderDir, `slide-${String(index + 1).padStart(2, '0')}.layout.json`), await layout.text());
}
const montage = await imported.export({ format: 'webp', montage: true, scale: 1 });
await writeBlob(path.join(renderDir, 'montage.webp'), montage);
const inspection = await imported.inspect({ kind: 'slide,textbox,shape,notes', maxChars: 50000 });
await fs.writeFile(path.join(runDir, 'final-inspection.ndjson'), inspection.ndjson ?? String(inspection));

const report = [
  '大学 Skin + 麦肯锡式独立实测',
  '输入：本目录 manuscript.txt；规则：rules:load generation / northeastern-university-001；结构：三份 guide 核对后调用大学入口。',
  '输出：deck.pptx；final-render/slide-01.png..slide-03.png；invoke-structure.jsonl；final-inspection.ndjson。',
  '结构调用：page-01 折角便签（4项并列）；page-02 简明漏斗（3来源、3轮收敛）；page-03 成熟度阶梯（3级递进，无状态标记）。',
  '内容保留：抽查20笔、7笔缺审批时间、5笔缺执行记录及两类可重叠；试点条件与两间自愿实验室边界；可记录/可追溯/可复用的基础关系与验收分工。',
  '视觉检查：最终 PPTX 已重新导入并逐页导出 PNG；另保存每页 layout JSON 与整稿 montage。',
  '未解决问题：结构调用日志的 validation 为 rendered-unreviewed；需要结合最终 PNG 做人工语义复核，程序无溢出不等于整页审核完成。未发生失败调用，故日志仅含每次 attempt/success。',
].join('\n');
await fs.writeFile(path.join(runDir, 'report.txt'), report, 'utf8');

await closeStructureRuntime();
console.log(JSON.stringify({ finalPptx, renderDir, evidencePath }, null, 2));
