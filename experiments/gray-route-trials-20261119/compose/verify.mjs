import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { startBrowser } from './measure.mjs';

const read = relative => fs.readFile(new URL(encodeURI(relative), import.meta.url));
const json = async relative => JSON.parse(await read(relative));
const summary = await json('results.json');
const browser = await startBrowser();
const verified = [];
try {
  const page = await browser.newPage({ viewport: summary.canvas });
  for (const item of summary.cases) {
    const geometry = await json(item.details.geometry);
    const trace = await json(item.details.trace);
    const raw = await read(`../../../${geometry.source.file}`);
    const source = raw.toString('utf8');
    assert.equal(createHash('sha256').update(raw).digest('hex'), geometry.source.sha256, item.id);
    assert.equal(trace.trials.length, item.details.candidates, item.id);
    assert.equal(trace.trials.filter(t => t.measured).length, item.details.measured, item.id);
    assert.equal(trace.trials.filter(t => ['selected', 'lower-ranked'].includes(t.decision)).length, item.details.eligible, item.id);
    assert.equal(trace.selected, geometry.chosen, item.id);
    const bindings = geometry.source.bindings;
    const expected = bindings.map(b => ({ id: b.id, source: b.sourceId, text: source.slice(...b.span) }));
    assert.deepEqual(bindings.map(b => b.text), expected.map(b => b.text), item.id);
    assert.deepEqual(geometry.readingOrder, expected.map(b => b.id), item.id);
    for (const block of geometry.source.blocks) {
      assert.equal(expected.filter(b => b.source === block.id).map(b => b.text).join(''), block.text, item.id);
    }
    if (item.id.startsWith('hr')) {
      assert.ok(expected.some(b => b.text.startsWith('2017年的巡视整改虽然取得了一定成效，')), item.id);
      assert.ok(expected.at(-1).text.endsWith('作风改进不要求立竿见影，重在持续用力。'), item.id);
      assert.deepEqual(geometry.relations[0], { type: 'independent', members: ['issues', 'insights'] }, item.id);
    }
    const chosen = trace.trials.find(t => t.decision === 'selected');
    if (item.status === 'rejected') {
      assert.equal(chosen, undefined, item.id);
      assert.equal(geometry.measured, null, item.id);
      assert.ok(trace.trials.every(t => t.issues.length), item.id);
    } else {
      assert.equal(item.status, 'passed', item.id);
      assert.equal(chosen.candidate.id, item.details.selected, item.id);
      assert.deepEqual(chosen.issues, [], item.id);
    }

    const preview = item.status === 'passed' ? item : item.details.diagnostic;
    const png = await read(preview.png);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', item.id);
    assert.equal(png.readUInt32BE(16), summary.canvas.width, item.id);
    assert.equal(png.readUInt32BE(20), summary.canvas.height, item.id);
    await page.goto(new URL(preview.html, import.meta.url).href);
    await page.evaluate(() => document.fonts.ready);
    const reopened = await page.evaluate(() => {
      const frame = document.querySelector('[data-content-frame]');
      const { x, y, width, height } = frame.getBoundingClientRect();
      const leaves = [...document.querySelectorAll('[data-bind]')].map(node => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const lines = [...range.getClientRects()];
        const size = parseFloat(getComputedStyle(node).fontSize);
        const limit = (frame.contains(node) ? frame : document.querySelector('.slide')).getBoundingClientRect();
        const inFrame = lines.length > 0 && lines.every(line => line.left >= limit.left - 0.75 && line.top >= limit.top - 0.75
          && line.right <= limit.right + 0.75 && line.bottom <= limit.bottom + 0.75);
        return { id: node.dataset.bind, source: node.dataset.source, text: node.textContent, size, inFrame };
      });
      return { leaves, frame: { x, y, width, height }, rasterCount: document.querySelectorAll('img,canvas').length };
    });
    assert.deepEqual(reopened.frame, geometry.frame, item.id);
    assert.equal(reopened.rasterCount, 0, item.id);
    assert.deepEqual(reopened.leaves.map(({ id, source, text }) => ({ id, source, text })), expected, item.id);
    assert.ok(reopened.leaves.every(leaf => leaf.size >= 18), item.id);
    if (item.status === 'passed') assert.ok(reopened.leaves.every(leaf => leaf.inFrame), item.id);
    verified.push({ id: item.id, status: item.status, bindings: bindings.length, allTextInFrame: reopened.leaves.every(b => b.inFrame), preview: preview.html });
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(verified, null, 2));
