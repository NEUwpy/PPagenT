import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// A conservative authoring-contract check, never a visual-quality score.
// Explicit pairs avoid guessing that every background surface is a diagram node.
export function auditNodeLabels(layout, manifest) {
  const elements = layout.elements ?? [];
  const results = [];
  for (const pair of manifest.pairs ?? []) {
    const nodeMatches = elements.filter(e => e.name === pair.node);
    const labelMatches = elements.filter(e => e.name === pair.label);
    const issues = [];
    if (nodeMatches.length !== 1 || labelMatches.length !== 1) {
      results.push({ ...pair, issues: ['MISSING_OR_AMBIGUOUS_OBJECT'] });
      continue;
    }
    const node = nodeMatches[0], label = labelMatches[0];
    const style = label.resolvedTextStyle ?? {};
    if (!label.text?.trim()) issues.push('EMPTY_LABEL');
    if (style.alignment !== 'center') issues.push('HORIZONTAL_ALIGNMENT');
    if (style.verticalAlignment !== 'middle') issues.push('VERTICAL_ALIGNMENT');
    if (![node.bbox, label.bbox].every(b => Array.isArray(b) && b.length === 4 && b.every(Number.isFinite))) {
      results.push({ ...pair, issues: [...issues, 'MISSING_GEOMETRY'] });
      continue;
    }
    const [nx, ny, nw, nh] = node.bbox;
    let [lx, ly, lw, lh] = label.bbox;
    // For text embedded in the node, use declared text insets as the safe frame.
    if (pair.node === pair.label) {
      const ins = style.insets ?? {};
      lx += ins.left ?? 0; ly += ins.top ?? 0;
      lw -= (ins.left ?? 0) + (ins.right ?? 0);
      lh -= (ins.top ?? 0) + (ins.bottom ?? 0);
    }
    const centerDelta = [lx + lw / 2 - nx - nw / 2, ly + lh / 2 - ny - nh / 2];
    const tolerance = pair.centerTolerance ?? 2;
    if (centerDelta.some(d => Math.abs(d) > tolerance)) issues.push('OFF_CENTER_TEXT_FRAME');
    const pad = pair.padding ?? 8;
    const corners = [[lx, ly], [lx + lw, ly], [lx, ly + lh], [lx + lw, ly + lh]];
    let safeFrameVerified = false;
    if (nw > 2 * pad && nh > 2 * pad && lw > 0 && lh > 0) {
      if (node.geometry === 'diamond') {
        safeFrameVerified = true;
        // Each corner must fit an inset diamond, not merely its bounding box.
        const rx = nw / 2 - pad, ry = nh / 2 - pad;
        if (corners.some(([x,y]) => Math.abs(x-nx-nw/2)/rx + Math.abs(y-ny-nh/2)/ry > 1.001)) issues.push('UNSAFE_DIAMOND_TEXT_FRAME');
      } else if (['rect', 'roundRect', 'textbox'].includes(node.geometry)) {
        safeFrameVerified = true;
        if (lx < nx+pad-0.1 || ly < ny+pad-0.1 || lx+lw > nx+nw-pad+0.1 || ly+lh > ny+nh-pad+0.1) issues.push('UNSAFE_RECTANGULAR_TEXT_FRAME');
      } else issues.push('UNSUPPORTED_NODE_GEOMETRY');
    } else issues.push('INVALID_SAFE_FRAME');
    results.push({ ...pair, text: label.text, centerDelta, safeFrameVerified,
      safeFrameScope: node.geometry === 'roundRect' ? 'outer rectangle only; rounded corners require rendered review' : 'declared text frame',
      alignment: style.alignment, verticalAlignment: style.verticalAlignment,
      glyphBoundsVerified: false, issues });
  }
  return { pairCount: results.length, issueCount: results.reduce((n,r) => n+r.issues.length,0),
    visualAcceptance: 'not assessed', glyphBoundsVerified: false, results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , layoutPath, pairsPath] = process.argv;
  if (!layoutPath || !pairsPath) throw new Error('Usage: audit-node-labels.mjs layout.json node-label-pairs.json');
  const read = async path => JSON.parse((await fs.readFile(path,'utf8')).replace(/^\uFEFF/,''));
  const result = auditNodeLabels(await read(layoutPath), await read(pairsPath));
  console.log(JSON.stringify(result,null,2));
  process.exitCode = result.issueCount ? 1 : 0;
}
