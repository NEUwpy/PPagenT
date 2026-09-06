import fs from 'node:fs/promises';
import path from 'node:path';

// Bounded candidate-style audit; does not judge evidence quality or overall aesthetics.
const [run] = process.argv.slice(2);
if (!run) throw new Error('Usage: node audit-analysis-surfaces.mjs RUN');
const inside = (a, b) => a[0] >= b[0] - .5 && a[1] >= b[1] - .5 &&
  a[0] + a[2] <= b[0] + b[2] + .5 && a[1] + a[3] <= b[1] + b[3] + .5;
const files = (await fs.readdir(run)).filter(f => /^slide-\d+\.layout\.json$/.test(f));
const pages = [];
for (const file of files) {
  const page = Number(file.match(/\d+/)[0]);
  const layout = JSON.parse(await fs.readFile(path.join(run, file), 'utf8'));
  let pairs = [];
  try { pairs = JSON.parse(await fs.readFile(path.join(run, `slide-${page}.node-label-pairs.json`), 'utf8')).pairs; }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const nodes = new Set((pairs ?? []).map(p => String(p.node)));
  const text = layout.elements.filter(e => e.text?.trim() && e.bbox);
  const surfaces = layout.elements.filter(e => e.bbox && !e.text?.trim() &&
    ['rect', 'roundRect'].includes(e.geometry) && e.fillColor?.startsWith('#') &&
    e.bbox[2] > 40 && e.bbox[3] > 18 && text.some(t => inside(t.bbox, e.bbox)));
  const isNode = e => nodes.has(String(e.id)) || nodes.has(e.name);
  const analysis = surfaces.filter(e => !isNode(e));
  const issues = [];
  for (const surface of analysis) {
    if (surface.geometry === 'roundRect') issues.push({type:'rounded-analysis-surface', id:surface.id, name:surface.name});
    const children = analysis.filter(c => c !== surface && inside(c.bbox, surface.bbox) &&
      c.bbox[2] * c.bbox[3] < surface.bbox[2] * surface.bbox[3] - 1);
    if (children.length) issues.push({type:'nested-text-surfaces', id:surface.id, name:surface.name,
      children:children.map(c => ({id:c.id, name:c.name}))});
  }
  pages.push({page, textSurfaceCount:surfaces.length, declaredNodeCount:nodes.size, issues});
}
const issueCount = pages.reduce((n,p) => n + p.issues.length, 0);
console.log(JSON.stringify({scope:'Candidate boundaries: rectangular analysis regions and no nested ordinary-text panels. Declared diagram nodes are exempt. Chart or unusual region findings require applicability review; this is not visual acceptance.', issueCount, pages}, null, 2));
process.exitCode = issueCount ? 1 : 0;
