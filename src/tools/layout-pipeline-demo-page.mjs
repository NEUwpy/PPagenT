import fs from 'node:fs/promises';
import path from 'node:path';
import { bindContentMapping, composeContentCalibration } from '../visual-runtime/content-layout-calibration.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

function buildSimulatedPagination(mapping, blocks) {
  return {
    kind: 'simulated-pagination-draft', pageNumber: 1,
    pageTitle: blocks.find((b) => b.role === 'title')?.text ?? '未命名页面',
    pagePurpose: '说明采购金额分档、例外处理与归档要求，读者能据此判断办理路径。',
    themeSentence: '采购金额决定常规审批路径，但应急和归档要求贯穿执行。',
    readingUnits: blocks.filter((b) => b.role === 'object').map((b, i) => ({ id: b.id, sourceUnitIds: b.unitIds, semanticGroup: b.semanticGroup ?? null, order: i + 1 })),
    sharedUnits: blocks.filter((b) => b.role === 'shared').map((b) => ({ id: b.id, sourceUnitIds: b.unitIds, appliesTo: b.scopeIds ?? [] })),
    sourcePath: mapping.sourcePath, note: '模拟分页稿：页面目的、主题句、阅读单元和来源归属已确定；尚未写入坐标。',
  };
}

function chooseLayout(source, mapping) {
  const blocks = bindContentMapping(source, mapping);
  const objectBlocks = blocks.filter((b) => b.role === 'object');
  const parallelGroup = objectBlocks.length > 1 && new Set(objectBlocks.map((b) => b.semanticGroup ?? b.id)).size === 1;
  const hasScopedSharedBands = blocks.some((b) => b.role === 'shared' && b.scopeIds?.length);
  const candidates = [['cards','horizontal','横向卡片'], ['cards','vertical','纵向卡片'], ['album','horizontal','相册分区'], ['hybrid','horizontal','横纵组合 · 横排主体＋下方说明'], ['hybrid','vertical','组合候选 · 纵排主体＋下方说明']].map(([family,direction,label]) => {
    try {
      if(hasScopedSharedBands && family!=='hybrid') throw new Error('存在跨块说明，需组合分区，单层候选不承担整页');
      const result = composeContentCalibration(source, mapping, { family, direction });
      const objects = result.regions.filter((r) => r.role === 'object');
      const min = Math.min(...objects.map((r) => Math.min(r.width, r.height)));
      const score = 0
        + 0
        + 0
        + 0
        + Math.min(10, min / 60);
      return { family, direction, label, status: '可承载', score: Number(score.toFixed(2)), result };
    } catch (error) { return { family, direction, label, status: '不可承载', score: -Infinity, error: error.message }; }
  });
  const selected = candidates.filter((c) => c.result).sort((a,b) => b.score - a.score)[0];
  if (!selected) throw new Error('没有布局规则能够完整承载这份分页稿');
  return { blocks, candidates, selected, pattern: parallelGroup && hasScopedSharedBands ? 'parallel-with-scoped-bands' : 'content-blocks' };
}

export async function layoutPipelineDemoPage(root) {
  const mapping = JSON.parse(await fs.readFile(path.join(root, 'catalog/layout-calibration-procurement.json'), 'utf8'));
  const source = await fs.readFile(path.join(root, mapping.sourcePath), 'utf8');
  const chosen = chooseLayout(source, mapping); const { selected } = chosen;
  const pagination = buildSimulatedPagination(mapping, chosen.blocks);
  const regions = selected.result.regions.map((r) => `<section class="region ${esc(r.role)}" style="left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px"><div>${esc(r.text)}</div></section>`).join('');
  const candidateRows = chosen.candidates.map((c) => `<tr><td>${esc(c.label)}</td><td>${esc(c.family)} · ${esc(c.direction)}</td><td>${esc(c.status)}</td><td>${Number.isFinite(c.score) ? c.score : '—'}</td><td>${esc(c.error ?? '完整文字可容纳')}</td></tr>`).join('');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>分页稿到灰稿链条演示</title><style>
  *{box-sizing:border-box}body{font-family:'Microsoft YaHei',sans-serif;margin:0;padding:24px;color:#263343;background:#f5f7fa}h1{margin:0 0 8px}h2{font-size:20px;margin:0 0 12px}.intro{color:#536477;line-height:1.7}.pipeline{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:20px 0}.step{padding:12px;border:1px solid #cbd7e3;border-radius:9px;background:#fff}.step strong{display:block;color:#214e76}.step.selected{border-color:#32658c;background:#edf5fb}.panel{background:#fff;border:1px solid #d8e1eb;border-radius:12px;padding:18px;margin:14px 0}pre{white-space:pre-wrap;background:#f6f8fa;padding:12px;border-radius:8px;line-height:1.5}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d8e0e9;padding:9px;text-align:left;vertical-align:top}.notice{padding:10px 12px;background:#fff4d6;border-left:4px solid #d49a22}.viewport{overflow:auto;border:1px solid #dce3eb;border-radius:10px}.stage{width:1218px;padding:24px}.canvas{width:1170px;height:492px;position:relative}.region{position:absolute;padding:16px;background:#e9eef4;border-top:3px solid #91a4b8;font-size:22px;line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere}.region.object{display:flex;align-items:center}.region.object>div{border-left:3px solid #91a4b8;padding-left:14px}.shared{background:#f0f3f6;border-top:1px solid #c2cdd8}.muted{color:#63758a}</style>
  <h1>从分页稿到灰稿：布局规则选择链</h1><p class="intro">这是一条可检查的模拟链：布局规则库 → 模拟分页稿 → 空间需求 → 规则候选与自动选择 → 真实文字灰稿。当前输入是模拟分页稿，选择器是确定性规则，尚不等于正式线跨稿验收。</p>
  <div class="pipeline"><div class="step"><strong>1 · 布局建设</strong><span>卡片 / 相册规则</span></div><div class="step"><strong>2 · 模拟分页稿</strong><span>一页一事、主题句、来源</span></div><div class="step"><strong>3 · 空间需求</strong><span>视觉块、共同作用范围</span></div><div class="step selected"><strong>4 · 规则选择</strong><span>${esc(selected.label)} · 得分 ${selected.score}</span></div><div class="step selected"><strong>5 · 灰稿实例</strong><span>真实文字填入并检查</span></div></div>
  <section class="panel"><h2>1. 已建设的布局规则</h2><p>规则定义可变的方向、块数、面积权重、最小承载尺寸和失败条件；不是固定页面坐标。</p><pre>${esc(JSON.stringify({families:['cards','album','hybrid'],pattern:chosen.pattern,selectedRule:{family:selected.family,direction:selected.direction,reason:'本演示使用人工标注的主体与说明关系构造分区树；候选均须通过实文测量，再按区域最短边比较。这只是启发式排序，尚未验证通用选型质量'}},null,2))}</pre></section>
  <section class="panel"><h2>2. 模拟分页稿</h2><pre>${esc(JSON.stringify(pagination,null,2))}</pre></section>
  <section class="panel"><h2>3. 从分页稿提取空间需求</h2><table><tr><th>视觉块</th><th>来源</th><th>语义组</th><th>作用范围</th><th>正文</th></tr>${chosen.blocks.map((b)=>`<tr><td>${esc(b.id)} · ${esc(b.role)}</td><td>${esc(b.unitIds.join('、'))}</td><td>${esc(b.semanticGroup??'')}</td><td>${esc((b.scopeIds??[]).join('、')||'—')}</td><td>${esc(b.text)}</td></tr>`).join('')}</table></section>
  <section class="panel"><h2>4. 布局候选与选择</h2><table><tr><th>候选</th><th>规则</th><th>承载</th><th>得分</th><th>依据</th></tr>${candidateRows}</table><p class="notice">自动选择结果：<strong>${esc(selected.label)}</strong>。当前实例采用“并列主体＋作用范围说明带”组合规则；具体方向由分页稿关系和实文承载共同决定，当前只验证人工关系输入上的分区求解，尚未验证自动内容识别。</p></section>
  <section class="panel"><h2>5. 灰稿实例</h2><p class="muted">布局规则：${esc(selected.label)}；正文逐字来自原稿，22px，不缩字、不删文。</p><div class="viewport"><div class="stage"><h2>${esc(selected.result.title)}</h2><div class="canvas">${regions}</div></div></div></section>
  <details class="panel"><summary>查看最终布局回执</summary><pre>${esc(JSON.stringify(selected.result,null,2))}</pre></details><script>const stage=document.querySelector('.stage'),viewport=document.querySelector('.viewport');const resize=()=>{stage.style.zoom=Math.min(1,viewport.clientWidth/1218)};new ResizeObserver(resize).observe(viewport);resize();</script></html>`;
}
