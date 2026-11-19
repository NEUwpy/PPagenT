export async function measure(page, bindings) {
  return page.evaluate(expected => {
    const frame = document.querySelector('[data-content-frame]');
    const rect = box => ({ x: box.x, y: box.y, width: box.width, height: box.height });
    const box = el => rect(el.getBoundingClientRect());
    const fits = (inner, outer, tolerance = 1) =>
      inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance &&
      inner.x + inner.width <= outer.x + outer.width + tolerance &&
      inner.y + inner.height <= outer.y + outer.height + tolerance;
    const errors = [];
    const elements = [...document.querySelectorAll('[data-bind]')];
    const expectedByKey = new Map(expected.map(field => [field.key, field]));
    const text = elements.map(el => {
      const key = el.dataset.bind;
      const binding = expectedByKey.get(key);
      const source = el.dataset.source;
      const style = getComputedStyle(el);
      const fontSize = parseFloat(style.fontSize);
      const range = document.createRange();
      range.selectNodeContents(el);
      const lines = [...range.getClientRects()].map(rect).filter(line => line.width > 0 && line.height > 0);
      const owner = el.closest('.note-text-region, [data-boundary]');
      const bounds = owner && box(owner);
      const leafBounds = box(el);
      const clipping = [];
      const inBody = frame.contains(el);
      for (let ancestor = el; ancestor; ancestor = ancestor.parentElement) {
        const cs = getComputedStyle(ancestor);
        const edge = box(ancestor);
        if (lines.some(line =>
          (/hidden|clip|auto|scroll/.test(cs.overflowY) && (line.y < edge.y - 1 || line.y + line.height > edge.y + edge.height + 1)) ||
          (/hidden|clip|auto|scroll/.test(cs.overflowX) && (line.x < edge.x - 1 || line.x + line.width > edge.x + edge.width + 1)))) {
          clipping.push(ancestor.className);
        }
      }
      if (!binding || binding.text !== el.textContent || source !== binding.sourceId) errors.push({ code: 'binding', key });
      if (!lines.length || style.visibility === 'hidden' || style.display === 'none') errors.push({ code: 'hidden-text', key });
      if (inBody && fontSize < 18) errors.push({ code: 'body-font', key, fontSize });
      if (inBody && lines.some(line => !fits(line, box(frame)))) errors.push({ code: 'text-outside-frame', key });
      if (bounds && lines.some(line => !fits(line, bounds))) errors.push({ code: 'text-outside-slot', key });
      if (clipping.length) errors.push({ code: 'text-clipped', key, clipping });
      return {
        key, source, text: el.textContent, inBody, box: leafBounds, lines,
        boundary: bounds, fontSize, lineHeight: style.lineHeight, fontFamily: style.fontFamily,
        clientHeight: el.clientHeight, scrollHeight: el.scrollHeight,
        slotBottomClearance: bounds && lines.length ? bounds.y + bounds.height - Math.max(...lines.map(line => line.y + line.height)) : null,
      };
    });
    for (const field of expected) {
      const count = text.filter(node => node.key === field.key).length;
      if (count !== 1) errors.push({ code: 'binding-count', key: field.key, count });
    }
    const overlap = (a, b) => Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1
      && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;
    for (const [i, a] of text.entries()) for (const b of text.slice(i + 1)) {
      if (a.lines.some(line => b.lines.some(other => overlap(line, other)))) {
        errors.push({ code: 'text-overlap', keys: [a.key, b.key] });
      }
    }
    const regions = [...frame.querySelectorAll('[data-region]')].map(el => ({ id: el.dataset.region, ...box(el) }));
    for (const region of regions) {
      if (!fits(region, box(frame))) errors.push({ code: 'region-outside-frame', key: region.id });
    }
    const objects = [...frame.querySelectorAll('[data-ppt-root], [data-ppt-kind]:not([data-ppt-kind="text"])')]
      .map(el => ({
        id: el.dataset.pptName ?? el.className, kind: el.dataset.pptKind ?? 'asset-root', ...box(el),
        slot: el.closest('.slot')?.dataset.region,
      }));
    for (const object of objects) {
      if (!fits(object, box(frame))) errors.push({ code: 'object-outside-frame', key: object.id });
      const slot = regions.find(region => region.id === object.slot);
      if (slot && !fits(object, slot)) errors.push({ code: 'object-outside-slot', key: object.id, slot: object.slot });
    }
    const labels = [...frame.querySelectorAll('[data-label]')].map(el => ({
      text: el.textContent, box: box(el), fontSize: parseFloat(getComputedStyle(el).fontSize),
    }));
    for (const label of labels) {
      if (label.fontSize < 18) errors.push({ code: 'body-font', key: label.text, fontSize: label.fontSize });
      if (!fits(label.box, box(frame))) errors.push({ code: 'label-outside-frame', key: label.text });
    }
    const comparisonRows = [...frame.querySelectorAll('.criterion')].map(criterion => {
      const row = criterion.dataset.compareRow;
      const cells = [...frame.querySelectorAll(`[data-compare-row="${row}"]`)].map(box);
      const first = cells[0];
      if (cells.length !== 3 || cells.some(cell => Math.abs(cell.y - first.y) > 1 || Math.abs(cell.height - first.height) > 1)) {
        errors.push({ code: 'comparison-row-misaligned', key: row });
      }
      return { label: criterion.textContent, cells };
    });
    const body = text.filter(node => node.inBody);
    const visibleBottom = Math.max(...body.flatMap(node => node.lines.map(line => line.y + line.height)));
    return {
      canvas: box(document.querySelector('.slide')), contentFrame: box(frame), text, regions, objects, labels, comparisonRows, errors,
      minBodyFont: body.length ? Math.min(...[...body, ...labels].map(node => node.fontSize)) : null,
      bodyTextBottomClearance: Number.isFinite(visibleBottom) ? box(frame).y + box(frame).height - visibleBottom : null,
    };
  }, bindings);
}
