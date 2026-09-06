// Visual kernel: independent of text, Skin, slide API and page layout.
export function convergenceGeometry({ starts, end, strokeWidth = 10 }) {
  if (!Array.isArray(starts) || starts.length < 2) throw new Error('At least two inputs required');
  const points = [...starts, end];
  if (!points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) throw new Error('Invalid anchor');
  const span = Math.min(...starts.map(p => end.x - p.x));
  const spread = Math.max(...starts.map(p => p.y)) - Math.min(...starts.map(p => p.y));
  // Prototype readability threshold, to be calibrated with more visual cases.
  const requiredSpan = Math.max(140, spread * 0.55, strokeWidth * 14);
  if (span < requiredSpan) return { ok: false, reason: 'insufficient-convergence-space', span, requiredSpan };
  const lanes = starts.map((start, index) => {
    const dx = end.x - start.x;
    const controls = [start, { x: start.x + dx * 0.36, y: start.y },
      { x: end.x - dx * 0.40, y: end.y }, end];
    // Both endpoint tangents horizontal. Final 40% control span provides a
    // gradual co-directional merge, rather than an angled point connection.
    const points = Array.from({ length: 65 }, (_, i) => {
      const t = i / 64, u = 1 - t;
      return { x: u*u*u*controls[0].x + 3*u*u*t*controls[1].x + 3*u*t*t*controls[2].x + t*t*t*controls[3].x,
        y: u*u*u*controls[0].y + 3*u*u*t*controls[1].y + 3*u*t*t*controls[2].y + t*t*t*controls[3].y };
    });
    return { index, controls, points };
  });
  return { ok: true, lanes, span, requiredSpan, strokeWidth };
}
