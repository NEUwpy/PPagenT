import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

export async function startBrowser() {
  const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean);
  const paths = [process.env.BROWSER_EXECUTABLE_PATH, ...roots.flatMap(root => [
    path.join(root, 'Google/Chrome/Application/chrome.exe'), path.join(root, 'Microsoft/Edge/Application/msedge.exe'),
  ])].filter(Boolean);
  for (const executablePath of paths) {
    if (await fs.access(executablePath).then(() => true, () => false)) return chromium.launch({ executablePath, headless: true });
  }
  return chromium.launch({ headless: true });
}

export async function measurePage(page, html) {
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const tolerance = 0.75;
    const slide = document.querySelector('.slide');
    const frame = document.querySelector('[data-content-frame]');
    const round = n => Math.round(n * 100) / 100;
    const box = rect => ({ x: round(rect.x), y: round(rect.y), width: round(rect.width), height: round(rect.height) });
    const exceeds = (r, outer) => round(Math.max(0, outer.left - r.left, outer.top - r.top, r.right - outer.right, r.bottom - outer.bottom));
    const issues = [];
    const addIssue = (code, target, excess) => issues.push({ code, target, ...(excess === undefined ? {} : { excess }) });
    const frameRect = frame.getBoundingClientRect();
    const canvasRect = slide.getBoundingClientRect();
    const geometry = [...document.querySelectorAll('[data-geometry]')].map(el => {
      const rect = el.getBoundingClientRect();
      if (el !== frame) {
        const overflow = exceeds(rect, frameRect);
        if (overflow > tolerance) addIssue('region-exceeds-frame', el.dataset.geometry, overflow);
      }
      return { id: el.dataset.geometry, component: el.dataset.component ?? null, rect: box(rect) };
    });
    const boundElements = [...document.querySelectorAll('[data-bind]')];
    const text = boundElements.map(el => {
      const style = getComputedStyle(el);
      const fontPx = parseFloat(style.fontSize);
      const range = new Range();
      range.selectNodeContents(el);
      const lines = [...range.getClientRects()].filter(r => r.width > 0);
      const bounds = frame.contains(el) ? frameRect : canvasRect;
      const clips = [];
      for (let parent = el.parentElement; parent && parent !== slide; parent = parent.parentElement) {
        const { overflowX, overflowY } = getComputedStyle(parent);
        if ([overflowX, overflowY].some(v => ['hidden', 'clip', 'auto', 'scroll'].includes(v))) clips.push(parent);
      }
      if (fontPx < 18) addIssue('font-under-floor', el.dataset.bind, round(18 - fontPx));
      if (!lines.length || style.visibility !== 'visible' || el.checkVisibility({ opacityProperty: true }) === false) addIssue('invisible-text', el.dataset.bind);
      for (const line of lines) {
        const outer = exceeds(line, bounds);
        if (outer > tolerance) addIssue('text-exceeds-frame', el.dataset.bind, outer);
        for (const clip of clips) {
          const clipBounds = clip.getBoundingClientRect();
          const overflow = exceeds(line, clipBounds);
          if (overflow > tolerance) {
            addIssue('text-clipped-by', `${el.dataset.bind} / ${clip.classList[0] || clip.tagName}`, overflow);
            break;
          }
        }
      }
      const role = el.matches('h1') ? 'slide-title' : el.matches('h2') ? 'group-title' :
        el.matches('h3,.ppagent-text-primitive--heading') ? 'item-title' : 'body';
      return { id: el.dataset.bind, sourceId: el.dataset.source, role, text: el.textContent, fontPx, fontFamily: style.fontFamily,
        fontWeight: Number(style.fontWeight), lineHeightPx: parseFloat(style.lineHeight), alignment: style.textAlign,
        color: style.color, rect: box(el.getBoundingClientRect()), lines: lines.map(box) };
    });
    const primitives = [...frame.querySelectorAll('[data-ppt-kind]')].filter(el => getComputedStyle(el).display !== 'none').map(el => {
      const { backgroundColor, borderColor, borderWidth, borderRadius, stroke, strokeWidth, fill, boxShadow, opacity } = getComputedStyle(el);
      return { name: el.dataset.pptName ?? null, kind: el.dataset.pptKind, shape: el.dataset.pptShape ?? null, bind: el.dataset.bind ?? null,
        rect: box(el.getBoundingClientRect()), backgroundColor, borderColor, borderWidth, borderRadius, boxShadow, opacity,
        path: el.getAttribute('d'), stroke, strokeWidth, fill, transform: el.getAttribute('transform'),
        svg: el.tagName.toLowerCase() === 'svg' ? el.outerHTML : null };
    });
    const graph = document.querySelector('.merge');
    const edges = [];
    if (graph) {
      const inputs = [...graph.querySelectorAll('.input')].map(el => el.getBoundingClientRect());
      const result = graph.querySelector('.result').getBoundingClientRect();
      inputs.forEach((input, i) => {
        if (i > 0 && input.top - inputs[i - 1].bottom < 7) addIssue('convergence-input-spacing', `factor-${i + 1}`, round(7 - input.top + inputs[i - 1].bottom));
        if (result.left - input.right < 48) addIssue('convergence-path-span', `factor-${i + 1}`, round(48 - result.left + input.right));
      });
      const root = graph.getBoundingClientRect();
      const drawing = graph.querySelector('svg').getBoundingClientRect();
      const svgOverflow = exceeds(drawing, root);
      if (svgOverflow > tolerance) addIssue('convergence-svg-frame-mismatch', 'graph', svgOverflow);
      for (const [i, path] of [...graph.querySelectorAll('svg path')].entries()) {
        const endpoint = length => path.getPointAtLength(length).matrixTransform(path.getScreenCTM());
        const start = endpoint(0);
        const end = endpoint(path.getTotalLength());
        const error = round(Math.max(
          Math.hypot(start.x - inputs[i].right, start.y - (inputs[i].top + inputs[i].height / 2)),
          Math.hypot(end.x - result.left, end.y - (result.top + result.height / 2)),
        ));
        if (error > tolerance) addIssue('convergence-anchor-mismatch', path.dataset.pptName, error);
        edges.push({ from: `factor-${i + 1}`, to: 'effect', start: [round(start.x), round(start.y)],
          end: [round(end.x), round(end.y)], errorPx: error, path: path.getAttribute('d') });
      }
    }
    const cards = [...frame.querySelectorAll('.parallel-card')];
    const cardGeometry = cards.map(card => {
      const marker = card.querySelector('.parallel-marker').getBoundingClientRect();
      const rect = card.getBoundingClientRect();
      if (Math.abs(marker.width - marker.height) > tolerance) addIssue('noncircular-card-anchor', card.dataset.key);
      return { item: card.dataset.key, rect: box(rect), marker: box(marker) };
    });
    if (cards.length > 0 && cardGeometry.some(card => Math.abs(card.rect.width - cardGeometry[0].rect.width) > tolerance
        || Math.abs(card.rect.height - cardGeometry[0].rect.height) > tolerance)) addIssue('unequal-service-cards', 'services');
    // Font metric boxes can overlap vertically in ordinary inline flow. CSS
    // already places adjoining spans in one paragraph, so check across flows.
    for (const [i, left] of text.entries()) {
      for (let j = i + 1; j < text.length; j += 1) {
        const leftFlow = boundElements[i].closest('p');
        if (leftFlow && leftFlow === boundElements[j].closest('p')) continue;
        const right = text[j];
        const overlap = left.lines.some(a => right.lines.some(b =>
          Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1.5
          && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1.5));
        if (overlap) addIssue('text-overlap', `${left.id} / ${right.id}`);
      }
    }
    const extent = Math.max(...geometry.filter(g => g.id !== 'content-frame').map(g => g.rect.y + g.rect.height)) - frameRect.top;
    return { frame: box(frameRect), usedHeight: round(extent), headroom: round(frameRect.height - extent), text, geometry, primitives,
      edges, cardGeometry, issues,
      fonts: [...document.fonts].map(font => font.family), requestedFontAvailable: document.fonts.check('18px "Microsoft YaHei"') };
  });
}

export function auditBindings(plan, measured) {
  const issues = [];
  for (const [index, expected] of plan.bindings.entries()) {
    const leaf = measured.text[index];
    if (!leaf || leaf.id !== expected.id || leaf.sourceId !== expected.sourceId || leaf.text !== expected.text) {
      issues.push({ code: 'binding-order-or-text', target: expected.id });
    }
  }
  if (measured.text.length !== plan.bindings.length) issues.push({ code: 'binding-count', target: measured.text.length });
  return issues;
}
