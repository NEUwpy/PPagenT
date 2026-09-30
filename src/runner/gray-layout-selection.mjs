import fs from 'node:fs/promises';
import path from 'node:path';
import { composePageLayout, layoutRules } from '../visual-runtime/page-layout-library.mjs';
import { semanticPages, bindSemanticLayout, planContentFingerprint } from './gray-semantics.mjs';

export const LAYOUT_SELECTION_PROMPT = `你是页面布局选择器。只从每页程序已按真实文字测量的候选中选择；不改内容、不编坐标。
先对照原稿和页面计划判断组间关系。区分并列、独立内容、对照、先后、因果、主辅和混合，不按组数猜关系。
cards 卡片式适合平级、可独立阅读的内容；album 相册式适合可独立阅读、体量或形状不同的内容。
多组存在必须对齐对照、连线或先后连接的空间约束时返回 none。主辅关系仅可选择 supportsRelation 含 support 的候选：这类候选将连续的 supporting 组放在共同说明横带，主体在另一横带中排列。判断说明确实作用于主体，不把局部限定放到整页。
只判断跨组的必要空间约束。组内已经就近写明的限定、附注和解释不构成跨组约束，不因卡片没有重排这些组内文字而拒绝；正文多少不同也不是拒绝理由，应比较实测区域与内容是否相称。
只有一组时，组内关系由实文/结构说明表达，可以选择单区域 cards。
候选只分配组之间的空间，不会替你重排组内条目。单区域候选的 equal/measured、横向/纵向若坐标相同，不得声称其中一种给条目分配更多面积。单区域结果不能证明多块布局选型有效。
页面主题句可引出、概括或总结。必须检查候选是否使重要内容过弱、阅读顺序是否明确，容量通过不等于好看。none用于实际必要关系、作用范围或阅读顺序无法满足；宽度不等或比例不常见本身不是硬拒绝理由。存在无具体约束违例的可承载候选时，按实文需要选其中最合适者，视觉风险写入reason供人审阅。
返回纯JSON：{"pages":[{"pageId":"...","relation":"parallel|independent|comparison|sequence|causal|support|mixed","candidateId":"候选id或none","reason":"根据本页实际内容说明选择依据或缺口"}]}。严格保持页序，每页恰好一项。`;

/** 逐页选择最大可承载的正文档；18px 以下必须退回内容规划。 */
export function measuredLayoutCandidates(plan, area, metrics) {
  return plan.pages.map(page => {
    let measured;
    for (const fontSize of [22, 20, 18]) {
      measured = measuredAtFont({ ...plan, pages: [page] }, area, metrics, fontSize)[0];
      measured.fontSize = fontSize;
      if (measured.candidates.length) return measured;
    }
    return measured;
  });
}
/** Advisory only: measurement preserves groups and content; planner decides page purpose. */
export function adjacentPageLayoutAdvice(plan, area, metrics) {
  const advice = [];
  for (let i = 0; i + 1 < plan.pages.length; i++) {
    const pages = plan.pages.slice(i, i + 2), origins = {};
    // This advisory renames groups/blocks; an existing visual binding must be
    // replanned explicitly, not copied with stale IDs into a synthetic page.
    if(pages.some(page=>page.visualMapping)) continue;
    const groups = pages.flatMap((page, pi) => (page.readingOrder ?? page.groups.map(g => g.id)).map((id, gi) => {
      const group = structuredClone(page.groups.find(g => g.id === id));
      group.id = `merge-${pi}-${gi}`;
      origins[group.id] = { pageId: page.pageId, groupId: id };
      group.blocks.forEach((block, bi) => { block.id = `${group.id}-block-${bi}`; });
      return group;
    }));
    const page = { ...pages[0], groups, readingOrder: groups.map(g => g.id) };
    const measured = measuredLayoutCandidates({ ...plan, pages: [page] }, area, metrics)[0];
    if (!measured.candidates.length) continue;
    advice.push({ pageIds: pages.map(p => p.pageId), pagePurposes: pages.map(p => p.pagePurpose),
      fontSize: measured.fontSize, candidates: measured.candidates.map(c => ({ id: c.id,
        regions: c.regions.map(r => ({ ...r, ...origins[r.itemId] })), contentMinimums: c.contentMinimums })),
      message: '仅为保留原组和原文的几何容量证据，尚未验证两页的relations、跨组关系约束或共同页面目的，不是语义可合页结论或合页指令。判断这两页能否共同回答一个页面问题；若能，重提完整计划并审稿；若不能，按内容目的保留分页。最小高度已含内边距和条目间距，接近区域高度不等于没有阅读间距，不能仅据此判断拥挤。' });
  }
  return advice;
}
function measuredAtFont(plan, area, { measureBody, fitText }, fontSize) {
  return semanticPages(plan).map(page => {
    const items = page.semantics.readingOrder.map(id => page.items.find(item => item.id === id));
    const cache = new Map();
    const measure = (item, width) => {
      const key = `${item.id}:${width}`;
      if (!cache.has(key)) cache.set(key, measureBody(item, width, fontSize));
      return cache.get(key);
    };
    // 记录宽度改变时的真实高度需求，而不是把每组压成一个面积数字。
    const requirements = items.map(item => {
      const widths = [...new Set([area.width, (area.width - 24) / 2, (area.width - 48) / 3])];
      const samples = widths.map(width => {
        const body = measure(item, width - 32);
        return { width, height: Math.ceil(70 + body.height), fits: body.fits && fitText(item.heading, width - 32, 40, 26).fits && body.height + 70 <= area.height };
      });
      const usable = samples.filter(s => s.fits);
      const preferred = usable.at(-1) ?? samples[0];
      return { itemId: item.id, kind: item.kind, importance: item.importance, samples,
        aspectRatio: preferred.width / preferred.height,
        basis: '候选宽度下的实文与当前灰稿表达测量；不是最终媒介比例或逻辑判断' };
    });
    const candidates = [], rejected = [];
    if (items.some(item => {
      const full = measure(item, area.width - 32);
      return !full.fits || full.height + 70 > area.height;
    })) return { pageId: page.pageId, requirements, candidates, rejected: [{ id: 'all', reason: '至少一个组即使独占内容区也无法承载；需要重新规划' }] };
    for (const family of ['cards', 'album']) {
      if (family === 'album' && items.length < 2) continue;
      for (const direction of family === 'cards' ? ['horizontal', 'vertical'] : ['horizontal']) {
        for (const allocation of ['equal', 'measured']) {
          const id = `${family}-${direction}-${allocation}`;
          try {
            let blocks = items.map((item, i) => ({ weight: allocation === 'equal' ? 1 : Math.max(1, measure(item, Math.max(140, area.width / Math.min(items.length, 3) - 32)).height), aspectRatio: requirements[i].aspectRatio, minWidth: 140, minHeight: 80 }));
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
            if (!fits) throw new Error('当前正文档下标题或正文无法完整容纳');
            const regions = geometry.slots.map((slot, i) => ({ itemId: items[i].id, x: slot.x, y: slot.y, width: slot.width, height: slot.height, fontSize }));
            if (!candidates.some(c => JSON.stringify(c.regions) === JSON.stringify(regions))) {
              candidates.push({ id, family, direction, allocation, geometry, regions, contentMinimums: minimums });
            }
          } catch (error) { rejected.push({ id, reason: error.message }); }
        }
      }
    }
    // 主体与共同说明分带。依照既有组序和 importance，不猜测或改写说明归属。
    const support = items.filter(item => item.importance === 'supporting');
    const primary = items.filter(item => item.importance !== 'supporting');
    if (support.length && primary.length) {
      const atStart = items.slice(0, support.length).every(item => item.importance === 'supporting');
      const atEnd = items.slice(-support.length).every(item => item.importance === 'supporting');
      const id = 'cards-support-band';
      try {
        if (!atStart && !atEnd) throw new Error('共同说明不连续，不能在不改变阅读顺序的情况下分带');
        const sw = (area.width - 24 * (support.length - 1)) / support.length;
        const sh = Math.max(...support.map(item => Math.ceil(70 + measure(item, sw - 32).height)));
        const pw = (area.width - 24 * (primary.length - 1)) / primary.length;
        const primaryMinimum = Math.max(...primary.map(item => Math.ceil(70 + measure(item, pw - 32).height)));
        const bandGap = Math.min(24, area.height - sh - primaryMinimum);
        if (bandGap < 8) throw new Error('主体与说明的实测高度不足以保留 8px 最小间距');
        const ph = area.height - sh - bandGap;
        if (ph <= sh) throw new Error('共同说明占用过大，无法维持主体优先');
        const minimums = {}, regions = [];
        for (const [group, y, height] of [[support, atStart ? 0 : ph + bandGap, sh], [primary, atStart ? sh + bandGap : 0, ph]]) {
          const width = (area.width - 24 * (group.length - 1)) / group.length;
          for (const [i, item] of group.entries()) {
            const body = measure(item, width - 32), minHeight = Math.ceil(70 + body.height);
            if (width < 140 || !body.fits || !fitText(item.heading, width - 32, 40, 26).fits || minHeight > height) throw new Error('主辅分带后实文无法完整容纳');
            minimums[item.id] = { minWidth: width, minHeight };
            regions.push({ itemId: item.id, x: i * (width + 24), y, width, height, fontSize });
          }
        }
        regions.sort((a,b) => items.findIndex(i=>i.id===a.itemId)-items.findIndex(i=>i.id===b.itemId));
        candidates.push({ id, family: 'cards', direction: 'support-band', allocation: 'measured', supportsRelation: ['support'], regions, contentMinimums: minimums });
      } catch (error) { rejected.push({ id, reason: error.message }); }
    }
    return { pageId: page.pageId, requirements, candidates, rejected };
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
    const supportingIds = new Set(page.groups.filter(g => g.importance === 'supporting').map(g => g.id));
    if (supportingIds.size && supportingIds.size < page.groups.length) {
      const areaOf = supporting => candidate.regions.filter(r => supportingIds.has(r.itemId) === supporting).reduce((sum,r) => sum+r.width*r.height,0);
      if (areaOf(true) >= areaOf(false)) throw new Error(`页 ${page.pageId} 共同说明面积不小于主体；不能把已声明的 supporting 改称 parallel 绕过主次要求`);
    }
    if (page.groups.length > 1 && !['parallel','independent',...(candidate.supportsRelation ?? [])].includes(choice.relation)) throw new Error(`页 ${page.pageId} 的 ${choice.relation} 跨组关系尚无已建约束布局；不能硬套 ${candidate.family}`);
    layouts.push({ pageId: page.pageId, regions: candidate.regions });
    const fontSize = candidate.regions[0].fontSize;
    receipts.push({ pageId: page.pageId, layout: { family: candidate.family, direction: candidate.direction, allocation: candidate.allocation }, fontSize, contentMinimums: candidate.contentMinimums, occupiedRegions: candidate.regions, selection: choice });
  }
  const bound = bindSemanticLayout(plan, { pages: layouts });
  bound.pages.forEach((page, i) => { page.composition.basicLayout = receipts[i].layout; });
  return { plan: bound, receipts };
}

export async function selectMeasuredLayouts({ plan, area, source, provider, directory, metrics }) {
  const measured = measuredLayoutCandidates(plan, area, metrics);
  const input = { source, plan, area, rules: layoutRules, pages: measured.map(p => ({ ...p, candidates: p.candidates.map(c => ({ id: c.id, family: c.family, direction: c.direction, allocation: c.allocation, supportsRelation: c.supportsRelation, regions: c.regions, contentMinimums: c.contentMinimums })) })) };
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
    if (typeof provider.decide === 'function') {
      const pages = [];
      for (const page of measured) {
        const candidateCriteria = Object.fromEntries(page.candidates.map(candidate => [candidate.id, `${candidate.family}/${candidate.direction}/${candidate.allocation}，程序已确认可承载` ]));
        const relationCriteria = Object.fromEntries(['parallel','independent','comparison','sequence','causal','support','mixed'].map(relation => [relation, relation]));
        const decision = await provider.decide({
          state: { source, page: { ...plan.pages.find(item => item.pageId === page.pageId), requirements: page.requirements, candidates: page.candidates.map(candidate => ({ id: candidate.id, family: candidate.family, direction: candidate.direction, allocation: candidate.allocation, supportsRelation: candidate.supportsRelation })) } },
          questions: {
            candidateId: { type: 'choice', instructions: '从程序确认可承载的候选中选择一个，不重新设计布局。', criteria: candidateCriteria },
            relation: { type: 'choice', instructions: '判断本页跨组关系。只按原稿关系选择，不因为候选方便改写关系。', criteria: relationCriteria },
          },
        });
        const candidateAnswer = decision.answers?.candidateId;
        const relationAnswer = decision.answers?.relation;
        if (candidateAnswer?.type !== 'choice' || relationAnswer?.type !== 'choice') throw new Error('JEV 布局与关系回答必须为 choice 类型');
        const candidateId = candidateAnswer?.choice;
        const relation = relationAnswer?.choice;
        pages.push({ pageId: page.pageId, candidateId, relation, reason: `JEV 选择候选 ${candidateId ?? '未知'}，关系 ${relation ?? '未知'}；程序负责容量与合法性校验。` });
      }
      selection = { pages };
      const built = bindLayoutSelection(plan, measured, selection);
      await save('layout-selection-result.json', { status: 'selected-awaiting-render', provider: 'jev-decisions', model: provider.model, contentFingerprint: planContentFingerprint(plan), selection, receipts: built.receipts });
      return built;
    }
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
