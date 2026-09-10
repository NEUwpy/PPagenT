import fs from 'node:fs';
const sourcePath = "C:\\Users\\ilove\\Documents\\Codex\\2026-09-06\\ppagent-magazine-luna-high-r2\\work\\build_deck.mjs";
const C={ink:'#20201D',body:'#4B4A45',muted:'#85837B',accent:'#A35D4F'};
const display='Noto Serif SC',body='Noto Sans SC',roleRegistry=[];let currentPage=1;
function addText(slide, text, x, y, w, h, role, opts = {}) {
  const roleSpec = {
    coverTitle: { font: display, size: 58, bold: false, color: C.ink },
    pageTitle: { font: display, size: 25, bold: true, color: C.ink },
    sectionTitle: { font: display, size: 21, bold: true, color: C.ink },
    node: { font: display, size: 17, bold: false, color: C.ink },
    body: { font: body, size: 17, bold: false, color: C.body },
    lead: { font: body, size: 17, bold: false, color: C.ink },
    small: { font: body, size: 15, bold: false, color: C.muted },
    formula: { font: display, size: 48, bold: false, color: C.accent },
    number: { font: display, size: 32, bold: false, color: C.accent },
    footer: { font: body, size: 11, bold: false, color: C.muted },
  }[role];
  if (!roleSpec) throw new Error(`Unknown role: ${role}`);
  const spec = { ...roleSpec, ...opts };
  const s = slide.shapes.add({
    geometry: 'textbox',
    name: `txt-${currentPage}-${roleRegistry.length + 1}`,
    position: { left: x, top: y, width: w, height: h },
    fill: 'none',
    line: { fill: 'none', width: 0 },
  });
  s.text = text;
  s.text.style = {
    typeface: spec.font,
    fontSize: spec.size,
    bold: spec.bold,
    color: spec.color,
    alignment: spec.align || 'left',
    verticalAlignment: spec.valign || 'top',
    autoFit: spec.autoFit || 'none',
    wrap: 'square',
    lineSpacing: spec.lineSpacing || (role === 'body' || role === 'lead' ? 1.15 : 1.0),
    insets: spec.insets || { left: 0, right: 0, top: 0, bottom: 0 },
  };
  roleRegistry.push({ slide: currentPage, role, text, x, y, w, h, font: spec.font, size: spec.size, bold: spec.bold });
  return s;
}

function run(opts){let value;const slide={shapes:{add(){return value={text:{}};}}};
// Simulate the SDK text setter without altering the sampled constructor.
slide.shapes.add=()=>{value={};let t={};Object.defineProperty(value,'text',{get:()=>t,set:x=>{t={value:x};}});return value;};
addText(slide,'普通解释句',0,0,200,100,'body',opts);return {actual:value.text.style,registry:roleRegistry.at(-1)};}
const normal=run({}),override=run({size:30,font:'Noto Serif SC'});
const result={sourcePath,normal,override,overrideAccepted:override.actual.fontSize===30,independentRuleCheck:override.actual.fontSize===17?'pass':'fail',scope:'Constructor override mechanism only; does not establish every historic violation cause.'};
fs.writeFileSync(new URL('./role-override-result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({overrideAccepted:result.overrideAccepted,independentRuleCheck:result.independentRuleCheck}));
