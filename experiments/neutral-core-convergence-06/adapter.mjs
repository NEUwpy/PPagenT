import { convergenceGeometry } from './core.mjs';

// Conservative advance estimate for this Chinese manuscript prototype.
// This is NOT a font-engine measurement; exported text must still be reviewed.
export function wrapText(text, width, fontSize = 17) {
  const lines = []; let line = '', used = 0;
  for (const ch of String(text)) {
    if (ch === '\n') { lines.push(line); line = ''; used = 0; continue; }
    const advance = /[\u0000-\u007f]/u.test(ch) ? fontSize * 0.65 : fontSize;
    if (used + advance > width && line) { lines.push(line); line = ''; used = 0; }
    line += ch; used += advance;
  }
  if (line) lines.push(line);
  return lines;
}

export function planConvergence({ frame, inputs, result, inputWidth = 220, resultWidth = 180 }) {
  if (![frame.left, frame.top, frame.width, frame.height, inputWidth, resultWidth].every(Number.isFinite)
      || frame.width <= 0 || frame.height <= 0 || inputWidth <= 36 || resultWidth <= 36)
    return { ok: false, reason: 'invalid-frame' };
  if (!Array.isArray(inputs) || inputs.length < 2 || inputs.length > 6)
    return { ok: false, reason: 'unsupported-input-count' };
  const measure = (data, width) => {
    const bodyLines = wrapText(data.body, width - 36);
    if (wrapText(data.title, width - 36, 21).length > 1) return null;
    return { ...data, width, height: Math.max(88, 48 + bodyLines.length * 24 + 16), bodyLines };
  };
  const nodes = inputs.map(data => measure(data, inputWidth));
  const resultNode = measure(result, resultWidth);
  if (nodes.some(n => !n) || !resultNode) return { ok: false, reason: 'title-needs-more-width' };
  const minHeight = Math.max(nodes.reduce((n, p) => n + p.height, 0) + (nodes.length - 1) * 26, resultNode.height);
  if (frame.height < minHeight) return { ok: false, reason: 'insufficient-text-height', requiredHeight: minHeight };
  const gap = (frame.height - nodes.reduce((n, p) => n + p.height, 0)) / (nodes.length - 1);
  let top = frame.top;
  for (const node of nodes) { node.left = frame.left; node.top = top; top += node.height + gap; }
  Object.assign(resultNode, { left: frame.left + frame.width - resultWidth, top: frame.top + (frame.height - resultNode.height) / 2 });
  const geometry = convergenceGeometry({ starts: nodes.map(n => ({ x: n.left+n.width, y: n.top+n.height/2 })),
    end: { x: resultNode.left, y: resultNode.top+resultNode.height/2 } });
  if (!geometry.ok) return { ...geometry, requiredWidth: inputWidth + resultWidth + geometry.requiredSpan };
  return { ...geometry, frame, inputs: nodes, result: resultNode, minHeight, textMeasurement: 'conservative-character-advance-estimate' };
}
