import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
const here = import.meta.dirname;
const draft = JSON.parse(await fs.readFile(path.join(here, 'content-draft.json'), 'utf8'));
const groups = new Map(draft.grouping.groups.map(g => [g.id, g]));
const esc = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortTitles = {
  'evidence-demand-fact':'需求集中', 'evidence-demand-interpretation':'含义与限制',
  'evidence-record-fact':'记录缺口集中', 'evidence-record-interpretation':'含义与限制',
  'evidence-capacity-fact':'管理员容量受限', 'evidence-capacity-interpretation':'估计的适用边界',
  'synthesis-trial-case':'综合判断', 'boundary-evidence':'证据边界',
  'validation-plan':'如何验证', 'conditional-action':'不达标时的行动',
};
const group = id => { const g = groups.get(id); return `<section data-group="${id}"><h3>${shortTitles[id]}</h3><p>${esc(g.sourceText)}</p></section>`; };
const lanes = ['demand','record','capacity'].map(key => `<div class="lane">${group(`evidence-${key}-fact`)}${group(`evidence-${key}-interpretation`)}</div>`).join('');
const html = `<!doctype html><html lang="zh"><meta charset="utf-8"><title>P3 实文分组草稿</title><style>
*{box-sizing:border-box}body{margin:0;background:#eee;font-family:'Microsoft YaHei',sans-serif;color:#242424}.page{width:1280px;height:720px;background:white;margin:0 auto;padding:22px 55px}.chapter{font-size:28px;font-weight:700;margin-bottom:10px}.topic{font-size:18px;line-height:24px;padding:10px 0;border-top:2px solid #444;border-bottom:1px solid #aaa;margin-bottom:12px}.body{display:flex;flex-direction:column;gap:12px}.evidence{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}.lane{display:grid;grid-template-rows:128px auto;gap:10px}.lane section+section{border-top:1px dashed #aaa;padding-top:10px}h3{font-size:20px;margin:0 0 7px;line-height:24px}p{font-size:18px;line-height:24px;margin:0}.synthesis{border-top:1px solid #aaa;padding-top:10px}.bottom{display:grid;grid-template-columns:1fr 2fr;gap:28px}.bottom>div{display:flex;flex-direction:column;gap:10px}footer{font-size:12px;color:#666;margin-top:12px}.guide{width:1170px;margin:24px auto;font-size:16px;line-height:1.7}.guide table{border-collapse:collapse;width:100%;background:white}.guide td,.guide th{border:1px solid #ccc;padding:8px;text-align:left}
</style><div class="page"><div class="chapter">多证据论证 · 实文结构草稿</div><div class="topic" data-group="topic">${esc(draft.grouping.topic.sourceText)}</div><main class="body"><div class="evidence">${lanes}</div><div class="synthesis">${group('synthesis-trial-case')}</div><div class="bottom">${group('boundary-evidence')}<div>${group('validation-plan')}${group('conditional-action')}</div></div></main></div><div class="guide"><h2>分组依据与原文归属</h2><p>三列分别呈现证据与本证据的解读；共同支持下方综合判断。边界限定结论，验证和不达标行动承接结论。此阶段只检查信息关系与实文容量。</p><table><tr><th>组 ID</th><th>角色</th><th>完整原文</th></tr>${draft.grouping.groups.map(g => `<tr><td>${g.id}</td><td>${g.role}</td><td>${esc(g.sourceText)}</td></tr>`).join('')}</table></div></html>`;
await fs.writeFile(path.join(here,'text-draft.html'), html);
const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try {
  const page = await browser.newPage({ viewport:{width:1320,height:900},deviceScaleFactor:1 });
  await page.goto(`file:///${here.replaceAll('\\','/')}/text-draft.html`);
  await page.evaluate(() => document.fonts.ready);
  const measured = await page.evaluate(() => [...document.querySelectorAll('[data-group]')].map(el => ({groupId:el.dataset.group, text:el.querySelector('p')?.textContent ?? el.textContent, rect:el.getBoundingClientRect().toJSON()})));
  await fs.writeFile(path.join(here,'text-draft-measurements.json'),JSON.stringify(measured,null,2));
  await page.locator('.page').screenshot({path:path.join(here,'text-draft.png')});
  console.log(JSON.stringify({maxBottom:Math.max(...measured.map(m=>m.rect.bottom)), groupCount:measured.length}));
} finally { await browser.close(); }
