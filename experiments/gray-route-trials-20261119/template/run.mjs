import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { splitSources } from '../../../src/runner/state.mjs';
import { composePageLayout } from '../../../src/visual-runtime/page-layout-library.mjs';
import { textRegionMarkup } from '../../../src/visual-runtime/text-layout-library.mjs';
import { htmlTextFlowCss } from '../../../src/visual-runtime/text-flow.mjs';
import { compileHtmlComponentTheme, htmlComponentThemeCss } from '../../../src/visual-runtime/html-component-theme.mjs';
import { closeHtmlComponentRuntime, resolveHtmlComponent } from '../../../src/visual-runtime/html-component-runtime.mjs';
import { visualComponent as notes } from '../../../assets/结构图/双排折角便签-002/review.mjs';
import { cases, bindManuscript, assertCoverage, comparisonLabels } from './plan.mjs';
import { measure } from './measure.mjs';
import { legacyProbe } from './legacy.mjs';

const dir = import.meta.dirname;
const repo = path.resolve(dir, '../../..');
const assetPath = 'assets/结构图/双排折角便签-002';
const assetDir = path.join(repo, assetPath);
const out = path.join(dir, 'output');
const meta = path.join(dir, 'evidence');
await Promise.all([fs.mkdir(out, { recursive: true }), fs.mkdir(meta, { recursive: true })]);
const [pageCss, noteCss, noteSource] = await Promise.all([
  fs.readFile(path.join(dir, 'template.css'), 'utf8'),
  fs.readFile(path.join(assetDir, notes.cssFile), 'utf8'),
  fs.readFile(path.join(assetDir, 'review.mjs')),
]);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const baseFrame = { x: 55, y: 166, width: 1170, height: 492 };
const compactFrame = { ...baseFrame, width: 1020, height: 450 };
const theme = {
  font: 'Microsoft YaHei', primaryColor: '#515151',
  typography: {
    componentHeading: 15.75, componentTitle: 16.5, componentItemTitle: 14.25,
    componentLead: 14.25, componentBody: 13.5, componentLabel: 13.5, componentMeta: 13.5,
  },
};
const assetReceipt = {
  asset: assetPath, id: notes.id, schemaVersion: notes.schemaVersion,
  sourceSha256: hash(noteSource), cssSha256: hash(noteCss), textCapacity: notes.textCapacity,
};
const writeJSON = (file, value) => fs.writeFile(path.join(dir, file), JSON.stringify(value, null, 2) + '\n');
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attrs = field => `data-bind="${field.key}" data-source="${field.sourceId}"`;
const injectBinding = (markup, name, field) => markup.replace(`data-ppt-name="${name}"`, `data-ppt-name="${name}" ${attrs(field)}`);
const sourceText = (tag, field) => `<${tag} ${attrs(field)}>${esc(field.text)}</${tag}>`;
const styleBox = ({ x, y, width, height }) => `left:${x}px;top:${y}px;width:${width}px;height:${height}px`;

function textRegion(layoutId, fields) {
  const id = Object.values(fields)[0].key;
  const names = { heading: fields.title?.key, body: fields.body?.key };
  let markup = textRegionMarkup({
    id, field: id, layoutId, names, valign: 'top', density: 'compact',
    content: Object.fromEntries(Object.entries(fields).map(([role, field]) => [role, field.text])),
  });
  for (const field of Object.values(fields)) markup = injectBinding(markup, field.key, field);
  return markup;
}

function comparison(manuscript) {
  const criteria = comparisonLabels.map((label, i) => `<div class="criterion" data-label data-compare-row="${i + 1}">${esc(label)}</div>`).join('');
  const options = manuscript.objects.map(option => `<article class="option">
    ${textRegion('statement-flow', { title: option.title })}
    ${option.cells.map((body, i) => textRegion('statement-flow', { body }).replace('<div ', `<div data-boundary data-compare-row="${i + 1}" `)).join('')}
  </article>`).join('');
  return `<div class="comparison" data-region="comparison-matrix"><div class="criteria"><div></div>${criteria}</div>${options}</div>`;
}

function groupedProse(groups) {
  return `<div class="prose-groups" data-region="grouped-prose">${groups.map(group => {
    const split = Math.ceil(group.items.length / 2);
    const columns = [group.items.slice(0, split), group.items.slice(split)];
    return `<section class="prose-group" data-region="${group.key}">
      ${sourceText('header', group.lead)}
      <div class="prose-columns">${columns.map((items, i) => `<div class="prose-column" data-boundary data-region="${group.key}-column-${i + 1}">
        ${items.map(({ title, body }) => textRegion('heading-content-flow', { title, body })).join('')}
      </div>`).join('')}</div>
    </section>`;
  }).join('')}</div>`;
}

const commonLabels = { options: '共同前置条件', services: '共同入口', dense: '共同要求' };
function commonBand(manuscript) {
  return `<aside class="band"><span class="band-label" data-label>${commonLabels[manuscript.id]}</span>${textRegion('statement-flow', { body: manuscript.shared })}</aside>`;
}

function noteCandidate(items, frame, mode) {
  const parameters = { items: items.map(({ key, title, body, iconKey }) => ({ key, title: title.text, body: body.text, iconKey })) };
  const markup = mode === 'natural'
    ? notes.renderMarkup(parameters)
    : notes.renderAdaptiveMarkup(parameters, { frame, theme });
  const compiled = compileHtmlComponentTheme({ markup, css: noteCss, theme });
  let bound = compiled.markup;
  for (const [i, item] of items.entries()) {
    bound = injectBinding(bound, `note-heading-${i}`, item.title);
    bound = injectBinding(bound, `note-body-${i}`, item.body);
  }
  return { ...compiled, markup: bound, parameters, mode, frame };
}

function documentHtml({ manuscript, frame, body, css = '', rejected = null }) {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(manuscript.title.text)}</title>
<style>${htmlComponentThemeCss(theme)}${htmlTextFlowCss()}${css}${pageCss}</style></head>
<body><main class="slide"${rejected ? ' data-rejected' : ''}>
${sourceText('h1', manuscript.title)}
${rejected ? `<div class="trial-failure">${esc(rejected)}</div>` : ''}
<div data-content-frame data-layout="${manuscript.type}" style="${styleBox(frame)}">${body}</div>
</main></body></html>`;
}

const slot = (id, box, markup) => `<section class="slot" data-boundary data-region="${id}" style="${styleBox(box)}">${markup}</section>`;
async function layoutWithBand(page, manuscript, frame) {
  const band = commonBand(manuscript);
  await page.setContent(documentHtml({ manuscript, frame, body: band }));
  await page.evaluate(() => document.fonts.ready);
  const bandHeight = Math.ceil(await page.locator('.band').evaluate(el => el.getBoundingClientRect().height));
  const gap = 16;
  const mainHeight = frame.height - bandHeight - gap;
  const layout = composePageLayout({
    family: 'cards', direction: 'vertical', width: frame.width, height: frame.height, gap,
    blocks: [{ weight: mainHeight, minHeight: 120 }, { weight: bandHeight, minHeight: bandHeight }],
  });
  return { program: 'composePageLayout/cards/vertical', layout, band, bandHeight };
}

async function render(page, id, manuscript, frame, body, css, bindings, { probe = false } = {}) {
  const folder = probe ? 'evidence' : 'output';
  const html = `${folder}/${id}.html`;
  const png = `${folder}/${id}.png`;
  const content = documentHtml({ manuscript, frame, body, css });
  await page.setContent(content);
  await page.evaluate(() => document.fonts.ready);
  const geometry = await measure(page, bindings);
  const status = geometry.errors.length ? 'rejected' : 'passed';
  const tagged = status === 'rejected'
    ? documentHtml({ manuscript, frame, body, css, rejected: '试排未通过 · 保留原文与失败位置供检查' })
    : content;
  if (tagged !== content) {
    await page.setContent(tagged);
    await page.evaluate(() => document.fonts.ready);
  }
  await Promise.all([
    fs.writeFile(path.join(dir, html), tagged),
    page.screenshot({ path: path.join(dir, png) }),
  ]);
  return { status, html, png, geometry };
}

async function tryNotes(page, id, manuscript, items, frame, compFrame, mode, build, bindings) {
  let asset;
  try {
    asset = noteCandidate(items, compFrame, mode);
  } catch (error) {
    return { mode, status: 'rejected', stage: 'asset-parameters', message: error.message, frame: compFrame };
  }
  return {
    mode, stage: 'browser-measurement', frame: compFrame, parameters: asset.parameters,
    ...await render(page, id, manuscript, frame, build(asset.markup), asset.css, bindings, { probe: true }),
  };
}

async function compilerProbe(items, frame) {
  const candidate = noteCandidate(items, frame, 'adaptive');
  try {
    const tree = await resolveHtmlComponent({
      component: notes, parameters: candidate.parameters, assetDir, theme,
      targetFrame: { left: frame.x, top: frame.y, width: frame.width, height: frame.height },
      adaptation: { status: 'verified' }, // Exercise the adaptive resolver code path only.
    });
    return {
      status: 'passed', frame: tree.frame,
      nodes: tree.nodes.map(({ name, kind, frame }) => ({ name, kind, frame })),
      slots: tree.slots,
    };
  } catch (error) {
    return { status: 'rejected', message: error.message };
  }
}

const executablePath = process.env.BROWSER_EXECUTABLE_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
process.env.BROWSER_EXECUTABLE_PATH = executablePath;
const browser = await chromium.launch({ executablePath, headless: true });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  for (const plan of cases) {
    const filename = path.join(repo, plan.file);
    const bytes = await fs.readFile(filename);
    const raw = bytes.toString('utf8');
    const sources = splitSources(raw);
    const manuscript = bindManuscript(plan, sources);
    assertCoverage(sources, manuscript.bindings);
    const sizes = ['hr', 'services'].includes(plan.id) ? [baseFrame, compactFrame] : [baseFrame];
    for (const frame of sizes) {
      const compact = frame === compactFrame;
      const id = compact ? `${plan.id}-compact` : plan.id;
      const report = {
        id, source: { path: plan.file, sha256: hash(bytes), sources }, bindings: manuscript.bindings,
        contentFrame: frame, frozenPlan: plan, presentationMetadata: plan.type === 'comparison' ? { comparisonLabels } : {},
        assets: [], probes: [],
      };
      let final;
      if (plan.type === 'grouped-prose') {
        report.program = 'grouped-prose/two-columns-per-group';
        report.textComponents = ['heading-content-flow'];
        final = await render(page, id, manuscript, frame, groupedProse(manuscript.groups), '', manuscript.bindings);
        if (!compact) {
          const group = manuscript.groups[1];
          const measured = final.geometry.regions.find(region => region.id === group.key);
          const offset = { x: 0, y: measured.y - frame.y, width: measured.width, height: measured.height };
          const items = group.items.map((item, i) => ({ ...item, iconKey: plan.icons[i] }));
          const build = markup => slot('insights-asset', offset, markup);
          const assetBindings = [manuscript.title, ...items.flatMap(item => [item.title, item.body])];
          report.assets.push({ ...assetReceipt, use: 'probe only' });
          report.probes.push({ id: 'hr-notes-natural', ...await tryNotes(page, 'hr-notes-natural', manuscript, items, frame, offset, 'natural', build, assetBindings) });
          report.probes.push({ id: 'hr-notes-adaptive', ...await tryNotes(page, 'hr-notes-adaptive', manuscript, items, frame, offset, 'adaptive', build, assetBindings) });
        }
      } else {
        const { program, layout, band, bandHeight } = await layoutWithBand(page, manuscript, frame);
        report.program = program;
        report.layout = layout;
        report.sharedBandHeight = bandHeight;
        report.presentationMetadata.sharedLabel = commonLabels[manuscript.id];
        report.sharedScope = { source: manuscript.shared.sourceId, appliesTo: manuscript.objects.map(item => item.key) };
        const [mainSlot, bandSlot] = layout.slots;
        const build = markup => slot('main', mainSlot, markup) + slot('shared', bandSlot, band);
        if (plan.type === 'comparison') {
          report.textComponents = ['statement-flow'];
          report.component = 'local-neutral-comparison-with-aligned-rows';
          final = await render(page, id, manuscript, frame, build(comparison(manuscript)), '', manuscript.bindings);
        } else {
          report.assets.push({ ...assetReceipt, use: 'main slot' });
          report.textComponents = ['heading-content-flow (asset)', 'statement-flow (band)'];
          if (!compact) report.probes.push({
            id: `${id}-natural`,
            ...await tryNotes(page, `${id}-natural`, manuscript, manuscript.objects, frame, mainSlot, 'natural', build, manuscript.bindings),
          });
          const actual = noteCandidate(manuscript.objects, mainSlot, 'adaptive');
          report.assetParameters = actual.parameters;
          final = await render(page, id, manuscript, frame, build(actual.markup), actual.css, manuscript.bindings);
          report.assetCompiler = await compilerProbe(manuscript.objects, mainSlot);
        }
      }
      if (!compact) report.existingRunner = legacyProbe(raw, filename, frame, manuscript);
      const evidence = `evidence/${id}.json`;
      await writeJSON(evidence, { ...report, ...final, browser: browser.version() });
      const { geometry } = final;
      results.push({ id, status: final.status, html: final.html, png: final.png, details: {
        evidence, program: report.program, contentFrame: frame, minBodyFont: geometry.minBodyFont,
        errorCount: geometry.errors.length, errorCodes: [...new Set(geometry.errors.map(error => error.code))],
        bodyTextBottomClearance: geometry.bodyTextBottomClearance,
      } });
      console.log(`${id}: ${final.status}; ${geometry.errors.map(error => error.code).join(', ') || 'bound text and geometry fit'}`);
    }
  }
} finally {
  await browser.close();
  await closeHtmlComponentRuntime();
}
await writeJSON('results.json', { cases: results });
