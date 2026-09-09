import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'preflight');
await fs.mkdir(out, { recursive: true });
const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const s = p.slides.add();
s.background.fill = '#FFFFFF';
const add = (name, text, position, style) => {
  const sh = s.shapes.add({ geometry: 'textbox', name, position, fill: 'none', line: { style: 'solid', fill: 'none', width: 0 } });
  sh.text = text;
  sh.text.style = { typeface: 'Microsoft YaHei', autoFit: 'none', insets: { left: 0, right: 0, top: 0, bottom: 0 }, ...style };
  return sh;
};
add('long-title', '4月请求量上升后，首次响应压力明显增加', { left: 80, top: 70, width: 900, height: 50 }, { fontSize: 32, bold: true, color: '#2B2B2B' });
add('two-digit', '01', { left: 80, top: 150, width: 70, height: 40 }, { fontSize: 18, bold: true, color: '#315F91', alignment: 'center' });
add('narrow-note', '模拟数据；指标为两个工作日内首次给出可执行答复，不是结案时长。', { left: 80, top: 230, width: 280, height: 90 }, { fontSize: 14, color: '#6F6F6F' });
add('mixed', 'B 统一申请入口：字段与授权校验', { left: 450, top: 230, width: 450, height: 60 }, { fontSize: 18, color: '#404040' });
const pptx = await PresentationFile.exportPptx(p);
await pptx.save(path.join(out, 'preflight.pptx'));
await fs.writeFile(path.join(out, 'preflight.layout.json'), await (await s.export({ format: 'layout' })).text());
await fs.writeFile(path.join(out, 'preflight.png'), new Uint8Array(await (await p.export({ slide: s, format: 'png', scale: 1 })).arrayBuffer()));
console.log('preflight written', out);
