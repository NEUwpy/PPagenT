// Pilot only: a selected page arrangement deterministically reserves its regions.
export function reserveRegions(body, arrangement) {
  for (const key of ['left', 'top', 'width', 'height']) {
    if (!Number.isFinite(body?.[key])) throw new Error(`Invalid body.${key}`);
  }
  if (body.width < 900 || body.height < 420) throw new Error('Pilot requires a wide presentation body');
  const gap = 28;
  const { left: x, top: y, width: w, height: h } = body;
  const frame = (left, top, width, height) => ({ left, top, width, height });
  let visual, narrative;
  if (arrangement === 'visual-left' || arrangement === 'visual-right') {
    const vw = Math.round((w - gap) * .58);
    const tw = w - gap - vw;
    const visualLeft = arrangement === 'visual-left';
    visual = frame(visualLeft ? x : x + tw + gap, y, vw, h);
    narrative = frame(visualLeft ? x + vw + gap : x, y, tw, h);
  } else if (arrangement === 'visual-top') {
    const vh = Math.round((h - gap) * .61);
    visual = frame(x, y, w, vh);
    narrative = frame(x, y + vh + gap, w, h - vh - gap);
  } else throw new Error(`Unknown arrangement: ${arrangement}`);
  return { arrangement, body: { ...body }, gap, visual, narrative };
}
