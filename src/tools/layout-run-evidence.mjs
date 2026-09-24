import fs from 'node:fs/promises';
import path from 'node:path';

const readJson = async file => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; } };
export async function layoutRunEvidence(root) {
  const runs = path.join(root, '.tmp', 'production-workbench', 'runs');
  const names = await fs.readdir(runs).catch(() => []);
  const evidence = [];
  for (const runId of names.filter(n => /^[\w-]+$/.test(n)).sort().reverse().slice(0, 60)) {
    const dir = path.join(runs, runId), attempts = path.join(dir, 'agent-renders');
    const renders = await fs.readdir(attempts).catch(() => []);
    for (const renderId of renders.filter(n => /^render-\d+$/.test(n)).sort((a,b) => Number(b.slice(7))-Number(a.slice(7)))) {
      const attempt = path.join(attempts, renderId);
      const result = await readJson(path.join(attempt, 'layout-selection-result.json'));
      if (!result) continue;
      const input = await readJson(path.join(attempt, 'layout-selection-input.json'));
      const plan = await readJson(path.join(attempt, 'plan.json'));
      const pngs = (await fs.readdir(path.join(attempt, 'preview')).catch(() => [])).filter(n => /^slide-\d+\.png$/.test(n)).sort();
      const hasPptx = await fs.stat(path.join(attempt, 'gray-draft.pptx')).then(() => true, () => false);
      const rendered = hasPptx && Boolean(plan?.pages?.length) && pngs.length === plan.pages.length;
      evidence.push({ runId, renderId, status: rendered ? 'rendered-awaiting-review' : result.status, model: result.model, source: input?.source ?? '', pages: input?.plan?.pages ?? [], candidates: input?.pages ?? [], selection: result.selection, reason: result.reason, rendered, hasPlan: Boolean(plan), previews: pngs.map(name => `/api/layout-run-preview?run=${encodeURIComponent(runId)}&render=${renderId}&file=${name}`), userAccepted: false });
      // 先收集本次有限数量的尝试，最后把有真实 PPTX+逐页 PNG 的交付排在前面；
      // 否则一次失败重试会把唯一可审阅成品挤出看板首屏。
    }
  }
  return evidence
    .sort((a, b) => Number(b.rendered) - Number(a.rendered) || String(b.runId + b.renderId).localeCompare(String(a.runId + a.renderId)))
    .slice(0, 12);
}

export async function layoutRunPreview(root, { run, render, file }) {
  if (!/^[\w-]+$/.test(run ?? '') || !/^render-\d+$/.test(render ?? '') || !/^slide-\d+\.png$/.test(file ?? '')) throw new Error('无效预览路径');
  const base = await fs.realpath(path.join(root, '.tmp', 'production-workbench', 'runs'));
  const target = await fs.realpath(path.join(base, run, 'agent-renders', render, 'preview', file));
  if (!target.startsWith(base + path.sep)) throw new Error('预览路径越界');
  return fs.readFile(target);
}
