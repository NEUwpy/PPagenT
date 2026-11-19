import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { htmlComponentThemeCss } from '../../../src/visual-runtime/html-component-theme.mjs';
import { htmlTextFlowCss } from '../../../src/visual-runtime/text-flow.mjs';
import { checkCoverage, measurePage } from './measure.mjs';
import { buildPlan, canvas, escapeHtml, outputPath, plans, probeAssetGates, relations, sha256, theme } from './pages.mjs';

const executablePath = process.env.BROWSER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const css = await fs.readFile(outputPath('pages.css'), 'utf8');
const artifactFiles = ['outputs', 'evidence'];
for (const directory of artifactFiles) await fs.mkdir(outputPath(directory), { recursive: true });
const writeJson = (relative, value) => fs.writeFile(outputPath(relative), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

let compiler;
let compilerLoadError;
try {
  compiler = await import('../../../src/visual-runtime/html-component-runtime.mjs');
} catch (error) {
  compilerLoadError = error.message;
}

async function project(id, markup, styles, source, bindings, measured) {
  const evidence = `evidence/${id}-handoff.json`;
  const report = { compiler: 'src/visual-runtime/html-component-runtime.mjs#resolveHtmlComponent',
    status: 'rejected', issues: [], observedObjects: [], materializedSoftWraps: [] };
  try {
    if (!compiler) throw new Error(compilerLoadError);
    const tree = await compiler.resolveHtmlComponent({
      component: { id, schemaVersion: 6, designFrame: canvas, cssText: styles, renderMarkup: () => markup },
      parameters: {}, assetDir: outputPath('.'), targetFrame: canvas, theme,
      screenshotPath: outputPath(`evidence/${id}-compiled-dom.png`),
    });
    const nodes = new Map(tree.nodes.map(node => [node.name, node]));
    report.observedObjects = measured.unsupported.map(effect => ({ ...effect, compiled: nodes.get(effect.id) ?? null }));
    for (const effect of measured.unsupported) {
      report.issues.push({ code: 'unrepresented-css-effect', ...effect });
    }
    for (const text of measured.text) {
      const native = nodes.get(text.id);
      if (!native) {
        report.issues.push({ code: 'missing-native-text', id: text.id });
        continue;
      }
      if (text.text !== native.text) {
        // These fixtures use no authored newlines within leaves. Existing visual wraps may appear as line breaks in the native tree.
        const exactAfterJoining = native.text.replaceAll('\n', '') === text.text;
        const sameLines = native.text === text.visualLines.join('\n');
        if (exactAfterJoining && sameLines) {
          report.materializedSoftWraps.push({ id: text.id, lines: text.visualLines.length, wrap: native.style.wrap });
        } else {
          report.issues.push({ code: exactAfterJoining ? 'native-wrap-changed' : 'native-text-changed', id: text.id,
            measuredLines: text.visualLines, compiled: native.text });
        }
      }
      const fontDelta = Math.abs(text.typography.fontSize - native.style.fontSize);
      if (fontDelta > 0.15) report.issues.push({ code: 'native-font-changed', id: text.id, fontDelta });
      const delta = Object.fromEntries(Object.entries(text.frame).map(([key, value]) => [key, native.frame[key] - value]));
      if (Object.values(delta).some(value => Math.abs(value) > 1)) {
        report.issues.push({ code: 'native-text-geometry-changed', id: text.id, delta });
      }
    }
    for (const object of measured.objects.filter(object => object.visible)) {
      if (!nodes.has(object.id)) report.issues.push({ code: 'missing-native-object', id: object.id });
    }
    report.status = report.issues.length ? 'mismatch' : 'matched-checked-fields';
    report.nativeCounts = Object.fromEntries([...new Set(tree.nodes.map(node => node.kind))]
      .map(kind => [kind, tree.nodes.filter(node => node.kind === kind).length]));
    report.tree = tree;
    report.textSourceBindings = { sourceFile: source.file, sourceSha256: source.sha256, spans: bindings };
  } catch (error) {
    const message = error.message;
    report.issues.push({ code: 'repository-compiler-rejected', message });
  }
  await writeJson(evidence, report);
  return { evidence, status: report.status, nativeCounts: report.nativeCounts, issues: report.issues };
}

const browser = await chromium.launch({ executablePath, headless: true });
const cases = [];
try {
  await writeJson('evidence/asset-gates.json', await probeAssetGates());
  const page = await browser.newPage({ viewport: { width: canvas.width, height: canvas.height }, deviceScaleFactor: 1 });
  for (const plan of plans) {
    const { id } = plan;
    const { markup, assetCss, bindings, frame, source, assetCalls } = await buildPlan(plan);
    const styles = `${htmlComponentThemeCss(theme)}\n${htmlTextFlowCss()}\n${assetCss}\n${css}`;
    const document = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(source.blocks[0].text)}</title><style>${styles}</style></head><body>${markup}</body></html>`;
    const html = `outputs/${id}.html`;
    const png = `outputs/${id}.png`;
    const evidence = `evidence/${id}.json`;
    await fs.writeFile(outputPath(html), document, 'utf8');
    await page.setContent(document, { waitUntil: 'load' });
    const measured = await measurePage(page);
    await page.screenshot({ path: outputPath(png), animations: 'disabled' });
    const coverage = checkCoverage(measured, source, bindings);
    const grayValid = coverage.exact && measured.issues.length === 0;
    const handoff = plan.project && grayValid
      ? await project(id, markup, styles, source, bindings, measured)
      : { status: 'skipped-geometry-failure' };
    const status = !grayValid ? 'rejected' : handoff.status === 'matched-checked-fields' ? 'passed' : 'partial';
    await writeJson(evidence, { id, status, source, bindings, declaredFrame: frame, relation: relations[plan.input], assetCalls,
      selection: '由本窗口模型离线编制并冻结', htmlSha256: sha256(document), measured, coverage, handoff });
    cases.push({ id, status, html, png, details: { evidence, input: plan.input, frame, characters: coverage.characters,
      exactSource: coverage.exact, minBodyFontPx: measured.minBodyFontPx, measurementErrors: measured.issues.length,
      handoff: handoff.status, handoffEvidence: handoff.evidence } });
    console.log(`${id} ${status} · ${coverage.characters} chars · ${measured.issues.length} measurement errors · ${handoff.status}`);
  }
  await writeJson('results.json', { route: 'C', browser: browser.version(), node: process.version, canvas, cases });
} finally {
  await Promise.all([browser.close(), compiler?.closeHtmlComponentRuntime()]);
}
