import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cases, planFor } from './plans.mjs';
import { capabilities, loadComponents, renderCandidate } from './components.mjs';
import { auditBindings, measurePage, startBrowser } from './measure.mjs';

const canvas = { width: 1280, height: 720 };
const graph = 'convergence-many-to-one-003';
const cards = 'parallel-equal-cards-001';
const output = new URL('./output/', import.meta.url);
const root = new URL('../../../', import.meta.url);
const resultUrl = new URL('results.json', import.meta.url);
const argv = process.argv.slice(2);
const stage = argv.includes('--initial') ? 'initial' : 'final';

function candidates(kind, plan, frame) {
  const text = (component, cols, bodyPx, priority) => ({ id: `${component}-${cols}col-${bodyPx}`, component, cols, bodyPx, priority });
  if (kind === 'options') return [
    text('comparison-columns', 2, 22, 60), text('comparison-columns', 2, 20, 60),
    text('comparison-columns', 2, 18, 60), text('comparison-columns', 1, 20, 40),
  ];
  if (kind === 'services') return [
    { id: 'cards-original', component: cards, compact: false, height: 492, bodyPx: 18, priority: 0, baseline: true },
    ...[228, 276, 328].map(height => ({ id: `cards-adaptive-${height}`, component: cards, compact: true, height, bodyPx: 20, priority: 80 })),
    text('parallel-text', 4, 20, 45), text('parallel-text', 2, 20, 37),
  ];
  if (kind === 'dense') return [
    ...[2, 4, 1].flatMap(cols => [20, 18].map(px => text('parallel-text', cols, px, 50))),
    { id: 'cards-adaptive-pressure', component: cards, compact: true, height: 420, bodyPx: 18, priority: 60 },
  ];
  const used = frame.width - 24;
  const fractions = [0.46, 0.52, 0.57];
  const candidates = [
    { id: 'hr-graph-stock', component: graph, profile: 'stock', layout: 'side', bodyPx: 18, height: 232, left: Math.round(used * 0.52), priority: 0, baseline: true },
    ...fractions.flatMap(fraction => [196, 232, 260].map(height => ({
      id: `hr-graph-${fraction}-${height}`, component: graph, layout: 'side', bodyPx: 18,
      left: Math.round(used * fraction), height, priority: 70, fraction,
    }))),
    ...[0.43, 0.49].flatMap(fraction => [20, 18].map(bodyPx => ({
      id: `hr-side-${fraction}-${bodyPx}`, component: 'independent-groups', layout: 'side', bodyPx, left: Math.round(used * fraction), priority: 45, fraction,
    }))),
    { id: 'hr-bands-two', component: 'independent-groups', layout: 'bands', bodyPx: 18, priority: 50 },
    { id: 'hr-bands-four', component: 'independent-groups', layout: 'bands bands-four', bodyPx: 18, priority: 50 },
  ];
  if (stage === 'final') {
    for (const fraction of [0.36, 0.41]) {
      candidates.push({ id: `hr-side-compact-${fraction}`, component: 'independent-groups',
        layout: 'side dense-flow', bodyPx: 18, left: Math.round(used * fraction), priority: 42, fraction });
    }
  }
  if (plan.relations.find(relation => relation.type === 'converges-to')?.from.length !== 3) {
    return candidates.filter(candidate => candidate.component !== graph);
  }
  return candidates;
}

function compatible(candidate, plan) {
  const { accepts, count } = capabilities[candidate.component];
  const relation = plan.relations.find(rel => rel.type === accepts);
  const members = relation?.members ?? relation?.from;
  return members && members.length >= count[0] && members.length <= count[1];
}

function merit(trial) {
  const { candidate, measured } = trial;
  const reserve = Math.min(measured.headroom, 110);
  const score = candidate.priority * 100 + candidate.bodyPx * 30 + reserve;
  // Reserve matters up to 110px. Equal scores favor the smaller asset and more balanced split.
  return score - (candidate.height ?? 0) * 0.03 - Math.abs((candidate.fraction ?? 0.5) - 0.5) * 10;
}

function compactEvidence(trial, chosen) {
  const { candidate, measured, graphLayout, issues } = trial;
  const code = chosen === trial ? 'selected' : issues.length ? 'rejected' : candidate.baseline ? 'baseline-only' : 'lower-ranked';
  return {
    candidate, decision: code,
    reason: code === 'selected' ? 'Highest ranking candidate after all mandatory checks' :
      code === 'lower-ranked' ? `Fits but ranks below ${chosen?.candidate.id ?? 'selection threshold'}` :
      code === 'baseline-only' ? 'Original comparison geometry is diagnostic only' : 'Mandatory check failed',
    score: measured && !issues.length && !candidate.baseline ? Number(merit(trial).toFixed(2)) : null,
    issues,
    measured: measured && {
      frame: measured.frame, usedHeight: measured.usedHeight, headroom: measured.headroom, geometry: measured.geometry,
      leafLines: measured.text.map(({ id, fontPx, rect, lines }) => ({ id, fontPx, rect, lines })),
      edges: measured.edges, cardGeometry: measured.cardGeometry, graphLayout,
    },
  };
}

async function writeJson(url, value) {
  await fs.writeFile(url, `${JSON.stringify(value, null, 2)}\n`);
}

async function savePreview(page, base, renderArgs, trial, diagnostic) {
  const { html } = renderCandidate({ ...renderArgs, candidate: trial.candidate, debug: diagnostic });
  const htmlUrl = new URL(`${base}.html`, output);
  await fs.writeFile(htmlUrl, html);
  await page.goto(htmlUrl.href);
  await page.evaluate(() => document.fonts.ready);
  await fs.writeFile(new URL(`${base}.png`, output), await page.screenshot());
  return { html: `output/${base}.html`, png: `output/${base}.png` };
}

async function runCase({ id, kind, file, frame }, loaded, page) {
  const raw = await fs.readFile(new URL(encodeURI(file), root));
  const plan = planFor(kind, raw.toString('utf8'));
  const renderArgs = { plan, frame, kind, loaded };
  const trials = [];
  for (const candidate of candidates(kind, plan, frame)) {
    if (!compatible(candidate, plan)) {
      trials.push({ candidate, issues: [{ code: 'unsupported-relation-or-count', target: candidate.component }] });
      continue;
    }
    try {
      const { html, graphLayout } = renderCandidate({ ...renderArgs, candidate });
      const measured = await measurePage(page, html);
      trials.push({ candidate, measured, graphLayout, issues: [...measured.issues, ...auditBindings(plan, measured)] });
    } catch (error) {
      trials.push({ candidate, issues: [{ code: 'candidate-exception', target: candidate.id, message: error.message }] });
    }
  }
  const fitting = trials.filter(t => t.issues.length === 0 && !t.candidate.baseline).sort((a, b) => merit(b) - merit(a));
  const chosen = fitting[0];
  const prefix = stage === 'initial' ? `initial-${id}` : id;
  const diagnostic = trials.find(t => t.candidate.baseline && t.issues.length && t.measured) ??
    (!chosen ? trials.filter(t => t.measured).sort((a, b) => a.issues.length - b.issues.length || b.measured.headroom - a.measured.headroom)[0] : null);
  const diagnosticPreview = diagnostic ? { candidate: diagnostic.candidate.id,
    ...await savePreview(page, `${prefix}-diagnostic`, renderArgs, diagnostic, true) } : null;
  const traceName = `output/${prefix}.candidates.json`;
  await writeJson(new URL(`${prefix}.candidates.json`, output), {
    schemaVersion: 1, id, stage, intent: plan.layoutIntent, frame, selected: chosen?.candidate.id ?? null,
    trials: trials.map(trial => compactEvidence(trial, chosen)),
  });
  const pageId = chosen ? chosen.candidate.id : null;
  const geometryName = `output/${prefix}.geometry.json`;
  await writeJson(new URL(`${prefix}.geometry.json`, output), {
    schemaVersion: 'gray-compose-experiment/1', id, canvas, frame, units: 'CSS px', origin: 'slide top-left',
    source: { file, sha256: createHash('sha256').update(raw).digest('hex'), spanUnits: 'UTF-16 code units', blocks: plan.blocks, bindings: plan.bindings },
    readingOrder: plan.bindings.map(binding => binding.id), relations: plan.relations,
    components: Object.fromEntries(Object.entries(capabilities).filter(([key]) => chosen?.measured.geometry.some(geo => geo.component === key))),
    chosen: pageId, layout: chosen?.candidate ?? null, graphLayout: chosen?.graphLayout ?? null,
    measured: chosen?.measured ?? null,
  });
  const preview = chosen ? await savePreview(page, prefix, renderArgs, chosen, false) : {};
  return {
    id, status: chosen ? 'passed' : 'rejected', ...preview,
    details: {
      frame, selected: pageId, candidates: trials.length, measured: trials.filter(t => t.measured).length, eligible: fitting.length,
      selectedComponent: chosen?.candidate.component ?? null, headroomPx: chosen?.measured.headroom ?? null,
      trace: traceName, geometry: geometryName, diagnostic: diagnosticPreview,
      rollback: chosen ? (chosen.candidate.component === 'independent-groups' ? 'plain-structure-fallback' : null) : 'single-page-rejected; no deletion, scaling, or auto-pagination',
      preservesOriginalRepeats: kind === 'dense',
    },
  };
}

await fs.mkdir(output, { recursive: true });
const loaded = { ...await loadComponents(stage), stage };
const browser = await startBrowser();
const outcomes = [];
try {
  const page = await browser.newPage({ viewport: canvas, deviceScaleFactor: 1 });
  for (const item of cases) {
    const outcome = await runCase(item, loaded, page);
    outcomes.push(outcome);
    console.log(`${outcome.id}: ${outcome.status} ${outcome.details.selected ?? ''} (${outcome.details.eligible}/${outcome.details.candidates} fit)`);
  }
} finally {
  await browser.close();
}
await writeJson(stage === 'initial' ? new URL('initial-results.json', output) : resultUrl, {
  route: 'B', stage, modelCalls: 0, browser: browser.version(), canvas,
  typographySource: 'Microsoft YaHei on local Windows Chromium environment',
  assets: loaded.assetEvidence, cases: outcomes,
});
