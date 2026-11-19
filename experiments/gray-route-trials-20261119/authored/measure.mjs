export async function measurePage(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const content = document.querySelector('[data-content-frame]');
    const root = document.querySelector('[data-ppt-root]');
    const round = n => Number(n.toFixed(3));
    const box = b => ({ left: round(b.left), top: round(b.top), width: round(b.width), height: round(b.height) });
    const issues = [];
    const inside = (a, b, tolerance = 1) => a.left >= b.left - tolerance && a.top >= b.top - tolerance
      && a.left + a.width <= b.left + b.width + tolerance && a.top + a.height <= b.top + b.height + tolerance;
    const overlap = (a, b) => a.left < b.left + b.width - 1 && b.left < a.left + a.width - 1
      && a.top < b.top + b.height - 1 && b.top < a.top + a.height - 1;
    const visible = el => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    const frame = box(content.getBoundingClientRect());
    const slide = box(root.getBoundingClientRect());
    const regions = [...root.querySelectorAll('[data-component],[data-slot-id]')].map(el => ({
      id: el.dataset.component ?? el.dataset.slotId, field: el.dataset.slotField ?? null, frame: box(el.getBoundingClientRect()),
    }));
    const fonts = new Set();
    const text = [...root.querySelectorAll('[data-bind]')].map(el => {
      const inBody = content.contains(el);
      const parent = el.closest('.ppagent-text-region,[data-component]');
      const parentBox = parent && box(parent.getBoundingClientRect());
      const id = el.dataset.bind;
      const style = getComputedStyle(el);
      const fontSize = Number.parseFloat(style.fontSize);
      if (inBody) fonts.add(fontSize);
      const rects = [];
      const stringsByLine = new Map();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const range = new Range();
        range.selectNodeContents(node);
        rects.push(...[...range.getClientRects()].filter(r => r.height && r.width).map(box));
        let offset = 0;
        for (const character of node.textContent) {
          range.setStart(node, offset);
          offset += character.length;
          range.setEnd(node, offset);
          const { top, width } = range.getBoundingClientRect();
          if (!width) continue;
          const lineTop = Math.round(top * 2) / 2;
          stringsByLine.set(lineTop, (stringsByLine.get(lineTop) || '') + character);
        }
      }
      const hidden = !visible(el) || rects.length === 0;
      if (hidden) issues.push({ code: 'text-hidden', id });
      if (inBody && fontSize < 18) issues.push({ code: 'font-below-18px', id, fontSize });
      if (rects.some(r => !inside(r, inBody ? frame : slide))) issues.push({ code: 'text-outside-frame', id });
      if (parentBox && rects.some(r => !inside(r, parentBox))) {
        issues.push({ code: 'text-outside-slot', id, slot: parent.dataset.slotId ?? parent.dataset.component });
      }
      const clippedBy = new Set();
      for (let ancestor = el; ancestor && ancestor !== root; ancestor = ancestor.parentElement) {
        const clipping = getComputedStyle(ancestor);
        if (clipping.overflowX === 'visible' && clipping.overflowY === 'visible') continue;
        const bounds = box(ancestor.getBoundingClientRect());
        if (rects.some(r => !inside(r, bounds))) clippedBy.add(ancestor.className || ancestor.tagName);
      }
      if (clippedBy.size) issues.push({ code: 'text-clipped', id, by: [...clippedBy] });
      return { id, text: el.textContent, source: el.dataset.source, frame: box(el.getBoundingClientRect()),
        lineBoxes: rects, visualLines: [...stringsByLine.values()].map(line => line.trim()), lineCount: stringsByLine.size, inBody,
        typography: { fontSize, family: style.fontFamily, weight: style.fontWeight, lineHeight: style.lineHeight, align: style.textAlign },
      };
    });
    for (const [i, a] of text.entries()) {
      for (const b of text.slice(i + 1)) {
        if (a.lineBoxes.some(ar => b.lineBoxes.some(br => overlap(ar, br)))) issues.push({ code: 'text-overlap', ids: [a.id, b.id] });
      }
    }
    const unsupported = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (node.textContent.trim() && !el.closest('[data-bind],style,script,svg title,svg desc') && visible(el)) {
        issues.push({ code: 'visible-unbound-text', text: node.textContent });
      }
    }
    const objects = [...root.querySelectorAll('[data-ppt-kind]')].map(el => {
      const style = getComputedStyle(el);
      const id = el.dataset.pptName;
      if (style.clipPath !== 'none') unsupported.push({ id, property: 'clip-path', computed: style.clipPath });
      if (style.transform !== 'none') unsupported.push({ id, property: 'transform', computed: style.transform });
      return { id, kind: el.dataset.pptKind, frame: box(el.getBoundingClientRect()), visible: visible(el),
        component: el.closest('[data-component]')?.dataset.component ?? null };
    });
    for (const region of regions.filter(region => !region.field)) {
      if (!inside(region.frame, frame)) issues.push({ code: 'component-outside-frame', id: region.id });
    }
    return { slide, frame, text, regions, objects, issues, unsupported,
      minBodyFontPx: fonts.size ? Math.min(...fonts) : null, imageCount: root.querySelectorAll('img').length };
  });
}

export function checkCoverage(measurement, source, bindings) {
  const reconstructed = Object.fromEntries(source.blocks.map(block => [block.id, '']));
  const seen = new Set();
  const issues = [];
  let previousBlock = 0;
  const order = new Map(source.blocks.map((block, index) => [block.id, index]));
  for (const leaf of measurement.text) {
    const expected = bindings[leaf.id];
    if (!expected || seen.has(leaf.id)) {
      issues.push({ code: 'unexpected-binding', id: leaf.id });
      continue;
    }
    seen.add(leaf.id);
    const expectedSource = `${source.file}#${expected.block}:${expected.start}-${expected.end}`;
    if (leaf.text !== expected.text || leaf.source !== expectedSource) issues.push({ code: 'source-mismatch', id: leaf.id });
    if (previousBlock > order.get(expected.block) || reconstructed[expected.block].length !== expected.start) {
      issues.push({ code: 'source-order-or-span', id: leaf.id });
    }
    previousBlock = order.get(expected.block);
    reconstructed[expected.block] += leaf.text;
  }
  for (const id of Object.keys(bindings)) {
    if (!seen.has(id)) issues.push({ code: 'missing-binding', id });
  }
  for (const block of source.blocks) {
    if (reconstructed[block.id] !== block.text) issues.push({ code: 'incomplete-source-block', id: block.id });
  }
  return { exact: issues.length === 0, issues, boundLeaves: seen.size,
    characters: Object.values(reconstructed).reduce((sum, text) => sum + [...text].length, 0) };
}
