import fs from 'node:fs/promises';
import path from 'node:path';
import { composePageLayout, layoutRules } from '../visual-runtime/page-layout-library.mjs';
import { semanticPages, bindSemanticLayout, planContentFingerprint } from './gray-semantics.mjs';

export const LAYOUT_SELECTION_PROMPT = `你是页面布局选择器。只从每页程序已按真实文字测量的候选中选择；不改内容、不编坐标。
先对照原稿和页面计划判断组间关系。区分并列、独立内容、对照、先后、因果、主辅和混合，不按组数猜关系。
cards 卡片式适合平级、可独立阅读的内容；album 相册式适合可独立阅读、体量或形状不同的内容。
多组存在必须对照、先后、因果或主辅关系时，当前两类几何没有实现这些跨组约束，返回 none，不把整齐冒充逻辑。
只有一组时，组内关系由实文/结构说明表达，可以选择单区域 cards。
页面主题句可引出、概括或总结。必须检查候选是否使重要内容过弱、阅读顺序是否明确，容量通过不等于好看。
返回纯JSON：{"pages":[{"pageId":"...","relation":"parallel|independent|comparison|sequence|causal|support|mixed","candidateId":"候选id或none","reason":"根据本页实际内容说明选择依据或缺口"}]}。严格保持页序，每页恰好一项。`;

/** 候选来自看板同源布局规范；默认字号固定，不能靠试小字号掩盖容量失败。 */
export function measuredLayoutCandidates(plan, area, { measureBody, fitText }) {
  return semanticPages(plan).map(page => {
    const items = page.semantics.readingOrder.map(id => page.items.find(item => item.id === id));
    const cache = new Map();
    const measure = (item, width) => {
      const key = `${item.id}:${width}`;
      if (!cache.has(key)) cache.set(key, measureBody(item, width, 22));
      return cache.get(key);
    };
    const candidates = [], rejected = [];
    if (items.some(item => {
      const full = measure(item, area.width - 32);
      return !full.fits || full.height + 70 > area.height;
    })) return { pageId: page.pageId, candidates, rejected: [{ id: 'all', reason: '至少一个组即使独占内容区也无法承载；需要重新规划' }] };
    for (const family of ['cards', 'album']) {
      if (family === 'album' && items.length < 2) continue;
      for (const direction of family === 'cards' ? ['horizontal', 'vertical'] : ['horizontal']) {
        for (const allocation of ['equal', 'measured']) {
          const id = `${family}-${direction}-${allocation}`;
          try {
            let blocks = items.map(item => ({ weight: allocation === 'equal' ? 1 : Math.max(1, measure(item, Math.max(140, area.width / Math.min(items.length, 3) - 32)).height), aspectRatio: 1.6, minWidth: 140, minHeight: 80 }));
            let geometry, minimums, fits = false;
            for (let pass = 0; pass < 4; pass++) {
              geometry = composePageLayout({ family, direction, blocks, width: area.width, height: area.height, gap: 24 });
              minimums = {};
              fits = geometry.slots.every((slot, i) => {
                const heading = fitText(items[i].heading, slot.width - 32, 40, 26);
                const body = measure(items[i], slot.width - 32);
                const minHeight = Math.max(80, Math.ceil(70 + body.height));
                minimums[items[i].id] = { minWidth: slot.width, minHeight };
                return heading.fits && body.fits && minHeight <= slot.height;
              });
              if (fits || allocation === 'equal') break;
              // 面积需求根据候选宽度下的真实测量更新，不用字符数当容量。
              blocks = geometry.slots.map((slot, i) => ({ ...blocks[i], weight: slot.width * Math.max(80, 70 + measure(items[i], slot.width - 32).height) }));
            }
            if (!fits) throw new Error('当前字号下标题或正文无法完整容纳');
            const regions = geometry.slots.map((slot, i) => ({ itemId: items[i].id, x: slot.x, y: slot.y, width: slot.width, height: slot.height, fontSize: 22 }));
            candidates.push({ id, family, direction, allocation, geometry, regions, contentMinimums: minimums });
          } catch (error) { rejected.push({ id, reason: error.message }); }
        }
      }
    }
    return { pageId: page.pageId, candidates, rejected };
  });
}

export function bindLayoutSelection(plan, measured, selection) {
  if (!Array.isArray(selection?.pages) || selection.pages.length !== plan.pages.length) throw new Error('布局选择页数不匹配');
  const receipts = [], layouts = [];
  for (const [i, page] of plan.pages.entries()) {
    const choice = selection.pages[i];
    if (choice?.pageId !== page.pageId || typeof choice.reason !== 'string' || !choice.reason.trim()) throw new Error('布局选择必须保留页序及明确理由');
    if (!['parallel','independent','comparison','sequence','causal','support','mixed'].includes(choice.relation)) throw new Error('布局关系分类无效');
    const candidate = measured[i].candidates.find(c => c.id === choice.candidateId);
    if (!candidate) throw new Error(`页 ${page.pageId} 没有合适的已建布局：${choice.reason}`);
    if (page.groups.length > 1 && !['parallel','independent'].includes(choice.relation)) throw new Error(`页 ${page.pageId} 的 ${choice.relation} 跨组关系尚无已建约束布局；不能硬套 ${candidate.family}`);
    layouts.push({ pageId: page.pageId, regions: candidate.regions });
    receipts.push({ pageId: page.pageId, layout: { family: candidate.family, direction: candidate.direction, allocation: candidate.allocation }, fontSize: 22, contentMinimums: candidate.contentMinimums, occupiedRegions: candidate.regions, selection: choice });
  }
  const bound = bindSemanticLayout(plan, { pages: layouts });
  bound.pages.forEach((page, i) => { page.composition.basicLayout = receipts[i].layout; });
  return { plan: bound, receipts };
}

export async function selectMeasuredLayouts({ plan, area, source, provider, directory, metrics }) {
  const measured = measuredLayoutCandidates(plan, area, metrics);
  const input = { source, plan, area, rules: layoutRules, pages: measured.map(p => ({ ...p, candidates: p.candidates.map(c => ({ id: c.id, family: c.family, direction: c.direction, allocation: c.allocation, regions: c.regions, contentMinimums: c.contentMinimums })) })) };
  const save = (file, value) => fs.writeFile(path.join(directory, file), JSON.stringify(value, null, 2));
  await save('layout-selection-input.json', input);
  await fs.writeFile(path.join(directory, 'layout-selection-prompt.txt'), LAYOUT_SELECTION_PROMPT);
  const missing = measured.filter(p => !p.candidates.length);
  if (missing.length) {
    await save('layout-selection-result.json', { status: 'no-capacity-candidate', pages: missing, contentFingerprint: planContentFingerprint(plan) });
    throw new Error(`这些页没有能承载实文的已建布局：${missing.map(p => p.pageId).join('、')}；请重组或分页，不能缩字硬塞。`);
  }
  let selection;
  try {
    const response = await provider.complete({ messages: [{ role: 'system', content: LAYOUT_SELECTION_PROMPT }, { role: 'user', content: JSON.stringify(input) }] });
    await save('layout-selection-response.json', response);
    if (response.finishReason === 'length') throw new Error('布局选择响应截断');
    selection = JSON.parse(String(response.content ?? '').trim().replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, ''));
    const built = bindLayoutSelection(plan, measured, selection);
    await save('layout-selection-result.json', { status: 'selected-awaiting-render', contentFingerprint: planContentFingerprint(plan), model: provider.model, selection, receipts: built.receipts });
    return built;
  } catch (error) {
    await save('layout-selection-result.json', { status: 'rejected', contentFingerprint: planContentFingerprint(plan), selection, reason: error.message });
    throw error;
  }
}
